import {
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  MultiFactorError,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types/models';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import { recordAuditLog } from './auditService';
import { FriendlyAuthError, mapFirebaseAuthError } from './authErrorMapper';
import { auth, db } from './firebase';
import {
  LegacySecondFactorError,
  resolveAndUnenrollLegacyFactor,
  sendLegacySmsCleanupCode,
  unenrollAllLegacyFactors,
} from './legacyFactorCleanup';
import {
  checkLoginRateLimitOnServer,
  createServerSessionCookie,
  recordLoginFailureOnServer,
  verifyAdminActivationOnServer,
  verifyInvitationCodeOnServer,
} from './sessionApi';

export { LegacySecondFactorError, sendLegacySmsCleanupCode, unenrollAllLegacyFactors };

async function provisionAdminProfileAndSession(user: User, fallbackEmail: string): Promise<void> {
  const email = (user.email || fallbackEmail).toLowerCase();
  const displayName = user.displayName?.trim() || 'Secretario Administrador';

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    displayName,
    role: 'secretario_admin',
    status: 'activo',
    positionTitle: 'Secretario Administrador',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'settings', 'bootstrap'), {
    kind: 'bootstrap',
    adminActivated: true,
    adminUid: user.uid,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  const idToken = await user.getIdToken(true);
  await createServerSessionCookie(idToken, {
    role: 'secretario_admin',
    status: 'activo',
    displayName,
  });

  await recordAuditLog({
    actorUid: user.uid,
    actorEmail: email,
    actorRole: 'secretario_admin',
    action: 'ADMIN_ACTIVATION',
    targetCollection: 'users',
    targetId: user.uid,
    summary: 'Activación inicial de la cuenta de Secretario Administrador.',
  });
}

async function finalizeAuthenticatedUser(user: User, fallbackEmail: string): Promise<void> {
  await unenrollAllLegacyFactors(user);

  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  const prof = profileSnap.exists() ? (profileSnap.data() as UserProfile) : null;

  if (!prof) {
    try {
      await verifyAdminActivationOnServer(user.email || fallbackEmail);
      await provisionAdminProfileAndSession(user, fallbackEmail);
      return;
    } catch {
      await signOut(auth);
      throw new FriendlyAuthError('No se encontró tu perfil institucional en el sistema.');
    }
  }

  if (prof.status === 'suspendido') {
    await signOut(auth);
    throw new FriendlyAuthError(
      'Tu cuenta se encuentra suspendida. Contacta a la Mesa Directiva del CMJ.',
    );
  }

  const idToken = await user.getIdToken(true);
  await createServerSessionCookie(idToken, {
    role: prof.role,
    status: prof.status,
    displayName: prof.displayName,
  });

  await recordAuditLog({
    actorUid: user.uid,
    actorEmail: user.email || fallbackEmail,
    actorRole: prof.role,
    action: 'USER_LOGIN',
    targetCollection: 'users',
    targetId: user.uid,
    summary: 'Inicio de sesión exitoso en el portal privado.',
  });
}

export async function performCouncilorRegistration(input: {
  displayName: string;
  email: string;
  password: string;
  invitationCode: string;
  sector?: string;
}): Promise<void> {
  const strength = evaluatePasswordStrength(input.password, {
    email: input.email,
    displayName: input.displayName,
  });
  if (!strength.valid) {
    throw new FriendlyAuthError(
      strength.reason || 'La contraseña no cumple con los requisitos mínimos de seguridad.',
    );
  }
  await verifyInvitationCodeOnServer(input.invitationCode);

  try {
    const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
    await updateProfile(cred.user, { displayName: input.displayName.trim() });

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email || input.email.toLowerCase(),
      displayName: input.displayName.trim(),
      role: 'consejero',
      status: 'pendiente',
      ...(input.sector?.trim() ? { sector: input.sector.trim() } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const idToken = await cred.user.getIdToken(true);
    await createServerSessionCookie(idToken, {
      role: 'consejero',
      status: 'pendiente',
      displayName: input.displayName.trim(),
    });

    await recordAuditLog({
      actorUid: cred.user.uid,
      actorEmail: cred.user.email || input.email,
      actorRole: 'consejero',
      action: 'COUNCILOR_REGISTER',
      targetCollection: 'users',
      targetId: cred.user.uid,
      summary: 'Registro de nueva cuenta de consejero en estado pendiente.',
    });
  } catch (err) {
    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  }
}

export async function performLogin(email: string, password: string): Promise<void> {
  const normalizedEmail = email.trim();
  await checkLoginRateLimitOnServer(normalizedEmail);

  try {
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    await finalizeAuthenticatedUser(cred.user, normalizedEmail);
  } catch (err) {
    if (err instanceof FriendlyAuthError || err instanceof LegacySecondFactorError) {
      throw err;
    }

    const errCode =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';

    if (errCode === 'auth/multi-factor-auth-required') {
      try {
        if (typeof getMultiFactorResolver === 'function') {
          const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
          if (resolver && Array.isArray(resolver.hints) && resolver.hints.length > 0) {
            throw new LegacySecondFactorError(resolver, normalizedEmail);
          }
        }
      } catch (resolverErr) {
        if (resolverErr instanceof LegacySecondFactorError) {
          throw resolverErr;
        }
      }
      throw new FriendlyAuthError(mapFirebaseAuthError(err));
    }

    if (
      (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') &&
      password.length >= 12
    ) {
      try {
        await verifyAdminActivationOnServer(normalizedEmail);
        const created = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await provisionAdminProfileAndSession(created.user, normalizedEmail);
        return;
      } catch (innerErr) {
        const innerCode =
          innerErr && typeof innerErr === 'object' && 'code' in innerErr
            ? String((innerErr as { code: unknown }).code)
            : '';
        if (innerCode === 'auth/operation-not-allowed') {
          throw new FriendlyAuthError(mapFirebaseAuthError(innerErr));
        }
      }
    }

    const credentialCodes = new Set([
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
      'auth/wrong-password',
      'auth/user-not-found',
    ]);
    if (credentialCodes.has(errCode)) {
      const failureRes = await recordLoginFailureOnServer(normalizedEmail);
      throw new FriendlyAuthError(
        failureRes.error ||
          'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
      );
    }

    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  }
}

export async function completeLoginAndRemoveLegacySecondFactor(input: {
  resolver: LegacySecondFactorError['resolver'];
  email: string;
  factorId: string;
  hintUid: string;
  code: string;
  verificationId?: string;
}): Promise<number> {
  return resolveAndUnenrollLegacyFactor(input, finalizeAuthenticatedUser);
}

export async function performPasswordReset(email: string): Promise<void> {
  const normalized = email.trim();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new FriendlyAuthError('Ingresa un correo electrónico válido para enviar el enlace.');
  }
  try {
    await sendPasswordResetEmail(auth, normalized);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'auth/user-not-found') {
      return;
    }
    throw new FriendlyAuthError(mapFirebaseAuthError(err));
  }
}
