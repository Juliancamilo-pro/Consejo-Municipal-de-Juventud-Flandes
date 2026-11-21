export interface PasswordStrengthResult {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Muy débil' | 'Débil' | 'Aceptable' | 'Fuerte' | 'Muy fuerte';
  reason?: string;
  checks: {
    minLength: boolean;
    hasUpperAndLower: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
    notCommonOrPersonal: boolean;
  };
}

const COMMON_WEAK_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  'password1234',
  'password123456',
  'contraseña123',
  'contrasena123',
  'qwerty123456',
  'qwertyuiop12',
  'admin1234567',
  'administrador',
  'flandes2026',
  'flandes2026!',
  'cmjflandes2026',
  'tolima202612',
  'colombia2026',
  'juventud2026',
  'consejero123',
  'consejero2026',
  'abcdef123456',
  '000000000000',
  '111111111111',
]);

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function evaluatePasswordStrength(
  password: string,
  context?: { email?: string; displayName?: string },
): PasswordStrengthResult {
  const normalizedPass = normalizeToken(password);
  const minLength = password.length >= 12;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasUpperAndLower = hasLower && hasUpper;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(password);

  let personalMatch = false;
  if (normalizedPass.length > 0) {
    if (COMMON_WEAK_PASSWORDS.has(normalizedPass)) {
      personalMatch = true;
    }

    const emailLocal = context?.email ? normalizeToken(context.email.split('@')[0] || '') : '';
    if (emailLocal.length >= 3 && normalizedPass.includes(emailLocal)) {
      personalMatch = true;
    }

    const nameTokens = context?.displayName
      ? normalizeToken(context.displayName)
          .split(/\s+/)
          .filter((t) => t.length >= 3)
      : [];
    if (nameTokens.some((token) => normalizedPass.includes(token))) {
      personalMatch = true;
    }
  }

  const notCommonOrPersonal = !personalMatch;

  let rawScore = 0;
  if (minLength) rawScore += 1;
  if (hasUpperAndLower) rawScore += 1;
  if (hasNumber) rawScore += 1;
  if (hasSymbol) rawScore += 1;
  if (!notCommonOrPersonal && rawScore > 1) {
    rawScore = 1;
  }

  const score = Math.min(4, Math.max(0, rawScore)) as 0 | 1 | 2 | 3 | 4;

  const labels: Record<0 | 1 | 2 | 3 | 4, PasswordStrengthResult['label']> = {
    0: 'Muy débil',
    1: 'Débil',
    2: 'Aceptable',
    3: 'Fuerte',
    4: 'Muy fuerte',
  };

  let reason: string | undefined;
  if (!minLength) {
    reason = 'La contraseña debe tener mínimo 12 caracteres.';
  } else if (!notCommonOrPersonal) {
    reason =
      'No uses contraseñas comunes ni incluyas partes de tu nombre o correo electrónico.';
  } else if (!hasUpperAndLower || !hasNumber) {
    reason = 'Incluye mayúsculas, minúsculas y al menos un número.';
  }

  const valid = minLength && notCommonOrPersonal && hasUpperAndLower && hasNumber;

  return {
    valid,
    score,
    label: labels[score],
    reason,
    checks: {
      minLength,
      hasUpperAndLower,
      hasNumber,
      hasSymbol,
      notCommonOrPersonal,
    },
  };
}
