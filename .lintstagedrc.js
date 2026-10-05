const path = require("path");

module.exports = {
    // ----------------------------------------------------
    // 1. NextJS Frontend
    // ----------------------------------------------------
    "apps/frontend/**/*.{js,jsx,ts,tsx}": filenames => {
        // Convert absolute paths from lint-staged into relative paths for the workspace
        const frontendDir = path.join(process.cwd(), "apps/frontend");
        const relativePaths = filenames.map(f => path.relative(frontendDir, f));

        return [
            `prettier --write ${filenames.join(" ")}`,
            `yarn workspace @eventeer/frontend run eslint --fix ${relativePaths.join(" ")}`,
        ];
    },

    // ----------------------------------------------------
    // 2. NestJS Backend
    // ----------------------------------------------------
    "apps/backend/**/*.ts": filenames => {
        return [
            `prettier --write ${filenames.join(" ")}`,
            `yarn workspace @eventeer/backend run eslint --fix ${filenames.join(" ")}`,
        ];
    },

    // ----------------------------------------------------
    // 3. Shared Zod Package
    // ----------------------------------------------------
    "packages/shared-schema/**/*.ts": filenames => {
        return [
            `prettier --write ${filenames.join(" ")}`,
            `yarn workspace @packages/shared-schemas run eslint --fix ${filenames.join(" ")}`,
        ];
    },

    // ----------------------------------------------------
    // 4. Shared oRPC Contract
    // ----------------------------------------------------
    "packages/contract/**/*.ts": filenames => {
        return [
            `prettier --write ${filenames.join(" ")}`,
            `yarn workspace @packages/contract run eslint --fix ${filenames.join(" ")}`,
        ];
    },

    // ----------------------------------------------------
    // 5. Global Formatter (Catch-all for non-code files)
    // ----------------------------------------------------
    "*.{json,css,scss,md,html}": filenames => {
        return [`prettier --write ${filenames.join(" ")}`];
    },
};
