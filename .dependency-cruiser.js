module.exports = {
  forbidden: [
    /* Rule 1: No circular dependencies */
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'This dependency is part of a cycle. Please refactor to break the loop.',
      from: {},
      to: { circular: true }
    },
    /* Rule 2: Shared package isolation */
    {
      name: 'shared-is-independent',
      severity: 'error',
      comment: 'The shared package (Zod schemas) should not depend on apps.',
      from: { path: '^packages/shared-schemas' },
      to: { path: '^apps/' }
    },
    /* Rule 3: No Direct API-to-Web imports */
    {
      name: 'no-cross-app-imports',
      severity: 'error',
      comment: 'React and NestJS apps should stay isolated.',
      from: { path: '^apps/frontend' },
      to: { path: '^apps/backend' }
    }
  ],
  options: {
    tsPreCompilationDeps: true, // Crucial for TypeScript
    tsConfig: { fileName: './tsconfig.json' },
    // Use 'enhanced-resolve' to handle workspace aliases
    externalModuleResolutionStrategy: 'node_modules'
  }
};