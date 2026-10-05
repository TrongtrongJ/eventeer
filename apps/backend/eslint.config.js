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
