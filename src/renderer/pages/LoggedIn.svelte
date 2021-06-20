<script lang="ts">
    import type { McProfile } from "../../common/profileManager";
    import { find } from "lodash";
    import LoadedLoggedIn from "./LoadedLoggedIn.svelte";

    let profiles: Promise<McProfile[]> = McProfileManager.getAllProfiles();

</script>

{#await profiles}
    <div class="absolute inset-0 flex items-center justify-center">
        <h1 class="text-xl font-bold">Loading</h1>
    </div>
{:then profiles}
    <LoadedLoggedIn {profiles} />
{/await}
