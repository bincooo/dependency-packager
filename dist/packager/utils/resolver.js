"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageFilter = void 0;
function packageFilter(pkg) {
    if (pkg.module) {
        pkg.main = pkg.module;
    }
    return pkg;
}
exports.packageFilter = packageFilter;
//# sourceMappingURL=resolver.js.map