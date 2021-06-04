import * as path from "path";
import { app, BrowserWindow } from "electron";
import * as isDev from "electron-is-dev";
import JvmVersionsManager from "./jvmVersionsManager";

let win = null;
function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webSecurity: false,
        },
        backgroundColor: "#292D3E",
    });

    const URL = isDev
        ? `http://localhost:1234`
        : `file://${path.resolve(__dirname, "dist/renderer/index.html")}`;

    win.loadURL(URL);
}

let gameFilesPath;
let jvmVersionsManager;

(async () => {
    await app.whenReady();

    gameFilesPath = path.resolve(app.getPath("appData"), ".eresia_smp");
    jvmVersionsManager = new JvmVersionsManager(
        path.resolve(gameFilesPath, "jvm")
    );

    createWindow();
})();

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
