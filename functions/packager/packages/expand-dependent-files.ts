import { IPackage } from "./find-package-infos";
import { join } from "path";
import { fs } from "mz";

const modules : any = {
    "react": {
        version: "17.0.2",
        manifest: [
            "/cjs/react-jsx-runtime.development.js",
        ]
    },
    "@babel/runtime": {
        manifest: []
    }
}

export function expandDependentFiles(
    packagePath: string,
    packageInfo: IPackage,
): string[] {
    const files: string[] = [];
    const module = modules[packageInfo.name];
    if (!module) {
        return files;
    }

    if (module.version && module.version != packageInfo.version) {
        return files;
    }

    (module.manifest as string[]).forEach(manifest => {
        const p = join(packagePath, manifest);
        try {
            const stat = fs.statSync(p);
            if (stat.isFile()) {
                files.push(p);
            }
        } catch (e) {
            console.log("[ERROR] join manifest: " + manifest + ", " + e);
        }
    });

    return files;
}