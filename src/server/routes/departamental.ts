import type express from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  commissions,
  deptOversight,
  deptProposals,
  deptReports,
  users,
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
import type { PermissionKey } from '../../types/cmj.ts';

type DeptKind = 'proposals' | 'oversight' | 'reports';

const VALID_PROPOSAL_STATUS = ['borrador', 'radicada', 'en_concertacion', 'aprobada', 'archivada'];
const VALID_OVERSIGHT_STATUS = ['en_seguimiento', 'alerta', 'subsanada', 'cerrada'];
const VALID_RISK_LEVELS = ['bajo', 'medio', 'alto'];

async function resolveValidCommissionId(raw: unknown): Promise<string> {
  const commId = typeof raw === 'string' ? raw.trim() : '';
  if (!commId) return '';
  const [found] = await db
    .select({ id: commissions.id })
    .from(commissions)
    .where(eq(commissions.id, commId))
    .limit(1);
  return found ? found.id : '';
}

async function notifyActivePresidents(title: string, message: string, relatedId: string) {
  const presidents = await db
    .select({ uid: users.uid })
    .from(users)
    .where(and(eq(users.roleLabel, 'Presidente'), eq(users.active, true)));

  await Promise.all(
    presidents.map((pres) =>
      createPortalNotification({
        userUid: pres.uid,
        type: 'departamental_publicacion',
        title,
        message,
        linkModule: 'departamental',
        relatedId,
      })
    )
  );
}

