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
const expand_dependent_files_1 = require("./expand-dependent-files");
const BLACKLISTED_DIRS = [
    "demo",
    "docs",
    "benchmark",
    "flow-typed",
    "src",
    "bundles",
    "examples",
    "scripts",
    "tests",
    "test",
    "umd",
    "min",
    "node_modules",
];
const MODULES = (0, expand_dependent_files_1.loadModulesConfig)();
function getFilePathsInDirectory(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const entries = yield mz_1.fs.readdir(path);
        const entriesWithMetadata = yield Promise.all(entries
            .map((fPath) => (0, path_1.join)(path, fPath))
            .map((entry) => __awaiter(this, void 0, void 0, function* () {
            const meta = yield mz_1.fs.lstat(entry);
            return { entry, isDirectory: meta.isDirectory() };
        })));
        let files = entriesWithMetadata
            .filter((x) => !x.isDirectory)
            .map((x) => x.entry);
        const childFiles = yield Promise.all(entriesWithMetadata
            .filter((x) => x.isDirectory)
            .map((x) => x.entry)
            .filter((x) => BLACKLISTED_DIRS.indexOf((0, path_1.basename)(x)) === -1)
            .filter((x) => !(0, path_1.basename)(x).startsWith("."))
            .map((dir) => getFilePathsInDirectory(dir)));
        childFiles.forEach((f) => {
            files = [...files, ...f];
        });
        return files;
    });
}
const DISALLOWED_EXTENSIONS = ["min.js", "umd.js", "node.js", "test.js"];
const ALLOWED_EXTENSIONS = [
    "json",
    "js",
    "css",
    "scss",
    "styl",
    "less",
    "vue",
    "html",
];
function isValidFile(packagePath, packageInfo) {
    return (filePath) => {
        const relDirName = filePath.replace(packagePath, "").slice(1);
        if ((0, path_1.basename)(filePath).startsWith(".")) {
            return false;
        }
        if (BLACKLISTED_DIRS.some((dir) => {
            return relDirName.startsWith(dir);
        })) {
            return false;
        }
        if (DISALLOWED_EXTENSIONS.some((ex) => filePath.endsWith(ex))) {
            return false;
        }
        if (ALLOWED_EXTENSIONS.some((ex) => filePath.endsWith(ex))) {
            return true;
        }
        return false;
    };
}
const FALLBACK_DIRS = ["dist", "lib", "build"];
const EXPORTS_KEYS = [
    "browser",
    "development",
    "default",
    "require",
    "import",
];
function getFileFromImport(im) {
    if (typeof im === "string") {
        return [im];
    }
    else if (Array.isArray(im)) {
        return im;
    }
    else if ("default" in im) {
        if (!im.default) {
            return [];
        }
        return getFileFromImport(im.default);
    }
    else {
        const totalExports = [];
        for (exports of Object.values(im)) {
            for (const key of EXPORTS_KEYS) {
                const imports = exports[key];
                if (!imports) {
                    continue;
                }
                totalExports.push(...getFileFromImport(imports));
                break;
            }
        }
        return totalExports;
    }
}
function getExports(packageInfo) {
    if (!packageInfo.exports) {
        return [];
    }
    return getFileFromImport(packageInfo.exports);
}
function resolveRequiredFiles(packagePath, packageInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const entries = getExports(packageInfo);
        let mains;
        if (entries.length === 0) {
            const main = typeof packageInfo.browser === "string"
                ? packageInfo.browser
                : packageInfo.module || packageInfo.main;
            mains = main ? [main] : [];
        }
        else {
            mains = entries;
        }
        if (mains.length === 0) {
            const indexFileExists = mz_1.fs.existsSync((0, path_1.join)(packagePath, "index.js"));
            if (indexFileExists) {
                mains = ["index.js"];
            }
        }
        // I removed this optimization Our browser and caching strategy is nowadays so sophisticated that
        // this only introduces unnecessary bagage.
        const files = [];
        if (mains.length > 0) {
            for (const main of mains) {
                [
                    (0, path_1.join)(packagePath, main),
                    (0, path_1.join)(packagePath, main + ".js"),
                    (0, path_1.join)(packagePath, main + ".cjs"),
                    (0, path_1.join)(packagePath, main + ".mjs"),
                    (0, path_1.join)(packagePath, main, "index.js"),
                ].find((p) => {
                    try {
                        const stat = mz_1.fs.statSync(p);
                        if (stat.isFile()) {
                            files.push(p);
                            return true;
                        }
                        return false;
                    }
                    catch (e) {
                        return false;
                    }
                });
            }
        }
        files.push(...yield expandDependentFiles(packagePath, packageInfo, getFilePathsInDirectory));
        return files;
    });
}
exports.default = resolveRequiredFiles;
function expandDependentFiles(packagePath, packageInfo, getFilePaths) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = [];
        const module = MODULES[packageInfo.name];
        if (!module) {
            return files;
        }
        if (module.version && !module.version.includes(packageInfo.version)) {
            return files;
        }
        for (const manifest of module.manifest) {
            if (manifest.endsWith("*")) {
                const p = (0, path_1.join)(packagePath, manifest.substring(0, manifest.length - 1));
                console.log(`[INFO] match manifest: ${p}*`);
                files.push(...(yield getFilePaths(p)));
            }
            else {
                try {
                    const p = (0, path_1.join)(packagePath, manifest);
                    const stat = mz_1.fs.statSync(p);
                    if (stat.isFile()) {
                        files.push(p);
                    }
                }
                catch (e) {
                    console.log(`[ERROR] join manifest: ${manifest}, ` + e);
                }
            }
        }
        return files;
    });
}
//# sourceMappingURL=resolve-required-files.js.map