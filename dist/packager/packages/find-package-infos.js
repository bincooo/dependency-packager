"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const mz_1 = require("mz");
const path_1 = require("path");
function getDirectories(path) {
    const directories = mz_1.fs
        .readdirSync(path)
        .filter((file) => !file.startsWith("."))
        .filter((file) => mz_1.fs.lstatSync((0, path_1.join)(path, file)).isDirectory())
        .map((file) => (0, path_1.join)(path, file));
    return (0, lodash_1.flatten)(directories.map((directory) => {
        if ((0, path_1.basename)(directory).startsWith("@")) {
            // We will check what inside this directory if it starts with an @, because
            // this means that it's under an organization
            return getDirectories(directory);
        }
        const directoriesInDirectory = getDirectories(directory);
        // There is a chance of a recursive node_modules, make sure to add it as well
        const nodeModulesInside = directoriesInDirectory.find((d) => (0, path_1.basename)(d) === "node_modules");
        if (nodeModulesInside) {
            return [directory, ...getDirectories(nodeModulesInside)];
        }
        return directory;
    }));
}
// Fields to check, in this order
const MAIN_FIELDS = ["browser", "module", "main", "unpkg"];
/**
 * Finds the most appropriate main field to use from the package.json
 */
function getMainField(pkg) {
    return MAIN_FIELDS.map((field) => {
        const packageField = pkg[field];
        // It can also be an object, don't allow it in that case
        if (typeof packageField === "string") {
            return packageField;
        }
        return null;
    }).find((x) => x != null);
}
function findPackageInfos(packageName, rootPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const directories = getDirectories((0, path_1.join)(rootPath, "node_modules"));
        const result = {};
        yield Promise.all(directories.map((path) => __awaiter(this, void 0, void 0, function* () {
            const pkgPath = (0, path_1.join)(path, "package.json");
            if (mz_1.fs.existsSync(pkgPath)) {
                const contents = (yield mz_1.fs.readFile(pkgPath)).toString();
                result[pkgPath] = JSON.parse(contents);
            }
        })));
        return result;
    });
}
exports.default = findPackageInfos;
//# sourceMappingURL=find-package-infos.js.map