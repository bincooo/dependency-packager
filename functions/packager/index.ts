import { Callback, Context } from "aws-lambda";
import { S3, Endpoint } from "aws-sdk";

import { fs } from "mz";
import * as path from "path";
import * as rimraf from "rimraf";
import * as zlib from "zlib";
import fetch from "node-fetch";

import findDependencyDependencies from "./dependencies/find-dependency-dependencies";
import installDependencies from "./dependencies/install-dependencies";

import findPackageInfos, { IPackage } from "./packages/find-package-infos";
import findRequires, { IFileData } from "./packages/find-requires";

import getHash from "./utils/get-hash";

import { VERSION } from "../config";
import { execSync } from "child_process";

const {
  S3_ENDPOINT,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  BUCKET_NAME,
} = process.env;
const SAVE_TO_S3 = !process.env.DISABLE_CACHING;

export const BASE_INSTALL_DIR = process.env.BASE_DIR || "/tmp";

let s3 = new S3();
if (SAVE_TO_S3) {
  console.log("[INFO] S3_ENDPOINT: " + S3_ENDPOINT);
  console.log("[INFO] S3_ACCESS_KEY: " + S3_ACCESS_KEY);
  console.log("[INFO] S3_SECRET_KEY: " + S3_SECRET_KEY);
  console.log("[INFO] BUCKET_NAME: " + BUCKET_NAME);
  s3 = new S3({
    endpoint: new Endpoint(S3_ENDPOINT as string),
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
function deleteHardcodedRequires(data: IFileData, deletePath: string) {
  if (data[deletePath]) {
    Object.keys(data).forEach((p) => {
      const requires = data[p].requires;
      if (requires) {
        data[p].requires = requires.filter(
          (x) => path.join(path.dirname(p), x) !== deletePath,
        );
      }
    });
    delete data[deletePath];
  }
}

function saveToS3(
  dependency: { name: string; version: string },
  response: object,
) {
  if (!BUCKET_NAME) {
    throw new Error("No bucket has been specified");
  }

  console.log(`Saving ${dependency} to S3`);
  s3.putObject(
    {
      Body: zlib.gzipSync(JSON.stringify(response)),
      Bucket: BUCKET_NAME,
      Key: `v${VERSION}/packages/${dependency.name}/${dependency.version}.json`,
      ACL: "public-read",
      ContentType: "application/json",
      CacheControl: "public, max-age=31536000",
      ContentEncoding: "gzip",
    },
    (err) => {
      if (err) {
        console.log(err);
        throw err;
      }
    },
  );
}

async function getContents(
  dependency: any,
  packagePath: string,
  packageInfos: { [p: string]: IPackage },
): Promise<IFileData> {
  const contents = await findRequires(
    dependency.name,
    packagePath,
    packageInfos,
  );

  const packageJSONFiles = Object.keys(packageInfos).reduce(
    (total, next) => ({
      ...total,
      [next.replace(packagePath, "")]: {
        content: JSON.stringify(packageInfos[next]),
      },
    }),
    {},
  );

  // // Hardcoded deletion of some modules that are not used but added by accident
  // deleteHardcodedRequires(
  //   contents,
  //   "/node_modules/react/cjs/react.production.min.js",
  // );
  // deleteHardcodedRequires(
  //   contents,
  //   "/node_modules/react-dom/cjs/react-dom.production.min.js",
  // );

  return { ...contents, ...packageJSONFiles };
}

/**
 * Delete `module` field if the module doesn't exist at all
 */
function verifyModuleField(pkg: IPackage, pkgLoc: string) {
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
        const l = fs.statSync(p);
        return l.isFile();
      } catch (e) {
        return false;
      }
    });

    if (!found) {
      pkg.csbInvalidModule = pkg.module;
      delete pkg.module;
    }
  } catch (e) {
    /* */
  }
}


function getFileFromS3(
  keyPath: string,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (!BUCKET_NAME) {
      reject("No BUCKET_NAME provided");
      return;
    }

    console.log("[INFO] trying fetch S3 ...")
    s3.getObject(
      {
        Bucket: BUCKET_NAME,
        Key: keyPath,
      },
      (err, packageData) => {
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
            : Buffer.from(packageData.Body as Uint8Array); // 兼容 Uint8Array
        const isGzip =
          packageData.ContentEncoding === "gzip" || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b);

        const rawBuf = isGzip ? zlib.gunzipSync(buf as any) : buf;
        
        try {
          const json = JSON.parse(rawBuf.toString("utf8"));
          resolve(json);
        } catch (e) {
          reject(new Error(`Invalid JSON in s3://${BUCKET_NAME}/${keyPath}: The specified key does not exist`));
        }
      },
    );
  });
}


let packaging = false;
const packagingDeps = new Set<string>();

