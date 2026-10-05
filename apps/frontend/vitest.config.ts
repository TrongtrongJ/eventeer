import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    css: false,
    // e2e/*.spec.ts are Playwright specs (different test runner, different
    // `test`/`expect` semantics) - vitest's default glob would otherwise
    // try to collect and run them too, since both tools match *.spec.ts.
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@packages/shared-schemas': path.resolve(__dirname, '../../packages/shared-schemas/src'),
      '@packages/contract': path.resolve(__dirname, '../../packages/contract/src'),
    },
  },
});
