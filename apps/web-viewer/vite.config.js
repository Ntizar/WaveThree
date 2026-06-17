import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: '../../public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, '../../src'),
      '@data': path.resolve(__dirname, '../../data'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});