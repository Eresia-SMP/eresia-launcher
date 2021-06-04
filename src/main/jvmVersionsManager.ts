import {
    DownloadState,
    JVMVersion,
    getJreVersionLink,
} from "../common/jvmVersionManager";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import fetch from "node-fetch";
import * as extract from "extract-zip";

export default class JvmVersionsManager {
    public basePath: string;

    private tempFolder = path.resolve(
        os.tmpdir(),
        Array(50)
            .fill("")
            .map(_ => Math.floor(Math.random() * 10).toString())
            .join("")
    );
    private downloadStates = new Map<JVMVersion, DownloadState>();

    constructor(basePath: string) {
        this.basePath = basePath;

        fs.mkdirSync(basePath, {
            recursive: true,
        });
        console.log("JVM Temp folder: ", this.tempFolder);
        fs.mkdirSync(this.tempFolder, {
            recursive: true,
        });

        ipcMain.handle("getJVMDownloadState", (e, v: JVMVersion) =>
            this.getJVMDownloadState(v)
        );
        ipcMain.handle("startJVMDownload", (e, v: JVMVersion) => {
            this.startJVMDownload(v, e.sender);
        });
    }

    getJreVersionLink(v: JVMVersion) {
        return getJreVersionLink(v, process.platform, os.arch());
    }

    getJVMDownloadState(v: JVMVersion): DownloadState {
        const version = this.getJreVersionLink(v);
        const state = this.downloadStates.get(v);
        if (state === undefined) return { type: "absent" };
        else if (
            state.type === "downloaded" &&
            version !== null &&
            state.updateDate <= version.date
        )
            return { type: "outdated" };
        else return state;
    }

    async startJVMDownload(
        v: JVMVersion,
        sender?: Electron.WebContents
    ): Promise<boolean> {
        const currentDownloadState = this.getJVMDownloadState(v);
        const update = this.getJreVersionLink(v);
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
                this.tempFolder,
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
            this.downloadStates.set(v, downloadState);

            let totalReceived = 0;
            response.body.on("data", (chunk: Buffer) => {
                if (
                    downloadState.type !== "downloading" ||
                    downloadState.progress === 1
                )
                    return;
                totalReceived += chunk.length;
                downloadState.progress = totalReceived / contentLength;
                sender?.send("jvmVersionDownloadStateUpdate", v, downloadState);
            });
            response.body.on("end", async () => {
                if (downloadState.type === "downloading")
                    downloadState.progress = 1;
                writeStream.close();

                await extract(tempFile, {
                    dir: path.join(this.basePath, v.toString()),
                });

                downloadState = {
                    type: "downloaded",
                    updateDate: update.date,
                };
                this.downloadStates.set(v, downloadState);
                sender?.send("jvmVersionDownloadStateUpdate", v, downloadState);
            });
        });

        return isOk;
    }
}
