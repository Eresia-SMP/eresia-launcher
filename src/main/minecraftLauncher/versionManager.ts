import type { MinecraftVersion } from "../../common/minecraftVersionManager";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import fetch from "node-fetch";
import * as _ from "lodash";
import { LinkToJson, VersionData, VersionDataRule } from "./types";
import * as config from "./config.json";
import * as sha1File from "sha1-file";
import {
    mainFolderPath,
    downloadFile,
    fileExists,
    getFileSHA1,
    readFileToString,
} from "../index";

let versions: Map<string, VersionData> = new Map();
let versionsDataUrls: Map<string, LinkToJson<VersionData>> = new Map();

export async function init() {
    fs.mkdirSync(mainFolderPath, {
        recursive: true,
    });

    ipcMain.handle("getAllMinecraftVersions", async () => getAllVersion());
    ipcMain.handle("getMinecraftVersion", (a, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return getVersion(id);
    });

    await reloadEresiaVersions();
}

async function reloadEresiaVersions() {
    await downloadFile(
        config.eresia_versions_url,
        "versions/eresia_versions.json"
    );
    const urls: { [key: string]: LinkToJson<VersionData> } = JSON.parse(
        await readFileToString("versions/eresia_versions.json")
    ).versions;
    versionsDataUrls = new Map(Object.entries(urls));
}

async function getVersionData(
    version: string,
    shouldDownload: boolean = true,
    maxInheritance: number = 20
): Promise<VersionData | "notDownloaded" | null> {
    if (versions.has(version)) return versions.get(version) ?? null;
    const p = path.join("versions", version, version + ".json");
    const url = versionsDataUrls.get(version);
    if (!(await fileExists(p))) {
        if (!shouldDownload || !url) return "notDownloaded";
        await downloadFile(url, p);
    }
    let data = JSON.parse(await readFileToString(p)) as VersionData;
    if (data.inheritsFrom) {
        if (maxInheritance <= 1)
            throw "Reached max iteration, is there an inheritance loop ?";
        const parent = await getVersionData(
            data.inheritsFrom,
            shouldDownload,
            maxInheritance - 1
        );
        if (parent === "notDownloaded") return "notDownloaded";
        if (_.isObject(parent))
            data = _.mergeWith(data, parent, (a, b) => {
                if (_.isArray(a)) return a.concat(b);
            });
    }
    versions.set(version, data);
    return data;
}

async function getVersionDownloadState(id: string): Promise<
    | "full"
    | {
          totalSize: number;
          progress: number;
          files: [path: string, url: string][];
      }
    | null
> {
    const data = await getVersionData(id, true);
    if (!_.isObject(data)) return null;
    let totalSize = 0;
    let progress = 0;
    const files: [path: string, url: string][] = [];

    await Promise.all([
        (async () => {
            totalSize += data.downloads.client.size;

            const p = path.join("versions", id, id + ".jar");
            if (
                (await fileExists(p)) &&
                (await getFileSHA1(p)) === data.downloads.client.sha1
            )
                progress += data.downloads.client.size;
            else files.push([p, data.downloads.client.url]);
        })(),
        (async () => {})(),
        ...data.libraries.map(library =>
            (async () => {
                if (library.rules && !resolveVersionDataRules(library.rules))
                    return;
                if (library.downloads.artifact) {
                    totalSize += library.downloads.artifact.size;
                    const p = path.join(
                        "libraries",
                        library.downloads.artifact.path
                    );
                    if (
                        (await fileExists(p)) &&
                        (await getFileSHA1(p)) ===
                            library.downloads.artifact.sha1
                    )
                        progress += library.downloads.artifact.size;
                    else files.push([p, library.downloads.artifact.url]);
                }
            })()
        ),
    ]);

    return { progress, totalSize, files };
}

export function getAllVersion(): string[] {
    return Array.from(versionsDataUrls.keys());
}
async function getVersion(id: string): Promise<MinecraftVersion | null> {
    const data = await getVersionData(id);
    if (!_.isObject(data)) return null;
    const downloadState = await getVersionDownloadState(id);
    let downloadProgress = 0;
    if (_.isObject(downloadState))
        downloadProgress = downloadState.progress / downloadState.totalSize;
    else if (downloadState === "full") downloadProgress = 1;
    return {
        id,
        type: data.type,
        inheritsFrom: data.inheritsFrom,
        downloadProgress,
    };
}

/*
 * UTILS
 */

function resolveVersionDataRules(
    rules: VersionDataRule[]
): "allow" | "disallow" {
    let result: "allow" | "disallow" = "disallow";
    for (const rule of rules) {
        let match = true;
        if (
            rule.features &&
            (rule.features.has_custom_resolution || rule.features.is_demo_user)
        )
            match = false;
        if (rule.os) {
            if (rule.os.arch !== os.arch()) match = false;
            if (
                rule.os.name !==
                process.platform
                    .replace("darwin", "osx")
                    .replace("linux", "linux")
                    .replace("win32", "windows")
            )
                match = false;
            if (rule.os.version === "^10\\." && !os.release().startsWith("10"))
                match = false;
        }
        if (match) result = rule.action;
    }
    return result;
}
