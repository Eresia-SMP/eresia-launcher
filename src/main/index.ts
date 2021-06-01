import * as path from "path";
import { app, BrowserWindow } from "electron";
import * as isDev from "electron-is-dev";

let win = null;

class createWin {
    constructor() {
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

        console.log(URL);

        win.loadURL(URL);
    }
}

app.whenReady().then(() => new createWin());

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        new createWin();
    }
});
