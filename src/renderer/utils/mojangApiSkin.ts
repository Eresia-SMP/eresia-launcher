import mojangLoginData from "./mojangLoginData";
import { MojangApiSkin, getPlayerSkin } from "./mojangApi";
import { derived } from "svelte/store";

export default derived<typeof mojangLoginData, MojangApiSkin | null>(
    mojangLoginData,
    ($mojangLoginData, set) => {
        if ($mojangLoginData === undefined) {
            set(null);
            return;
        }

        const controller = new AbortController();
        (async () => {
            set(await getPlayerSkin($mojangLoginData.profile.uuid, controller));
        })();
        return () => controller.abort();
    },
    null
);
