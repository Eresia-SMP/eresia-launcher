export interface MojangApiSkin {
    skin: string;
    cape?: string;
}

const playerSkinsCache: { [uuid: string]: MojangApiSkin } = {};
export async function getPlayerSkin(
    uuid: string,
    controller?: AbortController
): Promise<MojangApiSkin | null> {
    if (uuid in playerSkinsCache) return playerSkinsCache[uuid];
    const signal = controller?.signal;

    console.log(`Fetching skin for ${uuid}`);
    const response = await fetch(
        `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
        {
            method: "GET",
            signal,
        }
    );
    if (response.status !== 200) {
        return null;
    }

    if (signal && signal.aborted) return null;
    const body = await response.json();
    if (signal && signal.aborted) return null;
    console.log(`Raw response: ${JSON.stringify(body)}`);

    const { textures } = JSON.parse(
        atob((body.properties as any[]).find(v => v.name === "textures").value)
    );
    console.log(`Textures: ${JSON.stringify(textures)}`);
    const skin = {
        skin: textures.SKIN.url,
        cape: textures.CAPE?.url,
    };
    playerSkinsCache[uuid] = skin;
    return skin;
}
