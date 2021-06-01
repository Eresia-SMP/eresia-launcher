<script lang="ts">
    export let type: string = "text";
    export let className: string = "";

    export let value: string = "";

    const handleInput = (e: Event) => {
        value = (e.target as HTMLInputElement).value;
    };

</script>

<input
    class="
    block rounded focus:outline-none focus:ring bg-main-1 px-2 py-1
    {className}
    "
    on:input={handleInput}
    on:change={handleInput}
    {type}
/>
