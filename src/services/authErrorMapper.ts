export class FriendlyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendlyAuthError';
  }
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/multi-factor-auth-required':
    'Esta cuenta aún conserva una verificación antigua en Firebase Authentication. Completa el código una última vez para desactivarla automáticamente o elimínala desde Firebase Console.',
  'auth/invalid-verification-code':
    'El código de 6 dígitos ingresado no es válido o ya expiró. Verifica tu aplicación o solicita un nuevo código.',
  'auth/code-expired':
    'El código de verificación expiró. Solicita uno nuevo e intenta de nuevo.',
  'auth/missing-verification-code':
    'Ingresa el código de 6 dígitos para continuar.',
  'auth/requires-recent-login':
    'Por seguridad, vuelve a confirmar tu contraseña actual antes de realizar este cambio.',
  'auth/too-many-requests':
    'Demasiados intentos seguidos. Por seguridad, espera unos minutos antes de intentar nuevamente.',
  'auth/network-request-failed':
    'No fue posible conectar con el servicio de autenticación. Revisa tu conexión a internet e intenta de nuevo.',
  'auth/unauthorized-domain':
    'Este dominio aún no está autorizado en Firebase Authentication. Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/invalid-credential':
    'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
  'auth/invalid-login-credentials':
    'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
  'auth/wrong-password':
    'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
  'auth/user-not-found':
    'Correo o contraseña incorrectos. Verifica tus credenciales e intenta nuevamente.',
  'auth/user-disabled':
    'Esta cuenta fue deshabilitada en el sistema de autenticación. Contacta al Secretario Administrador.',
  'auth/email-already-in-use':
    'Ya existe una cuenta registrada con este correo electrónico.',
  'auth/invalid-email':
    'El formato del correo electrónico no es válido.',
  'auth/weak-password':
    'La contraseña es muy débil. Usa mínimo 12 caracteres combinando letras, números y símbolos.',
  'auth/operation-not-allowed':
    'El método de acceso Correo electrónico / Contraseña no está habilitado en Firebase Console.',
  'auth/popup-closed-by-user':
    'La ventana emergente de autorización se cerró antes de finalizar el proceso.',
  'auth/popup-blocked':
    'Tu navegador bloqueó la ventana emergente. Habilita las ventanas emergentes e intenta nuevamente.',
};

function extractFirebaseCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const match = msg.match(/auth\/[a-z0-9-]+/i);
  if (match) return match[0].toLowerCase();
  if (msg.includes('PASSWORD_LOGIN_DISABLED')) return 'auth/operation-not-allowed';
  return null;
}

export function mapFirebaseAuthError(err: unknown): string {
  if (err instanceof FriendlyAuthError) {
    return err.message;
  }

  const code = extractFirebaseCode(err);
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (err instanceof Error && err.message && !err.message.includes('Firebase:') && !err.message.includes('auth/')) {
    return err.message;
  }

  return 'No se pudo completar la operación de autenticación. Verifica tus datos e intenta nuevamente.';
}
