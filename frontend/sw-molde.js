// Service worker do modo estudo (#85), registrado só com semIA no config.js (App.jsx). Este é o molde: o build
// (vite.config.js, serviceWorker) troca VERSAO e ARQUIVOS pela versão e pela lista de arquivos dele e grava dist/sw.js.
// Os arquivos do build ficam no cache, e o app abre sem rede depois da primeira visita. A versão nova espera o
// "Atualizar" (mensagem 'atualizar'): a página aberta nunca pede um arquivo que já saiu do cache.
const VERSAO = 'VERSAO';
const ARQUIVOS = ['ARQUIVOS'];
const CACHE = 'cerebro-' + VERSAO;

// cache 'reload': o index.html e o config.js não mudam de nome, e o do cache do navegador pode ser o da versão velha.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS.map(f => new Request(f, { cache: 'reload' })))));
});

// O endereço do GitHub Pages é o mesmo para os outros sites da conta: só os caches do Cérebro saem.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('cerebro-') && key !== CACHE).map(key => caches.delete(key)))));
});

self.addEventListener('message', event => {
  if (event.data === 'atualizar') self.skipWaiting();
});

// Só GET da mesma origem e fora da /api passa pelo cache; o resto segue direto para a rede. A página (com ?demo também)
// é o index.html. O que não está na lista (o pdf.js, que só chega no primeiro PDF) entra no cache no primeiro uso; sem
// espaço para ele, a resposta chega do mesmo jeito.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const saved = await cache.match(request.mode === 'navigate' ? 'index.html' : request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    return response;
  }));
});
