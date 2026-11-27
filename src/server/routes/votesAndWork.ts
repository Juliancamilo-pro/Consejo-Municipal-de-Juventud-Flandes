import type express from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  commissions,
  commitments,
  ideasInbox,
  letterTemplates,
  publicCouncilors,
  roleTerms,
  users,
  votes,
  workPlans,
} from '../../db/schema.ts';
import {
  BLANK_VOTE_OPTION,
  isElectiveRole,
  requiresCommissionForRole,
} from '../../lib/roleTerms.ts';
import {
  type AuthedRequest,
  createPortalNotification,
  logServerAudit,
  newId,
  requireAuth,
  requirePermission,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';
import {
  closeExpiredVotes,
  computeVoteOutcomeServer,
  handleElectionClosure,
} from '../services/roleTransitions.ts';
import type { VoteCandidate } from '../../types/cmj.ts';

function computeVoteResultSummary(v: {
  options: string[];
  tallies: Record<string, number>;
  voterUids: string[];
  quorumRequired: number;
  majorityType: string;
}): string {
  const total = v.voterUids.length;
  if (total < (v.quorumRequired || 1)) {
    return `Sin quórum (${total}/${v.quorumRequired || 1})`;
  }
  const entries = v.options.map((opt) => ({ opt, count: v.tallies?.[opt] || 0 }));
  entries.sort((a, b) => b.count - a.count);
  const leader = entries[0];
  const runnerUp = entries[1];
  if (!leader || leader.count === 0) return 'Sin votos emitidos';

  const maj = v.majorityType || 'simple';
  if (maj === 'unanimidad') {
    return leader.count === total ? `Aprobada por unanimidad (${leader.opt})` : `Rechazada · sin unanimidad`;
  }
  if (maj === 'dos_tercios') {
    const needed = Math.ceil((total * 2) / 3);
    return leader.count >= needed
      ? `Aprobada por 2/3 (${leader.opt}: ${leader.count}/${total})`
      : `No alcanza 2/3 (${leader.count}/${needed} requeridos)`;
  }
  if (maj === 'absoluta') {
    const needed = Math.floor(total / 2) + 1;
    return leader.count >= needed
      ? `Aprobada por mayoría absoluta (${leader.opt}: ${leader.count}/${total})`
      : `Empate o sin mayoría absoluta (${leader.count}/${needed})`;
  }
  if (runnerUp && leader.count === runnerUp.count) {
    return `Empate (${leader.opt} vs ${runnerUp.opt}: ${leader.count} votos)`;
  }
  return `Aprobada (${leader.opt}: ${leader.count}/${total})`;
}

async function resolveActiveCandidates(rawCandidateUids: unknown[]): Promise<VoteCandidate[]> {
  const uniqueUids = Array.from(
    new Set(
      rawCandidateUids
        .map((u) => String(u || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 20);

  if (uniqueUids.length === 0) return [];

  const [activeUsers, pubRows] = await Promise.all([
    db
      .select({ uid: users.uid, email: users.email, active: users.active })
      .from(users)
      .where(and(inArray(users.uid, uniqueUids), eq(users.active, true))),
    db
      .select({ uid: publicCouncilors.uid, fullName: publicCouncilors.fullName, active: publicCouncilors.active })
      .from(publicCouncilors)
      .where(inArray(publicCouncilors.uid, uniqueUids)),
  ]);

  const userMap = new Map(activeUsers.map((u) => [u.uid, u]));
  const pubMap = new Map(pubRows.map((p) => [p.uid, p]));

  const baseCandidates: Array<{ uid: string; fullName: string; emailPrefix: string }> = [];
  for (const candUid of uniqueUids) {
    const u = userMap.get(candUid);
    if (!u || !u.active) continue;
    const pub = pubMap.get(candUid);
    if (pub && !pub.active) continue;
    const rawName = (pub?.fullName || u.email.split('@')[0] || candUid).trim();
    baseCandidates.push({
      uid: candUid,
      fullName: rawName,
      emailPrefix: u.email.split('@')[0] || candUid.slice(-4),
    });
  }

  // Desambiguar si dos candidatos tienen exactamente el mismo nombre completo
  const nameCounts = new Map<string, number>();
  for (const c of baseCandidates) {
    nameCounts.set(c.fullName.toLowerCase(), (nameCounts.get(c.fullName.toLowerCase()) || 0) + 1);
  }

  return baseCandidates.map((c) => ({
    uid: c.uid,
    fullName:
      (nameCounts.get(c.fullName.toLowerCase()) || 0) > 1
        ? `${c.fullName} (${c.emailPrefix})`
        : c.fullName,
  }));
}

export function registerVotesAndWorkRoutes(app: express.Express) {
  app.post('/api/votes', requireAuth, requirePermission('votaciones.crear'), async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        description,
        kind,
        targetRole,
        targetCommissionId,
        candidateUids,
        allowSelfVote,
        commissionId,
        sessionId,
        voteMode,
        majorityType,
        options,
        quorumRequired,
        opensAt,
        closesAt,
        deadline,
      } = req.body || {};

      const resolvedKind = kind === 'eleccion_cargo' ? 'eleccion_cargo' : 'general';
      const resolvedMode =
        voteMode === 'secreto' || voteMode === 'mano_alzada' ? voteMode : 'nominal';
      const resolvedMajority = ['simple', 'absoluta', 'dos_tercios', 'unanimidad'].includes(
        majorityType
      )
        ? String(majorityType)
        : 'simple';

      let cleanOpts: string[] = [];
      let resolvedTargetRole = '';
      let resolvedTargetCommissionId = '';
      let resolvedCandidates: VoteCandidate[] = [];
      let resolvedAllowSelfVote = true;

      if (resolvedKind === 'eleccion_cargo') {
        if (!isElectiveRole(targetRole) || targetRole === 'Consejero') {
          res.status(400).json({
            error:
              'Selecciona un cargo electivo válido (Presidente, Vicepresidente, Secretario, Consejero Departamental o Coordinador de Comisión).',
          });
          return;
        }
        resolvedTargetRole = targetRole;

        if (requiresCommissionForRole(targetRole)) {
          const cleanTargetComm = typeof targetCommissionId === 'string' ? targetCommissionId.trim() : '';
          const [commRow] = cleanTargetComm
            ? await db
                .select({ id: commissions.id })
                .from(commissions)
                .where(eq(commissions.id, cleanTargetComm))
                .limit(1)
            : [];
          if (!commRow) {
            res.status(400).json({
              error: 'Para elegir Coordinador de Comisión debes seleccionar una comisión válida.',
            });
            return;
          }
          resolvedTargetCommissionId = commRow.id;
        }

        if (!Array.isArray(candidateUids) || candidateUids.length < 1) {
          res.status(400).json({
            error: 'Selecciona al menos un candidato activo para la elección del cargo.',
          });
          return;
        }

        resolvedCandidates = await resolveActiveCandidates(candidateUids);
        if (resolvedCandidates.length < 1) {
          res.status(400).json({
            error: 'Los candidatos seleccionados deben ser consejeros activos del CMJ.',
          });
          return;
        }

        cleanOpts = [...resolvedCandidates.map((c) => c.fullName), BLANK_VOTE_OPTION];
        resolvedAllowSelfVote = allowSelfVote === true;
      } else {
        cleanOpts = Array.isArray(options)
          ? options.map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
          : [];
        if (cleanOpts.length < 2) {
          res.status(400).json({ error: 'Agrega título y al menos 2 opciones de votación.' });
          return;
        }
      }

      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'Ingresa un título para la votación.' });
        return;
      }

      const tallies: Record<string, number> = {};
      for (const opt of cleanOpts) tallies[opt] = 0;

      const id = newId('vote');
      await db.insert(votes).values({
        id,
        title: String(title).trim().slice(0, 180),
        description: String(
          description ||
            (resolvedKind === 'eleccion_cargo'
              ? `Elección democrática interna para el cargo de ${resolvedTargetRole}`
              : 'Votación plenaria CMJ')
        )
          .trim()
          .slice(0, 1000),
        kind: resolvedKind,
        targetRole: resolvedTargetRole,
        targetCommissionId: resolvedTargetCommissionId,
        candidates: resolvedCandidates,
        allowSelfVote: resolvedAllowSelfVote,
        winnerUid: '',
        winnerName: '',
        tiedCandidateUids: [],
        parentVoteId: '',
        commissionId:
          resolvedTargetCommissionId ||
          (typeof commissionId === 'string' ? commissionId.trim().slice(0, 64) : ''),
        sessionId: typeof sessionId === 'string' ? sessionId.trim().slice(0, 64) : '',
        voteMode: resolvedMode,
        majorityType: resolvedMajority,
        options: cleanOpts,
        tallies,
        nominalBallots: {},
        voterUids: [],
        quorumRequired: Math.max(1, Number(quorumRequired || 1)),
        opensAt: typeof opensAt === 'string' ? opensAt.slice(0, 40) : '',
        closesAt: typeof closesAt === 'string' ? closesAt.slice(0, 40) : '',
        status: 'abierta',
        resultSummary: '',
        deadline: String(deadline || closesAt || '').slice(0, 40),
        createdByUid: req.authUser!.uid,
      });

      await logServerAudit(
        req.authUser!,
        resolvedKind === 'eleccion_cargo'
          ? `Abrió elección de cargo (${resolvedTargetRole})`
          : `Abrió votación (${resolvedMode})`,
        'Votaciones',
        String(title).trim().slice(0, 180)
      );

      res.json({ id, ok: true });
    } catch (error) {
      console.error('Vote create failed:', error);
      res.status(500).json({ error: 'No fue posible abrir la votación.' });
    }
  });

  app.post('/api/votes/:id/cast', requireAuth, requirePermission('votaciones.votar'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const option = String(req.body?.option || '');
      const me = req.authUser!;

      await closeExpiredVotes();

      const txOutcome = await db.transaction(async (tx) => {
        const locked = await tx.execute<{ id: string }>(
          sql`SELECT id FROM votes WHERE id = ${id} FOR UPDATE`
        );
        if (!locked.rows[0]) {
          return { status: 404, error: 'Votación no encontrada.' } as const;
        }

        const [vote] = await tx.select().from(votes).where(eq(votes.id, id)).limit(1);
        if (!vote || vote.status !== 'abierta') {
          return { status: 400, error: 'La votación no está abierta.' } as const;
        }
        if (vote.opensAt) {
          const openTs = Date.parse(vote.opensAt);
          if (!Number.isNaN(openTs) && Date.now() < openTs) {
            return {
              status: 400,
              error: 'Esta votación aún no inicia según su horario programado.',
            } as const;
          }
        }
        if (vote.closesAt) {
          const closeTs = Date.parse(vote.closesAt);
          if (!Number.isNaN(closeTs) && Date.now() > closeTs) {
            return {
              status: 400,
              error: 'El tiempo programado para esta votación ya cerró.',
            } as const;
          }
        }
        if (!vote.options.includes(option)) {
          return { status: 400, error: 'Opción no válida.' } as const;
        }
        if (vote.voterUids.includes(me.uid)) {
          return { status: 400, error: 'Ya emitiste tu voto en esta moción.' } as const;
        }

        // Restricción de autovoto en elecciones de cargo cuando allowSelfVote === false
        if (vote.kind === 'eleccion_cargo' && !vote.allowSelfVote) {
          const candidates = Array.isArray(vote.candidates)
            ? (vote.candidates as VoteCandidate[])
            : [];
          const selfCandidate = candidates.find((c) => c.uid === me.uid);
          if (selfCandidate && option === selfCandidate.fullName) {
            return {
              status: 403,
              error: 'No está permitido votar por ti mismo(a) en esta elección de cargo.',
            } as const;
          }
        }

        const nextVoterUids = [...vote.voterUids, me.uid];
        const nextTallies = { ...(vote.tallies || {}) };
        nextTallies[option] = (nextTallies[option] || 0) + 1;
        const nextNominal =
          vote.voteMode === 'secreto'
            ? {}
            : { ...(vote.nominalBallots || {}), [me.uid]: option };

        const summary =
          vote.kind === 'eleccion_cargo'
            ? `${nextVoterUids.length}/${vote.quorumRequired || 1} votos registrados (escrutinio en curso)`
            : computeVoteResultSummary({
                options: vote.options,
                tallies: nextTallies,
                voterUids: nextVoterUids,
                quorumRequired: vote.quorumRequired,
                majorityType: vote.majorityType,
              });

        await tx
          .update(votes)
          .set({
            voterUids: nextVoterUids,
            tallies: nextTallies,
            nominalBallots: nextNominal,
            resultSummary: summary,
            updatedAt: new Date(),
          })
          .where(eq(votes.id, id));

        return { status: 200, ok: true, resultSummary: summary } as const;
      });

      if (txOutcome.status !== 200) {
        res.status(txOutcome.status).json({ error: txOutcome.error });
        return;
      }

      res.json({ ok: true, resultSummary: txOutcome.resultSummary });
    } catch (error) {
      console.error('Cast vote failed:', error);
      res.status(500).json({ error: 'No fue posible registrar tu voto.' });
    }
  });

  app.post('/api/votes/:id/runoff', requireAuth, requirePermission('votaciones.crear'), async (req: AuthedRequest, res) => {
    try {
      const parentId = String(req.params.id);
      const [parent] = await db.select().from(votes).where(eq(votes.id, parentId)).limit(1);

      if (!parent) {
        res.status(404).json({ error: 'Votación original no encontrada.' });
        return;
      }
      if (parent.kind !== 'eleccion_cargo' || parent.status !== 'empate') {
        res.status(400).json({
          error: 'Solo se puede abrir desempate sobre una elección de cargo cerrada en empate.',
        });
        return;
      }

      const tiedUids = Array.isArray(parent.tiedCandidateUids) ? parent.tiedCandidateUids : [];
      if (tiedUids.length < 2) {
        res.status(400).json({ error: 'No hay suficientes candidatos empatados para segunda vuelta.' });
        return;
      }

      const existingRunoffs = await db
        .select({ id: votes.id, status: votes.status })
        .from(votes)
        .where(eq(votes.parentVoteId, parent.id));

      if (existingRunoffs.some((r) => r.status === 'abierta')) {
        res.status(409).json({
          error: 'Ya existe una votación de desempate abierta para esta elección.',
        });
        return;
      }

      const tiedCandidates = await resolveActiveCandidates(tiedUids);
      if (tiedCandidates.length < 2) {
        res.status(400).json({
          error: 'Al menos dos candidatos empatados deben permanecer activos para abrir el desempate.',
        });
        return;
      }

      const cleanOpts = [...tiedCandidates.map((c) => c.fullName), BLANK_VOTE_OPTION];
      const tallies: Record<string, number> = {};
      for (const opt of cleanOpts) tallies[opt] = 0;

      const runoffId = newId('vote');
      const customTitle =
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim().slice(0, 180)
          : `Desempate: ${parent.title}`.slice(0, 180);

      const closesAt =
        typeof req.body?.closesAt === 'string' ? req.body.closesAt.slice(0, 40) : '';

      await db.insert(votes).values({
        id: runoffId,
        title: customTitle,
        description: `Segunda vuelta de desempate para ${parent.targetRole}. Participan únicamente las candidaturas empatadas.`,
        kind: 'eleccion_cargo',
        targetRole: parent.targetRole,
        targetCommissionId: parent.targetCommissionId,
        candidates: tiedCandidates,
        allowSelfVote: parent.allowSelfVote,
        winnerUid: '',
        winnerName: '',
        tiedCandidateUids: [],
        parentVoteId: parent.id,
        commissionId: parent.commissionId,
        sessionId: parent.sessionId,
        voteMode: parent.voteMode,
        majorityType: parent.majorityType,
        options: cleanOpts,
        tallies,
        nominalBallots: {},
        voterUids: [],
        quorumRequired: parent.quorumRequired,
        opensAt: '',
        closesAt,
        status: 'abierta',
        resultSummary: '',
        deadline: closesAt,
        createdByUid: req.authUser!.uid,
      });

      await logServerAudit(
        req.authUser!,
        `Convocó desempate de elección (${parent.targetRole})`,
        'Votaciones',
        customTitle
      );

      res.json({ id: runoffId, ok: true });
    } catch (error) {
      console.error('Create runoff vote failed:', error);
      res.status(500).json({ error: 'No fue posible abrir la votación de desempate.' });
    }
  });

  app.patch('/api/votes/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const body = req.body || {};
      if (body.status === 'cerrada') {
        if (!userHasPermission(me, 'votaciones.cerrar')) {
          sendPermissionDenied(res, 'votaciones.cerrar');
          return;
        }
      } else if (!userHasPermission(me, 'votaciones.editar')) {
        sendPermissionDenied(res, 'votaciones.editar');
        return;
      }

      const id = String(req.params.id);
      const [existing] = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Votación no encontrada.' });
        return;
      }

      if (existing.kind === 'eleccion_cargo' && body.status === 'abierta' && existing.status !== 'abierta') {
        const [linkedTerm] = await db
          .select({ id: roleTerms.id })
          .from(roleTerms)
          .where(eq(roleTerms.electedByVoteId, existing.id))
          .limit(1);
        if (linkedTerm || existing.status === 'empate' || existing.status === 'sin_resultado') {
          res.status(400).json({
            error:
              'Una elección de cargo concluida no puede reabrirse; si hubo empate o quedó sin resultado, abre una nueva vuelta.',
          });
          return;
        }
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 180);
      }
      if (typeof body.description === 'string') {
        patch.description = body.description.trim().slice(0, 1000);
      }
      if (typeof body.sessionId === 'string') patch.sessionId = body.sessionId.trim().slice(0, 64);
      if (typeof body.commissionId === 'string') patch.commissionId = body.commissionId.trim().slice(0, 64);
      if (typeof body.opensAt === 'string') patch.opensAt = body.opensAt.slice(0, 40);
      if (typeof body.closesAt === 'string') patch.closesAt = body.closesAt.slice(0, 40);
      if (['simple', 'absoluta', 'dos_tercios', 'unanimidad'].includes(body.majorityType)) {
        patch.majorityType = body.majorityType;
      }
      if (['nominal', 'secreto', 'mano_alzada'].includes(body.voteMode)) {
        if (existing.voterUids.length === 0) {
          patch.voteMode = body.voteMode;
          if (body.voteMode === 'secreto') patch.nominalBallots = {};
        }
      }
      if (typeof body.quorumRequired === 'number' || typeof body.quorumRequired === 'string') {
        const q = Number(body.quorumRequired);
        if (!Number.isNaN(q) && q >= 1) patch.quorumRequired = Math.round(q);
      }
      if (typeof body.deadline === 'string') patch.deadline = body.deadline.slice(0, 40);

      // En elecciones de cargo no se sobrescriben opciones arbitrariamente después de creada
      if (existing.kind !== 'eleccion_cargo' && Array.isArray(body.options) && existing.voterUids.length === 0) {
        const cleanOpts = body.options
          .map((o: unknown) => String(o).trim())
          .filter(Boolean)
          .slice(0, 8);
        if (cleanOpts.length >= 2) {
          const tallies: Record<string, number> = {};
          for (const opt of cleanOpts) tallies[opt] = 0;
          patch.options = cleanOpts;
          patch.tallies = tallies;
        }
      }

      if (body.status === 'cerrada') {
        const candidateSnapshot: typeof votes.$inferSelect = {
          ...existing,
          majorityType: (patch.majorityType as string) || existing.majorityType,
          quorumRequired: (patch.quorumRequired as number) ?? existing.quorumRequired,
          options: (patch.options as string[]) || existing.options,
          tallies: (patch.tallies as Record<string, number>) || existing.tallies,
        };
        const outcome = computeVoteOutcomeServer(candidateSnapshot);
        patch.status = outcome.status;
        patch.winnerUid = outcome.winnerUid;
        patch.winnerName = outcome.winnerName;
        patch.tiedCandidateUids = outcome.tiedCandidateUids;
        patch.resultSummary = outcome.resultSummary;

        await db.update(votes).set(patch).where(eq(votes.id, id));

        let createdTermId: string | null = null;
        if (existing.kind === 'eleccion_cargo') {
          if (outcome.status === 'cerrada') {
            const closureRes = await handleElectionClosure(id, outcome, me.uid);
            createdTermId = closureRes.createdTermId;
          } else {
            const leaders = await db
              .select({ uid: users.uid })
              .from(users)
              .where(
                and(
                  eq(users.active, true),
                  inArray(users.roleLabel, ['Presidente', 'Vicepresidente', 'Secretario'])
                )
              );
            for (const l of leaders) {
              await createPortalNotification({
                userUid: l.uid,
                type: 'eleccion_resultado',
                title:
                  outcome.status === 'empate'
                    ? `Empate en elección: ${candidateSnapshot.title}`
                    : `Elección sin resultado: ${candidateSnapshot.title}`,
                message: outcome.resultSummary,
                linkModule: 'votaciones',
                relatedId: id,
              });
            }
          }
        }

        await logServerAudit(
          me,
          existing.kind === 'eleccion_cargo'
            ? `Cerró elección de cargo (${outcome.status})`
            : 'Cerró votación plenaria',
          'Votaciones',
          `${candidateSnapshot.title} · ${outcome.resultSummary}`.slice(0, 180)
        );

        res.json({
          ok: true,
          status: outcome.status,
          winnerUid: outcome.winnerUid,
          winnerName: outcome.winnerName,
          tiedCandidateUids: outcome.tiedCandidateUids,
          resultSummary: outcome.resultSummary,
          createdTermId,
        });
        return;
      }

      if (body.status === 'abierta') {
        patch.status = 'abierta';
      }

      if (existing.kind !== 'eleccion_cargo') {
        patch.resultSummary = computeVoteResultSummary({
          options: (patch.options as string[]) || existing.options,
          tallies: (patch.tallies as Record<string, number>) || existing.tallies,
          voterUids: existing.voterUids,
          quorumRequired: (patch.quorumRequired as number) ?? existing.quorumRequired,
          majorityType: (patch.majorityType as string) || existing.majorityType,
        });
      }

      await db.update(votes).set(patch).where(eq(votes.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Vote status update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la votación.' });
    }
  });

  app.delete('/api/votes/:id', requireAuth, requirePermission('votaciones.eliminar'), async (req, res) => {
    try {
      await db.delete(votes).where(eq(votes.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Vote delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la votación.' });
    }
  });

  app.post('/api/commitments', requireAuth, requirePermission('compromisos.crear'), async (req: AuthedRequest, res) => {
    try {
      const { title, description, responsibleUid, responsibleName, commissionId, dueDate } =
        req.body || {};
      if (!title || !responsibleUid || !responsibleName) {
        res.status(400).json({ error: 'Completa título y responsable.' });
        return;
      }
      const id = newId('commt');
      await db.insert(commitments).values({
        id,
        title: String(title).trim().slice(0, 180),
        description: String(description || '').slice(0, 800),
        responsibleUid: String(responsibleUid),
        responsibleName: String(responsibleName).slice(0, 120),
        commissionId: typeof commissionId === 'string' ? commissionId.trim() : '',
        dueDate: String(dueDate || '').slice(0, 40),
        status: 'pendiente',
        progress: 0,
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Commitment create failed:', error);
      res.status(500).json({ error: 'No fue posible crear el compromiso.' });
    }
  });

  app.patch('/api/commitments/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [item] = await db.select().from(commitments).where(eq(commitments.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Compromiso no encontrado.' });
        return;
      }
      const me = req.authUser!;
      const canEditAll = userHasPermission(me, 'compromisos.editar_todos');
      const canUpdateOwn =
        item.responsibleUid === me.uid && userHasPermission(me, 'compromisos.actualizar_propio');
      if (!canEditAll && !canUpdateOwn) {
        sendPermissionDenied(res, 'compromisos.editar_todos');
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['pendiente', 'en_progreso', 'cumplido'].includes(body.status)) patch.status = body.status;
      if (typeof body.progress === 'number') {
        patch.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
      }
      if (canEditAll) {
        if (typeof body.title === 'string' && body.title.trim()) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (typeof body.description === 'string') {
          patch.description = body.description.trim().slice(0, 800);
        }
        if (typeof body.responsibleUid === 'string' && body.responsibleUid.trim()) {
          patch.responsibleUid = body.responsibleUid.trim();
        }
        if (typeof body.responsibleName === 'string' && body.responsibleName.trim()) {
          patch.responsibleName = body.responsibleName.trim().slice(0, 120);
        }
        if (typeof body.commissionId === 'string') {
          patch.commissionId = body.commissionId.trim();
        }
        if (typeof body.dueDate === 'string') {
          patch.dueDate = body.dueDate.trim().slice(0, 40);
        }
      }
      await db.update(commitments).set(patch).where(eq(commitments.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commitment update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el compromiso.' });
    }
  });

  app.delete('/api/commitments/:id', requireAuth, requirePermission('compromisos.eliminar'), async (req, res) => {
    try {
      await db.delete(commitments).where(eq(commitments.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commitment delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/ideas', requireAuth, requirePermission('ideas.crear'), async (req: AuthedRequest, res) => {
    try {
      const { title, description, category, commissionId } = req.body || {};
      if (!title || !description) {
        res.status(400).json({ error: 'Título y descripción obligatorios.' });
        return;
      }
      const id = newId('idea');
      await db.insert(ideasInbox).values({
        id,
        title: String(title).trim().slice(0, 160),
        description: String(description).trim().slice(0, 1500),
        category: String(category || 'Iniciativa').slice(0, 64),
        commissionId:
          typeof commissionId === 'string' ? commissionId.trim() : (req.authUser!.commissionId ?? ''),
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.fullName,
        status: 'nueva',
        upvoterUids: [req.authUser!.uid],
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Idea create failed:', error);
      res.status(500).json({ error: 'No fue posible enviar la idea.' });
    }
  });

  app.post('/api/ideas/:id/upvote', requireAuth, requirePermission('ideas.votar'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [idea] = await db.select().from(ideasInbox).where(eq(ideasInbox.id, id)).limit(1);
      if (!idea) {
        res.status(404).json({ error: 'Idea no encontrada.' });
        return;
      }
      const exists = idea.upvoterUids.includes(req.authUser!.uid);
      const next = exists
        ? idea.upvoterUids.filter((u) => u !== req.authUser!.uid)
        : [...idea.upvoterUids, req.authUser!.uid];
      await db
        .update(ideasInbox)
        .set({ upvoterUids: next, updatedAt: new Date() })
        .where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea upvote failed:', error);
      res.status(500).json({ error: 'No fue posible votar la idea.' });
    }
  });

  app.patch('/api/ideas/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [idea] = await db.select().from(ideasInbox).where(eq(ideasInbox.id, id)).limit(1);
      if (!idea) {
        res.status(404).json({ error: 'Propuesta no encontrada.' });
        return;
      }
      const canModerate = userHasPermission(me, 'ideas.moderar');
      if (!canModerate && idea.authorUid !== me.uid) {
        sendPermissionDenied(res, 'ideas.moderar');
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 160);
      }
      if (typeof body.description === 'string' && body.description.trim()) {
        patch.description = body.description.trim().slice(0, 1500);
      }
      if (typeof body.category === 'string' && body.category.trim()) {
        patch.category = body.category.trim().slice(0, 64);
      }
      if (typeof body.commissionId === 'string') {
        patch.commissionId = body.commissionId.trim();
      }
      if (canModerate && ['nueva', 'en_revision', 'aprobada'].includes(body.status)) {
        patch.status = body.status;
      }
      await db.update(ideasInbox).set(patch).where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar.' });
    }
  });

  app.delete('/api/ideas/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [idea] = await db.select().from(ideasInbox).where(eq(ideasInbox.id, id)).limit(1);
      if (!idea) {
        res.json({ ok: true });
        return;
      }
      if (!userHasPermission(req.authUser!, 'ideas.moderar') && idea.authorUid !== req.authUser!.uid) {
        sendPermissionDenied(res, 'ideas.moderar');
        return;
      }
      await db.delete(ideasInbox).where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/templates', requireAuth, requirePermission('plantillas.gestionar'), async (req: AuthedRequest, res) => {
    try {
      const { title, category, headerText, bodyTemplate, signatoryRole } = req.body || {};
      if (!title || !bodyTemplate) {
        res.status(400).json({ error: 'Completa título y cuerpo de la plantilla.' });
        return;
      }
      const id = newId('tpl');
      await db.insert(letterTemplates).values({
        id,
        title: String(title).trim().slice(0, 160),
        category: String(category || 'Oficio').slice(0, 64),
        headerText: String(headerText || '').slice(0, 500),
        bodyTemplate: String(bodyTemplate).slice(0, 5000),
        signatoryRole: String(signatoryRole || 'Secretario').slice(0, 64),
        updatedByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Template create failed:', error);
      res.status(500).json({ error: 'No fue posible guardar la plantilla.' });
    }
  });

  app.patch('/api/templates/:id', requireAuth, requirePermission('plantillas.gestionar'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = {
        updatedByUid: req.authUser!.uid,
        updatedAt: new Date(),
      };
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 160);
      }
      if (typeof body.category === 'string' && body.category.trim()) {
        patch.category = body.category.trim().slice(0, 64);
      }
      if (typeof body.headerText === 'string') {
        patch.headerText = body.headerText.slice(0, 500);
      }
      if (typeof body.bodyTemplate === 'string' && body.bodyTemplate.trim()) {
        patch.bodyTemplate = body.bodyTemplate.slice(0, 5000);
      }
      if (typeof body.signatoryRole === 'string' && body.signatoryRole.trim()) {
        patch.signatoryRole = body.signatoryRole.trim().slice(0, 64);
      }
      await db.update(letterTemplates).set(patch).where(eq(letterTemplates.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Template update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la plantilla.' });
    }
  });

  app.delete('/api/templates/:id', requireAuth, requirePermission('plantillas.gestionar'), async (req, res) => {
    try {
      await db.delete(letterTemplates).where(eq(letterTemplates.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Template delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/work-plans', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const { title, axis, commissionId, quarter, status, progress, evidenceCount } = req.body || {};
      const cleanCommId = typeof commissionId === 'string' ? commissionId.trim() : '';
      const canCreate =
        userHasPermission(me, 'plan_trabajo.crear') ||
        (cleanCommId && me.coordinatorCommissionIds.includes(cleanCommId));
      if (!canCreate) {
        sendPermissionDenied(res, 'plan_trabajo.crear', cleanCommId);
        return;
      }
      if (!title || !axis) {
        res.status(400).json({ error: 'Completa título y eje.' });
        return;
      }
      const id = newId('plan');
      await db.insert(workPlans).values({
        id,
        title: String(title).trim().slice(0, 180),
        axis: String(axis).trim().slice(0, 100),
        commissionId: cleanCommId,
        quarter: String(quarter || 'Q1-2026').slice(0, 24),
        status: ['planeado', 'ejecucion', 'completado'].includes(status) ? status : 'planeado',
        progress: Math.max(0, Math.min(100, Number(progress || 0))),
        evidenceCount: Math.max(0, Number(evidenceCount || 0)),
        updatedByUid: me.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('WorkPlan create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la meta.' });
    }
  });

  app.patch('/api/work-plans/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [existing] = await db.select().from(workPlans).where(eq(workPlans.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Meta no encontrada.' });
        return;
      }
      const canEditPlan = userHasPermission(me, 'plan_trabajo.editar', existing.commissionId || undefined);
      if (!canEditPlan) {
        sendPermissionDenied(res, 'plan_trabajo.editar', existing.commissionId || undefined);
        return;
      }

      const body = req.body || {};
      const patch: Record<string, unknown> = {
        updatedByUid: me.uid,
        updatedAt: new Date(),
      };
      if (typeof body.progress === 'number') {
        patch.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
      }
      if (typeof body.evidenceCount === 'number') {
        patch.evidenceCount = Math.max(0, Math.round(body.evidenceCount));
      }
      if (['planeado', 'ejecucion', 'completado'].includes(body.status)) {
        patch.status = body.status;
      }
      if (userHasPermission(me, 'plan_trabajo.crear')) {
        if (typeof body.title === 'string' && body.title.trim()) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (typeof body.axis === 'string' && body.axis.trim()) {
          patch.axis = body.axis.trim().slice(0, 100);
        }
        if (typeof body.commissionId === 'string') {
          patch.commissionId = body.commissionId.trim();
        }
        if (typeof body.quarter === 'string' && body.quarter.trim()) {
          patch.quarter = body.quarter.trim().slice(0, 24);
        }
      }
      await db.update(workPlans).set(patch).where(eq(workPlans.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('WorkPlan update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la meta.' });
    }
  });

  app.delete('/api/work-plans/:id', requireAuth, requirePermission('plan_trabajo.eliminar'), async (req, res) => {
    try {
      await db.delete(workPlans).where(eq(workPlans.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('WorkPlan delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });
}
