<script lang="ts">
    import mojangLoginData from "../utils/mojangLoginData";
    import PlayerSkinHead from "../components/PlayerSkinHead.svelte";

</script>

<div class="absolute inset-0 flex justify-center items-center p-5">
    {#if $mojangLoginData}
        <PlayerSkinHead
            uuid={$mojangLoginData.profile.uuid}
            alt="{$mojangLoginData.profile.name}'s skin head"
        />
    {/if}
</div>
