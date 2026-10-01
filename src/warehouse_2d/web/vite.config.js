import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const apiTarget = process.env.WAREHOUSE_API_TARGET || 'http://127.0.0.1:8080';
const proxy = {
  '/api': apiTarget,
  '/map.png': apiTarget,
};

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: resolve(process.cwd(), 'index.html'),
        health: resolve(process.cwd(), 'health.html'),
        debug: resolve(process.cwd(), 'debug.html'),
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy,
  },
  preview: {
    port: 5174,
    strictPort: true,
    proxy,
  },
});
