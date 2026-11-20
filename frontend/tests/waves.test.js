// Testes do fundo em ondas (src/waves.js): o tamanho do canvas e os valores da receita do Shader Builder. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasSize, UNIFORMS, SPEED, MAX_DPR, FRAG } from '../src/waves.js';

test('canvasSize limita a densidade de pixels a 2', () => {
  assert.equal(MAX_DPR, 2);
  assert.deepEqual(canvasSize(1440, 900, 1), [1440, 900]);
  assert.deepEqual(canvasSize(1440, 900, 1.5), [2160, 1350]);
  assert.deepEqual(canvasSize(1440, 900, 3), [2880, 1800]);
});

test('canvasSize devolve pixels inteiros e nunca zero', () => {
  assert.deepEqual(canvasSize(100.4, 50.2, 1.25), [126, 63]);
  assert.deepEqual(canvasSize(0, 0, 2), [1, 1]);
  assert.deepEqual(canvasSize(800, 600, undefined), [800, 600]);
});

test('os uniforms são os da receita "Waves", com o cursor desligado', () => {
  assert.equal(UNIFORMS.colors.length, 24);
  assert.deepEqual(UNIFORMS.colors.slice(0, 12), [
    0.012, 0.110, 0.149, 0.106, 0.424, 0.659, 0.353, 0.824, 0.957, 0.918, 0.976, 1.000,
  ]);
  assert.ok(UNIFORMS.colors.slice(12).every(v => v === 0));
  assert.equal(UNIFORMS.colorCount, 4);
  assert.deepEqual(UNIFORMS.shape, [1.08, 0.62, 0.50, 0.24]);
  assert.deepEqual(UNIFORMS.surface, [2.91, 1.16, 0.00, 1.00]);
  assert.deepEqual(UNIFORMS.finish, [0, 0, 0, 0.04]);
  assert.deepEqual(UNIFORMS.transform, [1.0, 4.08, 0, 0]);
  assert.deepEqual(UNIFORMS.space, [0, 0, 0, 0]);
  assert.equal(UNIFORMS.cursor[0], 0);
  assert.equal(SPEED, 0.86);
});

test('o shader declara cada uniform que startWaves preenche', () => {
  for (const decl of ['vec3 u_colors[8]', 'vec4 u_scene', 'vec4 u_shape', 'vec4 u_surface', 'vec4 u_finish',
    'vec4 u_transform', 'vec4 u_space', 'vec4 u_cursor']) {
    assert.ok(FRAG.includes(`uniform ${decl};`), decl);
  }
});
