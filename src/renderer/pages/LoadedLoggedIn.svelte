<script lang="ts">
    import { find, replace } from "lodash";
    import type { McProfile } from "../../common/profileManager";
    import mojangLoginData from "../utils/mojangLoginData";
    import playerSkinHeadImage from "../utils/playerSkinHeadImage";

    export let profiles: McProfile[];
    let profileLoadingState:
        | {
              type: "idle";
          }
        | {
              type: "disabled";
          }
        | {
              type: "downloading";
              total: number;
              downloaded: number;
              progress: number;
          } = { type: "idle" };

    let choosenVersion = localStorage.getItem("selectedVersion") ?? "smp";
    $: localStorage.setItem("selectedVersion", choosenVersion);
    let playButtonTest: string;
    $: playButtonTest = (
        profiles.find(p => p.id === choosenVersion)?.downloadState ?? ""
    )
        .replace("absent", "Download")
        .replace("downloaded", "Play");

    async function onButtonPress() {
        if (!$mojangLoginData) return;

        profileLoadingState = { type: "disabled" };
        const profile = await McProfileManager.getProfile(choosenVersion);
        if (!profile) throw "Error";
        profiles[profiles.findIndex(p => p.id === profile.id)] = profile;

        if (profile.downloadState === "absent") {
            const r = await McProfileManager.downloadProfile(profile.id);
            if (!r) throw "Could not download profile";
            let callback: (id: string, total: number, progress: number) => void;
            callback = (id, total, progress) => {
                if (id !== profile.id) return;
                profileLoadingState = {
                    type: "downloading",
                    downloaded: progress,
                    total: total,
                    progress: progress / total,
                };
                if (profileLoadingState.progress === 1)
                    LauncherEvents.off("mcProfileDownloadProgress", callback);
            };
            LauncherEvents.on("mcProfileDownloadProgress", callback);
        } else if (profile.downloadState === "downloaded") {
            GameLauncher.startMCProfile(profile.id, {
                auth: {
                    accessToken: $mojangLoginData.accessToken,
                    playerName: $mojangLoginData.profile.name,
                    uuid: $mojangLoginData.profile.uuid,
                },
            });
        }
    }
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
            disabled={profileLoadingState.type !== "idle"}
            bind:value={choosenVersion}
        >
            {#each profiles as profile}
                <option value={profile.id} id={profile.id}
                    >{profile.name}</option
                >
            {/each}
        </select>
        <div class="w-56 h-11 relative">
            {#if profileLoadingState.type === "idle" || profileLoadingState.type === "disabled"}
                <button
                    on:click={onButtonPress}
                    disabled={profileLoadingState.type === "disabled"}
                    class="
                    text-4xl font-mono uppercase rounded-lg absolute inset-0 w-full
                    {profileLoadingState.type === 'idle'
                        ? 'cursor-pointer bg-main-1 text-white'
                        : 'cursor-default border-main-1 border-4 text-main-1'}
                    ">{playButtonTest}</button
                >
            {:else if profileLoadingState.type === "downloading"}
                <div class="absolute inset-0 bg-main-3 rounded overflow-hidden">
                    <div
                        class="h-full bg-green-500"
                        style="width: {100 * profileLoadingState.progress}%;"
                    >
                        <div
                            class="w-full h-full bg-red-500"
                            style="opacity: {100 *
                                (1 - profileLoadingState.progress)}%;"
                        />
                    </div>
                    <div
                        class="absolute inset-0 flex justify-center items-center"
                    >
                        <div
                            class="px-3 py-1 bg-black bg-opacity-25 text-white rounded"
                        >
                            {Math.floor(
                                profileLoadingState.downloaded / 1000000
                            )}MB / {Math.floor(
                                profileLoadingState.total / 1000000
                            )}MB
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
