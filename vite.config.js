const svelte = require("@sveltejs/vite-plugin-svelte");
const path = require("path");
const sveltePreprocess = require("svelte-preprocess");

/**
 * @type {import('vite').UserConfig}
 */
const config = {
    root: path.resolve(__dirname, "src/renderer"),
    publicDir: path.resolve(__dirname, "src/public"),

    server: {
        port: 1234,
    },

    build: {
        outDir: path.resolve(__dirname, "dist/renderer"),
        emptyOutDir: true,
    },

    plugins: [
        svelte({
            preprocess: sveltePreprocess(),
        }),
    ],
};

export default config;
