"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const npa = require("npm-package-arg");
const path_1 = require("path");
const __1 = require("..");
function installDependencies(dependency, packagePath) {
    return new Promise((resolve, reject) => {
        const depString = `${dependency.name}@${dependency.version}`;
        console.log("[INFO] install: " + depString);
        const spec = npa(depString);
        console.log("[INFO] spec: " + spec);
        const command = `mkdir -p ${packagePath} && cd ${packagePath} && HOME=${__1.BASE_INSTALL_DIR} node ${(0, path_1.join)(__dirname, "../../../node_modules", "yarn", "lib", "cli")} add ${depString} ${spec.type === "git" ? "" : "--ignore-scripts"} --modules-folder ${packagePath}/node_modules --no-lockfile --non-interactive --no-bin-links --ignore-engines --skip-integrity-check --cache-folder ./`;
        console.log("[INFO] exec command: " + command);
        (0, child_process_1.exec)(command, (err, stdout, stderr) => {
            if (err) {
                console.warn("got error from install: " + err);
                reject(err.message.indexOf("versions") >= 0
                    ? new Error("INVALID_VERSION")
                    : err);
            }
            else {
                resolve();
            }
        });
    });
}
exports.default = installDependencies;
//# sourceMappingURL=install-dependencies.js.map