<script lang="ts">
    import Login from "./pages/Login.svelte";
    import LoggedIn from "./pages/LoggedIn.svelte";
    import mojangLoginData from "./utils/mojangLoginData";

</script>

{#if $mojangLoginData}
    <LoggedIn />
{:else}
    <Login />
{/if}
