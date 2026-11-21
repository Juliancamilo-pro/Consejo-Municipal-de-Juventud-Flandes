import { afterEach, describe, expect, it } from 'vitest';
import { AddressInfo } from 'net';
import http from 'http';
import { createApp } from '../server/app';
import { ServerConfigError, signHmacToken, verifyHmacToken } from '../server/utils/cryptoHelpers';

function requestApp(
  method: string,
  path: string,
  headers?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      fetch(`http://127.0.0.1:${addr.port}${path}`, { method, headers })
        .then(async (res) => {
          const body = (await res.json()) as Record<string, unknown>;
          server.close(() => resolve({ status: res.status, body }));
        })
        .catch((err) => {
          server.close(() => reject(err));
        });
    });
  });
}

describe('Seguridad en producción, errores API y diagnóstico de salud', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;
  const originalSessionSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  });

  it('lanza ServerConfigError en producción si SESSION_SECRET falta o es menor a 32 caracteres', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'corta-123';

    expect(() => signHmacToken({ uid: 'u1' })).toThrow(ServerConfigError);
    expect(() => verifyHmacToken('abc.def')).toThrow(ServerConfigError);

    process.env.SESSION_SECRET = 'clave-institucional-flandes-cmj-2026-super-segura-32';
    const token = signHmacToken({ uid: 'u1' });
    expect(verifyHmacToken<{ uid: string }>(token)?.uid).toBe('u1');
  });

  it('responde 404 JSON para rutas /api inexistentes y 503 JSON ante ServerConfigError', async () => {
    const notFound = await requestApp('GET', '/api/no-existe-esta-ruta');
    expect(notFound.status).toBe(404);
    expect(typeof notFound.body.error).toBe('string');

    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    const configErr = await requestApp('GET', '/api/auth/me', {
      Cookie: 'cmj_session=prueba.firma',
    });
    expect(configErr.status).toBe(503);
    expect(configErr.body.code).toBe('SERVER_CONFIG_ERROR');
  });

  it('valida longitud de SESSION_SECRET en /api/health sin exponer secretos', async () => {
    process.env.SESSION_SECRET = 'corta';
    const resShort = await requestApp('GET', '/api/health');
    expect(resShort.status).toBe(200);
    expect(resShort.body.sessionSecretValid).toBe(false);
    expect(resShort.body.missingEnvironmentVariables).toContain('SESSION_SECRET');

    process.env.SESSION_SECRET = 'secreto-de-prueba-flandes-cmj-2026-valido-32-chars';
    const resOk = await requestApp('GET', '/api/health');
    expect(resOk.status).toBe(200);
    expect(resOk.body.sessionSecretValid).toBe(true);
    expect(JSON.stringify(resOk.body)).not.toContain(process.env.SESSION_SECRET);
  });
});
