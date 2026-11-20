// Teste do proxy /api do Vite (npm run dev), sem rede: o Cancelar da tela tem de chegar ao backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import config from '../vite.config.js';

// Quantas vezes a ligação do proxy com o backend é derrubada quando a ligação com o navegador fecha.
function closesBackend(writableEnded) {
  const proxy = new EventEmitter();
  config.server.proxy['/api'].configure(proxy);
  let destroyed = 0;
  const response = Object.assign(new EventEmitter(), { writableEnded });
  proxy.emit('proxyReq', { destroy: () => { destroyed += 1; } }, {}, response);
  response.emit('close');
  return destroyed;
}

test('proxy: a ligação com o backend fecha quando o navegador desiste antes da resposta', () => {
  assert.equal(closesBackend(false), 1);
});

test('proxy: a ligação com o backend fica quando a resposta terminou', () => {
  assert.equal(closesBackend(true), 0);
});
