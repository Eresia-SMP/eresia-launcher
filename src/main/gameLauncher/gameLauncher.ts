import * as ProfileManager from "../profileManager/profileManager";
import * as VersionManager from "../versionManager/versionManager";
import { GameStartOptions } from "../../common/gameLauncher";
import * as path from "path";
import { mainFolderPath } from "../index";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as config from "./config.json";
import _ = require("lodash");
import { ipcMain } from "electron";
import * as fs from "fs";
import * as extract from "extract-zip";

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
    console.log(`Launching profile ${id} with option`, options);

    const profileData = ProfileManager.getProfileData(id);
    if (!profileData) return false;
    console.log(`Using version ${profileData.version}`);

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
    const versionData = await VersionManager.getVersionData(
        profileData.version
    );
    if (!_.isObject(versionData)) return false;

    if (profileData.gameFolderData) {
        console.log(
            `Extracting game folder data for profile ${profileData.id}`
        );
        fs.promises.mkdir(path.resolve(mainFolderPath, "profiles", id), {
            recursive: true,
        });
        await extract(
            path.resolve(
                mainFolderPath,
                "profiles",
                "game_data",
                `${profileData.id}.zip`
            ),
            {
                dir: path.resolve(mainFolderPath, "profiles", id),
            }
        );
        console.log("Extracted");
    }

    const jvmExecutablePath = path.join(
        mainFolderPath,
        "jvm",
        jvmVersion.toString(),
        "bin",
        `java${process.platform === "win32" ? ".exe" : ""}`
    );
    let args: string[] = [];

    let classpath = await VersionManager.resolveVersionClasspath(
        versionData.id
    );
    if (!classpath) return false;

    const argReplaceTable: { [key: string]: string } = {
        auth_player_name: options.auth.playerName,
        auth_uuid: options.auth.uuid,
        auth_access_token: options.auth.accessToken,
        user_type: "mojang",
        width: (options.customResolution?.width || 0).toString(),
        height: (options.customResolution?.height || 0).toString(),
        version_name: versionData.id,
        version_type: versionData.type,
        game_directory: path.resolve(mainFolderPath, "profiles", id),
        assets_root: path.resolve(mainFolderPath, "assets"),
        natives_directory: path.resolve(
            mainFolderPath,
            "versions",
            versionData.id,
            "natives"
        ),
        assets_index_name: versionData.assets,
        launcher_name: config.launcherName,
        launcher_version: config.launcherVersion,
        classpath: classpath,
    };
    for (let arg of versionData.arguments.jvm) {
        let newArgs: string[] = [];
        if (_.isString(arg)) {
            newArgs = [arg];
        } else if (
            VersionManager.resolveVersionDataRules(arg.rules) === "allow"
        ) {
            newArgs = _.castArray(arg.value);
        }
        args.push(
            ...newArgs.map(a => {
                for (const [k, v] of Object.entries(argReplaceTable)) {
                    a = a.replace("${" + k + "}", v);
                }
                return a;
            })
        );
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

    const cwd = path.resolve(mainFolderPath, "profiles", id);
    fs.promises.mkdir(cwd, {
        recursive: true,
    });

    currentStartedGame = spawn(jvmExecutablePath, args, {
        cwd,
    });

    currentStartedGame.on("error", e => console.error(e));
    currentStartedGame.stderr.on("data", c =>
        console.error("Game error output:", c.toString())
    );
    currentStartedGame.stdout.on("data", c =>
        console.log("Game output:", c.toString())
    );

    return false;
}
