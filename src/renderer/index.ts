import App from "./App.svelte";

let root = document.getElementById("root");
if (!root) {
    root = document.createElement("div");
    document.body.appendChild(root);
}

new App({
    target: root,
});
