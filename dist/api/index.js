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
exports.http = void 0;
const aws = require("aws-sdk");
const LRU = require("lru-cache");
const zlib = require("zlib");
const config_1 = require("../config");
const parse_dependencies_1 = require("./dependencies/parse-dependencies");
const errorCache = LRU({
    max: 1024,
    maxAge: 1000 * 5,
});
const defaultHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
};
const CACHE_TIME = 60 * 60 * 24; // A day caching
const lambda = new aws.Lambda({
    region: "eu-west-1",
});
const s3 = new aws.S3();
const { BUCKET_NAME } = process.env;
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
                console.error(err);
                reject(err);
                return;
            }
            resolve(packageData);
        });
    });
}
function saveFileToS3(keyPath, content, contentType = "application/json") {
    return new Promise((resolve, reject) => {
        if (!BUCKET_NAME) {
            reject("No BUCKET_NAME provided");
            return;
        }
        s3.putObject({
            Bucket: BUCKET_NAME,
            Key: keyPath,
            Body: zlib.gzipSync(content),
            ContentType: contentType,
            CacheControl: "public, max-age=31536000",
            ContentEncoding: "gzip",
        }, (err, response) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            resolve(response);
        });
    });
}
function getS3BundlePath(dependencies) {
    return (`v${config_1.VERSION}/combinations/` +
        Object.keys(dependencies)
            .sort()
            .map(
        // Paths starting with slashes don't work with cloudfront, even escaped. So we remove the slashes
        (dep) => `${encodeURIComponent(dep.replace("/", "-").replace("@", ""))}@${dependencies[dep]}`)
            .join("+") +
        ".json");
}
function generateDependency(name, version) {
    return new Promise((resolve, reject) => {
        lambda.invoke({
            FunctionName: `codesandbox-packager-v2-${process.env.SERVERLESS_STAGE}-packager`,
            Payload: JSON.stringify({
                name,
                version,
            }),
        }, (error, data) => {
            if (error) {
                error.message = `Error while packaging ${name}@${version}: ${error.message}`;
                reject(error);
                return;
            }
            if (typeof data.Payload === "string") {
                resolve(JSON.parse(data.Payload));
            }
            else {
                resolve(null);
            }
        });
    });
}
function getResponse(bundlePath) {
    const response = JSON.stringify({ url: bundlePath.replace(/\+/g, "%2B") });
    return {
        statusCode: 200,
        headers: Object.assign({ "Cache-Control": `public, max-age=${CACHE_TIME}`, "Content-Length": response.length }, defaultHeaders),
        body: response,
    };
}
function http(event, context, cb) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            /** Immediate response for WarmUP plugin */
            if (event.source === "serverless-plugin-warmup") {
                console.log("WarmUP - Lambda is warm!");
                return cb(undefined, "Lambda is warm!");
            }
            const { packages } = event.pathParameters;
            const escapedPackages = decodeURIComponent(packages);
            const dependencies = yield (0, parse_dependencies_1.default)(escapedPackages);
            const receivedData = [];
            if (!BUCKET_NAME) {
                throw new Error("No BUCKET_NAME provided");
            }
            const depName = Object.keys(dependencies)[0];
            const bundlePath = `v${config_1.VERSION}/packages/${depName}/${dependencies[depName]}.json`;
            const bundle = yield getFileFromS3(bundlePath);
            if (bundle && bundle.Body) {
                console.log("Returning cached version for '" + escapedPackages + "'");
                cb(undefined, getResponse(bundlePath));
                return;
            }
            console.log("Packaging '" + escapedPackages + "'");
            yield Promise.all(Object.keys(dependencies).map((depName) => __awaiter(this, void 0, void 0, function* () {
                const depPath = `v${config_1.VERSION}/packages/${depName}/${dependencies[depName]}.json`;
                const s3Object = yield getFileFromS3(depPath);
                if (s3Object && s3Object.Body != null) {
                    const result = JSON.parse(s3Object.Body.toString());
                    receivedData.push(result);
                }
                else {
                    const key = depName + dependencies[depName];
                    const error = errorCache.get(key);
                    if (error) {
                        errorCache.del(key);
                        throw new Error(error);
                    }
                    const data = yield generateDependency(depName, dependencies[depName]);
                    if (data === null) {
                        throw new Error("An unknown error happened while packaging the dependency " +
                            depName +
                            "@" +
                            dependencies[depName]);
                    }
                    else if ("error" in data) {
                        // The request probably expired already, so we set a cache that can be returned when the next request comes in
                        const message = "Something went wrong while packaging the dependency " +
                            depName +
                            "@" +
                            dependencies[depName] +
                            ": " +
                            data.error;
                        errorCache.set(key, message);
                        throw new Error(message);
                    }
                    else {
                        receivedData.push(data);
                    }
                }
                if (receivedData.length === Object.keys(dependencies).length) {
                    cb(undefined, getResponse(bundlePath));
                }
            })));
        }
        catch (e) {
            console.error("ERROR ", e);
            const statusCode = e.code && e.code === "E404" ? 404 : 500;
            cb(undefined, {
                statusCode,
                body: JSON.stringify({ error: e.message }),
                headers: defaultHeaders,
            });
        }
    });
}
exports.http = http;
//# sourceMappingURL=index.js.map