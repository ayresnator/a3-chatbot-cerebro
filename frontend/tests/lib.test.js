// Testes da lógica pura do Cérebro (src/lib.js), com o executor que já vem no Node: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREAS, LEVELS, STARTERS, EXAMPLE, localDay, fold, norm, demo,
  shortAnswerOk, expectedText, streak, firstAttempts, quizRate, cardRate, weakSpot, chartDays, spokenDay, lastDays,
  areaLine, deckStart, deckRight, deckWrong, deckLater, deckMissed, deckRedo, deckSummary, matches, hints, slashHints, hello,
  validMaterial, sameMaterial, validEvent, readList, readUser, readDraft, healthLabel, errorText, dictate,
  dictationError, mistakeKey, addMistake, clearMistake, removeMistake, validMistake, byMaterial, whyQuestion, whyTopic,
  gradeRequest, fixLastQuizEvent, readBackup, mergeBackup, backupNote, EXAMPLES, pickExample,
  opener, openers, typeDelay, rove, LEVEL_NOTES,
  read, storageKey, demoStorage, newId, backupStatus, backupSummary,
} from '../src/lib.js';

// Evento em novembro de 2026 no fuso da máquina, gravado em ISO como o App grava.
const at = (day, hour = 12) => new Date(2026, 10, day, hour).toISOString();
// "Hoje" dos testes: 16/11/2026 às 22h, hora em que o dia em UTC já virou no Brasil.
const today = () => new Date(2026, 10, 16, 22, 0);

// [resposta do material, o que o aluno digita, deve ser aceito?]
const SHORT_CASES = [
  ['||', '||', true], ['|', '|', true], ['|x|', '|x|', true], ['x || y', 'x || y', true],
  ['Selic|', 'selic', true], ['Selic||Taxa Selic', 'taxa selic', true],
  ['PIB|Produto Interno Bruto', 'pib', true], ['PIB|Produto Interno Bruto', 'Produto interno bruto.', true],
  ['PIB|Produto Interno Bruto', 'renda', false], ['PIB | Produto Interno Bruto', 'pib', true],
  ['Clorofila', 'clorofila.', true], ['Clorofila', '', false], ['Clorofila', 'clorofila|', false],
  [';|ponto e vírgula', 'ponto e vírgula', true], ['2,5', '2.5', true], ['2,5', '25', false],
];

test('resposta curta: os 16 casos fixos', () => {
  assert.equal(SHORT_CASES.length, 16);
  for (const [expected, typed, want] of SHORT_CASES) {
    assert.equal(
      shortAnswerOk(expected, typed),
      want,
      'resposta=' + JSON.stringify(expected) + ' digitado=' + JSON.stringify(typed)
    );
  }
});

test('resposta curta: nas 252 combinações, nada que a regra antiga aceitava passa a ser recusado', () => {
  // Regra antiga: só as partes separadas por "|" valiam; a resposta inteira com "|" nunca era aceita.
  const oldRule = (expected, value) =>
    !!norm(value) && String(expected).split('|').some(a => norm(a) === norm(value));
  const answers = ['a', 'a|b', 'a|', '|a', 'a||b', '||', '|', '|x|', 'x || y', ' a | b ', 'A|á', '2,5|2.5', ';|x', ''];
  const typedList = [
    'a', 'b', 'A', 'á', '', '|', '||', '|x|', 'x', 'y', 'x || y', 'a|b', 'a|', '2.5', '2,5', ';', ' a ', 'a.',
  ];
  let pairs = 0;
  const refused = [];
  const newly = [];
  for (const answer of answers) {
    for (const typed of typedList) {
      pairs++;
      const pair = JSON.stringify(answer) + ' <- ' + JSON.stringify(typed);
      const before = oldRule(answer, typed);
      const after = shortAnswerOk(answer, typed);
      if (before && !after) refused.push(pair);
      if (!before && after) newly.push(pair);
    }
  }
  assert.equal(pairs, 252);
  assert.deepEqual(refused, []);
  assert.deepEqual(newly, [
    '"a|b" <- "a|b"', '"a|" <- "a|"', '"||" <- "||"', '"|" <- "|"', '"|x|" <- "|x|"', '"x || y" <- "x || y"',
  ]);
});

