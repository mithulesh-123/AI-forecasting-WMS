type Bucket = { tokens: number; lastRefill: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * On Vercel serverless each warm lambda instance keeps its own map - this is a
 * pragmatic first line of defence against brute force / abuse, not a
 * distributed quota. For strict global limits put a provider (e.g. Upstash)
 * behind this same interface.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.lastRefill >= options.windowMs) {
    buckets.set(key, { tokens: options.limit - 1, lastRefill: now });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.tokens <= 0) {
    const retryAfterSeconds = Math.ceil((options.windowMs - (now - bucket.lastRefill)) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, retryAfterSeconds: 0 };
}

/** Housekeeping so the map cannot grow unbounded in long-lived processes. */
export function pruneRateLimits(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 60 * 60 * 1000) buckets.delete(key);
  }
}
