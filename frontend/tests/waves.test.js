// Testes do fundo em ondas (src/waves.js): o tamanho do canvas, o relógio e o corte a 30 quadros por segundo, a espera
// do laço no temporizador, as faixas do scissor em volta do palco, os valores da receita do Shader Builder, o começo
// num canvas novo e num que já tem contexto, a limpeza do canvas no tom do palco antes das faixas, o laço que para com
// o app parado ou a janela sem foco e a reserva da barra de rolagem que sai onde as ondas rodam. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canvasSize, tick, bands, startWaves, UNIFORMS, SPEED, MAX_DPR, FRAME_MS, FRAME_WAIT_MS, MAX_STEP_MS, FRAG,
  IDLE_MS, INPUT,
} from '../src/waves.js';

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

// O laço de startWaves fora do navegador: depois de um quadro desenhado, o pedido do próximo sai FRAME_WAIT_MS depois
// (o quadro roda 1 ms depois da hora dele, e o temporizador atrasa late ms) e roda no quadro seguinte da tela; o quadro
// que chega cedo pede o seguinte direto. Devolve os desenhos em 1 s e quantos pedidos de quadro rodaram; cada desenho
// dispara também um temporizador.
function loop(hz, late = 0) {
  const at = n => 1000 + n * 1000 / hz;
  let seconds = 0;
  let last = null;
  let drawn = -1;
  let frames = 0;
  for (let n = 0; n <= hz;) {
    frames++;
    const next = tick(seconds, last, at(n));
    if (next === null) {
      n++;
      continue;
    }
    seconds = next;
    last = at(n);
    drawn++;
    const asked = last + 1 + FRAME_WAIT_MS + late;
    while (at(n) <= asked) n++;
  }
  return { drawn, frames };
}

test('laço: a espera no temporizador não tira nenhum quadro, e cada desenho pede no máximo dois quadros', () => {
  for (const hz of [30, 60, 75, 90, 100, 120, 144, 165, 240]) {
    const { drawn, frames } = loop(hz);
    assert.equal(drawn, run(hz).drawn, hz + ' Hz');
    assert.ok(frames <= 2 * (drawn + 1), hz + ' Hz: ' + frames);
  }
  // A 60 Hz o temporizador pode atrasar 4 ms sem perder o quadro.
  assert.equal(loop(60, 4).drawn, 30);
});

test('bands: as faixas cobrem o canvas fora do palco, em pixels do aparelho e com y de baixo para cima', () => {
  // 1920 × 1080 px CSS a 2×, página que não rola: o buraco é o palco menos 32 px (o raio) em volta.
  const stage = { left: 288, right: 1632, top: 92, bottom: 1056 };
  const parts = bands(stage, 32, 3840, 2160, 2);
  assert.deepEqual(parts, [
    [0, 0, 640, 2160],
    [3200, 0, 640, 2160],
    [640, 2160 - 248, 2560, 248],
    [640, 0, 2560, 2160 - 2048],
  ]);
  const area = parts.reduce((sum, [, , w, h]) => sum + w * h, 0);
  assert.equal(area + (3200 - 640) * (2048 - 248), 3840 * 2160, 'faixas e buraco somam o canvas, sem sobra');
});

// Página de 1366 × 768 com 739 px de rolagem: o palco começa em 92 e acaba 24 px antes do pé da página (768 + 739 - 24).
const END = 739;
const scrolled = scroll => ({ left: 94, right: 1281, top: 92 - scroll, bottom: 1483 - scroll });

test('bands: o buraco é o mesmo em qualquer ponto da rolagem', () => {
  const parts = bands(scrolled(0), 32, 1351, 768, 1, 0, END);
  assert.deepEqual(parts, [
    [0, 0, 126, 768],
    [1249, 0, 102, 768],
    [126, 768 - 124, 1123, 124],
    [126, 0, 1123, 24 + 32],
  ]);
  for (const scroll of [0.5, 300, 738.5, END]) {
    assert.deepEqual(bands(scrolled(scroll), 32, 1351, 768, 1, scroll, END), parts, 'rolagem ' + scroll);
  }
});

test('bands: desenhado num ponto da rolagem, o buraco fica dentro do palco em qualquer outro', () => {
  for (const drawn of [0, 300, END]) {
    const [, , top, foot] = bands(scrolled(drawn), 32, 1351, 768, 1, drawn, END);
    // O buraco vai do pé da faixa de cima ao alto da faixa de baixo, em y de cima para baixo.
    const hole = [top[3], 768 - foot[3]];
    for (const now of [0, 1, 300, END]) {
      const stage = scrolled(now);
      assert.ok(hole[0] >= stage.top && hole[1] <= stage.bottom, `desenhado em ${drawn}, rolagem em ${now}`);
    }
  }
});

