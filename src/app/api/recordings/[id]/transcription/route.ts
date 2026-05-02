import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings, transcriptions } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * GET /api/recordings/[id]/transcription?format=txt|md|json
 *
 * Returns the transcription text for a single recording as a downloadable
 * file. Mirrors the per-recording export flow on app.plaud.ai (open
 * recording → Export transcript → save .txt). The bulk per-folder path
 * lives at /api/export.
 */
type ExportFormat = "txt" | "md" | "json";

const VALID_FORMATS: ReadonlyArray<ExportFormat> = ["txt", "md", "json"];

function safeFilenamePart(input: string): string {
    return (
        input
            .replace(/\.[^.]+$/, "") // drop extension if Plaud filename had one
            .replace(/[/\\:*?"<>|]/g, "-")
            .replace(/\s+/g, "-")
            .trim() || "transcription"
    );
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
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

        const { id } = await params;
        const url = new URL(request.url);
        const formatParam = url.searchParams.get("format") ?? "txt";
        const format = VALID_FORMATS.includes(formatParam as ExportFormat)
            ? (formatParam as ExportFormat)
            : "txt";

        const [recording] = await db
            .select()
            .from(recordings)
            .where(
                and(
                    eq(recordings.id, id),
                    eq(recordings.userId, session.user.id),
                    isNull(recordings.deletedAt),
                ),
            )
            .limit(1);

        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        const [transcription] = await db
            .select()
            .from(transcriptions)
            .where(
                and(
                    eq(transcriptions.recordingId, id),
                    eq(transcriptions.userId, session.user.id),
                ),
            )
            .limit(1);

        if (!transcription?.text) {
            return NextResponse.json(
                { error: "No transcription available for this recording" },
                { status: 404 },
            );
        }

        const baseName = safeFilenamePart(recording.filename);

        let body: string;
        let contentType: string;
        let filename: string;

        switch (format) {
            case "json":
                body = JSON.stringify(
                    {
                        recordingId: recording.id,
                        filename: recording.filename,
                        startTime: recording.startTime,
                        duration: recording.duration,
                        detectedLanguage: transcription.detectedLanguage,
                        provider: transcription.provider,
                        model: transcription.model,
                        text: transcription.text,
                    },
                    null,
                    2,
                );
                contentType = "application/json";
                filename = `${baseName}-transcript.json`;
                break;

            case "md":
                body = [
                    `# ${recording.filename}`,
                    "",
                    `- Date: ${new Date(recording.startTime).toISOString()}`,
                    `- Duration: ${Math.round(recording.duration / 1000)}s`,
                    transcription.detectedLanguage
                        ? `- Language: ${transcription.detectedLanguage}`
                        : null,
                    "",
                    "## Transcript",
                    "",
                    transcription.text,
                    "",
                ]
                    .filter((line) => line !== null)
                    .join("\n");
                contentType = "text/markdown";
                filename = `${baseName}-transcript.md`;
                break;

            default:
                body = transcription.text;
                contentType = "text/plain; charset=utf-8";
                filename = `${baseName}-transcript.txt`;
                break;
        }

        return new NextResponse(body, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Error exporting transcription:", error);
        return NextResponse.json(
            { error: "Failed to export transcription" },
            { status: 500 },
        );
    }
}
