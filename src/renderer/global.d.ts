/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { McVersionManagerApi } from "../common/minecraftVersionManager";

declare global {
    const McVersionManager: McVersionManagerApi;
}
