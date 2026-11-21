import { Router } from 'express';
import { requireActiveAccount, requireAuth, requireCsrf } from '../middleware/auth.ts';
import { getAdminFirestore, isAdminCredentialConfigured } from '../utils/authHelpers.ts';

const workspaceLinksRouter = Router();

workspaceLinksRouter.get('/links', requireAuth, requireActiveAccount, async (_req, res) => {
  try {
    if (!isAdminCredentialConfigured()) {
      res.json({ links: [] });
      return;
    }
    const snap = await getAdminFirestore()
      .collection('workspace_links')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const links = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    res.json({ links });
  } catch (err) {
    console.error('Error listando enlaces Workspace:', err);
    res.status(500).json({ error: 'No se pudieron consultar los enlaces de Google Workspace.' });
  }
});

workspaceLinksRouter.post(
  '/links',
  requireAuth,
  requireActiveAccount,
  requireCsrf,
  async (req, res) => {
    try {
      if (!isAdminCredentialConfigured()) {
        res.status(503).json({
          error: 'Configura FIREBASE_SERVICE_ACCOUNT para persistir enlaces desde el servidor.',
        });
        return;
      }

      const actor = req.sessionUser!;
      const rawType = req.body?.resourceType;
      const resourceType =
        rawType === 'calendar_event' ? 'calendar_event' : rawType === 'sheet' ? 'sheet' : 'doc';
      const externalId =
        typeof req.body?.externalId === 'string' ? req.body.externalId.trim().slice(0, 255) : '';
      const title =
        typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 240) : '';
      const url = typeof req.body?.url === 'string' ? req.body.url.trim().slice(0, 600) : '';
      const folderTag =
        typeof req.body?.folderTag === 'string' ? req.body.folderTag.trim().slice(0, 40) : undefined;
      const notes =
        typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) : undefined;

      if (!externalId || !title || !url.startsWith('https://')) {
        res.status(400).json({
          error: 'Se requiere identificador, título y URL HTTPS válida de Google Workspace.',
        });
        return;
      }

      const payload = {
        resourceType,
        externalId,
        title,
        url,
        ...(folderTag ? { folderTag } : {}),
        ...(notes ? { notes } : {}),
        linkedByUid: actor.uid,
        linkedByName: actor.displayName || actor.email,
        createdAt: new Date().toISOString(),
      };
      const ref = await getAdminFirestore().collection('workspace_links').add(payload);
      res.status(201).json({ link: { id: ref.id, ...payload } });
    } catch (err) {
      console.error('Error guardando enlace Workspace:', err);
      res.status(500).json({ error: 'No se pudo registrar el enlace en Firestore.' });
    }
  },
);

workspaceLinksRouter.delete(
  '/links/:id',
  requireAuth,
  requireActiveAccount,
  requireCsrf,
  async (req, res) => {
    try {
      if (!isAdminCredentialConfigured()) {
        res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT no configurado.' });
        return;
      }
      const id = String(req.params.id || '').trim();
      if (!id || id.includes('/')) {
        res.status(400).json({ error: 'Identificador inválido.' });
        return;
      }
      await getAdminFirestore().collection('workspace_links').doc(id).delete();
      res.json({ ok: true });
    } catch (err) {
      console.error('Error eliminando enlace Workspace:', err);
      res.status(500).json({ error: 'No se pudo eliminar el enlace.' });
    }
  },
);

export default workspaceLinksRouter;
