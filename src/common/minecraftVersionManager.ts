export type MinecraftVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloadProgress: number;
};

export interface McVersionManagerApi {
    getAllVersions(): Promise<string>;
    getVersion(id: string): Promise<MinecraftVersion | null>;
}