test('localDay: às 22h o dia ainda é o mesmo, em qualquer fuso', () => {
  assert.equal(localDay(today()), '2026-11-16');
  assert.equal(localDay(today().toISOString()), '2026-11-16');
  assert.equal(localDay(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
});

test('fold: ignora maiúsculas e acentos', () => {
  assert.equal(fold('Fotossíntese'), 'fotossintese');
  assert.equal(fold('AÇÃO, Vovô e PINGÜIM'), 'acao, vovo e pinguim');
});

test('streak: com estudo hoje, conta os dias seguidos', () => {
  const events = [{ date: at(16, 21) }, { date: at(16, 9) }, { date: at(15) }, { date: at(14) }, { date: at(12) }];
  assert.equal(streak(events, today()), 3);
});

test('streak: sem estudo hoje, vale a sequência até ontem', () => {
  assert.equal(streak([{ date: at(15) }, { date: at(14) }], today()), 2);
});

test('streak: sem estudo hoje nem ontem é zero, e a data recebida não muda', () => {
  const now = today();
  assert.equal(streak([], now), 0);
  assert.equal(streak([{ date: at(14) }, { date: at(13) }], now), 0);
  assert.equal(now.getTime(), today().getTime());
});

// Respostas como o App grava. No quiz, q é o enunciado sem acentos nem maiúsculas.
const quizAt = (day, n, ok, extra) => ({
  kind: 'quiz', ok, area: 'Economia', title: 'Inflação', q: 'questao ' + n, date: at(day), ...extra,
});
const cardAt = (day, ok, extra) => ({
  kind: 'flashcard', ok, area: 'Economia', title: 'Inflação', date: at(day), ...extra,
});
// O caso da auditoria: no mesmo dia, 12 cartões marcados "Acertei" e um quiz de 6 questões com 2 certas.
// Somados davam 78%; refazer as erradas fazia o número subir mais.
const TWELVE_CARDS = Array.from({ length: 12 }, () => cardAt(16, true));
const SIX_ANSWERS = [1, 2, 3, 4, 5, 6].map(n => quizAt(16, n, n <= 2));
// As 4 questões erradas, refeitas e acertadas uma hora depois.
const redo = day => [3, 4, 5, 6].map(n => quizAt(day, n, true, { date: at(day, 13) }));
// As n primeiras respostas de um material num dia; as "wrong" primeiras estão erradas.
const answersOf = (title, day, n, wrong, extra) =>
  Array.from({ length: n }, (_, i) => quizAt(day, title + ' ' + i, i >= wrong, { title, ...extra }));

test('desempenho: 12 cartões "Acertei" e 2 de 6 no quiz dão 33% no quiz; os cartões ficam à parte', () => {
  const events = [...TWELVE_CARDS, ...SIX_ANSWERS];
  assert.deepEqual(quizRate(events), { total: 6, correct: 2, rate: 33 });
  assert.deepEqual(cardRate(events), { total: 12, correct: 12, rate: 100 });
});

test('desempenho: refazer as 4 erradas no mesmo dia e acertar não muda o número', () => {
  const events = [...TWELVE_CARDS, ...SIX_ANSWERS, ...redo(16), ...redo(16)];
  assert.deepEqual(quizRate(events), { total: 6, correct: 2, rate: 33 });
  assert.deepEqual(firstAttempts(events), SIX_ANSWERS);
});

test('desempenho: no dia seguinte a mesma questão conta de novo', () => {
  assert.deepEqual(quizRate([...SIX_ANSWERS, ...redo(16), ...redo(17)]), { total: 10, correct: 6, rate: 60 });
});

test('firstAttempts: evento antigo, sem o enunciado, conta como está', () => {
  const { q, ...old } = quizAt(16, 1, false);
  const events = [old, old, { ...old, ok: true }, quizAt(16, 1, true), quizAt(16, 1, false)];
  assert.deepEqual(firstAttempts(events), [old, old, { ...old, ok: true }, quizAt(16, 1, true)]);
  assert.deepEqual(quizRate(events), { total: 4, correct: 2, rate: 50 });
});

test('firstAttempts: a questão é a mesma com o mesmo dia, material e enunciado; vale a primeira resposta', () => {
  const first = quizAt(16, 1, false, { date: at(16, 9) });
  const events = [
    first,
    quizAt(16, 1, true, { date: at(16, 23) }), // refeita às 23h: no Brasil, em UTC já é dia 17
    quizAt(16, 1, true, { title: 'Juros' }), // outro material
    quizAt(16, 2, true), // outro enunciado
    quizAt(17, 1, true, { date: at(17, 0) }), // meia-noite: outro dia
    cardAt(16, false), // cartão não é quiz
  ];
  assert.deepEqual(firstAttempts(events), [first, events[2], events[3], events[4]]);
  assert.deepEqual(firstAttempts([events[1], first]), [events[1]], 'a primeira é a que foi gravada antes');
});

test('quizRate e cardRate: percentual arredondado; sem respostas é zero', () => {
  assert.deepEqual(quizRate([]), { total: 0, correct: 0, rate: 0 });
  assert.deepEqual(quizRate(TWELVE_CARDS), { total: 0, correct: 0, rate: 0 });
  assert.deepEqual(quizRate([quizAt(16, 1, true)]), { total: 1, correct: 1, rate: 100 });
  assert.deepEqual(cardRate([]), { total: 0, correct: 0, rate: 0 });
  assert.deepEqual(cardRate(SIX_ANSWERS), { total: 0, correct: 0, rate: 0 });
  assert.deepEqual(
    cardRate([cardAt(16, true), cardAt(16, true), cardAt(15, false), ...SIX_ANSWERS]),
    { total: 3, correct: 2, rate: 67 }
  );
});

test('weakSpot: o material com a maior taxa de erro, não o que tem mais erros', () => {
  const events = [...answersOf('Juros', 16, 10, 4), ...answersOf('Fotossíntese', 15, 3, 2)];
  assert.deepEqual(weakSpot(events, today()), { name: 'Fotossíntese', wrong: 2, total: 3 });
});

test('weakSpot: com a mesma taxa, o que tem mais erros', () => {
  const events = [...answersOf('Juros', 16, 3, 1), ...answersOf('Inflação', 16, 6, 2), ...answersOf('PIB', 16, 3, 1)];
  assert.deepEqual(weakSpot(events, today()), { name: 'Inflação', wrong: 2, total: 6 });
});

test('weakSpot: ignora material com menos de 3 respostas', () => {
  assert.equal(weakSpot(answersOf('Juros', 16, 2, 2), today()), null);
  assert.deepEqual(
    weakSpot([...answersOf('Juros', 16, 2, 2), ...answersOf('Inflação', 16, 3, 1)], today()),
    { name: 'Inflação', wrong: 1, total: 3 }
  );
});

test('weakSpot: ignora erro com mais de 7 dias', () => {
  // Hoje é dia 16: valem os dias 10 a 16, os mesmos do gráfico.
  const old = answersOf('Juros', 9, 3, 3, { date: at(9, 23) });
  assert.equal(weakSpot(old, today()), null);
  assert.deepEqual(
    weakSpot([...old, ...answersOf('Inflação', 16, 3, 1)], today()),
    { name: 'Inflação', wrong: 1, total: 3 }
  );
  const edge = answersOf('Juros', 10, 3, 3, { date: at(10, 0) });
  assert.deepEqual(weakSpot(edge, today()), { name: 'Juros', wrong: 3, total: 3 });
  // As 3 respostas têm de ser da semana: duas antigas e duas recentes não bastam.
  assert.equal(weakSpot([...answersOf('Juros', 9, 2, 2), ...answersOf('Juros', 16, 2, 2)], today()), null);
});

test('weakSpot: conta só a primeira resposta de cada questão, e só o quiz', () => {
  const sameQuestion = Array.from({ length: 5 }, () => quizAt(16, 1, false));
  assert.equal(weakSpot(sameQuestion, today()), null, 'a mesma questão errada 5 vezes é uma resposta só');
  assert.equal(weakSpot(Array.from({ length: 5 }, () => cardAt(16, false)), today()), null, 'cartão é autoavaliação');
  // Errou as 3, refez e acertou: as primeiras respostas continuam sendo 3 erros.
  const events = [...answersOf('Juros', 16, 3, 3), ...answersOf('Juros', 16, 3, 0)];
  assert.deepEqual(weakSpot(events, today()), { name: 'Juros', wrong: 3, total: 3 });
});

test('weakSpot: evento sem título cai na área; sem erro recente não há ponto fraco', () => {
  const { title, q, ...old } = quizAt(16, 1, false, { area: 'Direito' });
  assert.deepEqual(weakSpot([old, old, { ...old, ok: true }], today()), { name: 'Direito', wrong: 2, total: 3 });
  assert.equal(weakSpot([], today()), null);
  assert.equal(weakSpot(answersOf('Juros', 16, 5, 0), today()), null);
});

test('chartDays: os 7 dias até hoje, com as primeiras respostas do quiz de cada dia', () => {
  const events = [
    ...SIX_ANSWERS, ...redo(16), ...TWELVE_CARDS,
    quizAt(14, 1, true), quizAt(14, 2, true), quizAt(14, 3, false),
    quizAt(10, 1, true, { date: at(10, 0) }),
    quizAt(9, 1, false, { date: at(9, 23) }),
  ];
  const days = chartDays(events, 'Todas', today());
  assert.deepEqual(days.map(d => d.day), [
    '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16',
  ]);
  assert.deepEqual(days.map(d => d.label), ['10/11', '11/11', '12/11', '13/11', '14/11', '15/11', '16/11']);
  assert.deepEqual(days.map(d => d.total), [1, 0, 0, 0, 3, 0, 6]);
  assert.deepEqual(days.map(d => d.correct), [1, 0, 0, 0, 2, 0, 2]);
  assert.deepEqual(days.map(d => d.rate), [100, 0, 0, 0, 67, 0, 33]);
  assert.deepEqual(days[6], { day: '2026-11-16', label: '16/11', total: 6, correct: 2, rate: 33 });
});

test('chartDays: filtra pela área, menos em "Todas"', () => {
  const events = [...SIX_ANSWERS, quizAt(16, 7, true, { area: 'Direito', title: 'Constituição' })];
  assert.equal(chartDays(events, 'Todas', today())[6].total, 7);
  assert.equal(chartDays(events, 'Economia', today())[6].total, 6);
  assert.deepEqual(
    chartDays(events, 'Direito', today())[6],
    { day: '2026-11-16', label: '16/11', total: 1, correct: 1, rate: 100 }
  );
  assert.deepEqual(chartDays(events, 'Escolar', today()).map(d => d.total), [0, 0, 0, 0, 0, 0, 0]);
});

test('chartDays: atravessa a virada do mês e não muda a data recebida', () => {
  const now = new Date(2027, 0, 3, 8, 0);
  const days = chartDays([], 'Todas', now);
  assert.deepEqual(days.map(d => d.label), ['28/12', '29/12', '30/12', '31/12', '01/01', '02/01', '03/01']);
  assert.equal(days[0].day, '2026-12-28');
  assert.equal(now.getTime(), new Date(2027, 0, 3, 8, 0).getTime());
});

test('spokenDay: a coluna do gráfico por extenso, para o leitor de tela', () => {
  assert.equal(spokenDay({ day: '2026-11-16', total: 6, rate: 33 }), '16 de novembro: 6 respostas, 33% de acerto');
  assert.equal(spokenDay({ day: '2026-03-01', total: 1, rate: 100 }), '1 de março: 1 resposta, 100% de acerto');
  assert.equal(spokenDay({ day: '2026-11-15', total: 0, rate: 0 }), '15 de novembro: nenhuma resposta');
});

test('lastDays: do mais antigo para hoje, se houve estudo em cada dia', () => {
  const events = [cardAt(16, true, { date: at(16, 22) }), quizAt(14, 1, false), quizAt(14, 2, true), cardAt(11, true)];
  assert.deepEqual(lastDays(events, 5, today()), [false, false, true, false, true]);
  assert.deepEqual(lastDays(events, 7, today()), [false, true, false, false, true, false, true]);
  assert.deepEqual(lastDays([], 5, today()), [false, false, false, false, false]);
  assert.deepEqual(lastDays(events, 0, today()), []);
});

test('areaLine: quiz e cartões da área, separados; sem resposta de quiz não há percentual', () => {
  const events = [
    ...SIX_ANSWERS, ...redo(16), ...TWELVE_CARDS,
    quizAt(16, 1, true, { area: 'Direito', title: 'Constituição' }),
    cardAt(16, false, { area: 'Direito' }),
    cardAt(15, true, { area: 'Escolar' }),
    cardAt(15, false, { area: 'Escolar' }),
  ];
  assert.equal(areaLine(events, 'Economia'), '33% de acerto no quiz · 6 questões · 12 cartões');
  assert.equal(areaLine(events, 'Direito'), '100% de acerto no quiz · 1 questão · 1 cartão');
  assert.equal(areaLine(events, 'Escolar'), 'Quiz sem respostas · 2 cartões');
  assert.equal(areaLine(events, 'Matemática'), 'Sem registros ainda');
  assert.equal(areaLine(SIX_ANSWERS, 'Economia'), '33% de acerto no quiz · 6 questões · 0 cartões');
});

test('expectedText: o gabarito em texto, a opção certa ou as formas da resposta curta', () => {
  const short = answer => ({ type: 'short', question: 'Qual é a sigla?', options: [], answer });
  const multiple = { type: 'multiple', question: 'Quem fixa a Selic?', options: ['Senado', 'STF', 'Copom'], answer: 2 };
  const boolean = { type: 'boolean', question: 'Juro alto freia?', options: ['Verdadeiro', 'Falso'], answer: 0 };
  assert.equal(expectedText(multiple), 'Copom');
  assert.equal(expectedText(boolean), 'Verdadeiro');
  assert.equal(expectedText(short('Clorofila')), 'Clorofila');
  assert.equal(expectedText(short('PIB|Produto Interno Bruto')), 'PIB ou Produto Interno Bruto');
  assert.equal(expectedText(short(' PIB | Produto Interno Bruto |')), 'PIB ou Produto Interno Bruto');
  assert.equal(expectedText(short('||')), '||', 'só barras (o operador OU) é a própria resposta');
  assert.equal(expectedText({ ...multiple, answer: 7 }), '7', 'material antigo com índice fora das opções');
});

// Baralho congelado: função que mexesse no que recebeu falharia aqui.
const deck = (queue, pos) => Object.freeze({ queue: Object.freeze(queue), pos });

test('deckStart: todos os cartões, na ordem, a partir do primeiro', () => {
  assert.deepEqual(deckStart(3), { queue: [0, 1, 2], pos: 0 });
  assert.deepEqual(deckStart(0), { queue: [], pos: 0 });
});

test('deckRight: vai para o próximo sem mexer na fila', () => {
  assert.deepEqual(deckRight(deck([0, 1, 2], 0)), { queue: [0, 1, 2], pos: 1 });
  assert.deepEqual(deckRight(deck([0, 1, 2], 2)), { queue: [0, 1, 2], pos: 3 }, 'depois do último, acabou');
});

test('deckWrong: o cartão errado entra de novo no fim da fila', () => {
  assert.deepEqual(deckWrong(deck([0, 1, 2], 0)), { queue: [0, 1, 2, 0], pos: 1 });
  assert.deepEqual(deckWrong(deck([0, 1, 2, 0], 1)), { queue: [0, 1, 2, 0, 1], pos: 2 });
});

test('deckWrong: o último cartão da fila volta até ser acertado', () => {
  let d = deckWrong(deck([0, 1, 2], 2));
  assert.deepEqual(d, { queue: [0, 1, 2, 2], pos: 3 });
  d = deckWrong(d);
  assert.deepEqual(d, { queue: [0, 1, 2, 2, 2], pos: 4 });
  assert.equal(d.queue[d.pos], 2);
  d = deckRight(d);
  assert.equal(d.pos, d.queue.length, 'acertou: o baralho acabou');
});

test('deckLater: manda o cartão aberto para o fim, sem repetir nenhum', () => {
  assert.deepEqual(deckLater(deck([0, 1, 2], 0)), { queue: [1, 2, 0], pos: 0 });
  assert.deepEqual(deckLater(deck([0, 1, 2], 1)), { queue: [0, 2, 1], pos: 1 });
  assert.deepEqual(deckLater(deck([0, 1, 2, 0], 1)), { queue: [0, 2, 0, 1], pos: 1 });
});

test('deckLater: no último cartão da fila não há para onde mandar', () => {
  assert.deepEqual(deckLater(deck([0, 1, 2], 2)), { queue: [0, 1, 2], pos: 2 });
  assert.deepEqual(deckLater(deck([0], 0)), { queue: [0], pos: 0 });
  assert.deepEqual(deckLater(deck([0, 1], 2)), { queue: [0, 1], pos: 2 }, 'baralho já concluído');
  assert.deepEqual(deckLater(deck([], 0)), { queue: [], pos: 0 });
});

test('deckMissed: os cartões que voltaram por erro, uma vez cada, na ordem do material', () => {
  assert.deepEqual(deckMissed(deck([0, 1, 2], 3)), []);
  assert.deepEqual(deckMissed(deck([1, 2, 0], 3)), [], '"Revisar depois" não é erro');
  assert.deepEqual(deckMissed(deck([0, 1, 2, 2, 0, 2], 6)), [0, 2]);
});

test('deckSummary: quantos cartões foram revisados e quantos voltaram por erro', () => {
  assert.equal(deckSummary(deck([0, 1, 2, 3, 4], 5)), '5 cartões revisados; nenhum voltou por erro.');
  assert.equal(deckSummary(deck([0, 1, 2, 1], 4)), '3 cartões revisados; 1 voltou por erro.');
  assert.equal(deckSummary(deck([0, 1, 2, 1, 0, 1], 6)), '3 cartões revisados; 2 voltaram por erro.');
  assert.equal(deckSummary(deck([0], 1)), '1 cartão revisado; nenhum voltou por erro.');
});

test('baralho: uma sessão inteira, com erro, "Revisar depois" e o último cartão errado', () => {
  let d = deckStart(3);
  d = deckWrong(d); // cartão 0: Errei
  d = deckRight(d); // cartão 1: Acertei
  d = deckLater(d); // cartão 2: Revisar depois
  assert.deepEqual(d, { queue: [0, 1, 0, 2], pos: 2 });
  d = deckRight(d); // cartão 0 de novo: Acertei
  d = deckWrong(d); // cartão 2, o último da fila: Errei
  assert.deepEqual(d, { queue: [0, 1, 0, 2, 2], pos: 4 });
  assert.deepEqual(deckLater(d), d, 'é o último de novo');
  d = deckRight(d); // cartão 2 de novo: Acertei
  assert.equal(d.pos, d.queue.length);
  assert.deepEqual(deckMissed(d), [0, 2]);
  assert.equal(deckSummary(d), '3 cartões revisados; 2 voltaram por erro.');
  assert.deepEqual(deckRedo(d), { queue: [0, 2], pos: 0 });
});

test('demo: texto de uma frase só vira um tópico, um flashcard e uma questão', () => {
  const text = 'Mitocôndrias produzem a energia da célula.';
  assert.deepEqual(demo(text), {
    title: 'Mitocôndrias produzem a energia da célula',
    summary: [{ concept: 'Mitocôndrias produzem a energia da célula', text }],
    flashcards: [{ question: 'Complete o trecho 1: Mitocôndrias produzem a energia…', answer: text }],
    quiz: [{
      type: 'short',
      question: 'Qual palavra inicia este trecho: “…produzem a energia da célula.”?',
      options: [text, 'O texto não apresenta nenhuma informação.', 'Nenhuma das alternativas.'],
      answer: 'Mitocôndrias',
      explanation: 'Trecho do material: ' + text,
      steps: [],
    }],
  });
});

test('demo: o EXAMPLE vira título, 5 questões e tipos alternando', () => {
  const material = demo(EXAMPLE);
  assert.equal(material.title, 'A fotossíntese é o processo');
  assert.equal(material.summary.length, 5);
  // Cada tópico termina numa oração inteira, não no meio dela ("No ciclo de", "Na fase clara,").
  assert.deepEqual(material.summary.map(s => s.concept), [
    'A fotossíntese é o processo',
    'A clorofila absorve a luz solar nos cloroplastos',
    'Na fase clara',
    'No ciclo de Calvin',
    'Esse processo sustenta as cadeias alimentares',
  ]);
  assert.equal(material.flashcards.length, 5);
  assert.deepEqual(material.quiz.map(q => q.type), ['short', 'boolean', 'multiple', 'short', 'boolean']);
  assert.equal(material.quiz[0].answer, 'A');
  assert.deepEqual(material.quiz[1].options, ['Verdadeiro', 'Falso']);
  assert.equal(material.quiz[1].answer, 0);
  assert.equal(material.quiz[2].options[material.quiz[2].answer], material.summary[2].text);
  assert.equal(material.quiz[3].answer, 'No');
});

test('demo: o título para na quebra de linha, antes de "em que" e em 12 palavras', () => {
  assert.equal(demo('Fotossíntese\nA clorofila absorve a luz.').title, 'Fotossíntese');
  assert.equal(demo('O ano em que tudo mudou foi 1789.').title, 'O ano');
  assert.equal(demo('um dois três quatro cinco seis sete oito nove dez onze doze treze').title,
    'um dois três quatro cinco seis sete oito nove dez onze doze…');
});

test('EXAMPLES: cada área tem pelo menos 3 exemplos prontos, com tema e texto de 350 a 900 caracteres', () => {
  assert.deepEqual(Object.keys(EXAMPLES), AREAS);
  for (const area of AREAS) {
    assert.ok(EXAMPLES[area].length >= 3, area);
    for (const { topic, text } of EXAMPLES[area]) {
      assert.ok(topic.trim() !== '' && topic === topic.trim(), area + ': tema vazio ou com espaço nas pontas');
      assert.ok(text.length >= 350 && text.length <= 900, topic + ': ' + text.length + ' caracteres');
      // Na demonstração o exemplo vira material na hora: de 5 a 8 frases, sem ponto no meio de nenhuma.
      const sentences = text.match(/[^.!?]+[.!?]/g);
      assert.equal(sentences.join(''), text, topic + ': termina sem pontuação');
      assert.ok(sentences.length >= 5 && sentences.length <= 8, topic + ': ' + sentences.length + ' frases');
      assert.equal(validMaterial(demo(text)), true, topic);
    }
  }
});

test('EXAMPLES: nenhum tema ou texto se repete, e o EXAMPLE da fotossíntese é um dos de Escolar', () => {
  const all = Object.values(EXAMPLES).flat();
  assert.equal(new Set(all.map(e => fold(e.topic))).size, all.length, 'tema repetido');
  assert.equal(new Set(all.map(e => e.text)).size, all.length, 'texto repetido');
  assert.ok(EXAMPLE.startsWith('A fotossíntese é o processo'));
  assert.deepEqual(EXAMPLES.Escolar.filter(e => e.text === EXAMPLE), [{ topic: 'Fotossíntese', text: EXAMPLE }]);
});

test('pickExample: nunca devolve o exemplo que está no editor, pelo texto ou pelo tema', () => {
  for (const area of AREAS) {
    for (const current of EXAMPLES[area]) {
      // O exemplo pronto na tela; o mesmo tema escrito pela IA (outro texto, outra grafia); o mesmo texto já editado
      // nas pontas e com o tema perdido (depois de um F5).
      const shapes = [
        current,
        { topic: '  ' + fold(current.topic).toUpperCase() + ' ', text: 'Texto que a IA escreveu.' },
        { topic: '', text: '\n' + current.text + '  ' },
      ];
      for (const shape of shapes) {
        for (const r of [0, 0.3, 0.5, 0.7, 0.999]) {
          const picked = pickExample(area, shape, () => r);
          assert.ok(EXAMPLES[area].includes(picked), area + ': ' + JSON.stringify(picked));
          assert.notEqual(picked.topic, current.topic, area + ' com ' + JSON.stringify(shape.topic));
        }
      }
    }
  }
});

test('pickExample: dois cliques seguidos, com o sorteio de verdade, não repetem', () => {
  for (const area of AREAS) {
    let current = null;
    for (let i = 0; i < 40; i++) {
      const next = pickExample(area, current);
      assert.ok(EXAMPLES[area].includes(next), area);
      assert.notEqual(next.text, current?.text, area);
      current = next;
    }
  }
});

test('pickExample: com o sorteio injetado, o resultado é previsível', () => {
  const [first, second, third] = EXAMPLES.Economia;
  assert.equal(pickExample('Economia', null, () => 0), first, 'sem exemplo no editor, todos entram');
  assert.equal(pickExample('Economia', { topic: '', text: 'Meu texto.' }, () => 0.999), EXAMPLES.Economia.at(-1));
  assert.equal(pickExample('Economia', first, () => 0), second, 'o exemplo do editor sai do sorteio');
  assert.equal(pickExample('Economia', first, () => 0.5), third);
  assert.equal(pickExample('Economia', second, () => 0.5), third);
});

test('pickExample: área fora da lista cai nos exemplos de Escolar', () => {
  for (const area of ['Medicina', '', undefined, null, 'constructor', '__proto__']) {
    assert.equal(pickExample(area, null, () => 0), EXAMPLES.Escolar[0], String(area));
  }
  assert.equal(pickExample('Medicina', EXAMPLES.Escolar[0], () => 0), EXAMPLES.Escolar[1]);
});

test('openers: a primeira frase de cada exemplo pronto da área, com reticências no lugar do ponto', () => {
  assert.equal(openers('Economia')[1], 'A lei da oferta e da demanda explica como os preços se formam em um mercado…');
  assert.equal(openers('Matemática')[1], 'Uma equação do 1º grau tem uma incógnita com expoente 1, como em 2x + 3 = 11…');
  assert.equal(openers('Escolar')[2], 'A Independência do Brasil marcou a separação política entre o Brasil e Portugal…');
});

test('openers: frase com mais de 80 caracteres para numa palavra inteira, sem palavrinha solta nem vírgula no fim', () => {
  // "…energia luminosa em energia química": o corte cai depois de "em", que sai.
  assert.equal(openers('Escolar')[0], 'A fotossíntese é o processo pelo qual plantas transformam energia luminosa…');
  // Duas palavrinhas seguidas ("e a") saem juntas.
  assert.equal(openers('Escolar')[1], 'O ciclo da água é o caminho que a água percorre entre a superfície da Terra…');
  // A vírgula antes da palavrinha sai com ela ("menores, de").
  assert.equal(openers('Tecnologia')[1], 'A internet é uma rede mundial que interliga milhões de redes menores…');
  // Palavra de três letras também sai ("forma que").
  assert.equal(openers('Tecnologia')[2], 'Um banco de dados é um conjunto organizado de informações, guardado de forma…');
  // Palavra de quatro letras ou mais fica.
  assert.equal(openers('Direito')[0], 'A Constituição Federal é a lei máxima do Brasil, e nenhuma outra norma pode…');
});

test('opener: o corte que cai logo depois de uma vírgula não deixa a vírgula no fim', () => {
  assert.equal(
    opener('A internet é uma rede mundial que interliga milhões de redes bem menores, residências e empresas e universidades.'),
    'A internet é uma rede mundial que interliga milhões de redes bem menores…',
  );
});

test('opener: texto curto sem ponto fica inteiro', () => {
  assert.equal(opener('Frase sem ponto final'), 'Frase sem ponto final…');
});

test('openers: uma frase por exemplo, nenhuma repetida entre as áreas, todas de 20 a 81 caracteres', () => {
  const all = AREAS.flatMap(area => {
    assert.equal(openers(area).length, EXAMPLES[area].length, area);
    return openers(area);
  });
  assert.equal(new Set(all).size, all.length, 'frase repetida');
  for (const line of all) assert.match(line, /^[^.!?…]{18,79}[^\s,.!?…]…$/, line);
});

test('openers: área fora da lista vale Escolar', () => {
  for (const area of ['Medicina', '', undefined, null, 'constructor', '__proto__']) {
    assert.equal(openers(area)[2], 'A Independência do Brasil marcou a separação política entre o Brasil e Portugal…', String(area));
  }
});

test('typeDelay: a frase mais longa das seis áreas se escreve letra a letra e termina antes de 5 s, mesmo no sorteio mais lento', () => {
  // WCAG 2.2.2: o que se move sozinho ao lado do conteúdo para antes de 5 s.
  const longest = Math.max(...AREAS.flatMap(area => openers(area)).map(line => line.length));
  let slowest = 0;
  for (let shown = 0; shown < longest; shown++) slowest += typeDelay(shown, () => 1);
  assert.ok(slowest < 5000, slowest + ' ms para ' + longest + ' letras');
  // Uma letra por vez, no ritmo de quem digita: nunca na hora.
  assert.ok(typeDelay(1, () => 0) >= 20, String(typeDelay(1, () => 0)));
});

test('rove: as setas andam um item e dão a volta nas pontas', () => {
  assert.equal(rove('ArrowRight', 0, 6), 1);
  assert.equal(rove('ArrowDown', 2, 6), 3);
  assert.equal(rove('ArrowRight', 5, 6), 0);
  assert.equal(rove('ArrowLeft', 3, 6), 2);
  assert.equal(rove('ArrowUp', 1, 6), 0);
  assert.equal(rove('ArrowLeft', 0, 6), 5);
});

test('rove: Home e End vão para as pontas, e outra tecla não anda', () => {
  assert.equal(rove('Home', 4, 6), 0);
  assert.equal(rove('End', 1, 6), 5);
  for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a', 'PageDown']) assert.equal(rove(key, 2, 6), -1, key);
});

test('LEVEL_NOTES: cada nível do menu tem a nota dele', () => {
  assert.deepEqual(Object.keys(LEVEL_NOTES), LEVELS);
});

const MATERIAL = {
  title: 'Fotossíntese',
  area: 'Escolar',
  summary: [{ concept: 'Clorofila', text: 'Absorve a luz solar.' }],
  flashcards: [{ question: 'Onde ocorre?', answer: 'Nos cloroplastos.' }],
  quiz: [{ type: 'boolean', question: 'A água é decomposta?', options: ['Verdadeiro', 'Falso'], answer: 0 }],
};

test('matches: busca sem acento e em maiúsculas acha material com acento', () => {
  assert.equal(matches(MATERIAL, 'fotossintese', 'Todas'), true);
  assert.equal(matches(MATERIAL, 'AGUA E DECOMPOSTA', 'Todas'), true);
  assert.equal(matches(MATERIAL, '', 'Todas'), true);
  assert.equal(matches(MATERIAL, 'mitocondria', 'Todas'), false);
});

test('matches: procura no título, no resumo, nos flashcards e nas perguntas do quiz', () => {
  for (const query of ['fotossíntese', 'clorofila', 'luz solar', 'onde ocorre', 'cloroplastos', 'decomposta']) {
    assert.equal(matches(MATERIAL, query, 'Todas'), true, query);
  }
  assert.equal(matches(MATERIAL, 'fotossínteseclorofila', 'Todas'), false, 'um campo não emenda no outro');
});

test('matches: não casa nome de campo', () => {
  assert.equal(matches(MATERIAL, 'quiz', 'Todas'), false);
  assert.equal(matches(MATERIAL, 'answer', 'Todas'), false);
});

test('matches: respeita o filtro de área', () => {
  assert.equal(matches(MATERIAL, 'fotossintese', 'Escolar'), true);
  assert.equal(matches(MATERIAL, 'fotossintese', 'Direito'), false);
});

const NO_TIPS = { key: '', list: [] };
const ANSWERED = [{ role: 'user', text: 'O que é PIB?' }, { role: 'assistant', text: 'É a soma das riquezas.' }];
const FIXED_HINTS = ['Me dê um exemplo do dia a dia', 'Explique de outro jeito', 'Faça uma pergunta para eu praticar'];

test('AREAS: as seis áreas do contrato da API, cada uma com duas perguntas de partida', () => {
  assert.deepEqual(AREAS, ['Tecnologia', 'Administração', 'Economia', 'Matemática', 'Direito', 'Escolar']);
  for (const area of AREAS) assert.equal(STARTERS[area].length, 2, area);
});

test('hints: antes da primeira resposta, sem texto no editor, usa as perguntas da área', () => {
  assert.deepEqual(
    hints({ chat: [], input: '  ', area: 'Economia', tips: NO_TIPS }),
    ['Me introduza ao assunto', 'O que é inflação?', 'Como funcionam oferta e demanda?']
  );
});

test('hints: antes da primeira resposta, com texto no editor, pergunta sobre o texto', () => {
  assert.deepEqual(
    hints({ chat: [{ role: 'user', text: 'oi' }], input: 'Um texto', area: 'Economia', tips: NO_TIPS }),
    [
      'Me introduza ao assunto',
      'Quais são os pontos principais do texto?',
      'Faça uma pergunta sobre o texto para eu praticar',
    ]
  );
});

test('hints: depois da resposta, valem as sugestões que a IA mandou para este texto e esta área', () => {
  const tips = { key: JSON.stringify(['Um texto', 'Economia']), list: ['E o PIB per capita?', 'Como se mede?'] };
  assert.deepEqual(hints({ chat: ANSWERED, input: 'Um texto', area: 'Economia', tips }), tips.list);
});

test('hints: com a chave trocada ou sem sugestões da IA, entram as três fixas', () => {
  const tips = { key: JSON.stringify(['Um texto', 'Economia']), list: ['E o PIB per capita?'] };
  assert.deepEqual(hints({ chat: ANSWERED, input: 'Outro texto', area: 'Economia', tips }), FIXED_HINTS);
  assert.deepEqual(hints({ chat: ANSWERED, input: 'Um texto', area: 'Direito', tips }), FIXED_HINTS);
  const empty = { ...tips, list: [] };
  assert.deepEqual(hints({ chat: ANSWERED, input: 'Um texto', area: 'Economia', tips: empty }), FIXED_HINTS);
});

const STARTER_HINTS = ['Me introduza ao assunto', 'O que são hardware e software?', 'Como a internet funciona?'];

test('slashHints: só "/" mostra todas as sugestões, na ordem', () => {
  assert.deepEqual(slashHints(STARTER_HINTS, '/'), STARTER_HINTS);
});

test('slashHints: filtra pelo que vem depois da barra, sem ligar para maiúsculas e acentos', () => {
  assert.deepEqual(slashHints(STARTER_HINTS, '/sao'), ['O que são hardware e software?']);
  assert.deepEqual(slashHints(STARTER_HINTS, '/INTERNET'), ['Como a internet funciona?']);
  assert.deepEqual(slashHints(STARTER_HINTS, '/introdu'), ['Me introduza ao assunto']);
  assert.deepEqual(slashHints(STARTER_HINTS, '/o'), STARTER_HINTS);
  assert.deepEqual(slashHints(['Explique a fotossíntese'], '/FOTOSSINTESE'), ['Explique a fotossíntese']);
  // Acento e cedilha digitados depois da barra, o caso de quem escreve em português.
  assert.deepEqual(slashHints(STARTER_HINTS, '/SÃO'), ['O que são hardware e software?']);
  assert.deepEqual(slashHints(['Função afim', 'Funil de vendas'], '/funç'), ['Função afim']);
});

test('slashHints: sem nenhuma sugestão que case, a lista fica vazia', () => {
  assert.deepEqual(slashHints(STARTER_HINTS, '/xyz'), []);
});

test('slashHints: texto que não começa com "/" ou que já tem espaço ou quebra de linha não abre a lista', () => {
  assert.equal(slashHints(STARTER_HINTS, ''), null);
  assert.equal(slashHints(STARTER_HINTS, 'O que é /etc?'), null);
  assert.equal(slashHints(STARTER_HINTS, ' /como'), null);
  assert.equal(slashHints(STARTER_HINTS, '/como a'), null);
  assert.equal(slashHints(STARTER_HINTS, '/como\n'), null);
});

test('hello: com nome e sem nome', () => {
  assert.equal(
    hello({ user: { name: 'Ana' }, area: 'Economia', level: 'Básico', input: '', api: true }),
    'Olá, Ana! Sou o Cérebro, seu tutor de Economia no nível Básico. Pergunte o que quiser ou escolha uma das sugestões abaixo. Se colar um texto no editor, respondo com base nele.'
  );
  assert.equal(
    hello({ user: null, area: 'Economia', level: 'Básico', input: 'Um texto', api: true }),
    'Olá! Sou o Cérebro, seu tutor de Economia no nível Básico. Pergunte o que quiser ou escolha uma das sugestões abaixo. Vou considerar o texto que está no editor.'
  );
});

test('hello: na área Escolar', () => {
  assert.equal(
    hello({ user: null, area: 'Escolar', level: 'Avançado', input: '', api: true }),
    'Olá! Sou o Cérebro, seu tutor das matérias escolares no nível Avançado. Pergunte o que quiser ou escolha uma das sugestões abaixo. Se colar um texto no editor, respondo com base nele.'
  );
});

test('hello: na demonstração', () => {
  assert.equal(
    hello({ user: { name: 'Ana' }, area: 'Tecnologia', level: 'Intermediário', input: 'Um texto', api: false }),
    'Olá, Ana! Sou o Cérebro, seu tutor de Tecnologia no nível Intermediário. Nesta demonstração eu organizo o seu texto em resumo, flashcards e quiz. As respostas a dúvidas ficam para a versão com IA.'
  );
});

test('LEVELS: os três níveis do contrato da API', () => {
  assert.deepEqual(LEVELS, ['Básico', 'Intermediário', 'Avançado']);
});

// O Node não tem localStorage: cada teste põe aqui o que estaria gravado no navegador (chave -> texto).
function browser(items) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: k => items[k] ?? null },
    configurable: true,
    writable: true,
  });
}

