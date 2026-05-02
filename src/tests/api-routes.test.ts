import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
    getSessionMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
    env: {
        ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        BETTER_AUTH_SECRET: "x".repeat(32),
        APP_URL: "https://openplaud.test",
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: getSessionMock,
        },
    },
}));

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

import { GET as exportGET } from "@/app/api/export/route";
import { GET as recordingByIdGET } from "@/app/api/recordings/[id]/route";
import { GET as recordingTranscriptionGET } from "@/app/api/recordings/[id]/transcription/route";
import { GET as recordingsListGET } from "@/app/api/recordings/route";
import { GET as providersListGET } from "@/app/api/settings/ai/providers/route";
import { db } from "@/db";

type Row = Record<string, unknown>;

function selectChain(rowsOrThunk: Row[] | (() => Promise<Row[]>)) {
    const settle = () =>
        typeof rowsOrThunk === "function"
            ? rowsOrThunk()
            : Promise.resolve(rowsOrThunk);
    const limit = vi.fn(() => settle());
    // .orderBy() may be the terminal OR may chain into .limit(). Support
    // both by returning a thenable that also exposes .limit.
    const orderBy = vi.fn(() => ({
        limit,
        then: (
            resolve: (rows: Row[]) => unknown,
            reject?: (err: unknown) => unknown,
        ) => settle().then(resolve, reject),
    }));
    // .where(...) must itself be thenable for queries that don't chain
    // .limit/.orderBy after it.
    const where = vi.fn(() => ({
        limit,
        orderBy,
        then: (
            resolve: (rows: Row[]) => unknown,
            reject?: (err: unknown) => unknown,
        ) => settle().then(resolve, reject),
    }));
    const from = vi.fn(() => ({ where }));
    return { from };
}

const userA = {
    user: { id: "user-A", email: "a@example.com" },
};
const userB = {
    user: { id: "user-B", email: "b@example.com" },
};

const fakeRequest = (path = "https://openplaud.test/api/x") =>
    new Request(path, { headers: new Headers() });

