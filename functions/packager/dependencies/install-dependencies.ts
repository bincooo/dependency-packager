import { exec } from "child_process";
import * as npa from "npm-package-arg";
import { join } from "path";
import { BASE_INSTALL_DIR } from "..";

export default function installDependencies(
  dependency: { name: string; version: string },
  packagePath: string,
) {
  return new Promise<void>((resolve, reject) => {
    const depString = `${dependency.name}@${dependency.version}`;
    console.log("[INFO] install: " + depString);

    const spec = npa(depString);
    console.log("[INFO] spec: " + spec);

    const command = `mkdir -p ${packagePath} && cd ${packagePath} && HOME=${BASE_INSTALL_DIR} node ${join(
        __dirname,
        "../../../node_modules",
        "yarn",
        "lib",
        "cli",
      )} add ${depString} ${
        spec.type === "git" ? "" : "--ignore-scripts"
      } --modules-folder ${packagePath}/node_modules --no-lockfile --non-interactive --no-bin-links --ignore-engines --skip-integrity-check --cache-folder ./`
    console.log("[INFO] exec command: " + command);
    exec(command,
      (err, stdout, stderr) => {
        if (err) {
          console.warn("got error from install: " + err);
          reject(
            err.message.indexOf("versions") >= 0
              ? new Error("INVALID_VERSION")
              : err,
          );
        } else {
          resolve();
        }
      },
    );
  });
}
