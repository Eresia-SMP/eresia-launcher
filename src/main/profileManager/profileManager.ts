import { downloadFile, fileExists, getFileSHA1, readFileToString } from "..";
import { McProfile } from "../../common/profileManager";
import * as config from "./config.json";
import { McProfileData } from "./types";
import * as VersionManager from "../versionManager/versionManager";
import _ = require("lodash");
import { ipcMain } from "electron";
import * as path from "path";

let profiles_data: Map<string, McProfileData> = new Map();
let profiles_download_lock: Set<string> = new Set();

export async function init() {
    await reloadProfiles();

    ipcMain.handle("getAllMcProfiles", async () =>
        Promise.all(getAllProfiles().map(getProfile))
    );
    ipcMain.handle("getMcProfile", (a, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return getProfile(id);
    });
    ipcMain.handle("downloadMcProfile", (e, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return downloadProfile(id, (_, a, b) =>
            e.sender.send("mcProfileDownloadProgress", id, a, b)
        );
    });
}

async function reloadProfiles() {
    await downloadFile(config.eresiaProfilesUrl, "profiles/profiles.json");
    profiles_data.clear();
    const loadedProfiles = JSON.parse(
        await readFileToString("profiles/profiles.json")
    ).profiles as McProfileData[];
    for (const profile of loadedProfiles)
        profiles_data.set(profile.id, profile);
    console.log("Loaded profiles: ", profiles_data);
}

export function getAllProfiles(): string[] {
    return Array.from(profiles_data.keys());
}

export function getProfileData(id: string): McProfileData | null {
    return profiles_data.get(id) ?? null;
}

export async function getProfile(id: string): Promise<McProfile | null> {
    const data = profiles_data.get(id);
    if (!data) return null;
    let dls: "downloaded" | "downloading" | "absent";
    if (profiles_download_lock.has(id)) dls = "downloading";
    else {
        const versionDownloadState =
            await VersionManager.getVersionDownloadState(data.version);
        if (versionDownloadState === null) {
            console.error(
                `Could not find download state of version {${data.version}} of profile [${data.id}]`
            );
            return null;
        }
        dls =
            versionDownloadState.downloadedSize ==
            versionDownloadState.totalSize
                ? "downloaded"
                : "absent";
    }

    return {
        ...data,
        downloadState: dls,
    };
}

interface ProfileDownloadState {
    totalSize: number;
    downloadedSize: number;
    versionToDownload?: string;
    gameFolderData?: [url: string, path: string];
}

export async function getProfileDownloadState(
    id: string
): Promise<ProfileDownloadState | null> {
    const data = profiles_data.get(id);
    if (!data) return null;
    let totalSize = 0;
    let downloadedSize = 0;
    const vDlData = await VersionManager.getVersionDownloadState(data.version);
    let versionToDownload: string | undefined = undefined;
    if (_.isObject(vDlData)) {
        if (vDlData.downloadedSize < vDlData.totalSize)
            versionToDownload = data.version;
        totalSize += vDlData.totalSize;
        downloadedSize += vDlData.downloadedSize;
    }
    let gameFolderData: [url: string, path: string] | undefined = undefined;
    if (data.gameFolderData) {
        const p = path.join("profiles_game_data", `${data.id}.zip`);
        totalSize += data.gameFolderData.size;
        if (
            (await fileExists(p)) &&
            (await getFileSHA1(p)) === data.gameFolderData.sha1
        )
            downloadedSize += data.gameFolderData.size;
        else gameFolderData = [data.gameFolderData.url, p];
    }
    return {
        totalSize,
        downloadedSize,
        versionToDownload,
        gameFolderData,
    };
}

export async function downloadProfile(
    id: string,
    onProgress?: (
        bytes: number,
        totalSize: number,
        progressSize: number
    ) => void
): Promise<boolean> {
    const data = profiles_data.get(id);
    if (!data) return false;
    const downloadState = await getProfileDownloadState(id);
    if (_.isNull(downloadState)) return false;
    if (downloadState.downloadedSize == downloadState.totalSize) return true;
    if (profiles_download_lock.has(id)) return false;
    profiles_download_lock.add(id);
    console.log(`Started profile ${id} download`);
    console.log("Download state:", downloadState);

    let states: Promise<any>[] = [];
    if (downloadState.versionToDownload)
        states.push(
            VersionManager.downloadVersion(data.version, b => {
                downloadState.downloadedSize += b;
                onProgress?.(
                    b,
                    downloadState.totalSize,
                    downloadState.downloadedSize
                );
            })
        );
    if (!_.isUndefined(downloadState.gameFolderData))
        states.push(
            downloadFile(...downloadState.gameFolderData, b => {
                downloadState.downloadedSize += b;
                onProgress?.(
                    b,
                    downloadState.totalSize,
                    downloadState.downloadedSize
                );
            })
        );
    console.log(`Waiting for ${states.length} tasks`);
    await Promise.all(states);
    profiles_download_lock.delete(id);
    console.log(`Finished ${id} profile download`);

    return true;
}
