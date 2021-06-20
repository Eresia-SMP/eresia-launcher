export type McVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloadProgress: number;
};

export interface McVersionManagerApi {
    getAllVersions(): Promise<string[]>;
    getVersion(id: string): Promise<McVersion | null>;
    downloadVersion(id: string): Promise<boolean>;
}
