import { afterEach, describe, expect, it, vi } from "vitest";

const { envHolder } = vi.hoisted(() => ({
    envHolder: { env: {} as Record<string, unknown> },
}));

vi.mock("../lib/env", () => envHolder);

vi.mock("../lib/storage/s3-storage", () => {
    class S3StorageMock {
        config: unknown;
        constructor(config: unknown) {
            this.config = config;
        }
    }
    return { S3Storage: S3StorageMock };
});

import {
    createStorageProvider,
    createUserStorageProvider,
} from "../lib/storage/factory";
import { LocalStorage } from "../lib/storage/local-storage";
import { S3Storage } from "../lib/storage/s3-storage";

const validS3Env = {
    DEFAULT_STORAGE_TYPE: "s3",
    S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    S3_BUCKET: "openplaud-test",
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "AKIA_TEST",
    S3_SECRET_ACCESS_KEY: "secret",
};

describe("createStorageProvider", () => {
    afterEach(() => {
        envHolder.env = {};
    });

    it("returns LocalStorage when DEFAULT_STORAGE_TYPE is local", () => {
        envHolder.env = {
            DEFAULT_STORAGE_TYPE: "local",
            LOCAL_STORAGE_PATH: "./storage",
        };
        const provider = createStorageProvider();
        expect(provider).toBeInstanceOf(LocalStorage);
    });

    it("returns S3Storage when DEFAULT_STORAGE_TYPE is s3 with all required vars", () => {
        envHolder.env = validS3Env;
        const provider = createStorageProvider();
        expect(provider).toBeInstanceOf(S3Storage);
        expect((provider as unknown as { config: unknown }).config).toEqual({
            endpoint: validS3Env.S3_ENDPOINT,
            bucket: validS3Env.S3_BUCKET,
            region: validS3Env.S3_REGION,
            accessKeyId: validS3Env.S3_ACCESS_KEY_ID,
            secretAccessKey: validS3Env.S3_SECRET_ACCESS_KEY,
        });
    });

    it("throws when DEFAULT_STORAGE_TYPE is s3 and S3_BUCKET is missing", () => {
        envHolder.env = { ...validS3Env, S3_BUCKET: undefined };
        expect(() => createStorageProvider()).toThrow(
            /S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/,
        );
    });

    it("throws when DEFAULT_STORAGE_TYPE is s3 and S3_REGION is missing", () => {
        envHolder.env = { ...validS3Env, S3_REGION: undefined };
        expect(() => createStorageProvider()).toThrow(
            /required environment variables are missing/,
        );
    });

    it("throws when DEFAULT_STORAGE_TYPE is s3 and S3_ACCESS_KEY_ID is missing", () => {
        envHolder.env = { ...validS3Env, S3_ACCESS_KEY_ID: undefined };
        expect(() => createStorageProvider()).toThrow(
            /required environment variables are missing/,
        );
    });

    it("throws when DEFAULT_STORAGE_TYPE is s3 and S3_SECRET_ACCESS_KEY is missing", () => {
        envHolder.env = { ...validS3Env, S3_SECRET_ACCESS_KEY: undefined };
        expect(() => createStorageProvider()).toThrow(
            /required environment variables are missing/,
        );
    });

    it("throws on unknown storage type", () => {
        envHolder.env = { DEFAULT_STORAGE_TYPE: "azure" };
        expect(() => createStorageProvider()).toThrow(
            /Unsupported storage type: azure/,
        );
    });
});

describe("createUserStorageProvider", () => {
    afterEach(() => {
        envHolder.env = {};
    });

    it("delegates to createStorageProvider regardless of userId", async () => {
        envHolder.env = {
            DEFAULT_STORAGE_TYPE: "local",
            LOCAL_STORAGE_PATH: "./storage",
        };
        const a = await createUserStorageProvider("user-a");
        const b = await createUserStorageProvider("user-b");
        expect(a).toBeInstanceOf(LocalStorage);
        expect(b).toBeInstanceOf(LocalStorage);
    });
});
