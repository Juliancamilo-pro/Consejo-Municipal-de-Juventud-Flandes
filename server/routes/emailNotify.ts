import { Router } from 'express';
import {
  requireActiveAccount,
  requireAuth,
  requireCsrf,
  requireRoles,
} from '../middleware/auth.ts';
import { sendConfigurableEmail } from '../utils/emailNotifier.ts';

const router = Router();

router.post(
  '/email',
  requireAuth,
  requireActiveAccount,
  requireRoles(['secretario_admin', 'presidente', 'vicepresidente', 'lider_comision']),
  requireCsrf,
  async (req, res) => {
    const body = req.body as { to?: unknown; subject?: unknown; text?: unknown };
    const to = Array.isArray(body.to) ? body.to.filter((v): v is string => typeof v === 'string') : [];
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!subject || !text || to.length === 0) {
      res.status(400).json({ error: 'Destinatarios, asunto y mensaje son obligatorios.' });
      return;
    }

    const result = await sendConfigurableEmail({ to, subject, text });
    res.json(result);
  },
);

export default router;
