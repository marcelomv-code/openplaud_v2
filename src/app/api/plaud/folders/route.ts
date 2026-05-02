import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { plaudConnections } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createPlaudClient } from "@/lib/plaud/client-factory";

/**
 * GET /api/plaud/folders
 *
 * Returns the list of Plaud folders ("filetags") for the authenticated
 * user, fetched live from the Plaud API. Used to populate the folder
 * picker in the UI (export by folder, sync filtering).
 *
 * If the workspace_id changes during the call (e.g. cache was stale and
 * we re-discovered), persist it back so the next call hits the cached
 * path.
 */
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

        const [connection] = await db
            .select()
            .from(plaudConnections)
            .where(eq(plaudConnections.userId, session.user.id))
            .limit(1);

        if (!connection) {
            return NextResponse.json(
                {
                    error: "Plaud connection not found. Connect your account first.",
                },
                { status: 404 },
            );
        }

        const client = await createPlaudClient(
            connection.bearerToken,
            connection.apiBase,
            connection.workspaceId,
        );

        const response = await client.listFolders();

        // Persist the workspace_id back if it was discovered/refreshed.
        if (
            client.workspaceId &&
            client.workspaceId !== connection.workspaceId
        ) {
            await db
                .update(plaudConnections)
                .set({ workspaceId: client.workspaceId })
                .where(eq(plaudConnections.userId, session.user.id));
        }

        return NextResponse.json({
            folders: response.data_filetag_list.map((f) => ({
                id: f.id,
                name: f.name,
                icon: f.icon,
                color: f.color,
            })),
        });
    } catch (error) {
        console.error("Error listing Plaud folders:", error);
        const message =
            error instanceof Error ? error.message : "Failed to list folders";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
