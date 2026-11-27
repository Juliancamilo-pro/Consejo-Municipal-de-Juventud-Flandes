import type express from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { publicCouncilors, roleTerms, users, votes } from '../../db/schema.ts';
import {
  formatBogotaDateTime,
  isUniqueRole,
  requiresCommissionForRole,
} from '../../lib/roleTerms.ts';
import {
  type AuthedRequest,
  createPortalNotification,
  logServerAudit,
  requireAuth,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';
import {
  bootstrapInitialRoleTermsIfEmpty,
  processDueRoleTransitions,
  syncElectionsAndTransitionsIfNeeded,
  validateHandoverExitDate,
} from '../services/roleTransitions.ts';

function sanitizeText(input: unknown, maxLen: number): string {
  return String(input || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

async function findOutgoingTermForIncoming(incoming: typeof roleTerms.$inferSelect) {
  if (incoming.previousTermId) {
    const [prev] = await db
      .select()
      .from(roleTerms)
      .where(eq(roleTerms.id, incoming.previousTermId))
      .limit(1);
    if (prev && prev.status === 'vigente') return prev;
  }
  const targetComm = requiresCommissionForRole(incoming.roleLabel)
    ? incoming.commissionId || ''
    : '';
  const [active] = await db
    .select()
    .from(roleTerms)
    .where(
      and(
        eq(roleTerms.roleLabel, incoming.roleLabel),
        eq(roleTerms.commissionId, targetComm),
        eq(roleTerms.status, 'vigente')
      )
    )
    .orderBy(desc(roleTerms.createdAt))
    .limit(1);
  return active || null;
}

function canOverrideRoleHandover(me: NonNullable<AuthedRequest['authUser']>, roleLabel: string): boolean {
  if (userHasPermission(me, 'usuarios.asignar_presidencia')) return true;
  if (roleLabel === 'Coordinador de Comisión' && userHasPermission(me, 'comision.coordinador_asignar')) {
    return true;
  }
  return false;
}

export function registerRoleTermRoutes(app: express.Express) {
  app.get('/api/role-terms', requireAuth, async (_req: AuthedRequest, res) => {
    try {
      await bootstrapInitialRoleTermsIfEmpty();
      await syncElectionsAndTransitionsIfNeeded();
      const terms = await db
        .select()
        .from(roleTerms)
        .orderBy(desc(roleTerms.createdAt));
      res.json({ terms });
    } catch (error) {
      console.error('Fetch role terms failed:', error);
      res.status(500).json({ error: 'No fue posible consultar los periodos de cargo.' });
    }
  });

  app.post('/api/role-terms/:id/schedule-handover', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const termId = String(req.params.id);
      await bootstrapInitialRoleTermsIfEmpty();

      const [incoming] = await db
        .select()
        .from(roleTerms)
        .where(eq(roleTerms.id, termId))
        .limit(1);

      if (!incoming) {
        res.status(404).json({ error: 'Periodo programado no encontrado.' });
        return;
      }
      if (incoming.status !== 'programado') {
        res.status(400).json({ error: 'Solo se puede programar la entrega de un periodo en estado programado.' });
        return;
      }

      const outgoing = await findOutgoingTermForIncoming(incoming);
      const isOutgoingHolder = Boolean(outgoing && outgoing.councilorUid === me.uid);
      const hasOverridePerm = canOverrideRoleHandover(me, incoming.roleLabel);
      const isVacantCargo = !outgoing;

      if (!isOutgoingHolder && !hasOverridePerm) {
        if (!isVacantCargo || !userHasPermission(me, 'usuarios.editar')) {
          sendPermissionDenied(
            res,
            'usuarios.asignar_presidencia',
            incoming.commissionId || undefined,
            'Solo el titular saliente o Presidencia pueden registrar la fecha de entrega del cargo.'
          );
          return;
        }
      }

      const handoverNotes = sanitizeText(req.body?.handoverNotes, 600);
      const justification = sanitizeText(req.body?.justification, 500);
      const immediate = Boolean(req.body?.immediate);
      const rawExitDate = String(req.body?.exitDate || '').trim();

      if (!isOutgoingHolder && !isVacantCargo && justification.length < 10) {
        res.status(400).json({
          error:
            'Debes ingresar una justificación (mínimo 10 caracteres) cuando registras la fecha de salida en reemplazo del titular saliente.',
        });
        return;
      }

      let voteDateIso: string | undefined;
      if (incoming.electedByVoteId) {
        const [voteRow] = await db
          .select()
          .from(votes)
          .where(eq(votes.id, incoming.electedByVoteId))
          .limit(1);
        if (voteRow) {
          voteDateIso = (voteRow.updatedAt || voteRow.createdAt)
            ? new Date(voteRow.updatedAt || voteRow.createdAt).toISOString()
            : undefined;
        }
      }

      let finalExitIso = '';
      if (isVacantCargo && !rawExitDate) {
        finalExitIso = new Date().toISOString();
      } else if (immediate) {
        finalExitIso = new Date().toISOString();
      } else {
        const check = validateHandoverExitDate(rawExitDate, voteDateIso);
        if (!check.ok) {
          res.status(400).json({ error: check.error });
          return;
        }
        finalExitIso = check.exitDateIso;
      }

      // Si el cargo está vacante, aplicar inmediatamente salvo que ya sea <= now
      if (isVacantCargo && Date.parse(finalExitIso) > Date.now()) {
        finalExitIso = new Date().toISOString();
      }

      const targetComm = requiresCommissionForRole(incoming.roleLabel)
        ? incoming.commissionId || ''
        : '';

      const txResult = await db.transaction(async (tx) => {
        const lockedIncoming = await tx.execute<{ id: string; status: string }>(
          sql`SELECT id, status FROM role_terms WHERE id = ${incoming.id} FOR UPDATE`
        );
        if (!lockedIncoming.rows[0] || lockedIncoming.rows[0].status !== 'programado') {
          return { conflict: 'El periodo ya fue procesado o cancelado.' };
        }

        if (isUniqueRole(incoming.roleLabel)) {
          const conflictingScheduled = await tx
            .select({ id: roleTerms.id, startDate: roleTerms.startDate })
            .from(roleTerms)
            .where(
              and(
                eq(roleTerms.roleLabel, incoming.roleLabel),
                eq(roleTerms.commissionId, targetComm),
                eq(roleTerms.status, 'programado')
              )
            );
          const otherWithDate = conflictingScheduled.find(
            (row) => row.id !== incoming.id && Boolean(row.startDate)
          );
          if (otherWithDate) {
            return {
              conflict: `Ya existe otro relevo con fecha programada para ${incoming.roleLabel}.`,
            };
          }
        }

        await tx
          .update(roleTerms)
          .set({
            startDate: finalExitIso,
            handoverNotes,
            updatedAt: new Date(),
          })
          .where(eq(roleTerms.id, incoming.id));

        if (outgoing) {
          await tx
            .update(roleTerms)
            .set({
              endDate: finalExitIso,
              handoverNotes: handoverNotes || outgoing.handoverNotes,
              updatedAt: new Date(),
            })
            .where(eq(roleTerms.id, outgoing.id));
        }

        return { ok: true };
      });

      if ('conflict' in txResult) {
        res.status(409).json({ error: txResult.conflict });
        return;
      }

      const auditDetail = justification
        ? `${incoming.roleLabel} → ${incoming.councilorName} (${formatBogotaDateTime(finalExitIso)}) · Justificación: ${justification}`
        : `${incoming.roleLabel} → ${incoming.councilorName} (${formatBogotaDateTime(finalExitIso)})`;

      await logServerAudit(me, 'Programó fecha de relevo de cargo', 'Usuarios y Mesa', auditDetail);

      const leaders = await db
        .select({ uid: users.uid })
        .from(users)
        .where(
          and(
            eq(users.active, true),
            inArray(users.roleLabel, ['Presidente', 'Vicepresidente', 'Secretario'])
          )
        );
      const notifySet = new Set<string>([
        incoming.councilorUid,
        ...(outgoing ? [outgoing.councilorUid] : []),
        ...leaders.map((l) => l.uid),
      ]);

      for (const targetUid of notifySet) {
        await createPortalNotification({
          userUid: targetUid,
          type: 'relevo_programado',
          title: `Fecha de relevo programada: ${incoming.roleLabel}`,
          message: `El relevo hacia ${incoming.councilorName} quedó fijado para el ${formatBogotaDateTime(finalExitIso)}.`,
          linkModule: 'usuarios',
          relatedId: incoming.id,
        });
      }

      let activatedNow = 0;
      if (Date.parse(finalExitIso) <= Date.now() || isVacantCargo) {
        activatedNow = await processDueRoleTransitions();
      }

      res.json({
        ok: true,
        startDate: finalExitIso,
        activatedImmediately: activatedNow > 0,
      });
    } catch (error) {
      console.error('Schedule handover failed:', error);
      res.status(500).json({ error: 'No fue posible registrar la fecha de entrega del cargo.' });
    }
  });

  app.post('/api/role-terms/:id/reprogram', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const termId = String(req.params.id);
      const [incoming] = await db
        .select()
        .from(roleTerms)
        .where(eq(roleTerms.id, termId))
        .limit(1);

      if (!incoming || incoming.status !== 'programado') {
        res.status(404).json({ error: 'Periodo programado no encontrado o ya ejecutado.' });
        return;
      }

      const outgoing = await findOutgoingTermForIncoming(incoming);
      const isOutgoingHolder = Boolean(outgoing && outgoing.councilorUid === me.uid);
      const hasOverridePerm = canOverrideRoleHandover(me, incoming.roleLabel);

      if (!isOutgoingHolder && !hasOverridePerm) {
        sendPermissionDenied(
          res,
          'usuarios.asignar_presidencia',
          incoming.commissionId || undefined,
          'No tienes permiso para reprogramar este relevo.'
        );
        return;
      }

      const reason = sanitizeText(req.body?.reason, 500);
      if (reason.length < 10) {
        res.status(400).json({
          error: 'Debes indicar una justificación de al menos 10 caracteres para reprogramar el relevo.',
        });
        return;
      }

      const immediate = Boolean(req.body?.immediate);
      const rawExitDate = String(req.body?.exitDate || '').trim();
      let voteDateIso: string | undefined;
      if (incoming.electedByVoteId) {
        const [voteRow] = await db
          .select()
          .from(votes)
          .where(eq(votes.id, incoming.electedByVoteId))
          .limit(1);
        if (voteRow) {
          voteDateIso = new Date(voteRow.updatedAt || voteRow.createdAt).toISOString();
        }
      }

      let nextIso = '';
      if (immediate) {
        nextIso = new Date().toISOString();
      } else {
        const check = validateHandoverExitDate(rawExitDate, voteDateIso);
        if (!check.ok) {
          res.status(400).json({ error: check.error });
          return;
        }
        nextIso = check.exitDateIso;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(roleTerms)
          .set({
            startDate: nextIso,
            reprogramReason: reason,
            updatedAt: new Date(),
          })
          .where(and(eq(roleTerms.id, incoming.id), eq(roleTerms.status, 'programado')));

        if (outgoing) {
          await tx
            .update(roleTerms)
            .set({
              endDate: nextIso,
              updatedAt: new Date(),
            })
            .where(and(eq(roleTerms.id, outgoing.id), eq(roleTerms.status, 'vigente')));
        }
      });

      await logServerAudit(
        me,
        'Reprogramó fecha de relevo',
        'Usuarios y Mesa',
        `${incoming.roleLabel} → ${incoming.councilorName} (${formatBogotaDateTime(nextIso)}) · ${reason}`
      );

      let activatedNow = 0;
      if (Date.parse(nextIso) <= Date.now()) {
        activatedNow = await processDueRoleTransitions();
      }

      res.json({ ok: true, startDate: nextIso, activatedImmediately: activatedNow > 0 });
    } catch (error) {
      console.error('Reprogram handover failed:', error);
      res.status(500).json({ error: 'No fue posible reprogramar el relevo.' });
    }
  });

  app.post('/api/role-terms/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const termId = String(req.params.id);
      const [incoming] = await db
        .select()
        .from(roleTerms)
        .where(eq(roleTerms.id, termId))
        .limit(1);

      if (!incoming || incoming.status !== 'programado') {
        res.status(404).json({ error: 'Solo se puede cancelar un relevo aún programado.' });
        return;
      }

      if (!canOverrideRoleHandover(me, incoming.roleLabel)) {
        sendPermissionDenied(
          res,
          'usuarios.asignar_presidencia',
          incoming.commissionId || undefined,
          'Solo Presidencia puede cancelar un relevo programado antes de su entrada en vigor.'
        );
        return;
      }

      const reason = sanitizeText(req.body?.reason, 500);
      if (reason.length < 10) {
        res.status(400).json({
          error: 'Debes indicar una justificación obligatoria (mínimo 10 caracteres) para cancelar el relevo.',
        });
        return;
      }

      const outgoing = await findOutgoingTermForIncoming(incoming);

      await db.transaction(async (tx) => {
        await tx
          .update(roleTerms)
          .set({
            status: 'cancelado',
            cancelReason: reason,
            updatedAt: new Date(),
          })
          .where(and(eq(roleTerms.id, incoming.id), eq(roleTerms.status, 'programado')));

        if (outgoing && outgoing.endDate === incoming.startDate) {
          await tx
            .update(roleTerms)
            .set({
              endDate: '',
              updatedAt: new Date(),
            })
            .where(and(eq(roleTerms.id, outgoing.id), eq(roleTerms.status, 'vigente')));
        }
      });

      const [pub] = await db
        .select({ fullName: publicCouncilors.fullName })
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, incoming.councilorUid))
        .limit(1);

      await logServerAudit(
        me,
        'Canceló relevo programado',
        'Usuarios y Mesa',
        `${incoming.roleLabel} (${pub?.fullName || incoming.councilorName}) · Motivo: ${reason}`
      );

      const notifyUids = new Set<string>([
        incoming.councilorUid,
        ...(outgoing ? [outgoing.councilorUid] : []),
      ]);
      for (const uid of notifyUids) {
        await createPortalNotification({
          userUid: uid,
          type: 'relevo_cancelado',
          title: `Relevo cancelado en ${incoming.roleLabel}`,
          message: `Presidencia canceló el relevo programado hacia ${incoming.councilorName}. Motivo: ${reason}`,
          linkModule: 'usuarios',
          relatedId: incoming.id,
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Cancel handover failed:', error);
      res.status(500).json({ error: 'No fue posible cancelar el relevo programado.' });
    }
  });
}
