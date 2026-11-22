// Testes das regras de layout que só existem no CSS (src/styles.css e src/mobile.css): o gráfico do Desempenho em tela
// estreita, o atalho "Pergunte ao Cérebro", os alvos de toque no layout do computador, o botão das questões novas, a
// camada do "Pular para o conteúdo" e as marcas em cores forçadas. As medidas na tela ficam na descrição do PR. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const styles = read('styles.css');
const mobile = read('mobile.css');

// O que há dentro de todos os blocos com este cabeçalho (um @media, um @container), juntos.
function inside(css, header) {
  const found = [];
  for (let at = css.indexOf(header + ' {'); at >= 0; at = css.indexOf(header + ' {', at + 1)) {
    const start = css.indexOf('{', at) + 1;
    let end = start;
    for (let depth = 1; depth; end++) depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0;
    found.push(css.slice(start, end - 1));
  }
  return found.join('\n');
}

// O corpo da primeira regra com este seletor.
const rule = (css, selector) => css.split('\n' + selector + ' {')[1]?.split('}')[0] ?? '';

test('gráfico do Desempenho: a coluna encolhe abaixo da data e, abaixo de 360 px, as 7 cabem na caixa', () => {
  assert.match(rule(styles, '.chart > div'), /min-width: 0/, 'sem isto a data segura a largura da coluna');
  const narrow = inside(mobile, '@media (max-width: 359px)');
  assert.match(narrow, /\.chart \{\s*gap: var\(--sp-0\)\s*\}/);
  assert.match(narrow, /\.chart > div,\s*\.chart small \{\s*font-size: var\(--fs-0\)\s*\}/);
});

test('atalho "Pergunte ao Cérebro": sem lugar para o nome inteiro, ele sai da vista e continua no botão', () => {
  assert.match(styles, /\n\.ask-pill \{\s*container-type: inline-size\s*\}/);
  const hidden = inside(styles, '@container (max-width: 13rem)');
  assert.match(hidden, /\.ask-pill-text \{[^}]*clip-path: inset\(50%\) !important\s*\}/, 'sem o !important a animação terminada desfaz o recorte');
  assert.doesNotMatch(hidden, /display: none|visibility: hidden/, 'o nome do botão vem deste texto');
});

test('alvos de toque: 44 px com o dedo também no layout do computador, e as alturas de hoje com o mouse', () => {
  const touch = inside(styles, '@media (pointer: coarse)');
  assert.match(touch, /\.chip,\s*\.level-button,\s*\.suggestions button,\s*\.shortcuts,\s*\.composer-bar select,\s*\.composer-bar \.primary,\s*\.composer-bar \.link,\s*\.error summary \{\s*min-height: var\(--control-h\)\s*\}/);
  assert.match(touch, /\.shortcuts \{\s*width: var\(--control-h\)\s*\}/);
  assert.match(touch, /\.palette \[role=option\] \{[^}]*min-height: var\(--control-h\)\s*\}/);
  for (const selector of ['.chip', '.level-button', '.suggestions button']) {
    assert.match(rule(styles, selector), /min-height: var\(--control-h-inline\)/, selector);
  }
  for (const selector of ['.shortcuts', '.composer-bar select', '.composer-bar .primary']) {
    assert.match(rule(styles, selector), /min-height: var\(--control-h-tool\)/, selector);
  }
  assert.doesNotMatch(rule(styles, '.error summary'), /min-height/);
});

test('botão com o custo na linha de baixo: cresce com ela, e com uma linha e o ícone continua com 44 px', () => {
  // 12 px menos o fio da borda: o ícone de 1,25 rem, os dois respiros e as duas bordas somam os 2,75 rem do botão.
  assert.match(rule(styles, '.action'), /padding-block: calc\(var\(--sp-3\) - var\(--hair\)\)/);
  assert.match(rule(styles, '.icon'), /height: 1\.25rem/);
  assert.match(styles, /--sp-3: \.75rem;[\s\S]*--control-h: 2\.75rem;/);
});

test('camadas: todo z-index sai de uma variável, e o "Pular para o conteúdo" fica acima da faixa de espera', () => {
  assert.doesNotMatch(styles + mobile, /z-index:\s*-?\d/);
  assert.match(rule(styles, '.skip-link'), /z-index: calc\(var\(--z-top\) \+ 1\)/);
  assert.match(rule(styles, '.busy'), /z-index: var\(--z-top\)/);
});

test('cores forçadas: o esqueleto, os trilhos e o ponto do estado da IA ganham contorno na cor do texto', () => {
  const forced = inside(styles, '@media (forced-colors: active)');
  assert.match(forced, /\.sk,\s*\.sk-bar,\s*\.meter,\s*\.wait-bar,\s*\.status-dot \{\s*outline: var\(--hair\) solid CanvasText\s*\}/);
  assert.match(forced, /\.ai-status:not\(\[data-tone=""\]\) \.status-dot \{\s*forced-color-adjust: none;\s*background: CanvasText\s*\}/, 'vazado só enquanto confere');
});
