import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
    env: {
        APP_URL: "https://openplaud.test",
    },
}));

import {
    sendBarkNotification,
    sendNewRecordingBarkNotification,
} from "../lib/notifications/bark";

const fetchMock = vi.fn();

describe("Bark notifications", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("sendBarkNotification", () => {
        it("POSTs JSON to the configured Bark URL", async () => {
            fetchMock.mockResolvedValueOnce(
                new Response("OK", { status: 200 }),
            );

            const ok = await sendBarkNotification("https://bark.example/key", {
                body: "hello",
            });

            expect(ok).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://bark.example/key");
            expect(init.method).toBe("POST");
            expect(
                (init.headers as Record<string, string>)["Content-Type"],
            ).toContain("application/json");
            const payload = JSON.parse(init.body as string);
            expect(payload).toEqual({ body: "hello" });
        });

        it("only includes optional fields that were provided", async () => {
            fetchMock.mockResolvedValueOnce(
                new Response("OK", { status: 200 }),
            );

            await sendBarkNotification("https://bark.example/key", {
                body: "msg",
                title: "T",
                badge: 3,
                level: "active",
                autoCopy: true,
            });

            const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
            const payload = JSON.parse(init.body as string);
            expect(payload).toEqual({
                body: "msg",
                title: "T",
                badge: 3,
                level: "active",
                autoCopy: "1",
            });
            expect(payload).not.toHaveProperty("subtitle");
            expect(payload).not.toHaveProperty("sound");
        });

        it("returns false when the Bark server responds with non-2xx", async () => {
            fetchMock.mockResolvedValueOnce(
                new Response("nope", { status: 500 }),
            );
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);

            const ok = await sendBarkNotification("https://bark.example/key", {
                body: "x",
            });

            expect(ok).toBe(false);
            expect(consoleError).toHaveBeenCalled();
        });

        it("returns false when fetch throws (network error)", async () => {
            fetchMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);

            const ok = await sendBarkNotification("https://bark.example/key", {
                body: "x",
            });

            expect(ok).toBe(false);
            expect(consoleError).toHaveBeenCalled();
        });

        it("aborts and returns false when the request exceeds the timeout", async () => {
            // Resolve fetch only after the timeout has fired so the AbortController
            // wins and rejects with an AbortError.
            fetchMock.mockImplementationOnce(
                (_url, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        const signal = init.signal as AbortSignal;
                        signal.addEventListener("abort", () => {
                            const err = new Error("aborted");
                            err.name = "AbortError";
                            reject(err);
                        });
                    }),
            );
            const consoleWarn = vi
                .spyOn(console, "warn")
                .mockImplementation(() => undefined);

            const ok = await sendBarkNotification(
                "https://bark.example/key",
                { body: "x" },
                10, // 10ms timeout
            );

            expect(ok).toBe(false);
            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringMatching(/timed out/),
            );
        });
    });

    describe("sendNewRecordingBarkNotification", () => {
        beforeEach(() => {
            fetchMock.mockResolvedValue(new Response("OK", { status: 200 }));
        });

        it("uses singular wording for 1 recording", async () => {
            await sendNewRecordingBarkNotification(
                "https://bark.example/key",
                1,
            );
            const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
            const payload = JSON.parse(init.body as string);
            expect(payload.title).toBe("New recording synced");
            expect(payload.body).toContain("A new recording");
            expect(payload.badge).toBe(1);
            expect(payload.url).toBe("https://openplaud.test/dashboard");
        });

        it("uses plural wording and includes recording names in subtitle", async () => {
            await sendNewRecordingBarkNotification(
                "https://bark.example/key",
                3,
                ["a.mp3", "b.mp3", "c.mp3", "d.mp3"],
            );
            const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
            const payload = JSON.parse(init.body as string);
            expect(payload.title).toBe("3 new recordings synced");
            // Only first 3 names included; ellipsis appended when more exist.
            expect(payload.subtitle).toBe("a.mp3, b.mp3, c.mp3...");
        });

        it("omits subtitle when no names provided", async () => {
            await sendNewRecordingBarkNotification(
                "https://bark.example/key",
                2,
            );
            const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
            const payload = JSON.parse(init.body as string);
            expect(payload).not.toHaveProperty("subtitle");
        });
    });
});
