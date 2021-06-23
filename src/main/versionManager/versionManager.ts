import type { McVersion } from "../../common/mcVersionManager";
import { JVMVersion } from "../../common/jvmVersionManager";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as _ from "lodash";
import {
    LinkToJson,
    VersionData,
    VersionDataRule,
    VersionAssetIndexes,
} from "./types";
import * as config from "./config.json";
import {
    mainFolderPath,
    downloadFile,
    fileExists,
    getFileSHA1,
    readFileToString,
} from "../index";
import * as JVMVersionManager from "../jvmManager/jvmVersionsManager";
import * as extract from "extract-zip";

let versions: Map<string, VersionData> = new Map();
let versionsDataUrls: Map<string, LinkToJson<VersionData>> = new Map();
let downloadsLock: Set<string> = new Set();

export async function init() {
    fs.mkdirSync(mainFolderPath, {
        recursive: true,
    });

    ipcMain.handle("getAllMcVersions", async () =>
        Promise.all(getAllVersion().map(_.unary(getVersionData)))
    );
    ipcMain.handle("getMcVersion", (a, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return getVersion(id);
    });
    ipcMain.handle("downloadMcVersion", (e, id: string) => {
        if (!_.isString(id)) throw "Invalid argument";
        return downloadVersion(id, (_, a, b) =>
            e.sender.send("mcVersionDownloadProgress", id, a, b)
        );
    });

    await reloadEresiaVersions();
}

async function reloadEresiaVersions() {
    await downloadFile(
        config.eresiaVersionsUrl,
        "versions/eresia_versions.json"
    );
    const urls: { [key: string]: LinkToJson<VersionData> } = JSON.parse(
        await readFileToString("versions/eresia_versions.json")
    ).versions;
    versionsDataUrls = new Map(Object.entries(urls));
}

export async function getVersionData(
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

export async function getEffectiveVersionJVM(
    id: string
): Promise<JVMVersion | null> {
    const data = await getVersionData(id);
    if (!_.isObject(data)) return null;
    let v = data.javaVersion?.majorVersion;
    if (!JVMVersionManager.isJVMVersion(v))
        v = config.defaultJVMVersion as JVMVersion;
    return v as JVMVersion;
}

export async function resolveVersionClasspath(
    id: string
): Promise<null | string> {
    let separator: string;
    if (process.platform === "win32") separator = ";";
    else separator = ":";

    const data = await getVersionData(id);
    if (!_.isObject(data)) return null;
    let platF: "osx" | "windows" | "linux" | null = null;
    if (os.platform() === "win32") platF = "windows";
    else if (os.platform() === "linux") platF = "linux";
    else if (os.platform() === "darwin") platF = "osx";

    return [
        ...data.libraries
            .filter(
                l => !(l.rules && resolveVersionDataRules(l.rules) !== "allow")
            )
            .flatMap(l => {
                if (l.natives && l.downloads.classifiers) {
                    if (platF && l.natives[platF])
                        return path.resolve(
                            mainFolderPath,
                            "libraries",
                            l.downloads.classifiers[l.natives[platF] as any]
                                .path
                        );
                } else
                    return path.resolve(
                        mainFolderPath,
                        "libraries",
                        l.downloads.artifact.path
                    );
            }),
        path.resolve(mainFolderPath, "versions", id, `${id}.jar`),
    ]
        .filter(a => !!a)
        .join(separator);
}

async function resolveVersionLibraries(id: string): Promise<
    | null
    | {
          url: string;
          sha1: string;
          path: string;
          size: number;
          extract?: string;
      }[]
> {
    const data = await getVersionData(id);
    if (!_.isObject(data)) return null;
    let platF: "osx" | "windows" | "linux" | null = null;
    if (os.platform() === "win32") platF = "windows";
    else if (os.platform() === "linux") platF = "linux";
    else if (os.platform() === "darwin") platF = "osx";

    return data.libraries
        .filter(l => !(l.rules && !resolveVersionDataRules(l.rules)))
        .flatMap(l => {
            let artifacts: {
                url: string;
                sha1: string;
                path: string;
                size: number;
                extract?: string;
            }[] = [];
            artifacts.push({
                ...l.downloads.artifact,
                path: path.join("libraries", l.downloads.artifact.path),
            });

            if (
                l.natives &&
                l.downloads.classifiers &&
                platF &&
                l.natives[platF]
            ) {
                const a = l.downloads.classifiers[l.natives[platF] as any];
                const p = path.join("libraries", a.path);
                if (l.extract) {
                    artifacts.push({
                        ...a,
                        path: p,
                        extract: path.join("versions", id, "natives"),
                    });
                } else {
                    artifacts.push({
                        ...a,
                        path: p,
                    });
                }
            }
            return artifacts;
        });
}

export async function getVersionDownloadState(id: string): Promise<{
    totalSize: number;
    downloadedSize: number;
    files: { path: string; url: string; extract?: string }[];
    jvmToDownload?: JVMVersion;
} | null> {
    const data = await getVersionData(id, true);
    if (!_.isObject(data)) return null;
    let totalSize = 0;
    let downloadedSize = 0;
    const files: { path: string; url: string; extract?: string }[] = [];
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
            else files.push({ path: p, url: data.downloads.client.url });
        })(),
        // JVM Version download
        (async () => {
            let targetJvm = data.javaVersion?.majorVersion as JVMVersion;
            if (!JVMVersionManager.isJVMVersion(targetJvm))
                targetJvm = config.defaultJVMVersion as JVMVersion;
            const downloadState = await JVMVersionManager.getJVMDownloadState(
                targetJvm
            );
            let updateSize;
            if (downloadState.type === "outdated")
                updateSize = downloadState.updateSize;
            else updateSize = downloadState.totalSize;
            totalSize += updateSize;
            if (downloadState.type !== "downloaded") jvmToDownload = targetJvm;
            else downloadedSize += updateSize;
        })(),
        // All libraries download
        (async () => {
            const libs = await resolveVersionLibraries(id);
            if (!libs) throw "Wtf";
            for (const { path: p, sha1, size, url, extract } of libs) {
                totalSize += size;
                if ((await fileExists(p)) && (await getFileSHA1(p)) === sha1)
                    downloadedSize += size;
                else files.push({ path: p, url, extract });
            }
        })(),
        // Assets Index
        (async () => {
            const indexesFilePath = `assets/indexes/${data.assets}.json`;
            if (
                !(await fileExists(indexesFilePath)) ||
                (await getFileSHA1(indexesFilePath)) !== data.assetIndex.sha1
            )
                await downloadFile(data.assetIndex.url, indexesFilePath);
            let indexes: VersionAssetIndexes = JSON.parse(
                await readFileToString(indexesFilePath)
            );
            for (const object of Object.values(indexes.objects)) {
                totalSize += object.size;
                const hash = object.hash;
                const hashStart = hash.substr(0, 2);
                const p = `assets/objects/${hashStart}/${hash}`;
                if (await fileExists(p)) downloadedSize += object.size;
                else
                    files.push({
                        path: p,
                        url: `https://resources.download.minecraft.net/${hashStart}/${hash}`,
                    });
            }
        })(),
    ]);

    return { downloadedSize, totalSize, files, jvmToDownload };
}

