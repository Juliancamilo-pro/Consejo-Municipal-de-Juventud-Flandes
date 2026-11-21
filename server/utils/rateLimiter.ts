interface AttemptBucket {
  failures: number;
  blockedUntil: number;
  windowStart: number;
}

const buckets = new Map<string, AttemptBucket>();

const DEFAULT_BLOCK_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export function getRateLimitStatus(
  scope: string,
  ip: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  blockMs = DEFAULT_BLOCK_MS,
): { blocked: boolean; retryAfterSeconds: number; remaining: number } {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  if (bucket.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  if (now - bucket.windowStart > blockMs) {
    buckets.delete(key);
    return { blocked: false, retryAfterSeconds: 0, remaining: maxAttempts };
  }

  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxAttempts - bucket.failures),
  };
}

export function recordRateLimitFailure(
  scope: string,
  ip: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  blockMs = DEFAULT_BLOCK_MS,
): { blocked: boolean; retryAfterSeconds: number; remaining: number } {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > blockMs) {
    const next: AttemptBucket = {
      failures: 1,
      blockedUntil: maxAttempts <= 1 ? now + blockMs : 0,
      windowStart: now,
    };
    buckets.set(key, next);
    return {
      blocked: next.blockedUntil > now,
      retryAfterSeconds: next.blockedUntil > now ? Math.ceil(blockMs / 1000) : 0,
      remaining: Math.max(0, maxAttempts - 1),
    };
  }

  existing.failures += 1;
  if (existing.failures >= maxAttempts) {
    existing.blockedUntil = now + blockMs;
  }
  buckets.set(key, existing);

  return {
    blocked: existing.blockedUntil > now,
    retryAfterSeconds:
      existing.blockedUntil > now ? Math.ceil((existing.blockedUntil - now) / 1000) : 0,
    remaining: Math.max(0, maxAttempts - existing.failures),
  };
}

export function clearRateLimit(scope: string, ip: string): void {
  buckets.delete(`${scope}:${ip}`);
}
