export interface LauncherEventsApi {
    on(
        event: "mcVersionDownloadProgress",
        callback: (id: string, progress: number, total: number) => void
    ): void;
    off(
        event: "mcVersionDownloadProgress",
        callback: (id: string, progress: number, total: number) => void
    ): void;
}