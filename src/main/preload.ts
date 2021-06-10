import type { McVersionManagerApi } from "../common/minecraftVersionManager";
import { contextBridge, ipcRenderer } from "electron";
import * as _ from "lodash";

const mcVersionApi: McVersionManagerApi = {
    getAllVersions() {
        return ipcRenderer.invoke("getAllMinecraftVersions");
    },
    getVersion(id: string) {
        if (!_.isString(id)) throw "Invalid argument";
        return ipcRenderer.invoke("getMinecraftVersion", id);
    },
};

contextBridge.exposeInMainWorld("McVersionManager", mcVersionApi);
