/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed by an opaque string (typically `userId:resource` or `ip:resource`).
 * Suitable for self-hosted single-instance deployments. Multi-instance
 * deployments need a shared store (Redis/Postgres) — out of scope here.
 *
 * Not exported as a singleton — callers create their own limiter per
 * resource so windowMs/max can vary by route.
 */

export interface RateLimitOptions {
    /** Sliding-window size in milliseconds. */
    windowMs: number;
    /** Maximum requests allowed per key per window. */
    max: number;
}

export interface RateLimitResult {
    allowed: boolean;
    /** Requests remaining in the current window after this check. */
    remaining: number;
    /** When denied, seconds the caller should wait before retrying. */
    retryAfterSec?: number;
}

export class RateLimiter {
    private hits = new Map<string, number[]>();

    constructor(private readonly opts: RateLimitOptions) {
        if (opts.max < 1) throw new Error("max must be >= 1");
        if (opts.windowMs < 1) throw new Error("windowMs must be >= 1");
    }

    /**
     * Records an attempt for `key` and returns whether it is allowed.
     * Pass `now` to make tests deterministic.
     */
    check(key: string, now: number = Date.now()): RateLimitResult {
        const cutoff = now - this.opts.windowMs;
        const previous = this.hits.get(key) ?? [];
        const recent = previous.filter((t) => t > cutoff);

        if (recent.length >= this.opts.max) {
            this.hits.set(key, recent);
            const earliest = recent[0] as number;
            const retryAfterMs = earliest + this.opts.windowMs - now;
            return {
                allowed: false,
                remaining: 0,
                retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
            };
        }

        recent.push(now);
        this.hits.set(key, recent);
        return { allowed: true, remaining: this.opts.max - recent.length };
    }

    /**
     * Forget all hits for `key`, or all keys if `key` is omitted. Mostly
     * useful for tests and for clearing on logout.
     */
    reset(key?: string): void {
        if (key === undefined) this.hits.clear();
        else this.hits.delete(key);
    }

    /** Number of distinct keys currently tracked (size of the in-memory map). */
    size(): number {
        return this.hits.size;
    }
}
