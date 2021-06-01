module.exports = {
    mode: "jit",
    purge: ["src/renderer/**/*.{html,svelte,css,ts}"],
    darkMode: false,
    theme: {
        extend: {
            colors: {
                background: "#292D3E",
            },
        },
    },
    variants: {
        extend: {},
    },
    plugins: [],
};
