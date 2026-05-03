import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { plaudConnections } from "@/db/schema";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

/**
 * Dev-only escape hatch: persist a Plaud bearer token (UT or WT) directly,
 * bypassing the OTP namespace issue.
 *
 * Use case: the OTP flow authenticates the email into Plaud's "API"
 * client-platform namespace, which for some accounts is split from the
 * "web" namespace where the user's recordings actually live (different
 * user_id under the same email — verifiable via /api/dev/plaud/info's
 * `creatorUserId` field). When that happens, no amount of OTP retries
 * will reach the right account. The fix is to copy the bearer token from
 * the user's logged-in app.plaud.ai session and inject it here.
 *
 * Body:
 *   {
 *     "bearerToken": "<the eyJhbG... JWT from app.plaud.ai's Authorization header>",
 *     "apiBase":     "https://api.plaud.ai" (default),
 *     "workspaceId": "ws_xxxxx" (the wid claim from the JWT),
 *     "plaudEmail":  "user@example.com"
 *   }
 *
 * If a WT (typ=WT, 24h life) is supplied, the PlaudClient's WT-mint step
 * will fail and fall back to using the supplied token directly as bearer
 * (`workspaceFallbackToUt`). That is enough to drive a full sync but the
 * connection will need re-injecting every 24h. For long-term operation,
 * supply a UT (typ=UT, ~300 day life) — Plaud Web stores one in
 * localStorage/cookies under a key the user can find via DevTools.
 *
 * Production-disabled.
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            );
        }

        const {
            bearerToken,
            apiBase = "https://api.plaud.ai",
            workspaceId,
            plaudEmail,
        } = body as Record<string, unknown>;

        if (typeof bearerToken !== "string" || !bearerToken.startsWith("eyJ")) {
            return NextResponse.json(
                {
                    error: "bearerToken must be a JWT (string starting with eyJ)",
                },
                { status: 400 },
            );
        }

        if (typeof apiBase !== "string" || !apiBase.startsWith("https://")) {
            return NextResponse.json(
                { error: "apiBase must be an https:// URL" },
                { status: 400 },
            );
        }

        if (
            workspaceId !== undefined &&
            workspaceId !== null &&
            typeof workspaceId !== "string"
        ) {
            return NextResponse.json(
                { error: "workspaceId must be a string or null" },
                { status: 400 },
            );
        }

        if (
            plaudEmail !== undefined &&
            plaudEmail !== null &&
            typeof plaudEmail !== "string"
        ) {
            return NextResponse.json(
                { error: "plaudEmail must be a string or null" },
                { status: 400 },
            );
        }

        const encrypted = encrypt(bearerToken);

        // Upsert: replace any existing connection for this user.
        const [existing] = await db
            .select({ id: plaudConnections.id })
            .from(plaudConnections)
            .where(eq(plaudConnections.userId, session.user.id))
            .limit(1);

        if (existing) {
            await db
                .update(plaudConnections)
                .set({
                    bearerToken: encrypted,
                    apiBase,
                    workspaceId: (workspaceId as string | null) ?? null,
                    plaudEmail: (plaudEmail as string | null) ?? null,
                    updatedAt: new Date(),
                })
                .where(eq(plaudConnections.userId, session.user.id));
        } else {
            await db.insert(plaudConnections).values({
                userId: session.user.id,
                bearerToken: encrypted,
                apiBase,
                workspaceId: (workspaceId as string | null) ?? null,
                plaudEmail: (plaudEmail as string | null) ?? null,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[dev/plaud/inject-token] error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to inject token",
            },
            { status: 500 },
        );
    }
}
