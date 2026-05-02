import { and, desc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema";
import { auth } from "@/lib/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
    if (!raw) return DEFAULT_LIMIT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
}

function parseCursor(raw: string | null): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
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

        const url = new URL(request.url);
        const limit = parseLimit(url.searchParams.get("limit"));
        const cursor = parseCursor(url.searchParams.get("cursor"));

        const condition = cursor
            ? and(
                  eq(recordings.userId, session.user.id),
                  lt(recordings.startTime, cursor),
              )
            : eq(recordings.userId, session.user.id);

        const userRecordings = await db
            .select()
            .from(recordings)
            .where(condition)
            .orderBy(desc(recordings.startTime))
            .limit(limit + 1);

        const hasMore = userRecordings.length > limit;
        const page = hasMore ? userRecordings.slice(0, limit) : userRecordings;
        const nextCursor = hasMore
            ? (page[page.length - 1]?.startTime.toISOString() ?? null)
            : null;

        return NextResponse.json({
            recordings: page,
            nextCursor,
        });
    } catch (error) {
        console.error("Error fetching recordings:", error);
        return NextResponse.json(
            { error: "Failed to fetch recordings" },
            { status: 500 },
        );
    }
}