test('bands: na rolagem elástica, além do zero e do fim, vale o retângulo de agora', () => {
  // 50 px além do topo: o palco desceu 50 px e a rolagem informada é negativa. O buraco desce junto.
  assert.deepEqual(bands(scrolled(-50), 32, 1351, 768, 1, -50, END), [
    [0, 0, 126, 768],
    [1249, 0, 102, 768],
    [126, 768 - 174, 1123, 174],
    [126, 0, 1123, 6],
  ]);
  // 50 px além do fim: o palco subiu 50 px.
  assert.deepEqual(bands(scrolled(END + 50), 32, 1351, 768, 1, END + 50, END), [
    [0, 0, 126, 768],
    [1249, 0, 102, 768],
    [126, 768 - 74, 1123, 74],
    [126, 0, 1123, 24 + 32 + 50],
  ]);
});

test('bands: palco pequeno demais para ter buraco desenha o canvas inteiro', () => {
  assert.deepEqual(bands({ left: 0, right: 50, top: 0, bottom: 900 }, 32, 100, 1000, 1), [[0, 0, 100, 1000]]);
  // A página rola mais do que o palco tem de altura: nenhum ponto fica coberto na rolagem inteira.
  assert.deepEqual(bands({ left: 0, right: 900, top: 100, bottom: 400 }, 32, 1000, 1000, 1, 0, 300), [[0, 0, 1000, 1000]]);
});

