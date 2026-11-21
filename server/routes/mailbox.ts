import { Router } from 'express';
import { generateTrackingCode } from '../utils/cryptoHelpers.ts';
import { getRateLimitStatus, recordRateLimitFailure } from '../utils/rateLimiter.ts';

const mailboxRouter = Router();

const VALID_CATEGORIES = ['propuesta', 'inquietud', 'denuncia', 'pqrsd'] as const;

function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

mailboxRouter.post('/mailbox', (req, res) => {
  const ip = getClientIp(req);
  const limitStatus = getRateLimitStatus('mailbox_submit', ip, 5, 15 * 60 * 1000);
  if (limitStatus.blocked) {
    res.status(429).json({
      error: `Has alcanzado el límite temporal de radicaciones. Intenta de nuevo en ${Math.ceil(limitStatus.retryAfterSeconds / 60)} minutos.`,
    });
    return;
  }

  const honeypot = typeof req.body?.honeypot === 'string' ? req.body.honeypot.trim() : '';
  if (honeypot.length > 0) {
    recordRateLimitFailure('mailbox_submit', ip, 5, 15 * 60 * 1000);
    res.status(400).json({ error: 'Validación anti-spam fallida.' });
    return;
  }

  const category = req.body?.category;
  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: 'Categoría inválida.' });
    return;
  }

  const isAnonymous = Boolean(req.body?.isAnonymous);
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (subject.length < 4 || subject.length > 180) {
    res.status(400).json({ error: 'El asunto debe tener entre 4 y 180 caracteres.' });
    return;
  }
  if (message.length < 10 || message.length > 4000) {
    res.status(400).json({ error: 'El mensaje debe tener entre 10 y 4000 caracteres.' });
    return;
  }

  const senderName =
    !isAnonymous && typeof req.body?.senderName === 'string'
      ? req.body.senderName.trim().slice(0, 120)
      : undefined;
  const senderEmail =
    !isAnonymous && typeof req.body?.senderEmail === 'string'
      ? req.body.senderEmail.trim().slice(0, 160)
      : undefined;
  const senderNeighborhood =
    typeof req.body?.senderNeighborhood === 'string'
      ? req.body.senderNeighborhood.trim().slice(0, 120)
      : undefined;

  if (!isAnonymous && (!senderName || senderName.length < 2)) {
    res.status(400).json({
      error: 'Si la radicación no es anónima, debes indicar tu nombre completo.',
    });
    return;
  }

  if (senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    res.status(400).json({ error: 'El correo electrónico ingresado no es válido.' });
    return;
  }

  recordRateLimitFailure('mailbox_submit', ip, 5, 15 * 60 * 1000);
  const trackingCode = generateTrackingCode();

  res.json({
    trackingCode,
    sanitized: {
      trackingCode,
      category,
      isAnonymous,
      ...(senderName ? { senderName } : {}),
      ...(senderEmail ? { senderEmail } : {}),
      ...(senderNeighborhood ? { senderNeighborhood } : {}),
      subject,
      message,
    },
  });
});

export default mailboxRouter;
