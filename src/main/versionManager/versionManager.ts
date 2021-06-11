import type { McVersion } from "../../common/mcVersionManager";
import { JVMVersion } from "../../common/jvmVersionManager";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as _ from "lodash";
import { LinkToJson, VersionData, VersionDataRule } from "./types";
import * as config from "./config.json";
import {
    mainFolderPath,
    downloadFile,
    fileExists,
    getFileSHA1,
    readFileToString,
} from "../index";
import * as JVMVersionManager from "../jvmManager/jvmVersionsManager";

let versions: Map<string, VersionData> = new Map();
let versionsDataUrls: Map<string, LinkToJson<VersionData>> = new Map();
let downloadsLock: Set<string> = new Set();

export async function init() {
    fs.mkdirSync(mainFolderPath, {
        recursive: true,
    });

    ipcMain.handle("getAllMcVersions", async () => getAllVersion());
    ipcMain.handle("getMcVersion", (a, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return getVersion(id);
    });
    ipcMain.handle("downloadMcVersion", (e, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return downloadVersion(id, (a, b) =>
            e.sender.send("mcVersionDownloadProgress", id, a, b)
        );
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
          downloadedSize: number;
          files: [path: string, url: string][];
          jvmToDownload?: JVMVersion;
      }
    | null
> {
    const data = await getVersionData(id, true);
    if (!_.isObject(data)) return null;
    let totalSize = 0;
    let downloadedSize = 0;
    const files: [path: string, url: string][] = [];
    let jvmToDownload: undefined | JVMVersion = undefined;

    await Promise.all([
        // Client jar file download
        (async () => {
            totalSize += data.downloads.client.size;

            const p = path.join("versions", id, id + ".jar");
            if (
                (await fileExists(p)) &&
                (await getFileSHA1(p)) === data.downloads.client.sha1
            )
                downloadedSize += data.downloads.client.size;
            else files.push([p, data.downloads.client.url]);
        })(),
        // JVM Version download
        (async () => {
            let targetJvm = data.javaVersion?.majorVersion as JVMVersion;
            if (targetJvm !== 8 && targetJvm !== 11) targetJvm = 11;
            const downloadState =
                JVMVersionManager.getJVMDownloadState(targetJvm);
            let updateSize;
            if (downloadState.type === "outdated")
                updateSize = downloadState.updateSize;
            else updateSize = downloadState.totalSize;
            totalSize += updateSize;
            if (downloadState.type !== "downloaded") jvmToDownload = targetJvm;
            else downloadedSize += updateSize;
        })(),
        // All libraries download
        ...data.libraries.map(library =>
            (async () => {
                if (library.rules && !resolveVersionDataRules(library.rules))
                    return;
                // TODO: Add natives download
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
                        downloadedSize += library.downloads.artifact.size;
                    else files.push([p, library.downloads.artifact.url]);
                }
            })()
        ),
    ]);

    return { downloadedSize, totalSize, files, jvmToDownload };
}

async function downloadVersion(
    id: string,
    onProgress?: (downloaded: number, total: number) => void
): Promise<boolean> {
    const downloadState = await getVersionDownloadState(id);
    if (!_.isObject(downloadState)) return false;
    if (downloadsLock.has(id)) return false;
    downloadsLock.add(id);

    try {
        await Promise.all([
            // Files downloads
            ...downloadState.files.map(([path, url]) =>
                (async () => {
                    await downloadFile(url, path, a => {
                        downloadState.downloadedSize += a;
                        onProgress?.(
                            downloadState.downloadedSize,
                            downloadState.totalSize
                        );
                    });
                })()
            ),
            // Jvm download
            (async () => {
                const jvmVersion = downloadState.jvmToDownload;
                if (_.isUndefined(jvmVersion)) return;
                JVMVersionManager.startJVMDownload(jvmVersion, (bytes, _) => {
                    downloadState.downloadedSize += bytes;
                    onProgress?.(
                        downloadState.downloadedSize,
                        downloadState.totalSize
                    );
                });
            })(),
        ]);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    } finally {
        downloadsLock.delete(id);
    }
}

export function getAllVersion(): string[] {
    return Array.from(versionsDataUrls.keys());
}
async function getVersion(id: string): Promise<McVersion | null> {
    const data = await getVersionData(id);
    if (!_.isObject(data)) return null;
    const downloadState = await getVersionDownloadState(id);
    let downloadProgress = 0;
    if (_.isObject(downloadState))
        downloadProgress =
            downloadState.downloadedSize / downloadState.totalSize;
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
