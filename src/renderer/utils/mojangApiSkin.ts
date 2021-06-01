import mojangLoginData from "./mojangLoginData";
import { derived } from "svelte/store";

interface MojangApiSkin {
    skin: string;
    cape?: string;
}

export default derived<typeof mojangLoginData, MojangApiSkin | null>(
    mojangLoginData,
    ($mojangLoginData, set) => {
        if ($mojangLoginData === undefined) {
            set(null);
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;

        (async () => {
            console.log(`Fetching skin for ${$mojangLoginData.profile.name}`);
            const response = await fetch(
                `https://sessionserver.mojang.com/session/minecraft/profile/${$mojangLoginData.profile.uuid}`,
                {
                    method: "GET",
                    signal,
                }
            );
            if (response.status !== 200) {
                set(null);
                return;
            }

            if (signal.aborted) return;
            const body = await response.json();
            if (signal.aborted) return;
            console.log(`Raw response: ${JSON.stringify(body)}`);

            const { textures } = JSON.parse(
                atob(
                    (body.properties as any[]).find(v => v.name === "textures")
                        .value
                )
            );
            console.log(`Textures: ${JSON.stringify(textures)}`);

            set({
                skin: textures.SKIN.url,
                cape: textures.CAPE?.url,
            });
        })();

        return () => controller.abort();
    },
    null
);
