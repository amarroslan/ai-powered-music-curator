import type { RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Minimal in-memory, per-IP rate limiter (SPEC.md §12). Good enough
 * for a single free-tier instance; swap for a shared store when we
 * scale beyond one process.
 */
export function simpleRateLimit({ windowMs, max }: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();

    if (hits.size > 5_000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({
        error: "rate_limited",
        retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }
    next();
  };
}
