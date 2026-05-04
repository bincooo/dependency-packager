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
const mz_1 = require("mz");
const path_1 = require("path");
const resolve_required_files_1 = require("./resolve-required-files");
const extract_requires_1 = require("./utils/extract-requires");
const node_resolve_path_1 = require("./utils/node-resolve-path");
const resolve = require("enhanced-resolve");
// @ts-ignore
const readFiles = require("recursive-readdir-sync");
const reason_downloader_1 = require("./reason-downloader");
const customResolve = resolve.create({
    exportsFields: ["exports"],
    conditionNames: ["browser", "development", "default", "require", "import"],
});
function rewritePath(path, currentPath, packagePath) {
    return new Promise((resolve, reject) => {
        customResolve((0, path_1.dirname)(currentPath), path, (err, res) => {
            if (err) {
                resolve(false);
                return;
            }
            resolve(res);
        });
    });
}
function buildRequireObject(filePath, packagePath, existingContents) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileData = getFileData(filePath, existingContents);
        if (!fileData) {
            return existingContents;
        }
        existingContents[fileData.path] = {
            content: fileData.content,
            isModule: false,
        };
        if (!fileData.path.endsWith(".js") &&
            !fileData.path.endsWith(".mjs") &&
            !fileData.path.endsWith(".cjs")) {
            return existingContents;
        }
        let extractedRequires = null;
        try {
            extractedRequires = (0, extract_requires_1.default)(fileData.content);
        }
        catch (e) {
            return existingContents;
        }
        existingContents[fileData.path].requires = extractedRequires.requires;
        existingContents[fileData.path].isModule = extractedRequires.isModule;
        yield Promise.all((extractedRequires.requires || []).map((requirePath) => __awaiter(this, void 0, void 0, function* () {
            let newPaths = [];
            try {
                if (requirePath.startsWith("glob:")) {
                    const originalPath = requirePath.replace("glob:", "");
                    const files = readFiles((0, path_1.join)((0, path_1.dirname)(filePath), originalPath));
                    newPaths = (yield Promise.all(files
                        .filter((p) => p.endsWith(".js"))
                        .map((p) => rewritePath(p, filePath, packagePath)))).filter(Boolean);
                }
                else {
                    newPaths = [
                        yield rewritePath(requirePath, filePath, packagePath),
                    ].filter(Boolean);
                }
            }
            catch (e) {
                if (process.env.NODE_ENV === "development") {
                    console.warn(`Couldn't find ${requirePath}`);
                }
                return;
            }
            if (newPaths.length === 0) {
                return;
            }
            yield Promise.all(newPaths.map((newPath) => buildRequireObject(newPath, packagePath, existingContents)));
        })));
        return existingContents;
    });
}
function getFileData(filePath, existingContents) {
    const resolvedPath = (0, node_resolve_path_1.default)(filePath);
    if (!resolvedPath) {
        // console.log('Warning: could not find "' + filePath + '"');
        return null;
    }
    if (existingContents[resolvedPath]) {
        return null;
    }
    const fileData = {
        path: resolvedPath,
        content: mz_1.fs.readFileSync(resolvedPath).toString(),
    };
    return fileData;
}
function findRequires(packageName, rootPath, packageInfos) {
    return __awaiter(this, void 0, void 0, function* () {
        const packagePath = (0, path_1.join)(rootPath, "node_modules", packageName);
        const packageJSONPath = (0, path_1.join)(rootPath, "node_modules", packageName, "package.json");
        if (!packageInfos[packageJSONPath]) {
            return {};
        }
        const requiredFiles = yield (0, resolve_required_files_1.default)(packagePath, packageInfos[packageJSONPath]);
        let files = {};
        if ((0, reason_downloader_1.isReason)(packageName, rootPath)) {
            files = yield (0, reason_downloader_1.getReasonFiles)(rootPath, packageInfos);
        }
        for (const file of requiredFiles) {
            if (file) {
                const newFiles = yield buildRequireObject(file, packagePath, files);
                files = Object.assign(Object.assign({}, files), newFiles);
            }
        }
        const sizeMB = JSON.stringify(files).length / 1024 / 1024;
        // If the response is bigger than 8 mb(!) and there is no main file we just
        // include the default included files. Let the client decide which other files
        // to download.
        const relativeFiles = packageName === "node-libs-browser" ||
            (sizeMB > 8 &&
                !packageInfos[packageJSONPath].main &&
                !packageInfos[packageJSONPath].module &&
                !packageInfos[packageJSONPath].unpkg)
            ? {}
            : Object.keys(files).reduce((total, next) => (Object.assign(Object.assign({}, total), { [next.replace(rootPath, "")]: files[next] })), {});
        return relativeFiles;
    });
}
exports.default = findRequires;
//# sourceMappingURL=find-requires.js.map