import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
        usePlural: true,
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        // Operator-controlled signup lockdown. When DISABLE_REGISTRATION=true,
        // better-auth's sign-up endpoint returns an error regardless of UI
        // state -- this is the actual security boundary. /register and /login
        // surface the same flag separately for UX. See issue #59.
        disableSignUp: env.DISABLE_REGISTRATION,
    },
    // In-memory token bucket per IP+path (stricter on the sign-in path
    // since password guessing is the obvious abuse vector). Self-hosted
    // single-instance only — multi-instance deployments need a shared
    // store; out of scope for now.
    rateLimit: {
        enabled: true,
        window: 60,
        max: 30,
        customRules: {
            "/sign-in/email": { window: 60, max: 5 },
            "/sign-up/email": { window: 60, max: 5 },
        },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
});

export type Session = typeof auth.$Infer.Session;
