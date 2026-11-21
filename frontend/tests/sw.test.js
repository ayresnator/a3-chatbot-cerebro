// Testes do service worker do modo estudo (#85): o sw.js que o build monta (vite.config.js, serviceWorker) e o que o
// molde (sw-molde.js) faz, rodando num service worker de mentira, sem navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { serviceWorker } from '../vite.config.js';

const MOLDE = readFileSync(new URL('../sw-molde.js', import.meta.url), 'utf8');
// [nome no dist, conteúdo]: os do build (o pdf.js também) e os de public/.
const FILES = [
  ['index.html', '<html>'], ['assets/index-a1.js', 'app'], ['assets/index-b2.css', 'css'],
  ['assets/pdf.min-c3.js', 'pdf'], ['assets/pdf.worker.min-d4.mjs', 'worker'], ['assets/pdf.worker.min-e5.js', 'url'],
  ['config.js', 'config'], ['favicon.svg', '<svg>'], ['manifest.webmanifest', '{}'], ['icone-192.png', Buffer.from([1, 2])],
];
const ORIGIN = 'https://cerebro.test';
const SW = ORIGIN + '/app/sw.js';
const listOf = source => JSON.parse(source.match(/const ARQUIVOS = (.*);/)[1]);
const versionOf = source => source.match(/const VERSAO = "(\w+)";/)[1];

