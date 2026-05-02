import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/env", () => ({
    env: {
        ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
}));

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted-${value}`),
}));

const { openaiCreate, openaiConstructor } = vi.hoisted(() => ({
    openaiCreate: vi.fn(),
    openaiConstructor: vi.fn(),
}));

vi.mock("openai", () => {
    class OpenAIMock {
        chat = { completions: { create: openaiCreate } };
        constructor(config: unknown) {
            openaiConstructor(config);
        }
    }
    return { OpenAI: OpenAIMock };
});

import { db } from "@/db";
import { generateTitleFromTranscription } from "@/lib/ai/generate-title";

type Row = Record<string, unknown>;

function chainResolving(rows: Row[]) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(rows),
            }),
        }),
    };
}

function setupDb(args: {
    userSettings?: Row[];
    enhancement?: Row[];
    transcription?: Row[];
}) {
    (db.select as Mock).mockReset();
    (db.select as Mock)
        .mockReturnValueOnce(chainResolving(args.userSettings ?? []))
        .mockReturnValueOnce(chainResolving(args.enhancement ?? []))
        .mockReturnValueOnce(chainResolving(args.transcription ?? []));
}

const credentials = {
    apiKey: "encrypted-key",
    baseUrl: "https://api.example.com/v1",
    defaultModel: "gpt-4o-mini",
};

describe("generateTitleFromTranscription", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when no AI provider is configured", async () => {
        setupDb({});
        const title = await generateTitleFromTranscription(
            "user-1",
            "Discussing the Q4 product roadmap with the engineering team.",
        );
        expect(title).toBeNull();
        expect(openaiConstructor).not.toHaveBeenCalled();
    });

    it("returns the AI-generated title trimmed of surrounding quotes", async () => {
        setupDb({ enhancement: [credentials] });
        openaiCreate.mockResolvedValueOnce({
            choices: [
                { message: { content: '"Q4 Roadmap Engineering Sync"' } },
            ],
        });

        const title = await generateTitleFromTranscription(
            "user-1",
            "transcription text",
        );

        expect(title).toBe("Q4 Roadmap Engineering Sync");
    });

    it("strips colons and semicolons from the AI output", async () => {
        setupDb({ enhancement: [credentials] });
        openaiCreate.mockResolvedValueOnce({
            choices: [
                { message: { content: "Sprint Review: Velocity; Update" } },
            ],
        });

        const title = await generateTitleFromTranscription(
            "user-1",
            "transcription",
        );

        expect(title).toBe("Sprint Review Velocity Update");
    });

    it("truncates the cleaned title to 60 chars with an ellipsis", async () => {
        setupDb({ enhancement: [credentials] });
        const longTitle = "A".repeat(80);
        openaiCreate.mockResolvedValueOnce({
            choices: [{ message: { content: longTitle } }],
        });

        const title = await generateTitleFromTranscription(
            "user-1",
            "transcription",
        );

        expect(title).toHaveLength(60);
        expect(title?.endsWith("...")).toBe(true);
    });

    it("truncates the input transcription to 2000 chars before sending to the model", async () => {
        setupDb({ enhancement: [credentials] });
        openaiCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "Long Recording Summary" } }],
        });

        const huge = "x".repeat(5000);
        await generateTitleFromTranscription("user-1", huge);

        const call = openaiCreate.mock.calls[0]?.[0];
        const userPrompt = call.messages.find(
            (m: { role: string }) => m.role === "user",
        ).content;
        expect(userPrompt.length).toBeLessThanOrEqual(2000 + 5000);
        expect(userPrompt).toContain(`${"x".repeat(2000)}...`);
        expect(userPrompt).not.toContain("x".repeat(2001));
    });

    it("falls back to gpt-4o-mini when the configured model is a Whisper variant", async () => {
        setupDb({
            enhancement: [{ ...credentials, defaultModel: "whisper-large-v3" }],
        });
        openaiCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "Title" } }],
        });

        await generateTitleFromTranscription("user-1", "text");

        expect(openaiCreate).toHaveBeenCalledWith(
            expect.objectContaining({ model: "gpt-4o-mini" }),
        );
    });

    it("uses the transcription provider when no enhancement provider is set", async () => {
        setupDb({ transcription: [credentials] });
        openaiCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "Fallback Title" } }],
        });

        const title = await generateTitleFromTranscription("user-1", "text");

        expect(title).toBe("Fallback Title");
        expect(openaiConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: credentials.baseUrl }),
        );
    });

    it("returns null and logs when the OpenAI call throws", async () => {
        setupDb({ enhancement: [credentials] });
        openaiCreate.mockRejectedValueOnce(new Error("network down"));
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        const title = await generateTitleFromTranscription("user-1", "text");

        expect(title).toBeNull();
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it("returns null when the AI response has no content", async () => {
        setupDb({ enhancement: [credentials] });
        openaiCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "" } }],
        });

        const title = await generateTitleFromTranscription("user-1", "text");

        expect(title).toBeNull();
    });
});
