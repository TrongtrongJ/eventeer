import { InitialSchema1790843426028 } from './1790843426028-InitialSchema';

/**
 * Explicit list (not a glob) so the same migrations load identically under the
 * Nest runtime, the TypeORM CLI, and Vitest. After `yarn migration:generate`,
 * add the new class here.
 */
export const MIGRATIONS = [InitialSchema1790843426028];
