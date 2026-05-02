/**
 * Sync configuration for OpenPlaud
 *
 * Environment variables (for self-hosted deployments):
 * - NEXT_PUBLIC_SYNC_INTERVAL: Default sync interval in milliseconds (default: 300000 = 5 minutes)
 * - NEXT_PUBLIC_MIN_SYNC_INTERVAL: Minimum time between syncs in milliseconds (default: 60000 = 1 minute)
 * - NEXT_PUBLIC_SYNC_ON_MOUNT: Whether to sync on app mount (default: true)
 * - NEXT_PUBLIC_SYNC_ON_VISIBILITY: Whether to sync when tab becomes visible (default: true)
 *
 * Values are read via the validated `publicEnv` surface to keep all env
 * access centralized.
 */

import { publicEnv } from "./public-env";

export const SYNC_CONFIG = {
    /**
     * Default sync interval in milliseconds
     * @default 300000 (5 minutes)
     */
    defaultInterval: publicEnv.NEXT_PUBLIC_SYNC_INTERVAL ?? 300000,

    /**
     * Minimum time between syncs in milliseconds
     * @default 60000 (1 minute)
     */
    minInterval: publicEnv.NEXT_PUBLIC_MIN_SYNC_INTERVAL ?? 60000,

    /**
     * Whether to sync on mount
     * @default true
     */
    syncOnMount: publicEnv.NEXT_PUBLIC_SYNC_ON_MOUNT,

    /**
     * Whether to sync when tab becomes visible
     * @default true
     */
    syncOnVisibilityChange: publicEnv.NEXT_PUBLIC_SYNC_ON_VISIBILITY,

    /**
     * Available sync interval presets (in milliseconds)
     */
    intervalPresets: {
        "1 minute": 60 * 1000,
        "2 minutes": 2 * 60 * 1000,
        "5 minutes": 5 * 60 * 1000,
        "10 minutes": 10 * 60 * 1000,
        "15 minutes": 15 * 60 * 1000,
        "30 minutes": 30 * 60 * 1000,
        "1 hour": 60 * 60 * 1000,
    },
} as const;

/**
 * Get sync settings from database via API
 * Falls back to localStorage for backwards compatibility during migration
 */
export async function getSyncSettings(): Promise<{
    syncInterval: number;
    autoSyncEnabled: boolean;
    syncOnMount: boolean;
    syncOnVisibilityChange: boolean;
    syncNotifications: boolean;
}> {
    if (typeof window === "undefined") {
        return {
            syncInterval: SYNC_CONFIG.defaultInterval,
            autoSyncEnabled: true,
            syncOnMount: SYNC_CONFIG.syncOnMount,
            syncOnVisibilityChange: SYNC_CONFIG.syncOnVisibilityChange,
            syncNotifications: true,
        };
    }

    try {
        const response = await fetch("/api/settings/user");
        if (response.ok) {
            const data = await response.json();
            return {
                syncInterval: data.syncInterval ?? SYNC_CONFIG.defaultInterval,
                autoSyncEnabled: data.autoSyncEnabled ?? true,
                syncOnMount: data.syncOnMount ?? SYNC_CONFIG.syncOnMount,
                syncOnVisibilityChange:
                    data.syncOnVisibilityChange ??
                    SYNC_CONFIG.syncOnVisibilityChange,
                syncNotifications: data.syncNotifications ?? true,
            };
        }
    } catch (error) {
        console.error("Failed to fetch sync settings:", error);
    }

    // Fallback to localStorage for backwards compatibility
    const storedInterval = localStorage.getItem("openplaud_sync_interval");
    const storedEnabled = localStorage.getItem("openplaud_auto_sync_enabled");

    return {
        syncInterval: storedInterval
            ? parseInt(storedInterval, 10)
            : SYNC_CONFIG.defaultInterval,
        autoSyncEnabled:
            storedEnabled === null ? true : storedEnabled === "true",
        syncOnMount: SYNC_CONFIG.syncOnMount,
        syncOnVisibilityChange: SYNC_CONFIG.syncOnVisibilityChange,
        syncNotifications: true,
    };
}
