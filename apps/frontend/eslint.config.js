import sharedConfig from "@packages/eslint-config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
    ...sharedConfig,
    {
        languageOptions: {
            parserOptions: {
                project: path.join(__dirname, "tsconfig.json"),
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            // Props are type-checked by TypeScript; prop-types only produces false positives on memo()/FC.
            "react/prop-types": "off",
        },
        settings: {
            "import/resolver": {
                typescript: {
                    project: path.join(__dirname, "tsconfig.json"),
                },
                node: { extensions: [".ts", ".js", ".tsx", ".jsx"] },
            },
        },
    },
];
