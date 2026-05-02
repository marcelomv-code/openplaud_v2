import { describe, expect, it } from "vitest";
import { RateLimiter } from "../lib/rate-limit";

describe("RateLimiter", () => {
    describe("constructor", () => {
        it("rejects max < 1", () => {
            expect(() => new RateLimiter({ windowMs: 1000, max: 0 })).toThrow(
                /max must be/,
            );
        });

        it("rejects windowMs < 1", () => {
            expect(() => new RateLimiter({ windowMs: 0, max: 5 })).toThrow(
                /windowMs must be/,
            );
        });
    });

    describe("check", () => {
        it("allows up to `max` hits in the window, then denies", () => {
            const rl = new RateLimiter({ windowMs: 60_000, max: 3 });
            const t = 1_000_000;
            expect(rl.check("u1", t).allowed).toBe(true);
            expect(rl.check("u1", t + 100).allowed).toBe(true);
            expect(rl.check("u1", t + 200).allowed).toBe(true);
            const denied = rl.check("u1", t + 300);
            expect(denied.allowed).toBe(false);
            expect(denied.remaining).toBe(0);
            expect(denied.retryAfterSec).toBeGreaterThan(0);
        });

        it("resets after the sliding window passes", () => {
            const rl = new RateLimiter({ windowMs: 1000, max: 2 });
            const t = 5_000_000;
            rl.check("u1", t);
            rl.check("u1", t + 100);
            expect(rl.check("u1", t + 200).allowed).toBe(false);
            // Slide past the window
            expect(rl.check("u1", t + 1100).allowed).toBe(true);
        });

        it("isolates keys", () => {
            const rl = new RateLimiter({ windowMs: 60_000, max: 1 });
            const t = 1_000;
            expect(rl.check("a", t).allowed).toBe(true);
            expect(rl.check("a", t + 1).allowed).toBe(false);
            expect(rl.check("b", t + 2).allowed).toBe(true);
        });

        it("retryAfterSec reflects time until earliest hit expires", () => {
            const rl = new RateLimiter({ windowMs: 10_000, max: 1 });
            const t = 100_000;
            rl.check("u", t);
            const denied = rl.check("u", t + 3000);
            // earliest hit was at t; window ends at t + 10000;
            // retry should be ceil((t + 10000 - (t + 3000)) / 1000) = 7
            expect(denied.retryAfterSec).toBe(7);
        });

        it("reports remaining count after each allowed hit", () => {
            const rl = new RateLimiter({ windowMs: 60_000, max: 3 });
            const t = 10_000;
            expect(rl.check("u", t).remaining).toBe(2);
            expect(rl.check("u", t + 1).remaining).toBe(1);
            expect(rl.check("u", t + 2).remaining).toBe(0);
        });
    });

    describe("reset", () => {
        it("clears a single key", () => {
            const rl = new RateLimiter({ windowMs: 60_000, max: 1 });
            const t = 1_000;
            rl.check("u1", t);
            rl.check("u2", t);
            rl.reset("u1");
            expect(rl.check("u1", t + 1).allowed).toBe(true);
            expect(rl.check("u2", t + 1).allowed).toBe(false);
        });

        it("clears all keys when called with no argument", () => {
            const rl = new RateLimiter({ windowMs: 60_000, max: 1 });
            rl.check("a");
            rl.check("b");
            expect(rl.size()).toBe(2);
            rl.reset();
            expect(rl.size()).toBe(0);
        });
    });
});
