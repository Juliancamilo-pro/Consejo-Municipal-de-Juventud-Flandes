import type express from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  auditLogs,
  callsSurveys,
  contactMessages,
  documents,
  portalSettings,
  surveyResponses,
} from '../../db/schema.ts';
import {
  type AuthedRequest,
  ensureMinimalStructure,
  isSafeUrl,
  logServerAudit,
  newId,
  requireAuth,
  requirePermission,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';

export function registerDocumentsAndPortalRoutes(app: express.Express) {
  app.post('/api/documents', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const {
        title,
        folder,
        category,
        version,
        fileUrl,
        storagePath,
        fileName,
        mimeType,
        fileSize,
        visibility,
        commissionId,
      } = req.body || {};
      const cleanCommId = typeof commissionId === 'string' ? commissionId.trim() : '';

      if (!userHasPermission(me, 'documentos.subir', cleanCommId || undefined)) {
        sendPermissionDenied(res, 'documentos.subir', cleanCommId || undefined);
        return;
      }

      if (!title || !fileUrl || !isSafeUrl(fileUrl) || !fileName) {
        res.status(400).json({ error: 'Datos de documento inválidos.' });
        return;
      }

      const canApprove = userHasPermission(me, 'documentos.aprobar');
      const id = newId('doc');
      await db.insert(documents).values({
        id,
        title: String(title).trim().slice(0, 180),
        folder: String(folder || 'General').trim().slice(0, 80),
        category: String(category || 'Acta').trim().slice(0, 60),
        version: String(version || 'v1.0').trim().slice(0, 24),
        versionHistory: [],
        fileUrl: String(fileUrl),
        storagePath: String(storagePath || '').slice(0, 512),
        fileName: String(fileName).slice(0, 200),
        mimeType: String(mimeType || 'application/octet-stream').slice(0, 120),
        fileSize: Number(fileSize || 0),
        visibility: canApprove && visibility === 'publico' ? 'publico' : 'privado',
        commissionId: cleanCommId,
        uploadedByUid: me.uid,
        uploadedByName: me.fullName,
        approvedByPresidente: canApprove && me.roleLabel === 'Presidente',
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Document create failed:', error);
      res.status(500).json({ error: 'No fue posible registrar el documento.' });
    }
  });

  app.post('/api/documents/:id/version', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const { version, fileUrl, storagePath, fileName, mimeType, fileSize, note } = req.body || {};
      if (!fileUrl || !isSafeUrl(fileUrl) || !fileName) {
        res.status(400).json({ error: 'El archivo de nueva versión es inválido.' });
        return;
      }
      const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (!doc) {
        res.status(404).json({ error: 'Documento no encontrado.' });
        return;
      }

      const canEditDoc =
        userHasPermission(me, 'documentos.editar') ||
        (userHasPermission(me, 'documentos.subir', doc.commissionId || undefined) &&
          (doc.uploadedByUid === me.uid ||
            (doc.commissionId && me.coordinatorCommissionIds.includes(doc.commissionId))));

      if (!canEditDoc) {
        sendPermissionDenied(res, 'documentos.editar', doc.commissionId || undefined);
        return;
      }

      const previousEntry = {
        version: doc.version,
        fileUrl: doc.fileUrl,
        storagePath: doc.storagePath,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        uploadedByUid: doc.uploadedByUid,
        uploadedByName: doc.uploadedByName,
        uploadedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
        notes: typeof note === 'string' ? note.trim().slice(0, 200) : undefined,
      };
      const nextHistory = [previousEntry, ...(doc.versionHistory || [])].slice(0, 20);
      const nextVerMatch = /^v?(\d+)(?:\.(\d+))?$/i.exec(doc.version.trim());
      const fallbackNextVersion = nextVerMatch
        ? `v${Number(nextVerMatch[1]) + 1}.0`
        : `v${nextHistory.length + 1}.0`;
      const resolvedVersion =
        typeof version === 'string' && version.trim()
          ? version.trim().slice(0, 24)
          : fallbackNextVersion;

      await db
        .update(documents)
        .set({
          version: resolvedVersion,
          versionHistory: nextHistory,
          fileUrl: String(fileUrl),
          storagePath: String(storagePath || '').slice(0, 512),
          fileName: String(fileName).slice(0, 200),
          mimeType: String(mimeType || 'application/octet-stream').slice(0, 120),
          fileSize: Number(fileSize || 0),
          uploadedByUid: me.uid,
          uploadedByName: me.fullName,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      res.json({ ok: true, version: resolvedVersion });
    } catch (error) {
      console.error('Document new version failed:', error);
      res.status(500).json({ error: 'No fue posible registrar la nueva versión.' });
    }
  });

  app.patch('/api/documents/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (!doc) {
        res.status(404).json({ error: 'Documento no encontrado.' });
        return;
      }

      const body = req.body || {};
      const requestsApproval =
        typeof body.approvedByPresidente === 'boolean' &&
        body.approvedByPresidente !== doc.approvedByPresidente;
      const requestsPublicVisibility = body.visibility === 'publico' && doc.visibility !== 'publico';

      if ((requestsApproval || requestsPublicVisibility) && !userHasPermission(me, 'documentos.aprobar')) {
        sendPermissionDenied(
          res,
          'documentos.aprobar',
          doc.commissionId || undefined,
          'Solo Presidencia (o un permiso especial aprobado) puede aprobar o hacer público un documento.'
        );
        return;
      }

      const canEditMetadata =
        userHasPermission(me, 'documentos.editar') || doc.uploadedByUid === me.uid;
      if (!canEditMetadata && !requestsApproval && !requestsPublicVisibility) {
        sendPermissionDenied(res, 'documentos.editar', doc.commissionId || undefined);
        return;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.approvedByPresidente === 'boolean') {
        patch.approvedByPresidente = body.approvedByPresidente;
      }
      if (body.visibility === 'publico' || body.visibility === 'privado') {
        patch.visibility = body.visibility;
      }
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 180);
      }
      if (typeof body.folder === 'string' && body.folder.trim()) {
        patch.folder = body.folder.trim().slice(0, 80);
      }
      if (typeof body.category === 'string' && body.category.trim()) {
        patch.category = body.category.trim().slice(0, 60);
      }
      if (typeof body.version === 'string' && body.version.trim()) {
        patch.version = body.version.trim().slice(0, 24);
      }
      if (typeof body.commissionId === 'string') {
        patch.commissionId = body.commissionId.trim();
      }

      await db.update(documents).set(patch).where(eq(documents.id, id));
      if (requestsApproval || requestsPublicVisibility) {
        await logServerAudit(
          me,
          `Aprobó/publicó documento (${body.visibility || doc.visibility})`,
          'Documentos',
          doc.title
        );
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Document update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el documento.' });
    }
  });

  app.delete(
    '/api/documents/:id',
    requireAuth,
    requirePermission('documentos.eliminar'),
    async (req: AuthedRequest, res) => {
      try {
        const id = String(req.params.id);
        await db.delete(documents).where(eq(documents.id, id));
        await logServerAudit(req.authUser!, 'Eliminó documento', 'Documentos', id);
        res.json({ ok: true });
      } catch (error) {
        console.error('Document delete failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar el documento.' });
      }
    }
  );

  app.post(
    '/api/calls-surveys',
    requireAuth,
    requirePermission('encuestas.crear'),
    async (req: AuthedRequest, res) => {
      try {
        const { title, kind, description, deadline, options } = req.body || {};
        if (!title || !description || !deadline) {
          res.status(400).json({ error: 'Completa título, descripción y fecha límite.' });
          return;
        }
        const id = newId('call');
        await db.insert(callsSurveys).values({
          id,
          title: String(title).trim().slice(0, 180),
          kind: kind === 'encuesta' ? 'encuesta' : 'convocatoria',
          description: String(description).trim().slice(0, 1200),
          deadline: String(deadline).trim().slice(0, 40),
          status: 'abierta',
          options: Array.isArray(options) ? options.map(String).slice(0, 10) : [],
          responseCount: 0,
          createdByUid: req.authUser!.uid,
        });
        res.json({ id, ok: true });
      } catch (error) {
        console.error('Call/survey create failed:', error);
        res.status(500).json({ error: 'No fue posible crear la convocatoria.' });
      }
    }
  );

  app.patch(
    '/api/calls-surveys/:id',
    requireAuth,
    requirePermission('encuestas.crear'),
    async (req, res) => {
      try {
        const id = String(req.params.id);
        const body = req.body || {};
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (body.status === 'cerrada' || body.status === 'abierta') patch.status = body.status;
        if (typeof body.title === 'string' && body.title.trim()) {
          patch.title = body.title.trim().slice(0, 180);
        }
        if (body.kind === 'convocatoria' || body.kind === 'encuesta') patch.kind = body.kind;
        if (typeof body.description === 'string') {
          patch.description = body.description.trim().slice(0, 1200);
        }
        if (typeof body.deadline === 'string' && body.deadline.trim()) {
          patch.deadline = body.deadline.trim().slice(0, 40);
        }
        if (Array.isArray(body.options)) {
          patch.options = body.options
            .map((o: unknown) => String(o).trim())
            .filter(Boolean)
            .slice(0, 10);
        }
        await db.update(callsSurveys).set(patch).where(eq(callsSurveys.id, id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Call/survey update failed:', error);
        res.status(500).json({ error: 'No fue posible actualizar.' });
      }
    }
  );

  app.delete(
    '/api/calls-surveys/:id',
    requireAuth,
    requirePermission('encuestas.crear'),
    async (req, res) => {
      try {
        const id = String(req.params.id);
        await db.delete(callsSurveys).where(eq(callsSurveys.id, id));
        await db.delete(surveyResponses).where(eq(surveyResponses.surveyId, id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Call/survey delete failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar.' });
      }
    }
  );

  app.get(
    '/api/survey-responses',
    requireAuth,
    requirePermission('encuestas.ver_respuestas'),
    async (_req, res) => {
      try {
        const rows = await db
          .select()
          .from(surveyResponses)
          .orderBy(desc(surveyResponses.createdAt))
          .limit(200);
        res.json({ responses: rows });
      } catch (error) {
        console.error('Survey responses fetch failed:', error);
        res.status(500).json({ error: 'Error al consultar respuestas.' });
      }
    }
  );

  app.patch(
    '/api/contact-messages/:id',
    requireAuth,
    requirePermission('buzon.responder'),
    async (req, res) => {
      try {
        const id = String(req.params.id);
        const status = ['nuevo', 'en_proceso', 'respondido'].includes(req.body?.status)
          ? req.body.status
          : 'nuevo';
        await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Contact message update failed:', error);
        res.status(500).json({ error: 'No fue posible actualizar el mensaje.' });
      }
    }
  );

  app.delete(
    '/api/contact-messages/:id',
    requireAuth,
    requirePermission('buzon.responder'),
    async (req, res) => {
      try {
        await db.delete(contactMessages).where(eq(contactMessages.id, String(req.params.id)));
        res.json({ ok: true });
      } catch (error) {
        console.error('Contact message delete failed:', error);
        res.status(500).json({ error: 'No fue posible eliminar el mensaje.' });
      }
    }
  );

  app.put(
    '/api/portal-settings',
    requireAuth,
    requirePermission('portal.editar'),
    async (req: AuthedRequest, res) => {
      try {
        const body = req.body || {};
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof body.heroTitle === 'string' && body.heroTitle.trim()) {
          patch.heroTitle = body.heroTitle.trim().slice(0, 160);
        }
        if (typeof body.heroSubtitle === 'string' && body.heroSubtitle.trim()) {
          patch.heroSubtitle = body.heroSubtitle.trim().slice(0, 400);
        }
        if (typeof body.heroImageUrl === 'string' && isSafeUrl(body.heroImageUrl)) {
          patch.heroImageUrl = body.heroImageUrl;
        }
        if (typeof body.heroStoragePath === 'string') {
          patch.heroStoragePath = body.heroStoragePath.slice(0, 512);
        }
        if (typeof body.aboutText === 'string') patch.aboutText = body.aboutText.slice(0, 2000);
        if (typeof body.missionText === 'string') patch.missionText = body.missionText.slice(0, 1000);
        if (typeof body.visionText === 'string') patch.visionText = body.visionText.slice(0, 1000);
        if (typeof body.contactEmail === 'string') patch.contactEmail = body.contactEmail.slice(0, 180);
        if (typeof body.contactAddress === 'string') patch.contactAddress = body.contactAddress.slice(0, 240);
        if (
          ['default', 'san_pedro', 'independencia', 'semana_juventud', 'amor_amistad', 'navidad'].includes(
            body.activeTheme
          )
        ) {
          patch.activeTheme = body.activeTheme;
        }

        await ensureMinimalStructure();
        await db.update(portalSettings).set(patch).where(eq(portalSettings.id, 'site_content'));
        await logServerAudit(
          req.authUser!,
          'Actualizó configuración del portal público',
          'Editor del Portal',
          String(patch.activeTheme || 'Configuración general')
        );
        res.json({ ok: true });
      } catch (error) {
        console.error('Settings update failed:', error);
        res.status(500).json({ error: 'No fue posible guardar la configuración del portal.' });
      }
    }
  );

  app.post('/api/audit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { action, module, targetTitle } = req.body || {};
      const id = newId('audit');
      await db.insert(auditLogs).values({
        id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.fullName,
        actorRoleLabel: req.authUser!.roleLabel,
        action: String(action || '').slice(0, 180),
        module: String(module || '').slice(0, 80),
        targetTitle: String(targetTitle || '').slice(0, 180),
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Audit log insert failed:', error);
      res.status(500).json({ error: 'No fue posible registrar auditoría.' });
    }
  });
}