const GOOD = {
  title: 'Fotossíntese',
  summary: [{ concept: 'Clorofila', text: 'Absorve a luz solar.' }],
  flashcards: [{ question: 'Onde ocorre?', answer: 'Nos cloroplastos.' }],
  quiz: [
    {
      type: 'boolean',
      question: 'A água é decomposta?',
      options: ['Verdadeiro', 'Falso'],
      answer: 0,
      explanation: 'Na fase clara.',
      steps: [],
    },
    { type: 'short', question: 'Que pigmento absorve a luz?', options: [], answer: 'Clorofila', explanation: 'É ela.' },
  ],
};
// Cópia do material bom com um ponto estragado.
function broken(change) {
  const material = structuredClone(GOOD);
  change(material);
  return material;
}

test('validMaterial: aceita o material do contrato, o da demonstração e o salvo na biblioteca', () => {
  assert.equal(validMaterial(GOOD), true);
  assert.equal(validMaterial(demo(EXAMPLE)), true);
  assert.equal(validMaterial({ ...GOOD, id: 1, date: at(16), area: 'Escolar', level: 'Básico' }), true);
  assert.equal(validMaterial(broken(m => { m.summary[0].source = 'A clorofila absorve a luz solar'; })), true);
});

test('validMaterial: material antigo, com texto em branco e sem steps, continua valendo', () => {
  assert.equal(validMaterial(broken(m => { m.quiz[0].explanation = ''; })), true);
  assert.equal(validMaterial(broken(m => { m.summary[0].concept = ''; })), true);
  assert.equal(validMaterial(broken(m => { delete m.quiz[0].steps; })), true);
  assert.equal(validMaterial(broken(m => { m.quiz[0].steps = ['Passo 1', 'Passo 2']; })), true);
});

