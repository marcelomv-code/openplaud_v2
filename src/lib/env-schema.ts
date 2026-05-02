import { z } from "zod";

const envSchema = z.object({
    // Server-required values are optional at schema level so that `next build`
    // (phase-production-build) doesn't depend on server-only secrets.
    DATABASE_URL: z.string().optional(),

    BETTER_AUTH_SECRET: z.string().optional(),
    APP_URL: z.string().url("APP_URL must be a valid URL").optional(),

    // Encryption
    // Optional at env-schema level so that builds don't fail if it's missing;
    // encryption code is responsible for enforcing a strong key at runtime.
    ENCRYPTION_KEY: z.string().optional(),

    DEFAULT_STORAGE_TYPE: z.enum(["local", "s3"]).optional().default("local"),
    LOCAL_STORAGE_PATH: z.string().optional().default("./storage"),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : undefined)),
    SMTP_SECURE: z
        .string()
        .optional()
        .transform((val) => val === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z
        .string()
        .optional()
        .refine(
            (val) => {
                if (!val) return true;
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const nameEmailRegex = /^.+ <[^\s@]+@[^\s@]+\.[^\s@]+>$/;
                return emailRegex.test(val) || nameEmailRegex.test(val);
            },
            {
                message:
                    'SMTP_FROM must be an email address (e.g., "user@example.com") or formatted as "Name <user@example.com>"',
            },
        ),
});

export type Env = z.infer<typeof envSchema>;

export type RawEnvInput = Partial<Record<string, string | undefined>>;

export function parseEnv(rawEnv: RawEnvInput): Env {
    try {
        const parsed = envSchema.parse({
            DATABASE_URL: rawEnv.DATABASE_URL,
            BETTER_AUTH_SECRET: rawEnv.BETTER_AUTH_SECRET,
            APP_URL: rawEnv.APP_URL,
            ENCRYPTION_KEY: rawEnv.ENCRYPTION_KEY,
            DEFAULT_STORAGE_TYPE: rawEnv.DEFAULT_STORAGE_TYPE,
            LOCAL_STORAGE_PATH: rawEnv.LOCAL_STORAGE_PATH,
            S3_ENDPOINT: rawEnv.S3_ENDPOINT,
            S3_BUCKET: rawEnv.S3_BUCKET,
            S3_REGION: rawEnv.S3_REGION,
            S3_ACCESS_KEY_ID: rawEnv.S3_ACCESS_KEY_ID,
            S3_SECRET_ACCESS_KEY: rawEnv.S3_SECRET_ACCESS_KEY,
            SMTP_HOST: rawEnv.SMTP_HOST,
            SMTP_PORT: rawEnv.SMTP_PORT,
            SMTP_SECURE: rawEnv.SMTP_SECURE,
            SMTP_USER: rawEnv.SMTP_USER,
            SMTP_PASSWORD: rawEnv.SMTP_PASSWORD,
            SMTP_FROM: rawEnv.SMTP_FROM,
        });

        // In runtime (dev/prod servers), we require a strong encryption key.
        // During `next build` (phase-production-build) we skip this so that
        // server-only config doesn't break the frontend build.
        const isProductionBuildPhase =
            rawEnv.NEXT_PHASE === "phase-production-build";

        if (!isProductionBuildPhase) {
            if (!parsed.DATABASE_URL) {
                throw new Error(
                    "DATABASE_URL must be set in non-build runtime (dev/prod server)",
                );
            }

            if (!parsed.BETTER_AUTH_SECRET) {
                throw new Error(
                    "BETTER_AUTH_SECRET must be set in non-build runtime (dev/prod server)",
                );
            }
            if (parsed.BETTER_AUTH_SECRET.length < 32) {
                throw new Error(
                    "BETTER_AUTH_SECRET must be at least 32 characters",
                );
            }

            if (!parsed.APP_URL) {
                throw new Error(
                    "APP_URL must be set in non-build runtime (dev/prod server)",
                );
            }

            const key = parsed.ENCRYPTION_KEY;
            if (!key) {
                throw new Error(
                    "ENCRYPTION_KEY must be set in non-build runtime (dev/prod server)",
                );
            }
            const isValidHexKey = /^[0-9a-fA-F]{64}$/.test(key);
            if (!isValidHexKey) {
                throw new Error(
                    "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
                );
            }
        }

        return parsed;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("\n");
            throw new Error(`Environment validation failed:\n${issues}`);
        }
        throw error;
    }
}
