<script lang="ts">
    export let disabled: boolean = false;

</script>

<button
    class="
    bg-main-1 rounded p-1.5 px-4 focus:outline-none focus:ring
    {disabled ? 'bg-transparent cursor-default' : 'cursor-pointer'}
    "
    {disabled}
    on:click><slot /></button
>
