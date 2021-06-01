<script lang="ts">
    import Button from "../components/Button.svelte";
    import TextInput from "../components/TextInput.svelte";
    import mojangApiClientToken from "../utils/mojangApiClientToken";
    import mojangLoginData from "../utils/mojangLoginData";

    let email = "";
    let password = "";
    let loginPromise: Promise<string | null> | null = null;
    let isConnecting = false;

    $: canConnect = email !== "" && password !== "" && !isConnecting;

    const login = async () => {
        isConnecting = true;
        const response = await fetch(
            "https://authserver.mojang.com/authenticate",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    agent: {
                        name: "Minecraft",
                        version: 1,
                    },
                    username: email,
                    password,
                    clientToken: mojangApiClientToken,
                    requestUser: true,
                }),
            }
        );
        const body = await response.json();

        isConnecting = false;
        if (body.error) {
            return body.errorMessage;
        } else {
            mojangLoginData.set({
                accessToken: body.accessToken,
                email,
                profile: {
                    name: body.selectedProfile.name,
                    uuid: body.selectedProfile.id,
                },
            });
        }
        return null;
    };

</script>

<div class="absolute inset-0 flex justify-center items-center p-5">
    <form
        class="flex flex-col gap-10 w-[500px] max-w-full"
        on:submit={e => {
            e.preventDefault();
            loginPromise = login();
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
        <div class="flex justify-end items-center">
            {#if loginPromise}
                {#await loginPromise}
                    <div class="text-yellow-600">Connection...</div>
                {:then result}
                    {#if result !== null}
                        <div class="text-red-700 font-extrabold">{result}</div>
                    {/if}
                {/await}
            {/if}
            <Button disabled={!canConnect}>Connexion</Button>
        </div>
    </form>
</div>
