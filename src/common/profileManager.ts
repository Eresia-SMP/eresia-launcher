export interface McProfile {
    id: string;
    name: string;
    version: string;
    downloadState: "downloaded" | "downloading" | "absent";
}

export interface McProfileManagerApi {
    getAllProfiles(): Promise<McProfile[]>;
    getProfile(id: string): Promise<McProfile | null>;
    downloadProfile(id: string): Promise<boolean>;
}
