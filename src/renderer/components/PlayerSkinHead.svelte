<script lang="ts">
    import { getPlayerSkin } from "../utils/mojangApi";
    export let uuid: string;
    export let alt: string;

    let imageUrl: string | null | undefined;
    $: {
        if (imageUrl === undefined) {
            (async () => {
                imageUrl = null;
                const skin = await getPlayerSkin(uuid);
                if (skin === null) return;
                const image = new Image();
                image.addEventListener("load", () => {
                    const headWidth = Math.round(0.125 * image.width);
                    const headHeight = Math.round(0.125 * image.height);

                    const canvas = document.createElement("canvas");
                    canvas.width = headWidth * 20;
                    canvas.height = headHeight * 20;
                    const ctx = canvas.getContext("2d");
                    if (ctx === null) throw "";

                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(
                        image,
                        headWidth,
                        headHeight,
                        headWidth,
                        headHeight,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                    ctx.drawImage(
                        image,
                        5 * headWidth,
                        headHeight,
                        headWidth,
                        headHeight,
                        1,
                        1,
                        canvas.width,
                        canvas.height
                    );

                    imageUrl = canvas.toDataURL();
                });
                image.src = skin.skin;
            })();
        }
    }

</script>

{#if imageUrl}
    <img src={imageUrl} {alt} />
{/if}
