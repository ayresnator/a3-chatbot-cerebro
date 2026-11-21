// Testes das regras do "Abrir arquivo" do Estudar (src/arquivo.js): o tipo do arquivo, o texto do TXT e a limpeza do
// texto do PDF. O pdf.js fica de fora: as linhas de cada página entram aqui como o pdf.js as entrega.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileKind, decodeText, pdfLines, pdfText, pageSpan, firstPages, FILE_ERRORS } from '../src/arquivo.js';

// Pedaço de texto como o getTextContent do pdf.js entrega: o texto, a altura da linha na página (y, que cresce para
// cima) e se a linha acaba nele.
const item = (str, y, hasEOL = true) => ({ str, hasEOL, transform: [12, 0, 0, 12, 72, y] });

test('fileKind: PDF, TXT e MD abrem; Word e PowerPoint pedem o PDF; o resto não abre', () => {
  assert.equal(fileKind({ name: 'Aula 3.PDF', type: '' }), 'pdf');
  assert.equal(fileKind({ name: 'resumo.txt', type: 'text/plain' }), 'texto');
  assert.equal(fileKind({ name: 'notas.md', type: '' }), 'texto');
  for (const name of ['aula.docx', 'aula.doc', 'slides.pptx', 'slides.ppt', 'texto.odt']) {
    assert.equal(fileKind({ name, type: '' }), 'office', name);
  }
  assert.equal(fileKind({ name: 'foto.jpg', type: 'image/jpeg' }), '');
  assert.equal(fileKind({ name: 'planilha.csv', type: 'text/csv' }), '');
});

test('fileKind: sem extensão conhecida, vale o tipo que o navegador informou', () => {
  assert.equal(fileKind({ name: 'Aula de biologia', type: 'application/pdf' }), 'pdf');
  assert.equal(fileKind({ name: 'anotações', type: 'text/markdown' }), 'texto');
  assert.equal(fileKind({ name: 'x.constructor', type: '' }), '');
});

test('decodeText: UTF-8, Windows-1252 do Bloco de Notas antigo e UTF-16, com a quebra de linha do editor', () => {
  assert.equal(decodeText(new TextEncoder().encode('Plano de ação: você revisa.')), 'Plano de ação: você revisa.');
  // "ação" e "você" gravados em Windows-1252 (o "ANSI"): ç = E7, ã = E3, ê = EA.
  const ansi = Uint8Array.from([0x61, 0xe7, 0xe3, 0x6f, 0x20, 0x76, 0x6f, 0x63, 0xea]);
  assert.equal(decodeText(ansi), 'ação você');
  // O "Unicode" do Bloco de Notas: UTF-16 com a marca FF FE no começo.
  assert.equal(decodeText(Uint8Array.from([0xff, 0xfe, 0xe7, 0x00, 0x61, 0x00])), 'ça');
  assert.equal(decodeText(new TextEncoder().encode('um\r\ndois\rtrês')), 'um\ndois\ntrês');
});

test('pdfLines: uma linha por fim de linha do pdf.js, com o texto dos pedaços juntos', () => {
  const items = [
    item('A fotossíntese ', 700, false), item('acontece nas folhas', 700, false), item('', 684),
    item('e libera oxigênio.', 684),
  ];
  assert.deepEqual(pdfLines(items), ['A fotossíntese acontece nas folhas', 'e libera oxigênio.']);
});

test('pdfLines: o espaço maior que o comum da página separa parágrafos com uma linha vazia', () => {
  const lines = pdfLines([
    item('Fotossíntese', 760), item('A planta usa a luz', 736), item('do Sol.', 720), item('Na fase clara', 696),
    item('a água se quebra.', 680), item('', 30), // o pedaço vazio de fim de linha não conta como linha
  ]);
  assert.deepEqual(lines, [
    'Fotossíntese', '', 'A planta usa a luz', 'do Sol.', '', 'Na fase clara', 'a água se quebra.',
  ]);
});

test('pdfLines: com o espaçamento 1,5 em todas as linhas, nenhuma vira parágrafo', () => {
  const lines = pdfLines([item('um', 700), item('dois', 682), item('três', 664), item('quatro', 646)]);
  assert.deepEqual(lines, ['um', 'dois', 'três', 'quatro']);
});

test('pdfText: a palavra cortada por hífen antes de minúscula volta inteira; antes de maiúscula, o hífen fica', () => {
  assert.deepEqual(pdfText([['Na planta, a fotos-', 'síntese ocorre nas folhas.']]), [
    'Na planta, a fotossíntese ocorre nas folhas.',
  ]);
  assert.deepEqual(pdfText([['A lei anti-', 'Corrupção mudou.']]), ['A lei anti-\nCorrupção mudou.']);
  // O hífen invisível do PDF (U+00AD) também.
  assert.deepEqual(pdfText([['clo\u00ad', 'rofila']]), ['clorofila']);
});

