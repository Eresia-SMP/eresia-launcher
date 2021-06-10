import type { MinecraftVersion } from "../../common/minecraftVersionManager";
import { app, ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import fetch from "node-fetch";
import * as extract from "extract-zip";
import * as jreVersionLinks from "../jreVersionLinks.json";
import * as _ from "lodash";
import {
    LinkToJson,
    VersionAssetIndexes,
    VersionData,
    VersionDataArgument,
    VersionDataDownload,
    VersionDataLibrary,
    VersionDataRule,
} from "./types";
import * as config from "./config.json";
import * as sha1File from "sha1-file";

export default class MinecraftVersionManager {
    private async downloadFile(url: string, ...p: string[]): Promise<void> {
        const fullPath = path.resolve(this.mainFolderPath, ...p);
        await fs.promises.mkdir(path.parse(fullPath).dir, {
            recursive: true,
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.statusText);
        response.body.pipe(fs.createWriteStream(fullPath));
        await new Promise<void>(resolve =>
            response.body.once("end", () => resolve())
        );
    }
    private async readFileToString(
        p: string | string[],
        encoding?: BufferEncoding
    ): Promise<string> {
        const buffer = await fs.promises.readFile(
            path.resolve(this.mainFolderPath, ..._.castArray(p))
        );
        return buffer.toString(encoding ?? "utf8");
    }
    private async fileExists(...p: string[]): Promise<boolean> {
        try {
            await fs.promises.access(path.resolve(this.mainFolderPath, ...p));
            return true;
        } catch (error) {
            return false;
        }
    }
    private getFileSHA1(...p: string[]) {
        return sha1File(path.resolve(this.mainFolderPath, ...p));
    }

    private resolveVersionDataRules(
        rules: VersionDataRule[]
    ): "allow" | "disallow" {
        let result: "allow" | "disallow" = "disallow";
        for (const rule of rules) {
            let match = true;
            if (
                rule.features &&
                (rule.features.has_custom_resolution ||
                    rule.features.is_demo_user)
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
                if (
                    rule.os.version === "^10\\." &&
                    !os.release().startsWith("10")
                )
                    match = false;
            }
            if (match) result = rule.action;
        }
        return result;
    }

    private mainFolderPath: string;
    private versions: Map<string, VersionData> = new Map();
    private versionsDataUrls: Map<string, LinkToJson<VersionData>> = new Map();

    constructor(mainFolderPath: string) {
        this.mainFolderPath = mainFolderPath;
        fs.mkdirSync(this.mainFolderPath, {
            recursive: true,
        });

        ipcMain.handle("getAllMinecraftVersions", async () =>
            this.getAllVersion()
        );
        ipcMain.handle("getMinecraftVersion", (a, id: string) => {
            if (!_.isString(id)) throw "Invalid argument";
            this.getVersion(id);
        });
    }
    async updateFiles() {
        await this.reloadEresiaVersions();
    }

    private async reloadEresiaVersions() {
        await this.downloadFile(
            config.eresia_versions_url,
            "versions/eresia_versions.json"
        );
        const urls: { [key: string]: LinkToJson<VersionData> } = JSON.parse(
            await this.readFileToString("versions/eresia_versions.json")
        ).versions;
        this.versionsDataUrls = new Map(Object.entries(urls));
    }

    private async getVersionData(
        version: string,
        shouldDownload: boolean = true,
        maxInheritance: number = 20
    ): Promise<VersionData | "notDownloaded" | null> {
        if (this.versions.has(version))
            return this.versions.get(version) ?? null;
        const p = path.join("versions", version, version + ".json");
        const url = this.versionsDataUrls.get(version);
        if (!(await this.fileExists(p))) {
            if (!shouldDownload || !url) return "notDownloaded";
            await this.downloadFile(url, p);
        }
        let data = JSON.parse(await this.readFileToString(p)) as VersionData;
        if (data.inheritsFrom) {
            if (maxInheritance <= 1)
                throw "Reached max iteration, is there an inheritance loop ?";
            const parent = await this.getVersionData(
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
        this.versions.set(version, data);
        return data;
    }

    private async getVersionDownloadState(id: string): Promise<
        | "full"
        | {
              totalSize: number;
              progress: number;
              files: [path: string, url: string][];
          }
        | null
    > {
        const data = await this.getVersionData(id, true);
        if (!_.isObject(data)) return null;
        let totalSize = 0;
        let progress = 0;
        const files: [path: string, url: string][] = [];

        await Promise.all([
            (async () => {
                totalSize += data.downloads.client.size;

                const p = path.join("versions", id, id + ".jar");
                if (
                    (await this.fileExists(p)) &&
                    (await this.getFileSHA1(p)) === data.downloads.client.sha1
                )
                    progress += data.downloads.client.size;
                else files.push([p, data.downloads.client.url]);
            })(),
            (async () => {})(),
            ...data.libraries.map(library =>
                (async () => {
                    if (
                        library.rules &&
                        !this.resolveVersionDataRules(library.rules)
                    )
                        return;
                    if (library.downloads.artifact) {
                        totalSize += library.downloads.artifact.size;
                        const p = path.join(
                            "libraries",
                            library.downloads.artifact.path
                        );
                        if (
                            (await this.fileExists(p)) &&
                            (await this.getFileSHA1(p)) ===
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

    getAllVersion(): string[] {
        return Array.from(this.versionsDataUrls.keys());
    }
    async getVersion(id: string): Promise<MinecraftVersion | null> {
        const data = await this.getVersionData(id);
        if (!_.isObject(data)) return null;
        const downloadState = await this.getVersionDownloadState(id);
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
}
