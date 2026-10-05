import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactCompiler from "eslint-plugin-react-compiler";
import unusedImports from "eslint-plugin-unused-imports";
import prettierConfig from "eslint-config-prettier";
import { FlatCompat } from "@eslint/eslintrc";

const currentDir = import.meta.dirname;

const compat = new FlatCompat({
    baseDirectory: currentDir,
    recommendedConfig: js.configs.recommended,
});

export default defineConfig(
    js.configs.recommended,
    tseslint.configs.recommended,
    reactCompiler.configs.recommended,
    compat.extends("plugin:react/recommended", "prettier"),
    {
        files: ["**/*.{jsx,tsx}"],
        ...reactPlugin.configs.flat.recommended,
    },
    {
        files: ["**/*.{jsx,tsx}"],
        ...reactPlugin.configs.flat["jsx-runtime"],
    },
    prettierConfig,
    {
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: "19.0",
            },
        },
    },
    // ── Unused imports (auto-fixable via eslint --fix) ────────────────────────
    {
        plugins: {
            "unused-imports": unusedImports,
        },
        rules: {
            "no-unused-vars": "off", // avoid duplicate reports
            "@typescript-eslint/no-unused-vars": "off", // unused-imports covers this
            "unused-imports/no-unused-imports": "error", // auto-removed on --fix
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_", // _varName = intentionally unused
                    args: "after-used",
                    argsIgnorePattern: "^_", // _req, _next etc. in middleware
                },
            ],
        },
    },
    // ── React Hooks ───────────────────────────────────────────────────────────
    // Catches missing/wrong dependency arrays — easy to miss in custom hooks
    // like useAuth and useAuthSync, and in RTK Query hook consumers.
    {
        files: ["**/*.{jsx,tsx,ts}"],
        plugins: {
            "react-hooks": reactHooksPlugin,
        },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    // ── TypeScript strictness ─────────────────────────────────────────────────
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",

            // Catches accidental floating promises (e.g. forgetting await on
            "@typescript-eslint/no-floating-promises": "error",

            "@typescript-eslint/no-non-null-assertion": "warn",
        },
    },
    {
        ignores: [
            // Monorepo specific
            ".turbo",
            "node_modules",
            "dist",
            "coverage",
            ".next",
            "build",

            // Testing and Mocks
            "__snapshots__",
            "__mocks__",
            "*.spec.ts",

            // Types
            "*.d.ts",

            // Migrations
            "**/migrations/**",
        ],
    },
);
