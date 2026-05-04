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
exports.call = exports.BASE_INSTALL_DIR = void 0;
const aws_sdk_1 = require("aws-sdk");
const mz_1 = require("mz");
const path = require("path");
const rimraf = require("rimraf");
const zlib = require("zlib");
const node_fetch_1 = require("node-fetch");
const find_dependency_dependencies_1 = require("./dependencies/find-dependency-dependencies");
const install_dependencies_1 = require("./dependencies/install-dependencies");
const find_package_infos_1 = require("./packages/find-package-infos");
const find_requires_1 = require("./packages/find-requires");
const get_hash_1 = require("./utils/get-hash");
const config_1 = require("../config");
const child_process_1 = require("child_process");
const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, BUCKET_NAME, } = process.env;
const SAVE_TO_S3 = !process.env.DISABLE_CACHING;
exports.BASE_INSTALL_DIR = process.env.BASE_DIR || "/tmp";
let s3 = new aws_sdk_1.S3();
if (SAVE_TO_S3) {
    console.log("[INFO] S3_ENDPOINT: " + S3_ENDPOINT);
    console.log("[INFO] S3_ACCESS_KEY: " + S3_ACCESS_KEY);
    console.log("[INFO] S3_SECRET_KEY: " + S3_SECRET_KEY);
    console.log("[INFO] BUCKET_NAME: " + BUCKET_NAME);
    s3 = new aws_sdk_1.S3({
        endpoint: new aws_sdk_1.Endpoint(S3_ENDPOINT),
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
        region: "us-east-1",
        s3ForcePathStyle: true,
        signatureVersion: "v4",
    });
    console.log("[INFO] AWS S3 initialized.");
}
/**
 * Remove a file from the content
 *
 * @param {IFileData} data
 * @param {string} deletePath
 */
function deleteHardcodedRequires(data, deletePath) {
    if (data[deletePath]) {
        Object.keys(data).forEach((p) => {
            const requires = data[p].requires;
            if (requires) {
                data[p].requires = requires.filter((x) => path.join(path.dirname(p), x) !== deletePath);
            }
        });
        delete data[deletePath];
    }
}
function saveToS3(dependency, response) {
    if (!BUCKET_NAME) {
        throw new Error("No bucket has been specified");
    }
    console.log(`Saving ${dependency} to S3`);
    s3.putObject({
        Body: zlib.gzipSync(JSON.stringify(response)),
        Bucket: BUCKET_NAME,
        Key: `v${config_1.VERSION}/packages/${dependency.name}/${dependency.version}.json`,
        ACL: "public-read",
        ContentType: "application/json",
        CacheControl: "public, max-age=31536000",
        ContentEncoding: "gzip",
    }, (err) => {
        if (err) {
            console.log(err);
            throw err;
        }
    });
}
function getContents(dependency, packagePath, packageInfos) {
    return __awaiter(this, void 0, void 0, function* () {
        const contents = yield (0, find_requires_1.default)(dependency.name, packagePath, packageInfos);
        const packageJSONFiles = Object.keys(packageInfos).reduce((total, next) => (Object.assign(Object.assign({}, total), { [next.replace(packagePath, "")]: {
                content: JSON.stringify(packageInfos[next]),
            } })), {});
        // // Hardcoded deletion of some modules that are not used but added by accident
        // deleteHardcodedRequires(
        //   contents,
        //   "/node_modules/react/cjs/react.production.min.js",
        // );
        // deleteHardcodedRequires(
        //   contents,
        //   "/node_modules/react-dom/cjs/react-dom.production.min.js",
        // );
        return Object.assign(Object.assign({}, contents), packageJSONFiles);
    });
}
/**
 * Delete `module` field if the module doesn't exist at all
 */
