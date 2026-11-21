import crypto from 'crypto';
import { getAdminFirestore, isAdminCredentialConfigured } from './authHelpers.ts';

const COLLECTION_NAME = 'rescue_rate_limits';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

interface FirestoreRateLimitDoc {
  failures?: number;
  windowStartMs?: number;
  blockedUntilMs?: number;
  updatedAtMs?: number;
}

export interface PersistentRateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

function buildDocId(scope: 'ip' | 'email', rawKey: string): string {
  const normalized = rawKey.trim().toLowerCase() || 'unknown';
  const digest = crypto.createHash('sha256').update(`${scope}:${normalized}`).digest('hex').slice(0, 32);
  return `${scope}_${digest}`;
}

export async function checkFirestoreRateLimit(
  scope: 'ip' | 'email',
  rawKey: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<PersistentRateLimitResult> {
  if (!isAdminCredentialConfigured()) {
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  const docRef = getAdminFirestore().collection(COLLECTION_NAME).doc(buildDocId(scope, rawKey));
  const now = Date.now();
  const snap = await docRef.get();
  if (!snap.exists) {
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  const data = (snap.data() || {}) as FirestoreRateLimitDoc;
  const blockedUntilMs = typeof data.blockedUntilMs === 'number' ? data.blockedUntilMs : 0;
  if (blockedUntilMs > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((blockedUntilMs - now) / 1000),
      remaining: 0,
    };
  }

  const windowStartMs = typeof data.windowStartMs === 'number' ? data.windowStartMs : 0;
  if (!windowStartMs || now - windowStartMs > windowMs) {
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  const failures = typeof data.failures === 'number' ? data.failures : 0;
  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxAttempts - failures),
  };
}

export async function recordFirestoreRateLimitFailure(
  scope: 'ip' | 'email',
  rawKey: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<PersistentRateLimitResult> {
  if (!isAdminCredentialConfigured()) {
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION_NAME).doc(buildDocId(scope, rawKey));
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? ((snap.data() || {}) as FirestoreRateLimitDoc) : null;
    const prevWindowStart = data && typeof data.windowStartMs === 'number' ? data.windowStartMs : 0;
    const prevBlockedUntil = data && typeof data.blockedUntilMs === 'number' ? data.blockedUntilMs : 0;

    if (prevBlockedUntil > now) {
      return {
        blocked: true,
        retryAfterSeconds: Math.ceil((prevBlockedUntil - now) / 1000),
        remaining: 0,
      };
    }

    const windowExpired = !prevWindowStart || now - prevWindowStart > windowMs;
    const nextFailures = windowExpired
      ? 1
      : (data && typeof data.failures === 'number' ? data.failures : 0) + 1;
    const nextWindowStart = windowExpired ? now : prevWindowStart;
    const blocked = nextFailures >= maxAttempts;
    const nextBlockedUntil = blocked ? now + windowMs : 0;

    tx.set(docRef, {
      scope,
      failures: nextFailures,
      windowStartMs: nextWindowStart,
      blockedUntilMs: nextBlockedUntil,
      updatedAtMs: now,
    });

    return {
      blocked,
      retryAfterSeconds: blocked ? Math.ceil(windowMs / 1000) : 0,
      remaining: Math.max(0, maxAttempts - nextFailures),
    };
  });
}

export async function clearFirestoreRateLimit(scope: 'ip' | 'email', rawKey: string): Promise<void> {
  if (!isAdminCredentialConfigured()) return;
  const docRef = getAdminFirestore().collection(COLLECTION_NAME).doc(buildDocId(scope, rawKey));
  await docRef.delete().catch(() => undefined);
}
