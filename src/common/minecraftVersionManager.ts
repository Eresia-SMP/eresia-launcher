export type MinecraftVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloadProgress: number;
};