test('validMaterial: recusa o que não é material', () => {
  for (const value of [null, undefined, 'texto', 5, true, [], {}, [GOOD]]) {
    assert.equal(validMaterial(value), false, JSON.stringify(value));
  }
});

test('validMaterial: o título é texto não vazio', () => {
  for (const title of ['', '   ', 5, null, undefined]) {
    assert.equal(validMaterial({ ...GOOD, title }), false, JSON.stringify(title));
  }
});

test('validMaterial: resumo, flashcards e quiz são listas com pelo menos um item', () => {
  const { summary, ...noSummary } = GOOD;
  assert.equal(validMaterial(noSummary), false, 'material sem summary');
  for (const field of ['summary', 'flashcards', 'quiz']) {
    for (const value of [undefined, null, [], 'texto', {}, [null], ['texto']]) {
      assert.equal(validMaterial({ ...GOOD, [field]: value }), false, field + ' = ' + JSON.stringify(value));
    }
  }
});

test('validMaterial: cada item tem, no formato certo, o que a tela mostra', () => {
  const changes = [
    m => { delete m.summary[0].concept; },
    m => { m.summary[0].text = 5; },
    m => { m.summary[0].source = { quote: 'A clorofila' }; },
    m => { delete m.flashcards[0].question; },
    m => { m.flashcards[0].answer = null; },
    m => { m.quiz[0].type = 'essay'; },
    m => { delete m.quiz[0].question; },
    m => { m.quiz[0].options = 'Verdadeiro'; },
    m => { m.quiz[0].options = ['Verdadeiro', { text: 'Falso' }]; },
    m => { delete m.quiz[1].options; },
    m => { m.quiz[0].answer = true; },
    m => { m.quiz[0].answer = null; },
    m => { delete m.quiz[1].answer; },
    m => { delete m.quiz[0].explanation; },
    m => { m.quiz[0].steps = 'Passo 1'; },
    m => { m.quiz[0].steps = [{ text: 'Passo 1' }]; },
    m => { m.quiz.push(null); },
  ];
  for (const change of changes) assert.equal(validMaterial(broken(change)), false, String(change));
});