// O sw.js rodando num service worker de mentira. net: o que a rede responde, por caminho; offline: a rede caiu.
// Devolve os eventos que ele ouve, os caches (nome → endereço → resposta) e os pedidos que foram à rede.
function boot(source, net = {}) {
  const on = {};
  const stores = new Map();
  const sent = [];
  const sw = { offline: false, skipped: false, stores, sent };
  const href = input => new URL(typeof input === 'string' ? input : input.url, SW).href;
  async function fetch(request) {
    sent.push({ url: href(request), cache: request.cache });
    if (sw.offline) throw new TypeError('Failed to fetch');
    const path = new URL(href(request)).pathname;
    return path in net ? new Response(net[path]) : new Response('não achado', { status: 404 });
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          for (const r of requests) {
            const res = await fetch(r);
            if (!res.ok) throw new TypeError('addAll: ' + r.url);
            store.set(href(r), res);
          }
        },
        async match(input) {
          return store.get(href(input))?.clone();
        },
        async put(request, res) {
          store.set(href(request), res);
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
  // O Request do Node só aceita endereço completo; o do service worker resolve o relativo pelo endereço do sw.js.
  class SWRequest extends Request {
    constructor(input, init) {
      super(typeof input === 'string' ? new URL(input, SW) : input, init);
    }
  }
  const self = {
    location: new URL(SW),
    addEventListener: (type, fn) => (on[type] = fn),
    skipWaiting: () => (sw.skipped = true),
  };
  vm.runInNewContext(source, { self, caches, fetch, Request: SWRequest, URL });
  const run = async (type, fields = {}) => {
    const waits = [];
    let answer = null;
    on[type]({ ...fields, waitUntil: p => waits.push(p), respondWith: p => (answer = p) });
    const response = answer && (await answer);
    await Promise.all(waits);
    return { answered: !!answer, response };
  };
  sw.install = () => run('install');
  sw.activate = () => run('activate');
  sw.message = data => run('message', { data });
  // Pedido como o navegador manda ao service worker: GET de um arquivo, se nada mudar.
  sw.fetch = (path, { method = 'GET', mode = 'cors', origin = ORIGIN } = {}) =>
    run('fetch', { request: { url: origin + path, method, mode } });
  sw.cacheName = () => [...stores.keys()].find(name => name.startsWith('cerebro-'));
  return sw;
}

// A rede do servidor: os arquivos do build, cada um com o próprio nome como conteúdo.
const NET = Object.fromEntries(FILES.map(([name]) => ['/app/' + name, 'arquivo ' + name]));

test('service worker: a lista leva o index.html, os arquivos do build e os de public/, menos o pdf.js', () => {
  assert.deepEqual(listOf(serviceWorker(MOLDE, FILES)), [
    'assets/index-a1.js', 'assets/index-b2.css', 'config.js', 'favicon.svg', 'icone-192.png', 'index.html',
    'manifest.webmanifest',
  ]);
});

test('service worker: a versão sai do conteúdo de todos os arquivos, o pdf.js também, e não da ordem', () => {
  const version = files => versionOf(serviceWorker(MOLDE, files));
  const base = version(FILES);
  assert.equal(version([...FILES].reverse()), base);
  assert.notEqual(version(FILES.map(([n, c]) => [n, n === 'index.html' ? '<html lang="pt-BR">' : c])), base);
  assert.notEqual(version(FILES.map(([n, c]) => [n, n === 'assets/pdf.min-c3.js' ? 'pdf novo' : c])), base);
  assert.notEqual(version(FILES.map(([n, c]) => [n === 'config.js' ? 'config2.js' : n, c])), base);
});

test('service worker: a instalação guarda a lista no cache da versão, pedindo cada arquivo ao servidor', async () => {
  const source = serviceWorker(MOLDE, FILES);
  const sw = boot(source, NET);
  await sw.install();
  assert.equal(sw.cacheName(), 'cerebro-' + versionOf(source));
  assert.deepEqual([...sw.stores.get(sw.cacheName()).keys()], listOf(source).map(name => ORIGIN + '/app/' + name));
  // cache 'reload': o index.html e o config.js da versão velha, no cache do navegador, não entram na nova.
  assert.ok(sw.sent.length === listOf(source).length && sw.sent.every(r => r.cache === 'reload'));
});

test('service worker: a ativação apaga os caches velhos do Cérebro e deixa os de outros sites do mesmo endereço', async () => {
  const sw = boot(serviceWorker(MOLDE, FILES), NET);
  await sw.install();
  const current = sw.cacheName();
  sw.stores.set('cerebro-versao-velha', new Map());
  sw.stores.set('outro-site', new Map());
  await sw.activate();
  assert.deepEqual([...sw.stores.keys()].sort(), [current, 'outro-site'].sort());
});

test('service worker: só o "Atualizar" liga a versão nova', async () => {
  const sw = boot(serviceWorker(MOLDE, FILES), NET);
  await sw.message('outra coisa');
  assert.equal(sw.skipped, false);
  await sw.message('atualizar');
  assert.equal(sw.skipped, true);
});

test('service worker: sem rede, a página (com ?demo também) e os arquivos da lista saem do cache', async () => {
  const sw = boot(serviceWorker(MOLDE, FILES), NET);
  await sw.install();
  sw.offline = true;
  sw.sent.length = 0;
  for (const path of ['/app/', '/app/?demo', '/app/index.html']) {
    const { answered, response } = await sw.fetch(path, { mode: 'navigate' });
    assert.ok(answered, path);
    assert.equal(await response.text(), 'arquivo index.html', path);
  }
  assert.equal(await (await sw.fetch('/app/config.js')).response.text(), 'arquivo config.js');
  assert.equal(await (await sw.fetch('/app/assets/index-a1.js')).response.text(), 'arquivo assets/index-a1.js');
  assert.equal(sw.sent.length, 0);
  // O que não está no cache não abre sem rede: o erro chega à página, como sem o service worker.
  await assert.rejects(sw.fetch('/app/assets/pdf.min-c3.js'));
});

test('service worker: o pdf.js entra no cache no primeiro uso; a resposta de erro não entra', async () => {
  const sw = boot(serviceWorker(MOLDE, FILES), NET);
  await sw.install();
  const store = sw.stores.get(sw.cacheName());
  sw.sent.length = 0;
  const first = await sw.fetch('/app/assets/pdf.worker.min-d4.mjs');
  assert.equal(await first.response.text(), 'arquivo assets/pdf.worker.min-d4.mjs');
  assert.ok(store.has(ORIGIN + '/app/assets/pdf.worker.min-d4.mjs'));
  await sw.fetch('/app/assets/pdf.worker.min-d4.mjs');
  assert.equal(sw.sent.length, 1);
  const missing = await sw.fetch('/app/assets/sumiu-x1.js');
  assert.equal(missing.response.status, 404);
  assert.ok(!store.has(ORIGIN + '/app/assets/sumiu-x1.js'));
});

test('service worker: a /api, outro servidor e pedido que não é GET seguem direto para a rede, sem cache', async () => {
  const sw = boot(serviceWorker(MOLDE, FILES), { ...NET, '/app/api/health': '{"status":"ok"}' });
  await sw.install();
  const before = [...sw.stores.get(sw.cacheName()).keys()];
  for (const [path, options] of [
    ['/app/api/health', {}], ['/api/generate', {}], ['/app/api/generate', { method: 'POST' }],
    ['/app/index.html', { method: 'POST' }], ['/fonte.woff2', { origin: 'https://fonts.example.com' }],
    ['/app/', { mode: 'navigate', origin: 'https://outro.test' }],
  ]) {
    assert.equal((await sw.fetch(path, options)).answered, false, path);
  }
  assert.deepEqual([...sw.stores.get(sw.cacheName()).keys()], before);
});
