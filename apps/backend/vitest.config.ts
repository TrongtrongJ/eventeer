import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC emits decorator metadata, which Nest's DI needs and esbuild does not.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { globals: true, root: './', include: ['src/**/*.spec.ts'] },
});
