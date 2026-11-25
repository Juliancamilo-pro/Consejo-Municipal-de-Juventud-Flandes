import type express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  commitments,
  ideasInbox,
  letterTemplates,
  votes,
  workPlans,
} from '../../db/schema.ts';
import {
  type AuthedRequest,
  newId,
  requireAuth,
  requirePermission,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';

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

export function registerVotesAndWorkRoutes(app: express.Express) {
  app.post('/api/votes', requireAuth, requirePermission('votaciones.crear'), async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        description,
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
      const cleanOpts = Array.isArray(options)
        ? options.map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
        : [];
      if (!title || cleanOpts.length < 2) {
        res.status(400).json({ error: 'Agrega título y al menos 2 opciones de votación.' });
        return;
      }
      const tallies: Record<string, number> = {};
      for (const opt of cleanOpts) tallies[opt] = 0;

      const resolvedMode =
        voteMode === 'secreto' || voteMode === 'mano_alzada' ? voteMode : 'nominal';
      const resolvedMajority = ['simple', 'absoluta', 'dos_tercios', 'unanimidad'].includes(
        majorityType
      )
        ? String(majorityType)
        : 'simple';

      const id = newId('vote');
      await db.insert(votes).values({
        id,
        title: String(title).trim().slice(0, 180),
        description: String(description || 'Votación plenaria CMJ').trim().slice(0, 1000),
        commissionId: typeof commissionId === 'string' ? commissionId.trim().slice(0, 64) : '',
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
      const [vote] = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
      if (!vote || vote.status !== 'abierta') {
        res.status(400).json({ error: 'La votación no está abierta.' });
        return;
      }
      if (vote.opensAt) {
        const openTs = Date.parse(vote.opensAt);
        if (!Number.isNaN(openTs) && Date.now() < openTs) {
          res.status(400).json({ error: 'Esta votación aún no inicia según su horario programado.' });
          return;
        }
      }
      if (vote.closesAt) {
        const closeTs = Date.parse(vote.closesAt);
        if (!Number.isNaN(closeTs) && Date.now() > closeTs) {
          res.status(400).json({ error: 'El tiempo programado para esta votación ya cerró.' });
          return;
        }
      }
      if (!vote.options.includes(option)) {
        res.status(400).json({ error: 'Opción no válida.' });
        return;
      }
      if (vote.voterUids.includes(req.authUser!.uid)) {
        res.status(400).json({ error: 'Ya emitiste tu voto en esta moción.' });
        return;
      }

      const nextVoterUids = [...vote.voterUids, req.authUser!.uid];
      const nextTallies = { ...(vote.tallies || {}) };
      nextTallies[option] = (nextTallies[option] || 0) + 1;
      const nextNominal =
        vote.voteMode === 'secreto'
          ? {}
          : { ...(vote.nominalBallots || {}), [req.authUser!.uid]: option };
      const summary = computeVoteResultSummary({
        options: vote.options,
        tallies: nextTallies,
        voterUids: nextVoterUids,
        quorumRequired: vote.quorumRequired,
        majorityType: vote.majorityType,
      });

      await db
        .update(votes)
        .set({
          voterUids: nextVoterUids,
          tallies: nextTallies,
          nominalBallots: nextNominal,
          resultSummary: summary,
          updatedAt: new Date(),
        })
        .where(eq(votes.id, id));
      res.json({ ok: true, resultSummary: summary });
    } catch (error) {
      console.error('Cast vote failed:', error);
      res.status(500).json({ error: 'No fue posible registrar tu voto.' });
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
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.status === 'cerrada' || body.status === 'abierta') patch.status = body.status;
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
      if (Array.isArray(body.options) && existing.voterUids.length === 0) {
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
      patch.resultSummary = computeVoteResultSummary({
        options: (patch.options as string[]) || existing.options,
        tallies: (patch.tallies as Record<string, number>) || existing.tallies,
        voterUids: existing.voterUids,
        quorumRequired: (patch.quorumRequired as number) ?? existing.quorumRequired,
        majorityType: (patch.majorityType as string) || existing.majorityType,
      });

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