test('sameMaterial: compara o conteúdo, sem olhar id, data, área e nível', () => {
  assert.equal(sameMaterial(GOOD, structuredClone(GOOD)), true);
  assert.equal(sameMaterial(GOOD, { ...GOOD, id: 1, date: at(16), area: 'Escolar', level: 'Básico' }), true);
  assert.equal(sameMaterial(GOOD, { ...GOOD, title: 'Outro título' }), false);
  assert.equal(sameMaterial(GOOD, broken(m => { m.summary[0].text = 'Outro texto.'; })), false);
  assert.equal(sameMaterial(GOOD, broken(m => { m.flashcards.push({ question: 'E a luz?', answer: 'Solar.' }); })), false);
  assert.equal(sameMaterial(GOOD, broken(m => { m.quiz.reverse(); })), false);
});

const EVENT = { kind: 'quiz', ok: true, area: 'Economia', title: 'Inflação', date: at(16) };

test('validEvent: aceita o evento que o App grava, com ou sem título', () => {
  assert.equal(validEvent(EVENT), true);
  assert.equal(validEvent({ ...EVENT, q: 'o que e inflacao?' }), true, 'resposta de quiz com o enunciado');
  assert.equal(validEvent({ kind: 'flashcard', ok: false, area: 'Economia', date: at(15) }), true);
});

test('validEvent: recusa evento sem tipo, sem acerto booleano ou sem data válida', () => {
  const { date, ...noDate } = EVENT;
  const { ok, ...noOk } = EVENT;
  const { kind, ...noKind } = EVENT;
  const bad = [
    null, undefined, 'quiz', 5, [], {}, noDate, noOk, noKind,
    { ...EVENT, kind: '' }, { ...EVENT, kind: 5 }, { ...EVENT, ok: 'true' }, { ...EVENT, ok: 1 },
    { ...EVENT, date: 'ontem' }, { ...EVENT, date: 2026 }, { ...EVENT, date: null },
  ];
  for (const event of bad) assert.equal(validEvent(event), false, JSON.stringify(event));
});

test('readList: devolve a lista gravada, sem conferir os itens', () => {
  browser({ 'cerebro-saved': JSON.stringify([GOOD, 'outra coisa', null]) });
  assert.deepEqual(readList('saved'), [GOOD, 'outra coisa', null]);
});

test('readList: valor que não é lista, JSON quebrado ou nada gravado valem lista vazia', () => {
  for (const raw of ['{"title":"x"}', '"texto"', '5', 'true', 'null', '[{', '']) {
    browser({ 'cerebro-saved': raw });
    assert.deepEqual(readList('saved'), [], raw);
  }
  browser({});
  assert.deepEqual(readList('saved'), []);
});

test('readList: navegador que bloqueia o armazenamento vale lista vazia', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem() { throw Error('SecurityError'); } },
    configurable: true,
    writable: true,
  });
  assert.deepEqual(readList('events'), []);
  delete globalThis.localStorage;
  assert.deepEqual(readList('events'), []);
});

test('biblioteca e desempenho: da lista gravada, a tela só recebe o que passa na conferência', () => {
  const { summary, ...noSummary } = GOOD;
  const { date, ...noDate } = EVENT;
  browser({
    'cerebro-saved': JSON.stringify([GOOD, noSummary, null, { ...GOOD, title: 'Outro' }]),
    'cerebro-events': JSON.stringify([EVENT, noDate, 'outra coisa', { ...EVENT, ok: false }]),
  });
  assert.deepEqual(readList('saved').filter(validMaterial).map(m => m.title), ['Fotossíntese', 'Outro']);
  assert.deepEqual(readList('events').filter(validEvent), [EVENT, { ...EVENT, ok: false }]);
  assert.equal(readList('saved').length, 4, 'o que não passa continua gravado');
});

test('readUser: perfil com nome em texto vale; o resto é visitante', () => {
  browser({ 'cerebro-user': JSON.stringify({ name: 'Ana', area: 'Economia' }) });
  assert.deepEqual(readUser(), { name: 'Ana', area: 'Economia' });
  for (const raw of ['{"name":5}', '{"name":{}}', '{"area":"Economia"}', '"Ana"', '5', '[]', 'null', '{"name":']) {
    browser({ 'cerebro-user': raw });
    assert.equal(readUser(), null, raw);
  }
  browser({});
  assert.equal(readUser(), null);
});

const NO_DRAFT = {
  input: '', area: '', level: '', result: null, made: { key: '', kinds: [] }, chat: [], tips: NO_TIPS,
};
const DRAFT = {
  input: 'Inflação e juros',
  area: 'Economia',
  level: 'Avançado',
  result: { ...GOOD, area: 'Economia', level: 'Avançado' },
  made: { key: JSON.stringify(['Inflação e juros', 'Economia', 'Avançado']), kinds: ['resumo', 'quiz'] },
  chat: ANSWERED,
  tips: { key: JSON.stringify(['Inflação e juros', 'Economia']), list: ['E o PIB per capita?', 'Como se mede?'] },
};
// O rascunho bom com alguns campos trocados, lido como o App lê na abertura.
function draft(change) {
  browser({ 'cerebro-rascunho': JSON.stringify({ ...DRAFT, ...change }) });
  return readDraft();
}

test('readDraft: rascunho ausente ou estragado dá tudo vazio', () => {
  browser({});
  assert.deepEqual(readDraft(), NO_DRAFT);
  for (const raw of ['{"input":', 'null', '5', 'true', '"texto"', '[]', '{}']) {
    browser({ 'cerebro-rascunho': raw });
    assert.deepEqual(readDraft(), NO_DRAFT, raw);
  }
});

test('readDraft: rascunho bom volta inteiro', () => {
  assert.deepEqual(draft({}), DRAFT);
});

test('readDraft: texto do editor acima de 20.000 caracteres, ou que não é texto, volta vazio', () => {
  assert.equal(draft({ input: 'a'.repeat(20000) }).input, 'a'.repeat(20000));
  assert.equal(draft({ input: 'a'.repeat(20001) }).input, '');
  assert.equal(draft({ input: 5 }).input, '');
  assert.equal(draft({ input: null }).input, '');
  assert.equal(draft({ input: ['a'] }).input, '');
});

test('readDraft: área e nível só valem se forem da lista', () => {
  assert.equal(draft({ area: 'Medicina' }).area, '');
  assert.equal(draft({ area: 5 }).area, '');
  assert.equal(draft({ level: 'Expert' }).level, '');
  assert.equal(draft({ level: null }).level, '');
  for (const area of AREAS) assert.equal(draft({ area }).area, area);
  for (const level of LEVELS) assert.equal(draft({ level }).level, level);
});

test('readDraft: material que não passa na conferência sai, e o reaproveitamento sai junto', () => {
  const { summary, ...noSummary } = GOOD;
  const got = draft({ result: noSummary });
  assert.equal(got.result, null);
  assert.deepEqual(got.made, NO_DRAFT.made);
  assert.equal(got.input, DRAFT.input, 'o resto do rascunho fica');
  assert.deepEqual(got.chat, DRAFT.chat);
});

test('readDraft: reaproveitamento fora do formato volta vazio', () => {
  const bad = [null, 'k', { key: 5, kinds: [] }, { key: 'k' }, { key: 'k', kinds: 'resumo' }, { key: 'k', kinds: [1] }];
  for (const made of bad) assert.deepEqual(draft({ made }).made, NO_DRAFT.made, JSON.stringify(made));
});

test('readDraft: da conversa só ficam mensagens { role, text } de user ou assistant', () => {
  const chat = [
    ANSWERED[0], null, 'oi', { role: 'system', text: 'x' }, { role: 'user' }, { role: 'assistant', text: 5 },
    ANSWERED[1],
  ];
  assert.deepEqual(draft({ chat }).chat, ANSWERED);
  assert.deepEqual(draft({ chat: 'oi' }).chat, []);
  assert.deepEqual(draft({ chat: null }).chat, []);
  assert.deepEqual(draft({ chat: { 0: ANSWERED[0] } }).chat, []);
});

test('readDraft: pergunta que ficou sem resposta no fim da conversa sai', () => {
  const pending = { role: 'user', text: 'E a inflação?' };
  assert.deepEqual(draft({ chat: [...ANSWERED, pending] }).chat, ANSWERED);
  assert.deepEqual(draft({ chat: [...ANSWERED, pending, pending] }).chat, ANSWERED);
  assert.deepEqual(draft({ chat: [pending] }).chat, []);
});

test('readDraft: sugestões da IA precisam de chave em texto e lista de textos', () => {
  const bad = [null, 'x', { key: 5, list: [] }, { key: 'k' }, { key: 'k', list: 'a' }, { key: 'k', list: ['a', 1] }];
  for (const tips of bad) assert.deepEqual(draft({ tips }).tips, NO_TIPS, JSON.stringify(tips));
});

// O que esta aba guardou (sessionStorage), como browser() faz com o localStorage. Sem items, a aba fica sem
// sessionStorage, como no Node: cada teste que usa tab() termina com tab().
function tab(items) {
  if (!items) {
    delete globalThis.sessionStorage;
    return;
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: { getItem: k => items[k] ?? null },
    configurable: true,
    writable: true,
  });
}

// sessionStorage que o navegador bloqueia: ler o nome já lança erro.
function blockedTab() {
  Object.defineProperty(globalThis, 'sessionStorage', {
    get() {
      throw Error('SecurityError');
    },
    configurable: true,
  });
}

test('readDraft: o rascunho desta aba vale mais que o último que alguma aba gravou', () => {
  try {
    browser({ 'cerebro-rascunho': JSON.stringify({ ...DRAFT, input: 'Texto da outra aba' }) });
    tab({ 'cerebro-rascunho': JSON.stringify(DRAFT) });
    assert.deepEqual(readDraft(), DRAFT);
  } finally {
    tab();
  }
});

test('readDraft: aba sem rascunho, sem sessionStorage ou com ele bloqueado lê o último gravado', () => {
  const other = { ...DRAFT, input: 'Texto da outra aba' };
  browser({ 'cerebro-rascunho': JSON.stringify(other) });
  try {
    tab({});
    assert.deepEqual(readDraft(), other, 'aba nova');
    blockedTab();
    assert.deepEqual(readDraft(), other, 'sessionStorage bloqueado');
    tab();
    assert.deepEqual(readDraft(), other, 'sem sessionStorage');
  } finally {
    tab();
  }
});

test('read: com session lê o que esta aba guardou; bloqueado ou ausente, devolve o padrão', () => {
  browser({ 'cerebro-x': '"de todas as abas"' });
  try {
    tab({ 'cerebro-x': '"desta aba"' });
    assert.equal(read('x', 'padrão', true), 'desta aba');
    assert.equal(read('x', 'padrão'), 'de todas as abas');
    blockedTab();
    assert.equal(read('x', 'padrão', true), 'padrão');
    tab();
    assert.equal(read('x', 'padrão', true), 'padrão');
  } finally {
    tab();
  }
});

test('demoStorage: a demonstração lê à parte, com o prefixo cerebro-demo-, e o app com IA não vê o que ela grava', () => {
  assert.equal(storageKey('events'), 'cerebro-events');
  browser({
    'cerebro-saved': JSON.stringify([{ ...GOOD, title: 'Do app com IA' }]),
    'cerebro-user': JSON.stringify({ name: 'Ana', area: 'Economia' }),
    'cerebro-rascunho': JSON.stringify({ ...DRAFT, input: 'Texto do app com IA' }),
    'cerebro-demo-saved': JSON.stringify([GOOD]),
    'cerebro-demo-rascunho': JSON.stringify(DRAFT),
  });
  try {
    demoStorage(true);
    assert.equal(storageKey('events'), 'cerebro-demo-events');
    assert.deepEqual(readList('saved'), [GOOD]);
    assert.deepEqual(readDraft(), DRAFT);
    assert.equal(readUser(), null, 'o perfil do app com IA não aparece na demonstração');
  } finally {
    demoStorage(false);
  }
  assert.equal(storageKey('events'), 'cerebro-events');
  assert.deepEqual(readList('saved').map(m => m.title), ['Do app com IA']);
  assert.equal(readDraft().input, 'Texto do app com IA');
});

