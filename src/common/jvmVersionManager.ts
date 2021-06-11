export type JVMVersion = 8 | 11;

export type JVMDownloadState =
    | { type: "downloaded"; updateDate: Date; totalSize: number }
    | { type: "downloading"; totalSize: number; downloadedSize: number }
    | { type: "absent"; totalSize: number }
    | { type: "outdated"; updateSize: number };
