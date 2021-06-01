<script lang="ts">
    import mojangLoginData from "../utils/mojangLoginData";
    import playerSkinHeadImage from "../utils/playerSkinHeadImage";

</script>

<div class="absolute inset-0 flex justify-center items-center p-5">
    {#if $mojangLoginData}
        <img
            use:playerSkinHeadImage={$mojangLoginData.profile.uuid}
            alt={$mojangLoginData.profile.name}
        />
    {/if}
</div>
