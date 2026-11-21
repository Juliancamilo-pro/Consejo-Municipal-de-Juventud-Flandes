import {
  multiFactor,
  MultiFactorInfo,
  MultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  TotpMultiFactorGenerator,
  User,
} from 'firebase/auth';
import { FriendlyAuthError, mapFirebaseAuthError } from './authErrorMapper';
import { auth } from './firebase';

export class LegacySecondFactorError extends Error {
  public readonly resolver: MultiFactorResolver;
  public readonly email: string;
  public readonly hints: MultiFactorInfo[];

  constructor(resolver: MultiFactorResolver, email: string) {
    super(
      'Esta cuenta conserva una verificación antigua en Firebase. Ingresa tu código una última vez para desactivarla automáticamente.',
    );
    this.name = 'LegacySecondFactorError';
    this.resolver = resolver;
    this.email = email;
    this.hints = resolver.hints || [];
  }
}

export async function unenrollAllLegacyFactors(user: User): Promise<number> {
  try {
    if (typeof multiFactor !== 'function') return 0;
    const mfaUser = multiFactor(user);
    const factors = [...(mfaUser?.enrolledFactors || [])];
    for (const factor of factors) {
      await mfaUser.unenroll(factor);
    }
    return factors.length;
  } catch {
    return 0;
  }
}

export async function sendLegacySmsCleanupCode(
  resolver: MultiFactorResolver,
  hint: MultiFactorInfo,
  recaptchaContainerId: string,
): Promise<string> {
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  try {
    const provider = new PhoneAuthProvider(auth);
    return await provider.verifyPhoneNumber(
      { multiFactorHint: hint, session: resolver.session },
      verifier,
    );
  } catch (err) {
    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  } finally {
    verifier.clear();
  }
}

export async function resolveAndUnenrollLegacyFactor(
  input: {
    resolver: MultiFactorResolver;
    email: string;
    factorId: string;
    hintUid: string;
    code: string;
    verificationId?: string;
  },
  finalizeUser: (user: User, email: string) => Promise<void>,
): Promise<number> {
  const cleanCode = input.code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new FriendlyAuthError('Ingresa el código numérico de 6 dígitos para continuar.');
  }

  try {
    const assertion =
      input.factorId === PhoneMultiFactorGenerator.FACTOR_ID
        ? PhoneMultiFactorGenerator.assertion(
            PhoneAuthProvider.credential(input.verificationId || '', cleanCode),
          )
        : TotpMultiFactorGenerator.assertionForSignIn(input.hintUid, cleanCode);

    const cred = await input.resolver.resolveSignIn(assertion);
    const removedCount = await unenrollAllLegacyFactors(cred.user);
    await finalizeUser(cred.user, input.email);
    return removedCount;
  } catch (err) {
    if (err instanceof FriendlyAuthError) throw err;
    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  }
}
