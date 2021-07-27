export type LinkToJson<T> = string;

export interface VersionDataDownload {
    /** The SHA1 of the asset */
    sha1: string;
    /** The size of the asset */
    size: number;
    /** Url to download the asset */
    url: string;
}

export type VersionDataRule = {
    action: "allow" | "disallow";
    os?: {
        name?: "osx" | "windows" | "linux";
        version?: "^10\\.";
        arch?: "x86";
    };
    features?: { is_demo_user?: boolean; has_custom_resolution?: boolean };
};

export interface VersionDataLibrary {
    /** A maven name for the library, in the form of "groupId:artifactId:version". */
    name: string;
    /**
     * Information about native libraries (in C) bundled with this library.
     * Appears only when there are classifiers for natives.
     * */
    natives?: {
        osx?: string;
        windows?: string;
        linux?: string;
    };
    rules?: VersionDataRule[];
    downloads: {
        artifact: {
            /**
             * Path to store the downloaded artifact,
             * relative to the "libraries" directory in .minecraft.
             * */
            path: string;
        } & VersionDataDownload;
        classifiers?: {
            [key: string]: {
                /**
                 * Path to store the downloaded artifact,
                 * relative to the "libraries" directory in .minecraft.
                 * */
                path: string;
            } & VersionDataDownload;
        };
    };
    extract?: {
        exclude: string[];
    };
}

export type VersionDataArgument =
    | {
          rules: VersionDataRule[];
          value: string | string[];
      }
    | string;

export interface VersionData {
    /** Unique id for version */
    id: string;
    /** Time version was created ? */
    time: string;
    /** Time of version release */
    releaseTime: string;
    /** Wether version is a release or snapshot or beta etc... */
    type: "release" | "snapshot";
    /** Main class to start the game */
    mainClass: string;
    /** Optionally inherit from another version */
    inheritsFrom?: string;
    /** The minimum Launcher version that can run this version of the game. */
    minimumLauncherVersion: number;

    assetIndex: {
        /** The assets version */
        id: string;
        /** SHA1 of the assets file */
        sha1: string;
        size: number;
        totalSize: number;
        url: LinkToJson<VersionAssetIndexes>;
    };
    /** The assets version */
    assets: string;
    /** 1 if has new multiplayer safety thing, 0 otherwise */
    complianceLevel: 1 | 0;
    downloads: {
        /** Client download information */
        client: VersionDataDownload;
        /** The obfuscation maps for this client version. */
        client_mappings?: VersionDataDownload;
        /** Server download information */
        server: VersionDataDownload;
        /** The obfuscation maps for this server version. */
        server_mappings?: VersionDataDownload;
    };
    /** Added with 1.17 snapshots */
    javaVersion?: {
        component: string;
        majorVersion: number;
    };
    logging?: {
        client: {
            argument: string;
            file: {
                id: string;
            } & VersionDataDownload;
            type: "log4j2-xml";
        };
    };

    arguments: {
        game: VersionDataArgument[];
        jvm: VersionDataArgument[];
    };

    libraries: VersionDataLibrary[];
}

export interface VersionAssetIndexes {
    objects: {
        [key: string]: {
            hash: string;
            size: number;
        };
    };
}
