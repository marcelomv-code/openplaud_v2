import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "../lib/public-env";

describe("parsePublicEnv", () => {
    it("returns undefined for unset numeric vars and applies defaults at consumption time", () => {
        const result = parsePublicEnv({});
        expect(result.NEXT_PUBLIC_SYNC_INTERVAL).toBeUndefined();
        expect(result.NEXT_PUBLIC_MIN_SYNC_INTERVAL).toBeUndefined();
    });

    it("parses positive integers from strings", () => {
        const result = parsePublicEnv({
            NEXT_PUBLIC_SYNC_INTERVAL: "120000",
            NEXT_PUBLIC_MIN_SYNC_INTERVAL: "30000",
        });
        expect(result.NEXT_PUBLIC_SYNC_INTERVAL).toBe(120000);
        expect(result.NEXT_PUBLIC_MIN_SYNC_INTERVAL).toBe(30000);
    });

    it("rejects non-integer strings", () => {
        expect(() =>
            parsePublicEnv({ NEXT_PUBLIC_SYNC_INTERVAL: "abc" }),
        ).toThrow(/Public environment validation failed/);
    });

    it("rejects zero or negative intervals", () => {
        expect(() =>
            parsePublicEnv({ NEXT_PUBLIC_SYNC_INTERVAL: "0" }),
        ).toThrow(/Public environment validation failed/);
        expect(() =>
            parsePublicEnv({ NEXT_PUBLIC_MIN_SYNC_INTERVAL: "-1" }),
        ).toThrow(/Public environment validation failed/);
    });

    it("treats unset boolean flags as true (default behavior)", () => {
        const result = parsePublicEnv({});
        expect(result.NEXT_PUBLIC_SYNC_ON_MOUNT).toBe(true);
        expect(result.NEXT_PUBLIC_SYNC_ON_VISIBILITY).toBe(true);
    });

    it("treats only the literal string 'false' as false", () => {
        const off = parsePublicEnv({
            NEXT_PUBLIC_SYNC_ON_MOUNT: "false",
            NEXT_PUBLIC_SYNC_ON_VISIBILITY: "false",
        });
        expect(off.NEXT_PUBLIC_SYNC_ON_MOUNT).toBe(false);
        expect(off.NEXT_PUBLIC_SYNC_ON_VISIBILITY).toBe(false);
    });

    it("treats arbitrary strings as true (only 'false' opts out)", () => {
        const on = parsePublicEnv({
            NEXT_PUBLIC_SYNC_ON_MOUNT: "true",
            NEXT_PUBLIC_SYNC_ON_VISIBILITY: "yes",
        });
        expect(on.NEXT_PUBLIC_SYNC_ON_MOUNT).toBe(true);
        expect(on.NEXT_PUBLIC_SYNC_ON_VISIBILITY).toBe(true);
    });
});