function verifyModuleField(pkg, pkgLoc) {
    if (!pkg.module) {
        return;
    }
    try {
        const basedir = path.dirname(pkgLoc);
        const found = [
            path.join(basedir, pkg.module),
            path.join(basedir, pkg.module + ".js"),
            path.join(basedir, pkg.module + ".cjs"),
            path.join(basedir, pkg.module + ".mjs"),
            path.join(basedir, pkg.module, "index.js"),
            path.join(basedir, pkg.module, "index.mjs"),
        ].find((p) => {
            try {
                const l = mz_1.fs.statSync(p);
                return l.isFile();
            }
            catch (e) {
                return false;
            }
        });
        if (!found) {
            pkg.csbInvalidModule = pkg.module;
            delete pkg.module;
        }
    }
    catch (e) {
        /* */
    }
}
function getFileFromS3(keyPath) {
    return new Promise((resolve, reject) => {
        if (!BUCKET_NAME) {
            reject("No BUCKET_NAME provided");
            return;
        }
        s3.getObject({
            Bucket: BUCKET_NAME,
            Key: keyPath,
        }, (err, packageData) => {
            if (err && err.name !== "AccessDenied") {
                reject(err);
                return;
            }
            if (!packageData || !packageData.Body) {
                reject(new Error(`Invalid JSON in s3://${BUCKET_NAME}/${keyPath}: not found`));
                return;
            }
            const buf = Buffer.isBuffer(packageData.Body)
                ? packageData.Body
                : Buffer.from(packageData.Body); // 兼容 Uint8Array
            const isGzip = packageData.ContentEncoding === "gzip" || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b);
            const rawBuf = isGzip ? zlib.gunzipSync(buf) : buf;
            try {
                const json = JSON.parse(rawBuf.toString("utf8"));
                resolve(json);
            }
            catch (e) {
                reject(new Error(`Invalid JSON in s3://${BUCKET_NAME}/${keyPath}: ${e.message}`));
            }
        });
    });
}
let packaging = false;
const packagingDeps = new Set();
function call(event, context, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        /** Immediate response for WarmUP plugin */
        if (event.source === "serverless-plugin-warmup") {
            console.log("WarmUP - Lambda is warm!");
            return cb(undefined, "Lambda is warm!");
        }
        const dependency = event;
        const hash = (0, get_hash_1.default)(dependency);
        const t = Date.now();
        if (!hash) {
            return;
        }
        if (!dependency) {
            return;
        }
        const packagePath = path.join(exports.BASE_INSTALL_DIR, hash);
        // Cleanup!
        if (!packaging) {
            console.log(`Cleaning up ${exports.BASE_INSTALL_DIR}`);
            try {
                const folders = mz_1.fs.readdirSync(exports.BASE_INSTALL_DIR);
                folders.forEach((f) => {
                    const p = path.join(exports.BASE_INSTALL_DIR + "/", f);
                    try {
                        if (mz_1.fs.statSync(p).isDirectory() && p !== exports.BASE_INSTALL_DIR + "/git") {
                            (0, child_process_1.execSync)("rm -rf " + p);
                        }
                    }
                    catch (e) {
                        console.error("Could not delete " + p + ", " + e.message);
                    }
                });
            }
            catch (e) {
                console.error("Could not delete dependencies: " + e.message);
                console.log("Continuing packaging...");
            }
        }
        if (packagingDeps.has(hash)) {
            return;
        }
        packagingDeps.add(hash);
        if (SAVE_TO_S3) {
            const bundlePath = `v${config_1.VERSION}/packages/${dependency.name}/${dependency.version}.json`;
            try {
                const chunk = yield getFileFromS3(bundlePath);
                if (chunk) {
                    console.log(`[INFO] Returning cached version for '${dependency.name}/${dependency.version}'`);
                    cb(undefined, chunk);
                    return;
                }
            }
            catch (err) {
                console.error(err);
            }
        }
        packaging = true;
        try {
            yield (0, install_dependencies_1.default)(dependency, packagePath);
            const packageInfos = yield (0, find_package_infos_1.default)(dependency.name, packagePath);
            Object.keys(packageInfos).map((pkgJSONPath) => {
                const pkg = packageInfos[pkgJSONPath];
                verifyModuleField(pkg, pkgJSONPath);
            });
            const contents = yield getContents(dependency, packagePath, packageInfos);
            console.log("Done - " +
                (Date.now() - t) +
                " - " +
                dependency.name +
                "@" +
                dependency.version);
            const requireStatements = new Set();
            Object.keys(contents).forEach((p) => {
                const c = contents[p];
                if (c.requires) {
                    c.requires.forEach((r) => requireStatements.add(r));
                }
            });
            const response = Object.assign({ contents,
                dependency }, (0, find_dependency_dependencies_1.default)(dependency, packagePath, packageInfos, requireStatements, contents));
            if (SAVE_TO_S3) {
                saveToS3(dependency, response);
            }
            // Cleanup
            try {
                rimraf.sync(packagePath);
            }
            catch (e) {
                /* ignore */
            }
            cb(undefined, response);
        }
        catch (e) {
            // Cleanup
            try {
                rimraf.sync(packagePath);
            }
            catch (e) {
                /* ignore */
            }
            console.error("ERROR", e);
            if (process.env.IN_LAMBDA) {
                // We try to call fly, which is a service with much more disk space, retry with this.
                try {
                    const responseFromFly = yield (0, node_fetch_1.default)(`https://dependency-packager.fly.dev/${dependency.name}@${dependency.version}`).then((x) => x.json());
                    if (responseFromFly.error) {
                        throw new Error(responseFromFly.error);
                    }
                    if (process.env.IN_LAMBDA) {
                        saveToS3(dependency, responseFromFly);
                    }
                    cb(undefined, responseFromFly);
                }
                catch (ee) {
                    cb(undefined, { error: e.message });
                }
            }
            else {
                cb(undefined, { error: e.message });
            }
        }
        finally {
            packaging = false;
            packagingDeps.delete(hash);
        }
    });
}
exports.call = call;
const PORT = process.env.PORT || 4545;
// if (!process.env.IN_LAMBDA) {
/* tslint:disable no-var-requires */
const express = require("express");
/* tslint:enable */
const app = express();
app.get("/*", (req, res) => {
    const packageParts = req.url.replace("/", "").split("@");
    const version = packageParts.pop();
    const ctx = {};
    const dep = { name: packageParts.join("@"), version };
    if (version == "favicon.ico") {
        res.status(404);
        return;
    }
    console.log(dep);
    call(dep, ctx, (err, result) => {
        console.log(err);
        // const size = {};
        // console.log(result.contents);
        // Object.keys(result.contents).forEach(p => {
        //   size[p] =
        //     result.contents[p].content && result.contents[p].content.length;
        // });
        if (result.error) {
            res.status(422).json(result);
        }
        else {
            res.json(result);
        }
    });
});
app.listen(PORT, () => {
    console.log("Listening on " + PORT);
});
// }
//# sourceMappingURL=index.js.map