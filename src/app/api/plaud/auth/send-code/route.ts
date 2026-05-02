import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaudSendCode } from "@/lib/plaud/auth";
import { RateLimiter } from "@/lib/rate-limit";

/**
 * Plaud's OTP endpoint sends an email/SMS, so an authenticated abuser
 * could spam recipients. 5 sends per (user, email) per 15 min is enough
 * for a legitimate retry+region-redirect path and stops abuse.
 */
const sendCodeLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
});

/**
 * POST /api/plaud/auth/send-code
 *
 * Proxies the OTP request to Plaud's API. The email and OTP token
 * pass straight through — we don't store either.
 *
 * Source: https://github.com/openplaud/openplaud/blob/main/src/app/api/plaud/auth/send-code/route.ts
 */
export async function POST(request: Request) {
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

        const { email } = await request.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 },
            );
        }

        const normalizedEmail = email.trim().toLowerCase();
        const limit = sendCodeLimiter.check(
            `${session.user.id}:${normalizedEmail}`,
        );
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Too many code requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(limit.retryAfterSec ?? 60),
                    },
                },
            );
        }

        const { token, apiBase } = await plaudSendCode(email.trim());

        return NextResponse.json({
            success: true,
            otpToken: token,
            apiBase,
        });
    } catch (error) {
        console.error("Error sending Plaud OTP:", error);
        // User-actionable Plaud errors (email not found, rate-limited,
        // region-redirect loop) all surface with a "Plaud API error:"
        // prefix — pass those through with a 400. Anything else is an
        // internal bug, generic message, 500.
        if (
            error instanceof Error &&
            error.message.startsWith("Plaud API error")
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to send verification code" },
            { status: 500 },
        );
    }
}
