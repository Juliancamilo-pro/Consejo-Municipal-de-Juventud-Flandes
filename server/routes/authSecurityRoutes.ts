import crypto from 'crypto';
import { Router } from 'express';
import { getClientIp } from '../utils/authHelpers.ts';
import {
  constantTimeEqual,
  decryptInvitationPayload,
  signHmacToken,
  verifyInvitationHash,
} from '../utils/cryptoHelpers.ts';
import { fetchFirestoreDocViaRest } from '../utils/firestoreRest.ts';
import { clearRateLimit, getRateLimitStatus, recordRateLimitFailure } from '../utils/rateLimiter.ts';
import { recordServerSecurityAudit } from '../utils/serverAudit.ts';

export function hashEmailKey(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
}

export function maskEmailForAudit(email: string): string {
  const clean = email.trim().toLowerCase();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return 'correo-no-valido';
  return `${local.slice(0, 2)}***@${domain}`;
}

export function registerAuthSecurityRoutes(router: Router): void {
  router.get('/bootstrap-status', async (_req, res) => {
    const bootstrapDoc = await fetchFirestoreDocViaRest('settings/bootstrap');
    res.json({
      adminActivated: Boolean(bootstrapDoc?.adminActivated),
      adminConfigured: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().length > 3),
      invitationConfigured: Boolean(
        process.env.CMJ_INVITATION_CODE && process.env.CMJ_INVITATION_CODE.trim().length >= 4,
      ),
    });
  });

  router.post('/login-check', (req, res) => {
    const ip = getClientIp(req);
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const ipStatus = getRateLimitStatus('login_ip', ip, 10);
    const emailStatus = rawEmail
      ? getRateLimitStatus('login_email', hashEmailKey(rawEmail), 5)
      : { blocked: false, retryAfterSeconds: 0, remaining: 5 };

    if (ipStatus.blocked || emailStatus.blocked) {
      const retrySec = Math.max(ipStatus.retryAfterSeconds, emailStatus.retryAfterSeconds);
      res.status(429).json({
        blocked: true,
        retryAfterSeconds: retrySec,
        error: `Acceso bloqueado temporalmente por seguridad. Intenta nuevamente en ${Math.max(1, Math.ceil(retrySec / 60))} minutos.`,
      });
      return;
    }
    res.json({ blocked: false });
  });

  router.post('/login-failure', async (req, res) => {
    const ip = getClientIp(req);
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const ipRes = recordRateLimitFailure('login_ip', ip, 10);
    const emailRes = rawEmail ? recordRateLimitFailure('login_email', hashEmailKey(rawEmail), 5) : null;
    const blocked = ipRes.blocked || Boolean(emailRes?.blocked);
    const masked = rawEmail ? maskEmailForAudit(rawEmail) : 'sin-correo';

    await recordServerSecurityAudit({
      actorUid: 'sistema_seguridad',
      actorEmail: masked,
      actorRole: 'visitante',
      action: blocked ? 'LOGIN_BLOCKED' : 'LOGIN_FAILED',
      targetCollection: 'users',
      summary: blocked
        ? `Bloqueo temporal de acceso (15 min) por múltiples intentos fallidos desde IP ${ip} (${masked}).`
        : `Intento fallido de inicio de sesión registrado (${masked}) desde IP ${ip}.`,
    });

    if (blocked) {
      const retrySec = Math.max(ipRes.retryAfterSeconds, emailRes?.retryAfterSeconds || 0);
      res.status(429).json({
        blocked: true,
        retryAfterSeconds: retrySec,
        error: `Demasiados intentos fallidos. Por seguridad, espera ${Math.max(1, Math.ceil(retrySec / 60))} minutos antes de intentar nuevamente.`,
      });
      return;
    }

    res.json({
      blocked: false,
      error: 'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
    });
  });

  router.post('/verify-admin-activation', async (req, res, next) => {
    try {
      const ip = getClientIp(req);
      const limitStatus = getRateLimitStatus('admin_activation', ip);
      if (limitStatus.blocked) {
        res.status(429).json({
          error: `Demasiados intentos fallidos. Intenta nuevamente en ${Math.ceil(limitStatus.retryAfterSeconds / 60)} minutos.`,
        });
        return;
      }

      const bootstrapDoc = await fetchFirestoreDocViaRest('settings/bootstrap');
      if (bootstrapDoc?.adminActivated) {
        res.status(403).json({
          error: 'La activación inicial del administrador ya fue completada y está deshabilitada.',
        });
        return;
      }

      const adminEmailEnv = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!adminEmailEnv) {
        res.status(503).json({ error: 'El secreto ADMIN_EMAIL no está configurado en el servidor.' });
        return;
      }

      const submittedEmail =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!submittedEmail || !constantTimeEqual(submittedEmail, adminEmailEnv)) {
        recordRateLimitFailure('admin_activation', ip);
        res.status(403).json({ error: 'El correo ingresado no corresponde al administrador autorizado.' });
        return;
      }

      clearRateLimit('admin_activation', ip);
      const activationToken = signHmacToken({
        email: submittedEmail,
        purpose: 'admin_activation',
        exp: Date.now() + 10 * 60 * 1000,
      });
      res.json({ allowed: true, activationToken });
    } catch (err) {
      next(err);
    }
  });

  router.post('/verify-invitation', async (req, res, next) => {
    try {
      const ip = getClientIp(req);
      const limitStatus = getRateLimitStatus('invitation_code', ip);
      if (limitStatus.blocked) {
        res.status(429).json({
          error: `Bloqueo temporal por seguridad. Intenta nuevamente en ${Math.ceil(limitStatus.retryAfterSeconds / 60)} minutos.`,
        });
        return;
      }

      const submittedCode =
        typeof req.body?.invitationCode === 'string' ? req.body.invitationCode.trim() : '';
      if (!submittedCode) {
        recordRateLimitFailure('invitation_code', ip);
        res.status(400).json({ error: 'Debes ingresar el código de invitación.' });
        return;
      }

      const rotatedDoc = await fetchFirestoreDocViaRest('settings/invitation');
      let isValid = false;

      if (
        rotatedDoc &&
        typeof rotatedDoc.ciphertext === 'string' &&
        typeof rotatedDoc.iv === 'string' &&
        typeof rotatedDoc.tag === 'string'
      ) {
        const decrypted = decryptInvitationPayload({
          ciphertext: rotatedDoc.ciphertext,
          iv: rotatedDoc.iv,
          tag: rotatedDoc.tag,
        });
        if (decrypted) isValid = verifyInvitationHash(submittedCode, decrypted.salt, decrypted.hashHex);
      } else {
        const envCode = process.env.CMJ_INVITATION_CODE?.trim();
        if (!envCode) {
          res.status(503).json({
            error: 'El código de invitación CMJ_INVITATION_CODE no está configurado en el servidor.',
          });
          return;
        }
        isValid = constantTimeEqual(submittedCode, envCode);
      }

      if (!isValid) {
        const nextLimit = recordRateLimitFailure('invitation_code', ip);
        res.status(403).json({
          error: nextLimit.blocked
            ? 'Has superado los 5 intentos permitidos. Cuenta bloqueada por 15 minutos.'
            : `Código de invitación incorrecto. Te quedan ${nextLimit.remaining} intentos.`,
        });
        return;
      }

      clearRateLimit('invitation_code', ip);
      res.json({ valid: true });
    } catch (err) {
      next(err);
    }
  });
}
