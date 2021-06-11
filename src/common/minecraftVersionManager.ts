export type MinecraftVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloadProgress: number;
};

export interface McVersionManagerApi {
    getAllVersions(): Promise<string>;
    getVersion(id: string): Promise<MinecraftVersion | null>;
    downloadVersion(id: string): Promise<boolean>;

    on(
        event: "versionDownloadProgress",
        callback: (id: string, progress: number, total: number) => void
    ): void;
    off(
        event: "versionDownloadProgress",
        callback: (id: string, progress: number, total: number) => void
    ): void;
}
