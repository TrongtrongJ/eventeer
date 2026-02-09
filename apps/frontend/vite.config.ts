import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import AutoImport from 'unplugin-auto-import/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow access from Docker
  },
  plugins: [
    react({
      babel: {
        // plugins: [['babel-plugin-react-compiler']],
      },
    }),
    AutoImport({
      dirs: [
        './src/components',
        './src/layouts',
      ],
      dts: './src/auto-imports.d.ts', 
      imports: ['react'],
      '@constants': path.resolve(__dirname, './src/constants'),
    }),
  ],
})
