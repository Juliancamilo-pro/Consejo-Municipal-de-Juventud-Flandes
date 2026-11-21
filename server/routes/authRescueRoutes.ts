import { Router } from 'express';
import { getAdminAuth, getClientIp, isAdminCredentialConfigured } from '../utils/authHelpers.ts';
import { constantTimeEqual } from '../utils/cryptoHelpers.ts';
import {
  checkFirestoreRateLimit,
  clearFirestoreRateLimit,
  recordFirestoreRateLimitFailure,
} from '../utils/firestoreRateLimit.ts';
import { recordServerSecurityAudit } from '../utils/serverAudit.ts';
import { maskEmailForAudit } from './authSecurityRoutes.ts';

const MIN_RESCUE_TOKEN_LENGTH = 32;
const MAX_RESCUE_ATTEMPTS = 5;
const RESCUE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_DENIAL_MESSAGE =
  'No fue posible validar la solicitud de rescate. Verifica el correo y la clave de rescate.';

function getActiveRescueToken(): string | null {
  const raw = process.env.RESCUE_TOKEN?.trim() || '';
  return raw.length >= MIN_RESCUE_TOKEN_LENGTH ? raw : null;
}

export function isRescueTokenConfigured(): boolean {
  return getActiveRescueToken() !== null;
}

