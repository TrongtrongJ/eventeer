import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    resolve: true
  }, // If this still fails, try dts: { resolve: true }
  splitting: false,
  sourcemap: true,
  clean: true,
  // This ensures tsup handles the Bundler resolution correctly
  bundle: true, 
  // IMPORTANT: On Windows, sometimes the DTS worker hangs on shared packages
  // If it still fails, add this:
  tsconfig: './tsconfig.json',
});