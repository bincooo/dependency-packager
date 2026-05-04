"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path_1 = require("path");
function exists(path) {
    if (fs.existsSync(path)) {
        return path;
    }
}
/**
 * This will use node's way of resolving a javascript file. For example,
 * if the path is `dist`, but the file is `dist/index.js` this will return
 * `dist/index.js`.
 *
 * @export string if path exists
 * @param {string} path
 */
function readFile(path, file = "index.js") {
    if (exists(path) && fs.lstatSync(path).isDirectory()) {
        return exists((0, path_1.join)(path, file));
    }
    else {
        return exists(path) || exists(path + ".js") || exists(path + ".json");
    }
}
exports.default = readFile;
//# sourceMappingURL=node-resolve-path.js.map