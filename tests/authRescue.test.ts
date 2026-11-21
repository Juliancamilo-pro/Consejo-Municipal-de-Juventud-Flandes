import http from 'http';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreStore = new Map<string, Record<string, unknown>>();
const auditRecords: Record<string, unknown>[] = [];
const getUserByEmailMock = vi.fn();
const updateUserMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('../server/utils/authHelpers.ts', () => ({
  isAdminCredentialConfigured: () => true,
  getAdminConfigError: () => null,
  getClientIp: (req: { headers?: Record<string, unknown> }) => {
    const fwd = req.headers?.['x-forwarded-for'];
    return typeof fwd === 'string' && fwd.length > 0 ? fwd.split(',')[0].trim() : '198.51.100.10';
  },
  getAdminAuth: () => ({
    getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    getUser: (...args: unknown[]) => getUserMock(...args),
  }),
  getAdminFirestore: () => ({
    collection: (colName: string) => ({
      add: async (data: Record<string, unknown>) => {
        auditRecords.push({ colName, ...data });
        return { id: `audit-${auditRecords.length}` };
      },
      doc: (docId: string) => {
        const key = `${colName}/${docId}`;
        return {
          key,
          get: async () => ({
            exists: firestoreStore.has(key),
            data: () => firestoreStore.get(key),
          }),
          delete: async () => {
            firestoreStore.delete(key);
          },
        };
      },
    }),
    runTransaction: async <T>(
      fn: (tx: {
        get: (ref: { key: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
        set: (ref: { key: string }, data: Record<string, unknown>) => void;
      }) => Promise<T>,
    ) => {
      const tx = {
        get: async (ref: { key: string }) => ({
          exists: firestoreStore.has(ref.key),
          data: () => firestoreStore.get(ref.key),
        }),
        set: (ref: { key: string }, data: Record<string, unknown>) => {
          firestoreStore.set(ref.key, data);
        },
      };
      return fn(tx);
    },
  }),
}));

import { createApp } from '../server/app';

function postJson(
  path: string,
  body: Record<string, unknown>,
  ip = '198.51.100.10',
): Promise<{ status: number; body: Record<string, unknown>; setCookie: string | null }> {
  return new Promise((resolve, reject) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      fetch(`http://127.0.0.1:${addr.port}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify(body),
      })
        .then(async (res) => {
          const json = (await res.json()) as Record<string, unknown>;
          const setCookie = res.headers.get('set-cookie');
          server.close(() => resolve({ status: res.status, body: json, setCookie }));
        })
        .catch((err) => server.close(() => reject(err)));
    });
  });
}

function getJson(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      fetch(`http://127.0.0.1:${addr.port}${path}`)
        .then(async (res) => {
          const json = (await res.json()) as Record<string, unknown>;
          server.close(() => resolve({ status: res.status, body: json }));
        })
        .catch((err) => server.close(() => reject(err)));
    });
  });
}

describe('Rescate del administrador sin código (/api/auth/rescue/clear-admin-mfa)', () => {
  const originalRescueToken = process.env.RESCUE_TOKEN;
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const validToken = 'rescate-cmj-flandes-2026-clave-temporal-segura-32chars';

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreStore.clear();
    auditRecords.length = 0;
    process.env.ADMIN_EMAIL = 'admin@flandes.gov.co';
  });

  afterEach(() => {
    if (originalRescueToken === undefined) delete process.env.RESCUE_TOKEN;
    else process.env.RESCUE_TOKEN = originalRescueToken;
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it('responde 404 si RESCUE_TOKEN falta o es menor a 32 caracteres y /api/health no lo marca como faltante', async () => {
    delete process.env.RESCUE_TOKEN;
    const resMissing = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'admin@flandes.gov.co',
      token: validToken,
    });
    expect(resMissing.status).toBe(404);

    const health = await getJson('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.rescueTokenConfigured).toBe(false);
    expect(health.body.rescueTokenStatus).toBe('opcional (rescate)');
    expect(health.body.missingEnvironmentVariables).not.toContain('RESCUE_TOKEN');

    process.env.RESCUE_TOKEN = 'demasiado-corta-123';
    const resShort = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'admin@flandes.gov.co',
      token: 'demasiado-corta-123',
    });
    expect(resShort.status).toBe(404);
    expect(getUserByEmailMock).not.toHaveBeenCalled();
  });

  it('devuelve el mismo error genérico si el correo no coincide con ADMIN_EMAIL sin revelar si existe', async () => {
    process.env.RESCUE_TOKEN = validToken;
    const wrongEmailRes = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'otro@flandes.gov.co',
      token: validToken,
    });
    const wrongTokenRes = await postJson(
      '/api/auth/rescue/clear-admin-mfa',
      {
        email: 'admin@flandes.gov.co',
        token: 'clave-incorrecta-123',
      },
      '198.51.100.11',
    );

    expect(wrongEmailRes.status).toBe(403);
    expect(wrongTokenRes.status).toBe(403);
    expect(wrongEmailRes.body.error).toBe(wrongTokenRes.body.error);
    expect(getUserByEmailMock).not.toHaveBeenCalled();
  });

  it('bloquea temporalmente tras 5 intentos fallidos persistidos en Firestore', async () => {
    process.env.RESCUE_TOKEN = validToken;

    for (let i = 1; i <= 4; i++) {
      const attempt = await postJson('/api/auth/rescue/clear-admin-mfa', {
        email: 'admin@flandes.gov.co',
        token: `intento-fallido-${i}`,
      });
      expect(attempt.status).toBe(403);
    }

    const fifth = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'admin@flandes.gov.co',
      token: 'intento-fallido-5',
    });
    expect(fifth.status).toBe(429);

    const sixthEvenIfValid = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'admin@flandes.gov.co',
      token: validToken,
    });
    expect(sixthEvenIfValid.status).toBe(429);
    expect(getUserByEmailMock).not.toHaveBeenCalled();
    expect(JSON.stringify(auditRecords)).not.toContain(validToken);
    expect(JSON.stringify(auditRecords)).not.toContain('intento-fallido');
  });

  it('quita los factores heredados con firebase-admin, re-lee al usuario, audita sin token y no crea sesión', async () => {
    process.env.RESCUE_TOKEN = validToken;
    getUserByEmailMock.mockResolvedValueOnce({ uid: 'uid-admin-1', email: 'admin@flandes.gov.co' });
    updateUserMock.mockResolvedValueOnce({ uid: 'uid-admin-1' });
    getUserMock.mockResolvedValueOnce({
      uid: 'uid-admin-1',
      multiFactor: { enrolledFactors: [] },
    });

    const res = await postJson('/api/auth/rescue/clear-admin-mfa', {
      email: 'ADMIN@FLANDES.GOV.CO',
      token: validToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(String(res.body.message)).toContain('Listo, ya puedes entrar con tu correo y contraseña');
    expect(res.setCookie).toBeNull();
    expect(getUserByEmailMock).toHaveBeenCalledWith('admin@flandes.gov.co');
    expect(updateUserMock).toHaveBeenCalledWith('uid-admin-1', {
      multiFactor: { enrolledFactors: null },
    });
    expect(getUserMock).toHaveBeenCalledWith('uid-admin-1');
    expect(auditRecords.some((r) => r.action === 'RESCUE_ADMIN_MFA_SUCCESS')).toBe(true);
    expect(JSON.stringify(auditRecords)).not.toContain(validToken);
  });
});
