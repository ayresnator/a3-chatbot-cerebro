// Testes da lógica pura do Cérebro (src/lib.js e src/exemplos.js), com o executor que já vem no Node: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AREAS, LEVELS, STARTERS, EXAMPLE, localDay, fold, norm, demo, fitsAbove,
  shortAnswerOk, expectedText, streak, firstAttempts, quizRate, cardRate, weakSpot, chartDays, spokenDay, lastDays,
  areaLine, deckStart, deckRight, deckWrong, deckLater, deckMissed, deckRedo, deckSummary, matches, hints, slashHints, hello,
  chatSubject, capText,
  validMaterial, sameMaterial, validEvent, readList, readUser, readDraft, healthLabel, capReached, errorText, ERRORS, FAILS,
  rateAtCap, pauseNotice, dictate,
  dictationError, mistakeKey, addMistake, clearMistake, removeMistake, validMistake, byMaterial, whyQuestion, whyTopic,
  gradeRequest, explainRequest, fixLastQuizEvent, readBackup, mergeBackup, backupNote, compactEvents,
  typeDelay, rove, askKey, LEVEL_NOTES, AI_NOTE, inText, originNote, markExample, sourceLabel, findSource, markPieces,
  textOrigin,
  pretestCards, readSkips, pretestOpens, recallStart, recallLine, nextSkips, markRecall, shownMarks,
  libraryCount, read, storageKey, demoStorage, newId, backupStatus, backupSummary, deckRestart, plural,
  addDays, validCardReview, scheduleCard, dueCards, dayCards, stepOf, dueOf, dueMistakes, dayMistakes, backOn,
  examPool, mockExam, examScore, examLine,
} from '../src/lib.js';
import { EXAMPLES, pickExample, opener, openers } from '../src/exemplos.js';

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

test('addDays: soma dias do calendário, atravessa o mês, o ano e o fevereiro; n negativo volta', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-11-16', 16), '2026-12-02');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29', 'ano bissexto');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(addDays('2026-11-16', 0), '2026-11-16');
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

test('firstAttempts: a mesma lista devolve o resultado guardado; outra lista tem a conta dela', () => {
  const events = [...SIX_ANSWERS, ...redo(16)];
  const first = firstAttempts(events);
  assert.equal(firstAttempts(events), first, 'a mesma lista, o mesmo resultado');
  const more = [...events, quizAt(16, 7, true)];
  assert.deepEqual(firstAttempts(more), [...SIX_ANSWERS, more.at(-1)], 'a lista com uma resposta a mais');
  assert.deepEqual(firstAttempts(events), SIX_ANSWERS);
});

test('firstAttempts: a mesma lista pedida para o quiz e para os cartões guarda um resultado para cada tipo', () => {
  // Cartão com a pergunta (q): o 1 errado volta no fim da fila e é acertado; vale a primeira avaliação do dia.
  const cards = [[1, false], [2, true], [1, true]].map(([n, ok]) => cardAt(16, ok, { q: 'cartao ' + n }));
  const events = [...cards, ...SIX_ANSWERS, ...redo(16)];
  assert.deepEqual(firstAttempts(events, 'flashcard'), cards.slice(0, 2));
  assert.deepEqual(firstAttempts(events), SIX_ANSWERS, 'depois dos cartões, o quiz da mesma lista');
  assert.deepEqual(firstAttempts(events, 'flashcard'), cards.slice(0, 2), 'e os cartões de novo');
  const other = [...events];
  assert.deepEqual(firstAttempts(other), SIX_ANSWERS, 'na ordem contrária, outra lista');
  assert.deepEqual(firstAttempts(other, 'flashcard'), cards.slice(0, 2));
});

