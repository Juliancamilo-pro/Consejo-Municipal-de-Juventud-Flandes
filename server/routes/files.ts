import { Router } from 'express';
import { requireActiveAccount, requireAuth } from '../middleware/auth.ts';
import { getAdminStorage, isAdminCredentialConfigured } from '../utils/authHelpers.ts';

const filesRouter = Router();

filesRouter.get('/signed-url', requireAuth, requireActiveAccount, async (req, res) => {
  const storagePath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  const inline = req.query.inline === '1';

  if (!storagePath || !storagePath.startsWith('internal/') || storagePath.includes('..')) {
    res.status(400).json({ error: 'Ruta de archivo interno inválida.' });
    return;
  }

  if (!isAdminCredentialConfigured()) {
    res.status(503).json({
      error:
        'Falta configurar la variable FIREBASE_SERVICE_ACCOUNT en el servidor para generar URLs firmadas de documentos internos.',
    });
    return;
  }

  try {
    const bucket = getAdminStorage();
    const fileRef = bucket.file(storagePath);
    const [exists] = await fileRef.exists();
    if (!exists) {
      res.status(404).json({ error: 'El archivo solicitado no se encuentra en Firebase Storage.' });
      return;
    }

    const fileName = storagePath.split('/').pop() || 'documento';
    const [signedUrl] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000,
      responseDisposition: `${inline ? 'inline' : 'attachment'}; filename="${fileName.replace(/"/g, '')}"`,
    });

    res.json({ url: signedUrl, expiresInSeconds: 600 });
  } catch (err) {
    console.error('Error generando URL firmada en Firebase Storage:', err);
    res.status(500).json({
      error: 'No fue posible generar el enlace temporal seguro para el documento.',
    });
  }
});

export default filesRouter;
