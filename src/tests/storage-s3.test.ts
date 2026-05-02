import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, clientCtor, getSignedUrlMock } = vi.hoisted(() => ({
    sendMock: vi.fn(),
    clientCtor: vi.fn(),
    getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
    class S3Client {
        constructor(config: unknown) {
            clientCtor(config);
        }
        send = sendMock;
    }
    class PutObjectCommand {
        readonly _kind = "Put";
        constructor(public input: unknown) {}
    }
    class GetObjectCommand {
        readonly _kind = "Get";
        constructor(public input: unknown) {}
    }
    class DeleteObjectCommand {
        readonly _kind = "Delete";
        constructor(public input: unknown) {}
    }
    class HeadBucketCommand {
        readonly _kind = "Head";
        constructor(public input: unknown) {}
    }
    return {
        S3Client,
        PutObjectCommand,
        GetObjectCommand,
        DeleteObjectCommand,
        HeadBucketCommand,
    };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: getSignedUrlMock,
}));

import { S3Storage } from "../lib/storage/s3-storage";

const baseConfig = {
    bucket: "openplaud-test",
    region: "auto",
    accessKeyId: "AKIA_TEST",
    secretAccessKey: "secret",
};

describe("S3Storage", () => {
    beforeEach(() => {
        sendMock.mockReset();
        clientCtor.mockReset();
        getSignedUrlMock.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("passes credentials and region to the S3 client", () => {
            new S3Storage(baseConfig);
            expect(clientCtor).toHaveBeenCalledWith(
                expect.objectContaining({
                    region: "auto",
                    credentials: {
                        accessKeyId: "AKIA_TEST",
                        secretAccessKey: "secret",
                    },
                }),
            );
        });

        it("forces path-style addressing when a custom endpoint is given", () => {
            new S3Storage({
                ...baseConfig,
                endpoint: "https://accountid.r2.cloudflarestorage.com",
            });
            expect(clientCtor).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: "https://accountid.r2.cloudflarestorage.com",
                    forcePathStyle: true,
                }),
            );
        });

        it("does not set endpoint when none is configured (use AWS default)", () => {
            new S3Storage(baseConfig);
            const arg = clientCtor.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(arg.endpoint).toBeUndefined();
            expect(arg.forcePathStyle).toBeUndefined();
        });
    });

    describe("uploadFile", () => {
        it("issues a PutObjectCommand with bucket, key, body and content type", async () => {
            sendMock.mockResolvedValueOnce({});
            const storage = new S3Storage(baseConfig);
            const key = "user-1/audio.mp3";
            const body = Buffer.from("payload");

            const returned = await storage.uploadFile(key, body, "audio/mpeg");

            expect(returned).toBe(key);
            expect(sendMock).toHaveBeenCalledTimes(1);
            const command = sendMock.mock.calls[0]?.[0] as {
                _kind: string;
                input: Record<string, unknown>;
            };
            expect(command._kind).toBe("Put");
            expect(command.input).toEqual({
                Bucket: baseConfig.bucket,
                Key: key,
                Body: body,
                ContentType: "audio/mpeg",
            });
        });

        it("wraps SDK errors with a Failed to upload prefix", async () => {
            sendMock.mockRejectedValueOnce(new Error("AccessDenied"));
            const storage = new S3Storage(baseConfig);

            await expect(
                storage.uploadFile("k", Buffer.from(""), "text/plain"),
            ).rejects.toThrow(/Failed to upload file to S3.*AccessDenied/);
        });
    });

    describe("downloadFile", () => {
        it("streams the body chunks into a Buffer", async () => {
            const stream = Readable.from([
                Buffer.from("hel"),
                Buffer.from("lo"),
            ]);
            sendMock.mockResolvedValueOnce({ Body: stream });
            const storage = new S3Storage(baseConfig);

            const out = await storage.downloadFile("k");

            expect(out.toString()).toBe("hello");
            const command = sendMock.mock.calls[0]?.[0] as { _kind: string };
            expect(command._kind).toBe("Get");
        });

        it("throws when the response has no body", async () => {
            sendMock.mockResolvedValueOnce({});
            const storage = new S3Storage(baseConfig);

            await expect(storage.downloadFile("k")).rejects.toThrow(
                /Empty response body/,
            );
        });

        it("wraps SDK errors with a Failed to download prefix", async () => {
            sendMock.mockRejectedValueOnce(new Error("NoSuchKey"));
            const storage = new S3Storage(baseConfig);

            await expect(storage.downloadFile("k")).rejects.toThrow(
                /Failed to download file from S3.*NoSuchKey/,
            );
        });
    });

    describe("getSignedUrl", () => {
        it("delegates to the AWS presigner with the requested expiry", async () => {
            getSignedUrlMock.mockResolvedValueOnce("https://signed.example/k");
            const storage = new S3Storage(baseConfig);

            const url = await storage.getSignedUrl("k", 600);

            expect(url).toBe("https://signed.example/k");
            expect(getSignedUrlMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ _kind: "Get" }),
                { expiresIn: 600 },
            );
        });

        it("wraps presigner errors", async () => {
            getSignedUrlMock.mockRejectedValueOnce(new Error("clock skew"));
            const storage = new S3Storage(baseConfig);

            await expect(storage.getSignedUrl("k", 60)).rejects.toThrow(
                /Failed to generate signed URL.*clock skew/,
            );
        });
    });

    describe("deleteFile", () => {
        it("issues a DeleteObjectCommand", async () => {
            sendMock.mockResolvedValueOnce({});
            const storage = new S3Storage(baseConfig);

            await storage.deleteFile("user-1/audio.mp3");

            const command = sendMock.mock.calls[0]?.[0] as {
                _kind: string;
                input: Record<string, unknown>;
            };
            expect(command._kind).toBe("Delete");
            expect(command.input).toEqual({
                Bucket: baseConfig.bucket,
                Key: "user-1/audio.mp3",
            });
        });

        it("wraps SDK errors with a Failed to delete prefix", async () => {
            sendMock.mockRejectedValueOnce(new Error("Forbidden"));
            const storage = new S3Storage(baseConfig);

            await expect(storage.deleteFile("k")).rejects.toThrow(
                /Failed to delete file from S3.*Forbidden/,
            );
        });
    });

    describe("testConnection", () => {
        it("returns true when HeadBucket succeeds", async () => {
            sendMock.mockResolvedValueOnce({});
            const storage = new S3Storage(baseConfig);
            await expect(storage.testConnection()).resolves.toBe(true);
            const command = sendMock.mock.calls[0]?.[0] as { _kind: string };
            expect(command._kind).toBe("Head");
        });

        it("returns false when HeadBucket throws (e.g., bucket missing)", async () => {
            sendMock.mockRejectedValueOnce(new Error("NotFound"));
            const storage = new S3Storage(baseConfig);
            await expect(storage.testConnection()).resolves.toBe(false);
        });
    });
});
