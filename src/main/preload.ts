import type { McVersionManagerApi } from "../common/mcVersionManager";
import type { McProfile, McProfileManagerApi } from "../common/profileManager";
import type { LauncherEventsApi } from "../common/launcherEvents";
import type { GameLauncherApi } from "../common/gameLauncher";
import { contextBridge, ipcRenderer } from "electron";
import * as _ from "lodash";

let callbacksMap = new Map();
const launcherEventsApi: LauncherEventsApi = {
    on(event: string, callback: CallableFunction) {
        const c = (_: any, ...a: any) => callback(...a);
        callbacksMap.set(callback.toString(), c);
        ipcRenderer.on(event, c);
    },
    off(event: string, callback: CallableFunction) {
        if (!callbacksMap.has(callback.toString()))
            console.error("Tried to remove an unknown callback");
        else ipcRenderer.off(event, callbacksMap.get(callback.toString()));
    },
};
contextBridge.exposeInMainWorld("LauncherEvents", launcherEventsApi);

const mcVersionApi: McVersionManagerApi = {
    getAllVersions: _.partial(ipcRenderer.invoke, "getAllMcVersions"),
    getVersion: _.partial(ipcRenderer.invoke, "getMcVersion"),
    downloadVersion: _.partial(ipcRenderer.invoke, "downloadMcVersion"),
};
contextBridge.exposeInMainWorld("McVersionManager", mcVersionApi);

const mcProfileApi: McProfileManagerApi = {
    getAllProfiles: _.partial(ipcRenderer.invoke, "getAllMcProfiles"),
    getProfile: _.partial(ipcRenderer.invoke, "getMcProfile"),
    downloadProfile: _.partial(ipcRenderer.invoke, "downloadMcProfile"),
};
contextBridge.exposeInMainWorld("McProfileManager", mcProfileApi);

const gameLauncherApi: GameLauncherApi = {
    startMCProfile: _.partial(ipcRenderer.invoke, "startMCProfile"),
};
contextBridge.exposeInMainWorld("GameLauncher", gameLauncherApi);
