import { app, BrowserWindow, protocol } from "electron";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import * as _ from "lodash";
import * as sha1File from "sha1-file";
import * as isDev from "electron-is-dev";
import * as JvmManager from "./jvmManager/jvmVersionsManager";
import * as VersionManager from "./versionManager/versionManager";
import * as ProfileManager from "./profileManager/profileManager";
import * as GameLauncher from "./gameLauncher/gameLauncher";

if (require("electron-squirrel-startup")) {
    app.quit();
}
require("update-electron-app")();

export let mainFolderPath: string = "";
let window: BrowserWindow | null = null;

app.on("ready", async () => {
    mainFolderPath = path.resolve(app.getPath("appData"), ".eresia_smp");

    await JvmManager.init();
    await VersionManager.init();
    await ProfileManager.init();
    GameLauncher.init();

    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function createWindow() {
    window = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            webSecurity: false,
            preload: path.resolve(app.getAppPath(), "dist/main/preload.js"),
        },
        backgroundColor: "#292D3E",
        show: false,
    });

    console.log(path.resolve(app.getAppPath(), "dist/renderer/index.html"));

    const URL = isDev
        ? `http://localhost:1234`
        : `file://${path.resolve(
              app.getAppPath(),
              "dist/renderer/index.html"
          )}`;

    window.loadURL(URL);

    window.on("ready-to-show", () => {
        window?.show();
    });
}

/*
 * UTILS
 */

export async function downloadFile(
    url: string,
    p: string,
    onProgress?: (bytes: number) => void
): Promise<void> {
    const fullPath = path.resolve(mainFolderPath, p);
    await fs.promises.mkdir(path.parse(fullPath).dir, {
        recursive: true,
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.statusText);
    response.body.pipe(fs.createWriteStream(fullPath));
    response.body.on("data", b => onProgress?.(b.length));
    await new Promise<void>(resolve =>
        response.body.once("end", () => resolve())
    );
}
export async function writeFile(
    p: string | string[],
    data: string | Uint8Array
): Promise<void> {
    await fs.promises.writeFile(
        path.resolve(mainFolderPath, ..._.castArray(p)),
        data
    );
}
export async function readFileToString(
    p: string | string[],
    encoding?: BufferEncoding
): Promise<string> {
    const buffer = await fs.promises.readFile(
        path.resolve(mainFolderPath, ..._.castArray(p))
    );
    return buffer.toString(encoding ?? "utf8");
}
export async function fileExists(...p: string[]): Promise<boolean> {
    try {
        await fs.promises.access(path.resolve(mainFolderPath, ...p));
        return true;
    } catch (error) {
        return false;
    }
}
export function getFileSHA1(...p: string[]): Promise<string> {
    return sha1File(path.resolve(mainFolderPath, ...p));
}
