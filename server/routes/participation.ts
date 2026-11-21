import { Request, Response, Router } from 'express';
import { SESSION_COOKIE_NAME, SessionPayload } from '../middleware/auth.ts';
import { getAdminFirestore, isAdminCredentialConfigured } from '../utils/authHelpers.ts';
import { verifyHmacToken } from '../utils/cryptoHelpers.ts';
import { sendConfigurableEmail } from '../utils/emailNotifier.ts';
import {
  buildUpdatedPollTally,
  computePollVoterFingerprint,
  sanitizePlainText,
} from '../utils/participationHelpers.ts';

export { computePollVoterFingerprint, sanitizePlainText };

const router = Router();
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkPublicRateLimit(key: string, maxRequests = 15): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

function getOptionalSessionUser(req: Request): SessionPayload | null {
  try {
    const raw = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!raw) return null;
    return verifyHmacToken<SessionPayload>(raw);
  } catch {
    return null;
  }
}

router.post('/polls/validate-vote', (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  const ua = String(req.headers['user-agent'] || '');
  if (!checkPublicRateLimit(`poll:${ip}`, 20)) {
    res.status(429).json({
      error: 'Demasiadas participaciones desde esta red. Intenta de nuevo en unos minutos.',
    });
    return;
  }

  const body = (req.body || {}) as {
    pollId?: string;
    optionId?: string;
    answers?: Record<string, unknown>;
    deviceToken?: string;
    honeypot?: string;
  };
  if (body.honeypot && body.honeypot.trim().length > 0) {
    res.status(400).json({ error: 'Solicitud rechazada por validación anti-spam.' });
    return;
  }

  const pollId = sanitizePlainText(body.pollId || '', 80);
  const optionId = sanitizePlainText(body.optionId || '', 80);
  if (!pollId || (!optionId && !body.answers)) {
    res.status(400).json({ error: 'Encuesta o respuesta no válida.' });
    return;
  }

  const sessionUser = getOptionalSessionUser(req);
  const voterFingerprint = computePollVoterFingerprint({
    pollId,
    ip,
    userAgent: ua,
    sessionUid: sessionUser?.uid,
    deviceToken: typeof body.deviceToken === 'string' ? body.deviceToken : undefined,
  });

  res.status(200).json({ ok: true, pollId, optionId, voterFingerprint });
});

