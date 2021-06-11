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
import { mainFolderPath } from "../index";

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
        if (v !== 8 && v !== 11) throw "Invalid argument";
        return getJVMDownloadState(v);
    });
    ipcMain.handle("startJVMDownload", (e, v: JVMVersion) => {
        if (v !== 8 && v !== 11) throw "Invalid argument";
        return startJVMDownload(v, p =>
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

export function getJVMDownloadState(v: JVMVersion): JVMDownloadState {
    const version = getJreVersionLink(v);
    const state = downloadStates.get(v);
    if (state === undefined)
        return { type: "absent", totalSize: version?.size ?? 0 };
    else if (
        state.type === "downloaded" &&
        version !== null &&
        state.updateDate <= version.date
    )
        return { type: "outdated", updateSize: version.size };
    else return state;
}

export async function startJVMDownload(
    v: JVMVersion,
    onProgress?: (bytes: number, state: JVMDownloadState) => void
): Promise<boolean> {
    const currentDownloadState = getJVMDownloadState(v);
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

    queueMicrotask(() => {
        const contentLength = parseInt(
            response.headers.get("Content-Length") || "0"
        );

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
        response.body.on("end", async () => {
            writeStream.close();

            await extract(tempFile, {
                dir: path.resolve(mainFolderPath, "jvm", v.toString()),
            });

            downloadState = {
                type: "downloaded",
                totalSize: update.size,
                updateDate: update.date,
            };
            downloadStates.set(v, downloadState);
            onProgress?.(lastChunkSize, downloadState);
        });
    });

    return isOk;
}
