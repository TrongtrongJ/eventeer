import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
  test: {
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    environment: 'jsdom',
    reporters: ['verbose'],
    server: {
      deps: {
        inline: ["msw"]
      },
    }
  },
  resolve:{
    alias: {
      '@constants': path.resolve(__dirname, './src/constants')
    }
  }
});