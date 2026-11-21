import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRateLimit,
  getRateLimitStatus,
  recordRateLimitFailure,
} from '../server/utils/rateLimiter';
import { evaluatePasswordStrength } from '../src/utils/passwordStrength';

const signInMock = vi.fn();
const getMultiFactorResolverMock = vi.fn();
const unenrollMock = vi.fn();
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  createUserWithEmailAndPassword: vi.fn(),
  getMultiFactorResolver: (...args: unknown[]) => getMultiFactorResolverMock(...args),
  multiFactor: () => ({
    enrolledFactors: [{ uid: 'factor-1', factorId: 'totp' }],
    unenroll: unenrollMock,
  }),
  PhoneAuthProvider: { credential: vi.fn() },
  PhoneMultiFactorGenerator: { FACTOR_ID: 'phone', assertion: vi.fn() },
  RecaptchaVerifier: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: (...args: unknown[]) => signInMock(...args),
  signOut: vi.fn(),
  TotpMultiFactorGenerator: { FACTOR_ID: 'totp', assertionForSignIn: vi.fn(() => 'totp-assertion') },
  updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ col, id })),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({
      uid: 'uid-admin',
      email: 'admin@flandes.gov.co',
      displayName: 'Secretario Administrador',
      role: 'secretario_admin',
      status: 'activo',
    }),
  })),
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../src/services/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('../src/services/sessionApi', () => ({
  checkLoginRateLimitOnServer: vi.fn(async () => undefined),
  createServerSessionCookie: vi.fn(async () => undefined),
  recordLoginFailureOnServer: vi.fn(async () => ({
    blocked: false,
    error: 'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
  })),
  verifyAdminActivationOnServer: vi.fn(),
  verifyInvitationCodeOnServer: vi.fn(),
}));

import {
  completeLoginAndRemoveLegacySecondFactor,
  LegacySecondFactorError,
  performLogin,
} from '../src/services/authActions';

describe('Validación de contraseñas y bloqueo contra fuerza bruta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimit('login_email', 'test-key');
  });

  it('rechaza contraseñas cortas, comunes o que contengan nombre o correo del usuario', () => {
    expect(evaluatePasswordStrength('Abc12345').valid).toBe(false);
    expect(evaluatePasswordStrength('Flandes2026!').valid).toBe(false);
    expect(
      evaluatePasswordStrength('MariaJose2026!', {
        displayName: 'María José Peña',
        email: 'consejera@flandes.gov.co',
      }).valid,
    ).toBe(false);
    expect(
      evaluatePasswordStrength('Cruiz#202699', {
        displayName: 'Carlos Ruiz',
        email: 'cruiz@ejemplo.com',
      }).valid,
    ).toBe(false);
    expect(
      evaluatePasswordStrength('TolimaJuvenil#9482', {
        displayName: 'Carlos Ruiz',
        email: 'cruiz@ejemplo.com',
      }).valid,
    ).toBe(true);
  });

  it('bloquea tras 5 intentos fallidos y reinicia al limpiar el límite', () => {
    const scope = 'login_email';
    const key = 'test-key';
    for (let i = 1; i <= 4; i++) {
      const res = recordRateLimitFailure(scope, key, 5, 15 * 60 * 1000);
      expect(res.blocked).toBe(false);
      expect(res.remaining).toBe(5 - i);
    }

    const fifth = recordRateLimitFailure(scope, key, 5, 15 * 60 * 1000);
    expect(fifth.blocked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(0);
    expect(getRateLimitStatus(scope, key, 5).blocked).toBe(true);

    clearRateLimit(scope, key);
    expect(getRateLimitStatus(scope, key, 5).blocked).toBe(false);
  });

  it('convierte auth/multi-factor-auth-required en flujo automático de limpieza sin mencionar el README', async () => {
    signInMock.mockRejectedValueOnce({ code: 'auth/multi-factor-auth-required' });
    getMultiFactorResolverMock.mockReturnValueOnce({
      hints: [{ uid: 'f1', factorId: 'totp', displayName: 'Autenticador' }],
      session: {},
      resolveSignIn: vi.fn(),
    });

    await expect(performLogin('admin@flandes.gov.co', 'UnaClaveSegura#2026')).rejects.toThrow(
      LegacySecondFactorError,
    );

    signInMock.mockRejectedValueOnce({ code: 'auth/multi-factor-auth-required' });
    getMultiFactorResolverMock.mockImplementationOnce(() => {
      throw new Error('sin resolver');
    });

    await expect(performLogin('admin@flandes.gov.co', 'UnaClaveSegura#2026')).rejects.not.toThrow(
      /README/i,
    );
  });

  it('resuelve e inmediatamente desmatricula factores heredados para no pedirlos más', async () => {
    const mockUser = {
      uid: 'uid-admin',
      email: 'admin@flandes.gov.co',
      getIdToken: vi.fn(async () => 'id-token'),
    };
    const resolveSignInMock = vi.fn(async () => ({ user: mockUser }));

    const removed = await completeLoginAndRemoveLegacySecondFactor({
      resolver: {
        hints: [{ uid: 'factor-1', factorId: 'totp' }],
        session: {},
        resolveSignIn: resolveSignInMock,
      } as unknown as LegacySecondFactorError['resolver'],
      email: 'admin@flandes.gov.co',
      factorId: 'totp',
      hintUid: 'factor-1',
      code: '123456',
    });

    expect(resolveSignInMock).toHaveBeenCalledTimes(1);
    expect(unenrollMock).toHaveBeenCalledWith({ uid: 'factor-1', factorId: 'totp' });
    expect(removed).toBe(1);
  });
});