export async function call(event: any, context: Context, cb: Callback) {
  /** Immediate response for WarmUP plugin */
  if (event.source === "serverless-plugin-warmup") {
    console.log("WarmUP - Lambda is warm!");
    return cb(undefined, "Lambda is warm!");
  }

  const dependency = event;
  const hash = getHash(dependency);
  const t = Date.now();

  if (!hash) {
    cb(new Error("opps!!"));
    return;
  }
  if (!dependency) {
    cb(new Error("opps!!"));
    return;
  }
  const packagePath = path.join(BASE_INSTALL_DIR, hash);

  // Cleanup!
  if (!packaging) {
    console.log(`Cleaning up ${BASE_INSTALL_DIR}`);
    try {
      const folders = fs.readdirSync(BASE_INSTALL_DIR);

      folders.forEach((f) => {
        const p = path.join(BASE_INSTALL_DIR + "/", f);
        try {
          if (fs.statSync(p).isDirectory() && p !== BASE_INSTALL_DIR + "/git") {
            execSync("rm -rf " + p);
          }
        } catch (e) {
          console.error("Could not delete " + p + ", " + e.message);
        }
      });
    } catch (e) {
      console.error("Could not delete dependencies: " + e.message);
      console.log("Continuing packaging...");
    }
  }

  if (SAVE_TO_S3) {
    const bundlePath = `v${VERSION}/packages/${dependency.name}/${dependency.version}.json`;
    try {
      const chunk = await getFileFromS3(bundlePath);
      if (chunk) {
        console.log(`[INFO] Returning cached version for '${dependency.name}/${dependency.version}'`);
        cb(undefined, chunk);
        return;
      }
    } catch(err) {
      console.error(err);
    }
  }

  // 在下载资源的时候锁住
  if (packagingDeps.has(hash)) {
    return;
  }
  packagingDeps.add(hash);

  packaging = true;
  try {
    await installDependencies(dependency, packagePath);

    const packageInfos = await findPackageInfos(dependency.name, packagePath);

    Object.keys(packageInfos).map((pkgJSONPath) => {
      const pkg = packageInfos[pkgJSONPath];

      verifyModuleField(pkg, pkgJSONPath);
    });

    const contents = await getContents(dependency, packagePath, packageInfos);

    console.log(
      "Done - " +
        (Date.now() - t) +
        " - " +
        dependency.name +
        "@" +
        dependency.version,
    );

    const requireStatements = new Set<string>();
    Object.keys(contents).forEach((p) => {
      const c = contents[p];

      if (c.requires) {
        c.requires.forEach((r) => requireStatements.add(r));
      }
    });

    const response = {
      contents,
      dependency,
      ...findDependencyDependencies(
        dependency,
        packagePath,
        packageInfos,
        requireStatements,
        contents,
      ),
    };

    if (SAVE_TO_S3) {
      saveToS3(dependency, response);
    }

    // Cleanup
    try {
      rimraf.sync(packagePath);
    } catch (e) {
      /* ignore */
    }

    cb(undefined, response);
  } catch (e) {
    // Cleanup
    try {
      rimraf.sync(packagePath);
    } catch (e) {
      /* ignore */
    }

    console.error("ERROR", e);

    if (process.env.IN_LAMBDA) {
      // We try to call fly, which is a service with much more disk space, retry with this.
      try {
        const responseFromFly = await fetch(
          `https://dependency-packager.fly.dev/${dependency.name}@${dependency.version}`,
        ).then((x) => x.json());

        if (responseFromFly.error) {
          throw new Error(responseFromFly.error);
        }

        if (process.env.IN_LAMBDA) {
          saveToS3(dependency, responseFromFly);
        }

        cb(undefined, responseFromFly);
      } catch (ee) {
        cb(undefined, { error: e.message });
      }
    } else {
      cb(undefined, { error: e.message });
    }
  } finally {
    packaging = false;
    packagingDeps.delete(hash);
  }
}

const PORT = process.env.PORT || 4545;
// if (!process.env.IN_LAMBDA) {
  /* tslint:disable no-var-requires */
  const express = require("express");
  /* tslint:enable */

  const app = express();

  app.get("/*", (req: any, res: any) => {
    const packageParts = req.url.replace("/", "").split("@");
    const version = packageParts.pop();

    const ctx = {} as Context;
    const dep = { name: packageParts.join("@"), version };
    if (version == "favicon.ico") {
      res.status(404);
      return;
    }

    console.log(dep);
    call(dep, ctx, (err: any, result: any) => {
      if (err) {
        console.log(err);
        res.status(500).text(err);
        return;
      }

      // const size = {};

      // console.log(result.contents);

      // Object.keys(result.contents).forEach(p => {
      //   size[p] =
      //     result.contents[p].content && result.contents[p].content.length;
      // });

      if (result.error) {
        res.status(422).json(result);
      } else {
        res.json(result);
      }
    });
  });

  app.listen(PORT, () => {
    console.log("Listening on " + PORT);
  });
// }
