"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modules = void 0;
const mz_1 = require("mz");
const path_1 = require("path");
function loadModulesConfig() {
    const jsonPath = (0, path_1.join)(__dirname, "../../..", "modules.json");
    const chunk = mz_1.fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(chunk);
}
exports.modules = loadModulesConfig();
//# sourceMappingURL=expand-dependent-files.js.map