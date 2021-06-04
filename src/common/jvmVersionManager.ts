export type JVMVersion = 8 | 11;

const jreVersionsLinks: {
    [version: string]: { link: string; date: Date };
} = {
    "8_win32_x86": {
        link: "https://github.com/AdoptOpenJDK/openjdk8-binaries/releases/download/jdk8u292-b10/OpenJDK8U-jre_x86-32_windows_hotspot_8u292b10.zip",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "8_win32_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk8-binaries/releases/download/jdk8u292-b10/OpenJDK8U-jre_x64_windows_hotspot_8u292b10.zip",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "8_darwin_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk8-binaries/releases/download/jdk8u292-b10/OpenJDK8U-jre_x64_mac_hotspot_8u292b10.tar.gz",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "8_linux_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk8-binaries/releases/download/jdk8u292-b10/OpenJDK8U-jre_x64_linux_hotspot_8u292b10.tar.gz",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "11_win32_x86": {
        link: "https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.11%2B9/OpenJDK11U-jre_x86-32_windows_hotspot_11.0.11_9.zip",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "11_win32_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.11%2B9/OpenJDK11U-jre_x64_windows_hotspot_11.0.11_9.zip",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "11_darwin_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.11%2B9/OpenJDK11U-jre_x64_mac_hotspot_11.0.11_9.tar.gz",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
    "11_linux_x64": {
        link: "https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.11%2B9/OpenJDK11U-jre_x64_linux_hotspot_11.0.11_9.tar.gz",
        date: new Date(
            "Wed Jun 02 2021 17:04:29 GMT+0200 (Central European Summer Time)"
        ),
    },
};
export function getJreVersionLink(
    v: JVMVersion,
    os: string,
    arch: string
): { link: string; date: Date } | null {
    const k = v + "_" + os + "_" + arch;
    if (!(k in jreVersionsLinks)) return null;
    return jreVersionsLinks[k];
}

export type DownloadState =
    | { type: "downloaded"; updateDate: Date }
    | { type: "downloading"; progress: number }
    | { type: "absent" }
    | { type: "outdated" };
