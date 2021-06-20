export interface LauncherEventsApi {
    on(
        event: "mcVersionDownloadProgress",
        callback: (id: string, total: number, progress: number) => void
    ): void;
    off(
        event: "mcVersionDownloadProgress",
        callback: (id: string, total: number, progress: number) => void
    ): void;

    on(
        event: "mcProfileDownloadProgress",
        callback: (id: string, total: number, progress: number) => void
    ): void;
    off(
        event: "mcProfileDownloadProgress",
        callback: (id: string, total: number, progress: number) => void
    ): void;
}
