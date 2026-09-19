// jest.config.ts  — drop this in apps/backend/

import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",
    testMatch: ["<rootDir>/src/**/*.spec.ts"],
    moduleNameMapper: {
        // Monorepo workspace alias
        "^@packages/shared-schemas$": "<rootDir>/../../packages/shared-schemas/src/index.ts",
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
        // Transform uuid (ESM-only since v10) through Babel so Jest can consume it
        "^.+\\.m?js$": ["babel-jest", { presets: ["@babel/preset-env"] }],
    },

    transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],

    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.module.ts", "!src/main.ts"],

    coverageReporters: ["text", "json-summary"],

    reporters: ["default", ["<rootDir>/coverage-warn.reporter.js", { threshold: 50 }]],
};

export default config;
