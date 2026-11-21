import { NextFunction, Request, Response } from 'express';
import { constantTimeEqual, signHmacToken, verifyHmacToken } from '../utils/cryptoHelpers.ts';

export const SESSION_COOKIE_NAME = 'cmj_session';
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const revokedBeforeByUid = new Map<string, number>();

export function markUserSessionsRevoked(uid: string, timestamp = Date.now()): void {
  revokedBeforeByUid.set(uid, timestamp);
}

export function isUserSessionRevoked(uid: string, issuedAt: number): boolean {
  const cutoff = revokedBeforeByUid.get(uid);
  return typeof cutoff === 'number' && issuedAt < cutoff;
}

export interface SessionPayload {
  uid: string;
  email: string;
  role: string;
  status: string;
  displayName?: string;
  csrfToken: string;
  issuedAt: number;
  lastActivityAt: number;
}

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionPayload;
    }
  }
}

function resolveCookieSecurity(req: Request): { secure: boolean; sameSite: 'lax' | 'none' } {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const isCrossSiteFrame = req.headers['sec-fetch-site'] === 'cross-site';
  const sameSite: 'lax' | 'none' = isHttps && isCrossSiteFrame ? 'none' : 'lax';
  return { secure: isHttps, sameSite };
}

export function setSessionCookie(res: Response, req: Request, payload: SessionPayload): void {
  const token = signHmacToken(payload);
  const { secure, sameSite } = resolveCookieSecurity(req);

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: INACTIVITY_TIMEOUT_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, req: Request): void {
  const { secure, sameSite } = resolveCookieSecurity(req);

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!raw) {
    res.status(401).json({ error: 'Sesión requerida.' });
    return;
  }

  const parsed = verifyHmacToken<SessionPayload>(raw);
  if (!parsed || isUserSessionRevoked(parsed.uid, parsed.issuedAt)) {
    clearSessionCookie(res, req);
    res.status(401).json({ error: 'Sesión inválida o revocada.' });
    return;
  }

  const now = Date.now();
  if (now - parsed.lastActivityAt > INACTIVITY_TIMEOUT_MS) {
    clearSessionCookie(res, req);
    res.status(401).json({ error: 'Sesión cerrada por inactividad.', expired: true });
    return;
  }

  const refreshed: SessionPayload = {
    ...parsed,
    lastActivityAt: now,
  };
  setSessionCookie(res, req, refreshed);
  req.sessionUser = refreshed;
  next();
}

export function requireActiveAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.sessionUser) {
    res.status(401).json({ error: 'Sesión requerida.' });
    return;
  }
  if (req.sessionUser.status !== 'activo') {
    res.status(403).json({
      error:
        req.sessionUser.status === 'pendiente'
          ? 'Tu cuenta aún está en revisión por la Mesa Directiva.'
          : 'Tu cuenta se encuentra suspendida.',
    });
    return;
  }
  next();
}

export function requireRoles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.sessionUser || req.sessionUser.status !== 'activo') {
      res.status(403).json({ error: 'Acceso denegado.' });
      return;
    }
    if (!allowedRoles.includes(req.sessionUser.role)) {
      res.status(403).json({ error: 'No cuentas con permisos para esta acción.' });
      return;
    }
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (!req.sessionUser) {
    res.status(401).json({ error: 'Sesión requerida.' });
    return;
  }
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !constantTimeEqual(headerToken, req.sessionUser.csrfToken)) {
    res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
    return;
  }
  next();
}
