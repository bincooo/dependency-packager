"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const s = require("semver");
function findMatchingVersion(versions, semver) {
    return versions.find(v => s.intersects(semver, semver));
}
exports.default = findMatchingVersion;
//# sourceMappingURL=find-matching-version.js.map