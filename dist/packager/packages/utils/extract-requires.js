"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const walk = require("acorn-walk");
const meriyah = require("meriyah");
function exportRequires(code) {
    let ast;
    let isModule = false;
    try {
        try {
            ast = meriyah.parseScript(code);
        }
        catch (e) {
            isModule = true;
            ast = meriyah.parseModule(code, {
                next: true,
                module: true,
                jsx: true,
                specDeviation: true,
            });
        }
        const requires = [];
        // @ts-ignore
        walk.simple(ast, {
            ImportDeclaration(node) {
                isModule = true;
                // Seems like the typings are wrong in the library
                const source = node.source;
                if (source && typeof source.value === "string") {
                    requires.push(source.value);
                }
            },
            ImportExpression(node) {
                isModule = true;
                // Seems like the typings are wrong in the library
                const source = node.source;
                if (source && typeof source.value === "string") {
                    requires.push(source.value);
                }
            },
            ExportNamedDeclaration(node) {
                isModule = true;
                const source = node.source;
                if (source && typeof source.value === "string") {
                    requires.push(source.value);
                }
            },
            ExportAllDeclaration(node) {
                isModule = true;
                const source = node.source;
                if (source && typeof source.value === "string") {
                    requires.push(source.value);
                }
            },
            CallExpression(node) {
                if (
                /* require() */ (node.callee.type === "Identifier" &&
                    node.callee.name === "require") ||
                    node.callee.type === "Import" ||
                    /* require.resolve */ (node.callee.type === "MemberExpression" &&
                        node.callee.object.name &&
                        node.callee.object.name === "require" &&
                        node.callee.property.name &&
                        node.callee.property.name === "resolve")) {
                    if (node.arguments.length === 1) {
                        if (node.arguments[0].type === "Literal") {
                            const { value } = node.arguments[0];
                            if (typeof value === "string") {
                                requires.push(value);
                            }
                        }
                        else if (node.arguments[0].type === "TemplateLiteral") {
                            const { quasis } = node.arguments[0];
                            if (quasis.length === 1) {
                                requires.push(quasis[0].value.raw);
                            }
                        }
                    }
                }
            },
        });
        return { requires, isModule };
    }
    catch (e) {
        console.error("Failed to gather requires", e);
        throw e;
    }
}
exports.default = exportRequires;
//# sourceMappingURL=extract-requires.js.map