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
import * as fs from "fs";

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

    const whatToFind =
        "C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/patchy/1.1/patchy-1.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/oshi-project/oshi-core/1.1/oshi-core-1.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/net/java/dev/jna/jna/4.4.0/jna-4.4.0.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/net/java/dev/jna/platform/3.4.0/platform-3.4.0.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/ibm/icu/icu4j/66.1/icu4j-66.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/javabridge/1.0.22/javabridge-1.0.22.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/net/sf/jopt-simple/jopt-simple/5.0.3/jopt-simple-5.0.3.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/io/netty/netty-all/4.1.25.Final/netty-all-4.1.25.Final.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/google/guava/guava/21.0/guava-21.0.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/commons/commons-lang3/3.5/commons-lang3-3.5.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/commons-io/commons-io/2.5/commons-io-2.5.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/commons-codec/commons-codec/1.10/commons-codec-1.10.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/net/java/jinput/jinput/2.0.5/jinput-2.0.5.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/net/java/jutils/jutils/1.0.0/jutils-1.0.0.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/brigadier/1.0.17/brigadier-1.0.17.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/datafixerupper/4.0.26/datafixerupper-4.0.26.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/google/code/gson/gson/2.8.0/gson-2.8.0.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/authlib/2.1.28/authlib-2.1.28.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/commons/commons-compress/1.8.1/commons-compress-1.8.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/httpcomponents/httpclient/4.3.3/httpclient-4.3.3.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/commons-logging/commons-logging/1.1.3/commons-logging-1.1.3.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/httpcomponents/httpcore/4.3.2/httpcore-4.3.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/it/unimi/dsi/fastutil/8.2.1/fastutil-8.2.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/logging/log4j/log4j-api/2.8.1/log4j-api-2.8.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/apache/logging/log4j/log4j-core/2.8.1/log4j-core-2.8.1.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl/3.2.2/lwjgl-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-jemalloc/3.2.2/lwjgl-jemalloc-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-openal/3.2.2/lwjgl-openal-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-opengl/3.2.2/lwjgl-opengl-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-glfw/3.2.2/lwjgl-glfw-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-stb/3.2.2/lwjgl-stb-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/org/lwjgl/lwjgl-tinyfd/3.2.2/lwjgl-tinyfd-3.2.2.jar;C:/Users/Malo/AppData/Roaming/.minecraft/libraries/com/mojang/text2speech/1.11.3/text2speech-1.11.3.jar;C:/Users/Malo/AppData/Roaming/.minecraft/versions/1.16.5/1.16.5.jar"
            .split(";")
            .map(p => path.parse(p))
            .map(p => p.base);
    const whatIFound = classpath
        .split(";")
        .map(p => path.parse(p))
        .map(p => p.base);
    for (const i of whatIFound) {
        if (!whatToFind.includes(i)) {
            console.log(`Not ${i}`);
        }
    }

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