test('pdfText: a linha com minúscula continua a frase; título, lista e frase nova ficam na linha deles', () => {
  const [page] = pdfText([[
    'Fotossíntese', 'A planta transforma', 'a luz em açúcar.', 'Os produtos são:', '• glicose', '• oxigênio',
  ]]);
  assert.equal(page, 'Fotossíntese\nA planta transforma a luz em açúcar.\nOs produtos são:\n• glicose\n• oxigênio');
});

test('pdfText: a separação de parágrafos vira linha em branco, uma só, e não separa a palavra cortada', () => {
  assert.deepEqual(pdfText([['', 'Um.', '', '', 'Dois.', '']]), ['Um.\n\nDois.']);
  assert.deepEqual(pdfText([['A fotos-', '', 'síntese.']]), ['A fotossíntese.']);
});

test('pdfText: com 3 páginas, sai o cabeçalho repetido, mesmo com o número mudando, e o número da página', () => {
  // Como o pdf.js entrega a página de um PDF do Word: o cabeçalho, o número do rodapé e só então o texto.
  const page = (n, title, body) => [`Biologia – Apostila 2 – Página ${n}`, '', `${n}`, title, '', body];
  const pages = pdfText([
    page(1, 'Introdução', 'Primeira página.'), page(2, 'Fase clara', 'Segunda página.'),
    page(3, 'Ciclo de Calvin', 'Fim.'),
  ]);
  assert.deepEqual(pages, [
    'Introdução\n\nPrimeira página.', 'Fase clara\n\nSegunda página.', 'Ciclo de Calvin\n\nFim.',
  ]);
});

test('pdfText: o cabeçalho conta sem acento e sem maiúscula, e o rodapé no fim da página também sai', () => {
  const pages = pdfText([
    ['ESCOLA ESTADUAL', 'Texto um.', '- 1 -'],
    ['Escola Estadual', 'Texto dois.', '- 2 -'],
    ['Escóla estadual', 'Texto três.', '- 3 -'],
    ['Outro cabeçalho', 'Texto quatro.', '- 4 -'],
  ]);
  assert.deepEqual(pages, ['Texto um.', 'Texto dois.', 'Texto três.', 'Outro cabeçalho\nTexto quatro.']);
});

test('pdfText: com 2 páginas nada vira cabeçalho, mas a linha só com o número da página sai', () => {
  const pages = pdfText([['Escola', 'Texto um.', '1'], ['Escola', 'Texto dois.', '2/2']]);
  assert.deepEqual(pages, ['Escola\nTexto um.', 'Escola\nTexto dois.']);
});

test('pdfText: a linha repetida longe das pontas da página fica, e o número no meio do texto também', () => {
  const page = w => ['Cabeçalho', 'Texto ' + w + '.', 'Mais ' + w + '.', 'Resposta:', '42', 'Fim ' + w + '.',
    'Outra ' + w + '.', 'Última ' + w + '.'];
  const pages = pdfText([page('um'), page('dois'), page('três')]);
  assert.equal(pages[0], 'Texto um.\nMais um.\nResposta:\n42\nFim um.\nOutra um.\nÚltima um.');
});

test('pageSpan: as páginas escolhidas, com uma linha em branco entre elas e sem as páginas vazias', () => {
  const pages = ['Página um.', '', 'Página três.', 'Página quatro.'];
  assert.equal(pageSpan(pages, 1, 3), 'Página um.\n\nPágina três.');
  assert.equal(pageSpan(pages, 3, 4), 'Página três.\n\nPágina quatro.');
  assert.equal(pageSpan(pages, 2, 2), '');
});

test('pageSpan: a frase e a palavra cortada que seguem na página seguinte ficam inteiras', () => {
  assert.equal(
    pageSpan(['A fotos-', 'síntese acontece', 'nas folhas.', 'Fim.'], 1, 4),
    'A fotossíntese acontece nas folhas.\n\nFim.',
  );
});

test('firstPages: o maior começo do PDF que cabe nos 20.000 caracteres do editor, ao menos uma página', () => {
  const pages = Array.from({ length: 10 }, (_, i) => String(i).repeat(4000));
  // 4 páginas de 4.000 e 3 linhas em branco entre elas dão 16.006; com a 5ª, 20.008.
  assert.equal(firstPages(pages), 4);
  assert.equal(pageSpan(pages, 1, 4).length, 16006);
  assert.equal(firstPages(['x'.repeat(25000), 'y']), 1);
  assert.equal(firstPages(['curto', 'também curto']), 2);
});

test('FILE_ERRORS: cada arquivo que não abre tem uma frase que diz o que fazer', () => {
  for (const code of ['tipo', 'office', 'grande', 'vazio', 'leitura', 'leitor', 'senha', 'imagem', 'pdf']) {
    assert.ok(FILE_ERRORS[code]?.endsWith('.'), code);
  }
  assert.match(FILE_ERRORS.office, /PDF/);
  assert.match(FILE_ERRORS.senha, /senha/);
  assert.match(FILE_ERRORS.imagem, /digitalizado/);
});
