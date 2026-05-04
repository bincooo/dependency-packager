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
const pacote = require("pacote");
/**
 * Gets the absolute versions of all dependencies
 *
 * @param {IDependencies} dependencies
 * @returns
 */
function getAbsoluteVersion({ name, version, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const depString = `${name}@${version}`;
        try {
            const manifest = yield pacote.manifest(depString);
            const absoluteVersion = manifest.version;
            return { name, version: absoluteVersion };
        }
        catch (e) {
            e.message = `Could not fetch version for ${depString}: ${e.message}`;
            throw e;
        }
    });
}
/**
 * This filters all dependencies that are not needed for CodeSandbox and normalizes
 * the versions from semantic to absolute version, eg: ^1.0.0 -> 1.2.1
 *
 * @export
 * @param {object} dependencies
 */
function mapDependencies(dependency) {
    return __awaiter(this, void 0, void 0, function* () {
        const absoluteDependencies = yield getAbsoluteVersion(dependency);
        return absoluteDependencies;
    });
}
exports.default = mapDependencies;
//# sourceMappingURL=dependency-mapper.js.map