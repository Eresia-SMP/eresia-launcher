/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { McVersionManagerApi } from "../common/mcVersionManager";
import type { LauncherEventsApi } from "../common/launcherEvents";

declare global {
    const McVersionManager: McVersionManagerApi;
    const LauncherEvents: LauncherEventsApi;
}
