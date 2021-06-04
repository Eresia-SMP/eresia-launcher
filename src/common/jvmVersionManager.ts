export type JVMVersion = 8 | 11;

export type DownloadState =
    | { type: "downloaded"; updateDate: Date }
    | { type: "downloading"; progress: number }
    | { type: "absent" }
    | { type: "outdated" };
