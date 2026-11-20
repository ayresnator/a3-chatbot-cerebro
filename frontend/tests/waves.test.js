// Testes do fundo em ondas (src/waves.js): o tamanho do canvas, o relógio e o corte a 30 quadros por segundo, as faixas
// do scissor em volta do palco e os valores da receita do Shader Builder. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasSize, tick, bands, UNIFORMS, SPEED, MAX_DPR, FRAME_MS, MAX_STEP_MS, FRAG } from '../src/waves.js';

// Quantos quadros o laço desenha em 1 s numa tela de hz quadros por segundo; o primeiro, logo ao tocar, não conta.
// jitter(i) desloca a hora do quadro i (ms). Devolve os desenhos e o tempo animado no fim.
function run(hz, jitter = () => 0) {
  let seconds = 0;
  let last = null;
  let drawn = -1;
  for (let i = 0; i <= hz; i++) {
    const now = 1000 + i * 1000 / hz + jitter(i);
    const next = tick(seconds, last, now);
    if (next === null) continue;
    seconds = next;
    last = now;
    drawn++;
  }
  return { drawn, seconds };
}

test('tick: a 60 Hz desenha um quadro sim, um não, e o relógio anda 1 s em 1 s', () => {
  const { drawn, seconds } = run(60);
  assert.equal(drawn, 30);
  assert.ok(Math.abs(seconds - 1) < 1e-9, String(seconds));
});

test('tick: nunca passa de 30 quadros por segundo, em qualquer frequência de tela', () => {
  assert.ok(Math.abs(FRAME_MS - 1000 / 30) < 1e-9);
  for (const hz of [30, 60, 75, 90, 100, 120, 144, 165, 240]) {
    const { drawn } = run(hz);
    assert.ok(drawn <= 30 && drawn >= 24, hz + ' Hz: ' + drawn);
  }
});

test('tick: a oscilação de quase 1 ms na hora do quadro não derruba os 60 Hz para 20 por segundo', () => {
  // O quadro desenhado chega atrasado e o seguinte adiantado: o intervalo entre eles fica 1,8 ms mais curto.
  const { drawn } = run(60, i => (i % 4 === 2 ? 0.9 : i % 4 === 0 ? -0.9 : 0));
  assert.equal(drawn, 30);
});

test('tick: ao tocar o relógio não anda, e um quadro atrasado anda no máximo 100 ms', () => {
  assert.equal(tick(12.5, null, 99999), 12.5);
  assert.equal(tick(0, 1000, 1062.5), 0.0625);
  assert.equal(MAX_STEP_MS, 100);
  assert.equal(tick(0, 1000, 1500), 0.1);
  assert.equal(tick(0, 1000, 60000), 0.1);
  assert.equal(tick(3, 1000, 1010), null);
});

test('bands: as faixas cobrem o canvas fora do palco, em pixels do aparelho e com y de baixo para cima', () => {
  // 1920 × 1080 px CSS a 2×: o palco perde 32 px dos lados (o raio) e 160 px em cima e embaixo (a folga da rolagem).
  const stage = { left: 288, right: 1632, top: 92, bottom: 1056 };
  const parts = bands(stage, 32, 3840, 2160, 2);
  assert.deepEqual(parts, [
    [0, 0, 640, 2160],
    [3200, 0, 640, 2160],
    [640, 2160 - 504, 2560, 504],
    [640, 0, 2560, 2160 - 1792],
  ]);
  const area = parts.reduce((sum, [, , w, h]) => sum + w * h, 0);
  assert.equal(area + (3200 - 640) * (1792 - 504), 3840 * 2160, 'faixas e buraco somam o canvas, sem sobra');
});

test('bands: com o palco passando do alto e do pé da janela, ficam só as faixas dos lados', () => {
  assert.deepEqual(bands({ left: 100, right: 900, top: -400, bottom: 2400 }, 32, 1000, 800, 1), [
    [0, 0, 132, 800],
    [868, 0, 132, 800],
  ]);
});

test('bands: palco pequeno demais para ter buraco desenha o canvas inteiro', () => {
  assert.deepEqual(bands({ left: 0, right: 50, top: 0, bottom: 900 }, 32, 100, 1000, 1), [[0, 0, 100, 1000]]);
  assert.deepEqual(bands({ left: 0, right: 900, top: 100, bottom: 400 }, 32, 1000, 1000, 1), [[0, 0, 1000, 1000]]);
});

test('bands: densidade fracionária dá pixels inteiros dentro do canvas', () => {
  const parts = bands({ left: 100.4, right: 1180.6, top: 80.3, bottom: 990.7 }, 32, 1600, 1250, 1.25);
  assert.ok(parts.flat().every(Number.isInteger), JSON.stringify(parts));
  for (const [x, y, w, h] of parts) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1600 && y + h <= 1250, JSON.stringify([x, y, w, h]));
  }
});

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