router.post('/polls/submit-vote', async (req: Request, res: Response, next) => {
  try {
    const ip = req.ip || 'unknown';
    const ua = String(req.headers['user-agent'] || '');
    if (!checkPublicRateLimit(`poll:${ip}`, 20)) {
      res.status(429).json({
        error: 'Demasiadas participaciones desde esta red. Intenta de nuevo en unos minutos.',
      });
      return;
    }

    const body = (req.body || {}) as {
      pollId?: string;
      answers?: Record<string, unknown>;
      deviceToken?: string;
      honeypot?: string;
    };

    if (body.honeypot && body.honeypot.trim().length > 0) {
      res.status(400).json({ error: 'Solicitud rechazada por validación anti-spam.' });
      return;
    }

    const pollId = sanitizePlainText(body.pollId || '', 80);
    if (!pollId || !body.answers || typeof body.answers !== 'object') {
      res.status(400).json({ error: 'Debes completar las respuestas de la encuesta.' });
      return;
    }

    const sessionUser = getOptionalSessionUser(req);
    const voterFingerprint = computePollVoterFingerprint({
      pollId,
      ip,
      userAgent: ua,
      sessionUid: sessionUser?.uid,
      deviceToken: typeof body.deviceToken === 'string' ? body.deviceToken : undefined,
    });

    const sanitizedAnswers: Record<string, string | string[]> = {};
    for (const [qId, rawVal] of Object.entries(body.answers).slice(0, 25)) {
      const cleanQ = sanitizePlainText(qId, 80);
      if (!cleanQ) continue;
      if (Array.isArray(rawVal)) {
        sanitizedAnswers[cleanQ] = rawVal
          .map((v) => sanitizePlainText(String(v), 80))
          .filter(Boolean)
          .slice(0, 10);
      } else if (rawVal !== undefined && rawVal !== null) {
        sanitizedAnswers[cleanQ] = sanitizePlainText(String(rawVal), 300);
      }
    }

    if (!isAdminCredentialConfigured()) {
      res.status(200).json({
        ok: true,
        serverPersisted: false,
        voterFingerprint,
        sanitizedAnswers,
      });
      return;
    }

    const db = getAdminFirestore();
    const pollRef = db.collection('public_polls').doc(pollId);
    const voteRef = pollRef.collection('votes').doc(voterFingerprint);

    await db.runTransaction(async (tx) => {
      const [pollSnap, voteSnap] = await Promise.all([tx.get(pollRef), tx.get(voteRef)]);
      if (!pollSnap.exists) {
        throw Object.assign(new Error('La encuesta ya no está disponible.'), { statusCode: 404 });
      }
      const data = pollSnap.data() || {};
      if (data.status !== 'abierta') {
        throw Object.assign(new Error('Esta consulta ya no se encuentra abierta.'), { statusCode: 400 });
      }
      if (data.audience === 'consejeros' && (!sessionUser || sessionUser.status !== 'activo')) {
        throw Object.assign(new Error('Esta consulta es exclusiva para consejeros activos.'), { statusCode: 403 });
      }
      if (voteSnap.exists) {
        throw Object.assign(new Error('Ya registramos tu participación en esta encuesta.'), { statusCode: 409 });
      }

      const { voteReceipt, pollUpdate } = buildUpdatedPollTally(data, sanitizedAnswers);
      tx.set(voteRef, { ...voteReceipt, voterFingerprint });
      tx.update(pollRef, pollUpdate);
    });

    res.status(200).json({ ok: true, serverPersisted: true, voterFingerprint });
  } catch (err) {
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: unknown }).statusCode)
        : 0;
    if (statusCode >= 400 && statusCode < 500 && err instanceof Error) {
      res.status(statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

router.post('/calls/validate-registration', async (req: Request, res: Response, next) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkPublicRateLimit(`call:${ip}`, 10)) {
      res.status(429).json({
        error: 'Has realizado demasiadas inscripciones recientes. Espera unos minutos.',
      });
      return;
    }

    const body = (req.body || {}) as {
      callId?: string;
      callTitle?: string;
      fullName?: string;
      age?: number;
      neighborhood?: string;
      email?: string;
      phone?: string;
      notes?: string;
      extraAnswers?: Record<string, string>;
      honeypot?: string;
    };

    if (body.honeypot && body.honeypot.trim().length > 0) {
      res.status(400).json({ error: 'Solicitud rechazada por validación anti-spam.' });
      return;
    }

    const callId = sanitizePlainText(body.callId || '', 80);
    const callTitle = sanitizePlainText(body.callTitle || '', 180);
    const fullName = sanitizePlainText(body.fullName || '', 120);
    const neighborhood = sanitizePlainText(body.neighborhood || '', 120);
    const email = sanitizePlainText(body.email || '', 160).toLowerCase();
    const phone = sanitizePlainText(body.phone || '', 30);
    const notes = sanitizePlainText(body.notes || '', 600);
    const age = Number(body.age);

    if (!callId || fullName.length < 3 || neighborhood.length < 2) {
      res.status(400).json({ error: 'Completa nombre completo y barrio o vereda de Flandes.' });
      return;
    }
    if (!Number.isFinite(age) || age < 10 || age > 99) {
      res.status(400).json({ error: 'Ingresa una edad válida.' });
      return;
    }
    if (!email.includes('@') || email.length < 5) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
      return;
    }

    const extraAnswers: Record<string, string> = {};
    if (body.extraAnswers && typeof body.extraAnswers === 'object') {
      for (const [k, v] of Object.entries(body.extraAnswers).slice(0, 12)) {
        const cleanK = sanitizePlainText(k, 80);
        const cleanV = sanitizePlainText(String(v || ''), 240);
        if (cleanK && cleanV) extraAnswers[cleanK] = cleanV;
      }
    }

    const emailResult = await sendConfigurableEmail({
      to: [email],
      subject: `Confirmación de inscripción CMJ Flandes · ${callTitle || 'Convocatoria'}`,
      text: `Hola ${fullName},\n\nTu inscripción a "${callTitle || 'Convocatoria juvenil'}" en Flandes, Tolima quedó registrada.\nBarrio/Vereda: ${neighborhood}\n\nConsejo Municipal de Juventud de Flandes (2026–2029).`,
    }).catch(() => ({ delivered: false }));

    res.status(200).json({
      ok: true,
      emailDelivered: emailResult.delivered,
      sanitized: {
        callId,
        callTitle,
        fullName,
        age,
        neighborhood,
        email,
        ...(phone ? { phone } : {}),
        ...(notes ? { notes } : {}),
        ...(Object.keys(extraAnswers).length > 0 ? { extraAnswers } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
