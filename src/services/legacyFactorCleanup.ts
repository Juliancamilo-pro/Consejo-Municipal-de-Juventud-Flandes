// TEMPORAL: archivo aislado para limpiar cuentas antiguas con segundo factor guardado en Firebase.
// Todo uso de APIs de segundo factor (getMultiFactorResolver, TOTP, SMS, RecaptchaVerifier, multiFactor)
// permanece estrictamente confinado aquí para poder eliminarse en bloque en el futuro.
import {
  getMultiFactorResolver,
  multiFactor,
  MultiFactorError,
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

export interface LegacyFactorHintSummary {
  uid: string;
  kind: 'totp' | 'phone';
  label: string;
}

export class LegacySecondFactorError extends Error {
  public readonly resolver: MultiFactorResolver;
  public readonly email: string;
  public readonly hints: LegacyFactorHintSummary[];
  private readonly rawHints: MultiFactorInfo[];

  constructor(resolver: MultiFactorResolver, email: string) {
    super(
      'Esta cuenta conserva una verificación antigua en Firebase. Puedes quitarla con tu código o con la clave de rescate.',
    );
    this.name = 'LegacySecondFactorError';
    this.resolver = resolver;
    this.email = email;
    this.rawHints = resolver.hints || [];
    this.hints = this.rawHints.map((hint) => {
      const isPhone = hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID;
      return {
        uid: hint.uid,
        kind: isPhone ? 'phone' : 'totp',
        label: hint.displayName || (isPhone ? 'Celular' : 'Aplicación'),
      };
    });
  }

  public findRawHint(hintUid: string): MultiFactorInfo | undefined {
    return this.rawHints.find((h) => h.uid === hintUid) || this.rawHints[0];
  }
}

export function buildLegacyFactorError(
  err: unknown,
  email: string,
): LegacySecondFactorError | null {
  if (typeof getMultiFactorResolver !== 'function') return null;
  const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
  if (resolver && Array.isArray(resolver.hints) && resolver.hints.length > 0) {
    return new LegacySecondFactorError(resolver, email);
  }
  return null;
}

async function unenrollAllLegacyFactors(user: User): Promise<number> {
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
  challenge: LegacySecondFactorError,
  hintUid: string,
  recaptchaContainerId: string,
): Promise<string> {
  const hint = challenge.findRawHint(hintUid);
  if (!hint) {
    throw new FriendlyAuthError('No encontramos un número de celular asociado a esta cuenta.');
  }

  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  try {
    const provider = new PhoneAuthProvider(auth);
    return await provider.verifyPhoneNumber(
      { multiFactorHint: hint, session: challenge.resolver.session },
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
    challenge: unknown;
    email: string;
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

  const challenge = input.challenge as LegacySecondFactorError;
  const rawHint =
    typeof challenge?.findRawHint === 'function'
      ? challenge.findRawHint(input.hintUid)
      : challenge?.resolver?.hints?.find((h) => h.uid === input.hintUid) ||
        challenge?.resolver?.hints?.[0];

  if (!challenge?.resolver || !rawHint) {
    throw new FriendlyAuthError('La sesión de verificación venció. Inicia sesión nuevamente.');
  }

  try {
    const assertion =
      rawHint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
        ? PhoneMultiFactorGenerator.assertion(
            PhoneAuthProvider.credential(input.verificationId || '', cleanCode),
          )
        : TotpMultiFactorGenerator.assertionForSignIn(rawHint.uid, cleanCode);

    const cred = await challenge.resolver.resolveSignIn(assertion);
    const removedCount = await unenrollAllLegacyFactors(cred.user);
    await finalizeUser(cred.user, input.email);
    return removedCount;
  } catch (err) {
    if (err instanceof FriendlyAuthError) throw err;
    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  }
}