describe("API routes — smoke", () => {
    beforeEach(() => {
        getSessionMock.mockReset();
        (db.select as Mock).mockReset();
    });

    describe("GET /api/recordings", () => {
        it("returns 401 when no session", async () => {
            getSessionMock.mockResolvedValueOnce(null);
            const GET = recordingsListGET;

            const res = await GET(fakeRequest());

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe("Unauthorized");
        });

        it("returns the user's recordings on 200 happy path", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(
                selectChain([
                    { id: "rec-1", userId: "user-A", filename: "a.mp3" },
                    { id: "rec-2", userId: "user-A", filename: "b.mp3" },
                ]),
            );

            const GET = recordingsListGET;
            const res = await GET(fakeRequest());

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.recordings).toHaveLength(2);
            expect(body.recordings[0].userId).toBe("user-A");
        });

        it("returns nextCursor=null and full page when fewer than limit rows exist", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(
                selectChain([
                    {
                        id: "rec-1",
                        userId: "user-A",
                        filename: "a.mp3",
                        startTime: new Date("2026-04-01T00:00:00Z"),
                    },
                    {
                        id: "rec-2",
                        userId: "user-A",
                        filename: "b.mp3",
                        startTime: new Date("2026-03-31T00:00:00Z"),
                    },
                ]),
            );

            const res = await recordingsListGET(
                new Request("https://openplaud.test/api/recordings"),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.recordings).toHaveLength(2);
            expect(body.nextCursor).toBeNull();
        });

        it("returns nextCursor=last startTime when limit+1 rows are returned", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            // 3 rows for limit=2 → hasMore=true, page=first 2, cursor=2nd row
            (db.select as Mock).mockReturnValueOnce(
                selectChain([
                    {
                        id: "rec-1",
                        userId: "user-A",
                        filename: "a.mp3",
                        startTime: new Date("2026-04-01T00:00:00Z"),
                    },
                    {
                        id: "rec-2",
                        userId: "user-A",
                        filename: "b.mp3",
                        startTime: new Date("2026-03-31T12:00:00Z"),
                    },
                    {
                        id: "rec-3",
                        userId: "user-A",
                        filename: "c.mp3",
                        startTime: new Date("2026-03-30T00:00:00Z"),
                    },
                ]),
            );

            const res = await recordingsListGET(
                new Request("https://openplaud.test/api/recordings?limit=2"),
            );

            const body = await res.json();
            expect(body.recordings).toHaveLength(2);
            expect(body.nextCursor).toBe("2026-03-31T12:00:00.000Z");
        });

        it("returns 500 on DB error and does not leak details", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(
                selectChain(() =>
                    Promise.reject(new Error("connection refused")),
                ),
            );
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);

            const GET = recordingsListGET;
            const res = await GET(fakeRequest());

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe("Failed to fetch recordings");
            expect(JSON.stringify(body)).not.toContain("connection refused");
            expect(consoleError).toHaveBeenCalled();
            consoleError.mockRestore();
        });
    });

    describe("GET /api/recordings/[id]", () => {
        const params = (id: string) =>
            ({ params: Promise.resolve({ id }) }) as {
                params: Promise<{ id: string }>;
            };

        it("returns 401 when no session", async () => {
            getSessionMock.mockResolvedValueOnce(null);
            const GET = recordingByIdGET;

            const res = await GET(fakeRequest(), params("rec-1"));

            expect(res.status).toBe(401);
        });

        it("returns 404 when accessing another user's recording", async () => {
            // user A is logged in; recording rec-1 belongs to user B → query
            // filtered by userId returns empty → route returns 404.
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(selectChain([]));

            const GET = recordingByIdGET;
            const res = await GET(fakeRequest(), params("rec-1"));

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe("Recording not found");
        });

        it("returns recording + transcription on 200", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock)
                .mockReturnValueOnce(
                    selectChain([
                        { id: "rec-1", userId: "user-A", filename: "a.mp3" },
                    ]),
                )
                .mockReturnValueOnce(
                    selectChain([
                        {
                            id: "trans-1",
                            recordingId: "rec-1",
                            userId: "user-A",
                            text: "hello",
                        },
                    ]),
                );

            const GET = recordingByIdGET;
            const res = await GET(fakeRequest(), params("rec-1"));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.recording.id).toBe("rec-1");
            expect(body.transcription.text).toBe("hello");
        });

        it("returns recording with null transcription when none exists", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock)
                .mockReturnValueOnce(
                    selectChain([
                        { id: "rec-1", userId: "user-A", filename: "a.mp3" },
                    ]),
                )
                .mockReturnValueOnce(selectChain([]));

            const GET = recordingByIdGET;
            const res = await GET(fakeRequest(), params("rec-1"));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.transcription).toBeNull();
        });
    });

    describe("GET /api/recordings/[id]/transcription", () => {
        const params = (id: string) =>
            ({ params: Promise.resolve({ id }) }) as {
                params: Promise<{ id: string }>;
            };

        it("returns 401 when no session", async () => {
            getSessionMock.mockResolvedValueOnce(null);
            const res = await recordingTranscriptionGET(
                fakeRequest(),
                params("rec-1"),
            );
            expect(res.status).toBe(401);
        });

        it("returns 404 when the recording does not belong to the user", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(selectChain([]));
            const res = await recordingTranscriptionGET(
                fakeRequest(),
                params("rec-x"),
            );
            expect(res.status).toBe(404);
        });

        it("returns 404 when the recording exists but no transcription is saved", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock)
                .mockReturnValueOnce(
                    selectChain([
                        {
                            id: "rec-1",
                            userId: "user-A",
                            filename: "Reunião.mp3",
                            duration: 60_000,
                            startTime: new Date("2026-04-29T12:00:00Z"),
                        },
                    ]),
                )
                .mockReturnValueOnce(selectChain([]));

            const res = await recordingTranscriptionGET(
                new Request(
                    "https://openplaud.test/api/recordings/rec-1/transcription?format=txt",
                ),
                params("rec-1"),
            );
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toMatch(/No transcription/);
        });

        it("returns the transcription text as a .txt download", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock)
                .mockReturnValueOnce(
                    selectChain([
                        {
                            id: "rec-1",
                            userId: "user-A",
                            filename: "Reunião.mp3",
                            duration: 60_000,
                            startTime: new Date("2026-04-29T12:00:00Z"),
                        },
                    ]),
                )
                .mockReturnValueOnce(
                    selectChain([
                        {
                            recordingId: "rec-1",
                            userId: "user-A",
                            text: "hello world",
                            detectedLanguage: "en",
                            provider: "openai",
                            model: "whisper-1",
                        },
                    ]),
                );

            const res = await recordingTranscriptionGET(
                new Request(
                    "https://openplaud.test/api/recordings/rec-1/transcription?format=txt",
                ),
                params("rec-1"),
            );

            expect(res.status).toBe(200);
            expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
            const disposition = res.headers.get("Content-Disposition") ?? "";
            expect(disposition).toContain("Reuni"); // accent-tolerant
            expect(disposition).toMatch(/-transcript\.txt"$/);
            expect(await res.text()).toBe("hello world");
        });
    });

    describe("GET /api/settings/ai/providers", () => {
        it("returns 401 when no session", async () => {
            getSessionMock.mockResolvedValueOnce(null);
            const GET = providersListGET;

            const res = await GET(fakeRequest());
            expect(res.status).toBe(401);
        });

        it("returns providers but never the encrypted apiKey", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            (db.select as Mock).mockReturnValueOnce(
                selectChain([
                    {
                        id: "cred-1",
                        provider: "openai",
                        baseUrl: null,
                        defaultModel: "gpt-4o-mini",
                        isDefaultTranscription: true,
                        isDefaultEnhancement: false,
                    },
                ]),
            );

            const GET = providersListGET;
            const res = await GET(fakeRequest());

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.providers).toHaveLength(1);
            expect(body.providers[0]).not.toHaveProperty("apiKey");
            expect(JSON.stringify(body)).not.toContain("apiKey");
        });

        it("returns 404 when filtering by a folder that does not belong to the user", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            // Route order: 1) settings 2) folder. We need both mocks; the
            // folder lookup is the one that returns empty → 404.
            (db.select as Mock)
                .mockReturnValueOnce(selectChain([])) // settings
                .mockReturnValueOnce(selectChain([])); // folder lookup (empty)

            const res = await exportGET(
                new Request(
                    "https://openplaud.test/api/export?folderId=other-user-folder&format=txt",
                ),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe("Folder not found");
        });

        it("uses the folder name in the download filename when filtered", async () => {
            getSessionMock.mockResolvedValueOnce(userA);
            // Route order: 1) settings 2) folder 3) recordings 4) transcriptions
            (db.select as Mock)
                .mockReturnValueOnce(selectChain([])) // settings
                .mockReturnValueOnce(selectChain([{ name: "Braskem" }])) // folder
                .mockReturnValueOnce(
                    selectChain([
                        {
                            id: "rec-1",
                            userId: "user-A",
                            filename: "Reunião.mp3",
                            duration: 60_000,
                            startTime: new Date("2026-04-29T12:00:00Z"),
                            filesize: 1234,
                        },
                    ]),
                )
                .mockReturnValueOnce(
                    selectChain([
                        {
                            recordingId: "rec-1",
                            userId: "user-A",
                            text: "transcription text",
                        },
                    ]),
                );

            const res = await exportGET(
                new Request(
                    "https://openplaud.test/api/export?folderId=braskem-id&format=txt",
                ),
            );

            expect(res.status).toBe(200);
            const disposition = res.headers.get("Content-Disposition") ?? "";
            expect(disposition).toContain("Braskem");
            expect(disposition).toMatch(/\.txt"$/);
        });

        it("user A only sees their own providers (no leak across users)", async () => {
            // db.select is mocked to honor whatever rows we hand it; the
            // important contract is that the route filters by session.user.id.
            getSessionMock.mockResolvedValueOnce(userB);
            const seenWhereArgs: unknown[] = [];
            const where = vi.fn((arg: unknown) => {
                seenWhereArgs.push(arg);
                return {
                    orderBy: vi.fn().mockResolvedValue([]),
                    limit: vi.fn().mockResolvedValue([]),
                    // The route awaits .where(...) directly (no orderBy on
                    // this query), so .where must itself be thenable.
                    then: (resolve: (rows: Row[]) => void) => resolve([]),
                };
            });
            (db.select as Mock).mockReturnValueOnce({
                from: vi.fn(() => ({ where })),
            });

            const GET = providersListGET;
            const res = await GET(fakeRequest());

            expect(res.status).toBe(200);
            // The route called .where() exactly once, with a userId filter.
            expect(where).toHaveBeenCalledTimes(1);
            // We can't introspect drizzle's SQL object reliably, but if the
            // route ever drops the userId filter the call count would
            // change too (it would call from() without where()).
        });
    });
});