export function registerDepartamentalRoutes(app: express.Express) {
  // Consulta general del módulo (requiere departamental.ver o aprobación presidencial)
  app.get('/api/departamental/proposals', requireAuth, async (req: AuthedRequest, res) => {
    const me = req.authUser!;
    if (!userHasPermission(me, 'departamental.ver') && !userHasPermission(me, 'departamental.publicacion_aprobar')) {
      sendPermissionDenied(res, 'departamental.ver');
      return;
    }
    const items = await db.select().from(deptProposals).orderBy(desc(deptProposals.createdAt));
    res.json({ items });
  });

  app.get('/api/departamental/oversight', requireAuth, async (req: AuthedRequest, res) => {
    const me = req.authUser!;
    if (!userHasPermission(me, 'departamental.ver') && !userHasPermission(me, 'departamental.publicacion_aprobar')) {
      sendPermissionDenied(res, 'departamental.ver');
      return;
    }
    const items = await db.select().from(deptOversight).orderBy(desc(deptOversight.createdAt));
    res.json({ items });
  });

  app.get('/api/departamental/reports', requireAuth, async (req: AuthedRequest, res) => {
    const me = req.authUser!;
    if (!userHasPermission(me, 'departamental.ver') && !userHasPermission(me, 'departamental.publicacion_aprobar')) {
      sendPermissionDenied(res, 'departamental.ver');
      return;
    }
    const items = await db.select().from(deptReports).orderBy(desc(deptReports.createdAt));
    res.json({ items });
  });

  // ── 1. Propuestas ante la administración ──
  app.post(
    '/api/departamental/proposals',
    requireAuth,
    requirePermission('departamental.propuestas_crear'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const body = req.body || {};
        const title = String(body.title || '').trim().slice(0, 180);
        const targetEntity = String(body.targetEntity || '').trim().slice(0, 180);
        const thematicAxis = String(body.thematicAxis || 'Política Pública de Juventud')
          .trim()
          .slice(0, 120);
        const summary = String(body.summary || '').trim().slice(0, 2500);
        const justification = String(body.justification || '').trim().slice(0, 2500);
        const attachmentUrl = String(body.attachmentUrl || '').trim();
        const attachmentName = String(body.attachmentName || '').trim().slice(0, 180);

        if (title.length < 4 || targetEntity.length < 3 || summary.length < 10) {
          res.status(400).json({
            error: 'Completa título (mín. 4 caracteres), entidad destinataria y resumen (mín. 10 caracteres).',
          });
          return;
        }
        if (attachmentUrl && !isSafeUrl(attachmentUrl)) {
          res.status(400).json({ error: 'La URL del adjunto no es válida.' });
          return;
        }

        const commissionId = await resolveValidCommissionId(body.commissionId);
        const status = VALID_PROPOSAL_STATUS.includes(String(body.status))
          ? String(body.status)
          : 'borrador';
        const requestPublish = Boolean(body.requestPublish);
        const id = newId('dprop');

        // Regla estricta: el Consejero Departamental nunca auto-publica sin aprobación de Presidencia
        await db.insert(deptProposals).values({
          id,
          title,
          targetEntity,
          thematicAxis,
          commissionId,
          summary,
          justification,
          status,
          visibility: 'privado',
          publicationStatus: requestPublish ? 'pendiente_presidencia' : 'privado',
          publicApproved: false,
          attachmentUrl,
          attachmentName,
          authorUid: me.uid,
          authorName: me.fullName,
        });

        if (requestPublish) {
          await notifyActivePresidents(
            'Solicitud de publicación departamental',
            `${me.fullName} solicitó publicar la propuesta "${title}" para visibilidad ciudadana.`,
            id
          );
        }

        await logServerAudit(me, 'Creó propuesta departamental', 'Gestión Departamental', title);
        res.json({ id, ok: true });
      } catch (error) {
        console.error('Create dept proposal failed:', error);
        res.status(500).json({ error: 'No fue posible registrar la propuesta departamental.' });
      }
    }
  );

  app.patch(
    '/api/departamental/proposals/:id',
    requireAuth,
    requirePermission('departamental.propuestas_crear'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptProposals)
          .where(eq(deptProposals.id, id))
          .limit(1);

        if (!existing) {
          res.status(404).json({ error: 'Propuesta no encontrada.' });
          return;
        }

        const canApprovePub = userHasPermission(me, 'departamental.publicacion_aprobar');
        if (existing.authorUid !== me.uid && !isLeadershipTier(me.accessTier) && !canApprovePub) {
          sendPermissionDenied(
            res,
            'departamental.propuestas_crear',
            undefined,
            'Solo el autor o la Mesa Directiva puede modificar esta propuesta.'
          );
          return;
        }

        const body = req.body || {};
        const patch: Record<string, unknown> = { updatedAt: new Date() };

        if (typeof body.title === 'string' && body.title.trim().length >= 4) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (typeof body.targetEntity === 'string' && body.targetEntity.trim().length >= 3) {
          patch.targetEntity = body.targetEntity.trim().slice(0, 180);
        }
        if (typeof body.thematicAxis === 'string' && body.thematicAxis.trim()) {
          patch.thematicAxis = body.thematicAxis.trim().slice(0, 120);
        }
        if (typeof body.summary === 'string' && body.summary.trim().length >= 10) {
          patch.summary = body.summary.trim().slice(0, 2500);
        }
        if (typeof body.justification === 'string') {
          patch.justification = body.justification.trim().slice(0, 2500);
        }
        if (typeof body.status === 'string' && VALID_PROPOSAL_STATUS.includes(body.status)) {
          patch.status = body.status;
        }
        if (typeof body.commissionId === 'string') {
          patch.commissionId = await resolveValidCommissionId(body.commissionId);
        }
        if (typeof body.attachmentUrl === 'string') {
          if (body.attachmentUrl && !isSafeUrl(body.attachmentUrl)) {
            res.status(400).json({ error: 'URL de adjunto inválida.' });
            return;
          }
          patch.attachmentUrl = body.attachmentUrl.trim();
        }
        if (typeof body.attachmentName === 'string') {
          patch.attachmentName = body.attachmentName.trim().slice(0, 180);
        }

        // Nunca permitir auto-publicación desde PATCH si no tiene departamental.publicacion_aprobar
        if (!canApprovePub && existing.publicApproved) {
          patch.publicApproved = false;
          patch.visibility = 'privado';
          patch.publicationStatus = 'pendiente_presidencia';
        }

        await db.update(deptProposals).set(patch).where(eq(deptProposals.id, id));
        await logServerAudit(
          me,
          'Actualizó propuesta departamental',
          'Gestión Departamental',
          String(patch.title || existing.title)
        );
        res.json({ ok: true });
      } catch (error) {
        console.error('Update dept proposal failed:', error);
        res.status(500).json({ error: 'No se pudo actualizar la propuesta.' });
      }
    }
  );

  app.delete(
    '/api/departamental/proposals/:id',
    requireAuth,
    requirePermission('departamental.propuestas_crear'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptProposals)
          .where(eq(deptProposals.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Propuesta no encontrada.' });
          return;
        }
        if (
          existing.authorUid !== me.uid &&
          !isLeadershipTier(me.accessTier) &&
          !userHasPermission(me, 'departamental.publicacion_aprobar')
        ) {
          sendPermissionDenied(res, 'departamental.propuestas_crear');
          return;
        }
        await db.delete(deptProposals).where(eq(deptProposals.id, id));
        await logServerAudit(me, 'Eliminó propuesta departamental', 'Gestión Departamental', existing.title);
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete dept proposal failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar la propuesta.' });
      }
    }
  );

  // ── 2. Veeduría y Control Social ──
  app.post(
    '/api/departamental/oversight',
    requireAuth,
    requirePermission('departamental.veeduria_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const body = req.body || {};
        const title = String(body.title || '').trim().slice(0, 180);
        const watchedEntity = String(body.watchedEntity || '').trim().slice(0, 180);
        const policyOrPlan = String(body.policyOrPlan || '').trim().slice(0, 220);
        const findings = String(body.findings || '').trim().slice(0, 3000);
        const recommendations = String(body.recommendations || '').trim().slice(0, 2500);
        const riskLevel = VALID_RISK_LEVELS.includes(String(body.riskLevel))
          ? String(body.riskLevel)
          : 'medio';
        const status = VALID_OVERSIGHT_STATUS.includes(String(body.status))
          ? String(body.status)
          : 'en_seguimiento';
        const evidenceUrl = String(body.evidenceUrl || '').trim();
        const evidenceName = String(body.evidenceName || '').trim().slice(0, 180);

        if (title.length < 4 || watchedEntity.length < 3 || policyOrPlan.length < 3 || findings.length < 10) {
          res.status(400).json({
            error: 'Completa título, entidad vigilada, política o plan y hallazgos (mín. 10 caracteres).',
          });
          return;
        }
        if (evidenceUrl && !isSafeUrl(evidenceUrl)) {
          res.status(400).json({ error: 'La URL de evidencia no es válida.' });
          return;
        }

        const commissionId = await resolveValidCommissionId(body.commissionId);
        const requestPublish = Boolean(body.requestPublish);
        const id = newId('dvee');

        await db.insert(deptOversight).values({
          id,
          title,
          watchedEntity,
          policyOrPlan,
          commissionId,
          findings,
          recommendations,
          riskLevel,
          status,
          visibility: 'privado',
          publicationStatus: requestPublish ? 'pendiente_presidencia' : 'privado',
          publicApproved: false,
          evidenceUrl,
          evidenceName,
          authorUid: me.uid,
          authorName: me.fullName,
        });

        if (requestPublish) {
          await notifyActivePresidents(
            'Veeduría pendiente de publicación',
            `${me.fullName} solicitó publicar el registro de veeduría "${title}".`,
            id
          );
        }

        await logServerAudit(me, 'Registró veeduría juvenil', 'Gestión Departamental', title);
        res.json({ id, ok: true });
      } catch (error) {
        console.error('Create dept oversight failed:', error);
        res.status(500).json({ error: 'No fue posible registrar la veeduría.' });
      }
    }
  );

  app.patch(
    '/api/departamental/oversight/:id',
    requireAuth,
    requirePermission('departamental.veeduria_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptOversight)
          .where(eq(deptOversight.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Registro de veeduría no encontrado.' });
          return;
        }
        const canApprovePub = userHasPermission(me, 'departamental.publicacion_aprobar');
        if (existing.authorUid !== me.uid && !isLeadershipTier(me.accessTier) && !canApprovePub) {
          sendPermissionDenied(res, 'departamental.veeduria_gestionar');
          return;
        }

        const body = req.body || {};
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof body.title === 'string' && body.title.trim().length >= 4) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (typeof body.watchedEntity === 'string' && body.watchedEntity.trim().length >= 3) {
          patch.watchedEntity = body.watchedEntity.trim().slice(0, 180);
        }
        if (typeof body.policyOrPlan === 'string' && body.policyOrPlan.trim().length >= 3) {
          patch.policyOrPlan = body.policyOrPlan.trim().slice(0, 220);
        }
        if (typeof body.findings === 'string' && body.findings.trim().length >= 10) {
          patch.findings = body.findings.trim().slice(0, 3000);
        }
        if (typeof body.recommendations === 'string') {
          patch.recommendations = body.recommendations.trim().slice(0, 2500);
        }
        if (typeof body.riskLevel === 'string' && VALID_RISK_LEVELS.includes(body.riskLevel)) {
          patch.riskLevel = body.riskLevel;
        }
        if (typeof body.status === 'string' && VALID_OVERSIGHT_STATUS.includes(body.status)) {
          patch.status = body.status;
        }
        if (typeof body.commissionId === 'string') {
          patch.commissionId = await resolveValidCommissionId(body.commissionId);
        }
        if (typeof body.evidenceUrl === 'string') {
          if (body.evidenceUrl && !isSafeUrl(body.evidenceUrl)) {
            res.status(400).json({ error: 'URL de evidencia inválida.' });
            return;
          }
          patch.evidenceUrl = body.evidenceUrl.trim();
        }
        if (typeof body.evidenceName === 'string') {
          patch.evidenceName = body.evidenceName.trim().slice(0, 180);
        }

        if (!canApprovePub && existing.publicApproved) {
          patch.publicApproved = false;
          patch.visibility = 'privado';
          patch.publicationStatus = 'pendiente_presidencia';
        }

        await db.update(deptOversight).set(patch).where(eq(deptOversight.id, id));
        await logServerAudit(
          me,
          'Actualizó veeduría juvenil',
          'Gestión Departamental',
          String(patch.title || existing.title)
        );
        res.json({ ok: true });
      } catch (error) {
        console.error('Update dept oversight failed:', error);
        res.status(500).json({ error: 'No fue posible actualizar la veeduría.' });
      }
    }
  );

  app.delete(
    '/api/departamental/oversight/:id',
    requireAuth,
    requirePermission('departamental.veeduria_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptOversight)
          .where(eq(deptOversight.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Registro no encontrado.' });
          return;
        }
        if (
          existing.authorUid !== me.uid &&
          !isLeadershipTier(me.accessTier) &&
          !userHasPermission(me, 'departamental.publicacion_aprobar')
        ) {
          sendPermissionDenied(res, 'departamental.veeduria_gestionar');
          return;
        }
        await db.delete(deptOversight).where(eq(deptOversight.id, id));
        await logServerAudit(me, 'Eliminó veeduría juvenil', 'Gestión Departamental', existing.title);
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete dept oversight failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar la veeduría.' });
      }
    }
  );

  // ── 3. Informes de Interlocución Departamental ──
  app.post(
    '/api/departamental/reports',
    requireAuth,
    requirePermission('departamental.informes_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const body = req.body || {};
        const title = String(body.title || '').trim().slice(0, 180);
        const reportPeriod = String(body.reportPeriod || '').trim().slice(0, 80);
        const sessionDate = String(body.sessionDate || '').trim().slice(0, 40);
        const departamentalSpace = String(
          body.departamentalSpace || 'Consejo Departamental de Juventud del Tolima'
        )
          .trim()
          .slice(0, 180);
        const summary = String(body.summary || '').trim().slice(0, 3000);
        const agreements = String(body.agreements || '').trim().slice(0, 2500);
        const participationStrategies = String(body.participationStrategies || '').trim().slice(0, 2500);
        const attachmentUrl = String(body.attachmentUrl || '').trim();
        const attachmentName = String(body.attachmentName || '').trim().slice(0, 180);

        if (title.length < 4 || reportPeriod.length < 2 || summary.length < 10) {
          res.status(400).json({
            error: 'Completa título, período del informe y resumen ejecutivo (mín. 10 caracteres).',
          });
          return;
        }
        if (attachmentUrl && !isSafeUrl(attachmentUrl)) {
          res.status(400).json({ error: 'URL de adjunto inválida.' });
          return;
        }

        const commissionId = await resolveValidCommissionId(body.commissionId);
        const requestPublish = Boolean(body.requestPublish);
        const id = newId('dinf');

        await db.insert(deptReports).values({
          id,
          title,
          reportPeriod,
          sessionDate,
          departamentalSpace,
          commissionId,
          summary,
          agreements,
          participationStrategies,
          visibility: 'privado',
          publicationStatus: requestPublish ? 'pendiente_presidencia' : 'privado',
          publicApproved: false,
          attachmentUrl,
          attachmentName,
          authorUid: me.uid,
          authorName: me.fullName,
        });

        if (requestPublish) {
          await notifyActivePresidents(
            'Informe departamental pendiente de publicación',
            `${me.fullName} solicitó publicar el informe "${title}".`,
            id
          );
        }

        await logServerAudit(me, 'Registró informe departamental', 'Gestión Departamental', title);
        res.json({ id, ok: true });
      } catch (error) {
        console.error('Create dept report failed:', error);
        res.status(500).json({ error: 'No fue posible registrar el informe departamental.' });
      }
    }
  );

  app.patch(
    '/api/departamental/reports/:id',
    requireAuth,
    requirePermission('departamental.informes_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptReports)
          .where(eq(deptReports.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Informe no encontrado.' });
          return;
        }
        const canApprovePub = userHasPermission(me, 'departamental.publicacion_aprobar');
        if (existing.authorUid !== me.uid && !isLeadershipTier(me.accessTier) && !canApprovePub) {
          sendPermissionDenied(res, 'departamental.informes_gestionar');
          return;
        }

        const body = req.body || {};
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof body.title === 'string' && body.title.trim().length >= 4) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (typeof body.reportPeriod === 'string' && body.reportPeriod.trim()) {
          patch.reportPeriod = body.reportPeriod.trim().slice(0, 80);
        }
        if (typeof body.sessionDate === 'string') {
          patch.sessionDate = body.sessionDate.trim().slice(0, 40);
        }
        if (typeof body.departamentalSpace === 'string' && body.departamentalSpace.trim()) {
          patch.departamentalSpace = body.departamentalSpace.trim().slice(0, 180);
        }
        if (typeof body.summary === 'string' && body.summary.trim().length >= 10) {
          patch.summary = body.summary.trim().slice(0, 3000);
        }
        if (typeof body.agreements === 'string') {
          patch.agreements = body.agreements.trim().slice(0, 2500);
        }
        if (typeof body.participationStrategies === 'string') {
          patch.participationStrategies = body.participationStrategies.trim().slice(0, 2500);
        }
        if (typeof body.commissionId === 'string') {
          patch.commissionId = await resolveValidCommissionId(body.commissionId);
        }
        if (typeof body.attachmentUrl === 'string') {
          if (body.attachmentUrl && !isSafeUrl(body.attachmentUrl)) {
            res.status(400).json({ error: 'URL de adjunto inválida.' });
            return;
          }
          patch.attachmentUrl = body.attachmentUrl.trim();
        }
        if (typeof body.attachmentName === 'string') {
          patch.attachmentName = body.attachmentName.trim().slice(0, 180);
        }

        if (!canApprovePub && existing.publicApproved) {
          patch.publicApproved = false;
          patch.visibility = 'privado';
          patch.publicationStatus = 'pendiente_presidencia';
        }

        await db.update(deptReports).set(patch).where(eq(deptReports.id, id));
        await logServerAudit(
          me,
          'Actualizó informe departamental',
          'Gestión Departamental',
          String(patch.title || existing.title)
        );
        res.json({ ok: true });
      } catch (error) {
        console.error('Update dept report failed:', error);
        res.status(500).json({ error: 'No fue posible actualizar el informe.' });
      }
    }
  );

  app.delete(
    '/api/departamental/reports/:id',
    requireAuth,
    requirePermission('departamental.informes_gestionar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const [existing] = await db
          .select()
          .from(deptReports)
          .where(eq(deptReports.id, id))
          .limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Informe no encontrado.' });
          return;
        }
        if (
          existing.authorUid !== me.uid &&
          !isLeadershipTier(me.accessTier) &&
          !userHasPermission(me, 'departamental.publicacion_aprobar')
        ) {
          sendPermissionDenied(res, 'departamental.informes_gestionar');
          return;
        }
        await db.delete(deptReports).where(eq(deptReports.id, id));
        await logServerAudit(me, 'Eliminó informe departamental', 'Gestión Departamental', existing.title);
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete dept report failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar el informe.' });
      }
    }
  );

  // ── 4. Solicitar publicación al portal público (autor -> Presidencia) ──
  app.post('/api/departamental/:kind/:id/request-publish', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const kind = String(req.params.kind) as DeptKind;
      const id = String(req.params.id);

      const permByKind: Record<DeptKind, PermissionKey> = {
        proposals: 'departamental.propuestas_crear',
        oversight: 'departamental.veeduria_gestionar',
        reports: 'departamental.informes_gestionar',
      };
      if (!permByKind[kind]) {
        res.status(400).json({ error: 'Tipo de registro departamental inválido.' });
        return;
      }
      if (!userHasPermission(me, permByKind[kind])) {
        sendPermissionDenied(res, permByKind[kind]);
        return;
      }

      const table =
        kind === 'proposals' ? deptProposals : kind === 'oversight' ? deptOversight : deptReports;
      const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Registro no encontrado.' });
        return;
      }

      await db
        .update(table)
        .set({
          visibility: 'privado',
          publicApproved: false,
          publicationStatus: 'pendiente_presidencia',
          rejectionReason: '',
          updatedAt: new Date(),
        })
        .where(eq(table.id, id));

      await notifyActivePresidents(
        'Solicitud de publicación departamental',
        `${me.fullName} solicita aprobación de Presidencia para publicar "${existing.title}" en Transparencia.`,
        id
      );

      await logServerAudit(
        me,
        'Solicitó publicación departamental',
        'Gestión Departamental',
        existing.title
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('Request publish failed:', error);
      res.status(500).json({ error: 'No fue posible enviar la solicitud de publicación.' });
    }
  });

  // ── 5. Aprobación o rechazo de publicación pública (EXCLUSIVO PRESIDENCIA) ──
  app.post(
    '/api/departamental/:kind/:id/publish-decision',
    requireAuth,
    requirePermission('departamental.publicacion_aprobar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const kind = String(req.params.kind) as DeptKind;
        const id = String(req.params.id);
        const decision = String(req.body?.decision || '');
        const rejectionReason = String(req.body?.rejectionReason || '').trim().slice(0, 500);

        if (!['proposals', 'oversight', 'reports'].includes(kind)) {
          res.status(400).json({ error: 'Categoría departamental inválida.' });
          return;
        }
        if (decision !== 'aprobar' && decision !== 'rechazar') {
          res.status(400).json({ error: 'Debes indicar si apruebas o rechazas la publicación.' });
          return;
        }
        if (decision === 'rechazar' && rejectionReason.length < 5) {
          res.status(400).json({ error: 'Indica un motivo claro al rechazar la publicación.' });
          return;
        }

        const table =
          kind === 'proposals' ? deptProposals : kind === 'oversight' ? deptOversight : deptReports;
        const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
        if (!existing) {
          res.status(404).json({ error: 'Registro no encontrado.' });
          return;
        }

        const approved = decision === 'aprobar';
        const nowIso = new Date().toISOString();

        await db
          .update(table)
          .set({
            publicApproved: approved,
            visibility: approved ? 'publico' : 'privado',
            publicationStatus: approved ? 'publicado' : 'rechazado',
            rejectionReason: approved ? '' : rejectionReason,
            approvedByUid: me.uid,
            approvedByName: me.fullName,
            approvedAt: nowIso,
            updatedAt: new Date(),
          })
          .where(eq(table.id, id));

        await createPortalNotification({
          userUid: existing.authorUid,
          type: 'departamental_publicacion',
          title: approved
            ? 'Publicación departamental aprobada'
            : 'Publicación departamental devuelta',
          message: approved
            ? `Presidencia (${me.fullName}) aprobó la publicación ciudadana de "${existing.title}".`
            : `Presidencia (${me.fullName}) mantuvo en privado "${existing.title}": ${rejectionReason}`,
          linkModule: 'departamental',
          relatedId: id,
        });

        await logServerAudit(
          me,
          approved ? 'Aprobó publicación departamental' : 'Rechazó publicación departamental',
          'Gestión Departamental',
          existing.title
        );

        res.json({ ok: true, approved });
      } catch (error) {
        console.error('Publish decision failed:', error);
        res.status(500).json({ error: 'No fue posible registrar la decisión de publicación.' });
      }
    }
  );
}
