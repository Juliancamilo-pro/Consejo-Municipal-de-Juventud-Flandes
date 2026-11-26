import crypto from 'node:crypto';
import type express from 'express';
import { desc, eq, inArray } from 'drizzle-orm';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../../db/index.ts';
import {
  actas,
  commitments,
  publicCouncilors,
  sessionAgendaProposals,
  sessions,
  users,
  votes,
} from '../../db/schema.ts';
import { isLeadershipTier } from '../security.ts';
import {
  type AuthedRequest,
  createPortalNotification,
  isSafeUrl,
  logServerAudit,
  newId,
  requireAuth,
  requirePermission,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';

function computeActaVerificationHash(acta: {
  id: string;
  consecutive: string;
  title: string;
  meetingDate: string;
  agenda: string;
  development: string;
  propositions: string;
  commitmentsSummary: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      [
        acta.id,
        acta.consecutive,
        acta.title,
        acta.meetingDate,
        acta.agenda,
        acta.development,
        acta.propositions,
        acta.commitmentsSummary,
      ].join('|')
    )
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();
}

export function registerSessionsAndActasRoutes(app: express.Express) {
  app.post('/api/sessions', requireAuth, requirePermission('sesiones.crear'), async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        sessionType,
        dateIso,
        timeRange,
        location,
        agenda,
        checkInCode,
        quorumRequired,
        checkInDurationMinutes,
      } = req.body || {};
      if (!title || !dateIso || !location) {
        res.status(400).json({ error: 'Título, fecha y lugar son obligatorios.' });
        return;
      }
      const now = Date.now();
      const mins = Math.max(5, Math.min(720, Number(checkInDurationMinutes || 120)));
      const id = newId('sess');
      await db.insert(sessions).values({
        id,
        title: String(title).trim().slice(0, 180),
        sessionType: String(sessionType || 'Ordinaria').slice(0, 64),
        dateIso: String(dateIso).slice(0, 40),
        timeRange: String(timeRange || '').slice(0, 64),
        location: String(location).trim().slice(0, 160),
        agenda: String(agenda || '').slice(0, 2000),
        status: 'programada',
        actaUrl: '',
        attendance: {},
        excuses: {},
        checkInCode: String(checkInCode || crypto.randomBytes(3).toString('hex').toUpperCase()).slice(0, 16),
        checkInExpiresAt: new Date(now + mins * 60_000).toISOString(),
        qrRotatedAt: new Date(now).toISOString(),
        quorumRequired: Math.max(1, Number(quorumRequired || 1)),
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Session create failed:', error);
      res.status(500).json({ error: 'No fue posible convocar la sesión.' });
    }
  });

  app.patch('/api/sessions/:id', requireAuth, requirePermission('sesiones.editar'), async (req, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['programada', 'en_curso', 'finalizada'].includes(body.status)) patch.status = body.status;
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 180);
      }
      if (typeof body.sessionType === 'string' && body.sessionType.trim()) {
        patch.sessionType = body.sessionType.trim().slice(0, 64);
      }
      if (typeof body.dateIso === 'string' && body.dateIso.trim()) {
        patch.dateIso = body.dateIso.trim().slice(0, 40);
      }
      if (typeof body.timeRange === 'string') patch.timeRange = body.timeRange.trim().slice(0, 64);
      if (typeof body.location === 'string' && body.location.trim()) {
        patch.location = body.location.trim().slice(0, 160);
      }
      if (typeof body.quorumRequired === 'number' || typeof body.quorumRequired === 'string') {
        const q = Number(body.quorumRequired);
        if (!Number.isNaN(q) && q >= 1) patch.quorumRequired = Math.round(q);
      }
      if (typeof body.actaUrl === 'string' && isSafeUrl(body.actaUrl)) patch.actaUrl = body.actaUrl;
      if (typeof body.agenda === 'string') patch.agenda = body.agenda.slice(0, 2000);
      await db.update(sessions).set(patch).where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Session update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la sesión.' });
    }
  });

  app.post('/api/sessions/:id/attendance', requireAuth, requirePermission('sesiones.asistencia_gestionar'), async (req, res) => {
    try {
      const id = String(req.params.id);
      const { targetUid, status } = req.body || {};
      if (!targetUid || !['presente', 'tarde', 'excusa', 'ausente'].includes(status)) {
        res.status(400).json({ error: 'Datos de asistencia inválidos.' });
        return;
      }
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess) {
        res.status(404).json({ error: 'Sesión no encontrada.' });
        return;
      }
      const nextAttendance = { ...(sess.attendance || {}), [String(targetUid)]: String(status) };
      await db
        .update(sessions)
        .set({ attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Attendance mark failed:', error);
      res.status(500).json({ error: 'No fue posible registrar asistencia.' });
    }
  });

  app.post('/api/sessions/:id/attendance-bulk', requireAuth, requirePermission('sesiones.asistencia_gestionar'), async (req, res) => {
    try {
      const id = String(req.params.id);
      const { entries } = req.body || {};
      if (!entries || typeof entries !== 'object') {
        res.status(400).json({ error: 'Envía el mapa de asistencias a actualizar.' });
        return;
      }
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess) {
        res.status(404).json({ error: 'Sesión no encontrada.' });
        return;
      }
      const nextAttendance: Record<string, string> = { ...(sess.attendance || {}) };
      for (const [uidKey, val] of Object.entries(entries as Record<string, unknown>)) {
        if (['presente', 'tarde', 'excusa', 'ausente'].includes(String(val))) {
          nextAttendance[String(uidKey)] = String(val);
        }
      }
      await db
        .update(sessions)
        .set({ attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Bulk attendance failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la asistencia masiva.' });
    }
  });

  app.post('/api/sessions/:id/rotate-code', requireAuth, requirePermission('sesiones.asistencia_gestionar'), async (req, res) => {
    try {
      const id = String(req.params.id);
      const mins = Math.max(5, Math.min(720, Number(req.body?.durationMinutes || 30)));
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess) {
        res.status(404).json({ error: 'Sesión no encontrada.' });
        return;
      }
      const now = Date.now();
      const nextCode = `CMJ-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const expiresAt = new Date(now + mins * 60_000).toISOString();
      const rotatedAt = new Date(now).toISOString();
      await db
        .update(sessions)
        .set({
          checkInCode: nextCode,
          checkInExpiresAt: expiresAt,
          qrRotatedAt: rotatedAt,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, id));
      res.json({ ok: true, checkInCode: nextCode, checkInExpiresAt: expiresAt });
    } catch (error) {
      console.error('Rotate QR code failed:', error);
      res.status(500).json({ error: 'No se pudo rotar el código QR.' });
    }
  });

  app.post('/api/sessions/:id/excuse', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const { targetUid, reason, attachmentUrl, attachmentName } = req.body || {};
      const canManageAtt = userHasPermission(me, 'sesiones.asistencia_gestionar');
      if (!canManageAtt && !userHasPermission(me, 'sesiones.autoregistro')) {
        sendPermissionDenied(res, 'sesiones.autoregistro');
        return;
      }
      const resolvedUid =
        canManageAtt && typeof targetUid === 'string' && targetUid.trim()
          ? targetUid.trim()
          : me.uid;

      const cleanReason = String(reason || '').trim();
      if (cleanReason.length < 4) {
        res.status(400).json({ error: 'Describe el motivo de la excusa (mínimo 4 caracteres).' });
        return;
      }
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess) {
        res.status(404).json({ error: 'Sesión no encontrada.' });
        return;
      }

      const safeAttachmentUrl =
        typeof attachmentUrl === 'string' && isSafeUrl(attachmentUrl) ? attachmentUrl : undefined;
      const nextExcuses = {
        ...(sess.excuses || {}),
        [resolvedUid]: {
          reason: cleanReason.slice(0, 600),
          attachmentUrl: safeAttachmentUrl,
          attachmentName: typeof attachmentName === 'string' ? attachmentName.slice(0, 160) : undefined,
          submittedAt: new Date().toISOString(),
        },
      };
      const nextAttendance = { ...(sess.attendance || {}), [resolvedUid]: 'excusa' };
      await db
        .update(sessions)
        .set({ excuses: nextExcuses, attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Submit excuse failed:', error);
      res.status(500).json({ error: 'No fue posible registrar la excusa.' });
    }
  });

  app.post('/api/sessions/:id/checkin', requireAuth, requirePermission('sesiones.autoregistro'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const code = String(req.body?.code || '').trim().toUpperCase();
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess || sess.status === 'finalizada') {
        res.status(400).json({ error: 'La sesión no está abierta para registro.' });
        return;
      }
      if (!sess.checkInCode || sess.checkInCode.toUpperCase() !== code) {
        res.status(400).json({ error: 'El código de asistencia no coincide con la sesión.' });
        return;
      }
      if (sess.checkInExpiresAt && Date.now() > Date.parse(sess.checkInExpiresAt)) {
        res.status(400).json({
          error: 'El código de asistencia ha expirado. Solicita a Mesa Directiva generar uno nuevo.',
        });
        return;
      }
      const nextAttendance = { ...(sess.attendance || {}), [req.authUser!.uid]: 'presente' };
      await db
        .update(sessions)
        .set({ attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Check-in failed:', error);
      res.status(500).json({ error: 'No fue posible registrar tu asistencia.' });
    }
  });

  app.delete('/api/sessions/:id', requireAuth, requirePermission('sesiones.eliminar'), async (req, res) => {
    try {
      await db.delete(sessions).where(eq(sessions.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Session delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la sesión.' });
    }
  });

  app.post('/api/actas', requireAuth, requirePermission('actas.crear'), async (req: AuthedRequest, res) => {
    try {
      const body = req.body || {};
      const title = String(body.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'El título del acta es obligatorio.' });
        return;
      }
      const year = Number(body.year) || new Date().getFullYear();
      const existingSameYear = await db
        .select({ id: actas.id })
        .from(actas)
        .where(eq(actas.year, year));
      const nextNum = String(existingSameYear.length + 1).padStart(3, '0');
      const consecutive =
        typeof body.consecutive === 'string' && body.consecutive.trim()
          ? body.consecutive.trim().slice(0, 64)
          : `Acta No. ${nextNum} de ${year}`;

      let sessionMeta = {
        location: String(body.location || 'Recinto CMJ Flandes, Tolima').trim(),
        meetingDate: String(body.meetingDate || new Date().toISOString().slice(0, 10)).trim(),
        timeRange: String(body.timeRange || '').trim(),
        quorumCount: Number(body.quorumCount || 0),
        quorumRequired: Math.max(1, Number(body.quorumRequired || 1)),
        agenda: String(body.agenda || '').trim(),
      };

      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (sessionId) {
        const [sess] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (sess) {
          const presentCount = Object.values(sess.attendance || {}).filter(
            (st) => st === 'presente' || st === 'tarde'
          ).length;
          sessionMeta = {
            location: String(body.location || sess.location || 'CMJ Flandes').trim(),
            meetingDate: String(body.meetingDate || sess.dateIso).trim(),
            timeRange: String(body.timeRange || sess.timeRange || '').trim(),
            quorumCount: Number(body.quorumCount ?? presentCount),
            quorumRequired: Math.max(1, Number(body.quorumRequired || sess.quorumRequired || 1)),
            agenda: String(body.agenda || sess.agenda || '').trim(),
          };
        }
      }

      const id = newId('acta');
      const nowIso = new Date().toISOString();
      await db.insert(actas).values({
        id,
        consecutive,
        year,
        title: title.slice(0, 200),
        sessionId,
        commissionId: typeof body.commissionId === 'string' ? body.commissionId.trim().slice(0, 64) : '',
        location: sessionMeta.location.slice(0, 180),
        meetingDate: sessionMeta.meetingDate.slice(0, 40),
        timeRange: sessionMeta.timeRange.slice(0, 64),
        quorumCount: sessionMeta.quorumCount,
        quorumRequired: sessionMeta.quorumRequired,
        agenda: sessionMeta.agenda.slice(0, 4000),
        development: String(body.development || '').slice(0, 16000),
        propositions: String(body.propositions || '').slice(0, 8000),
        commitmentsSummary: String(body.commitmentsSummary || '').slice(0, 8000),
        linkedVoteIds: Array.isArray(body.linkedVoteIds)
          ? body.linkedVoteIds.map(String).slice(0, 25)
          : [],
        status: 'borrador',
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.fullName,
        signatures: [],
        comments: [],
        history: [
          {
            at: nowIso,
            actorName: req.authUser!.fullName,
            action: `Creó ${consecutive} en estado borrador`,
          },
        ],
        verificationHash: '',
      });
      res.json({ id, consecutive, ok: true });
    } catch (error) {
      console.error('Acta create failed:', error);
      res.status(500).json({ error: 'No fue posible crear el acta.' });
    }
  });

  app.patch('/api/actas/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [existing] = await db.select().from(actas).where(eq(actas.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Acta no encontrada.' });
        return;
      }

      const me = req.authUser!;
      const canEdit = userHasPermission(me, 'actas.editar');
      if (!canEdit && existing.authorUid !== me.uid) {
        sendPermissionDenied(res, 'actas.editar');
        return;
      }

      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      const actions: string[] = [];

      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 200);
      }
      if (typeof body.consecutive === 'string' && body.consecutive.trim()) {
        patch.consecutive = body.consecutive.trim().slice(0, 64);
      }
      if (typeof body.sessionId === 'string') patch.sessionId = body.sessionId.trim().slice(0, 64);
      if (typeof body.commissionId === 'string') patch.commissionId = body.commissionId.trim().slice(0, 64);
      if (typeof body.location === 'string') patch.location = body.location.trim().slice(0, 180);
      if (typeof body.meetingDate === 'string') patch.meetingDate = body.meetingDate.trim().slice(0, 40);
      if (typeof body.timeRange === 'string') patch.timeRange = body.timeRange.trim().slice(0, 64);
      if (typeof body.quorumCount === 'number') patch.quorumCount = Math.max(0, Math.round(body.quorumCount));
      if (typeof body.quorumRequired === 'number') {
        patch.quorumRequired = Math.max(1, Math.round(body.quorumRequired));
      }
      if (typeof body.agenda === 'string') patch.agenda = body.agenda.slice(0, 4000);
      if (typeof body.development === 'string') patch.development = body.development.slice(0, 16000);
      if (typeof body.propositions === 'string') patch.propositions = body.propositions.slice(0, 8000);
      if (typeof body.commitmentsSummary === 'string') {
        patch.commitmentsSummary = body.commitmentsSummary.slice(0, 8000);
      }
      if (Array.isArray(body.linkedVoteIds)) {
        patch.linkedVoteIds = body.linkedVoteIds.map(String).slice(0, 25);
      }

      const VALID_STATUSES = ['borrador', 'revision', 'aprobada', 'firmada', 'archivada'];
      if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status) && body.status !== existing.status) {
        if ((body.status === 'aprobada' || body.status === 'archivada') && !userHasPermission(me, 'actas.aprobar')) {
          sendPermissionDenied(
            res,
            'actas.aprobar',
            undefined,
            'La aprobación definitiva o archivo oficial de actas requiere permiso de Presidencia.'
          );
          return;
        }
        if (body.status === 'firmada' && !userHasPermission(me, 'actas.firmar')) {
          sendPermissionDenied(res, 'actas.firmar');
          return;
        }
        patch.status = body.status;
        actions.push(`Cambió estado de ${existing.status} a ${body.status}`);
        if (['aprobada', 'firmada', 'archivada'].includes(body.status)) {
          await logServerAudit(me, `Cambió estado de acta a ${body.status}`, 'Actas', existing.consecutive);
          patch.verificationHash = computeActaVerificationHash({
            id: existing.id,
            consecutive: (patch.consecutive as string) ?? existing.consecutive,
            title: (patch.title as string) ?? existing.title,
            meetingDate: (patch.meetingDate as string) ?? existing.meetingDate,
            agenda: (patch.agenda as string) ?? existing.agenda,
            development: (patch.development as string) ?? existing.development,
            propositions: (patch.propositions as string) ?? existing.propositions,
            commitmentsSummary: (patch.commitmentsSummary as string) ?? existing.commitmentsSummary,
          });
        }
      } else {
        actions.push('Actualizó contenido del acta');
      }

      patch.history = [
        {
          at: new Date().toISOString(),
          actorName: req.authUser!.fullName,
          action: actions.join(' · '),
        },
        ...(existing.history || []),
      ].slice(0, 40);

      await db.update(actas).set(patch).where(eq(actas.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Acta update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el acta.' });
    }
  });

  app.post('/api/actas/:id/sign', requireAuth, requirePermission('actas.firmar'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [existing] = await db.select().from(actas).where(eq(actas.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Acta no encontrada.' });
        return;
      }
      if ((existing.signatures || []).some((s) => s.uid === req.authUser!.uid)) {
        res.status(400).json({ error: 'Ya registraste tu firma digital en esta acta.' });
        return;
      }

      const signedAt = new Date().toISOString();
      const docHash = computeActaVerificationHash(existing);
      const sigHash = crypto
        .createHash('sha256')
        .update(`${docHash}:${req.authUser!.uid}:${signedAt}`)
        .digest('hex')
        .slice(0, 16)
        .toUpperCase();

      const nextSignatures = [
        ...(existing.signatures || []),
        {
          uid: req.authUser!.uid,
          name: req.authUser!.fullName,
          roleLabel: req.authUser!.roleLabel,
          signedAt,
          hash: sigHash,
        },
      ];

      const nextStatus = existing.status === 'archivada' ? 'archivada' : 'firmada';

      await db
        .update(actas)
        .set({
          signatures: nextSignatures,
          status: nextStatus,
          verificationHash: docHash,
          history: [
            {
              at: signedAt,
              actorName: req.authUser!.fullName,
              action: `Firmó digitalmente (${req.authUser!.roleLabel}) · Sello ${sigHash}`,
            },
            ...(existing.history || []),
          ].slice(0, 40),
          updatedAt: new Date(),
        })
        .where(eq(actas.id, id));

      res.json({ ok: true, verificationHash: docHash, signatureHash: sigHash });
    } catch (error) {
      console.error('Acta sign failed:', error);
      res.status(500).json({ error: 'No fue posible firmar el acta.' });
    }
  });

  app.post('/api/actas/:id/comment', requireAuth, requirePermission('actas.comentar'), async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const bodyText = String(req.body?.body || '').trim();
      if (bodyText.length < 2) {
        res.status(400).json({ error: 'Escribe una observación válida.' });
        return;
      }
      const [existing] = await db.select().from(actas).where(eq(actas.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Acta no encontrada.' });
        return;
      }
      const nextComments = [
        {
          id: newId('acmt'),
          authorUid: req.authUser!.uid,
          authorName: req.authUser!.fullName,
          authorRoleLabel: req.authUser!.roleLabel,
          body: bodyText.slice(0, 1200),
          createdAt: new Date().toISOString(),
        },
        ...(existing.comments || []),
      ].slice(0, 60);

      await db
        .update(actas)
        .set({ comments: nextComments, updatedAt: new Date() })
        .where(eq(actas.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Acta comment failed:', error);
      res.status(500).json({ error: 'No fue posible guardar la observación.' });
    }
  });

  app.post('/api/actas/:id/ai-draft', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      if (!userHasPermission(me, 'actas.crear') && !userHasPermission(me, 'actas.editar')) {
        sendPermissionDenied(res, 'actas.editar');
        return;
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error:
            'El asistente inteligente de redacción no tiene GEMINI_API_KEY configurada en el servidor.',
        });
        return;
      }

      const id = String(req.params.id);
      const [acta] = await db.select().from(actas).where(eq(actas.id, id)).limit(1);
      if (!acta) {
        res.status(404).json({ error: 'Acta no encontrada.' });
        return;
      }

      const notes = String(req.body?.notes || '').trim().slice(0, 4000);
      const sessionId = String(req.body?.sessionId || acta.sessionId || '').trim();

      let sessionContext = 'Sin sesión vinculada.';
      if (sessionId) {
        const [sess] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (sess) {
          const allCouncilors = await db.select().from(publicCouncilors);
          const attEntries = Object.entries(sess.attendance || {}).map(([cUid, st]) => {
            const cName = allCouncilors.find((c) => c.uid === cUid)?.fullName || cUid;
            return `- ${cName}: ${st}`;
          });
          sessionContext = [
            `Sesión: ${sess.title} (${sess.sessionType})`,
            `Fecha: ${sess.dateIso} ${sess.timeRange || ''}`,
            `Lugar: ${sess.location}`,
            `Orden del día: ${sess.agenda || 'No registrado'}`,
            `Asistencia (${attEntries.length} registros):\n${attEntries.join('\n') || 'Sin registro'}`,
          ].join('\n');
        }
      }

      const linkedVoteIds = Array.isArray(req.body?.linkedVoteIds)
        ? req.body.linkedVoteIds.map(String)
        : acta.linkedVoteIds || [];
      let votesContext = 'Sin votaciones vinculadas.';
      if (linkedVoteIds.length > 0) {
        const voteRows = await db
          .select()
          .from(votes)
          .where(inArray(votes.id, linkedVoteIds));
        if (voteRows.length > 0) {
          votesContext = voteRows
            .map(
              (v) =>
                `- ${v.title} (${v.voteMode || 'nominal'}, mayoría ${v.majorityType || 'simple'}): ${
                  v.resultSummary || JSON.stringify(v.tallies)
                }`
            )
            .join('\n');
        }
      }

      const commitmentRows = await db
        .select()
        .from(commitments)
        .orderBy(desc(commitments.createdAt))
        .limit(12);
      const commitmentsContext =
        commitmentRows.length > 0
          ? commitmentRows
              .map(
                (c) =>
                  `- ${c.title} (Responsable: ${c.responsibleName}, Estado: ${c.status}, Vence: ${
                    c.dueDate || 'Por definir'
                  })`
              )
              .join('\n')
          : 'Sin compromisos activos.';

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = [
        `Redacta en español formal institucional colombiano (Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018) el borrador de los bloques principales del acta "${acta.consecutive} — ${acta.title}" del Consejo Municipal de Juventudes (CMJ) de Flandes, Tolima.`,
        `Lugar: ${acta.location} | Fecha: ${acta.meetingDate} ${acta.timeRange || ''}`,
        `Orden del día:\n${acta.agenda || 'Por definir'}`,
        `Contexto de sesión y asistencia:\n${sessionContext}`,
        `Votaciones:\n${votesContext}`,
        `Compromisos registrados:\n${commitmentsContext}`,
        notes ? `Notas adicionales de secretaría:\n${notes}` : '',
        `No inventes cifras ni acuerdos que no estén respaldados por los datos entregados.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Eres secretario técnico institucional del Consejo Municipal de Juventudes de Flandes, Tolima (Colombia). Responde únicamente en JSON con tres campos claros y bien redactados en español formal.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              development: {
                type: Type.STRING,
                description:
                  'Desarrollo cronológico y formal de la sesión, verificación de quórum e intervenciones principales.',
              },
              propositions: {
                type: Type.STRING,
                description:
                  'Proposiciones presentadas, decisiones tomadas y resultados de votaciones.',
              },
              commitmentsSummary: {
                type: Type.STRING,
                description:
                  'Listado claro de compromisos, responsables y fechas acordadas.',
              },
            },
            required: ['development', 'propositions', 'commitmentsSummary'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        development?: string;
        propositions?: string;
        commitmentsSummary?: string;
      };

      res.json({
        ok: true,
        development: parsed.development || '',
        propositions: parsed.propositions || '',
        commitmentsSummary: parsed.commitmentsSummary || '',
      });
    } catch (error) {
      console.error('Acta AI draft failed:', error);
      res.status(500).json({
        error: 'No se pudo generar el borrador asistido. Verifica la configuración del servicio de IA.',
      });
    }
  });

  app.delete('/api/actas/:id', requireAuth, requirePermission('actas.eliminar'), async (req, res) => {
    try {
      await db.delete(actas).where(eq(actas.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Acta delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el acta.' });
    }
  });

  // Proponer puntos al orden del día de una sesión (Consejero Departamental / autorizado)
  app.post(
    '/api/sessions/:id/agenda-proposals',
    requireAuth,
    requirePermission('sesiones.proponer_agenda'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const sessionId = String(req.params.id);
        const title = String(req.body?.title || '').trim().slice(0, 180);
        const justification = String(req.body?.justification || '').trim().slice(0, 1500);

        if (title.length < 4 || justification.length < 10) {
          res.status(400).json({
            error: 'Escribe un título (mín. 4 caracteres) y justificación (mín. 10 caracteres) para el punto propuesto.',
          });
          return;
        }

        const [sess] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (!sess) {
          res.status(404).json({ error: 'Sesión no encontrada.' });
          return;
        }
        if (sess.status === 'finalizada') {
          res.status(400).json({ error: 'No es posible proponer puntos en una sesión finalizada.' });
          return;
        }

        const id = newId('agprop');
        await db.insert(sessionAgendaProposals).values({
          id,
          sessionId,
          title,
          justification,
          proposerUid: me.uid,
          proposerName: me.fullName,
          proposerRoleLabel: me.roleLabel,
          status: 'pendiente',
        });

        const leaders = await db
          .select({ uid: users.uid })
          .from(users)
          .where(inArray(users.roleLabel, ['Presidente', 'Vicepresidente', 'Secretario']));

        await Promise.all(
          leaders
            .filter((l) => l.uid !== me.uid)
            .map((l) =>
              createPortalNotification({
                userUid: l.uid,
                type: 'agenda_propuesta',
                title: 'Nueva propuesta para orden del día',
                message: `${me.fullName} (${me.roleLabel}) propuso "${title}" para la sesión "${sess.title}".`,
                linkModule: 'sesiones',
                relatedId: sessionId,
              })
            )
        );

        await logServerAudit(me, 'Propuso punto en orden del día', 'Sesiones', `${sess.title}: ${title}`);
        res.json({ id, ok: true });
      } catch (error) {
        console.error('Create session agenda proposal failed:', error);
        res.status(500).json({ error: 'No fue posible enviar la propuesta de orden del día.' });
      }
    }
  );

  // Mesa Directiva aprueba o rechaza puntos propuestos al orden del día
  app.patch(
    '/api/sessions/:id/agenda-proposals/:proposalId',
    requireAuth,
    requirePermission('sesiones.editar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const sessionId = String(req.params.id);
        const proposalId = String(req.params.proposalId);
        const nextStatus = String(req.body?.status || '');
        const decisionNotes = String(req.body?.decisionNotes || '').trim().slice(0, 500);

        if (nextStatus !== 'aprobada' && nextStatus !== 'rechazada') {
          res.status(400).json({ error: 'El estado debe ser aprobada o rechazada.' });
          return;
        }

        const [existing] = await db
          .select()
          .from(sessionAgendaProposals)
          .where(eq(sessionAgendaProposals.id, proposalId))
          .limit(1);
        if (!existing || existing.sessionId !== sessionId) {
          res.status(404).json({ error: 'Propuesta de orden del día no encontrada.' });
          return;
        }

        const [sess] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (!sess) {
          res.status(404).json({ error: 'Sesión no encontrada.' });
          return;
        }

        const nowIso = new Date().toISOString();
        await db
          .update(sessionAgendaProposals)
          .set({
            status: nextStatus,
            decisionNotes,
            decidedByUid: me.uid,
            decidedByName: me.fullName,
            decidedAt: nowIso,
            updatedAt: new Date(),
          })
          .where(eq(sessionAgendaProposals.id, proposalId));

        if (nextStatus === 'aprobada') {
          const line = `[Propuesta aprobada — ${existing.title} (${existing.proposerName})]`;
          const currentAgenda = (sess.agenda || '').trim();
          if (!currentAgenda.includes(line)) {
            const updatedAgenda = currentAgenda ? `${currentAgenda}\n${line}` : line;
            await db
              .update(sessions)
              .set({ agenda: updatedAgenda, updatedAt: new Date() })
              .where(eq(sessions.id, sessionId));
          }
        }

        await createPortalNotification({
          userUid: existing.proposerUid,
          type: 'agenda_propuesta',
          title:
            nextStatus === 'aprobada'
              ? 'Punto incluido en orden del día'
              : 'Propuesta de orden del día no aprobada',
          message:
            nextStatus === 'aprobada'
              ? `${me.fullName} aprobó incluir "${existing.title}" en "${sess.title}".`
              : `${me.fullName} no incorporó "${existing.title}" en "${sess.title}"${decisionNotes ? `: ${decisionNotes}` : '.'}`,
          linkModule: 'sesiones',
          relatedId: sessionId,
        });

        await logServerAudit(
          me,
          nextStatus === 'aprobada' ? 'Aprobó punto de agenda' : 'Rechazó punto de agenda',
          'Sesiones',
          `${sess.title}: ${existing.title}`
        );

        res.json({ ok: true });
      } catch (error) {
        console.error('Decide session agenda proposal failed:', error);
        res.status(500).json({ error: 'No fue posible actualizar la propuesta de agenda.' });
      }
    }
  );
}
