import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { AccessTier, RoleLabel } from '../types/cmj';

export const SECRETARY_BOOTSTRAP_EMAIL = 'trujillogordilooo@gmail.com';

// Precomputed salted SHA-256 digests only (plaintext credentials are never embedded in client code)
const DEFAULT_SALT = 'cmj-flandes-tolima-2026-salt';
const DEFAULT_INVITE_HASH =
  '8678b4ede38ec8a55a29914efd977e423470d70a2607017fdb82cd01bb7e24a9';
const DEFAULT_INITIAL_PASSWORD_HASH =
  '53d6cefc7f34d8e9b31abf542a3703bbd744d9f793026988a9a0c02a65b2f888';

export async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashEmail(email: string): Promise<string> {
  return sha256Hex(email.trim().toLowerCase());
}

export async function hashSecretWithSalt(secret: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${secret.trim()}`);
}

export interface SecurityHashesDoc {
  inviteCodeHash: string;
  initialPasswordHash: string;
  salt: string;
}

export async function getActiveSecurityHashes(): Promise<SecurityHashesDoc> {
  try {
    const snap = await getDoc(doc(db, 'portal_security', 'public_hashes'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.inviteCodeHash && data.initialPasswordHash && data.salt) {
        return {
          inviteCodeHash: String(data.inviteCodeHash),
          initialPasswordHash: String(data.initialPasswordHash),
          salt: String(data.salt),
        };
      }
    }
  } catch {
    // Fallback to initial precomputed digests prior to first bootstrap
  }
  return {
    inviteCodeHash: DEFAULT_INVITE_HASH,
    initialPasswordHash: DEFAULT_INITIAL_PASSWORD_HASH,
    salt: DEFAULT_SALT,
  };
}

export async function verifyInviteCode(codeInput: string): Promise<boolean> {
  const hashes = await getActiveSecurityHashes();
  const computed = await hashSecretWithSalt(codeInput, hashes.salt);
  return computed === hashes.inviteCodeHash;
}

export async function verifyInitialPassword(passwordInput: string): Promise<boolean> {
  const hashes = await getActiveSecurityHashes();
  const computed = await hashSecretWithSalt(passwordInput, hashes.salt);
  return computed === hashes.initialPasswordHash;
}

export function roleLabelToAccessTier(roleLabel: RoleLabel): AccessTier {
  switch (roleLabel) {
    case 'Presidente':
      return 'tier_1_pres';
    case 'Vicepresidente':
      return 'tier_2_vp';
    case 'Secretario':
      return 'tier_3_sec';
    default:
      return 'tier_4_member';
  }
}

export function isLeadershipTier(tier?: AccessTier | null): boolean {
  return tier === 'tier_1_pres' || tier === 'tier_2_vp' || tier === 'tier_3_sec';
}
