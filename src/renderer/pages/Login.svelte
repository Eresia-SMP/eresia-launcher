<script lang="ts">
    import Button from "../components/Button.svelte";
    import TextInput from "../components/TextInput.svelte";

    let email = "";
    let password = "";

</script>

<div class="absolute inset-0 flex justify-center items-center p-5">
    <form
        class="flex flex-col gap-10 w-[500px] max-w-full"
        on:submit={e => {
            e.preventDefault();
        }}
    >
        <h1 class="block text-2xl text-center">Connection (Mojang account)</h1>
        <div
            class="grid grid-rows-2 gap-4"
            style={"grid-template-columns: auto 1fr"}
        >
            <div class="flex items-center">
                <span>Email</span>
            </div>
            <div>
                <TextInput bind:value={email} type="text" className="w-full" />
            </div>
            <div class="flex items-center">
                <span>Password</span>
            </div>
            <div>
                <TextInput
                    bind:value={password}
                    type="password"
                    className="w-full"
                />
            </div>
        </div>
        <div class="flex justify-end">
            <Button>Connexion</Button>
        </div>
    </form>
</div>
