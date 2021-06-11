import type { McVersionManagerApi } from "../common/minecraftVersionManager";
import { contextBridge, ipcRenderer } from "electron";
import * as _ from "lodash";

let callbacksMap = new Map();

const mcVersionApi: McVersionManagerApi = {
    getAllVersions: _.partial(ipcRenderer.invoke, "getAllMinecraftVersions"),
    getVersion: _.partial(ipcRenderer.invoke, "getMinecraftVersion"),
    downloadVersion: _.partial(ipcRenderer.invoke, "downloadMinecraftVersion"),

    on(event: string, callback: CallableFunction) {
        const c = (_: any, ...a: any) => callback(...a);
        callbacksMap.set(callback, c);
        ipcRenderer.on(event, c);
    },
    off(event: string, callback: CallableFunction) {
        ipcRenderer.off(event, callbacksMap.get(callback));
    },
};

contextBridge.exposeInMainWorld("McVersionManager", mcVersionApi);
