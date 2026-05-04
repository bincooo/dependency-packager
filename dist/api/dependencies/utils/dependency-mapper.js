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
const npa = require("npm-package-arg");
const pacote = require("pacote");
/**
 * Gets the absolute versions of all dependencies
 *
 * @param {IDependencies} dependencies
 * @returns
 */
function getAbsoluteVersions(dependencies) {
    return __awaiter(this, void 0, void 0, function* () {
        const dependencyNames = Object.keys(dependencies);
        // First build an array with name and absolute version, allows parallel
        // fetching of version numbers
        const absoluteDependencies = yield Promise.all(dependencyNames.map((depName) => __awaiter(this, void 0, void 0, function* () {
            const depString = `${depName}@${dependencies[depName]}`;
            const spec = npa(depString);
            if (spec.type === "git") {
                return { name: depName, version: dependencies[depName] };
            }
            try {
                const manifest = yield pacote.manifest(depString);
                const absoluteVersion = manifest.version;
                return { name: depName, version: absoluteVersion };
            }
            catch (e) {
                e.message = `Could not fetch version for ${depString}: ${e.message}`;
                throw e;
            }
        })));
        return absoluteDependencies.reduce((total, next) => {
            total[next.name] = next.version;
            return total;
        }, {});
    });
}
/**
 * This filters all dependencies that are not needed for CodeSandbox and normalizes
 * the versions from semantic to absolute version, eg: ^1.0.0 -> 1.2.1
 *
 * @export
 * @param {object} dependencies
 */
function mapDependencies(dependencies) {
    return __awaiter(this, void 0, void 0, function* () {
        const absoluteDependencies = yield getAbsoluteVersions(dependencies);
        return absoluteDependencies;
    });
}
exports.default = mapDependencies;
//# sourceMappingURL=dependency-mapper.js.map