export function registerAuthRescueRoutes(router: Router): void {
  router.post('/rescue/clear-admin-mfa', async (req, res) => {
    const activeToken = getActiveRescueToken();
    if (!activeToken) {
      res.status(404).json({ error: 'Recurso de API no encontrado.' });
      return;
    }

    if (!isAdminCredentialConfigured()) {
      res.status(503).json({
        error:
          'El servidor aún no tiene configurada la cuenta administrativa para ejecutar el rescate.',
      });
      return;
    }

    const ip = getClientIp(req);
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const submittedToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const maskedEmail = rawEmail ? maskEmailForAudit(rawEmail) : 'sin-correo';

    try {
      const [ipLimit, emailLimit] = await Promise.all([
        checkFirestoreRateLimit('ip', ip, MAX_RESCUE_ATTEMPTS, RESCUE_WINDOW_MS),
        rawEmail
          ? checkFirestoreRateLimit('email', rawEmail, MAX_RESCUE_ATTEMPTS, RESCUE_WINDOW_MS)
          : Promise.resolve({ blocked: false, retryAfterSeconds: 0, remaining: MAX_RESCUE_ATTEMPTS }),
      ]);

      if (ipLimit.blocked || emailLimit.blocked) {
        const retrySec = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
        await recordServerSecurityAudit({
          actorUid: 'sistema_rescate',
          actorEmail: maskedEmail,
          actorRole: 'visitante',
          action: 'RESCUE_ADMIN_MFA_BLOCKED',
          targetCollection: 'users',
          summary: `Bloqueo temporal en rescate de acceso (${maskedEmail}) desde IP ${ip}.`,
        });
        res.status(429).json({
          error: `Demasiados intentos fallidos. Por seguridad, intenta nuevamente en ${Math.max(1, Math.ceil(retrySec / 60))} minutos.`,
        });
        return;
      }

      const adminEmailEnv = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
      const isValidEmail = EMAIL_REGEX.test(rawEmail);
      const emailMatches = Boolean(
        adminEmailEnv && isValidEmail && constantTimeEqual(rawEmail, adminEmailEnv),
      );
      const tokenMatches = Boolean(submittedToken && constantTimeEqual(submittedToken, activeToken));

      if (!emailMatches || !tokenMatches) {
        const [nextIpLimit, nextEmailLimit] = await Promise.all([
          recordFirestoreRateLimitFailure('ip', ip, MAX_RESCUE_ATTEMPTS, RESCUE_WINDOW_MS),
          rawEmail
            ? recordFirestoreRateLimitFailure('email', rawEmail, MAX_RESCUE_ATTEMPTS, RESCUE_WINDOW_MS)
            : Promise.resolve({ blocked: false, retryAfterSeconds: 0, remaining: MAX_RESCUE_ATTEMPTS }),
        ]);

        const nowBlocked = nextIpLimit.blocked || nextEmailLimit.blocked;
        await recordServerSecurityAudit({
          actorUid: 'sistema_rescate',
          actorEmail: maskedEmail,
          actorRole: 'visitante',
          action: nowBlocked ? 'RESCUE_ADMIN_MFA_BLOCKED' : 'RESCUE_ADMIN_MFA_FAILED',
          targetCollection: 'users',
          summary: nowBlocked
            ? `Bloqueo de 15 minutos tras 5 intentos fallidos de rescate (${maskedEmail}) desde IP ${ip}.`
            : `Intento fallido de rescate sin código (${maskedEmail}) desde IP ${ip}.`,
        });

        if (nowBlocked) {
          res.status(429).json({
            error:
              'Demasiados intentos fallidos. Por seguridad, espera 15 minutos antes de intentar nuevamente.',
          });
          return;
        }

        res.status(403).json({ error: GENERIC_DENIAL_MESSAGE });
        return;
      }

      const adminAuth = getAdminAuth();
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(rawEmail);
      } catch (lookupErr) {
        const code =
          lookupErr && typeof lookupErr === 'object' && 'code' in lookupErr
            ? String((lookupErr as { code: unknown }).code)
            : '';
        if (code === 'auth/user-not-found') {
          await recordFirestoreRateLimitFailure('ip', ip, MAX_RESCUE_ATTEMPTS, RESCUE_WINDOW_MS);
          await recordServerSecurityAudit({
            actorUid: 'sistema_rescate',
            actorEmail: maskedEmail,
            actorRole: 'visitante',
            action: 'RESCUE_ADMIN_MFA_FAILED',
            targetCollection: 'users',
            summary: `Solicitud de rescate rechazada sin cuenta coincidente (${maskedEmail}) desde IP ${ip}.`,
          });
          res.status(403).json({ error: GENERIC_DENIAL_MESSAGE });
          return;
        }
        throw lookupErr;
      }

      await adminAuth.updateUser(userRecord.uid, {
        multiFactor: { enrolledFactors: null },
      });

      const verifiedUser = await adminAuth.getUser(userRecord.uid);
      const remainingFactors = verifiedUser.multiFactor?.enrolledFactors ?? [];
      if (remainingFactors.length > 0) {
        await recordServerSecurityAudit({
          actorUid: userRecord.uid,
          actorEmail: maskedEmail,
          actorRole: 'secretario_admin',
          action: 'RESCUE_ADMIN_MFA_FAILED',
          targetCollection: 'users',
          targetId: userRecord.uid,
          summary: `La verificación posterior confirmó factores activos tras intentar limpiarlos (${maskedEmail}).`,
        });
        res.status(500).json({
          error:
            'No fue posible confirmar la eliminación completa de la verificación antigua. Intenta de nuevo.',
        });
        return;
      }

      await Promise.all([
        clearFirestoreRateLimit('ip', ip),
        clearFirestoreRateLimit('email', rawEmail),
      ]);

      await recordServerSecurityAudit({
        actorUid: userRecord.uid,
        actorEmail: maskedEmail,
        actorRole: 'secretario_admin',
        action: 'RESCUE_ADMIN_MFA_SUCCESS',
        targetCollection: 'users',
        targetId: userRecord.uid,
        summary: `Se eliminó la verificación antigua del administrador (${maskedEmail}) mediante rescate seguro desde IP ${ip}.`,
      });

      res.json({
        ok: true,
        message: 'Listo, ya puedes entrar con tu correo y contraseña.',
      });
    } catch (err) {
      console.error('Error ejecutando rescate administrativo:', err);
      res.status(500).json({
        error: 'No se pudo completar el rescate en el servidor. Intenta nuevamente en unos momentos.',
      });
    }
  });
}
