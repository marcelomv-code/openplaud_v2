import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { envHolder, sendMailMock, createTransportMock } = vi.hoisted(() => ({
    envHolder: { env: {} as Record<string, unknown> },
    sendMailMock: vi.fn(),
    createTransportMock: vi.fn(),
}));

vi.mock("@/lib/env", () => envHolder);

vi.mock("nodemailer", () => ({
    default: {
        createTransport: createTransportMock,
    },
}));

vi.mock("@react-email/render", () => ({
    render: vi.fn().mockResolvedValue("<html>email body</html>"),
}));

vi.mock("../lib/notifications/email-templates/new-recording-email", () => ({
    NewRecordingEmail: () => null,
}));

vi.mock("../lib/notifications/email-templates/test-email", () => ({
    TestEmail: () => null,
}));

import {
    sendEmail,
    sendEmailWithError,
    sendNewRecordingEmail,
} from "../lib/notifications/email";

const fullSmtp = {
    SMTP_HOST: "smtp.example",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: "user@example.com",
    SMTP_PASSWORD: "secret",
    SMTP_FROM: "OpenPlaud <noreply@openplaud.com>",
    APP_URL: "https://openplaud.test",
};

describe("Email notifications", () => {
    beforeEach(() => {
        envHolder.env = {};
        sendMailMock.mockReset();
        createTransportMock.mockReset();
        createTransportMock.mockReturnValue({
            sendMail: sendMailMock,
        });
        // The email module memoizes the transporter in module scope. Reset
        // module registry so each test starts with a fresh transporter.
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("sendEmail", () => {
        it("returns false (with warn) when SMTP is not configured", async () => {
            envHolder.env = {};
            const consoleWarn = vi
                .spyOn(console, "warn")
                .mockImplementation(() => undefined);
            const fresh = await import("../lib/notifications/email");

            const ok = await fresh.sendEmail({
                to: "x@y.com",
                subject: "s",
                html: "<p>h</p>",
            });

            expect(ok).toBe(false);
            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringMatching(/SMTP not configured/),
            );
            expect(createTransportMock).not.toHaveBeenCalled();
        });

        it("creates a transporter once and reuses it across sends", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockResolvedValue({ messageId: "abc" });
            const fresh = await import("../lib/notifications/email");

            await fresh.sendEmail({
                to: "a@b.com",
                subject: "s1",
                html: "<p>1</p>",
            });
            await fresh.sendEmail({
                to: "c@d.com",
                subject: "s2",
                html: "<p>2</p>",
            });

            expect(createTransportMock).toHaveBeenCalledTimes(1);
            expect(sendMailMock).toHaveBeenCalledTimes(2);
        });

        it("falls back to SMTP_USER when SMTP_FROM is unset", async () => {
            envHolder.env = { ...fullSmtp, SMTP_FROM: undefined };
            sendMailMock.mockResolvedValue({});
            const fresh = await import("../lib/notifications/email");

            await fresh.sendEmail({
                to: "x@y.com",
                subject: "s",
                html: "<p>h</p>",
            });

            const arg = sendMailMock.mock.calls[0]?.[0] as { from: string };
            expect(arg.from).toBe(fullSmtp.SMTP_USER);
        });

        it("derives plain-text body by stripping HTML tags when text is omitted", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockResolvedValue({});
            const fresh = await import("../lib/notifications/email");

            await fresh.sendEmail({
                to: "x@y.com",
                subject: "s",
                html: "<p>Hello <b>world</b></p>",
            });

            const arg = sendMailMock.mock.calls[0]?.[0] as { text: string };
            expect(arg.text).toBe("Hello world");
        });

        it("returns false (with error log) on transport failure", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockRejectedValue(new Error("ECONNRESET"));
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            const fresh = await import("../lib/notifications/email");

            const ok = await fresh.sendEmail({
                to: "x@y.com",
                subject: "s",
                html: "<p>h</p>",
            });

            expect(ok).toBe(false);
            expect(consoleError).toHaveBeenCalled();
        });
    });

    describe("sendEmailWithError", () => {
        it("throws a configuration error when SMTP is missing", async () => {
            envHolder.env = {};
            const fresh = await import("../lib/notifications/email");

            await expect(
                fresh.sendEmailWithError({
                    to: "x@y.com",
                    subject: "s",
                    html: "h",
                }),
            ).rejects.toThrow(/SMTP not configured/);
        });

        it("rewrites ETIMEDOUT/CONN errors with a host:port hint", async () => {
            envHolder.env = fullSmtp;
            const err = Object.assign(new Error("timeout"), {
                code: "ETIMEDOUT",
                command: "CONN",
            });
            sendMailMock.mockRejectedValueOnce(err);
            const fresh = await import("../lib/notifications/email");

            await expect(
                fresh.sendEmailWithError({
                    to: "x@y.com",
                    subject: "s",
                    html: "h",
                }),
            ).rejects.toThrow(
                /Cannot connect to SMTP server at smtp\.example:587/,
            );
        });

        it("rewrites EAUTH errors with a credentials hint", async () => {
            envHolder.env = fullSmtp;
            const err = Object.assign(new Error("bad creds"), {
                code: "EAUTH",
            });
            sendMailMock.mockRejectedValueOnce(err);
            const fresh = await import("../lib/notifications/email");

            await expect(
                fresh.sendEmailWithError({
                    to: "x@y.com",
                    subject: "s",
                    html: "h",
                }),
            ).rejects.toThrow(/SMTP authentication failed/);
        });

        it("falls back to a generic 'SMTP error: <message>' for unknown failures", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockRejectedValueOnce(new Error("rate limited"));
            const fresh = await import("../lib/notifications/email");

            await expect(
                fresh.sendEmailWithError({
                    to: "x@y.com",
                    subject: "s",
                    html: "h",
                }),
            ).rejects.toThrow(/SMTP error: rate limited/);
        });
    });

    describe("sendNewRecordingEmail", () => {
        it("renders the React Email component and forwards it to sendEmail", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockResolvedValue({});
            const fresh = await import("../lib/notifications/email");

            const ok = await fresh.sendNewRecordingEmail(
                "user@example.com",
                2,
                ["rec-a", "rec-b"],
            );

            expect(ok).toBe(true);
            const arg = sendMailMock.mock.calls[0]?.[0] as {
                to: string;
                subject: string;
                html: string;
                text: string;
            };
            expect(arg.to).toBe("user@example.com");
            expect(arg.subject).toBe("2 new recordings synced");
            expect(arg.html).toBe("<html>email body</html>");
            expect(arg.text).toContain("rec-a");
            expect(arg.text).toContain("rec-b");
        });

        it("uses singular subject for one recording", async () => {
            envHolder.env = fullSmtp;
            sendMailMock.mockResolvedValue({});
            const fresh = await import("../lib/notifications/email");

            await fresh.sendNewRecordingEmail("user@example.com", 1);

            const arg = sendMailMock.mock.calls[0]?.[0] as { subject: string };
            expect(arg.subject).toBe("New recording synced");
        });
    });

    // Importing the entry-point references kept stable to satisfy lints.
    void sendEmail;
    void sendEmailWithError;
    void sendNewRecordingEmail;
});
