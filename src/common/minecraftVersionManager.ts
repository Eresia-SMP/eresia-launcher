export type MinecraftVersion = {
    id: string;
    inheritsFrom?: string;
    type: "release" | "snapshot";
    downloaded: "yes" | "no" | "partial";
};
