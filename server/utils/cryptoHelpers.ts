import crypto from 'crypto';

export class ServerConfigError extends Error {
  public readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'ServerConfigError';
  }
}

const EPHEMERAL_FALLBACK = crypto.randomBytes(32).toString('hex');

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export function isSessionSecretValid(): boolean {
  const raw = process.env.SESSION_SECRET?.trim() || '';
  return raw.length >= 32;
}

function getServerSecret(): Buffer {
  const configured = process.env.SESSION_SECRET?.trim() || '';
  if (isProductionRuntime()) {
    if (configured.length < 32) {
      throw new ServerConfigError(
        'Falta configurar SESSION_SECRET en el servidor (mínimo 32 caracteres).',
      );
    }
    return crypto.createHash('sha256').update(configured).digest();
  }

  const base =
    configured ||
    `${process.env.ADMIN_EMAIL || ''}:${process.env.CMJ_INVITATION_CODE || ''}:${EPHEMERAL_FALLBACK}`;
  return crypto.createHash('sha256').update(base).digest();
}

export function constantTimeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function hashInvitationCode(code: string): { salt: string; hashHex: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 });
  return { salt, hashHex: derived.toString('hex') };
}

export function verifyInvitationHash(code: string, salt: string, expectedHex: string): boolean {
  try {
    const derived = crypto.scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 });
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function encryptInvitationPayload(payload: {
  salt: string;
  hashHex: string;
  version: number;
}): { ciphertext: string; iv: string; tag: string } {
  const key = getServerSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const serialized = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptInvitationPayload(blob: {
  ciphertext: string;
  iv: string;
  tag: string;
}): { salt: string; hashHex: string; version: number } | null {
  try {
    const key = getServerSecret();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(blob.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as {
      salt: string;
      hashHex: string;
      version: number;
    };
  } catch {
    return null;
  }
}

export function signHmacToken(payload: object): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getServerSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyHmacToken<T>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getServerSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `PJ-FLA-${year}-${suffix}`;
}
