import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/env", () => ({
    env: {
        LOCAL_STORAGE_PATH: "./storage",
    },
}));

import { LocalStorage } from "../lib/storage/local-storage";

describe("LocalStorage", () => {
    let baseDir: string;
    let storage: LocalStorage;

    beforeEach(async () => {
        baseDir = await mkdtemp(join(tmpdir(), "openplaud-local-storage-"));
        storage = new LocalStorage(baseDir);
    });

    afterEach(async () => {
        await rm(baseDir, { recursive: true, force: true });
    });

    describe("path traversal protection", () => {
        const buf = Buffer.from("payload");

        it("rejects '..' segments in key", async () => {
            await expect(
                storage.uploadFile("../escape.txt", buf, "text/plain"),
            ).rejects.toThrow(/path traversal detected/);
        });

        it("rejects deep '..' traversal", async () => {
            await expect(
                storage.uploadFile(
                    "foo/../../../../../etc/passwd",
                    buf,
                    "text/plain",
                ),
            ).rejects.toThrow(/path traversal detected/);
        });

        it("rejects absolute paths starting with /", async () => {
            await expect(
                storage.uploadFile("/etc/passwd", buf, "text/plain"),
            ).rejects.toThrow(/path traversal detected/);
        });

        it("rejects keys containing null bytes", async () => {
            await expect(
                storage.uploadFile("legit.txt\0evil", buf, "text/plain"),
            ).rejects.toThrow(/path traversal detected/);
        });

        it("normalizes backslashes and still rejects '..'", async () => {
            await expect(
                storage.uploadFile("..\\windows\\evil", buf, "text/plain"),
            ).rejects.toThrow(/path traversal detected/);
        });

        it("rejects download of traversal key", async () => {
            await expect(storage.downloadFile("../etc/passwd")).rejects.toThrow(
                /path traversal detected/,
            );
        });

        it("rejects delete of traversal key", async () => {
            await expect(storage.deleteFile("../etc/passwd")).rejects.toThrow(
                /path traversal detected/,
            );
        });
    });

    describe("happy path", () => {
        it("uploads and downloads round-trip", async () => {
            const original = Buffer.from("hello world");
            const returnedKey = await storage.uploadFile(
                "user-1/audio.mp3",
                original,
                "audio/mpeg",
            );
            expect(returnedKey).toBe("user-1/audio.mp3");

            const fetched = await storage.downloadFile("user-1/audio.mp3");
            expect(fetched.equals(original)).toBe(true);
        });

        it("creates nested directories on upload", async () => {
            await storage.uploadFile(
                "deeply/nested/path/file.bin",
                Buffer.from("ok"),
                "application/octet-stream",
            );

            const onDisk = await readFile(
                join(baseDir, "deeply/nested/path/file.bin"),
            );
            expect(onDisk.toString()).toBe("ok");
        });

        it("deletes existing files", async () => {
            await storage.uploadFile("tmp.txt", Buffer.from("x"), "text/plain");
            await storage.deleteFile("tmp.txt");
            await expect(storage.downloadFile("tmp.txt")).rejects.toThrow(
                /Failed to download/,
            );
        });

        it("returns local API URL from getSignedUrl with key encoded", async () => {
            const url = await storage.getSignedUrl(
                "user 1/file with space.mp3",
                60,
            );
            expect(url).toBe(
                "/api/recordings/audio/user%201%2Ffile%20with%20space.mp3",
            );
        });

        it("testConnection succeeds when baseDir is writable", async () => {
            const ok = await storage.testConnection();
            expect(ok).toBe(true);
        });

        it("testConnection returns false when baseDir cannot be created", async () => {
            // Point at a path under an existing file (not a directory) — mkdir fails.
            const blocker = join(baseDir, "blocker");
            await writeFile(blocker, "x");
            const broken = new LocalStorage(join(blocker, "subdir"));
            const ok = await broken.testConnection();
            expect(ok).toBe(false);
        });
    });

    describe("error wrapping", () => {
        it("wraps download errors for missing files", async () => {
            await expect(
                storage.downloadFile("does-not-exist"),
            ).rejects.toThrow(/Failed to download file from local storage/);
        });

        it("wraps delete errors for missing files", async () => {
            await expect(storage.deleteFile("does-not-exist")).rejects.toThrow(
                /Failed to delete file from local storage/,
            );
        });
    });
});
