import type { DownloadState, JVMVersion } from "../../common/jvmVersionManager";
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
const downloadStates = new Map<JVMVersion, DownloadState>();

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
): { link: string; date: Date } | null {
    const k = v + "_" + process.platform + "_" + os.arch();
    if (!(k in jreVersionLinks)) return null;
    const { link, date } = jreVersionLinks[k as keyof typeof jreVersionLinks];
    return {
        link,
        date: new Date(date),
    };
}

export function getJVMDownloadState(v: JVMVersion): DownloadState {
    const version = getJreVersionLink(v);
    const state = downloadStates.get(v);
    if (state === undefined) return { type: "absent" };
    else if (
        state.type === "downloaded" &&
        version !== null &&
        state.updateDate <= version.date
    )
        return { type: "outdated" };
    else return state;
}

export async function startJVMDownload(
    v: JVMVersion,
    onProgress?: (state: DownloadState) => void
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
        let downloadState: DownloadState = {
            type: "downloading",
            progress: 0,
        };
        downloadStates.set(v, downloadState);

        let totalReceived = 0;
        response.body.on("data", (chunk: Buffer) => {
            if (
                downloadState.type !== "downloading" ||
                downloadState.progress === 1
            )
                return;
            totalReceived += chunk.length;
            downloadState.progress = totalReceived / contentLength;
            onProgress?.(downloadState);
        });
        response.body.on("end", async () => {
            if (downloadState.type === "downloading")
                downloadState.progress = 1;
            writeStream.close();

            await extract(tempFile, {
                dir: path.resolve(mainFolderPath, "jvm", v.toString()),
            });

            downloadState = {
                type: "downloaded",
                updateDate: update.date,
            };
            downloadStates.set(v, downloadState);
            onProgress?.(downloadState);
        });
    });

    return isOk;
}
