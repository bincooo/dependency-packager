"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hash = require("string-hash");
function default_1({ name, version }) {
    return String(hash(JSON.stringify(`${name}@${version}`)));
}
exports.default = default_1;
//# sourceMappingURL=get-hash.js.map