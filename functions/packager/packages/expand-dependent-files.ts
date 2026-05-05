export const modules: Record<string, { version?: string, manifest: string[] }> = {
    "react": {
        version: "17.0.2",
        manifest: [
            "/cjs/react-jsx-runtime.development.js",
        ]
    },
    "@babel/runtime": {
        manifest: [
            "/helpers/*",
            "/regenerator/*"
        ]
    },
    "antd-style": {
        manifest: [
            "/lib/index.js",
        ]
    },
}