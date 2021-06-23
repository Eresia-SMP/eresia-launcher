import type {
    JVMDownloadState,
    JVMVersion,
} from "../../common/jvmVersionManager";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import fetch from "node-fetch";
import * as extract from "extract-zip";
import * as jreVersionLinks from "./jreVersionLinks.json";
import {
    fileExists,
    mainFolderPath,
    readFileToString,
    writeFile,
} from "../index";

export function isJVMVersion(a: any): a is JVMVersion {
    return [8, 11, 16].includes(a);
}

const tempFolder = path.resolve(
    os.tmpdir(),
    Array(50)
        .fill("")
        .map(_ => Math.floor(Math.random() * 10).toString())
        .join("")
);
const downloadStates = new Map<JVMVersion, JVMDownloadState>();

export async function init() {
    fs.mkdirSync(tempFolder, {
        recursive: true,
    });

    ipcMain.handle("getJVMDownloadState", (_, v: JVMVersion) => {
        if (!isJVMVersion(v)) throw "Invalid argument";
        return getJVMDownloadState(v);
    });
    ipcMain.handle("downloadJVMVersion", (e, v: JVMVersion) => {
        if (!isJVMVersion(v)) throw "Invalid argument";
        return downloadJVMVersion(v, p =>
            e.sender.send("jvmVersionDownloadProgress", v, p)
        );
    });
}

export function getJreVersionLink(
    v: JVMVersion
): { link: string; size: number; sha1: string; date: Date } | null {
    const k = v + "_" + process.platform + "_" + os.arch();
    if (!(k in jreVersionLinks)) return null;
    const { link, size, sha1, date } =
        jreVersionLinks[k as keyof typeof jreVersionLinks];
    return {
        link,
        size,
        sha1,
        date: new Date(date),
    };
}

interface JVMSavedDownloadState {
    updateDate: string;
    totalSize: number;
}
export async function getJVMDownloadState(
    v: JVMVersion
): Promise<Readonly<JVMDownloadState>> {
    const version = getJreVersionLink(v);
    const state = downloadStates.get(v);
    if (state === undefined) {
        if (await fileExists("jvm", v.toString(), "version.json")) {
            const savedState = JSON.parse(
                await readFileToString(["jvm", v.toString(), "version.json"])
            ) as JVMSavedDownloadState;
            const state: JVMDownloadState = {
                type: "downloaded",
                updateDate: new Date(savedState.updateDate),
                totalSize: savedState.totalSize,
            };
            downloadStates.set(v, state);
            return state;
        } else {
            return { type: "absent", totalSize: version?.size ?? 0 };
        }
    } else if (
        state.type === "downloaded" &&
        version !== null &&
        state.updateDate < version.date
    )
        return { type: "outdated", updateSize: version.size };
    else return state;
}
async function setJVMSavedDownloadState(
    v: JVMVersion,
    state: JVMSavedDownloadState
) {
    writeFile(
        ["jvm", v.toString(), "version.json"],
        JSON.stringify(state, null, 2)
    );
}

export async function downloadJVMVersion(
    v: JVMVersion,
    onProgress?: (bytes: number, state: JVMDownloadState) => void
): Promise<boolean> {
    const currentDownloadState = await getJVMDownloadState(v);
    const update = getJreVersionLink(v);
    if (
        !(
            currentDownloadState.type === "absent" ||
            currentDownloadState.type === "outdated"
        ) ||
        update === null
    )
        return false;

    const response = await fetch(update.link);
    const isOk = response.ok;

    const tempFile = path.join(
        tempFolder,
        Array(50)
            .fill("")
            .map(_ => Math.floor(Math.random() * 10).toString())
            .join("")
    );
    const writeStream = fs.createWriteStream(tempFile);
    response.body.pipe(writeStream);
    let downloadState: JVMDownloadState = {
        type: "downloading",
        downloadedSize: 0,
        totalSize: update.size,
    };
    downloadStates.set(v, downloadState);

    let lastChunkSize = 0;
    response.body.on("data", (chunk: Buffer) => {
        if (downloadState.type !== "downloading") return;

        lastChunkSize = chunk.length;
        downloadState.downloadedSize += chunk.length;
        if (downloadState.downloadedSize !== downloadState.totalSize)
            onProgress?.(chunk.length, downloadState);
    });

    await new Promise<void>(resolve => {
        response.body.on("end", async () => {
            writeStream.close();

            const extractFolder = path.resolve(
                tempFolder,
                Array(50)
                    .fill("")
                    .map(_ => Math.floor(Math.random() * 10).toString())
                    .join("")
            );
            const targetFolder = path.resolve(
                mainFolderPath,
                "jvm",
                v.toString()
            );
            await fs.promises.rm(targetFolder, {
                recursive: true,
                force: true,
            });
            await fs.promises.mkdir(path.resolve(mainFolderPath, "jvm"), {
                recursive: true,
            });

            await fs.promises.mkdir(extractFolder, { recursive: true });
            await extract(tempFile, {
                dir: extractFolder,
            });
            if (fs.existsSync(path.resolve(extractFolder, "bin"))) {
                await fs.promises.rename(extractFolder, targetFolder);
            } else {
                await fs.promises.rename(
                    path.join(
                        extractFolder,
                        (
                            await fs.promises.readdir(extractFolder)
                        )[0]
                    ),
                    targetFolder
                );
            }

            downloadState = {
                type: "downloaded",
                totalSize: update.size,
                updateDate: update.date,
            };
            downloadStates.set(v, downloadState);
            await setJVMSavedDownloadState(v, {
                totalSize: update.size,
                updateDate: update.date.toUTCString(),
            });
            onProgress?.(lastChunkSize, downloadState);

            resolve();
        });
    });

    return isOk;
}