export async function downloadVersion(
    id: string,
    onProgress?: (
        bytes: number,
        totalSize: number,
        progressSize: number
    ) => void
): Promise<boolean> {
    const downloadState = await getVersionDownloadState(id);
    if (!_.isObject(downloadState)) return false;
    if (downloadsLock.has(id)) return false;
    downloadsLock.add(id);
    console.log(`Started version ${id} download`);
    console.log("Download state:", {
        downloadedSize: downloadState.downloadedSize,
        totalSize: downloadState.totalSize,
    });

    try {
        console.log(`Downloading: ${downloadState.files.length} files`);
        // Download files, 10 at a times
        let filesToDownload = [...downloadState.files];
        while (filesToDownload.length > 0) {
            await Promise.all(
                filesToDownload
                    .splice(
                        0,
                        Math.min(
                            filesToDownload.length,
                            config.assetDownloadConcurrency
                        )
                    )
                    .map(({ path: p, url, extract: extractPath }) =>
                        (async () => {
                            await downloadFile(url, p, a => {
                                downloadState.downloadedSize += a;
                                onProgress?.(
                                    a,
                                    downloadState.totalSize,
                                    downloadState.downloadedSize
                                );
                            });
                            if (extractPath) {
                                console.log(
                                    `Extracting ${p} to ${extractPath}`
                                );
                                await extract(path.resolve(mainFolderPath, p), {
                                    dir: path.resolve(
                                        mainFolderPath,
                                        extractPath
                                    ),
                                });
                            }
                        })()
                    )
            );
        }
        // Download jvm
        if (!_.isUndefined(downloadState.jvmToDownload)) {
            console.log(
                `Downloading JVM ${downloadState.jvmToDownload} for version ${id}`
            );
            await JVMVersionManager.downloadJVMVersion(
                downloadState.jvmToDownload,
                (bytes, _) => {
                    downloadState.downloadedSize += bytes;
                    onProgress?.(
                        bytes,
                        downloadState.totalSize,
                        downloadState.downloadedSize
                    );
                }
            );
        }
        console.log(`Finished version ${id} download`);
        return true;
    } catch (error) {
        console.log(`Error whole downloading version ${id}`, error);
        console.error(error);
        return false;
    } finally {
        downloadsLock.delete(id);
    }
}

export function getAllVersion(): string[] {
    return Array.from(versionsDataUrls.keys());
}
export async function getVersion(id: string): Promise<McVersion | null> {
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

export function resolveVersionDataRules(
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