test('localDay: a mesma data em texto dá o mesmo dia na primeira e na segunda vez, e Date continua valendo', () => {
  const late = at(16, 23); // 23h: no Brasil, em UTC já é dia 17
  assert.equal(localDay(late), '2026-11-16');
  assert.equal(localDay(late), '2026-11-16');
  assert.equal(localDay(new Date(late)), '2026-11-16');
  assert.equal(localDay(new Date(2026, 10, 17, 0, 0)), '2026-11-17');
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

// O caso da auditoria nos cartões: um baralho de 4, com o cartão 1 errado (ele volta no fim da fila e é acertado), e
// depois "Revisar novamente" no mesmo dia. Contando cliques, davam 9 cartões revisados.
const DECK = [[1, false], [2, true], [3, true], [4, true], [1, true], [1, true], [2, true], [3, true], [4, true]]
  .map(([n, ok]) => cardAt(16, ok, { q: 'cartao ' + n }));

test('cardRate: de cada cartão vale a primeira avaliação do dia; rever o baralho não muda o número', () => {
  assert.deepEqual(cardRate(DECK), { total: 4, correct: 3, rate: 75 });
  assert.deepEqual(firstAttempts(DECK, 'flashcard'), DECK.slice(0, 4));
  assert.deepEqual(firstAttempts(DECK), [], 'sem o tipo, só o quiz');
});

test('cardRate: no dia seguinte o cartão conta de novo; em outro material é outro cartão', () => {
  const next = cardAt(17, true, { q: 'cartao 1' });
  const other = cardAt(16, true, { q: 'cartao 1', title: 'Juros' });
  assert.deepEqual(cardRate([...DECK, next, other]), { total: 6, correct: 5, rate: 83 });
});

test('cardRate: registro antigo, sem a pergunta do cartão, conta como está', () => {
  const old = cardAt(16, false);
  assert.deepEqual(cardRate([old, old, { ...old, ok: true }, ...DECK]), { total: 7, correct: 4, rate: 57 });
});

test('plural: o singular só com 1; com 0 e com 2, o plural', () => {
  assert.equal(plural(1, 'cartão', 'cartões'), 'cartão');
  assert.equal(plural(0, 'cartão', 'cartões'), 'cartões');
  assert.equal(plural(2, 'questão respondida', 'questões respondidas'), 'questões respondidas');
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

test('areaLine: o cartão avaliado de novo no mesmo dia conta uma vez', () => {
  assert.equal(areaLine(DECK, 'Economia'), 'Quiz sem respostas · 4 cartões');
  const twice = [cardAt(16, false, { q: 'cartao 1' }), cardAt(16, true, { q: 'cartao 1' })];
  assert.equal(areaLine(twice, 'Economia'), 'Quiz sem respostas · 1 cartão');
});

// Histórico com repetições, como o App grava, com "hoje" em 16/11 às 22h. OLD é a resposta antiga, sem o enunciado.
const OLD = (({ q, ...e }) => e)(quizAt(14, 9, false));
const BROKEN = { kind: 'quiz', ok: 'sim', date: 'ontem' };
const HISTORY = [
  // Dia 14: a questão 1 errada, refeita errada, acertada e acertada de novo; a 2 certa e refeita errada.
  quizAt(14, 1, false, { date: at(14, 9) }), quizAt(14, 1, false, { date: at(14, 10) }),
  quizAt(14, 1, true, { date: at(14, 11) }), quizAt(14, 1, true, { date: at(14, 12) }),
  quizAt(14, 2, true, { date: at(14, 9) }), quizAt(14, 2, false, { date: at(14, 10) }),
  OLD, OLD, BROKEN, cardAt(14, true), cardAt(14, true), cardAt(14, false),
  // Dia 15: a questão 1 de novo (outro dia, conta de novo), a 1 de outro material e a 3, refeita às 23h, quando em UTC
  // já é dia 16.
  quizAt(15, 1, true), quizAt(15, 1, true, { date: at(15, 13) }),
  quizAt(15, 1, false, { title: 'Juros', area: 'Direito' }), quizAt(15, 1, false, { title: 'Juros', area: 'Direito', date: at(15, 13) }),
  quizAt(15, 3, false, { date: at(15, 22) }), quizAt(15, 3, true, { date: at(15, 23) }), quizAt(15, 3, false, { date: at(15, 23) }),
  // O cartão com a pergunta (q), errado e acertado na volta: a tela conta a primeira avaliação do dia, e as duas ficam.
  cardAt(15, false, { q: 'cartao 1' }), cardAt(15, true, { q: 'cartao 1', date: at(15, 13) }),
  // Hoje: tudo fica, até as repetições.
  ...SIX_ANSWERS, ...redo(16), ...redo(16), cardAt(16, true),
];
// O que a tela mostra do histórico e o que a revisão espaçada e o acerto que ficou vão usar: a primeira resposta de cada
// questão em cada dia e os dias com acerto de cada questão.
const shown = list => {
  const ok = list.filter(validEvent);
  return {
    quiz: quizRate(ok), cards: cardRate(ok), streak: streak(ok, today()), last: lastDays(ok, 5, today()),
    weak: weakSpot(ok, today()), chart: ['Todas', 'Direito'].map(area => chartDays(ok, area, today())),
    lines: AREAS.map(area => areaLine(ok, area)),
    firsts: firstAttempts(ok).map(e => [localDay(e.date), e.title, e.q, e.ok]),
    hits: [...new Set(ok.filter(e => e.kind === 'quiz' && e.ok && e.q).map(e => [localDay(e.date), e.title, e.q].join('|')))].sort(),
  };
};

test('compactEvents: nos dias passados fica a primeira resposta de cada questão e, se foi erro, o primeiro acerto', () => {
  const compact = compactEvents(HISTORY, today());
  // Saem: a questão 1 refeita errada e acertada de novo e a 2 refeita no dia 14; a 1 acertada de novo, a de Juros
  // refeita e a 3 errada depois do acerto no dia 15. Os cartões, a resposta sem enunciado, o item estragado e hoje ficam.
  assert.deepEqual(HISTORY.filter(e => !compact.includes(e)), [1, 3, 5, 13, 15, 18].map(i => HISTORY[i]));
  assert.deepEqual(compact.filter(e => e.q === 'cartao 1').map(e => e.ok), [false, true], 'o cartão refeito fica inteiro');
  assert.deepEqual(firstAttempts(compact, 'flashcard').filter(e => e.q).map(e => e.ok), [false], 'e conta uma vez');
  assert.deepEqual(compactEvents(compact, today()), compact, 'compactar de novo não muda nada');
});

test('compactEvents: os números da tela, a primeira resposta e os acertos de cada questão em cada dia não mudam', () => {
  assert.deepEqual(shown(compactEvents(HISTORY, today())), shown(HISTORY));
});

test('compactEvents: importar um backup com as repetições de dias passados não faz a lista compactada crescer', () => {
  const stored = compactEvents(HISTORY, today());
  const merged = mergeBackup(
    { saved: [], events: stored, erros: [], cartoes: [] }, { saved: [], events: HISTORY, erros: [], cartoes: [] }
  );
  assert.ok(merged.events.length > stored.length, 'o backup traz as repetições de volta');
  assert.equal(compactEvents(merged.events, today()).length, stored.length);
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

test('deckRestart: a sessão desde o início, com os cartões dela na ordem e sem as voltas por erro', () => {
  assert.deepEqual(deckRestart(deck([0, 2, 0, 1], 2)), deckStart(3), 'baralho inteiro, com um erro e um "Revisar depois"');
  assert.deepEqual(deckRestart(deck([2, 0, 2], 1)), { queue: [0, 2], pos: 0 }, '"Refazer só os que errei": só esses');
});

// Revisão espaçada dos cartões, com "hoje" em 16/11/2026 às 22h (today). Dois materiais como a biblioteca guarda.
const INFLACAO = {
  title: 'Inflação',
  area: 'Economia',
  flashcards: [
    { question: 'O que é inflação?', answer: 'A alta geral dos preços.' },
    { question: 'Quem mede a inflação?', answer: 'O IBGE.' },
  ],
};
const JUROS = { title: 'Juros', area: 'Direito', flashcards: [{ question: 'O que é a Selic?', answer: 'A taxa básica.' }] };
// A caixa de um cartão como scheduleCard grava.
const boxOf = (title, question, box, due, date = at(10)) => ({ key: mistakeKey(title, question), title, box, due, date });
// A avaliação de um cartão do material Inflação em 16/11, às 22h.
const rate = (list, ok, question = 'O que é inflação?', now = today()) => scheduleCard(list, 'Inflação', question, ok, now);

test('scheduleCard: o cartão novo entra na caixa 1 e volta amanhã, com "Acertei" ou com "Errei"', () => {
  for (const ok of [true, false]) {
    assert.deepEqual(rate(Object.freeze([]), ok), [{
      key: 'inflacao|o que e inflacao?', title: 'Inflação', box: 1, due: '2026-11-17', date: today().toISOString(),
    }], String(ok));
  }
});

test('scheduleCard: "Acertei" no dia marcado sobe uma caixa: 1 a 2 em 3 dias, 2 a 3 em 7, 3 a 4 em 16, e a 4 fica', () => {
  const card = n => [Object.freeze(boxOf('Inflação', 'O que é inflação?', n, '2026-11-16'))];
  const after = n => rate(Object.freeze(card(n)), true)[0];
  assert.deepEqual([after(1).box, after(1).due], [2, '2026-11-19']);
  assert.deepEqual([after(2).box, after(2).due], [3, '2026-11-23']);
  assert.deepEqual([after(3).box, after(3).due], [4, '2026-12-02']);
  assert.deepEqual([after(4).box, after(4).due], [4, '2026-12-02'], 'a caixa 4 continua na 4');
  assert.equal(after(1).date, today().toISOString());
});

test('scheduleCard: "Acertei" dias depois do marcado também sobe, e a volta conta de hoje', () => {
  const late = [boxOf('Inflação', 'O que é inflação?', 2, '2026-11-09')];
  assert.deepEqual(rate(late, true)[0], { ...late[0], box: 3, due: '2026-11-23', date: today().toISOString() });
});

test('scheduleCard: "Acertei" antes do dia marcado devolve a lista igual', () => {
  const list = Object.freeze([Object.freeze(boxOf('Inflação', 'O que é inflação?', 2, '2026-11-17'))]);
  assert.equal(rate(list, true), list, 'rever o baralho no mesmo dia não empurra o cartão');
});

test('scheduleCard: "Errei" em qualquer caixa volta à 1 e o cartão volta amanhã, também antes do dia marcado', () => {
  for (const [n, due] of [[1, '2026-11-16'], [3, '2026-11-20'], [4, '2026-11-10']]) {
    const [entry] = rate([boxOf('Inflação', 'O que é inflação?', n, due)], false);
    assert.deepEqual([entry.box, entry.due], [1, '2026-11-17'], 'caixa ' + n);
  }
});

test('scheduleCard: as outras entradas ficam no lugar; a estragada com a mesma chave é trocada ali mesmo', () => {
  const other = boxOf('Juros', 'O que é a Selic?', 3, '2026-11-20');
  const broken = { key: mistakeKey('Inflação', 'O que é inflação?'), box: 'dois' };
  const junk = [null, 'texto', other, broken, { key: 5 }];
  const next = rate(frozen(junk), false);
  assert.deepEqual(next.map(e => e?.box), [undefined, undefined, 3, 1, undefined]);
  assert.deepEqual(rate(frozen([null, other]), true, 'Quem mede a inflação?').slice(0, 2), [null, other]);
});

test('validCardReview: aceita o que scheduleCard grava, também depois de gravado e lido no navegador', () => {
  const [entry] = rate([], true);
  assert.equal(validCardReview(entry), true);
  assert.equal(validCardReview(JSON.parse(JSON.stringify(entry))), true);
});

test('validCardReview: recusa caixa fora de 1 a 4, dia de volta estragado e chave de outro material', () => {
  const good = boxOf('Inflação', 'O que é inflação?', 2, '2026-11-17');
  const bad = [
    null, 'texto', [], {},
    { ...good, box: 0 }, { ...good, box: 5 }, { ...good, box: '2' }, { ...good, box: 1.5 },
    { ...good, due: 'ontem' }, { ...good, due: '2026-02-30' }, { ...good, due: '2026-11-7' }, { ...good, due: undefined },
    { ...good, date: 'ontem' }, { ...good, key: mistakeKey('Juros', 'O que é inflação?') }, { ...good, key: 5 },
    { ...good, title: ' ' }, { ...good, title: 5 },
  ];
  for (const entry of bad) assert.equal(validCardReview(entry), false, JSON.stringify(entry));
});

test('dueCards: só os vencidos que estão num material, do mais atrasado ao mais novo, com o material de cada um', () => {
  const list = [
    boxOf('Inflação', 'O que é inflação?', 2, '2026-11-16'), // vence hoje
    boxOf('Juros', 'O que é a Selic?', 1, '2026-11-12'), // atrasado 4 dias
    boxOf('Inflação', 'Quem mede a inflação?', 3, '2026-11-17'), // volta amanhã
    boxOf('Clima', 'O que é El Niño?', 1, '2026-11-10'), // o material foi excluído
  ];
  assert.deepEqual(dueCards(frozen(list), [INFLACAO, JUROS], today()), [
    { question: 'O que é a Selic?', answer: 'A taxa básica.', title: 'Juros', area: 'Direito' },
    { question: 'O que é inflação?', answer: 'A alta geral dos preços.', title: 'Inflação', area: 'Economia' },
  ]);
  assert.deepEqual(dueCards(list, [JUROS], today()).map(c => c.question), ['O que é a Selic?'], 'Inflação excluído');
  assert.deepEqual(dueCards([], [INFLACAO, JUROS], today()), []);
});

test('dueCards: na mesma data vale a ordem da lista; entrada estragada ou repetida não entra', () => {
  const a = boxOf('Inflação', 'Quem mede a inflação?', 1, '2026-11-15');
  const b = boxOf('Inflação', 'O que é inflação?', 1, '2026-11-15');
  const list = [a, null, { ...b, box: 9 }, b, a];
  assert.deepEqual(
    dueCards(list, [INFLACAO], today()).map(c => c.question), ['Quem mede a inflação?', 'O que é inflação?']
  );
  // O mesmo material aberto e na biblioteca: o cartão vem uma vez, do primeiro da lista.
  assert.equal(dueCards([b], [{ ...INFLACAO, area: 'Escolar' }, INFLACAO], today())[0].area, 'Escolar');
});

test('revisão do dia: no máximo 20 cartões por vez, os mais atrasados primeiro', () => {
  const material = {
    title: 'Inflação',
    flashcards: Array.from({ length: 25 }, (_, i) => ({ question: 'Cartão ' + i, answer: 'Resposta ' + i })),
  };
  // O cartão i venceu há i dias.
  const list = material.flashcards.map((c, i) => boxOf('Inflação', c.question, 1, addDays('2026-11-16', -i)));
  const due = dueCards(list, [material], today());
  assert.equal(due.length, 25, 'a contagem é de todos os vencidos');
  assert.deepEqual(
    dayCards(due).map(c => c.question),
    Array.from({ length: 20 }, (_, k) => 'Cartão ' + (24 - k)),
    'do cartão 24 (o mais atrasado) ao 5'
  );
  assert.deepEqual(dayCards(due.slice(0, 3)), due.slice(0, 3), 'com menos de 20, vêm todos');
  assert.deepEqual(dayCards([]), []);
});

test('revisão do dia: avaliar o cartão o tira da revisão de hoje, com "Acertei" e com "Errei"', () => {
  const list = [
    boxOf('Inflação', 'O que é inflação?', 2, '2026-11-15'), boxOf('Inflação', 'Quem mede a inflação?', 1, '2026-11-16'),
  ];
  const right = rate(list, true);
  const wrong = rate(right, false, 'Quem mede a inflação?');
  assert.equal(dueCards(list, [INFLACAO], today()).length, 2);
  assert.equal(dueCards(right, [INFLACAO], today()).length, 1);
  assert.equal(dueCards(wrong, [INFLACAO], today()).length, 0);
  assert.equal(dueCards(wrong, [INFLACAO], new Date(2026, 10, 17, 9)).length, 1, 'o errado volta amanhã');
});

test('demo: texto de uma frase só vira um tópico, um flashcard e uma questão', () => {
  const text = 'Mitocôndrias produzem a energia da célula.';
  assert.deepEqual(demo(text), {
    title: 'Mitocôndrias produzem a energia da célula',
    summary: [{ concept: 'Mitocôndrias produzem a energia da célula', text, source: text }],
    flashcards: [{ question: 'Complete o trecho 1: Mitocôndrias produzem a energia…', answer: text }],
    quiz: [{
      type: 'short',
      question: 'Qual palavra inicia este trecho: “…produzem a energia da célula.”?',
      options: [text, 'O texto não apresenta nenhuma informação.', 'Nenhuma das alternativas.'],
      answer: 'Mitocôndrias',
      explanation: 'Trecho do material: ' + text,
      steps: [],
    }],
    semIA: true,
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

test('demo: o material leva a marca semIA, o trecho de cada tópico é a própria frase, e ele continua valendo', () => {
  const material = demo(EXAMPLE);
  assert.equal(material.semIA, true);
  assert.ok(material.summary.every(s => s.source === s.text && inText(s.source, EXAMPLE)));
  assert.equal(validMaterial(material), true);
  assert.equal(sameMaterial(material, demo(EXAMPLE)), true);
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

// Tecla no editor do Estudar como o navegador manda (nativeEvent): Enter, sem modificador e fora da composição.
const press = change => ({
  key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, isComposing: false, keyCode: 13,
  ...change,
});

test('askKey: Ctrl + Enter e ⌘ + Enter perguntam ao Cérebro', () => {
  assert.equal(askKey(press({ ctrlKey: true })), true);
  assert.equal(askKey(press({ metaKey: true })), true);
});

test('askKey: Enter, Shift + Enter e Alt + Enter ficam com a caixa de texto (linha nova)', () => {
  assert.equal(askKey(press({})), false);
  assert.equal(askKey(press({ shiftKey: true })), false);
  assert.equal(askKey(press({ altKey: true })), false);
  assert.equal(askKey(press({ ctrlKey: true, shiftKey: true })), false);
  assert.equal(askKey(press({ metaKey: true, altKey: true })), false);
});

test('askKey: tecla da composição de texto (acento, IME) e Ctrl com outra tecla não perguntam', () => {
  assert.equal(askKey(press({ ctrlKey: true, isComposing: true })), false);
  assert.equal(askKey(press({ ctrlKey: true, keyCode: 229 })), false);
  assert.equal(askKey(press({ metaKey: true, isComposing: true })), false);
  for (const key of ['a', 'Tab', 'Process', ' ']) assert.equal(askKey(press({ ctrlKey: true, key })), false, key);
});

// O retorno do quiz depois de errar (uns 315 px, com a faixa de "Próxima questão" de 69 px dentro dele): inteiro no
// computador e no celular em pé. No celular deitado e no zoom de 200% a raiz reserva 155 px (a barra de baixo, a faixa
// presa e o respiro); sem a faixa, que já está no bloco, sobram 86 px de reserva, e ele não cabe.
test('fitsAbove: o bloco cabe na janela menos a reserva da raiz; "auto" (computador) não reserva nada', () => {
  assert.equal(fitsAbove(315, 768, 'auto', 69), true, 'computador, 1366 x 768');
  assert.equal(fitsAbove(315, 844, '155px', 69), true, 'celular em pé, 390 x 844');
  assert.equal(fitsAbove(315, 390, '155px', 69), false, 'celular deitado, 844 x 390');
  assert.equal(fitsAbove(315, 312, '155px', 69), false, 'zoom de 200%, 683 x 312');
  assert.equal(fitsAbove(304, 390, '155px', 69), true, 'na medida exata, cabe');
  assert.equal(fitsAbove(315, 768, ''), true, 'sem valor, sem reserva');
});

// A faixa presa conta uma vez só: em 390 x 844, um retorno de 700 px cabe inteiro acima da barra. No computador a faixa
// não é presa e a raiz não reserva nada: o bloco mais alto que a janela continua sem caber.
test('fitsAbove: a faixa dentro do bloco sai da reserva, e no computador não aumenta a janela', () => {
  assert.equal(fitsAbove(700, 844, '155px'), false, 'com a faixa contada duas vezes, não cabia');
  assert.equal(fitsAbove(700, 844, '155px', 69), true, 'contada uma vez, cabe');
  assert.equal(fitsAbove(759, 844, '155px', 69), false, 'passou da barra e do respiro');
  assert.equal(fitsAbove(800, 768, 'auto', 69), false, 'computador, retorno mais alto que a janela');
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

test('matches: o texto guardado de um material não vale para outro', () => {
  const other = { ...MATERIAL, title: 'Juros compostos', area: 'Economia', summary: [{ concept: 'Montante', text: 'Capital e juros.' }] };
  for (let i = 0; i < 2; i++) {
    assert.equal(matches(MATERIAL, 'FOTOSSINTESE', 'Todas'), true, 'a mesma busca na segunda vez');
    assert.equal(matches(other, 'fotossíntese', 'Todas'), false, 'outro objeto, outro texto');
    assert.equal(matches(other, 'montante', 'Todas'), true);
    assert.equal(matches(MATERIAL, 'montante', 'Todas'), false);
    assert.equal(matches(other, 'montante', 'Escolar'), false, 'o filtro de área continua valendo');
  }
});

test('libraryCount: o resultado da busca da Biblioteca, com nenhum, um e vários materiais', () => {
  assert.equal(libraryCount(0), 'Nenhum material encontrado');
  assert.equal(libraryCount(1), '1 material encontrado');
  assert.equal(libraryCount(2), '2 materiais encontrados');
});

// Material do simulado com n questões de múltipla escolha, congelado: função que mexesse nele falharia aqui.
const examMaterial = (title, area, n) => Object.freeze({
  title,
  area,
  summary: [{ concept: title, text: title + '.' }],
  flashcards: [{ question: 'O que é ' + title + '?', answer: title }],
  quiz: Object.freeze(Array.from({ length: n }, (_, i) => Object.freeze({
    type: 'multiple',
    question: title + ': questão ' + (i + 1) + '?',
    options: Object.freeze(['A', 'B', 'C']),
    answer: i % 3,
    explanation: 'Trecho ' + (i + 1) + '.',
    steps: [],
  }))),
});
const EXAM = [examMaterial('Inflação', 'Economia', 5), examMaterial('Porcentagem', 'Matemática', 4),
  examMaterial('Contratos', 'Direito', 3)];
// Sorteio de semente fixa (mulberry32), no lugar do Math.random: a mesma semente dá sempre a mesma sequência.
const seeded = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const examKey = q => mistakeKey(q.title, q.question);

test('examPool: cada questão leva o título e a área do material, e as opções e a resposta ficam como estão', () => {
  const pool = examPool(EXAM);
  assert.equal(pool.length, 12);
  for (const q of pool) {
    const { title, area, ...item } = q;
    const from = EXAM.find(m => m.title === title);
    assert.equal(area, from.area);
    assert.deepEqual(item, from.quiz.find(x => x.question === item.question));
  }
});

test('examPool: a mesma questão (mesmo material e enunciado, sem acento nem maiúscula) entra uma vez só', () => {
  assert.equal(examPool([EXAM[0], { ...EXAM[0], title: 'INFLACAO' }]).length, 5);
  assert.equal(examPool([EXAM[0], { ...EXAM[0], title: 'Juros' }]).length, 10, 'em outro material é outra questão');
  assert.deepEqual(examPool([]), []);
});

test('examPool: as questões de cada material ficam prontas, e o material trocado traz as dele', () => {
  const first = examPool(EXAM);
  assert.ok(examPool(EXAM).every((q, i) => q === first[i]), 'a frase da Biblioteca não copia as questões a cada tecla');
  // O App troca o objeto ao salvar, excluir e importar: o material novo não reaproveita as questões do antigo.
  assert.ok(examPool([{ ...EXAM[0], title: 'Juros' }]).every(q => q.title === 'Juros'));
});

test('mockExam: com o sorteio fixo, a ordem sai sempre a mesma', () => {
  const first = mockExam(EXAM, 10, seeded(7));
  assert.deepEqual(mockExam(EXAM, 10, seeded(7)), first);
  assert.notDeepEqual(mockExam(EXAM, 10, seeded(8)), first, 'outra semente, outra ordem');
  assert.deepEqual(mockExam(EXAM, 10, () => 0), mockExam(EXAM, 10, () => 0));
});

test('mockExam: nenhuma questão se repete, e cada uma leva o título e a área do material, sem mudar opções nem resposta', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const exam = mockExam(EXAM, 10, seeded(seed));
    assert.equal(exam.length, 10);
    assert.equal(new Set(exam.map(examKey)).size, 10, 'semente ' + seed);
    for (const q of exam) {
      const { title, area, ...item } = q;
      const from = EXAM.find(m => m.title === title);
      assert.equal(area, from.area);
      assert.deepEqual(item, from.quiz.find(x => x.question === item.question));
    }
  }
});

test('mockExam: um pedido maior que o total traz todas as questões, embaralhadas', () => {
  const exam = mockExam(EXAM, 30, seeded(3));
  assert.equal(exam.length, 12);
  assert.deepEqual(new Set(exam.map(examKey)), new Set(examPool(EXAM).map(examKey)));
  assert.notDeepEqual(exam.map(examKey), examPool(EXAM).map(examKey), 'a ordem não é a da biblioteca');
});

test('mockExam: o sorteio passa por todos os materiais antes de repetir um', () => {
  // 10 de 5 + 4 + 3: três rodadas completas (9) e uma questão da quarta, de quem ainda tem.
  for (let seed = 1; seed <= 50; seed++) {
    const exam = mockExam(EXAM, 10, seeded(seed));
    const count = title => exam.filter(q => q.title === title).length;
    assert.equal(count('Contratos'), 3, 'semente ' + seed);
    assert.deepEqual([count('Inflação'), count('Porcentagem')].sort(), [3, 4], 'semente ' + seed);
  }
  // Com menos vagas que materiais, cada questão vem de um material.
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(new Set(mockExam(EXAM, 2, seeded(seed)).map(q => q.title)).size, 2, 'semente ' + seed);
  }
});

test('mockExam: qualquer questão de um material pode sair, e não só as primeiras dele', () => {
  // Uma questão de cada material por simulado: em 50 sementes, todas as 12 saem em algum.
  const drawn = new Set();
  for (let seed = 1; seed <= 50; seed++) mockExam(EXAM, 3, seeded(seed)).forEach(q => drawn.add(examKey(q)));
  assert.deepEqual(drawn, new Set(examPool(EXAM).map(examKey)));
});

test('mockExam: a ordem final é embaralhada e não segue as rodadas do sorteio', () => {
  // Na ordem das rodadas, as três primeiras seriam sempre de três materiais diferentes.
  const rounds = seed => new Set(mockExam(EXAM, 12, seeded(seed)).slice(0, 3).map(q => q.title)).size === 3;
  assert.ok(!Array.from({ length: 50 }, (_, i) => i + 1).every(rounds));
});

test('examScore: o acerto por material, na ordem em que cada material apareceu', () => {
  const answers = [
    { title: 'Inflação', ok: true }, { title: 'Contratos', ok: false }, { title: 'Inflação', ok: false },
    { title: 'Inflação', ok: true }, { title: 'Contratos', ok: false },
  ];
  assert.deepEqual(examScore(answers), [['Inflação', 2, 3], ['Contratos', 0, 2]]);
  assert.deepEqual(examScore([]), []);
});

test('examLine: quantas questões entram e de quantos materiais, no singular e no plural', () => {
  const pool = examPool(EXAM);
  assert.equal(examLine(pool, 10), '10 questões de 3 materiais');
  assert.equal(examLine(pool, 30), '12 questões de 3 materiais', 'com menos questões que o pedido, entram todas');
  assert.equal(examLine(pool, 2), '2 questões de 2 materiais', 'uma questão por material até todos entrarem');
  assert.equal(examLine(examPool([EXAM[2]]), 10), '3 questões de 1 material');
  assert.equal(examLine(examPool([examMaterial('Juros', 'Economia', 1)]), 10), '1 questão de 1 material');
  assert.equal(examLine(mockExam(EXAM, 10, seeded(1))), '10 questões de 3 materiais', 'o simulado aberto');
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

test('hello: com o material aberto como assunto, cita o material e não fala do editor', () => {
  assert.equal(
    hello({ user: null, area: 'Escolar', level: 'Básico', input: 'Revolução Francesa\nCausas: a crise', title: 'Revolução Francesa', api: true }),
    'Olá! Sou o Cérebro, seu tutor das matérias escolares no nível Básico. Pergunte o que quiser ou escolha uma das sugestões abaixo. Vou considerar o material "Revolução Francesa".'
  );
});

// Material aberto da biblioteca, de outra área e outro nível que os do editor.
const OPENED = {
  title: 'Revolução Francesa',
  area: 'Escolar',
  level: 'Intermediário',
  summary: [{ concept: 'Causas', text: 'A crise financeira e a desigualdade.' }, { concept: '', text: 'A Queda da Bastilha.' }],
};
const EDITOR = { input: 'Hardware e software são as duas partes do computador.', area: 'Tecnologia', level: 'Básico' };

test('chatSubject: com um material aberto, vão o título e o resumo dele, com a área e o nível do material', () => {
  const got = chatSubject({ material: OPENED, made: '', editor: false, ...EDITOR });
  assert.deepEqual(got, {
    title: 'Revolução Francesa',
    content: 'Revolução Francesa\nCausas: A crise financeira e a desigualdade.\nA Queda da Bastilha.',
    area: 'Escolar',
    level: 'Intermediário',
    swap: 'Usar o texto do editor',
  });
  // Sem texto no editor não há outra fonte para escolher, nem com a escolha antiga pelo editor.
  for (const editor of [false, true]) {
    assert.equal(chatSubject({ material: OPENED, made: '', editor, ...EDITOR, input: '  ' }).swap, '');
    assert.equal(chatSubject({ material: OPENED, made: '', editor, ...EDITOR, input: '  ' }).title, OPENED.title);
  }
});

test('chatSubject: material antigo, sem área ou nível da lista, usa os do editor', () => {
  const old = { ...OPENED, area: undefined, level: 'Expert' };
  const got = chatSubject({ material: old, made: '', editor: false, ...EDITOR });
  assert.equal(got.area, 'Tecnologia');
  assert.equal(got.level, 'Básico');
});

test('chatSubject: sem material, com o texto escolhido ou com o material feito do texto do editor, vale o editor', () => {
  const editorOnly = { title: '', content: EDITOR.input, area: 'Tecnologia', level: 'Básico' };
  assert.deepEqual(chatSubject({ material: null, made: '', editor: false, ...EDITOR }), { ...editorOnly, swap: '' });
  assert.deepEqual(
    chatSubject({ material: OPENED, made: '', editor: true, ...EDITOR }),
    { ...editorOnly, swap: 'Usar o material aberto' }
  );
  // Gerado deste texto em Escolar; depois o aluno trocou a área do editor: continua sendo o mesmo texto.
  const made = JSON.stringify([EDITOR.input, 'Escolar', 'Intermediário']);
  for (const editor of [false, true]) {
    assert.deepEqual(chatSubject({ material: OPENED, made, editor, ...EDITOR }), { ...editorOnly, swap: '' });
  }
  // Outro texto no editor: o material volta a valer. Um texto que só começa igual não engana a comparação.
  assert.equal(chatSubject({ material: OPENED, made, editor: false, ...EDITOR, input: 'Outro texto' }).title, OPENED.title);
  assert.equal(chatSubject({ material: OPENED, made, editor: false, ...EDITOR, input: 'Hardware' }).title, OPENED.title);
});

test('chatSubject: material enorme vai cortado em 20.000 caracteres, o limite do backend', () => {
  const huge = { ...OPENED, summary: [{ concept: 'Longo', text: 'á'.repeat(30000) }] };
  const { content } = chatSubject({ material: huge, made: '', editor: false, ...EDITOR });
  assert.equal([...content].length, 20000);
  assert.ok(content.startsWith('Revolução Francesa\nLongo: ááá'));
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

test('inText: acha o trecho sem ligar para maiúsculas, acentos, espaços, quebras de linha e invisíveis', () => {
  // Hífen invisível no texto e espaço de largura zero no trecho.
  const [shy, zwsp] = [0xad, 0x200b].map(c => String.fromCodePoint(c));
  const text = 'A fotossíntese é o processo\npelo qual plantas trans' + shy + 'formam   energia luminosa.';
  assert.equal(inText('FOTOSSINTESE é o processo pelo qual', text), true);
  assert.equal(inText('plantas  transformam energia', text), true);
  assert.equal(inText('energia lumi' + zwsp + 'nosa.', text), true);
  assert.equal(inText('plantas absorvem energia', text), false);
});

test('inText: trecho vazio, só com espaços ou ausente, e texto vazio não contam', () => {
  for (const source of ['', '   ', '\n', null, undefined]) {
    assert.equal(inText(source, 'Qualquer texto.'), false, JSON.stringify(source));
  }
  assert.equal(inText('Qualquer texto', ''), false);
  assert.equal(inText('Qualquer texto', null), false);
});

test('inText: a regra da tela acha os 64 trechos que o backend manteve na rodada real, cada um no texto do seu caso', () => {
  const round = JSON.parse(readFileSync(new URL('../../docs/avaliacao-2026-11-17.json', import.meta.url), 'utf8'));
  const pairs = round.cases
    .filter(c => c.kind === 'generate' && c.output)
    .flatMap(c => c.output.summary.filter(s => s.source).map(s => [s.source, c.input.content]));
  assert.equal(pairs.length, 64);
  for (const [source, content] of pairs) assert.equal(inText(source, content), true, source);
});

// A parte do texto que findSource marca.
const markedPart = (text, source) => {
  const range = findSource(text, source);
  return range && text.slice(...range);
};

test('findSource: acha o trecho sem ligar para maiúsculas, acentos, espaços e quebras de linha, e marca o original', () => {
  const shy = String.fromCodePoint(0xad);
  const text = 'A fotossíntese é o processo\npelo qual  plantas trans' + shy + 'formam energia luminosa.';
  assert.deepEqual(findSource(text, 'FOTOSSINTESE é o processo pelo qual'), [2, 37]);
  assert.equal(markedPart(text, 'FOTOSSINTESE é o processo pelo qual'), 'fotossíntese é o processo\npelo qual');
  assert.equal(markedPart(text, 'pelo qual plantas transformam'), 'pelo qual  plantas trans' + shy + 'formam');
  assert.equal(markedPart(text, ' energia luminosa.\n'), 'energia luminosa.');
  // Acento em dois caracteres (letra e acento solto): a marca leva o acento junto com a letra.
  const [acute, tilde] = [0x301, 0x303].map(c => String.fromCodePoint(c));
  const loose = 'cafe' + acute + ' com pa' + tilde + 'o';
  assert.equal(markedPart('Tomei ' + loose + '.', 'CAFÉ COM PÃO'), loose);
  // O trecho que acaba antes do acento solto ou do hífen invisível (o backend corta em 200 pontos de código): a marca
  // leva os dois junto com a última letra.
  assert.equal(markedPart('Tomei ' + loose + '.', 'Tomei cafe'), 'Tomei cafe' + acute);
  assert.equal(markedPart('A fotos' + shy + 'síntese usa luz.', 'A fotos'), 'A fotos' + shy);
});

test('findSource e inText: ligaduras de texto copiado de PDF e o ß valem as letras comuns, como no casefold do backend', () => {
  const text = 'A deﬁnição de eﬁciência mede o ﬂuxo de trabalho da equipe em um período.';
  const source = 'A definição de eficiência mede o fluxo de trabalho';
  assert.equal(inText(source, text), true);
  assert.equal(markedPart(text, source), 'A deﬁnição de eﬁciência mede o ﬂuxo de trabalho');
  assert.equal(markedPart('Die Straße ist lang.', 'STRASSE'), 'Straße');
  assert.equal(inText('strasse', 'DIE STRAẞE'), true);
  assert.equal(inText('A eﬁciência', 'A eficiência da equipe'), true);
});

test('findSource: aspas e ponto que o modelo pôs nas pontas não precisam estar no texto, como no backend', () => {
  const text = 'O IPCA mede a inflação oficial do país, e a Selic é a taxa básica de juros';
  assert.equal(markedPart(text, '"O IPCA mede a inflação oficial do país."'), 'O IPCA mede a inflação oficial do país');
  assert.equal(markedPart(text, '“a Selic é a taxa básica de juros.”'), 'a Selic é a taxa básica de juros');
  assert.equal(markedPart(text, '«a Selic é a taxa básica de juros…»'), 'a Selic é a taxa básica de juros');
  // Pontuação no meio do trecho continua tendo de bater.
  assert.equal(findSource(text, 'O IPCA mede a inflação oficial. Do país'), null);
});

test('findSource: o trecho cortado em 200 caracteres pelo backend é achado, até com meio emoji no fim', () => {
  const sentence = 'Na fase clara da fotossíntese, ' + 'a água é decomposta e libera oxigênio, '.repeat(6) + 'com 🌱 no fim.';
  const text = 'Começo do texto. ' + sentence + ' Fim.';
  assert.ok(sentence.length > 200);
  assert.equal(markedPart(text, sentence.slice(0, 200)), sentence.slice(0, 200).trim());
  const half = sentence.slice(0, sentence.indexOf('🌱') + 1);
  assert.equal(markedPart(text, half), half.slice(0, -1).trim());
});

test('findSource: trecho que não está no texto, vazio ou ausente dá null', () => {
  const text = 'A clorofila absorve a luz solar nos cloroplastos.';
  for (const source of ['A clorofila reflete a luz verde', '', '   ', '\n', '"."', null, undefined]) {
    assert.equal(findSource(text, source), null, JSON.stringify(source));
  }
  assert.equal(findSource('', 'A clorofila'), null);
  assert.equal(findSource(null, 'A clorofila'), null);
});

test('findSource: os 64 trechos da rodada real são achados no texto de cada caso, e a marca é o próprio trecho', () => {
  const round = JSON.parse(readFileSync(new URL('../../docs/avaliacao-2026-11-17.json', import.meta.url), 'utf8'));
  const pairs = round.cases
    .filter(c => c.kind === 'generate' && c.output)
    .flatMap(c => c.output.summary.filter(s => s.source).map(s => [s.source, c.input.content]));
  assert.equal(pairs.length, 64);
  for (const [source, content] of pairs) {
    const part = markedPart(content, source);
    assert.ok(part && inText(source, part) && inText(part, source), source);
  }
});

const TOPIC = 'A clorofila absorve a luz do Sol. A água é decomposta e libera oxigênio. O açúcar sai do ciclo de Calvin.';

test('markPieces: marca cada trecho que faltou no lugar dele no texto do tópico, na ordem do texto', () => {
  // Os trechos vêm na ordem da IA, sem acento e com outras maiúsculas: a marca é a parte do texto original.
  assert.deepEqual(markPieces(TOPIC, ['o acucar sai do ciclo de calvin', 'A clorofila absorve a luz']), [
    { text: 'A clorofila absorve a luz', mark: true },
    { text: ' do Sol. A água é decomposta e libera oxigênio. ', mark: false },
    { text: 'O açúcar sai do ciclo de Calvin', mark: true },
    { text: '.', mark: false },
  ]);
  // As partes juntas refazem o texto inteiro.
  const parts = markPieces(TOPIC, ['A água é decomposta']);
  assert.equal(parts.map(p => p.text).join(''), TOPIC);
  assert.deepEqual(parts.filter(p => p.mark).map(p => p.text), ['A água é decomposta']);
});

test('markPieces: o trecho com as pontas que o backend tirou (aspas e ponto) é achado, como no findSource', () => {
  assert.deepEqual(markPieces(TOPIC, ['"A água é decomposta e libera oxigênio."']).filter(p => p.mark),
    [{ text: 'A água é decomposta e libera oxigênio', mark: true }]);
});

test('markPieces: trecho que não está no texto fica de fora, e lista vazia deixa o texto sem marca', () => {
  assert.deepEqual(markPieces(TOPIC, []), [{ text: TOPIC, mark: false }]);
  assert.deepEqual(markPieces(TOPIC, ['A clorofila reflete a luz verde', '', '   ']), [{ text: TOPIC, mark: false }]);
  assert.deepEqual(markPieces(TOPIC, ['A clorofila reflete a luz verde', 'libera oxigênio']).filter(p => p.mark),
    [{ text: 'libera oxigênio', mark: true }]);
  assert.deepEqual(markPieces('', []), []);
});

test('markPieces: trechos que se cruzam, encostam ou se repetem viram uma marca só', () => {
  const marks = pieces => {
    const parts = markPieces(TOPIC, pieces);
    // O texto continua inteiro, uma vez só.
    assert.equal(parts.map(p => p.text).join(''), TOPIC, JSON.stringify(pieces));
    return parts.filter(p => p.mark).map(p => p.text);
  };
  assert.deepEqual(marks(['A clorofila absorve a luz', 'absorve a luz do Sol']), ['A clorofila absorve a luz do Sol']);
  assert.deepEqual(marks(['absorve a luz do Sol', 'A clorofila absorve a luz']), ['A clorofila absorve a luz do Sol']);
  assert.deepEqual(marks(['A clorofila absorve a luz do Sol', 'absorve a luz']), ['A clorofila absorve a luz do Sol']);
  assert.deepEqual(marks(['A clorofila absorve', ' a luz do Sol']), ['A clorofila absorve a luz do Sol']);
  assert.deepEqual(marks(['libera oxigênio', 'LIBERA OXIGENIO']), ['libera oxigênio']);
});

test('originNote: o aviso do material diz de onde ele veio', () => {
  const own = { concept: 'Clorofila', text: 'Absorve a luz.', source: 'A clorofila absorve a luz solar' };
  const none = { concept: 'Calvin', text: 'Fixa o carbono.', source: '' };
  const nothing = 'Nenhum tópico foi conferido com um texto seu. Confira em uma fonte confiável.';
  assert.equal(AI_NOTE, 'Gerado por IA. Pode conter erros: confira com o seu material.');
  assert.equal(originNote([own, none]), AI_NOTE);
  assert.equal(originNote([none, { ...none, source: '   ' }, { concept: 'Luz', text: 'Energia.' }]), nothing);
  assert.equal(originNote([]), nothing);
  assert.equal(originNote([own, { ...own, ia: true }, none]),
    'Feito de um exemplo escrito pela IA. Confira os fatos em uma fonte confiável.');
  // Feito de um exemplo pronto: nem o aviso de material do aluno, nem o do exemplo da IA.
  assert.equal(originNote([own, { ...own, pronto: true }, none]),
    'Gerado por IA. Pode conter erros: confira com o texto de exemplo.');
});

test('textOrigin: o texto do material é do exemplo da IA, de um exemplo pronto ou do aluno, na ordem do aviso', () => {
  const own = { concept: 'Clorofila', text: 'Absorve a luz.', source: 'A clorofila absorve a luz solar' };
  const none = { concept: 'Calvin', text: 'Fixa o carbono.', source: '' };
  assert.equal(textOrigin([own, none]), '');
  assert.equal(textOrigin([own, { ...own, pronto: true }, { ...own, ia: true }]), 'ia');
  assert.equal(textOrigin([own, { ...own, pronto: true }]), 'pronto');
  assert.equal(textOrigin(demo(EXAMPLE).summary), '', 'demonstração sem a marca do exemplo');
});

test('markExample: trecho do exemplo da IA leva ia, o do exemplo pronto leva pronto, e o resto fica como veio', () => {
  const ai = 'A inflação corrói o poder de compra das famílias. O Banco Central sobe os juros para conter os preços.';
  const ready = EXAMPLES.Economia[0].text;
  const own = { concept: 'Juros', text: 'Rendem sobre o saldo.', source: 'juros compostos rendem sobre o saldo' };
  const fromAi = { concept: 'Poder de compra', text: 'Cai.', source: 'A INFLACAO corrói o poder de compra' };
  const fromReady = { concept: 'IPCA', text: 'Índice oficial.', source: 'o índice oficial de inflação é o IPCA' };
  const none = { concept: 'Selic', text: 'Taxa básica.', source: '' };
  const summary = [own, fromAi, fromReady, none];
  assert.deepEqual(markExample(summary, ai, ''), [own, { ...fromAi, ia: true }, fromReady, none], 'exemplo da IA');
  assert.deepEqual(markExample(summary, '', ready), [own, fromAi, { ...fromReady, pronto: true }, none], 'pronto');
  assert.deepEqual(markExample(summary, '', ''), summary, 'depois do Limpar, nenhum exemplo');
  // Demonstração: as frases do exemplo pronto ganham a marca; a que o aluno escreveu depois dele, não.
  const mine = 'Juros altos seguram o consumo.';
  const marked = markExample(demo(ready + ' ' + mine).summary, '', ready);
  const expected = [...demo(ready).summary.map(s => [s.source, true]), [mine, false]];
  assert.deepEqual(marked.map(s => [s.source, !!s.pronto]), expected);
});

test('sourceLabel: o rótulo do trecho diz de que texto ele saiu', () => {
  const s = { concept: 'IPCA', text: 'Índice oficial.', source: ' o índice oficial de inflação é o IPCA\n' };
  assert.equal(sourceLabel(s), 'No seu texto: "o índice oficial de inflação é o IPCA"');
  assert.equal(sourceLabel({ ...s, pronto: true }), 'No texto de exemplo: "o índice oficial de inflação é o IPCA"');
  assert.equal(sourceLabel({ ...s, ia: true }), 'No exemplo escrito pela IA: "o índice oficial de inflação é o IPCA"');
});

test('pretestCards: as 2 primeiras perguntas dos flashcards; com menos de 2 cartões não há bloco', () => {
  const cards = [1, 2, 3].map(n => ({ question: 'Pergunta ' + n, answer: 'Resposta ' + n }));
  assert.deepEqual(pretestCards(cards), cards.slice(0, 2));
  assert.deepEqual(pretestCards(cards.slice(0, 2)), cards.slice(0, 2));
  assert.deepEqual(pretestCards(cards.slice(0, 1)), [], 'material de uma frase só');
  assert.deepEqual(pretestCards([]), [], 'o material temporário do caderno de erros');
});

test('readSkips: a conta de pulos seguidos gravada; valor estragado, bloqueado ou ausente vale zero', () => {
  browser({ 'cerebro-antes-de-ler': '2' });
  assert.equal(readSkips(), 2);
  for (const raw of ['-1', '1.5', '"2"', 'null', '[]', '{', '']) {
    browser({ 'cerebro-antes-de-ler': raw });
    assert.equal(readSkips(), 0, raw);
  }
  delete globalThis.localStorage;
  assert.equal(readSkips(), 0, 'sem localStorage');
});

test('recallStart: nada escrito nem marcado; o bloco abre sozinho até o 2º pulo seguido', () => {
  const material = { ...GOOD };
  browser({});
  assert.deepEqual(recallStart(material), { of: material, tries: ['', ''], pre: 'aberto', shown: {}, marks: {} });
  browser({ 'cerebro-antes-de-ler': '1' });
  assert.equal(recallStart(material).pre, 'aberto', 'um pulo só');
  assert.equal(pretestOpens(), true, 'o esqueleto da geração desenha o bloco');
  browser({ 'cerebro-antes-de-ler': '2' });
  assert.equal(recallStart(material).pre, null, 'dois pulos seguidos: o bloco fica no botão');
  assert.equal(pretestOpens(), false);
  try {
    demoStorage(true);
    assert.equal(recallStart(material).pre, 'aberto', 'a demonstração conta os pulos dela');
  } finally {
    demoStorage(false);
  }
});

test('recallLine: o placar do modo lembrar, no singular e no plural; sem tópico marcado não há placar', () => {
  assert.equal(recallLine([true]), 'Você lembrou 1 de 1 tópico.');
  assert.equal(recallLine([false]), 'Você lembrou 0 de 1 tópico.');
  assert.equal(recallLine([true, false, true, true, false, true]), 'Você lembrou 4 de 6 tópicos.');
  assert.equal(recallLine([false, false]), 'Você lembrou 0 de 2 tópicos.');
  assert.equal(recallLine([]), '');
});

test('nextSkips: a resposta escrita zera a conta; pular ou fechar em branco soma 1, com o aviso no 2º pulo', () => {
  assert.deepEqual(nextSkips(1, ['Luz vira energia', '']), { skips: 0, warn: false }, 'um campo escrito basta');
  assert.deepEqual(nextSkips(0, []), { skips: 1, warn: false }, 'Pular');
  assert.deepEqual(nextSkips(1, []), { skips: 2, warn: true }, '2º pulo seguido');
  assert.deepEqual(nextSkips(1, ['', ' \n ']), { skips: 2, warn: true }, '"Ler o resumo" em branco conta como pulo');
  assert.deepEqual(nextSkips(2, []), { skips: 3, warn: false }, 'o aviso já saiu');
});

test('markRecall: marca o tópico, troca a marca, e apertar de novo a marca escolhida a tira', () => {
  const lembrei = markRecall({}, 0, true);
  assert.deepEqual(lembrei, { 0: true });
  assert.deepEqual(markRecall(lembrei, 0, false), { 0: false }, 'Não lembrei troca a marca');
  assert.deepEqual(markRecall({ ...lembrei, 2: false }, 0, true), { 2: false }, 'Lembrei de novo solta a marca');
  assert.deepEqual(lembrei, { 0: true }, 'não muda as marcas recebidas');
});

test('shownMarks: o placar conta só os tópicos que a lista "Mostrar" deixa na tela, na ordem', () => {
  const marks = { 0: true, 2: false, 4: true };
  assert.deepEqual(shownMarks(marks, 6), [true, false, true]);
  assert.deepEqual(shownMarks(marks, 3), [true, false], 'os 3 primeiros');
  assert.deepEqual(shownMarks({}, 6), []);
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
  input: '', exemplo: '', exemploPronto: '', area: '', level: '', result: null, made: { key: '' }, chat: [],
  tips: NO_TIPS, editorChat: false,
};
const DRAFT = {
  input: 'Inflação e juros',
  exemplo: 'Inflação é o aumento contínuo e generalizado dos preços.',
  exemploPronto: '',
  area: 'Economia',
  level: 'Avançado',
  result: { ...GOOD, area: 'Economia', level: 'Avançado' },
  made: { key: JSON.stringify(['Inflação e juros', 'Economia', 'Avançado']) },
  chat: ANSWERED,
  tips: { key: JSON.stringify(['Inflação e juros', 'Economia']), list: ['E o PIB per capita?', 'Como se mede?'] },
  editorChat: true,
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

test('readDraft: o exemplo da IA e o pronto voltam em texto de até 20.000 caracteres; o resto vale vazio', () => {
  for (const field of ['exemplo', 'exemploPronto']) {
    assert.equal(draft({ [field]: 'a'.repeat(20000) })[field], 'a'.repeat(20000), field);
    for (const value of ['a'.repeat(20001), 5, null, { text: 'a' }, ['a']]) {
      assert.equal(draft({ [field]: value })[field], '', field + ' ' + JSON.stringify(value).slice(0, 30));
    }
    assert.equal(draft({ [field]: undefined })[field], '', field + ': rascunho gravado antes do campo');
  }
  // O tópico marcado como trecho de um exemplo, da IA ou pronto, volta com a marca depois de um F5.
  for (const mark of ['ia', 'pronto']) {
    const marked = broken(m => Object.assign(m.summary[0], { source: 'A clorofila absorve a luz', [mark]: true }));
    assert.deepEqual(draft({ result: marked }).result, marked, mark);
  }
});

test('readDraft: o material aberto volta com o texto de onde saiu; texto acima do limite tira o material', () => {
  const result = { ...DRAFT.result, texto: 'Inflação é o aumento contínuo e generalizado dos preços.' };
  assert.deepEqual(draft({ result }).result, result);
  assert.equal(draft({ result: { ...result, texto: 'a'.repeat(20001) } }).result, null);
});

test('readDraft: área e nível só valem se forem da lista', () => {
  assert.equal(draft({ area: 'Medicina' }).area, '');
  assert.equal(draft({ area: 5 }).area, '');
  assert.equal(draft({ level: 'Expert' }).level, '');
  assert.equal(draft({ level: null }).level, '');
  for (const area of AREAS) assert.equal(draft({ area }).area, area);
  for (const level of LEVELS) assert.equal(draft({ level }).level, level);
});

test('readDraft: material que não passa na conferência sai, e a marca da última geração sai junto', () => {
  const { summary, ...noSummary } = GOOD;
  const got = draft({ result: noSummary });
  assert.equal(got.result, null);
  assert.deepEqual(got.made, NO_DRAFT.made);
  assert.equal(got.input, DRAFT.input, 'o resto do rascunho fica');
  assert.deepEqual(got.chat, DRAFT.chat);
});

test('readDraft: marca da última geração fora do formato volta vazia', () => {
  const bad = [null, 'k', 5, {}, { key: 5 }, { key: null }, { key: ['k'] }, { kinds: ['resumo'] }];
  for (const made of bad) assert.deepEqual(draft({ made }).made, NO_DRAFT.made, JSON.stringify(made));
});

test('readDraft: rascunho de antes do botão só de gerar (com kinds) continua valendo, sem os kinds', () => {
  const key = DRAFT.made.key;
  assert.deepEqual(draft({ made: { key, kinds: ['resumo', 'quiz'] } }).made, { key });
  assert.deepEqual(draft({ made: { key, kinds: 'resumo' } }).made, { key });
  assert.deepEqual(draft({ made: { key: 'k', kinds: [1] } }).made, { key: 'k' });
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

test('readDraft: a escolha do texto do editor no chat só vale com true', () => {
  for (const editorChat of [false, 'true', 1, null, undefined]) assert.equal(draft({ editorChat }).editorChat, false);
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

const QUOTA_NOTE = 'A cota da IA é do projeto inteiro e zera à meia-noite do horário do Pacífico (4h ou 5h em ' +
  'Brasília). O saldo real fica no painel de uso do Google AI Studio.';

test('healthLabel: conferindo, Cérebro desligado e IA não configurada', () => {
  assert.deepEqual(healthLabel(null), { text: 'Conferindo a IA…', tone: '' });
  assert.deepEqual(healthLabel(false), { text: 'Cérebro desligado', tone: 'off' });
  assert.deepEqual(
    healthLabel({ status: 'ok', ai_configured: false, provider: 'gemini', model: 'gemini-flash', calls_today: 0 }),
    { text: 'IA não configurada', tone: 'warn' }
  );
});

test('healthLabel: IA ativa mostra o modelo em uso e as chamadas deste computador, com a dica da cota', () => {
  const health = {
    status: 'ok',
    ai_configured: true,
    provider: 'gemini',
    model: 'gemini-flash-latest',
    model_in_use: 'gemini-2.5-flash',
    quota_exhausted: false,
  };
  assert.deepEqual(healthLabel({ ...health, calls_today: 12 }), {
    text: 'IA ativa · gemini-2.5-flash · 12 chamadas deste computador',
    tone: 'ok',
    model: 'gemini-2.5-flash',
    count: '12 chamadas deste computador',
    note: QUOTA_NOTE,
  });
  assert.equal(healthLabel({ ...health, calls_today: 1 }).text, 'IA ativa · gemini-2.5-flash · 1 chamada deste computador');
  assert.equal(healthLabel({ ...health, calls_today: 0 }).count, '0 chamadas deste computador');
});

test('healthLabel: com a cota esgotada o selo fica âmbar até a cota virar', () => {
  const health = { ai_configured: true, model_in_use: 'gemini-2.5-flash', calls_today: 40, quota_exhausted: true };
  assert.deepEqual(healthLabel(health), { text: 'Cota de hoje esgotada', tone: 'warn', note: QUOTA_NOTE });
  // Sem a chave a cota nem chega a ser usada: vale "IA não configurada".
  assert.equal(healthLabel({ ...health, ai_configured: false }).text, 'IA não configurada');
});

test('healthLabel: sem model_in_use vale model; sem calls_today não há contador; o modelo vem à parte do resto', () => {
  const plain = healthLabel({ ai_configured: true, model: 'gemini-flash-latest', calls_today: 3 });
  assert.equal(plain.text, 'IA ativa · gemini-flash-latest · 3 chamadas deste computador');
  assert.equal(plain.model, 'gemini-flash-latest');
  const quiet = healthLabel({ ai_configured: true, model_in_use: 'gemini-2.5' });
  assert.deepEqual([quiet.text, quiet.model, quiet.count], ['IA ativa · gemini-2.5', 'gemini-2.5', '']);
  const bare = healthLabel({ ai_configured: true });
  assert.deepEqual([bare.text, bare.model, bare.count], ['IA ativa', '', '']);
  // Nos outros estados não há modelo: o selo mostra só o text.
  for (const health of [null, false, { ai_configured: false, model: 'x' }]) assert.equal(healthLabel(health).model, undefined);
});

test('healthLabel: com o teto do grupo, "8 de 40 chamadas hoje", âmbar a partir de 80% e "Teto do dia atingido" no teto', () => {
  const health = { ai_configured: true, model_in_use: 'gemini-2.5-flash', quota_exhausted: false, daily_limit: 40 };
  assert.deepEqual(healthLabel({ ...health, calls_today: 8 }), {
    text: 'IA ativa · gemini-2.5-flash · 8 de 40 chamadas hoje',
    tone: 'ok',
    model: 'gemini-2.5-flash',
    count: '8 de 40 chamadas hoje',
    note: QUOTA_NOTE,
  });
  const tones = [0, 31, 32, 39].map(calls_today => healthLabel({ ...health, calls_today }));
  assert.deepEqual(tones.map(l => [l.count, l.tone]), [
    ['0 de 40 chamadas hoje', 'ok'], ['31 de 40 chamadas hoje', 'ok'],
    ['32 de 40 chamadas hoje', 'warn'], ['39 de 40 chamadas hoje', 'warn'],
  ]);
  assert.deepEqual(healthLabel({ ...health, calls_today: 40 }), { text: 'Teto do dia atingido', tone: 'warn', note: QUOTA_NOTE });
  // O teto vem antes da cota esgotada: é ele que desliga os botões da IA.
  assert.equal(healthLabel({ ...health, calls_today: 40, quota_exhausted: true }).text, 'Teto do dia atingido');
  assert.equal(healthLabel({ ...health, calls_today: 3, quota_exhausted: true }).text, 'Cota de hoje esgotada');
  assert.equal(healthLabel({ ...health, daily_limit: 1, calls_today: 0 }).count, '0 de 1 chamada hoje');
  // Sem teto (null, ou o backend antigo, sem o campo), o texto e o tom não mudam.
  for (const daily_limit of [null, undefined, 0]) {
    const label = healthLabel({ ...health, daily_limit, calls_today: 39 });
    assert.deepEqual([label.text, label.tone], ['IA ativa · gemini-2.5-flash · 39 chamadas deste computador', 'ok']);
  }
});

test('capReached: só com teto e as chamadas de hoje nele; sem teto ou sem resposta da saúde, nunca', () => {
  assert.equal(capReached({ daily_limit: 40, calls_today: 40 }), true);
  assert.equal(capReached({ daily_limit: 3, calls_today: 4 }), true);
  assert.equal(capReached({ daily_limit: 40, calls_today: 39 }), false);
  for (const health of [null, false, undefined, {}, { calls_today: 500 }, { daily_limit: null, calls_today: 500 },
    { daily_limit: 40 }]) {
    assert.equal(capReached(health), false, JSON.stringify(health));
  }
});

test('errorText: cada código do mapa vira uma frase simples, e o código fica nos detalhes técnicos', () => {
  const said = 'Limite de chamadas por minuto atingido. Tente de novo em 20 segundos.';
  assert.deepEqual(
    errorText({ code: 'AI_RATE_LIMITED', message: said, provider_status: 'RESOURCE_EXHAUSTED', retry_after: 20 }, 429),
    {
      message: 'Muitos pedidos em pouco tempo. Os botões da IA voltam sozinhos em alguns segundos.',
      tech: 'AI_RATE_LIMITED · RESOURCE_EXHAUSTED · ' + said,
      wait: 20,
    }
  );
  const cases = {
    AI_QUOTA_EXCEEDED: 'A cota de hoje da IA acabou. Enquanto isso, estude o que já está na Biblioteca.',
    AI_NOT_CONFIGURED: 'A IA não está ligada neste computador. Quem instalou o Cérebro precisa configurar a chave. ' +
      'Enquanto isso, use a demonstração.',
    AI_MODEL_NOT_FOUND: 'A IA recusou o pedido por um problema de configuração. Mostre os detalhes técnicos a quem ' +
      'instalou o Cérebro.',
  };
  for (const [code, message] of Object.entries(cases)) {
    const error = errorText({ code, message: 'Frase do backend com .env.', provider_status: 'NOT_FOUND' }, 502);
    assert.deepEqual(error, { message, tech: code + ' · NOT_FOUND · Frase do backend com .env.', wait: 0 }, code);
  }
  for (const code of Object.keys(ERRORS)) {
    const { message } = errorText({ code, message: 'x', provider_status: '' }, 502);
    assert.equal(message, ERRORS[code]);
    assert.doesNotMatch(message, /\[|AI_/, code);
  }
});

test('errorText: no teto do dia, a frase diz o que funciona sem IA, e a do backend, com o número, fica nos detalhes', () => {
  const said = 'As 40 chamadas de hoje, o teto escolhido pelo grupo, já foram usadas. A contagem recomeça amanhã.';
  assert.deepEqual(errorText({ code: 'AI_BUDGET_REACHED', message: said, provider_status: '' }, 429), {
    message: 'As chamadas de IA de hoje chegaram ao teto escolhido pelo grupo. Os botões da IA voltam amanhã; ' +
      'enquanto isso, a Biblioteca, os flashcards, o quiz e o caderno de erros funcionam sem ela.',
    tech: 'AI_BUDGET_REACHED · ' + said,
    wait: 0,
  });
});

test('rateAtCap: no teto, a espera do limite por minuto diz o teto, sem a contagem; os outros erros não mudam', () => {
  const said = 'Limite de chamadas por minuto atingido. Tente de novo em 3 segundos.';
  const detail = { code: 'AI_RATE_LIMITED', message: said, provider_status: 'RESOURCE_EXHAUSTED', retry_after: 3 };
  // until: a hora da volta, que o App põe no erro do limite por minuto (callAI).
  const rate = { ...errorText(detail, 429), until: 1000 };
  // A geração põe o começo dela na frase ("Não deu para gerar o material."): ele fica.
  assert.deepEqual(rateAtCap({ ...rate, message: 'Não deu para gerar o material. ' + rate.message }), {
    message: 'Não deu para gerar o material. ' + ERRORS.AI_BUDGET_REACHED,
    tech: 'AI_RATE_LIMITED · RESOURCE_EXHAUSTED · ' + said,
    wait: 3,
    until: 0,
  });
  assert.equal(rateAtCap(rate).message, ERRORS.AI_BUDGET_REACHED);
  const other = errorText({ code: 'AI_PROVIDER_ERROR', message: 'x', provider_status: '' }, 502);
  assert.equal(rateAtCap(other), other);
  assert.equal(rateAtCap(null), null);
});

test('errorText: código fora do mapa fica com a frase do backend, sem repeti-la nos detalhes', () => {
  assert.deepEqual(
    errorText({ code: 'INVALID_INPUT', message: 'O texto está curto demais.', provider_status: '' }, 422),
    { message: 'O texto está curto demais.', tech: 'INVALID_INPUT', wait: 0 }
  );
  assert.deepEqual(
    errorText({ code: 'AI_INCOMPLETE_RESPONSE', message: 'A IA interrompeu a resposta.', provider_status: 'MAX_TOKENS' }, 502),
    { message: 'A IA interrompeu a resposta.', tech: 'AI_INCOMPLETE_RESPONSE · MAX_TOKENS', wait: 0 }
  );
  assert.deepEqual(errorText('Serviço fora do ar', 503), { message: 'Serviço fora do ar', tech: 'HTTP 503', wait: 0 });
});

test('errorText: detail em lista (formato antigo) ou ausente continua em português, com o HTTP nos detalhes', () => {
  const old = [{ type: 'string_too_short', loc: ['body', 'content'], msg: 'String should have at least 3 characters' }];
  assert.deepEqual(errorText(old, 422), { message: 'Pedido recusado: confira o texto e tente de novo.', tech: 'HTTP 422', wait: 0 });
  const general = 'O Cérebro não conseguiu atender o pedido. Tente de novo.';
  assert.deepEqual(errorText(undefined, 500), { message: general, tech: 'HTTP 500', wait: 0 });
  assert.deepEqual(errorText(null, 502), { message: general, tech: 'HTTP 502', wait: 0 });
  assert.deepEqual(errorText({ code: 'AI_ERROR' }, 502), { message: general, tech: 'AI_ERROR', wait: 0 });
});

test('errorText: a espera vem do retry_after, em segundos inteiros; sem ele é zero', () => {
  const wait = retry_after => errorText({ code: 'AI_RATE_LIMITED', message: 'x', retry_after }, 429).wait;
  assert.deepEqual([wait(20), wait(1), wait(2.4), wait(undefined), wait(0), wait(-3), wait('logo')], [20, 1, 3, 0, 0, 0, 0]);
});

test('pauseNotice: na espera do limite por minuto a contagem toma o lugar do erro, menos o do arquivo no Estudar', () => {
  const until = Date.now() + 40000;
  const countdown = { message: ERRORS.AI_RATE_LIMITED, until };
  assert.equal(pauseNotice({ until: 0, page: 'Estudar', error: null }), null);
  assert.deepEqual(pauseNotice({ until, page: 'Estudar', error: null }), countdown);
  // O erro que já conta esta espera fica; o que veio antes dela dá lugar à contagem.
  assert.equal(pauseNotice({ until, page: 'Estudar', error: { message: ERRORS.AI_RATE_LIMITED, until } }), null);
  assert.deepEqual(pauseNotice({ until, page: 'Estudar', error: { message: 'Escreva um tema.' } }), countdown);
  // O PDF digitalizado aberto na espera: o aviso dele aparece na hora, no Estudar. No Dúvidas, onde o botão de enviar
  // está desligado, vale a contagem.
  const file = { message: 'Este PDF não tem texto, só imagem.', file: true };
  assert.equal(pauseNotice({ until, page: 'Estudar', error: file }), null);
  assert.deepEqual(pauseNotice({ until, page: 'Dúvidas', error: file }), countdown);
  // Página sem botões da IA, ou o resumo com a explicação que falhou contando a espera: nada.
  assert.equal(pauseNotice({ until, page: 'Biblioteca', error: null }), null);
  assert.equal(pauseNotice({ until, page: 'Resumos', error: null, counted: true }), null);
  assert.deepEqual(pauseNotice({ until, page: 'Quizzes', error: null }), countdown);
  // No teto do dia, nada: os botões da IA não voltam no fim da espera (rateAtCap).
  assert.equal(pauseNotice({ until, page: 'Estudar', error: null, capped: true }), null);
  assert.equal(pauseNotice({ until, page: 'Dúvidas', error: file, capped: true }), null);
});

test('ERRORS e FAILS: nenhuma frase para o aluno fala de backend, Python, proxy, Vite, .env ou código entre colchetes', () => {
  for (const text of [...Object.values(ERRORS), ...Object.values(FAILS)]) {
    for (const word of ['backend', 'Python', 'proxy', 'Vite', '.env', 'Não foi possível', '[']) {
      assert.ok(!text.includes(word), word + ' em: ' + text);
    }
  }
  // A frase do Cérebro desligado diz o que fazer.
  assert.equal(FAILS.off, 'O Cérebro não está ligado neste computador. Abra o iniciar.ps1 de novo e tente outra vez.');
});

test('dictate: soma o trecho ditado ao texto do editor e corta em 20.000 caracteres', () => {
  assert.equal(dictate('', 'olá'), 'olá');
  assert.equal(dictate('Texto', 'ditado agora'), 'Texto ditado agora');
  assert.equal(dictate('a'.repeat(19990), 'b'.repeat(50)), 'a'.repeat(19990) + ' ' + 'b'.repeat(9));
  assert.equal(dictate('a'.repeat(20000), 'mais'), 'a'.repeat(20000));
});

test('capText: corta em 20.000, contados como o contador do editor, sem deixar meio emoji no fim', () => {
  assert.equal(capText('curto'), 'curto');
  assert.equal(capText('a'.repeat(20000)), 'a'.repeat(20000));
  assert.equal(capText('a'.repeat(20005)), 'a'.repeat(20000));
  assert.equal(capText('a'.repeat(19998) + '😀'), 'a'.repeat(19998) + '😀', 'o emoji que termina em 20.000 fica');
  assert.equal(capText('a'.repeat(19999) + '😀'), 'a'.repeat(19999), 'o emoji cortado ao meio sai inteiro');
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

test('validMaterial: o texto do material, quando existe, é texto de até 20.000 caracteres', () => {
  assert.equal(validMaterial({ ...GOOD, texto: EXAMPLE }), true);
  assert.equal(validMaterial({ ...GOOD, texto: 'a'.repeat(20000) }), true);
  assert.equal(validMaterial({ ...GOOD, texto: null }), true, 'material de antes do campo continua valendo');
  for (const value of ['a'.repeat(20001), 5, true, {}, ['texto']]) {
    assert.equal(validMaterial({ ...GOOD, texto: value }), false, 'texto = ' + JSON.stringify(value).slice(0, 30));
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

test('addMistake: a questão errada entra com o material, a área, a data do erro e o degrau 0, e volta amanhã', () => {
  // Errou às 22h do dia 16: no Brasil, em UTC já é dia 17; no relógio do aluno ela volta no dia 17.
  assert.deepEqual(addMistake(frozen([]), Q_SHORT, 'Inflação', 'Economia', today()), [{
    key: 'inflacao|qual e a sigla da soma das riquezas?',
    item: Q_SHORT,
    title: 'Inflação',
    area: 'Economia',
    date: today().toISOString(),
    step: 0,
    due: '2026-11-17',
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
  assert.deepEqual(list, [{ ...first, date: today().toISOString(), step: 0, due: '2026-11-17' }, other]);
  assert.equal(addMistake(list, Q_SHORT, 'INFLACAO', 'Economia', today()).length, 2, 'sem acento é o mesmo material');
  assert.equal(addMistake(list, Q_SHORT, 'Juros', 'Economia', today()).length, 3, 'a mesma questão em outro material');
});

test('addMistake: errar no meio da escada volta a questão ao degrau 0, e ela volta amanhã', () => {
  const climbed = { ...mistake(Q_SHORT, 'Inflação', 5), step: 2, due: '2026-11-16' };
  const [entry] = addMistake(frozen([climbed]), Q_SHORT, 'Inflação', 'Economia', today());
  assert.deepEqual([entry.step, entry.due, entry.date], [0, '2026-11-17', today().toISOString()]);
});

test('clearMistake: acertar antes do dia marcado não muda nada, também no mesmo dia do erro', () => {
  // Errou às 20h e acertou às 22h: no Brasil, em UTC já é o dia seguinte; no relógio do aluno, não.
  const list = frozen([mistake(Q_SHORT, 'Inflação', 16, 20), mistake(Q_MULTIPLE, 'Inflação', 16, 9)]);
  assert.deepEqual(clearMistake(list, list[0].key, today()), list);
  assert.deepEqual(clearMistake(list, list[1].key, today()), list);
  const waiting = frozen([{ ...mistake(Q_SHORT, 'Inflação', 10), step: 1, due: '2026-11-17' }]);
  assert.deepEqual(clearMistake(waiting, waiting[0].key, today()), waiting, 'no degrau 1, na véspera do dia marcado');
});

test('clearMistake: o erro de antes da escada vale o degrau 0 e volta no dia seguinte ao erro; as outras ficam', () => {
  // Errou às 23h do dia 15 e acertou à 0h30 do dia 16: no Brasil, em UTC é o mesmo dia; no relógio do aluno, não.
  const list = frozen([mistake(Q_SHORT, 'Inflação', 15, 23), mistake(Q_MULTIPLE, 'Inflação', 15, 23)]);
  assert.deepEqual(
    clearMistake(list, list[0].key, new Date(2026, 10, 16, 0, 30)),
    [{ ...list[0], step: 1, due: '2026-11-19' }, list[1]]
  );
  assert.deepEqual(clearMistake(list, list[1].key, today()), [list[0], { ...list[1], step: 1, due: '2026-11-19' }]);
  assert.deepEqual(clearMistake(list, 'outra|chave', today()), list);
});

test('clearMistake: no dia marcado sobe um degrau (volta em 3 e depois em 7 dias), e o terceiro acerto tira a questão', () => {
  const on = step => frozen([{ ...mistake(Q_SHORT, 'Inflação', 1), step, due: '2026-11-16' }]);
  assert.deepEqual(clearMistake(on(0), on(0)[0].key, today()), [{ ...on(0)[0], step: 1, due: '2026-11-19' }]);
  assert.deepEqual(clearMistake(on(1), on(1)[0].key, today()), [{ ...on(1)[0], step: 2, due: '2026-11-23' }]);
  assert.deepEqual(clearMistake(on(2), on(2)[0].key, today()), [], 'o terceiro acerto');
});

test('clearMistake: acerto dias depois do marcado também sobe, e a volta conta de hoje', () => {
  const late = frozen([{ ...mistake(Q_SHORT, 'Inflação', 1), step: 1, due: '2026-11-04' }]);
  assert.deepEqual(clearMistake(late, late[0].key, today()), [{ ...late[0], step: 2, due: '2026-11-23' }]);
});

test('caderno: a escada inteira são 3 acertos em dias diferentes, e um erro no meio volta ao começo', () => {
  const key = mistakeKey('Inflação', Q_SHORT.question);
  const day = (d, hour = 9) => new Date(2026, 10, d, hour);
  const wrong = (list, d) => addMistake(list, Q_SHORT, 'Inflação', 'Economia', day(d));
  const right = (list, d) => clearMistake(list, key, day(d));
  const ladder = list => list.map(e => [e.step, e.due]);
  let list = wrong([], 1);
  list = right(right(list, 1), 2); // o acerto do dia 1, logo depois do erro, não conta; o do dia 2 sobe
  assert.deepEqual(ladder(list), [[1, '2026-11-05']]);
  list = right(list, 4); // antes do dia marcado: nada muda
  list = right(list, 6); // dia 5 já passou: sobe e volta em 7 dias
  assert.deepEqual(ladder(list), [[2, '2026-11-13']]);
  list = wrong(list, 8); // errou no degrau 2: volta ao começo
  assert.deepEqual(ladder(list), [[0, '2026-11-09']]);
  list = right(right(right(list, 9), 12), 19);
  assert.deepEqual(list, [], 'dias 9, 12 e 19: 3 acertos, cada um no dia marcado');
});

test('stepOf e dueOf: erro de antes da escada, ou com degrau ou dia estragado, está no degrau 0 e volta no dia seguinte', () => {
  const old = mistake(Q_SHORT, 'Inflação', 14, 22);
  assert.deepEqual([stepOf(old), dueOf(old)], [0, '2026-11-15']);
  for (const step of ['1', 7, -1, 1.5, null, 3]) assert.equal(stepOf({ ...old, step }), 0, JSON.stringify(step));
  for (const step of [0, 1, 2]) assert.equal(stepOf({ ...old, step }), step);
  for (const due of ['ontem', '2026-11-31', '2026-11-7', 20261120, null]) {
    assert.equal(dueOf({ ...old, due }), '2026-11-15', JSON.stringify(due));
  }
  assert.equal(dueOf({ ...old, due: '2026-11-20' }), '2026-11-20');
});

test('dueMistakes: só as que voltam hoje ou antes, das mais atrasadas às mais novas; item estragado não entra', () => {
  const today16 = { ...mistake(Q_SHORT, 'Inflação', 10), step: 1, due: '2026-11-16' };
  const late = mistake(Q_MULTIPLE, 'Juros', 11); // de antes da escada: voltava no dia 12
  const tomorrow = { ...mistake(Q_SHORT, 'Juros', 16), step: 0, due: '2026-11-17' };
  const same = { ...mistake(Q_MULTIPLE, 'Inflação', 12), step: 2, due: '2026-11-16' };
  const list = frozen([today16, null, late, tomorrow, { key: 'x', due: '2026-11-01' }, same]);
  assert.deepEqual(dueMistakes(list, today()), [late, today16, same]);
  assert.deepEqual(dueMistakes([], today()), []);
});

test('Refazer os de hoje: no máximo 10 questões por vez, as mais atrasadas primeiro', () => {
  // A questão i voltava há i dias.
  const list = Array.from({ length: 12 }, (_, i) => ({
    ...mistake({ ...Q_SHORT, question: 'Questão ' + i }, 'Inflação', 10), due: addDays('2026-11-16', -i),
  }));
  const due = dueMistakes(list, today());
  assert.equal(due.length, 12, 'a contagem é de todas as de hoje');
  assert.deepEqual(
    dayMistakes(due).map(e => e.item.question),
    Array.from({ length: 10 }, (_, k) => 'Questão ' + (11 - k)),
    'da questão 11 (a mais atrasada) à 2'
  );
  assert.deepEqual(dayMistakes(due.slice(0, 3)), due.slice(0, 3), 'com menos de 10, vêm todas');
});

test('backOn: para hoje (também a atrasada), volta amanhã ou volta em dia e mês', () => {
  assert.equal(backOn('2026-11-16', '2026-11-16'), 'para hoje');
  assert.equal(backOn('2026-11-02', '2026-11-16'), 'para hoje');
  assert.equal(backOn('2026-11-17', '2026-11-16'), 'volta amanhã');
  assert.equal(backOn('2026-11-23', '2026-11-16'), 'volta em 23/11');
  assert.equal(backOn('2026-12-01', '2026-11-30'), 'volta amanhã');
  assert.equal(backOn('2027-01-02', '2026-12-30'), 'volta em 02/01');
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
  assert.deepEqual(
    clearMistake(added, added[3].key, new Date(2026, 10, 17, 9)), [...junk, { ...added[3], step: 1, due: '2026-11-20' }]
  );
  assert.deepEqual(removeMistake(added, added[3].key), junk);
  // Item estragado com a chave da questão: sem data, ele não tem dia de volta e fica como está.
  const broken = [{ key: added[3].key }, ...junk];
  assert.deepEqual(clearMistake(broken, added[3].key, today()), broken);
});

test('validMistake: aceita o que addMistake grava, dos três tipos de questão e de material antigo', () => {
  for (const q of [Q_SHORT, Q_MULTIPLE, ...GOOD.quiz]) {
    const [entry] = addMistake([], q, 'Inflação', 'Economia', today());
    assert.equal(validMistake(entry), true, q.question);
    assert.equal(validMistake(JSON.parse(JSON.stringify(entry))), true, 'gravado e lido: ' + q.question);
  }
  // O erro de antes da escada, sem degrau nem dia de volta, continua valendo: stepOf e dueOf completam.
  assert.equal(validMistake(mistake(Q_SHORT, 'Inflação', 14)), true);
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

test('explainRequest: título e texto do tópico, a explicação sem os espaços das pontas, área e nível', () => {
  const topic = { concept: 'Condensação', text: 'O vapor se condensa em gotículas e forma as nuvens.', source: 'trecho' };
  assert.deepEqual(explainRequest(topic, '  É o vapor que esfria.\n', 'Escolar', 'Básico'), {
    concept: 'Condensação',
    content: 'O vapor se condensa em gotículas e forma as nuvens.',
    answer: 'É o vapor que esfria.',
    area: 'Escolar',
    level: 'Básico',
  });
});

test('explainRequest: corta nos limites do backend (300, 3.000 e 1.000) por caractere inteiro, sem deixar meio emoji', () => {
  const topic = { concept: 'c'.repeat(299) + '🌧️', text: 't'.repeat(2999) + '😀😀' };
  const sent = explainRequest(topic, 'e'.repeat(999) + '😀😀', 'Escolar', 'Avançado');
  assert.equal(sent.concept, 'c'.repeat(299) + '🌧');
  assert.equal(sent.content, 't'.repeat(2999) + '😀');
  assert.equal(sent.answer, 'e'.repeat(999) + '😀');
  for (const [field, size] of [['concept', 300], ['content', 3000], ['answer', 1000]]) {
    assert.equal([...sent[field]].length, size, field);
    assert.ok(!/[\uD800-\uDBFF]$/.test(sent[field]), field + ' sem meio emoji no fim');
  }
  // Dentro dos limites, nada é cortado.
  assert.equal(explainRequest({ concept: 'Luz', text: 'A planta usa luz.' }, '😀'.repeat(1000), 'Escolar', 'Básico').answer,
    '😀'.repeat(1000));
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
  cartoes: [boxOf('Fotossíntese', 'Onde ocorre?', 2, '2026-11-18', at(15))],
  user: { name: 'Ana', area: 'Economia' },
};
// O arquivo lido de novo a cada teste, para um teste não mexer no que o outro usa.
const backup = () => readBackup(JSON.stringify(BACKUP));
const EMPTY = { saved: [], events: [], erros: [], cartoes: [] };
// Nada ficou de fora do arquivo.
const NONE = { saved: 0, events: 0, erros: 0, cartoes: 0 };

test('readBackup: arquivo bom devolve as quatro listas, nada de fora e o perfil', () => {
  assert.deepEqual(backup(), {
    saved: BACKUP.saved, events: BACKUP.events, erros: BACKUP.erros, cartoes: BACKUP.cartoes, fora: NONE,
    user: { name: 'Ana', area: 'Economia' },
  });
});

test('readBackup: backup de antes da revisão espaçada, sem cartoes e com erros sem degrau, continua valendo', () => {
  const { cartoes, ...old } = BACKUP;
  assert.deepEqual(readBackup(JSON.stringify(old)), { ...backup(), cartoes: [] });
  assert.equal(stepOf(backup().erros[0]), 0);
  assert.equal(dueOf(backup().erros[0]), '2026-11-16', 'o erro do dia 15 volta no dia 16');
});

test('readBackup: caixa de cartão estragada fica de fora e é contada', () => {
  const bad = [{ ...BACKUP.cartoes[0], box: 7 }, { ...BACKUP.cartoes[0], due: 'amanhã' }, null];
  const got = readBackup(JSON.stringify({ ...BACKUP, cartoes: [...bad, ...BACKUP.cartoes] }));
  assert.deepEqual(got, { ...backup(), fora: { ...NONE, cartoes: 3 } });
  assert.deepEqual(readBackup(JSON.stringify({ ...BACKUP, cartoes: 'x' })).cartoes, [], 'cartoes que não é lista');
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
    saved: [], events: [BACKUP.events[1]], erros: BACKUP.erros, cartoes: [],
    fora: { saved: 3, events: 2, erros: 2, cartoes: 0 }, user: null,
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

test('readBackup: material da demonstração mantém a marca semIA, e o de um exemplo, as marcas ia e pronto', () => {
  const made = demo(EXAMPLE);
  const fromDemo = { ...made, summary: markExample(made.summary, '', EXAMPLE), id: 2, date: at(11), area: 'Escolar' };
  assert.ok(fromDemo.summary.every(s => s.pronto), 'demonstração feita do exemplo pronto');
  const fromExample = { ...BACKUP.saved[0], id: 3, date: at(12) };
  fromExample.summary = [
    { concept: 'Clorofila', text: 'Absorve a luz.', source: 'A clorofila absorve a luz', ia: true },
    { concept: 'Calvin', text: 'Fixa o carbono.', source: 'o gás carbônico é fixado', pronto: true },
  ];
  assert.deepEqual(readBackup(JSON.stringify({ ...BACKUP, saved: [fromDemo, fromExample] })).saved, [fromDemo, fromExample]);
});

test('readBackup: o material entra com o texto de onde saiu; com texto acima do limite fica de fora e é contado', () => {
  const withText = { ...BACKUP.saved[0], texto: EXAMPLE };
  const tooLong = { ...withText, id: 2, texto: 'a'.repeat(20001) };
  const got = readBackup(JSON.stringify({ ...BACKUP, saved: [withText, tooLong] }));
  assert.deepEqual(got.saved, [withText]);
  assert.deepEqual(got.fora, { ...NONE, saved: 1 });
});

test('readBackup: o arquivo de exemplo da janela "Ver no texto" traz um material com o texto e os trechos nele', () => {
  const file = readFileSync(new URL('./fixtures/material-com-texto.json', import.meta.url), 'utf8');
  const { saved, fora } = readBackup(file);
  assert.deepEqual(fora, NONE);
  assert.equal(saved.length, 1);
  const { texto, summary } = saved[0];
  assert.ok(summary.length > 0 && summary.every(s => findSource(texto, s.source)));
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
  const { saved, events, erros, cartoes } = backup();
  assert.deepEqual(mergeBackup(EMPTY, backup()), { saved, events, erros, cartoes });
});

test('mergeBackup: importar duas vezes o mesmo arquivo não duplica', () => {
  const once = mergeBackup(EMPTY, backup());
  assert.deepEqual(mergeBackup(once, backup()), once);
  const current = {
    saved: [{ ...GOOD, title: 'Outro', id: 7, date: at(12) }],
    events: [quizAt(14, 3, true)],
    erros: [mistake(Q_MULTIPLE, 'Juros', 14)],
    cartoes: [boxOf('Juros', 'O que é a Selic?', 1, '2026-11-15')],
  };
  const merged = mergeBackup(current, backup());
  assert.deepEqual([merged.saved.length, merged.events.length, merged.erros.length, merged.cartoes.length], [2, 3, 2, 2]);
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

test('mergeBackup: o mesmo erro em degraus diferentes fica com o degrau mais alto; um erro mais novo volta ao 0', () => {
  const base = mistake(Q_SHORT, 'Inflação', 10);
  const step0 = { ...base, step: 0, due: '2026-11-11' };
  const step2 = { ...base, step: 2, due: '2026-11-20' };
  const merge = (here, file) => mergeBackup({ ...EMPTY, erros: [here] }, { ...EMPTY, erros: [file] }).erros;
  assert.deepEqual(merge(step0, step2), [step2], 'a mesma data: os acertos do arquivo entram');
  assert.deepEqual(merge(step2, step0), [step2], 'a mesma data: os acertos daqui ficam');
  assert.deepEqual(merge(step2, base), [step2], 'o erro de antes da escada vale o degrau 0');
  const wrongAgain = { ...mistake(Q_SHORT, 'Inflação', 15), step: 0, due: '2026-11-16' };
  assert.deepEqual(merge(step2, wrongAgain), [wrongAgain], 'errou de novo depois: a data mais nova vence');
  assert.deepEqual(merge(wrongAgain, step2), [wrongAgain]);
  const twice = mergeBackup({ ...EMPTY, erros: [step0] }, { ...EMPTY, erros: [step2] });
  assert.deepEqual(mergeBackup(twice, { ...EMPTY, erros: [step2] }), twice, 'importar de novo não muda nada');
});

test('mergeBackup: cartão com a mesma chave fica com a mudança mais recente', () => {
  const here = boxOf('Juros', 'O que é a Selic?', 3, '2026-11-20', at(13));
  const file = boxOf('Juros', 'O que é a Selic?', 1, '2026-11-16', at(15));
  const other = boxOf('Inflação', 'O que é inflação?', 2, '2026-11-18', at(14));
  const merge = (a, b) => mergeBackup({ ...EMPTY, cartoes: a }, { ...EMPTY, cartoes: b }).cartoes;
  assert.deepEqual(merge([here], [file, other]), [file, other]);
  assert.deepEqual(merge([file], [here]), [file], 'a mudança daqui é mais nova');
  assert.deepEqual(merge([here], [here]), [here]);
});

test('mergeBackup: o que a tela ignora continua gravado, e nada do que entra na função é alterado', () => {
  const current = Object.freeze({
    saved: frozen([null, 'texto']), events: frozen(['texto', { kind: 'quiz' }]), erros: frozen([null, { key: 5 }]),
    cartoes: frozen([null, { key: 5 }]),
  });
  const file = Object.freeze({
    saved: frozen(backup().saved), events: frozen(backup().events), erros: frozen(backup().erros),
    cartoes: frozen(backup().cartoes),
  });
  assert.deepEqual(mergeBackup(current, file), {
    saved: [...BACKUP.saved, null, 'texto'],
    events: ['texto', { kind: 'quiz' }, ...BACKUP.events],
    erros: [null, { key: 5 }, ...BACKUP.erros],
    cartoes: [null, { key: 5 }, ...BACKUP.cartoes],
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
  const newerBox = { ...backup(), cartoes: [{ ...BACKUP.cartoes[0], box: 3, date: at(16) }] };
  assert.equal(backupNote(once, mergeBackup(once, newerBox)), 'Desempenho e caderno de erros atualizados');
});

test('backupNote: no histórico compactado, a resposta anterior do backup muda o acerto sem mudar o tamanho', () => {
  // Como o Importar do App: as duas listas compactadas. Gravado, a questão 1 errada às 10h do dia 14; o backup traz um
  // acerto às 8h do mesmo dia. Ele vira a primeira resposta, a das 10h sai, e o acerto vai de 0% a 100%.
  const before = { ...EMPTY, events: compactEvents([quizAt(14, 1, false, { date: at(14, 10) })], today()) };
  const after = mergeBackup(before, { ...EMPTY, events: [quizAt(14, 1, true, { date: at(14, 8) })] });
  after.events = compactEvents(after.events, today());
  assert.equal(after.events.length, before.events.length);
  assert.deepEqual([quizRate(before.events).rate, quizRate(after.events).rate], [0, 100]);
  assert.equal(backupNote(before, after), 'Desempenho e caderno de erros atualizados');
  // O item estragado que mergeBackup leva para o começo da lista não é novidade: a tela não o mostra.
  const broken = { ...EMPTY, events: [quizAt(16, 1, false), 'texto'] };
  const again = mergeBackup(broken, { ...EMPTY, events: [quizAt(16, 1, false)] });
  assert.equal(backupNote(broken, again), 'Nada novo neste arquivo');
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
    backupNote(junto, junto, { ...NONE, cartoes: 2 }),
    'Nada novo neste arquivo. Ficaram de fora, por estarem incompletos: 2 cartões com data de volta.'
  );
  assert.equal(
    backupNote(junto, junto, { ...NONE, events: 2, erros: 1 }),
    'Nada novo neste arquivo. Ficaram de fora, por estarem incompletos: 2 respostas e 1 questão do caderno de erros.'
  );
  assert.equal(backupNote(junto, junto, NONE, 'Bia'), 'Nada novo neste arquivo. Perfil de Bia importado.');
});

test('backupSummary: o que foi no arquivo, no singular e no plural, contado como a tela mostra', () => {
  const one = { saved: BACKUP.saved, events: [BACKUP.events[0]], erros: BACKUP.erros, cartoes: BACKUP.cartoes };
  assert.equal(
    backupSummary(one),
    'Backup gerado: 1 material, 1 resposta, 1 questão do caderno de erros e 1 cartão com data de volta.'
  );
  assert.equal(
    backupSummary(EMPTY),
    'Backup gerado: 0 materiais, 0 respostas, 0 questões do caderno de erros e 0 cartões com data de volta.'
  );
  const two = {
    saved: [...BACKUP.saved, { ...BACKUP.saved[0], id: 2 }, null],
    events: [...BACKUP.events, { kind: 'quiz' }],
    erros: [...BACKUP.erros, mistake(Q_MULTIPLE, 'Juros', 14), 'texto'],
    cartoes: [...BACKUP.cartoes, boxOf('Juros', 'O que é a Selic?', 4, '2026-12-01'), { box: 2 }],
  };
  assert.equal(
    backupSummary(two),
    'Backup gerado: 2 materiais, 2 respostas, 2 questões do caderno de erros e 2 cartões com data de volta.'
  );
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
