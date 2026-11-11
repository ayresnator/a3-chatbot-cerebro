import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Só neste computador. Com --host a rede inteira alcança o proxy /api e gasta a cota da chave.
    // Manter 'localhost': é o endereço do guia. Trocar por '127.0.0.1' muda o endereço do app, e a biblioteca e o desempenho salvos ficam no antigo (o navegador guarda por endereço).
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
