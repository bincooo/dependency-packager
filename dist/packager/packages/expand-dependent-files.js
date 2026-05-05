"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadModulesConfig = void 0;
const mz_1 = require("mz");
const path_1 = require("path");
function loadModulesConfig() {
    const jsonPath = (0, path_1.join)(__dirname, "../../..", "modules.json");
    const chunk = mz_1.fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(chunk);
}
exports.loadModulesConfig = loadModulesConfig;
// export const modules: Record<string, { version?: string[], manifest: string[] }> = {
//     "react": {
//         version: ["17.0.2"],
//         manifest: [
//             "/cjs/react-jsx-runtime.development.js",
//         ]
//     },
//     "@babel/runtime": {
//         manifest: [
//             "/helpers/*",
//             "/regenerator/*"
//         ]
//     },
//     "antd-style": {
//         manifest: [
//             "/lib/index.js",
//         ]
//     },
//     "@tanstack/react-query": {
//         manifest: [
//             "/build/modern/index.js",
//         ]
//     },
//     "@rc-component/util": {
//         manifest: [
//             "/lib/*",
//         ]
//     },
// }
//# sourceMappingURL=expand-dependent-files.js.map