import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: resolve(process.cwd(), 'index.html'),
        debug: resolve(process.cwd(), 'debug.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/map.png': 'http://127.0.0.1:8080',
    },
  },
});
