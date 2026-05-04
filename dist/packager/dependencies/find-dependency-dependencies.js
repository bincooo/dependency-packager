"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enhancedResolve = require("enhanced-resolve");
const resolve = require("browser-resolve");
const path_1 = require("path");
const resolver_1 = require("../utils/resolver");
function rewriteContents(contents, fromPath, dependency, version) {
    const files = Object.keys(contents).filter((p) => p.startsWith(fromPath + "/"));
    files.forEach((f) => {
        const info = contents[f];
        const relativePath = f.replace(fromPath + "/", "");
        delete contents[f];
        const newPath = `/node_modules/${dependency}/${version}/${relativePath}`;
        contents[newPath] = info;
    });
}
const createdResolve = enhancedResolve.create.sync({
    exportsFields: ["exports"],
    conditionNames: ["browser", "development", "default", "require", "import"],
});
function resolvePackageJSONSync(basedir, request) {
    let result;
    try {
        result = createdResolve(basedir, request);
    }
    catch (e) {
        result = resolve.sync(request, {
            basedir,
            packageFilter: resolver_1.packageFilter,
            extensions: [".wasm", ".mjs", ".js", ".json"],
        });
    }
    return result;
}
function findDependencies(dep, // This can be an aliased name, we also need the real name to look for the package in fs
realDepName, packageInfos, requiresByDependencies, rootdir, basedir, totalObject, contents) {
    let packageJSONPath = resolvePackageJSONSync(basedir, (0, path_1.join)(realDepName, "package.json"));
    if (!packageJSONPath) {
        return;
    }
    if (!packageInfos[packageJSONPath]) {
        return;
    }
    const mainPackageInfo = packageInfos[packageJSONPath];
    if (mainPackageInfo.peerDependencies) {
        totalObject.peerDependencies = Object.assign(Object.assign({}, totalObject.peerDependencies), mainPackageInfo.peerDependencies);
    }
    const dependencies = mainPackageInfo.dependencies;
    if (dependencies) {
        Object.keys(dependencies).forEach((name) => {
            const depPackagePath = resolvePackageJSONSync(basedir, (0, path_1.join)(name, "package.json"));
            if (!depPackagePath || !packageInfos[depPackagePath]) {
                return;
            }
            const depPackageInfo = packageInfos[depPackagePath];
            const isRootDependendency = depPackagePath.split("/node_modules/").length === 2;
            let aliasedName = name;
            if (!isRootDependendency) {
                aliasedName += "/" + depPackageInfo.version;
            }
            const depDep = totalObject.dependencyDependencies[aliasedName];
            if (!isRootDependendency) {
                totalObject.dependencyAliases[dep] =
                    totalObject.dependencyAliases[dep] || {};
                rewriteContents(contents, depPackagePath.replace(rootdir, "").replace("/package.json", ""), name, depPackageInfo.version);
                totalObject.dependencyAliases[dep][name] = aliasedName;
            }
            if (depDep) {
                if (depDep.parents.indexOf(dep) === -1) {
                    depDep.parents.push(dep);
                }
                return;
            }
            totalObject.dependencyDependencies[aliasedName] = {
                semver: dependencies[name],
                resolved: depPackageInfo.version,
                parents: [dep],
                entries: (requiresByDependencies[name] || []).sort(),
            };
            findDependencies(aliasedName, name, packageInfos, requiresByDependencies, rootdir, (0, path_1.dirname)(depPackagePath), totalObject, contents);
        });
    }
    return totalObject;
}
function findDependencyDependencies(dep, rootPath, packageInfos, requires, contents) {
    const totalObject = {
        peerDependencies: {},
        dependencyDependencies: {},
        dependencyAliases: {},
    };
    const requireObject = {};
    // We create an object that maps every dependency to the require statements
    // they are involved in. This way we know exactly what we require of dependencies
    for (const requireDep of requires) {
        if (!/^[\w|@\w]/.test(requireDep)) {
            continue;
        }
        const dependencyParts = requireDep.split("/");
        const dependencyName = requireDep.startsWith("@")
            ? `${dependencyParts[0]}/${dependencyParts[1]}`
            : dependencyParts[0];
        requireObject[dependencyName] = requireObject[dependencyName] || [];
        requireObject[dependencyName].push(requireDep);
    }
    return findDependencies(dep.name, dep.name, packageInfos, requireObject, rootPath, (0, path_1.join)(rootPath, "node_modules", dep.name), totalObject, contents);
}
exports.default = findDependencyDependencies;
//# sourceMappingURL=find-dependency-dependencies.js.map