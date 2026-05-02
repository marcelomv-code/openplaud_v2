"use client";

import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-settings";

const exportFormatOptions = [
    { label: "JSON", value: "json", description: "Structured data format" },
    { label: "TXT", value: "txt", description: "Plain text format" },
    { label: "SRT", value: "srt", description: "Subtitle format" },
    { label: "VTT", value: "vtt", description: "WebVTT subtitle format" },
];

const backupFrequencyOptions = [
    { label: "Never", value: "never" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
];

interface ExportSectionProps {
    onReRunOnboarding?: () => void;
}

interface PlaudFolderOption {
    id: string;
    name: string;
}

const ALL_FOLDERS = "__all__";

export function ExportSection({ onReRunOnboarding }: ExportSectionProps) {
    const { isLoadingSettings, isSavingSettings, setIsLoadingSettings } =
        useSettings();
    const [defaultExportFormat, setDefaultExportFormat] = useState("json");
    const [autoExport, setAutoExport] = useState(false);
    const [backupFrequency, setBackupFrequency] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [folders, setFolders] = useState<PlaudFolderOption[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState(ALL_FOLDERS);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch("/api/settings/user");
                if (response.ok) {
                    const data = await response.json();
                    setDefaultExportFormat(data.defaultExportFormat ?? "json");
                    setAutoExport(data.autoExport ?? false);
                    setBackupFrequency(data.backupFrequency ?? null);
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [setIsLoadingSettings]);

    useEffect(() => {
        // Best effort: if Plaud isn't connected yet (404) or the call fails,
        // we leave the folder picker empty and the user just exports all.
        const fetchFolders = async () => {
            try {
                const response = await fetch("/api/plaud/folders");
                if (!response.ok) return;
                const data = (await response.json()) as {
                    folders: PlaudFolderOption[];
                };
                setFolders(data.folders ?? []);
            } catch {
                // silent: folder picker is an optional refinement
            }
        };
        fetchFolders();
    }, []);

    const handleExportBackupSettingChange = async (updates: {
        defaultExportFormat?: string;
        autoExport?: boolean;
        backupFrequency?: string | null;
    }) => {
        const previousValues: Record<string, unknown> = {};
        if (updates.defaultExportFormat !== undefined) {
            previousValues.defaultExportFormat = defaultExportFormat;
            setDefaultExportFormat(updates.defaultExportFormat);
        }
        if (updates.autoExport !== undefined) {
            previousValues.autoExport = autoExport;
            setAutoExport(updates.autoExport);
        }
        if (updates.backupFrequency !== undefined) {
            previousValues.backupFrequency = backupFrequency;
            setBackupFrequency(updates.backupFrequency);
        }

        try {
            const response = await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error("Failed to save settings");
            }
        } catch {
            if (updates.defaultExportFormat !== undefined) {
                const prev = previousValues.defaultExportFormat;
                if (typeof prev === "string") setDefaultExportFormat(prev);
            }
            if (updates.autoExport !== undefined) {
                const prev = previousValues.autoExport;
                if (typeof prev === "boolean") setAutoExport(prev);
            }
            if (updates.backupFrequency !== undefined) {
                const prev = previousValues.backupFrequency;
                if (typeof prev === "string" || prev === null)
                    setBackupFrequency(prev);
            }
            toast.error("Failed to save settings. Changes reverted.");
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams({ format: defaultExportFormat });
            if (selectedFolderId !== ALL_FOLDERS) {
                params.set("folderId", selectedFolderId);
            }
            const response = await fetch(`/api/export?${params.toString()}`);
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download =
                response.headers
                    .get("Content-Disposition")
                    ?.split("filename=")[1]
                    ?.replace(/"/g, "") || `export.${defaultExportFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success("Export completed");
        } catch {
            toast.error("Failed to export recordings");
        } finally {
            setIsExporting(false);
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch("/api/backup", { method: "POST" });
            if (!response.ok) throw new Error("Backup failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download =
                response.headers
                    .get("Content-Disposition")
                    ?.split("filename=")[1]
                    ?.replace(/"/g, "") || "backup.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success("Backup created");
        } catch {
            toast.error("Failed to create backup");
        } finally {
            setIsBackingUp(false);
        }
    };

    if (isLoadingSettings) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export/Backup Settings
            </h2>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="export-format">Default export format</Label>
                    <Select
                        value={defaultExportFormat}
                        onValueChange={(value) => {
                            setDefaultExportFormat(value);
                            handleExportBackupSettingChange({
                                defaultExportFormat: value,
                            });
                        }}
                        disabled={isSavingSettings}
                    >
                        <SelectTrigger id="export-format" className="w-full">
                            <SelectValue>
                                {exportFormatOptions.find(
                                    (opt) => opt.value === defaultExportFormat,
                                )?.label || "JSON"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {exportFormatOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    <div>
                                        <div>{option.label}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {option.description}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {folders.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="export-folder">Folder to export</Label>
                        <Select
                            value={selectedFolderId}
                            onValueChange={setSelectedFolderId}
                        >
                            <SelectTrigger
                                id="export-folder"
                                className="w-full"
                            >
                                <SelectValue>
                                    {selectedFolderId === ALL_FOLDERS
                                        ? "All folders"
                                        : (folders.find(
                                              (f) => f.id === selectedFolderId,
                                          )?.name ?? "All folders")}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_FOLDERS}>
                                    All folders
                                </SelectItem>
                                {folders.map((folder) => (
                                    <SelectItem
                                        key={folder.id}
                                        value={folder.id}
                                    >
                                        {folder.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Filter the export to recordings tagged in a specific
                            Plaud folder. "All folders" exports everything.
                        </p>
                    </div>
                )}

                <div className="flex items-center justify-between opacity-60">
                    <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="auto-export" className="text-base">
                                Auto-export new recordings
                            </Label>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                Coming soon
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Automatically export recordings when they are synced
                        </p>
                    </div>
                    <Switch
                        id="auto-export"
                        checked={autoExport}
                        onCheckedChange={(checked) => {
                            setAutoExport(checked);
                            handleExportBackupSettingChange({
                                autoExport: checked,
                            });
                        }}
                        disabled={true}
                    />
                </div>

                <div className="space-y-2 opacity-60">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="backup-frequency">
                            Backup frequency
                        </Label>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            Coming soon
                        </span>
                    </div>
                    <Select
                        value={backupFrequency || "never"}
                        onValueChange={(value) => {
                            const frequency = value === "never" ? null : value;
                            setBackupFrequency(frequency);
                            handleExportBackupSettingChange({
                                backupFrequency: frequency,
                            });
                        }}
                        disabled={true}
                    >
                        <SelectTrigger id="backup-frequency" className="w-full">
                            <SelectValue>
                                {backupFrequencyOptions.find(
                                    (opt) =>
                                        opt.value ===
                                        (backupFrequency || "never"),
                                )?.label || "Never"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {backupFrequencyOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        How often to automatically create backups
                    </p>
                </div>
            </div>

            <div className="pt-4 border-t space-y-3">
                <div className="space-y-2">
                    <Label className="text-base">Manual Actions</Label>
                    <Button
                        onClick={async () => {
                            try {
                                await fetch("/api/settings/user", {
                                    method: "PUT",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        onboardingCompleted: false,
                                    }),
                                });
                                onReRunOnboarding?.();
                            } catch {
                                toast.error("Failed to reset onboarding");
                            }
                        }}
                        variant="outline"
                        className="w-full"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Re-run Onboarding
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Reset onboarding to see it again on your next visit
                    </p>
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            variant="outline"
                            className="flex-1"
                        >
                            {isExporting ? (
                                <>
                                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-primary border-t-transparent rounded-full" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    {selectedFolderId === ALL_FOLDERS
                                        ? "Export All"
                                        : `Export ${
                                              folders.find(
                                                  (f) =>
                                                      f.id === selectedFolderId,
                                              )?.name ?? "folder"
                                          }`}
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleBackup}
                            disabled={isBackingUp}
                            variant="outline"
                            className="flex-1"
                        >
                            {isBackingUp ? (
                                <>
                                    <div className="animate-spin w-4 h-4 mr-2 border-2 border-primary border-t-transparent rounded-full" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Create Backup
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
