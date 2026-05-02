import { z } from "zod";

/**
 * Public environment variables (NEXT_PUBLIC_*) shared between server and
 * client. Next.js inlines these at build time, so reading them is safe in
 * both runtimes — but feature code should still go through this validated
 * surface rather than touching `process.env` directly.
 */

const intFromString = z
    .string()
    .optional()
    .transform((val, ctx) => {
        if (val === undefined) return undefined;
        const n = Number.parseInt(val, 10);
        if (Number.isNaN(n)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "must be an integer",
            });
            return z.NEVER;
        }
        return n;
    });

const boolFromString = z
    .string()
    .optional()
    .transform((val) => val !== "false");

const publicEnvSchema = z.object({
    NEXT_PUBLIC_SYNC_INTERVAL: intFromString.pipe(
        z.number().int().positive().optional(),
    ),
    NEXT_PUBLIC_MIN_SYNC_INTERVAL: intFromString.pipe(
        z.number().int().positive().optional(),
    ),
    NEXT_PUBLIC_SYNC_ON_MOUNT: boolFromString,
    NEXT_PUBLIC_SYNC_ON_VISIBILITY: boolFromString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type RawPublicEnvInput = Partial<Record<string, string | undefined>>;

export function parsePublicEnv(rawEnv: RawPublicEnvInput): PublicEnv {
    try {
        return publicEnvSchema.parse({
            NEXT_PUBLIC_SYNC_INTERVAL: rawEnv.NEXT_PUBLIC_SYNC_INTERVAL,
            NEXT_PUBLIC_MIN_SYNC_INTERVAL: rawEnv.NEXT_PUBLIC_MIN_SYNC_INTERVAL,
            NEXT_PUBLIC_SYNC_ON_MOUNT: rawEnv.NEXT_PUBLIC_SYNC_ON_MOUNT,
            NEXT_PUBLIC_SYNC_ON_VISIBILITY:
                rawEnv.NEXT_PUBLIC_SYNC_ON_VISIBILITY,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("\n");
            throw new Error(`Public environment validation failed:\n${issues}`);
        }
        throw error;
    }
}

/**
 * Parsed public env. Safe to import on the server and the client — Next.js
 * inlines the underlying NEXT_PUBLIC_* values at build time.
 */
export const publicEnv: PublicEnv = parsePublicEnv(process.env);
