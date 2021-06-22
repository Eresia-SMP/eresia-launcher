export interface GameStartOptions {
    auth: {
        playerName: string;
        uuid: string;
        accessToken: string;
    };
    customResolution?: {
        width: number;
        height: number;
    };
}

export interface GameLauncherApi {
    startMCProfile(id: string, options: GameStartOptions): Promise<boolean>;
}
