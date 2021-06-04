const { src, dest, parallel, watch } = require("gulp");
const ts = require("gulp-typescript");
const path = require("path");

const tsProject = ts.createProject("src/main/tsconfig.json", {
    rootDir: path.join(__dirname, "src"),
});

function buildTS() {
    return src("src/main/**/*.ts").pipe(tsProject()).pipe(dest("dist/main"));
}
function moveJson() {
    return src("src/main/**/*.json").pipe(dest("dist/main"));
}
exports.default = parallel(buildTS, moveJson);

exports.watch = function watchMain(cb) {
    watch(["src/main/**/*.ts"], buildTS);
    watch(["src/main/**/*.json"], moveJson);
};
