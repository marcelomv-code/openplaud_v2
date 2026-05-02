import { describe, expect, it } from "vitest";
import { parseEnv, type RawEnvInput } from "../lib/env-schema";

const VALID_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const validRuntimeEnv: RawEnvInput = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    BETTER_AUTH_SECRET: "x".repeat(32),
    APP_URL: "http://localhost:3000",
    ENCRYPTION_KEY: VALID_KEY,
};

describe("parseEnv", () => {
    describe("ENCRYPTION_KEY validation", () => {
        it("accepts a clean 64-char hex key", () => {
            const result = parseEnv(validRuntimeEnv);
            expect(result.ENCRYPTION_KEY).toBe(VALID_KEY);
        });

        it("rejects a key shorter than 64 hex characters", () => {
            expect(() =>
                parseEnv({ ...validRuntimeEnv, ENCRYPTION_KEY: "abc123" }),
            ).toThrow(/64 hex characters/);
        });

        it("rejects a key longer than 64 hex characters", () => {
            expect(() =>
                parseEnv({
                    ...validRuntimeEnv,
                    ENCRYPTION_KEY: `${VALID_KEY}00`,
                }),
            ).toThrow(/64 hex characters/);
        });

        it("rejects a key with non-hex characters", () => {
            const invalid = `g${VALID_KEY.slice(1)}`;
            expect(() =>
                parseEnv({ ...validRuntimeEnv, ENCRYPTION_KEY: invalid }),
            ).toThrow(/64 hex characters/);
        });

        it("rejects a key with whitespace inside the value", () => {
            const withSpace = `${VALID_KEY.slice(0, 32)} ${VALID_KEY.slice(33)}`;
            expect(() =>
                parseEnv({ ...validRuntimeEnv, ENCRYPTION_KEY: withSpace }),
            ).toThrow(/64 hex characters/);
        });

        it("rejects a key with leading/trailing whitespace", () => {
            expect(() =>
                parseEnv({
                    ...validRuntimeEnv,
                    ENCRYPTION_KEY: ` ${VALID_KEY} `,
                }),
            ).toThrow(/64 hex characters/);
        });

        it("requires ENCRYPTION_KEY at runtime", () => {
            expect(() =>
                parseEnv({ ...validRuntimeEnv, ENCRYPTION_KEY: undefined }),
            ).toThrow(/ENCRYPTION_KEY must be set/);
        });

        it("skips ENCRYPTION_KEY check during phase-production-build", () => {
            expect(() =>
                parseEnv({
                    ENCRYPTION_KEY: undefined,
                    NEXT_PHASE: "phase-production-build",
                }),
            ).not.toThrow();
        });
    });

    describe("BETTER_AUTH_SECRET validation", () => {
        it("rejects secrets shorter than 32 characters", () => {
            expect(() =>
                parseEnv({
                    ...validRuntimeEnv,
                    BETTER_AUTH_SECRET: "short",
                }),
            ).toThrow(/at least 32 characters/);
        });
    });

    describe("APP_URL validation", () => {
        it("rejects a non-URL APP_URL", () => {
            expect(() =>
                parseEnv({ ...validRuntimeEnv, APP_URL: "not-a-url" }),
            ).toThrow(/APP_URL must be a valid URL/);
        });
    });

    describe("DEFAULT_STORAGE_TYPE validation", () => {
        it("defaults to local when unset", () => {
            const result = parseEnv(validRuntimeEnv);
            expect(result.DEFAULT_STORAGE_TYPE).toBe("local");
        });

        it("rejects unknown storage types", () => {
            expect(() =>
                parseEnv({
                    ...validRuntimeEnv,
                    DEFAULT_STORAGE_TYPE: "azure",
                }),
            ).toThrow(/Environment validation failed/);
        });
    });
});
