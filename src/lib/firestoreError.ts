import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface TranslatedAuthError {
  message: string;
  hint?: string;
  code: string;
  needsConsoleAuthSetup?: boolean;
  isEmailAlreadyInUse?: boolean;
  isMfaRequired?: boolean;
}

export function translateFirebaseAuthError(error: unknown): TranslatedAuthError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        code,
        needsConsoleAuthSetup: true,
        message: 'El método de acceso Correo/Contraseña no está habilitado en Firebase Authentication.',
        hint: 'En Firebase Console ve a Authentication → Sign-in method → Correo electrónico/contraseña y actívalo.',
      };
    case 'auth/multi-factor-auth-required':
      return {
        code,
        isMfaRequired: true,
        message: 'Esta cuenta tiene activada la verificación en dos pasos (MFA) en Firebase Authentication.',
        hint: 'Este portal funciona únicamente con correo y contraseña. Para solucionarlo, entra a Firebase Console → Authentication → Users, elimina este usuario (o desactiva MFA en Settings → Multi-factor authentication) y vuelve a activar tu cuenta en la pestaña "Activar cuenta".',
      };
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
      return {
        code,
        message: 'Correo o contraseña incorrectos.',
        hint: 'Verifica tu contraseña. Si olvidaste la clave o tu cuenta fue creada antes, usa "¿Olvidaste tu contraseña?".',
      };
    case 'auth/missing-password':
      return {
        code,
        message: 'Debes escribir tu contraseña para continuar.',
      };
    case 'auth/missing-email':
      return {
        code,
        message: 'Debes escribir tu correo electrónico registrado.',
      };
    case 'auth/user-not-found':
      return {
        code,
        message: 'Este correo aún no tiene una clave activada en el portal.',
        hint: 'Usa la pestaña "Primer ingreso / Activar cuenta" con el código de invitación del CMJ para crear tu contraseña.',
      };
    case 'auth/email-already-in-use':
      return {
        code,
        isEmailAlreadyInUse: true,
        message: 'Este correo ya tiene una cuenta registrada en el sistema.',
        hint: 'Si ya habías ingresado antes, inicia sesión con tu contraseña o solicita un enlace de restablecimiento al correo.',
      };
    case 'auth/invalid-email':
      return {
        code,
        message: 'El formato del correo electrónico no es válido.',
        hint: 'Revisa que no falte el @ ni el dominio del correo.',
      };
    case 'auth/user-disabled':
      return {
        code,
        message: 'Esta cuenta se encuentra deshabilitada temporalmente.',
        hint: 'Comunícate con el Secretario o Presidente del CMJ para revisar tu estado.',
      };
    case 'auth/weak-password':
      return {
        code,
        message: 'La contraseña debe tener al menos 6 caracteres.',
        hint: 'Combina letras y números para mayor seguridad.',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Se detectaron demasiados intentos seguidos en poco tiempo.',
        hint: 'Espera unos minutos antes de intentar de nuevo o usa "¿Olvidaste tu contraseña?".',
      };
    case 'auth/requires-recent-login':
      return {
        code,
        message: 'Por seguridad, vuelve a iniciar sesión para aplicar este cambio.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'Sin conexión con el servidor de autenticación.',
        hint: 'Verifica tu conexión a internet o intenta nuevamente en unos segundos.',
      };
    default:
      return {
        code,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible completar la autenticación. Intenta de nuevo.',
      };
  }
}

export function translateStorageError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'storage/unauthorized':
      return 'Firebase Storage rechazó el archivo por reglas de seguridad o falta de activación. Verifica en Firebase Console > Storage que el servicio esté iniciado y las reglas publicadas.';
    case 'storage/canceled':
      return 'Subida cancelada por el usuario.';
    case 'storage/quota-exceeded':
      return 'Se alcanzó la cuota de almacenamiento de Firebase Storage.';
    case 'storage/retry-limit-exceeded':
      return 'Conexión inestable durante la subida. Intenta de nuevo.';
    case 'storage/unauthenticated':
      return 'Debes iniciar sesión como consejero para subir archivos.';
    default:
      return 'No se pudo subir el archivo a Firebase Storage. Verifica que el bucket esté activo en Firebase Console.';
  }
}