test('newId: a hora ou, se ela já foi usada, um a mais que o maior id; dois materiais no mesmo clique não repetem', () => {
  assert.equal(newId([], 1000), 1000);
  assert.equal(newId([{ id: 5 }, { id: 9 }], 1000), 1000);
  const kept = { id: newId([], 1000) };
  assert.equal(newId([kept], 1000), 1001, 'o anterior e o novo no mesmo milissegundo');
  assert.equal(newId([null, 'texto', { id: 'x' }, { id: 1.5 }, { id: 2000 }], 1000), 2001);
});

test('healthLabel: conferindo, backend desligado e IA não configurada', () => {
  assert.deepEqual(healthLabel(null), { text: 'Conferindo a IA…', tone: '' });
  assert.deepEqual(healthLabel(false), { text: 'Backend desligado', tone: 'off' });
  assert.deepEqual(
    healthLabel({ status: 'ok', ai_configured: false, provider: 'gemini', model: 'gemini-flash', calls_today: 0 }),
    { text: 'IA não configurada', tone: 'warn' }
  );
});

test('healthLabel: IA ativa mostra o modelo em uso e as chamadas de hoje', () => {
  const health = {
    status: 'ok',
    ai_configured: true,
    provider: 'gemini',
    model: 'gemini-flash-latest',
    model_in_use: 'gemini-2.5-flash',
  };
  assert.deepEqual(
    healthLabel({ ...health, calls_today: 12 }),
    { text: 'IA ativa · gemini-2.5-flash · 12 chamadas hoje', tone: 'ok' }
  );
  assert.equal(healthLabel({ ...health, calls_today: 1 }).text, 'IA ativa · gemini-2.5-flash · 1 chamada hoje');
  assert.equal(healthLabel({ ...health, calls_today: 0 }).text, 'IA ativa · gemini-2.5-flash · 0 chamadas hoje');
});

test('healthLabel: sem model_in_use vale model; sem calls_today não há contador', () => {
  assert.equal(
    healthLabel({ ai_configured: true, model: 'gemini-flash-latest', calls_today: 3 }).text,
    'IA ativa · gemini-flash-latest · 3 chamadas hoje'
  );
  assert.equal(healthLabel({ ai_configured: true, model_in_use: 'gemini-2.5' }).text, 'IA ativa · gemini-2.5');
  assert.deepEqual(healthLabel({ ai_configured: true }), { text: 'IA ativa', tone: 'ok' });
});

test('errorText: frase do backend com o código e o estado do provedor entre colchetes', () => {
  const limited = { code: 'AI_RATE_LIMITED', message: 'Muitas chamadas.', provider_status: '429', retry_after: 20 };
  assert.equal(errorText(limited, 429), 'Muitas chamadas. [AI_RATE_LIMITED · 429]');
  assert.equal(
    errorText({ code: 'INVALID_INPUT', message: 'O texto está curto demais.', provider_status: '' }, 422),
    'O texto está curto demais. [INVALID_INPUT]'
  );
  assert.equal(errorText('Serviço fora do ar', 503), 'Serviço fora do ar');
});

test('errorText: detail em lista (formato antigo) vira uma frase em português', () => {
  const old = [{ type: 'string_too_short', loc: ['body', 'content'], msg: 'String should have at least 3 characters' }];
  assert.equal(errorText(old, 422), 'Pedido recusado: confira o texto e tente de novo.');
});

test('errorText: sem frase do backend, diz o código HTTP', () => {
  assert.equal(errorText(undefined, 500), 'Falha no backend (HTTP 500).');
  assert.equal(errorText(null, 502), 'Falha no backend (HTTP 502).');
  assert.equal(errorText({ code: 'AI_ERROR' }, 502), 'Falha no backend (HTTP 502). [AI_ERROR]');
});

test('dictate: soma o trecho ditado ao texto do editor e corta em 20.000 caracteres', () => {
  assert.equal(dictate('', 'olá'), 'olá');
  assert.equal(dictate('Texto', 'ditado agora'), 'Texto ditado agora');
  assert.equal(dictate('a'.repeat(19990), 'b'.repeat(50)), 'a'.repeat(19990) + ' ' + 'b'.repeat(9));
  assert.equal(dictate('a'.repeat(20000), 'mais'), 'a'.repeat(20000));
});

test('dictate: o corte não deixa meio emoji no fim', () => {
  assert.equal(dictate('a'.repeat(19997), '😀'), 'a'.repeat(19997) + ' 😀', 'emoji inteiro cabe');
  assert.equal(dictate('a'.repeat(19998), '😀 fim'), 'a'.repeat(19998) + ' ', 'emoji cortado ao meio sai inteiro');
});

test('dictationError: cada motivo da falha do ditado tem a sua frase', () => {
  assert.equal(dictationError('no-speech'), 'Não ouvi nada. Tente de novo.');
  assert.equal(dictationError('not-allowed'), 'Permita o uso do microfone no navegador.');
  assert.equal(dictationError('service-not-allowed'), 'Permita o uso do microfone no navegador.');
  assert.equal(dictationError('network'), 'O ditado precisa de internet.');
  for (const code of ['aborted', 'audio-capture', undefined]) {
    assert.equal(dictationError(code), 'Não foi possível ouvir. Verifique a permissão do microfone.', String(code));
  }
});

test('validMaterial: área e nível, quando existem, são texto', () => {
  assert.equal(validMaterial({ ...GOOD, area: 'Economia', level: 'Básico' }), true);
  assert.equal(validMaterial({ ...GOOD, area: null, level: undefined }), true, 'material sem área e nível continua valendo');
  for (const value of [{}, [], 5, true]) {
    assert.equal(validMaterial({ ...GOOD, area: value }), false, 'area = ' + JSON.stringify(value));
    assert.equal(validMaterial({ ...GOOD, level: value }), false, 'level = ' + JSON.stringify(value));
  }
});

const Q_SHORT = {
  type: 'short',
  question: 'Qual é a sigla da soma das riquezas?',
  options: [],
  answer: 'PIB|Produto Interno Bruto',
  explanation: 'É o PIB.',
  steps: [],
};
const Q_MULTIPLE = {
  type: 'multiple',
  question: 'Quem fixa a Selic?',
  options: ['Senado', 'STF', 'Copom'],
  answer: 2,
  explanation: 'O Copom.',
  steps: ['Passo 1'],
};
// Lista congelada, com os itens congelados: função que mexesse no que recebeu falharia aqui.
const frozen = list => Object.freeze(list.map(Object.freeze));
// Erro do caderno como o App grava: a questão, o material, a área e a data do erro.
const mistake = (q, title, day, hour) => ({
  key: mistakeKey(title, q.question), item: q, title, area: 'Economia', date: at(day, hour),
});

test('mistakeKey: o material e o enunciado, sem acentos nem maiúsculas', () => {
  assert.equal(mistakeKey('Inflação', 'O que é o PIB?'), 'inflacao|o que e o pib?');
});

test('addMistake: a questão errada entra com o material, a área e a data do erro', () => {
  assert.deepEqual(addMistake(frozen([]), Q_SHORT, 'Inflação', 'Economia', today()), [{
    key: 'inflacao|qual e a sigla da soma das riquezas?',
    item: Q_SHORT,
    title: 'Inflação',
    area: 'Economia',
    date: today().toISOString(),
  }]);
});

test('addMistake: guarda só a questão, sem a resposta da sessão nem a origem que o quiz do caderno acrescenta', () => {
  const answered = { ...Q_MULTIPLE, ok: false, given: 0, title: 'Outro', area: 'Direito' };
  assert.deepEqual(addMistake([], answered, 'Juros', 'Economia', today())[0].item, Q_MULTIPLE);
});

test('addMistake: errar de novo a mesma questão só atualiza a data, sem repetir e sem mudar de lugar', () => {
  const first = mistake(Q_SHORT, 'Inflação', 14);
  const other = mistake(Q_MULTIPLE, 'Inflação', 15);
  const list = addMistake(frozen([first, other]), Q_SHORT, 'Inflação', 'Economia', today());
  assert.deepEqual(list, [{ ...first, date: today().toISOString() }, other]);
  assert.equal(addMistake(list, Q_SHORT, 'INFLACAO', 'Economia', today()).length, 2, 'sem acento é o mesmo material');
  assert.equal(addMistake(list, Q_SHORT, 'Juros', 'Economia', today()).length, 3, 'a mesma questão em outro material');
});

test('clearMistake: acertar no mesmo dia do erro não tira a questão do caderno', () => {
  // Errou às 20h e acertou às 22h: no Brasil, em UTC já é o dia seguinte; no relógio do aluno, não.
  const list = frozen([mistake(Q_SHORT, 'Inflação', 16, 20), mistake(Q_MULTIPLE, 'Inflação', 16, 9)]);
  assert.deepEqual(clearMistake(list, list[0].key, today()), list);
  assert.deepEqual(clearMistake(list, list[1].key, today()), list);
});

test('clearMistake: acertar em outro dia tira a questão; as outras ficam', () => {
  // Errou às 23h do dia 15 e acertou à 0h30 do dia 16: no Brasil, em UTC é o mesmo dia; no relógio do aluno, não.
  const list = frozen([mistake(Q_SHORT, 'Inflação', 15, 23), mistake(Q_MULTIPLE, 'Inflação', 15, 23)]);
  assert.deepEqual(clearMistake(list, list[0].key, new Date(2026, 10, 16, 0, 30)), [list[1]]);
  assert.deepEqual(clearMistake(list, list[1].key, today()), [list[0]]);
  assert.deepEqual(clearMistake(list, 'outra|chave', today()), list);
});

test('removeMistake: tira a questão na hora, seja o erro de que dia for', () => {
  const list = frozen([mistake(Q_SHORT, 'Inflação', 16), mistake(Q_MULTIPLE, 'Inflação', 10)]);
  assert.deepEqual(removeMistake(list, list[0].key), [list[1]]);
  assert.deepEqual(removeMistake(list, list[1].key), [list[0]]);
  assert.deepEqual(removeMistake(list, 'outra|chave'), list);
});

test('caderno: item estragado na lista gravada não derruba as funções e fica onde está', () => {
  const junk = [null, 'texto', { key: 5 }];
  const added = addMistake(junk, Q_SHORT, 'Inflação', 'Economia', today());
  assert.equal(added.length, 4);
  assert.deepEqual(added.slice(0, 3), junk);
  assert.deepEqual(clearMistake(added, added[3].key, new Date(2026, 10, 17, 9)), junk);
  assert.deepEqual(removeMistake(added, added[3].key), junk);
});

test('validMistake: aceita o que addMistake grava, dos três tipos de questão e de material antigo', () => {
  for (const q of [Q_SHORT, Q_MULTIPLE, ...GOOD.quiz]) {
    const [entry] = addMistake([], q, 'Inflação', 'Economia', today());
    assert.equal(validMistake(entry), true, q.question);
    assert.equal(validMistake(JSON.parse(JSON.stringify(entry))), true, 'gravado e lido: ' + q.question);
  }
});

