export type McVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloadProgress: number;
};

export interface McVersionManagerApi {
    getAllVersions(): Promise<McVersion[]>;
    getVersion(id: string): Promise<McVersion | null>;
    downloadVersion(id: string): Promise<boolean>;
}
