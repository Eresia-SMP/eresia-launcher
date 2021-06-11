import type { McVersionManagerApi } from "../common/mcVersionManager";
import type { LauncherEventsApi } from "../common/launcherEvents";
import { contextBridge, ipcRenderer } from "electron";
import * as _ from "lodash";

let callbacksMap = new Map();

const mcVersionApi: McVersionManagerApi = {
    getAllVersions: _.partial(ipcRenderer.invoke, "getAllMcVersions"),
    getVersion: _.partial(ipcRenderer.invoke, "getMcVersion"),
    downloadVersion: _.partial(ipcRenderer.invoke, "downloadMcVersion"),
};
contextBridge.exposeInMainWorld("McVersionManager", mcVersionApi);

const launcherEventsApi: LauncherEventsApi = {
    on(event: string, callback: CallableFunction) {
        const c = (_: any, ...a: any) => callback(...a);
        callbacksMap.set(callback, c);
        ipcRenderer.on(event, c);
    },
    off(event: string, callback: CallableFunction) {
        ipcRenderer.off(event, callbacksMap.get(callback));
    },
};
contextBridge.exposeInMainWorld("LauncherEvents", launcherEventsApi);
