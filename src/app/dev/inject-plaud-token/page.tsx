"use client";

import { useState } from "react";

/**
 * Dev-only UI for /api/dev/plaud/inject-token. Lets the user paste a
 * Plaud bearer JWT (typically copied from app.plaud.ai's Authorization
 * header) and persist it as the openplaud Plaud connection, bypassing
 * the OTP namespace issue.
 *
 * Hidden in production via the API route guard; the page itself is also
 * effectively useless without the API endpoint, so no separate gate.
 */
export default function InjectPlaudTokenPage() {
    const [bearerToken, setBearerToken] = useState("");
    const [apiBase, setApiBase] = useState("https://api.plaud.ai");
    const [workspaceId, setWorkspaceId] = useState("");
    const [plaudEmail, setPlaudEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);
        setIsError(false);
        try {
            const res = await fetch("/api/dev/plaud/inject-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bearerToken: bearerToken.trim(),
                    apiBase: apiBase.trim(),
                    workspaceId: workspaceId.trim() || null,
                    plaudEmail: plaudEmail.trim() || null,
                }),
            });
            const body = await res.json();
            setIsError(!res.ok);
            setResult(JSON.stringify(body, null, 2));
        } catch (err) {
            setIsError(true);
            setResult(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            style={{
                maxWidth: 720,
                margin: "40px auto",
                padding: 24,
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                Inject Plaud bearer token (dev)
            </h1>
            <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>
                Paste the Bearer JWT from a logged-in app.plaud.ai session
                (DevTools → Network → any /file/simple/web request → Headers →
                Authorization → after "Bearer "). Replaces any existing Plaud
                connection for the current openplaud user.
            </p>

            <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
                <label
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <span style={{ fontWeight: 600 }}>Bearer JWT</span>
                    <textarea
                        required
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        rows={6}
                        style={{
                            padding: 8,
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 12,
                            border: "1px solid #444",
                            background: "#111",
                            color: "#eee",
                            borderRadius: 4,
                        }}
                    />
                </label>

                <label
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <span style={{ fontWeight: 600 }}>API base</span>
                    <input
                        required
                        value={apiBase}
                        onChange={(e) => setApiBase(e.target.value)}
                        style={{
                            padding: 8,
                            border: "1px solid #444",
                            background: "#111",
                            color: "#eee",
                            borderRadius: 4,
                        }}
                    />
                </label>

                <label
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <span style={{ fontWeight: 600 }}>
                        Workspace ID (the wid claim from the JWT — optional but
                        recommended)
                    </span>
                    <input
                        value={workspaceId}
                        onChange={(e) => setWorkspaceId(e.target.value)}
                        placeholder="ws_xxxxxxxxxx"
                        style={{
                            padding: 8,
                            fontFamily: "ui-monospace, monospace",
                            border: "1px solid #444",
                            background: "#111",
                            color: "#eee",
                            borderRadius: 4,
                        }}
                    />
                </label>

                <label
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <span style={{ fontWeight: 600 }}>
                        Plaud email (informational)
                    </span>
                    <input
                        type="email"
                        value={plaudEmail}
                        onChange={(e) => setPlaudEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={{
                            padding: 8,
                            border: "1px solid #444",
                            background: "#111",
                            color: "#eee",
                            borderRadius: 4,
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={submitting || !bearerToken.trim()}
                    style={{
                        padding: "10px 16px",
                        background: "#e07a5f",
                        color: "#fff",
                        border: 0,
                        borderRadius: 4,
                        cursor: submitting ? "wait" : "pointer",
                        fontWeight: 600,
                        fontSize: 14,
                    }}
                >
                    {submitting ? "Saving..." : "Inject token"}
                </button>
            </form>

            {result && (
                <pre
                    style={{
                        marginTop: 24,
                        padding: 12,
                        background: isError ? "#3a1a1a" : "#1a3a1a",
                        color: "#eee",
                        border: `1px solid ${isError ? "#a44" : "#4a8"}`,
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 12,
                    }}
                >
                    {result}
                </pre>
            )}

            {result && !isError && (
                <p style={{ marginTop: 16, color: "#aaa", fontSize: 13 }}>
                    Now visit{" "}
                    <a href="/api/dev/plaud/info" style={{ color: "#e07a5f" }}>
                        /api/dev/plaud/info
                    </a>{" "}
                    to verify the connection, then{" "}
                    <a href="/dashboard" style={{ color: "#e07a5f" }}>
                        return to the dashboard
                    </a>{" "}
                    and click Sync Device.
                </p>
            )}
        </div>
    );
}
