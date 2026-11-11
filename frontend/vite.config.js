import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Só neste computador. Com --host a rede inteira alcança o proxy /api e gasta a cota da chave.
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
});
