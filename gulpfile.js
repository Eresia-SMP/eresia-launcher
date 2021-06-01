const { src, dest } = require("gulp");
const ts = require("gulp-typescript");

const tsProject = ts.createProject("tsconfig.json");

function buildTS(cb) {
    return src("src/main/**/*.ts").pipe(tsProject()).pipe(dest("dist/main"));
}
exports.default = buildTS;