test('validMistake: recusa o que a tela não tem como desenhar nem tirar do caderno', () => {
  const good = mistake(Q_SHORT, 'Inflação', 16);
  assert.equal(validMistake(good), true);
  const bad = [
    null, undefined, 'texto', 5, [], {},
    { ...good, item: null },
    { ...good, item: { ...Q_SHORT, type: 'essay' } },
    { ...good, item: { ...Q_SHORT, options: 'PIB' } },
    { ...good, item: { ...Q_SHORT, explanation: undefined } },
    { ...good, title: ' ', key: mistakeKey(' ', Q_SHORT.question) },
    { ...good, title: 5, key: mistakeKey(5, Q_SHORT.question) },
    { ...good, area: undefined },
    { ...good, area: {} },
    { ...good, date: 'ontem' },
    { ...good, date: undefined },
    { ...good, key: 'outra|chave' },
    { ...good, key: undefined },
  ];
  for (const entry of bad) assert.equal(validMistake(entry), false, JSON.stringify(entry));
});

test('byMaterial: os erros agrupados por material, na ordem em que cada material apareceu', () => {
  const a = mistake(Q_SHORT, 'Inflação', 16);
  const b = mistake(Q_MULTIPLE, 'Juros', 16);
  const c = mistake(Q_MULTIPLE, 'Inflação', 15);
  assert.deepEqual(byMaterial(frozen([a, b, c])), [['Inflação', [a, c]], ['Juros', [b]]]);
  assert.deepEqual(byMaterial([]), []);
});

test('whyQuestion: quem errou conta o que respondeu; a opção marcada vai em texto', () => {
  assert.equal(
    whyQuestion(Q_MULTIPLE, 0, false),
    'Não entendi esta questão: "Quem fixa a Selic?". Respondi "Senado". A resposta certa é "Copom". Explique de outro jeito, em passos curtos, por que essa é a resposta.'
  );
  assert.equal(
    whyQuestion(Q_SHORT, ' produto bruto ', false),
    'Não entendi esta questão: "Qual é a sigla da soma das riquezas?". Respondi "produto bruto". A resposta certa é "PIB ou Produto Interno Bruto". Explique de outro jeito, em passos curtos, por que essa é a resposta.'
  );
});

test('whyQuestion: no verdadeiro ou falso a resposta dada também vai em texto', () => {
  assert.equal(
    whyQuestion(GOOD.quiz[0], 1, false),
    'Não entendi esta questão: "A água é decomposta?". Respondi "Falso". A resposta certa é "Verdadeiro". Explique de outro jeito, em passos curtos, por que essa é a resposta.'
  );
});

test('whyQuestion: quem acertou não cita a resposta dada', () => {
  assert.equal(
    whyQuestion(Q_MULTIPLE, 2, true),
    'Não entendi esta questão: "Quem fixa a Selic?". A resposta certa é "Copom". Explique de outro jeito, em passos curtos, por que essa é a resposta.'
  );
});

test('whyQuestion: resposta digitada longa demais entra cortada em 500 caracteres', () => {
  const asked = whyQuestion(Q_SHORT, 'a'.repeat(700), false);
  assert.ok(asked.includes('Respondi "' + 'a'.repeat(500) + '". '));
  assert.equal(asked.length, whyQuestion(Q_SHORT, '', false).length + 500);
});

test('whyTopic: pede outra explicação do tópico', () => {
  assert.equal(whyTopic('Clorofila'), 'Explique de outro jeito este tópico: "Clorofila".');
});

test('gradeRequest: enunciado, gabarito com as formas separadas por "|", resposta, área e nível', () => {
  assert.deepEqual(gradeRequest(Q_SHORT, ' produto bruto ', 'Economia', 'Básico'), {
    question: 'Qual é a sigla da soma das riquezas?',
    expected: 'PIB|Produto Interno Bruto',
    answer: 'produto bruto',
    area: 'Economia',
    level: 'Básico',
  });
});

test('gradeRequest: corta os textos nos limites do backend (500, 200 e 500) sem deixar meio emoji', () => {
  const long = { ...Q_SHORT, question: 'q'.repeat(600), answer: 'g'.repeat(300) };
  const sent = gradeRequest(long, 'r'.repeat(499) + '😀😀', 'Direito', 'Avançado');
  assert.equal(sent.question, 'q'.repeat(500));
  assert.equal(sent.expected, 'g'.repeat(200));
  assert.equal(sent.answer, 'r'.repeat(499) + '😀');
  assert.equal([...sent.answer].length, 500, 'o backend conta caracteres, não unidades UTF-16');
});

test('fixLastQuizEvent: a última resposta de quiz da questão vira acerto; as outras não mudam', () => {
  const events = frozen([
    quizAt(16, 1, false, { date: at(16, 9) }), // a mesma questão, errada de manhã
    quizAt(16, 2, false), // outra questão
    quizAt(16, 1, false, { title: 'Juros' }), // outro material
    quizAt(16, 1, false, { date: at(16, 20) }), // a resposta que a IA reviu
    cardAt(16, false, { q: 'questao 1' }), // cartão não é quiz
  ]);
  assert.deepEqual(
    fixLastQuizEvent(events, 'Inflação', 'questao 1'),
    events.map((e, i) => (i === 3 ? { ...e, ok: true } : e))
  );
});

test('fixLastQuizEvent: sem resposta gravada para a questão, a lista volta igual; item estragado não derruba', () => {
  const events = [null, 'texto', quizAt(16, 1, false)];
  assert.deepEqual(fixLastQuizEvent(events, 'Inflação', 'questao 9'), events);
  assert.deepEqual(fixLastQuizEvent(events, 'Juros', 'questao 1'), events);
  assert.deepEqual(fixLastQuizEvent([], 'Inflação', 'questao 1'), []);
  assert.deepEqual(fixLastQuizEvent(events, 'Inflação', 'questao 1'), [null, 'texto', quizAt(16, 1, true)]);
});

test('fixLastQuizEvent: resposta gravada depois do pedido de revisão não é a que a IA viu', () => {
  // Errou às 9h e pediu a revisão às 10h; sem esperar, refez a questão e errou de novo às 11h.
  const events = frozen([quizAt(16, 1, false, { date: at(16, 9) }), quizAt(16, 1, false, { date: at(16, 11) })]);
  assert.deepEqual(fixLastQuizEvent(events, 'Inflação', 'questao 1', at(16, 10)), [{ ...events[0], ok: true }, events[1]]);
  assert.deepEqual(fixLastQuizEvent(events, 'Inflação', 'questao 1', at(16, 11)), [events[0], { ...events[1], ok: true }]);
  assert.deepEqual(fixLastQuizEvent(events, 'Inflação', 'questao 1', at(16, 8)), events, 'nenhuma resposta antes do pedido');
});

test('removeMistake: na revisão, o erro gravado depois do pedido fica no caderno', () => {
  const list = frozen([mistake(Q_SHORT, 'Inflação', 16, 11), mistake(Q_MULTIPLE, 'Inflação', 16, 9)]);
  assert.deepEqual(removeMistake(list, list[0].key, at(16, 10)), list, 'errou de novo às 11h, depois do pedido das 10h');
  assert.deepEqual(removeMistake(list, list[0].key, at(16, 11)), [list[1]]);
  assert.deepEqual(removeMistake(list, list[1].key, at(16, 10)), [list[0]]);
});

test('fixLastQuizEvent: depois da revisão, o desempenho conta a resposta como acerto', () => {
  const events = fixLastQuizEvent([quizAt(16, 1, false), quizAt(16, 2, true)], 'Inflação', 'questao 1');
  assert.deepEqual(quizRate(events), { total: 2, correct: 2, rate: 100 });
});

// Arquivo de backup como o App exporta.
const BACKUP = {
  versao: 1,
  saved: [{ ...GOOD, id: 1, date: at(10), area: 'Escolar', level: 'Básico' }],
  events: [quizAt(15, 1, false), cardAt(16, true)],
  erros: [mistake(Q_SHORT, 'Inflação', 15)],
  user: { name: 'Ana', area: 'Economia' },
};
// O arquivo lido de novo a cada teste, para um teste não mexer no que o outro usa.
const backup = () => readBackup(JSON.stringify(BACKUP));
const EMPTY = { saved: [], events: [], erros: [] };
// Nada ficou de fora do arquivo.
const NONE = { saved: 0, events: 0, erros: 0 };

test('readBackup: arquivo bom devolve as três listas, nada de fora e o perfil', () => {
  assert.deepEqual(backup(), {
    saved: BACKUP.saved, events: BACKUP.events, erros: BACKUP.erros, fora: NONE, user: { name: 'Ana', area: 'Economia' },
  });
});

test('readBackup: material sem summary fica de fora e é contado; o resto do arquivo entra', () => {
  const { summary, ...noSummary } = BACKUP.saved[0];
  const got = readBackup(JSON.stringify({ ...BACKUP, saved: [noSummary, ...BACKUP.saved, null, 'texto'] }));
  assert.deepEqual(got, { ...backup(), fora: { ...NONE, saved: 3 } });
});

test('readBackup: material sem data válida ou com área estragada, resposta e erro fora do formato ficam de fora', () => {
  const { date, ...noDate } = BACKUP.saved[0];
  const got = readBackup(JSON.stringify({
    versao: 1,
    saved: [noDate, { ...BACKUP.saved[0], date: 'ontem' }, { ...BACKUP.saved[0], area: { nome: 'x' } }],
    events: [{ ...BACKUP.events[0], ok: 'sim' }, BACKUP.events[1], { kind: 'quiz' }],
    erros: [{ ...BACKUP.erros[0], key: 'outra|chave' }, { ...BACKUP.erros[0], item: { type: 'short' } }, BACKUP.erros[0]],
  }));
  assert.deepEqual(got, {
    saved: [], events: [BACKUP.events[1]], erros: BACKUP.erros, fora: { saved: 3, events: 2, erros: 2 }, user: null,
  });
});

test('readBackup: o perfil só vale com nome de 1 a 50 caracteres e área da lista; dele só entram o nome e a área', () => {
  const user = value => readBackup(JSON.stringify({ ...BACKUP, user: value })).user;
  assert.deepEqual(user({ name: '  Bia  ', area: 'Direito', admin: true }), { name: 'Bia', area: 'Direito' });
  assert.deepEqual(user({ name: 'a'.repeat(50), area: 'Escolar' }), { name: 'a'.repeat(50), area: 'Escolar' });
  const bad = [
    null, 'Ana', 5, [], { area: 'Economia' }, { name: '', area: 'Economia' }, { name: '   ', area: 'Economia' },
    { name: 'a'.repeat(51), area: 'Economia' }, { name: 5, area: 'Economia' }, { name: 'Ana' },
    { name: 'Ana', area: 'Medicina' },
  ];
  for (const value of bad) assert.equal(user(value), null, JSON.stringify(value));
});

test('readBackup: texto que não é JSON, JSON que é lista e objeto sem versao 1 não são backup', () => {
  const notBackup = [
    '', 'não é JSON', '{"versao":1', JSON.stringify([BACKUP]), '[]', 'null', '5', '"texto"', 'true', '{}',
    '{"versao":2}', '{"versao":"1"}',
  ];
  for (const text of notBackup) assert.equal(readBackup(text), null, text);
});

test('readBackup: lista ausente ou fora do formato vale lista vazia, sem nada contado de fora', () => {
  const none = { ...EMPTY, fora: NONE, user: null };
  assert.deepEqual(readBackup('{"versao":1}'), none);
  assert.deepEqual(readBackup('{"versao":1,"saved":{},"events":"x","erros":5}'), none);
});

test('mergeBackup: num navegador vazio, entra tudo o que o arquivo trouxe', () => {
  const { saved, events, erros } = backup();
  assert.deepEqual(mergeBackup(EMPTY, backup()), { saved, events, erros });
});

