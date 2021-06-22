/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { McVersionManagerApi } from "../common/mcVersionManager";
import type { McProfileManagerApi } from "../common/profileManager";
import type { LauncherEventsApi } from "../common/launcherEvents";
import type { GameLauncherApi } from "../common/gameLauncher";

declare global {
    const McVersionManager: McVersionManagerApi;
    const McProfileManager: McProfileManagerApi;
    const LauncherEvents: LauncherEventsApi;
    const GameLauncher: GameLauncherApi;
}