test('bands: densidade e rolagem fracionárias dão pixels inteiros dentro do canvas', () => {
  const parts = bands({ left: 100.4, right: 1180.6, top: 80.3 - 37.6, bottom: 1890.7 - 37.6 }, 32, 1600, 1250, 1.25, 37.6, 900.8);
  assert.equal(parts.length, 4);
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

// O mínimo que o começo de startWaves toca fora do navegador: ouvintes que não fazem nada, os pedidos de quadro
// (frames), que ficam guardados para o teste rodar quando quiser, e o aviso da primeira pintura da página, que o
// teste dá com begin() (watching diz se alguém ainda espera por ele). O temporizador é o do teste.
function fakeBrowser(t) {
  const quiet = { addEventListener() {}, removeEventListener() {} };
  const env = { quiet, frames: [], watching: false, begin: null };
  const real = globalThis.PerformanceObserver;
  const fake = {
    window: { ...quiet, devicePixelRatio: 1, matchMedia: () => quiet },
    document: quiet,
    requestAnimationFrame: frame => env.frames.push(frame),
    cancelAnimationFrame() {},
    PerformanceObserver: class {
      static supportedEntryTypes = ['paint'];
      constructor(seen) { env.begin = seen; }
      observe() { env.watching = true; }
      disconnect() { env.watching = false; }
    },
  };
  Object.assign(globalThis, fake);
  t.after(() => {
    Object.keys(fake).forEach(name => delete globalThis[name]);
    globalThis.PerformanceObserver = real;
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return env;
}

test('startWaves: o contexto espera a primeira pintura da página, sem espera fixa; com ela já feita, sai na chamada', t => {
  const env = fakeBrowser(t);
  // O contexto já chega perdido: o link() para no aviso sem chamar o WebGL.
  let contexts = 0;
  const reports = [];
  const canvas = { ...env.quiet, getContext: () => (contexts++, { isContextLost: () => true }) };
  const options = { onActive: active => reports.push(active) };
  // Um só substituto, trocado pela variável: dois no mesmo método deixariam um para os testes seguintes.
  let painted = [];
  t.mock.method(performance, 'getEntriesByName', () => painted);

  startWaves(canvas, options);
  assert.deepEqual([contexts, env.watching], [0, true], 'antes da primeira pintura o contexto não sai');
  env.begin();
  assert.deepEqual([contexts, reports, env.watching], [1, [false], false], 'sai com ela, sem 1,5 s nem a folga da página');

  startWaves(canvas, options)();
  assert.deepEqual([contexts, env.watching], [1, false], 'parado antes da pintura, deixa de esperar por ela');

  painted = [{}];
  startWaves(canvas, options)();
  assert.deepEqual([contexts, reports], [2, [false, false]], 'com a página já pintada, o começo novo sai na chamada');

  painted = [];
  PerformanceObserver.supportedEntryTypes = [];
  startWaves(canvas, options)();
  assert.equal(contexts, 3, 'no navegador que não avisa da pintura, também');
});

test('o fundo parado fica atrás do canvas: data-waves mostra o --waves-rest, e o canvas só aparece com data-waves="on"', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /--waves-rest: linear-gradient\(/);
  assert.match(css, /:root\[data-waves\] body::before \{\s*background: var\(--waves-rest\)/);
  assert.match(css, /:root\[data-waves=on\] \.waves \{\s*visibility: visible/);
  assert.doesNotMatch(css, /:root\[data-waves\] \.waves \{/, 'sem o "on", o canvas com contexto e sem desenho cobriria o fundo de preto');
});

test('startWaves: desligado com o shader ainda ligando, só apaga o programa quando a ligação acaba', t => {
  const env = fakeBrowser(t);
  // Um WebGL que aceita tudo, com a extensão KHR_parallel_shader_compile: a ligação acaba quando o teste diz (linked).
  const COMPLETION_STATUS_KHR = 0x91B1;
  let linked = false;
  const deleted = [];
  const gl = new Proxy({
    isContextLost: () => false,
    getExtension: () => ({ COMPLETION_STATUS_KHR }),
    createProgram: () => 'programa',
    getProgramParameter: (program, name) => (name === COMPLETION_STATUS_KHR ? linked : true),
    deleteProgram: program => deleted.push(program),
  }, { get: (real, name) => real[name] ?? (() => null) });
  const reports = [];
  const stop = startWaves({ ...env.quiet, getContext: () => gl }, { onActive: active => reports.push(active) });
  env.begin();
  assert.equal(env.frames.length, 1, 'com a ligação em andamento, um quadro fica pedido para perguntar de novo');

  stop();
  assert.deepEqual(deleted, [], 'no meio da ligação o programa fica');
  env.frames.shift()();
  assert.deepEqual(deleted, [], 'e continua enquanto ela não acaba');
  linked = true;
  env.frames.shift()();
  assert.deepEqual([deleted, reports, env.frames.length], [['programa'], [], 0], 'ligado, sai sem desenhar nem avisar');
});

test('startWaves: cada quadro animado limpa o canvas inteiro no tom do palco antes das faixas; o parado não limpa', t => {
  const env = fakeBrowser(t);
  // O palco e a rolagem da página de 1366 × 768 dos testes do bands.
  window.scrollY = 0;
  globalThis.document = {
    ...env.quiet,
    querySelector: () => ({ getBoundingClientRect: () => scrolled(0) }),
    documentElement: { scrollHeight: 768 + END, clientHeight: 768 },
  };
  globalThis.getComputedStyle = () => ({ borderTopLeftRadius: '32px' });
  t.after(() => delete globalThis.getComputedStyle);
  // Um WebGL que aceita tudo, liga o shader na hora e anota as chamadas que mexem no desenho.
  const [SCISSOR_TEST, COLOR_BUFFER_BIT, TRIANGLES] = [0x0C11, 0x4000, 4];
  let calls = [];
  const gl = new Proxy({ SCISSOR_TEST, COLOR_BUFFER_BIT, TRIANGLES, isContextLost: () => false, getProgramParameter: () => true }, {
    get: (real, name) => real[name] ?? ((...args) => {
      if (['enable', 'disable', 'clearColor', 'clear', 'scissor', 'drawArrays'].includes(name)) calls.push([name, ...args]);
      return null;
    }),
  });
  const canvas = { ...env.quiet, getContext: () => gl, clientWidth: 1351, clientHeight: 768 };
  // A cor da limpeza é o --glass do palco com as ondas ligadas (styles.css).
  const glass = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
    .match(/:root\[data-waves\] \{\s*--glass: #(\w\w)(\w\w)(\w\w);/).slice(1).map(hex => parseInt(hex, 16) / 255);
  const setup = [['enable', SCISSOR_TEST], ['clearColor', ...glass, 1]];
  // A limpeza sai com o scissor desligado (o canvas inteiro), e o scissor volta antes da primeira faixa.
  const frame = [
    ['disable', SCISSOR_TEST], ['clear', COLOR_BUFFER_BIT], ['enable', SCISSOR_TEST],
    ...bands(scrolled(0), 32, 1351, 768, 1, 0, END).flatMap(part => [['scissor', ...part], ['drawArrays', TRIANGLES, 0, 3]]),
  ];

  const stop = startWaves(canvas);
  env.begin();
  assert.deepEqual(calls, [...setup, ...frame], 'o primeiro quadro');
  calls = [];
  env.frames.shift()(1000);
  assert.deepEqual(calls, frame, 'o navegador apaga o buffer depois de cada quadro: o seguinte limpa de novo');
  stop();

  calls = [];
  const still = startWaves(canvas, { animate: false });
  env.begin();
  still();
  assert.deepEqual(calls, [...setup, ['scissor', 0, 0, 1351, 768], ['drawArrays', TRIANGLES, 0, 3]], 'parado: a tela inteira');
});

test('startWaves: parado há 30 s ou com a janela sem foco, o laço para sem desenhar e volta do quadro em que parou', t => {
  const env = fakeBrowser(t);
  // Os ouvintes da window ficam guardados: o teste dá a entrada (pointermove), tira o foco (blur) e o devolve (focus).
  const heard = {};
  window.addEventListener = (type, listener) => { heard[type] = listener; };
  window.removeEventListener = (type, listener) => { if (heard[type] === listener) delete heard[type]; };
  // O relógio é o do teste: a hora da última entrada (performance.now) e a de cada quadro saem dele.
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  // Sem palco, cada quadro desenha o canvas inteiro.
  globalThis.document = { ...env.quiet, querySelector: () => null };
  // Um WebGL que aceita tudo, liga o shader na hora e anota o tempo do shader de cada quadro desenhado.
  const times = [];
  const gl = new Proxy({ isContextLost: () => false, getProgramParameter: () => true, uniform4f: (...args) => times.push(args[3]) },
    { get: (real, name) => real[name] ?? (() => null) });
  const canvas = { ...env.quiet, getContext: () => gl, clientWidth: 1351, clientHeight: 768 };
  // Roda o quadro pedido, ms depois do anterior, e o temporizador pede o seguinte.
  const frame = ms => {
    clock += ms;
    env.frames.shift()(clock);
    t.mock.timers.tick(FRAME_WAIT_MS);
  };

  assert.equal(IDLE_MS, 30000);
  assert.ok(['pointermove', 'keydown'].every(type => INPUT.includes(type)), 'o ponteiro e o teclado contam como entrada');
  const stop = startWaves(canvas);
  env.begin();
  assert.deepEqual(INPUT.filter(type => !heard[type]), [], 'cada entrada tem ouvinte na window');
  frame(0);
  frame(40);
  const [drawn, still] = [times.length, times.at(-1)];
  assert.ok(still > 0 && env.frames.length === 1, 'com alguém mexendo o laço anda');

  frame(IDLE_MS + 1000);
  t.mock.timers.tick(1000);
  assert.deepEqual([times.length, env.frames.length], [drawn, 0], '30 s sem entrada: nenhum desenho e nenhum quadro pedido');

  heard.pointermove();
  assert.equal(env.frames.length, 1, 'a primeira entrada pede um quadro');
  frame(16);
  assert.deepEqual([times.length, times.at(-1)], [drawn + 1, still], 'o primeiro quadro da volta desenha o mesmo em que parou: sem salto');
  frame(40);
  assert.ok(times.at(-1) > still && times.at(-1) - still <= MAX_STEP_MS / 1000 * SPEED, 'e o seguinte anda um passo');

  heard.blur();
  const before = times.length;
  frame(100);
  assert.deepEqual([times.length, env.frames.length], [before, 0], 'janela sem foco: para no quadro seguinte');
  heard.focus();
  assert.equal(env.frames.length, 1, 'o foco de volta toca o laço de novo');
  frame(16);
  assert.equal(times.length, before + 1, 'e o quadro seguinte desenha');
  stop();
  assert.deepEqual(Object.keys(heard), [], 'desligado, a window fica sem ouvinte nenhum');

  const stopStill = startWaves(canvas, { animate: false });
  env.begin();
  assert.deepEqual(Object.keys(heard), ['resize'], 'o fundo parado só ouve o tamanho da janela: nem a entrada nem o blur');
  stopStill();
});

test('onde as ondas rodam a reserva da barra de rolagem sai, e o centro e a largura do app não mudam com a barra', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\nhtml \{[^}]*scrollbar-gutter: stable;/, 'sem as ondas a reserva continua');
  assert.match(css, /:root\[data-waves\] \{[^}]*scrollbar-gutter: auto\s*\}/);
  assert.match(css, /:root\[data-waves\] body \{\s*padding-left: calc\(100vw - 100%\)\s*\}/);
  assert.match(css, /:root\[data-waves\] \.app \{\s*max-width: min\(84rem, 100vw - 34px\)\s*\}/);
  assert.match(css, /:root\[data-waves\] \.busy \{[^}]*left: calc\(50vw \+ var\(--dock-out\) \/ 2\)\s*\}/, 'a faixa de espera segue o centro');
  assert.match(css, /:root\[data-waves\] \.toast-region \{\s*left: 50vw\s*\}/, 'e o aviso da tela também');
  assert.match(css, /@media screen \{\s*:root\[data-waves\] body \{[^}]*\}\s*:root\[data-waves\] \.app \{[^}]*\}\s*\}/,
    'só na tela: na impressão a folha fica com a largura dela');
  assert.match(css, /\n\.waves \{[^}]*width: 100vw;/, 'o canvas não muda de largura quando a barra aparece');
});
