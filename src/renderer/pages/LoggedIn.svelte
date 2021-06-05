<script lang="ts">
    import mojangLoginData from "../utils/mojangLoginData";
    import playerSkinHeadImage from "../utils/playerSkinHeadImage";

    let choosenVersion = localStorage.getItem("selectedVersion") ?? "";
    $: {
        localStorage.setItem("selectedVersion", choosenVersion);
    }
    let playButtonTest: string | null;
    $: playButtonTest = choosenVersion === "Hiii" ? "Download" : "Play";

</script>

<div class="absolute inset-0 flex flex-col justify-center">
    <div class="flex-grow pt-3 flex flex-col relative">
        <div
            class="absolute top-3 left-3 text-xl flex items-center gap-3 hover:bg-main-1 p-2 rounded"
        >
            {#if $mojangLoginData}
                <img
                    alt="{$mojangLoginData.profile.name}'s skin head"
                    use:playerSkinHeadImage={$mojangLoginData.profile.uuid}
                    class="w-10 inline-block rounded"
                />
                {$mojangLoginData.profile.name}
            {/if}
        </div>
        <div>
            <h1 class="text-5xl text-center">Eresia Launcher</h1>
        </div>
    </div>
    <div class="py-3 flex justify-center items-center gap-6">
        <select
            class="bg-main-1 text-xl rounded px-5 py-1 focus:outline-none focus:ring"
            bind:value={choosenVersion}
        >
            <option value="smp">SMP 1.16</option>
            <option value="1.16.5">Vanilla 1.16</option>
        </select>
        <button
            disabled={playButtonTest === null}
            class="text-4xl font-mono uppercase px-9 py-1 rounded-lg {playButtonTest !==
            null
                ? 'cursor-pointer bg-main-1 text-white'
                : 'cursor-default border-main-1 border-4 text-main-1'}"
            >{playButtonTest ?? "Download"}</button
        >
    </div>
</div>
