"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hash = require("string-hash");
function default_1(packages) {
    if (!packages || Object.keys(packages).length === 0) {
        return null;
    }
    const packagesList = Object.keys(packages)
        .map(key => {
        return key + ":" + packages[key];
    })
        .sort((a, b) => {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    });
    return String(hash(JSON.stringify(packagesList)));
}
exports.default = default_1;
//# sourceMappingURL=get-hash.js.map