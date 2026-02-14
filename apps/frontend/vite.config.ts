import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import AutoImport from 'unplugin-auto-import/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow access from Docker
    fs: {
      // Allow serving files from the monorepo root
      allow: ['../..']
    }
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
    }),
  ],
  resolve:{
    alias: {
      '@constants': path.resolve(__dirname, './src/constants')
    }
  },
  optimizeDeps: {
    // Force Vite to re-evaluate the shared package
    exclude: ['@repo/shared-schemas']
  }  
  /*optimizeDeps: {
    include: ['@repo/shared-schemas'],
  },
  build: {
    commonjsOptions: {
      include: [/@repo\/shared-schemas/, /node_modules/],
    },
  },*/
})
