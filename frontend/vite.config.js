import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Nada vai embutido no CSS, que segura a pintura. Sem isto o woff2 do cirílico estendido (2,5 kB, menos que o limite de 4 kB do Vite) iria em base64 em toda abertura, e o app em português não o usa.
    assetsInlineLimit: 0,
  },
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
        // Cancelar na tela fecha a ligação com o backend, e ele não faz a chamada seguinte à IA. Sozinho, o http-proxy
        // do Vite 6 só desiste no evento 'aborted', que o Node não emite depois que o corpo do pedido foi lido.
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, _req, res) => {
            res.on('close', () => { if (!res.writableEnded) proxyReq.destroy(); });
          });
        },
      },
    },
  },
});
