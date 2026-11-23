// Testes do layout com a letra maior no navegador ou no aparelho (#141), sem navegador: as quebras de largura em rem
// e as ondas na mesma quebra do dock, o dock que rola por dentro, o "Mais" preso na barra de baixo (lib.js, nameCut,
// App.jsx e mobile.css), o corte do exemplo do editor e a linha das ferramentas. As medidas na tela ficam na descrição
// do PR. npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nameCut } from '../src/lib.js';

// Sem o retorno de carro: no Windows o git entrega os arquivos com CRLF.
const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8').replaceAll('\r', '');
const [styles, mobile, ui, app] = ['styles.css', 'mobile.css', 'ui.jsx', 'App.jsx'].map(read);
// As larguras das quebras de um arquivo, em px da letra padrão (16 px), na ordem em que aparecem.
const widths = css => [...css.matchAll(/@media[^{]*\{/g)]
  .flatMap(([query]) => [...query.matchAll(/(?:min|max)-width: ([\d.]+)rem/g)].map(([, rem]) => rem * 16));

test('quebras de largura: nenhuma em px, e cada uma em rem dá px inteiros com a letra padrão', () => {
  for (const css of [styles, mobile]) {
    assert.doesNotMatch(css, /@media[^{]*(?:min|max)-width: [\d.]+px/, 'em px a quebra não acompanha a letra do navegador');
    assert.deepEqual(widths(css).filter(px => !Number.isInteger(px)), []);
  }
  // As da barra de baixo, na ordem do arquivo: até 850, de 600 a 850, de 551 a 745, até 550, até 380 e até 359 px.
  assert.deepEqual(widths(mobile).slice(0, 8), [850, 600, 850, 551, 745, 550, 380, 359]);
});

test('as ondas ligam na largura em que o dock entra: 1 px acima da quebra da barra de baixo, também em rem', () => {
  const [, rem] = ui.match(/WAVES_MEDIA = \['\(min-width: ([\d.]+)rem\) and \(hover: hover\) and \(pointer: fine\)'/);
  assert.equal(rem * 16, widths(mobile)[0] + 1);
});

test('dock: na janela mais baixa que ele, fica com a altura que sobra e rola por dentro, sem encolher os itens', () => {
  // 413 px com a letra padrão: de 414 para cima o dock preso (390 px, a 24 do topo) cabe na janela. A conta confere
  // com as medidas do dock no :root: oito itens, sete vãos, o respiro e a borda dos dois lados, e o topo.
  const [, low] = styles.match(/@media \(max-height: calc\(23\.5rem \+ 37px\)\) \{([\s\S]*?\n)\}\n/);
  const px = name => {
    const [, n, unit] = styles.match(new RegExp(`--${name}: ([\\d.]+)(rem|px);`));
    return n * (unit === 'rem' ? 16 : 1);
  };
  assert.equal(8 * px('dock-item') + 7 * px('dock-gap') + 2 * px('dock-pad') + 2 * px('hair') + px('sp-5') - 1, 23.5 * 16 + 37);
  assert.match(low, /\.rail \{\s*max-height: calc\(100dvh - [^;]+\);\s*overflow: hidden auto;/);
  assert.match(low, /\.rail \.nav-item \{\s*flex: none\s*\}/);
  // Fora dessa janela o dock não corta nada: as dicas saem para o lado dele.
  assert.doesNotMatch(styles.replace(low, ''), /\.rail \{[^}]*overflow/);
});

test('nameCut: a barra de baixo só prende o "Mais" quando a rolagem cortaria o nome dele', () => {
  assert.equal(nameCut(372, 372, 48, 29, '4px'), false, '390 px, letra padrão: a barra não rola');
  assert.equal(nameCut(372, 363, 48, 29, '4px'), false, '381 px, letra padrão: rola 9 px, só o vazio em volta do nome');
  // Os dois lados do limite, medidos com mouse e a barra de rolagem clássica (15 px a menos na barra de baixo).
  assert.equal(nameCut(372, 359, 48, 29, '4px'), false, '392 px, letra padrão, com mouse: rola 13 px, ainda no vazio');
  assert.equal(nameCut(372, 357, 48, 29, '4px'), true, '390 px, letra padrão, com mouse: rola 15 px e cortaria o nome');
  assert.equal(nameCut(405, 372, 48, 33, '4px'), true, '390 px, texto a 115%');
  assert.equal(nameCut(367, 350, 40, 35, '3px'), true, '360 px, texto a 130%');
  assert.equal(nameCut(349, 310, 40, 31, '3px'), true, '320 px, com o espaçamento de texto da WCAG 1.4.12');
  assert.equal(nameCut(0, 0, 0, 0, ''), false, 'no computador a barra não existe');
});

test('barra de baixo: "Mais" fica preso na ponta, menos com o foco do teclado em outro item, e o fundo dele vale também no hover', () => {
  // Com o foco no próprio "Mais" ele continua preso: o Esc da folha devolve o foco para ele sem rolar a barra.
  assert.match(mobile, /\[data-rola\]:not\(:has\(:focus-visible\)\) > \[aria-haspopup=dialog\],\s*\[data-rola\] > \[aria-haspopup=dialog\]:focus-visible \{\s*position: sticky;\s*right: 0\s*\}/);
  // Quem marca data-rola é o App, a cada mudança de tamanho da barra ou de um item dela.
  assert.match(app, /new ResizeObserver\(\(\) => bar\.toggleAttribute\('data-rola', nameCut\(bar\.scrollWidth, bar\.clientWidth,/);
  // O fundo e o hover têm a mesma força: vale o que vem depois. O item aberto (ciano) fica de fora do fundo.
  const cover = mobile.indexOf('[data-rola] > [aria-haspopup=dialog]:not([data-current]) {');
  assert.ok(cover > mobile.indexOf('.tab-item:hover:not(:disabled) {'));
});

test('texto ampliado: o exemplo do editor é cortado no campo, e a ferramenta sem lugar desce de linha, sem corte', () => {
  assert.match(styles, /\.editor-field \{\s*position: relative;\s*overflow: hidden\s*\}/);
  // No celular a parte de cada ferramenta não fica mais estreita que a palavra dela, e a linha delas quebra.
  const [tool] = mobile.match(/\n    \.tool \{[^}]*\}/);
  assert.match(tool, /flex: 1 1 0;/);
  assert.doesNotMatch(tool, /min-width|overflow/);
  assert.match(styles, /\n\.editor-tools \{[^}]*flex-wrap: wrap;/);
  assert.doesNotMatch(mobile, /\.editor-tools \{[^}]*flex-wrap/);
});