test('mergeBackup: importar duas vezes o mesmo arquivo não duplica', () => {
  const once = mergeBackup(EMPTY, backup());
  assert.deepEqual(mergeBackup(once, backup()), once);
  const current = {
    saved: [{ ...GOOD, title: 'Outro', id: 7, date: at(12) }],
    events: [quizAt(14, 3, true)],
    erros: [mistake(Q_MULTIPLE, 'Juros', 14)],
  };
  const merged = mergeBackup(current, backup());
  assert.deepEqual([merged.saved.length, merged.events.length, merged.erros.length], [2, 3, 2]);
  assert.deepEqual(mergeBackup(merged, backup()), merged);
});

test('mergeBackup: material com o mesmo título e a mesma data não entra de novo; com id já usado ganha id novo', () => {
  const mine = { ...GOOD, title: 'Meu material', id: 1, date: at(12) }; // o mesmo id do material do arquivo
  const merged = mergeBackup({ ...EMPTY, saved: [mine] }, backup());
  assert.deepEqual(merged.saved, [{ ...BACKUP.saved[0], id: 2 }, mine], 'o que entra fica no topo da biblioteca');
  const same = { ...BACKUP.saved[0], id: 99 }; // o do arquivo, importado antes e já com outro id
  assert.deepEqual(mergeBackup({ ...EMPTY, saved: [same] }, backup()).saved, [same]);
  const otherDay = { ...BACKUP.saved[0], id: 99, date: at(11) }; // o mesmo título salvo em outra data é outro material
  assert.equal(mergeBackup({ ...EMPTY, saved: [otherDay] }, backup()).saved.length, 2);
});

test('mergeBackup: materiais do arquivo com o mesmo id, ou sem id, ficam com ids diferentes', () => {
  const a = { ...BACKUP.saved[0], title: 'A', id: 5 };
  const b = { ...BACKUP.saved[0], title: 'B', id: 5 };
  const { id, ...c } = { ...BACKUP.saved[0], title: 'C' };
  const d = { ...BACKUP.saved[0], title: 'D', id: 'cinco' };
  assert.deepEqual(mergeBackup(EMPTY, { ...EMPTY, saved: [a, b, c, d, a] }).saved.map(m => [m.title, m.id]), [
    ['A', 5], ['B', 6], ['C', 7], ['D', 8],
  ]);
});

test('mergeBackup: resposta igual (tipo, data, material e enunciado) não repete, e a lista fica em ordem de data', () => {
  const current = { ...EMPTY, events: [quizAt(14, 1, true), quizAt(16, 1, false)] };
  const early = cardAt(15, true, { date: at(15, 9) });
  const file = { ...EMPTY, events: [quizAt(16, 1, false), quizAt(15, 1, false), quizAt(15, 1, false), early] };
  assert.deepEqual(
    mergeBackup(current, file).events,
    [quizAt(14, 1, true), early, quizAt(15, 1, false), quizAt(16, 1, false)]
  );
  // A resposta que este navegador já corrigiu (revisão da IA) não volta a ser erro por causa do arquivo.
  const fixed = { ...EMPTY, events: [quizAt(16, 1, true)] };
  assert.deepEqual(mergeBackup(fixed, { ...EMPTY, events: [quizAt(16, 1, false)] }).events, fixed.events);
});

test('mergeBackup: basta um dos quatro campos mudar para a resposta ser outra', () => {
  const base = quizAt(16, 1, false);
  const others = [
    { ...base, kind: 'flashcard' }, { ...base, date: at(16, 13) }, { ...base, title: 'Juros' }, { ...base, q: 'questao 2' },
  ];
  assert.equal(mergeBackup({ ...EMPTY, events: [base] }, { ...EMPTY, events: others }).events.length, 5);
});

test('mergeBackup: item estragado no meio das respostas gravadas não bagunça a ordem de data', () => {
  const current = { ...EMPTY, events: [quizAt(16, 1, false), 'texto'] };
  const file = { ...EMPTY, events: [quizAt(15, 1, false)] };
  assert.deepEqual(mergeBackup(current, file).events, ['texto', quizAt(15, 1, false), quizAt(16, 1, false)]);
});

test('mergeBackup: erro com a mesma chave fica com a data mais recente', () => {
  const older = mistake(Q_SHORT, 'Inflação', 14);
  const newer = mistake(Q_SHORT, 'Inflação', 16);
  const other = mistake(Q_MULTIPLE, 'Juros', 15);
  assert.deepEqual(mergeBackup({ ...EMPTY, erros: [older] }, { ...EMPTY, erros: [newer, other] }).erros, [newer, other]);
  assert.deepEqual(mergeBackup({ ...EMPTY, erros: [newer, other] }, { ...EMPTY, erros: [older] }).erros, [newer, other]);
});

test('mergeBackup: o que a tela ignora continua gravado, e nada do que entra na função é alterado', () => {
  const current = Object.freeze({
    saved: frozen([null, 'texto']), events: frozen(['texto', { kind: 'quiz' }]), erros: frozen([null, { key: 5 }]),
  });
  const file = Object.freeze({
    saved: frozen(backup().saved), events: frozen(backup().events), erros: frozen(backup().erros),
  });
  assert.deepEqual(mergeBackup(current, file), {
    saved: [...BACKUP.saved, null, 'texto'],
    events: ['texto', { kind: 'quiz' }, ...BACKUP.events],
    erros: [null, { key: 5 }, ...BACKUP.erros],
  });
});

test('backupNote: quantos materiais entraram; só respostas ou erros; nada novo', () => {
  assert.equal(backupNote(EMPTY, mergeBackup(EMPTY, backup())), '1 material importado');
  const current = { ...EMPTY, saved: [{ ...GOOD, title: 'Outro', id: 7, date: at(12) }] };
  const two = { ...EMPTY, saved: [...BACKUP.saved, { ...BACKUP.saved[0], title: 'Segundo' }] };
  assert.equal(backupNote(current, mergeBackup(current, two)), '2 materiais importados');
  const once = mergeBackup(current, backup());
  assert.equal(backupNote(once, mergeBackup(once, backup())), 'Nada novo neste arquivo');
  const moreAnswers = { ...backup(), events: [...BACKUP.events, quizAt(16, 9, true)] };
  assert.equal(backupNote(once, mergeBackup(once, moreAnswers)), 'Desempenho e caderno de erros atualizados');
  const newerMistake = { ...backup(), erros: [mistake(Q_SHORT, 'Inflação', 16)] };
  assert.equal(backupNote(once, mergeBackup(once, newerMistake)), 'Desempenho e caderno de erros atualizados');
});

test('backupNote: o que ficou de fora e o perfil que entrou vêm depois, e então cada frase termina com ponto', () => {
  const junto = mergeBackup(EMPTY, backup());
  assert.equal(backupNote(EMPTY, junto, NONE), '1 material importado', 'nada de fora: a frase de sempre');
  assert.equal(
    backupNote(EMPTY, junto, { ...NONE, saved: 2 }),
    '1 material importado. Ficaram de fora, por estarem incompletos: 2 materiais.'
  );
  assert.equal(
    backupNote(EMPTY, junto, { saved: 1, events: 1, erros: 3 }, 'Bia'),
    '1 material importado. Ficaram de fora, por estarem incompletos: 1 material, 1 resposta e 3 questões do ' +
      'caderno de erros. Perfil de Bia importado.'
  );
  assert.equal(
    backupNote(junto, junto, { ...NONE, events: 2, erros: 1 }),
    'Nada novo neste arquivo. Ficaram de fora, por estarem incompletos: 2 respostas e 1 questão do caderno de erros.'
  );
  assert.equal(backupNote(junto, junto, NONE, 'Bia'), 'Nada novo neste arquivo. Perfil de Bia importado.');
});

test('backupSummary: o que foi no arquivo, no singular e no plural, contado como a tela mostra', () => {
  const one = { saved: BACKUP.saved, events: [BACKUP.events[0]], erros: BACKUP.erros };
  assert.equal(backupSummary(one), 'Backup gerado: 1 material, 1 resposta e 1 questão do caderno de erros.');
  assert.equal(backupSummary(EMPTY), 'Backup gerado: 0 materiais, 0 respostas e 0 questões do caderno de erros.');
  const two = {
    saved: [...BACKUP.saved, { ...BACKUP.saved[0], id: 2 }, null],
    events: [...BACKUP.events, { kind: 'quiz' }],
    erros: [...BACKUP.erros, mistake(Q_MULTIPLE, 'Juros', 14), 'texto'],
  };
  assert.equal(backupSummary(two), 'Backup gerado: 2 materiais, 2 respostas e 2 questões do caderno de erros.');
});

// A linha do backup com "agora" em 16/11/2026 às 22h, como today().
const backupLine = (saved, events, last, now = today()) => backupStatus({ saved, events, last, now });
const datedOn = days => days.map(day => ({ date: at(day) }));

test('backupStatus: sem material nem resposta não lembra', () => {
  assert.deepEqual(backupLine([], [], null), { text: 'Você ainda não fez backup', due: false });
  assert.deepEqual(backupLine([], [], at(1)), { text: 'Último backup: há 15 dias', due: false });
});

test('backupStatus: sem backup, lembra com 5 materiais ou com o registro mais antigo de 7 dias ou mais', () => {
  assert.deepEqual(backupLine(datedOn([16]), [], null), { text: 'Você ainda não fez backup', due: false });
  assert.equal(backupLine(datedOn([16, 16, 16, 16, 16]), [], null).due, true, '5 materiais de hoje');
  assert.equal(backupLine([], datedOn([8]), null).due, true, 'resposta de 8 dias atrás');
  assert.equal(backupLine([], datedOn([10, 16]), null).due, false, 'a mais antiga é de 6 dias atrás');
  assert.equal(backupLine([{}, {}, {}, {}, { date: 'ontem' }], [], null).due, false, 'sem data não conta como novo');
});

test('backupStatus: com backup, só conta o que veio depois dele', () => {
  assert.equal(backupLine(datedOn([14, 14, 15, 16, 16]), [], at(13)).due, true, '5 materiais depois do backup');
  assert.equal(backupLine(datedOn([12, 14, 15, 16, 16]), [], at(13)).due, false, 'só 4 depois do backup');
  assert.equal(backupLine([], datedOn([12]), at(6)).due, true, 'backup de 10 dias atrás e uma resposta depois');
  assert.equal(backupLine([], [{ date: at(9, 13) }], at(9, 10)).due, true, '7 dias e uma resposta depois');
  assert.equal(backupLine([], [{ date: at(10, 13) }], at(10, 10)).due, false, '6 dias e uma resposta depois');
  assert.equal(backupLine(datedOn([5]), datedOn([2, 5]), at(6)).due, false, 'backup de 10 dias atrás e nada depois');
});

test('backupStatus: os dias contam pelo calendário, não por 24 horas', () => {
  assert.equal(backupLine([], [], at(16, 8)).text, 'Último backup: hoje');
  assert.equal(backupLine([], [], at(15)).text, 'Último backup: há 1 dia');
  assert.equal(backupLine([], [], at(4)).text, 'Último backup: há 12 dias');
  assert.equal(
    backupLine([], [], at(15, 23), new Date(2026, 10, 16, 1)).text,
    'Último backup: há 1 dia',
    'backup ontem às 23h, conferido à 1h'
  );
});

test('backupStatus: data do backup inválida vale como nunca', () => {
  for (const last of ['ontem', 5, null, undefined, {}, '']) {
    assert.deepEqual(backupLine([], datedOn([8]), last), { text: 'Você ainda não fez backup', due: true }, String(last));
  }
});
