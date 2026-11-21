import { UserRole, UserStatus } from '../types/models';

export interface ServerSessionUser {
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName?: string;
}

let memoryCsrfToken = '';

export function setMemoryCsrfToken(token: string) {
  memoryCsrfToken = token;
}

export function getMemoryCsrfToken(): string {
  return memoryCsrfToken;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Error en la comunicación con el servidor.');
  }
  return data;
}

export async function fetchServerSession(): Promise<{
  authenticated: boolean;
  user?: ServerSessionUser;
  csrfToken?: string;
  expired?: boolean;
}> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json();
  if (data.csrfToken) {
    setMemoryCsrfToken(data.csrfToken);
  }
  return data;
}

export async function verifyAdminActivationOnServer(email: string): Promise<{
  allowed: boolean;
  activationToken: string;
}> {
  const res = await fetch('/api/auth/verify-admin-activation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return parseJson(res);
}

export async function verifyInvitationCodeOnServer(invitationCode: string): Promise<{
  valid: boolean;
}> {
  const res = await fetch('/api/auth/verify-invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ invitationCode }),
  });
  return parseJson(res);
}

export async function createServerSessionCookie(
  idToken: string,
  profile: {
    role: UserRole;
    status: UserStatus;
    displayName: string;
  },
): Promise<{
  user: ServerSessionUser;
  csrfToken: string;
}> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken, profile }),
  });
  const data = await parseJson<{ user: ServerSessionUser; csrfToken: string }>(res);
  setMemoryCsrfToken(data.csrfToken);
  return data;
}

export async function clearServerSessionCookie(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getMemoryCsrfToken(),
    },
    credentials: 'include',
  });
  setMemoryCsrfToken('');
}

export async function rotateInvitationCodeOnServer(newCode: string): Promise<{
  encryptedSetting: {
    kind: 'invitation';
    ciphertext: string;
    iv: string;
    tag: string;
    version: number;
  };
}> {
  const res = await fetch('/api/auth/rotate-invitation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getMemoryCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({ newCode }),
  });
  return parseJson(res);
}

export async function submitMailboxValidationOnServer(payload: {
  category: 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd';
  isAnonymous: boolean;
  senderName?: string;
  senderEmail?: string;
  senderNeighborhood?: string;
  subject: string;
  message: string;
  honeypot: string;
}): Promise<{
  trackingCode: string;
  sanitized: {
    trackingCode: string;
    category: 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd';
    isAnonymous: boolean;
    senderName?: string;
    senderEmail?: string;
    senderNeighborhood?: string;
    subject: string;
    message: string;
  };
}> {
  const res = await fetch('/api/public/mailbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function checkLoginRateLimitOnServer(email: string): Promise<void> {
  try {
    const res = await fetch('/api/auth/login-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (res.status === 429) {
      const data = (await res.json()) as { error?: string };
      throw new Error(
        data.error ||
          'Acceso bloqueado temporalmente por seguridad. Intenta nuevamente en unos minutos.',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('bloqueado')) {
      throw err;
    }
  }
}

export async function recordLoginFailureOnServer(email: string): Promise<{
  blocked: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login-failure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    return (await res.json()) as { blocked: boolean; error?: string };
  } catch {
    return { blocked: false };
  }
}

export async function revokeAllSessionsOnServer(): Promise<void> {
  const res = await fetch('/api/auth/revoke-all-sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getMemoryCsrfToken(),
    },
    credentials: 'include',
  });
  await parseJson(res);
  setMemoryCsrfToken('');
}

export interface ServerSecurityEvent {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
  createdAtIso: string;
}

export async function fetchServerSecurityEvents(): Promise<ServerSecurityEvent[]> {
  try {
    const res = await fetch('/api/auth/security-events', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: ServerSecurityEvent[] };
    return data.events || [];
  } catch {
    return [];
  }
}

export async function sendEmailNotificationOnServer(payload: {
  to: string[];
  subject: string;
  text: string;
}): Promise<{ delivered: boolean }> {
  try {
    const res = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getMemoryCsrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { delivered: false };
    return (await res.json()) as { delivered: boolean };
  } catch {
    return { delivered: false };
  }
}
