import crypto from 'node:crypto';
import type { AccessTier, RoleLabel } from '../types/cmj.ts';

export const SECRETARY_BOOTSTRAP_EMAIL = 'trujillogordilooo@gmail.com';

// Precomputed salted SHA-256 digests only (plaintext credentials are never embedded in code)
const DEFAULT_SALT = 'cmj-flandes-tolima-2026-salt';
const DEFAULT_INVITE_DIGEST =
  'sha256_salted:8678b4ede38ec8a55a29914efd977e423470d70a2607017fdb82cd01bb7e24a9';
const DEFAULT_INITIAL_PWD_DIGEST =
  'sha256_salted:53d6cefc7f34d8e9b31abf542a3703bbd744d9f793026988a9a0c02a65b2f888';

let runtimeSessionSecret =
  process.env.CMJ_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hasEnvSessionSecret(): boolean {
  return Boolean(process.env.CMJ_SESSION_SECRET?.trim());
}

export function setRuntimeSessionSecret(secret: string): void {
  if (!process.env.CMJ_SESSION_SECRET?.trim() && secret && secret.length >= 32) {
    runtimeSessionSecret = secret;
  }
}

export function getRuntimeSessionSecret(): string {
  return process.env.CMJ_SESSION_SECRET?.trim() || runtimeSessionSecret;
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase());
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifySecretHash(candidate: string, storedHash: string): boolean {
  const clean = candidate.trim();
  if (!clean || !storedHash) return false;

  if (storedHash.startsWith('scrypt:')) {
    const [, salt, hex] = storedHash.split(':');
    if (!salt || !hex) return false;
    const candidateBuf = crypto.scryptSync(clean, salt, 64);
    const storedBuf = Buffer.from(hex, 'hex');
    if (candidateBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(candidateBuf, storedBuf);
  }

  if (storedHash.startsWith('sha256_salted:')) {
    const expectedHex = storedHash.slice('sha256_salted:'.length);
    const computedHex = sha256Hex(`${DEFAULT_SALT}:${clean}`);
    const a = Buffer.from(computedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  return false;
}

export function timingSafeEqualStrings(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const a = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function getInitialSecurityHashesFromEnvOrDefaults(): {
  inviteCodeHash: string;
  initialPasswordHash: string;
} {
  const envInvite = process.env.CMJ_INVITE_CODE?.trim();
  const envInitialPwd = process.env.CMJ_INITIAL_PASSWORD?.trim();
  return {
    inviteCodeHash: envInvite ? hashPasswordScrypt(envInvite) : DEFAULT_INVITE_DIGEST,
    initialPasswordHash: envInitialPwd
      ? hashPasswordScrypt(envInitialPwd)
      : DEFAULT_INITIAL_PWD_DIGEST,
  };
}

export interface SessionTokenPayload {
  uid: string;
  email: string;
  exp: number;
}

export function signSessionToken(uid: string, email: string): string {
  const payload: SessionTokenPayload = {
    uid,
    email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getRuntimeSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getRuntimeSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (!parsed.uid || !parsed.email || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function roleLabelToAccessTier(roleLabel: RoleLabel): AccessTier {
  switch (roleLabel) {
    case 'Presidente':
      return 'tier_1_pres';
    case 'Vicepresidente':
      return 'tier_2_vp';
    case 'Secretario':
      return 'tier_3_sec';
    case 'Consejero Departamental':
      return 'tier_5_dept';
    default:
      return 'tier_4_member';
  }
}

export function isLeadershipTier(tier: string): boolean {
  return tier === 'tier_1_pres' || tier === 'tier_2_vp' || tier === 'tier_3_sec';
}
