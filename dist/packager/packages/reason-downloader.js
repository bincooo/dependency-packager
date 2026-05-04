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
exports.getReasonFiles = exports.isReason = void 0;
const JSON5 = require("json5");
const lodash_1 = require("lodash");
const mz_1 = require("mz");
const path_1 = require("path");
const recursiveReaddir = require("recursive-readdir");
function isReason(packageName, rootPath) {
    const bsConfigPath = (0, path_1.join)(rootPath, "node_modules", packageName, "bsconfig.json");
    return mz_1.fs.existsSync(bsConfigPath);
}
exports.isReason = isReason;
function getReasonFiles(rootPath, packageInfos) {
    return __awaiter(this, void 0, void 0, function* () {
        const nModulesPath = (0, path_1.join)(rootPath, "node_modules");
        const reasonDependencies = Object.keys(packageInfos)
            .map((x) => packageInfos[x].name)
            .filter((x) => isReason(x, rootPath));
        const files = {};
        yield Promise.all(reasonDependencies.map((packageName) => __awaiter(this, void 0, void 0, function* () {
            const packagePath = (0, path_1.join)(rootPath, "node_modules", packageName);
            const bsConfigPath = (0, path_1.join)(packagePath, "bsconfig.json");
            const bsConfig = yield mz_1.fs
                .readFile(bsConfigPath)
                .then((data) => JSON5.parse(data.toString()));
            const sources = typeof bsConfig.sources === "string"
                ? [bsConfig.sources]
                : bsConfig.sources;
            const sourcePaths = (yield Promise.all(sources.map((srcSpec) => __awaiter(this, void 0, void 0, function* () {
                if (typeof srcSpec === "string") {
                    return (0, path_1.join)(packagePath, srcSpec);
                }
                if (!srcSpec.type || srcSpec.type === "src") {
                    if (!("subdirs" in srcSpec) || srcSpec.subdirs === false) {
                        return (0, path_1.join)(packagePath, srcSpec.dir);
                    }
                    if (srcSpec.subdirs && Array.isArray(srcSpec.subdirs)) {
                        return srcSpec.subdirs.map((subdir) => {
                            if (typeof subdir === "string") {
                                return (0, path_1.join)(packagePath, srcSpec.dir, subdir);
                            }
                            return (0, path_1.join)(packagePath, srcSpec.dir, subdir.dir);
                        });
                    }
                    else {
                        // Read all subdirs
                        return recursiveReaddir(packagePath).then((f) => f.filter((p) => mz_1.fs.lstatSync(p).isDirectory()));
                    }
                }
                else {
                    return undefined;
                }
            })))).filter(Boolean);
            const flattenedSources = (0, lodash_1.flatten)(sourcePaths);
            return Promise.all(flattenedSources.map((directory) => __awaiter(this, void 0, void 0, function* () {
                const reFiles = (yield mz_1.fs.readdir(directory))
                    .map((x) => (0, path_1.join)(directory, x))
                    .filter((x) => mz_1.fs.lstatSync(x).isFile())
                    .filter((x) => /\.rei?$/.test(x) || /\.mli?$/.test(x));
                return Promise.all(reFiles.map((filePath) => __awaiter(this, void 0, void 0, function* () {
                    const fileContents = yield mz_1.fs.readFile(filePath);
                    files[filePath] = {
                        content: fileContents.toString(),
                        isModule: false,
                    };
                })));
            })));
        })));
        return files;
    });
}
exports.getReasonFiles = getReasonFiles;
//# sourceMappingURL=reason-downloader.js.map