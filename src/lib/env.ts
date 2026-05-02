import { type Env, parseEnv } from "./env-schema";

export type { Env, RawEnvInput } from "./env-schema";
export { parseEnv } from "./env-schema";

function validateEnv(): Env {
    if (typeof window !== "undefined") {
        throw new Error(
            "Environment variables cannot be accessed on the client side. " +
                "This module should only be imported in server-side code (API routes, server components, etc.).",
        );
    }
    return parseEnv(process.env);
}

export const env = validateEnv();
