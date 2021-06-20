export interface McProfileData {
    id: string;
    name: string;
    version: string;
    gameFolderData?: {
        url: string;
        sha1: string;
        size: number;
    };
}
