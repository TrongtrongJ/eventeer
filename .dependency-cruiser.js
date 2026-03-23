module.exports = {
  forbidden: [
    /* Rule 1: No circular dependencies */
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'This dependency is part of a cycle. Please refactor to break the loop.',
      from: {
        pathNot: '\\.entity\\.ts$'  // don't flag cycles starting from entity files
      },
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
    tsPreCompilationDeps: true,
    tsConfig: { fileName: './tsconfig.json' },
    externalModuleResolutionStrategy: 'node_modules',
    exclude: {
      path: [
        'node_modules',
        '\\.spec\\.ts$',
        '\\.test\\.ts$',
        'dist',
        // @nestjs/schematics always give an error when run by the cruiser
        '@nestjs/schematics',
      ]
    },
    includeOnly: {
      path: [
        '^apps/backend/src',
        '^apps/frontend/src',
        '^packages/shared-schemas/src',
      ]
    }
  }
};