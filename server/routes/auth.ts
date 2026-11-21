import crypto from 'crypto';
import { Router } from 'express';
import {
  clearSessionCookie,
  INACTIVITY_TIMEOUT_MS,
  isUserSessionRevoked,
  markUserSessionsRevoked,
  requireAuth,
  requireCsrf,
  requireRoles,
  SESSION_COOKIE_NAME,
  SessionPayload,
  setSessionCookie,
} from '../middleware/auth.ts';
import { getAdminAuth, getClientIp, isAdminCredentialConfigured } from '../utils/authHelpers.ts';
import {
  constantTimeEqual,
  encryptInvitationPayload,
  hashInvitationCode,
  verifyHmacToken,
} from '../utils/cryptoHelpers.ts';
import { fetchFirestoreDocViaRest } from '../utils/firestoreRest.ts';
import { clearRateLimit } from '../utils/rateLimiter.ts';
import { getRecentServerSecurityEvents, recordServerSecurityAudit } from '../utils/serverAudit.ts';
import { registerAuthRescueRoutes } from './authRescueRoutes.ts';
import { hashEmailKey, registerAuthSecurityRoutes } from './authSecurityRoutes.ts';

const authRouter = Router();
registerAuthSecurityRoutes(authRouter);
registerAuthRescueRoutes(authRouter);

authRouter.post('/session', async (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) {
    res.status(400).json({ error: 'Token de autenticación requerido.' });
    return;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();
    const authTimeMs = typeof decoded.auth_time === 'number' ? decoded.auth_time * 1000 : Date.now();
    if (isUserSessionRevoked(uid, authTimeMs)) {
      res.status(401).json({ error: 'Tu sesión fue revocada. Inicia sesión nuevamente.' });
      return;
    }

    const userDoc = await fetchFirestoreDocViaRest(`users/${uid}`, idToken);
    const role = typeof userDoc?.role === 'string' ? userDoc.role : 'consejero';
    const status = typeof userDoc?.status === 'string' ? userDoc.status : 'pendiente';
    const displayName =
      typeof userDoc?.displayName === 'string'
        ? userDoc.displayName
        : typeof req.body?.profile?.displayName === 'string'
          ? req.body.profile.displayName
          : email;

    const adminEmailEnv = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (role === 'secretario_admin') {
      if (!adminEmailEnv) {
        res.status(503).json({
          error:
            'Falta configurar la variable de entorno ADMIN_EMAIL en el servidor para autorizar al Secretario Administrador.',
        });
        return;
      }
      if (!constantTimeEqual(email, adminEmailEnv)) {
        res.status(403).json({ error: 'Rol de administrador no autorizado para este correo.' });
        return;
      }
    }
    if (status === 'suspendido') {
      clearSessionCookie(res, req);
      res.status(403).json({ error: 'Esta cuenta se encuentra suspendida.' });
      return;
    }

    clearRateLimit('login_ip', getClientIp(req));
    if (email) clearRateLimit('login_email', hashEmailKey(email));

    const csrfToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const sessionPayload: SessionPayload = {
      uid,
      email,
      role,
      status,
      displayName,
      csrfToken,
      issuedAt: now,
      lastActivityAt: now,
    };
    setSessionCookie(res, req, sessionPayload);

    if (isAdminCredentialConfigured()) {
      await getAdminAuth().setCustomUserClaims(uid, { role, status }).catch(() => undefined);
    }
    res.json({ user: { uid, email, role, status, displayName }, csrfToken });
  } catch (error) {
    console.error('Error verificando ID Token:', error);
    res.status(401).json({ error: 'Token de Firebase inválido o expirado.' });
  }
});

authRouter.get('/me', (req, res) => {
  const raw = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!raw) {
    res.json({ authenticated: false });
    return;
  }
  const parsed = verifyHmacToken<SessionPayload>(raw);
  if (!parsed || isUserSessionRevoked(parsed.uid, parsed.issuedAt)) {
    clearSessionCookie(res, req);
    res.json({ authenticated: false });
    return;
  }
  const now = Date.now();
  if (now - parsed.lastActivityAt > INACTIVITY_TIMEOUT_MS) {
    clearSessionCookie(res, req);
    res.json({ authenticated: false, expired: true });
    return;
  }

  const refreshed: SessionPayload = { ...parsed, lastActivityAt: now };
  setSessionCookie(res, req, refreshed);
  res.json({
    authenticated: true,
    user: {
      uid: refreshed.uid,
      email: refreshed.email,
      role: refreshed.role,
      status: refreshed.status,
      displayName: refreshed.displayName,
    },
    csrfToken: refreshed.csrfToken,
  });
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

authRouter.post('/revoke-all-sessions', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const user = req.sessionUser!;
    markUserSessionsRevoked(user.uid);
    if (isAdminCredentialConfigured()) {
      await getAdminAuth().revokeRefreshTokens(user.uid).catch(() => undefined);
    }
    await recordServerSecurityAudit({
      actorUid: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'SESSIONS_REVOKED',
      targetCollection: 'users',
      targetId: user.uid,
      summary: 'Cierre de sesión en todos los dispositivos solicitado por el usuario.',
    });
    clearSessionCookie(res, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get(
  '/security-events',
  requireAuth,
  requireRoles(['secretario_admin', 'presidente', 'vicepresidente']),
  (_req, res) => {
    res.json({ events: getRecentServerSecurityEvents() });
  },
);

authRouter.post(
  '/rotate-invitation',
  requireAuth,
  requireRoles(['secretario_admin']),
  requireCsrf,
  async (req, res, next) => {
    try {
      const newCode = typeof req.body?.newCode === 'string' ? req.body.newCode.trim() : '';
      if (newCode.length < 8 || newCode.length > 64) {
        res.status(400).json({ error: 'El nuevo código de invitación debe tener entre 8 y 64 caracteres.' });
        return;
      }
      const existingDoc = await fetchFirestoreDocViaRest('settings/invitation');
      const nextVersion = typeof existingDoc?.version === 'number' ? existingDoc.version + 1 : 1;
      const { salt, hashHex } = hashInvitationCode(newCode);
      const encrypted = encryptInvitationPayload({ salt, hashHex, version: nextVersion });
      res.json({
        encryptedSetting: {
          kind: 'invitation',
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          version: nextVersion,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default authRouter;
