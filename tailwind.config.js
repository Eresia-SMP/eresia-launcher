module.exports = {
    mode: "jit",
    purge: ["src/renderer/**/*.{html,svelte,css,ts}"],
    darkMode: false,
    theme: {
        extend: {
            colors: {
                main: {
                    default: "#292D3E",
                    0: "#292D3E",
                    1: "#3F4563",
                    3: "#4B5169",
                },
            },
        },
    },
    variants: {
        extend: {},
    },
    plugins: [],
};
