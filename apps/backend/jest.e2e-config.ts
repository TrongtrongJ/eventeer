// Runs only the integration tests (requires Docker / Testcontainers).

import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",
    testMatch: ["<rootDir>/**/*.e2e-spec.ts"],
    moduleNameMapper: {
        "^@packages/shared-schemas$": "<rootDir>/../../packages/shared-schemas/src/index.ts",
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
        // Transform uuid (ESM-only since v10) through Babel so Jest can consume it
        "^.+\\.m?js$": ["babel-jest", { presets: ["@babel/preset-env"] }],
    },

    transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    testTimeout: 180_000,
    // Run integration test files sequentially (each needs its own container)
    maxWorkers: 1,
};

export default config;
