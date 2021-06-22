import * as ProfileManager from "../profileManager/profileManager";
import * as VersionManager from "../versionManager/versionManager";
import { GameStartOptions } from "../../common/gameLauncher";
import * as JvmManager from "../jvmManager/jvmVersionsManager";
import * as path from "path";
import {
    fileExists,
    mainFolderPath,
    readFileToString,
    writeFile,
} from "../index";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as config from "./config.json";
import _ = require("lodash");
import { ipcMain } from "electron";

let currentStartedGame: ChildProcessWithoutNullStreams | null = null;

export function init() {
    ipcMain.handle(
        "startMCProfile",
        async (e, v: string, options: GameStartOptions) => {
            if (!_.isString(v) || !_.isObject(options))
                throw "Invalid argument";
            let r = await startProfile(v, options);
            if (!r || !currentStartedGame) return false;
            currentStartedGame.on("close", code =>
                e.sender.send("onGameClose", v, code)
            );
            return true;
        }
    );
}

export async function startProfile(
    id: string,
    options: GameStartOptions
): Promise<boolean> {
    const profileData = await ProfileManager.getProfileData(id);
    if (!profileData) return false;
    const profileDownloadState = await ProfileManager.getProfileDownloadState(
        id
    );
    if (
        !profileDownloadState ||
        profileDownloadState.downloadedSize !== profileDownloadState.totalSize
    )
        return false;
    const jvmVersion = await VersionManager.getEffectiveVersionJVM(
        profileData.version
    );
    if (!jvmVersion) return false;
    const libraries = await VersionManager.resolveVersionLibraries(
        profileData.version
    );
    if (!libraries) return false;
    const versionData = await VersionManager.getVersionData(
        profileData.version
    );
    if (!_.isObject(versionData)) return false;

    const jvmExecutablePath = path.join(
        mainFolderPath,
        "jvm",
        jvmVersion.toString(),
        "bin",
        `java${process.platform === "win32" ? ".exe" : ""}`
    );
    let args: string[] = [];

    let classpath: string;
    // libraries
    {
        let separator;
        if (process.platform === "win32") separator = ";";
        else separator = ":";
        classpath = [
            ...libraries.map(l => path.join(mainFolderPath, l.path)),
            path.join(mainFolderPath, "versions", id, `${id}.jar`),
        ].join(separator);
    }

    const argReplaceTable: { [key: string]: string } = {
        auth_player_name: options.auth.playerName,
        auth_uuid: options.auth.uuid,
        auth_access_token: options.auth.accessToken,
        user_type: "mojang",
        width: (options.customResolution?.width || 0).toString(),
        height: (options.customResolution?.height || 0).toString(),
        version_name: id,
        version_type: versionData.type,
        game_directory: path.resolve(mainFolderPath, "versions", id),
        natives_directory: path.resolve(
            mainFolderPath,
            "versions",
            id,
            "natives"
        ),
        launcher_name: config.launcherName,
        launcher_version: config.launcherVersion,
        classpath: classpath,
    };
    for (let arg of versionData.arguments.jvm) {
        if (_.isString(arg)) {
            let newArg = arg;
            for (const [k, v] of Object.entries(argReplaceTable)) {
                newArg = newArg.replace("${" + k + "}", v);
            }
            args.push(newArg);
        } else {
        }
    }
    args.push(versionData.mainClass);
    for (let arg of versionData.arguments.game) {
        if (_.isString(arg)) {
            let newArg = arg;
            for (const [k, v] of Object.entries(argReplaceTable)) {
                newArg = newArg.replace("${" + k + "}", v);
            }
            args.push(newArg);
        } else {
        }
    }

    currentStartedGame = spawn(jvmExecutablePath, args);
    return false;
}
