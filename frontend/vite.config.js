import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// O pdf.js (#84), uns 1,9 MB, só chega no primeiro PDF: fica fora da lista do service worker e entra no cache no uso.
const LATER = /pdf(\.worker)?\.min-/;

// O sw.js do modo estudo (#85): o molde (sw-molde.js) com a lista dos arquivos do build e de public/ e uma versão tirada
// do nome e do conteúdo de todos eles. Build sem mudança dá o mesmo sw.js, e o navegador não oferece "Atualizar".
// files: [nome no dist, conteúdo] de cada arquivo.
export function serviceWorker(molde, files) {
  const sorted = [...files].sort(([a], [b]) => (a < b ? -1 : 1));
  const hash = createHash('sha256');
  for (const [name, content] of sorted) hash.update(name + '\0').update(content).update('\0');
  return molde
    .replace("'VERSAO'", JSON.stringify(hash.digest('hex').slice(0, 16)))
    .replace("['ARQUIVOS']", JSON.stringify(sorted.map(([name]) => name).filter(name => !LATER.test(name))));
}

// Grava o sw.js no build, depois do index.html e do CSS (enforce: 'post'). O app só o registra no modo estudo.
function studyWorker() {
  let config;
  return {
    name: 'cerebro-sw',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle(_, bundle) {
      const files = Object.values(bundle).map(f => [f.fileName, f.type === 'chunk' ? f.code : f.source]);
      const pub = config.publicDir;
      if (pub && fs.existsSync(pub)) {
        for (const name of fs.readdirSync(pub, { recursive: true })) {
          const file = path.join(pub, name);
          if (fs.statSync(file).isFile()) files.push([name.split(path.sep).join('/'), fs.readFileSync(file)]);
        }
      }
      const molde = fs.readFileSync(path.join(config.root, 'sw-molde.js'), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(molde, files) });
    },
  };
}

export default defineConfig({
  plugins: [studyWorker()],
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
