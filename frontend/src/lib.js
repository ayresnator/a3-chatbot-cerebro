// Lógica pura do Cérebro: sem React e sem tela, para o Node conferir em tests/lib.test.js.

export const AREAS = ['Tecnologia', 'Administração', 'Economia', 'Matemática', 'Direito', 'Escolar'];
export const LEVELS = ['Básico', 'Intermediário', 'Avançado'];
// A nota de cada nível no menu do editor: o que muda no vocabulário e na profundidade (backend, prompts.py).
export const LEVEL_NOTES = {
  Básico: 'Linguagem simples, sem jargão',
  Intermediário: 'Um pouco mais de detalhe',
  Avançado: 'Com os termos técnicos da área',
};
// Limite do texto do editor, o mesmo do backend.
export const MAX_INPUT = 20000;
// Perguntas de partida de cada área: aparecem como sugestão no chat antes da primeira resposta, sem chamar a IA.
export const STARTERS = {
  Tecnologia: ['O que são hardware e software?', 'Como a internet funciona?'],
  Administração: ['O que faz um administrador?', 'O que é fluxo de caixa?'],
  Economia: ['O que é inflação?', 'Como funcionam oferta e demanda?'],
  Matemática: ['Como calcular porcentagem?', 'Como resolver uma equação do 1º grau?'],
  Direito: ['O que é a Constituição Federal?', 'O que são direitos fundamentais?'],
  Escolar: ['Como estudar melhor para uma prova?', 'Como fazer um bom resumo?'],
};
export const EXAMPLE = 'A fotossíntese é o processo pelo qual plantas transformam energia luminosa em energia química. A clorofila absorve a luz solar nos cloroplastos. Na fase clara, a água é decomposta, liberando oxigênio e produzindo ATP e NADPH. No ciclo de Calvin, o gás carbônico é fixado para produzir açúcares. Esse processo sustenta as cadeias alimentares e ajuda a regular o carbono na atmosfera.';
// Os exemplos prontos de cada área ficam em exemplos.js, fora do JavaScript da abertura.

// Espera antes da próxima letra da frase de exemplo, com shown letras já na tela: a primeira sai em 0,9 s, depois da
// entrada da página, e as outras com a espera sorteada de quem digita, de 26 a 46 ms. Assim a frase mais longa termina
// antes de 5 s (WCAG 2.2.2). random devolve de 0 a 1; os testes passam o deles.
export function typeDelay(shown, random = Math.random) {
  return shown ? 26 + random() * 20 : 900;
}

// Setas, Home e End num grupo de opções ou num menu: o índice aonde a tecla leva, dando a volta nas pontas; -1 quando
// a tecla não anda.
export function rove(key, at, count) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  return step ? (at + step + count) % count : -1;
}

// A tecla que pergunta ao Cérebro pelo editor do Estudar: Ctrl + Enter (⌘ + Enter no Mac). Lá o Enter sozinho quebra a
// linha, porque o editor guarda o texto da aula e as anotações, e cada pergunta gasta uma chamada da IA. Tecla da
// composição de texto (acento, IME) não pergunta. Recebe o evento do navegador (nativeEvent), não o do React.
export function askKey(e) {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
    !e.isComposing && e.keyCode !== 229;
}

// Um bloco de height px cabe na janela de viewport px acima da reserva da raiz (o scroll-padding-bottom calculado: no
// celular, a barra de baixo e o "Próxima questão" preso; no computador, "auto", que não reserva nada)? strip é a faixa
// presa que fica dentro do próprio bloco: ela sai da reserva, senão contaria duas vezes. No computador a faixa não é
// presa, e a reserva continua 0.
export function fitsAbove(height, viewport, reserve, strip = 0) {
  return height <= viewport - Math.max(0, (parseFloat(reserve) || 0) - strip);
}

// Chave de um dado no navegador. A demonstração (?demo) grava à parte, com o prefixo cerebro-demo-: o que se faz nela
// não entra no desempenho, no caderno de erros nem na biblioteca do app com IA, e os dados do app com IA não aparecem
// nela. O App liga a demonstração antes da primeira leitura.
let prefix = 'cerebro-';
export function demoStorage(on) {
  prefix = on ? 'cerebro-demo-' : 'cerebro-';
}
export const storageKey = k => prefix + k;

// session lê o que esta aba guardou (sessionStorage). Ele é avaliado dentro do try: no Node não existe, e o navegador
// que bloqueia o armazenamento lança erro. Nos dois casos vale o padrão.
export function read(k, d, session = false) {
  try {
    return JSON.parse((session ? sessionStorage : localStorage).getItem(storageKey(k))) ?? d;
  } catch {
    return d;
  }
}

const isText = v => typeof v === 'string';
// Data em texto, como o App grava (toISOString).
const isDate = v => isText(v) && !Number.isNaN(Date.parse(v));

// Questão do quiz no formato que a tela desenha. Vale para o material e para o caderno de erros.
const validQuestion = q =>
  !!q && ['multiple', 'boolean', 'short'].includes(q.type) && isText(q.question) &&
  Array.isArray(q.options) && q.options.every(isText) &&
  (typeof q.answer === 'number' || isText(q.answer)) && isText(q.explanation) &&
  (q.steps == null || (Array.isArray(q.steps) && q.steps.every(isText)));

// Confere o formato de um material antes de ele ir para a tela. O que vem do navegador (biblioteca, rascunho) pode
// estar estragado: um material sem summary deixava a tela branca. Só o título precisa ter texto: material gravado
// por versão antiga pode ter item em branco. source e steps são opcionais: material antigo não tem.
// area e level também são opcionais, mas, se vierem, são texto: a tela os escreve no cabeçalho do material. texto, o
// texto de onde o material saiu (a janela "Ver no texto"), também: material de antes dele não tem; se vier, é texto de
// até 20.000 caracteres, o limite do editor.
export function validMaterial(m) {
  const filled = (list, ok) => Array.isArray(list) && list.length > 0 && list.every(item => !!item && ok(item));
  const optional = v => v == null || isText(v);
  return !!m && isText(m.title) && m.title.trim() !== '' && optional(m.area) && optional(m.level) &&
    (m.texto == null || (isText(m.texto) && m.texto.length <= MAX_INPUT)) &&
    filled(m.summary, s => isText(s.concept) && isText(s.text) && optional(s.source)) &&
    filled(m.flashcards, c => isText(c.question) && isText(c.answer)) &&
    filled(m.quiz, validQuestion);
}

// Mesmo conteúdo, sem olhar id, data, área e nível. A demonstração gera sempre o mesmo material para o mesmo texto.
export function sameMaterial(a, b) {
  const content = m => JSON.stringify([m.title, m.summary, m.flashcards, m.quiz]);
  return content(a) === content(b);
}

// Id de um material que entra na biblioteca: a hora ou, se ela já foi usada, um a mais que o maior id da lista.
// Guardar o material anterior e o novo no mesmo clique (App.jsx, generate) dava o mesmo Date.now() aos dois, e excluir
// um deles apagava os dois.
export function newId(list, now = Date.now()) {
  return Math.max(now, ...list.map(m => (Number.isSafeInteger(m?.id) ? m.id + 1 : 0)));
}

// Aviso fixo onde há texto escrito pela IA.
export const AI_NOTE = 'Gerado por IA. Pode conter erros: confira com o seu material.';

// O trecho do tópico está no texto? Sem maiúsculas, sem acentos e com os espaços em sequência reduzidos a um, como o
// backend confere o trecho (main.py, plain e grounded). Os invisíveis também saem: o backend os tira do texto antes de
// conferir (models.py, visible), e o exemplo guardado na tela pode tê-los.
export function inText(source, text) {
  const needle = comparable(source).form;
  return !!needle && comparable(text).form.includes(needle);
}

// A forma de comparar do inText, montada letra a letra para guardar, de cada letra dela, onde começa e onde termina o
// caractere do texto original que a deu. O acento solto (letra e acento em dois caracteres) e o invisível colados a uma
// letra entram no fim dela: a marca não corta a letra do acento.
function comparable(text) {
  let form = '';
  const spans = [];
  let at = 0;
  let gap = false;
  for (const ch of String(text ?? '')) {
    const end = at + ch.length;
    // Invisível (Cf) e metade de emoji cortado (Cs) não contam; o espaço só vale entre duas letras. A volta pelas
    // maiúsculas desfaz as ligaduras de texto copiado de PDF (ﬁ, ﬂ) e o ß, como o casefold do backend.
    const folded = /[\p{Cf}\p{Cs}]/u.test(ch) ? '' : /\s/.test(ch) ? ' ' : fold(fold(ch).toLocaleUpperCase('pt-BR'));
    if (folded === ' ') {
      gap = form !== '';
    } else if (folded) {
      if (gap) spans.push([at, at]);
      form += (gap ? ' ' : '') + folded;
      for (let i = 0; i < folded.length; i++) spans.push([at, end]);
      gap = false;
    } else if (spans.length && !gap) {
      spans[spans.length - 1][1] = end;
    }
    at = end;
  }
  return { form, spans };
}

// Pontas que o modelo põe no trecho sem estarem no texto (main.py, grounded).
const EDGES = /^[\s.,;:…"'“”‘’«»]+|[\s.,;:…"'“”‘’«»]+$/g;

// Onde o trecho do tópico está no texto do material, pela regra do inText e do backend (main.py, plain e grounded): sem
// maiúsculas, sem acentos, sem os invisíveis e com os espaços em sequência e as quebras de linha reduzidos a um. Trecho
// que não existe como veio vale sem as pontas de pontuação e aspas, como no backend. Devolve [início, fim] no texto
// original, a parte que a janela "Ver no texto" marca (App.jsx), ou null se o trecho não está lá.
export function findSource(text, source) {
  const { form, spans } = comparable(text);
  for (const piece of [source, String(source ?? '').replace(EDGES, '')]) {
    const needle = comparable(piece).form;
    const at = needle ? form.indexOf(needle) : -1;
    if (at >= 0) return [spans[at][0], spans[at + needle.length - 1][1]];
  }
  return null;
}

// O trecho de um exemplo do "Usar um exemplo" não é do aluno: o tópico com trecho no texto que a IA escreveu (ai) leva
// a marca ia, e o com trecho no exemplo pronto (ready), a marca pronto. O App passa o último exemplo que pôs no editor.
export function markExample(summary, ai, ready) {
  return summary.map(s =>
    inText(s.source, ai) ? { ...s, ia: true } : inText(s.source, ready) ? { ...s, pronto: true } : s);
}

// O rótulo do trecho diz de que texto ele saiu.
export function sourceLabel(s) {
  const from = s.ia ? 'No exemplo escrito pela IA' : s.pronto ? 'No texto de exemplo' : 'No seu texto';
  return from + ': "' + s.source.trim() + '"';
}

// O aviso sob o título do material diz de onde ele veio: do exemplo que a própria IA escreveu (trecho com ia), de um
// exemplo pronto (trecho com pronto), de um texto do aluno (trecho conferido) ou de nada que dê para conferir (só um
// tema, ou material de antes dos trechos).
export function originNote(summary) {
  if (summary.some(s => s.ia)) return 'Feito de um exemplo escrito pela IA. Confira os fatos em uma fonte confiável.';
  if (summary.some(s => s.pronto)) return 'Gerado por IA. Pode conter erros: confira com o texto de exemplo.';
  if (summary.some(s => s.source?.trim())) return AI_NOTE;
  return 'Nenhum tópico foi conferido com um texto seu. Confira em uma fonte confiável.';
}

// De onde veio o texto do material, na mesma ordem do aviso: 'ia' (algum trecho do exemplo escrito pela IA), 'pronto'
// (de um exemplo pronto) ou '' (do aluno). A janela "Ver no texto" põe isso no título, e o texto levado de volta ao
// editor continua valendo como exemplo (App.jsx, textToEditor).
export function textOrigin(summary) {
  return summary.some(s => s.ia) ? 'ia' : summary.some(s => s.pronto) ? 'pronto' : '';
}

// Resumo ativo (#81): tentar lembrar antes de ler e esconder o texto dos tópicos. O bloco "Tente responder antes de
// ler" usa as 2 primeiras perguntas dos flashcards do material; com menos de 2 cartões ele não aparece.
export const pretestCards = flashcards => (flashcards.length >= 2 ? flashcards.slice(0, 2) : []);

// Quantas vezes seguidas o aluno pulou o bloco: a única coisa do resumo ativo gravada no navegador. A resposta escrita
// zera a conta (nextSkips). Valor estragado vale zero.
export function readSkips() {
  const skips = read('antes-de-ler', 0);
  return Number.isSafeInteger(skips) && skips > 0 ? skips : 0;
}

// O bloco abre sozinho até o aluno pulá-lo 2 vezes seguidas; depois fica fechado, no botão "Tentar antes de ler". O
// esqueleto da geração também pergunta (ui.jsx, SummarySkeleton).
export const pretestOpens = () => readSkips() < 2;

// O resumo ativo de um material aberto (of), do zero: nada escrito (tries), mostrado (shown) nem marcado (marks, pelo
// índice do tópico: true em "Lembrei", false em "Não lembrei"). O bloco começa aberto ('aberto') ou fechado (null), por
// pretestOpens. 'lido' é o bloco fechado pelo "Ler o resumo".
export function recallStart(of) {
  return { of, tries: ['', ''], pre: pretestOpens() ? 'aberto' : null, shown: {}, marks: {} };
}

// A conta de pulos (before) quando o bloco fecha. tries é o que o aluno escreveu, no "Ler o resumo" (no "Pular", nada):
// só a resposta escrita zera a conta, e o bloco fechado em branco conta como pulo. warn é o 2º pulo seguido, quando o
// bloco passa a abrir fechado.
export function nextSkips(before, tries) {
  const skips = tries.some(t => t.trim()) ? 0 : before + 1;
  return { skips, warn: skips === 2 };
}

// "Lembrei" (ok true) ou "Não lembrei" (false) no tópico i. Os botões são de alternância: apertar de novo a marca
// escolhida a tira.
export function markRecall(marks, i, ok) {
  const next = { ...marks, [i]: ok };
  if (marks[i] === ok) delete next[i];
  return next;
}

// As marcas dos count primeiros tópicos, os que a lista "Mostrar" deixa na tela: os outros não contam no placar.
export const shownMarks = (marks, count) =>
  Array.from({ length: count }, (_, i) => marks[i]).filter(ok => ok !== undefined);

// Placar do modo lembrar: marks são os tópicos já marcados, true em "Lembrei" e false em "Não lembrei". Sem tópico
// marcado não há placar.
export function recallLine(marks) {
  if (!marks.length) return '';
  return 'Você lembrou ' + marks.filter(Boolean).length + ' de ' + marks.length + ' ' +
    plural(marks.length, 'tópico', 'tópicos') + '.';
}

// Resposta registrada no desempenho. Sem data válida ela estragava a sequência de dias e o gráfico.
export function validEvent(e) {
  return !!e && isText(e.kind) && e.kind !== '' && typeof e.ok === 'boolean' && isDate(e.date);
}

// Lista gravada no navegador (biblioteca, desempenho), sem conferir os itens: quem grava parte dela inteira, para
// não apagar o que a tela ignora. Valor estragado, que não é lista, vale como lista vazia.
export function readList(k) {
  const list = read(k, []);
  return Array.isArray(list) ? list : [];
}

// Perfil local. Sem nome em texto não vale: a inicial do nome vai para o avatar.
export function readUser() {
  const user = read('user', null);
  return isText(user?.name) ? user : null;
}

// "Escrever antes de virar", nos Flashcards: a escolha gravada no navegador. Sem escolha, ou com uma que não é sim nem
// não, o campo começa ligado no computador e desligado na tela de toque, onde digitar pesa mais.
export function readWriteFirst(touch) {
  const on = read('escrever', null);
  return typeof on === 'boolean' ? on : !touch;
}

// Rascunho do que estava aberto (editor, material, conversa), gravado a cada mudança para sobreviver a um F5.
// Vale primeiro o desta aba (sessionStorage): com o app aberto em duas abas, o F5 traz o texto da própria aba, e não o
// da última que gravou. Aba nova ainda não tem o seu e abre com o último gravado (localStorage).
// Volta já conferido: o que está fora do formato sai, e rascunho ausente ou estragado dá tudo vazio.
export function readDraft() {
  const d = read('rascunho', null, true) || read('rascunho', null) || {};
  const result = validMaterial(d.result) ? d.result : null;
  const chat = Array.isArray(d.chat)
    ? d.chat.filter(m => (m?.role === 'user' || m?.role === 'assistant') && isText(m.text))
    : [];
  // Pergunta que ficou sem resposta (F5 no meio do pedido) sai, como a que falha: iria sem resposta no histórico.
  while (chat.length && chat[chat.length - 1].role === 'user') chat.pop();
  const texts = list => Array.isArray(list) && list.every(isText);
  return {
    input: isText(d.input) && d.input.length <= MAX_INPUT ? d.input : '',
    // O último exemplo que a IA escreveu e pôs no editor: o trecho que sai dele não é do aluno (App, aiExample).
    exemplo: isText(d.exemplo) && d.exemplo.length <= MAX_INPUT ? d.exemplo : '',
    // O mesmo para o último exemplo pronto (App, readyExample).
    exemploPronto: isText(d.exemploPronto) && d.exemploPronto.length <= MAX_INPUT ? d.exemploPronto : '',
    area: AREAS.includes(d.area) ? d.area : '',
    level: LEVELS.includes(d.level) ? d.level : '',
    result,
    // A marca da última geração (o texto, a área e o nível do material aberto) só vale com o material. O rascunho
    // gravado antes de um botão só de gerar traz também kinds, que fica de fora.
    made: { key: result && isText(d.made?.key) ? d.made.key : '' },
    chat,
    tips: isText(d.tips?.key) && texts(d.tips.list) ? { key: d.tips.key, list: d.tips.list } : { key: '', list: [] },
    // O aluno escolheu o texto do editor como assunto do chat, com um material aberto (chatSubject).
    editorChat: d.editorChat === true,
  };
}

// Dia no fuso do aluno. toISOString() dá o dia em UTC: no Brasil o estudo depois das 21h caía no dia seguinte.
// O dia de cada data em texto fica guardado (DAYS): o desempenho pede o dia de todas as respostas a cada mudança, e o
// App relê a lista do navegador (objetos novos) a cada resposta, então só a data em texto serve de chave.
// shortcut: uma entrada por data lida na sessão; se o histórico passar de dezenas de milhares, guardar o dia no evento.
const DAYS = new Map();
export function localDay(date) {
  let day = DAYS.get(date);
  if (day === undefined) {
    const d = new Date(date);
    day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (isText(date)) DAYS.set(date, day);
  }
  return day;
}

// Um dia no formato de localDay mais n dias do calendário (n negativo volta): 30/11 mais 1 dá 01/12. A conta é feita ao
// meio-dia, longe da virada do dia.
export function addDays(day, n) {
  return localDay(new Date(+day.slice(0, 4), day.slice(5, 7) - 1, +day.slice(8, 10) + n, 12));
}

// Dia no formato de localDay que existe no calendário: '2026-02-30' não vale.
const isDay = v => isText(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;

// Compara texto sem ligar para maiúsculas e acentos ("fotossintese" vale como "Fotossíntese").
export function fold(text) {
  return String(text).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Resposta curta: tira só a pontuação do fim e lê vírgula decimal como ponto. Apagar todo ponto e vírgula fazia "2,5" valer "25".
export function norm(text) {
  return fold(text).trim().replace(/[.!?,;:]+$/, '').replace(/(\d),(?=\d)/g, '$1.');
}

// Resposta curta pode ter formas equivalentes separadas por "|" ("PIB|Produto Interno Bruto"): qualquer uma vale.
// A resposta inteira também vale: sem isso, digitar inteira uma resposta que tem "|" ("||", "|x|") nunca era aceito.
export function shortAnswerOk(expected, value) {
  return !!norm(value) && [expected, ...String(expected).split('|')].some(a => norm(a) === norm(value));
}

// Gabarito de uma questão em texto: a opção certa ou, na resposta curta, as formas aceitas ligadas por " ou ".
// Só barras ("||", o operador OU) não tem forma separada: é a própria resposta.
export function expectedText(q) {
  if (q.type !== 'short') return q.options[q.answer] ?? String(q.answer);
  const forms = String(q.answer).split('|').map(form => form.trim()).filter(Boolean);
  return forms.length ? forms.join(' ou ') : String(q.answer);
}

// Título de um trecho na demonstração: a primeira oração inteira, até a quebra de linha, a pontuação (, ; : travessão)
// ou um conectivo ("que", "em que", "pelo qual", "e"…), sem o ponto final e com no máximo 12 palavras. Cortar num
// número fixo de palavras deixava títulos quebrados, como "No ciclo de" e "A fotossíntese é o processo pelo qual".
const CLAUSE_END = /\n|[,;:]|\s[–—]\s|\s(?:(?:em|de|com|para|por) que|(?:pel|n|d)[oa]s? qua(?:l|is)|que|onde|quando|porque|mas|e)\s/;
function clause(s) {
  const words = (s.split(CLAUSE_END)[0].replace(/[.!?…]+$/, '').trim() || s).split(/\s+/);
  return words.slice(0, 12).join(' ') + (words.length > 12 ? '…' : '');
}

export function demo(text) {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()).filter(Boolean) || [text];
  const pieces = sentences.slice(0, 8);
  return {
    title: clause(sentences[0]),
    // O trecho de cada tópico é a própria frase: a tela diz se ela saiu do texto do aluno ou do exemplo pronto.
    summary: pieces.map(s => ({ concept: clause(s), text: s, source: s })),
    flashcards: pieces.map((s, i) => ({
      question: 'Complete o trecho ' + (i + 1) + ': ' + s.split(' ').slice(0, 4).join(' ') + '…',
      answer: s,
    })),
    quiz: pieces.slice(0, 5).map((s, i) => ({
      type: i % 3 === 0 ? 'short' : i % 3 === 1 ? 'boolean' : 'multiple',
      question: i % 3 === 0 ? 'Qual palavra inicia este trecho: “…' + s.split(' ').slice(1, 8).join(' ') + '”?'
        : i % 3 === 1 ? 'Verdadeiro ou falso: ' + s
        : 'Qual trecho faz parte do material fornecido?',
      options: i % 3 === 1
        ? ['Verdadeiro', 'Falso']
        : [s, 'O texto não apresenta nenhuma informação.', 'Nenhuma das alternativas.'],
      answer: i % 3 === 0 ? s.split(' ')[0] : 0,
      explanation: 'Trecho do material: ' + s,
      steps: [],
    })),
    // Material sem nada escrito pela IA: é o único que abre sem o aviso de conteúdo gerado por IA (App).
    semIA: true,
  };
}

// A palavra no singular quando o número é 1 e no plural nos outros, o zero também ("0 cartões"). Devolve só a palavra:
// no Stat o número vai à parte, em destaque.
export const plural = (n, um, varios) => (n === 1 ? um : varios);

// Total, acertos e percentual inteiro de uma lista de respostas. Sem respostas o percentual é zero.
function tally(answers) {
  const correct = answers.filter(e => e.ok).length;
  return { total: answers.length, correct, rate: answers.length ? Math.round(correct / answers.length * 100) : 0 };
}

// Os n últimos dias, do mais antigo para hoje, no formato de localDay.
function recentDays(n, now) {
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (n - 1 - i));
    return localDay(day);
  });
}

// Respostas do quiz (ou, com kind 'flashcard', avaliações dos cartões) que contam no desempenho: de cada questão ou
// cartão (mesmo dia, mesmo material, mesmo enunciado), só a primeira. Refazer a mesma questão, ou rever o mesmo
// baralho, fazia o número subir sem o aluno saber mais.
// A lista está na ordem em que foi gravada. Evento anterior a esta regra não tem q e conta como está.
// O resultado fica guardado por lista e por tipo (FIRST): a mesma lista passa por quizRate, cardRate, weakSpot e
// chartDays a cada resposta, e pelo areaLine de cada área, com os dois tipos, a cada desenho do Desempenho. Com o tipo na
// chave, a lista pedida para os cartões não devolve as respostas do quiz guardadas antes, nem o contrário.
// shortcut: vale enquanto ninguém muda a lista no lugar (o App e o lib.js sempre criam uma nova); se isso mudar, passar
// o resultado pronto como parâmetro.
const FIRST = new WeakMap();
export function firstAttempts(events, kind = 'quiz') {
  if (!FIRST.has(events)) FIRST.set(events, {});
  const byKind = FIRST.get(events);
  if (!byKind[kind]) {
    const seen = new Set();
    byKind[kind] = events.filter(e => {
      if (e.kind !== kind) return false;
      if (!e.q) return true;
      const key = questionDay(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return byKind[kind];
}

// A questão num dia: o dia, o material e o enunciado, em texto simples (JSON.stringify em cada resposta pesava). A
// quebra de linha separa os três: o título do material não tem quebra de linha, e o enunciado vem por último.
const questionDay = e => localDay(e.date) + '\n' + e.title + '\n' + e.q;

// Histórico enxuto, na abertura do app e depois de importar um backup: nos dias passados, de cada questão do quiz
// ficam a primeira resposta do dia e, se ela foi erro, o primeiro acerto do dia. As outras repetições ("Refazer o quiz
// todo", "Treinar todas") saem: nenhuma conta da tela as usa, e elas ocupavam o espaço do navegador que guarda a
// Biblioteca. Ficam como estão o dia de hoje, todos os cartões (a regra aqui é a das questões do quiz), a resposta antiga
// sem enunciado e o item estragado. Nada é resumido por dia, área ou material: o acerto que ficou (#78) precisa, por
// questão, da resposta de cada dia. A revisão espaçada não usa o histórico: o estado dela fica em cada erro do caderno
// e em cerebro-cartoes. Devolve outra lista, na mesma ordem.
export function compactEvents(events, now) {
  const today = localDay(now);
  // A questão no dia: a resposta que ficou dela já é um acerto?
  const kept = new Map();
  return events.filter(e => {
    if (!validEvent(e) || e.kind !== 'quiz' || !e.q || localDay(e.date) >= today) return true;
    const key = questionDay(e);
    const right = kept.get(key);
    if (right === undefined || (!right && e.ok)) {
      kept.set(key, e.ok);
      return true;
    }
    return false;
  });
}

// Acerto no quiz. Os cartões ficam de fora: "Acertei" é o aluno quem marca, e somado ao quiz inflava o número.
export function quizRate(events) {
  return tally(firstAttempts(events));
}

// Autoavaliação nos cartões: quantos o aluno marcou "Acertei", na primeira avaliação de cada cartão no dia.
export function cardRate(events) {
  return tally(firstAttempts(events, 'flashcard'));
}

// Sem estudo hoje a sequência ainda vale até ontem: o dia não acabou.
export function streak(events, today) {
  const days = new Set(events.map(e => localDay(e.date)));
  const day = new Date(today);
  let count = 0;
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  while (days.has(localDay(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

// Ponto fraco: o material com a maior taxa de erro nas primeiras respostas do quiz nos últimos 7 dias, os mesmos do
// gráfico. Erro antigo não manda na revisão de hoje, e com menos de 3 respostas a taxa não diz nada.
// No empate vale o que tem mais erros. Evento gravado antes de existir título cai no nome da área.
export function weakSpot(events, now) {
  const week = new Set(recentDays(7, now));
  const spots = new Map();
  for (const e of firstAttempts(events)) {
    if (week.has(localDay(e.date))) {
      const name = e.title || e.area;
      const spot = spots.get(name) || { name, wrong: 0, total: 0 };
      spots.set(name, { name, wrong: spot.wrong + (e.ok ? 0 : 1), total: spot.total + 1 });
    }
  }
  return [...spots.values()]
    .filter(spot => spot.total >= 3 && spot.wrong > 0)
    .sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong)[0] || null;
}

// Os 7 dias do gráfico, do mais antigo para hoje, cada um com as primeiras respostas do quiz naquele dia.
export function chartDays(events, area, now) {
  const answers = firstAttempts(events)
    .filter(e => area === 'Todas' || e.area === area)
    .map(e => ({ day: localDay(e.date), ok: e.ok }));
  return recentDays(7, now).map(day => ({
    day,
    label: day.slice(8) + '/' + day.slice(5, 7),
    ...tally(answers.filter(a => a.day === day)),
  }));
}

// Uma coluna do gráfico por extenso, para o leitor de tela: na tela ela é só "33% · 6" sobre uma barra.
export function spokenDay({ day, total, rate }) {
  return new Date(day + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ': ' +
    (total ? total + (total === 1 ? ' resposta, ' : ' respostas, ') + rate + '% de acerto' : 'nenhuma resposta');
}

// Houve estudo (quiz ou cartão) em cada um dos n últimos dias? Do mais antigo para hoje.
export function lastDays(events, n, now) {
  const studied = new Set(events.map(e => localDay(e.date)));
  return recentDays(n, now).map(day => studied.has(day));
}

// Linha de uma área na página Desempenho, com quiz e cartões separados, os dois pela primeira resposta do dia.
// Sem resposta de quiz não há percentual: "0% de acerto" diria que o aluno errou tudo.
export function areaLine(events, area) {
  const quiz = tally(firstAttempts(events).filter(e => e.area === area));
  const cards = firstAttempts(events, 'flashcard').filter(e => e.area === area).length;
  if (!quiz.total && !cards) return 'Sem registros ainda';
  return (quiz.total
    ? quiz.rate + '% de acerto no quiz · ' + quiz.total + (quiz.total === 1 ? ' questão' : ' questões')
    : 'Quiz sem respostas') + ' · ' + cards + (cards === 1 ? ' cartão' : ' cartões');
}

// Busca só no texto do material: JSON.stringify também casava nomes de campo ("quiz", "answer") e datas.
// O texto de cada material é dobrado uma vez só (SEARCH): a busca roda a cada tecla, e dobrar de novo o texto inteiro de
// todos os materiais pesava com a Biblioteca cheia.
// shortcut: vale enquanto ninguém muda o material no lugar (o App troca o objeto ao salvar, excluir e importar); se isso
// mudar, apagar o texto guardado do material junto.
const SEARCH = new WeakMap();
export function matches(material, query, filter) {
  if (filter !== 'Todas' && material.area !== filter) return false;
  if (!SEARCH.has(material)) {
    SEARCH.set(material, fold([
      material.title,
      ...material.summary.flatMap(x => [x.concept, x.text]),
      ...material.flashcards.flatMap(c => [c.question, c.answer]),
      ...material.quiz.map(q => q.question),
    ].join(' ')));
  }
  return SEARCH.get(material).includes(fold(query));
}

// Quantos materiais a busca e o filtro da Biblioteca deixaram, na frase que o leitor de tela ouve (App.jsx).
export function libraryCount(n) {
  return n === 0 ? 'Nenhum material encontrado' : n === 1 ? '1 material encontrado' : n + ' materiais encontrados';
}

// Embaralha a lista no lugar (Fisher-Yates) e a devolve. random devolve de 0 a 1, como Math.random.
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Questões de onde sai o simulado da Biblioteca: as do quiz de cada material, com o título e a área dele, para a
// resposta contar no desempenho e no caderno de erros com o material de origem. A mesma questão (mesmo material e
// enunciado, a chave do caderno) entra uma vez só. As opções e a resposta ficam como estão no material.
// As questões de cada material ficam prontas, com a chave, na primeira vez (POOL): a frase do simulado na Biblioteca
// refaz a conta a cada tecla da busca, e dobrar de novo a chave de todas as questões pesava com a Biblioteca cheia.
// shortcut: vale enquanto ninguém muda o material no lugar, como o SEARCH do matches; se isso mudar, apagar junto.
const POOL = new WeakMap();
export function examPool(materials) {
  const seen = new Set();
  return materials.flatMap(m => {
    if (!POOL.has(m)) {
      POOL.set(m, m.quiz.map(q => [mistakeKey(m.title, q.question), { ...q, title: m.title, area: m.area }]));
    }
    return POOL.get(m);
  }).filter(([key]) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(([, q]) => q);
}

// Simulado: size questões de examPool, sorteadas por rodada (uma de cada material, em ordem sorteada, antes da segunda
// de qualquer um) e embaralhadas no fim. Assim cada material entra enquanto houver vaga, e o acerto por material do fim
// não deixa nenhum de fora. Com menos questões que o pedido, entram todas. random: o mesmo do shuffle.
export function mockExam(materials, size, random = Math.random) {
  const ranked = byMaterial(examPool(materials))
    .flatMap(([, list]) => shuffle([...list], random).map((q, round) => [round + random(), q]));
  return shuffle(ranked.sort((a, b) => a[0] - b[0]).slice(0, size).map(([, q]) => q), random);
}

// Acerto por material no fim do simulado: [título, certas, total], na ordem em que cada material apareceu.
export function examScore(answers) {
  return byMaterial(answers).map(([title, list]) => [title, list.filter(a => a.ok).length, list.length]);
}

// O simulado em frase: "20 questões de 4 materiais". list são as questões de onde ele sai (examPool) ou as do simulado
// aberto, e size, o pedido. Pelo sorteio por rodada (mockExam), entra um material por questão até todos entrarem.
export function examLine(list, size = list.length) {
  const questions = Math.min(size, list.length);
  const materials = Math.min(questions, new Set(list.map(q => q.title)).size);
  return questions + ' ' + plural(questions, 'questão', 'questões') + ' de ' + materials + ' ' +
    plural(materials, 'material', 'materiais');
}

// Sugestões ao lado da caixa do chat, sempre sobre o assunto: de partida (o texto do assunto ou a área) até a primeira
// resposta; depois, as perguntas que a IA mandou junto com a última resposta. Se ela não mandar nenhuma, entram três fixas.
// input é o texto do assunto (chatSubject): o do editor ou o do material aberto. As da IA só valem enquanto esse texto e
// a área são os da resposta: se o aluno muda de assunto, voltam as fixas.
export function hints({ chat, input, area, tips }) {
  if (!chat.some(m => m.role === 'assistant')) {
    return [
      'Me introduza ao assunto',
      ...(input.trim()
        ? ['Quais são os pontos principais do texto?', 'Faça uma pergunta sobre o texto para eu praticar']
        : STARTERS[area]),
    ];
  }
  return tips.key === JSON.stringify([input, area]) && tips.list.length
    ? tips.list
    : ['Me dê um exemplo do dia a dia', 'Explique de outro jeito', 'Faça uma pergunta para eu praticar'];
}

// Atalhos da caixa do chat (components/ui/chat-composer.jsx): "/" no começo do texto, ainda sem espaço, abre a lista com
// as sugestões, filtradas pelo que vem depois da barra sem ligar para maiúsculas e acentos ("/sao" acha "O que são
// hardware e software?"). Texto que não começa assim devolve null: ele não abre a lista (o botão de atalhos abre, com todas).
export function slashHints(list, text) {
  if (!text.startsWith('/') || /\s/.test(text)) return null;
  const query = fold(text.slice(1));
  return list.filter(h => fold(h).includes(query));
}

// Saudação fixa: o Cérebro fala primeiro sem gastar chamada da IA. Não entra em chat, então não vai no histórico do pedido.
// title é o material aberto sobre o qual o chat pergunta (chatSubject); sem ele, vale o texto do editor.
export function hello({ user, area, level, input, title, api }) {
  return 'Olá' + (user?.name ? ', ' + user.name : '') + '! Sou o Cérebro, seu tutor ' +
    (area === 'Escolar' ? 'das matérias escolares' : 'de ' + area) + ' no nível ' + level + '. ' +
    (api
      ? 'Pergunte o que quiser ou escolha uma das sugestões abaixo. ' +
        (title ? 'Vou considerar o material "' + title + '".'
          : input.trim() ? 'Vou considerar o texto que está no editor.' : 'Se colar um texto no editor, respondo com base nele.')
      : 'Nesta demonstração eu organizo o seu texto em resumo, flashcards e quiz. As respostas a dúvidas ficam para a versão com IA.');
}

// Assunto do chat. Vale o texto do editor sem material aberto, quando o material saiu desse texto (é o mesmo assunto,
// e o texto é mais completo) ou quando o aluno escolheu o texto (editor) e há texto lá. Senão, o material: o título e
// o resumo vão como content, com a área e o nível dele (material antigo sem eles usa os do editor).
// made é a chave da última geração, [texto, área, nível] (App.jsx, generate): só o texto conta, porque a área e o
// nível podem ter mudado depois. swap é o botão que troca a fonte, quando há outra para escolher.
export function chatSubject({ material, made, editor, input, area, level }) {
  const fromEditor = made.startsWith('[' + JSON.stringify(input) + ',');
  if (!material || fromEditor || (editor && input.trim())) {
    return { title: '', content: input, area, level, swap: material && !fromEditor ? 'Usar o material aberto' : '' };
  }
  const topics = material.summary.map(s => [s.concept, s.text].filter(t => t.trim()).join(': '));
  return {
    title: material.title,
    content: cut([material.title, ...topics].filter(Boolean).join('\n'), MAX_INPUT),
    area: AREAS.includes(material.area) ? material.area : area,
    level: LEVELS.includes(material.level) ? material.level : level,
    swap: input.trim() ? 'Usar o texto do editor' : '',
  };
}

// Dica do selo da IA (title): a conta do selo é só deste computador, e a cota do Google é do projeto inteiro.
const QUOTA_NOTE = 'A cota da IA é do projeto inteiro e zera à meia-noite do horário do Pacífico (4h ou 5h em ' +
  'Brasília). O saldo real fica no painel de uso do Google AI Studio.';

// O teto de chamadas por dia que o grupo escolheu (AI_DAILY_LIMIT, no /api/health em daily_limit) chegou: os botões da
// IA ficam desligados até a contagem recomeçar. Sem teto (null, ou backend antigo, sem o campo), nunca.
export function capReached(health) {
  return !!health && health.daily_limit > 0 && health.calls_today >= health.daily_limit;
}

// Estado da IA no cabeçalho, a partir da resposta de /api/health: null enquanto ela não chegou, false se a consulta
// falhou ou não veio JSON. tone é a classe do ponto colorido, e note, a dica do selo. Com a IA ativa, model e count são
// partes do text: na barra estreita o modelo sai da vista (styles.css, @container), e o text, chave da troca animada,
// fica inteiro. Com o teto do dia, a conta é "8 de 40 chamadas hoje", e o ponto fica âmbar a partir de 80% dele.
export function healthLabel(health) {
  if (health == null) return { text: 'Conferindo a IA…', tone: '' };
  if (!health) return { text: 'Cérebro desligado', tone: 'off' };
  if (!health.ai_configured) return { text: 'IA não configurada', tone: 'warn' };
  if (capReached(health)) return { text: 'Teto do dia atingido', tone: 'warn', note: QUOTA_NOTE };
  if (health.quota_exhausted) return { text: 'Cota de hoje esgotada', tone: 'warn', note: QUOTA_NOTE };
  const calls = health.calls_today;
  const limit = health.daily_limit > 0 ? health.daily_limit : 0;
  const model = health.model_in_use || health.model || '';
  const count = typeof calls !== 'number' ? ''
    : limit ? calls + ' de ' + limit + ' ' + plural(limit, 'chamada', 'chamadas') + ' hoje'
    : calls + (calls === 1 ? ' chamada' : ' chamadas') + ' deste computador';
  const tone = limit && calls * 5 >= limit * 4 ? 'warn' : 'ok';
  return { text: ['IA ativa', model, count].filter(Boolean).join(' · '), tone, model, count, note: QUOTA_NOTE };
}

// Frase de cada erro para o aluno: o que houve e o que ele consegue fazer. As frases do backend falam de .env, proxy e
// Python para quem instala (python -m app.check mostra as mesmas) e ficam nos detalhes técnicos. Código fora daqui já
// vem do backend com uma frase simples.
const SETUP = 'A IA recusou o pedido por um problema de configuração. Mostre os detalhes técnicos a quem instalou o Cérebro.';
const SHAPE = 'A IA respondeu fora do formato esperado. Tente de novo.';
export const ERRORS = {
  AI_RATE_LIMITED: 'Muitos pedidos em pouco tempo. Os botões da IA voltam sozinhos em alguns segundos.',
  AI_QUOTA_EXCEEDED: 'A cota de hoje da IA acabou. Enquanto isso, estude o que já está na Biblioteca.',
  // A mesma frase fica junto dos botões da IA enquanto o teto vale (App.jsx, capNote).
  AI_BUDGET_REACHED: 'As chamadas de IA de hoje chegaram ao teto escolhido pelo grupo. Os botões da IA voltam amanhã; ' +
    'enquanto isso, a Biblioteca, os flashcards, o quiz e o caderno de erros funcionam sem ela.',
  AI_NOT_CONFIGURED: 'A IA não está ligada neste computador. Quem instalou o Cérebro precisa configurar a chave. ' +
    'Enquanto isso, use a demonstração.',
  AI_NETWORK_ERROR: 'O Cérebro não conseguiu falar com a IA. Confira a internet deste computador e tente de novo.',
  AI_PROVIDER_ERROR: 'A IA não atendeu o pedido. Tente de novo; se repetir, mostre os detalhes técnicos a quem ' +
    'instalou o Cérebro.',
  AI_AUTH_ERROR: SETUP,
  AI_MODEL_NOT_FOUND: SETUP,
  AI_REQUEST_REJECTED: SETUP,
  AI_NO_COMPATIBLE_MODEL: SETUP,
  AI_INVALID_RESPONSE: SHAPE,
  AI_INVALID_JSON: SHAPE,
};

// Falhas que a própria tela percebe, sem resposta do backend (App.jsx, requestAPI). A resposta sem JSON costuma ser o
// proxy do Vite respondendo no lugar do Python desligado.
export const FAILS = {
  off: 'O Cérebro não está ligado neste computador. Abra o iniciar.ps1 de novo e tente outra vez.',
  noJson: 'O Cérebro não respondeu como esperado. Abra o iniciar.ps1 de novo e tente outra vez.',
  timeout: 'A IA demorou demais para responder. Tente de novo.',
};

// Erro do backend para a tela: message é a frase para o aluno; tech, os detalhes técnicos (o código, o estado do
// provedor e a frase original do backend, ou o HTTP sem código); wait, os segundos que o backend mandou esperar no
// limite por minuto (retry_after), ou 0. detail em lista é o formato antigo (erros de validação em inglês, um por
// campo): vira uma frase só.
export function errorText(detail, status) {
  const said = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? 'Pedido recusado: confira o texto e tente de novo.'
    : detail?.message;
  const code = detail?.code;
  const message = ERRORS[code] || said || 'O Cérebro não conseguiu atender o pedido. Tente de novo.';
  return {
    message,
    tech: [code || 'HTTP ' + status, detail?.provider_status, said !== message && said].filter(Boolean).join(' · '),
    wait: detail?.retry_after > 0 ? Math.ceil(detail.retry_after) : 0,
  };
}

// Contagem do limite por minuto no aviso de erro (App.jsx, Problem), ou null. Na espera (until: a hora em que os botões
// da IA voltam), as páginas com esses botões explicam por que eles estão desligados: a contagem fica no lugar do erro
// que não conta esta espera. Ela não aparece se a tela já conta (o próprio erro ou, no resumo e no quiz, a explicação
// ou a revisão que falhou: counted), no teto do dia (capped: os botões não voltam no fim da espera), nem por cima do
// aviso do arquivo no Estudar (file, App.jsx, openFile): abrir um arquivo não usa a IA, e é o que o aluno faz enquanto
// espera.
export function pauseNotice({ until, page, error, counted = false, capped = false }) {
  if (!until || counted || capped || error?.until === until
    || !['Estudar', 'Dúvidas', 'Resumos', 'Quizzes'].includes(page)) {
    return null;
  }
  return error?.file && page === 'Estudar' ? null : { message: ERRORS.AI_RATE_LIMITED, until };
}

// Erro do limite por minuto (o que tem until, App.jsx, callAI) quando o teto do dia chega: a chamada recusada entrou
// na conta do dia, e os botões da IA não voltam em alguns segundos. A frase passa a ser a do teto, sem a contagem; os
// detalhes técnicos ficam. Outro erro volta como veio.
export function rateAtCap(error) {
  return error?.until
    ? { ...error, message: error.message.replace(ERRORS.AI_RATE_LIMITED, ERRORS.AI_BUDGET_REACHED), until: 0 }
    : error;
}

// Corta o texto no limite do editor, sem deixar meio emoji no fim: o backend recusa texto maior. Conta como o contador
// do editor e o rascunho (length), e não por caractere inteiro como cut, abaixo: um emoji vale 2.
export function capText(text) {
  return text.slice(0, MAX_INPUT).replace(/[\uD800-\uDBFF]$/, '');
}

// Soma o trecho ditado ao texto do editor e corta no limite (capText): sem o corte o ditado passava de 20.000
// caracteres e o backend recusava o texto.
export function dictate(text, spoken) {
  return capText((text + ' ' + spoken).trim());
}

// Motivo da falha do ditado (o campo error do evento do navegador) em frase para o aluno.
export function dictationError(code) {
  if (code === 'no-speech') return 'Não ouvi nada. Tente de novo.';
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Permita o uso do microfone no navegador.';
  if (code === 'network') return 'O ditado precisa de internet.';
  return 'Não foi possível ouvir. Verifique a permissão do microfone.';
}

// Baralho de uma sessão de flashcards: queue é a fila de índices dos cartões e pos, o cartão aberto. O material não
// muda de ordem. A sessão começa com todos os cartões e acaba quando pos passa do fim da fila.
export function deckStart(count) {
  return { queue: Array.from({ length: count }, (_, i) => i), pos: 0 };
}

export function deckRight(deck) {
  return { ...deck, pos: deck.pos + 1 };
}

// O cartão errado entra de novo no fim da fila: volta até ser acertado.
export function deckWrong(deck) {
  return { queue: [...deck.queue, deck.queue[deck.pos]], pos: deck.pos + 1 };
}

// "Revisar depois": o cartão aberto vai para o fim da fila e o seguinte toma o lugar dele.
// No último não há para onde mandar: o baralho volta igual.
export function deckLater(deck) {
  if (deck.pos >= deck.queue.length - 1) return deck;
  const queue = [...deck.queue];
  queue.push(queue.splice(deck.pos, 1)[0]);
  return { ...deck, queue };
}

// Cartões que voltaram por erro: os que aparecem mais de uma vez na fila.
// "Revisar depois" só muda o cartão de lugar, sem repetir.
export function deckMissed(deck) {
  return [...new Set(deck.queue.filter((card, i) => deck.queue.indexOf(card) !== i))].sort((a, b) => a - b);
}

// Nova sessão só com os cartões que voltaram por erro.
export function deckRedo(deck) {
  return { queue: deckMissed(deck), pos: 0 };
}

// "Recomeçar" no meio: a mesma sessão desde o início, com os cartões dela na ordem do material e sem as voltas por
// erro. No "Refazer só os que errei" recomeçam só esses cartões, como o quiz recomeça só as questões erradas.
export function deckRestart(deck) {
  return { queue: [...new Set(deck.queue)].sort((a, b) => a - b), pos: 0 };
}

// Frase do fim do baralho.
export function deckSummary(deck) {
  const cards = new Set(deck.queue).size;
  const missed = deckMissed(deck).length;
  return cards + (cards === 1 ? ' cartão revisado; ' : ' cartões revisados; ') +
    (missed === 0 ? 'nenhum voltou' : missed === 1 ? '1 voltou' : missed + ' voltaram') + ' por erro.';
}

// Lembrete embaixo do "Você escreveu", com o cartão virado.
export const CARD_REMINDER = 'Conte como acerto só se você disse o essencial.';

// O que a região fixa diz ao virar o cartão (toAnswer: para a resposta). Com o que o aluno escreveu na tela (wrote), a
// resposta vem com o lembrete: o foco não passa por ele. A resposta sem ponto final ganha um, para a pausa antes dele.
export function spokenCard(card, toAnswer, wrote) {
  if (!toAnswer) return 'Pergunta: ' + card.question;
  const text = 'Resposta: ' + card.answer.trim();
  return wrote ? text + (/[.!?…]$/.test(text) ? ' ' : '. ') + CARD_REMINDER : text;
}

// Revisão espaçada dos cartões, nas caixas de Leitner: cada cartão avaliado fica em cerebro-cartoes como { key, title,
// box, due, date }: a chave (mistakeKey, o material e a pergunta), o título do material, a caixa de 1 a 4, o dia em que
// ele volta e a hora da última mudança. Cada caixa volta em BOX_DAYS dias: a 1 em 1, a 2 em 3, a 3 em 7 e a 4 em 16.
const BOX_DAYS = [1, 3, 7, 16];
// Cartões por vez na revisão do dia: quem fica dias sem estudar acha uma pilha, e ela vem aos poucos.
const DAY_CARDS = 20;

// Cartão lido do navegador ou de um backup. A chave tem de ser do material: é por ela que o cartão volta.
export function validCardReview(e) {
  return !!e && isText(e.title) && e.title.trim() !== '' && isText(e.key) && e.key.startsWith(fold(e.title) + '|') &&
    [1, 2, 3, 4].includes(e.box) && isDay(e.due) && isDate(e.date);
}

// O aluno avaliou o cartão (ok é o "Acertei"). O cartão novo entra na caixa 1, e o "Errei" o leva de volta a ela.
// "Acertei" no dia marcado ou depois sobe uma caixa (a 4 continua na 4); antes dele não muda nada: rever o baralho no
// mesmo dia não empurra o cartão para longe. Entrada estragada com a mesma chave é trocada no lugar.
export function scheduleCard(list, title, question, ok, now) {
  const key = mistakeKey(title, question);
  const today = localDay(now);
  const old = list.find(e => e?.key === key && validCardReview(e));
  if (old && ok && today < old.due) return list;
  const box = old && ok ? Math.min(old.box + 1, 4) : 1;
  const entry = { key, title, box, due: addDays(today, BOX_DAYS[box - 1]), date: new Date(now).toISOString() };
  return list.some(e => e?.key === key) ? list.map(e => (e?.key === key ? entry : e)) : [...list, entry];
}

// Revisão do dia: os cartões vencidos (que voltam hoje ou antes) e que ainda estão num dos materiais, do mais atrasado
// ao mais novo, e na mesma data na ordem da lista. Cada um leva a pergunta, a resposta e o título e a área do material.
// Cartão de material excluído fica de fora. A tela conta todos e abre os de dayCards.
export function dueCards(list, materials, now) {
  const today = localDay(now);
  const due = list.filter(e => validCardReview(e) && e.due <= today)
    .sort((a, b) => (a.due > b.due) - (a.due < b.due));
  if (!due.length) return [];
  const cards = new Map();
  for (const m of materials) {
    for (const c of m.flashcards) {
      const key = mistakeKey(m.title, c.question);
      if (!cards.has(key)) cards.set(key, { question: c.question, answer: c.answer, title: m.title, area: m.area });
    }
  }
  const seen = new Set();
  return due.filter(e => cards.has(e.key) && !seen.has(e.key) && seen.add(e.key)).map(e => cards.get(e.key));
}

// A revisão do dia que abre agora: os DAY_CARDS primeiros de dueCards, os mais atrasados.
export const dayCards = due => due.slice(0, DAY_CARDS);

// Caderno de erros: as questões erradas de todos os materiais, para refazer. Cada erro é { key, item, title, area,
// date, step, due }: a questão inteira, o material e a área de onde veio, quando o aluno a errou por último, o degrau
// da escada (0, 1 ou 2) e o dia em que ela volta.
// As funções recebem a lista como está gravada no navegador: item que a tela ignora fica onde está.

// A escada do caderno: depois do erro a questão volta em 1 dia, depois do 1º acerto em 3 e depois do 2º em 7. O 3º
// acerto a tira. Cada acerto só conta no dia marcado ou depois: são 3 acertos em dias diferentes.
const STEP_DAYS = [1, 3, 7];
// Questões por vez no "Refazer os de hoje", como os cartões da revisão do dia.
const DAY_MISTAKES = 10;

// Degrau do erro. O erro gravado antes da escada, ou com degrau estragado, está no 0.
export function stepOf(e) {
  return [0, 1, 2].includes(e?.step) ? e.step : 0;
}

// Dia em que a questão volta. O erro gravado antes da escada, ou com dia estragado, volta no dia seguinte ao do erro.
export function dueOf(e) {
  return isDay(e?.due) ? e.due : addDays(localDay(e?.date), 1);
}

// Chave de uma questão no caderno: o material e o enunciado, sem acentos nem maiúsculas.
export function mistakeKey(title, question) {
  return fold(title) + '|' + fold(question);
}

// Errou: a questão entra no caderno ou, se já estava, fica no mesmo lugar com a data nova. Nos dois casos ela começa a
// escada: degrau 0, e volta amanhã.
// item leva só os campos da questão: a que vem da tela traz junto a resposta dada na sessão.
export function addMistake(list, item, title, area, now) {
  const { type, question, options, answer, explanation, steps } = item;
  const key = mistakeKey(title, question);
  const entry = {
    key, item: { type, question, options, answer, explanation, steps }, title, area, date: new Date(now).toISOString(),
    step: 0, due: addDays(localDay(now), 1),
  };
  return list.some(e => e?.key === key) ? list.map(e => (e?.key === key ? entry : e)) : [...list, entry];
}

// Acertou: no dia marcado ou depois, a questão sobe um degrau e volta mais tarde; no último degrau ela sai do caderno.
// Acertar antes do dia marcado não muda nada: logo depois de ver a explicação, a resposta certa não prova que ficou.
export function clearMistake(list, key, now) {
  const today = localDay(now);
  return list.flatMap(e => {
    if (e?.key !== key || today < dueOf(e)) return [e];
    const step = stepOf(e) + 1;
    return step < STEP_DAYS.length ? [{ ...e, step, due: addDays(today, STEP_DAYS[step]) }] : [];
  });
}

// As questões para hoje: as que voltam hoje ou já deviam ter voltado, das mais atrasadas às mais novas (na mesma data,
// na ordem da lista). Item estragado fica de fora.
export function dueMistakes(list, now) {
  const today = localDay(now);
  return list.filter(e => validMistake(e) && dueOf(e) <= today)
    .sort((a, b) => (dueOf(a) > dueOf(b)) - (dueOf(a) < dueOf(b)));
}

// O "Refazer os de hoje" que abre agora: as DAY_MISTAKES primeiras de dueMistakes, as mais atrasadas.
export const dayMistakes = due => due.slice(0, DAY_MISTAKES);

// Quando a questão volta, para a página do caderno: "para hoje" (também a atrasada), "volta amanhã" ou "volta em 23/11".
export function backOn(due, today) {
  if (due <= today) return 'para hoje';
  return due === addDays(today, 1) ? 'volta amanhã' : 'volta em ' + due.slice(8) + '/' + due.slice(5, 7);
}

// O aluno tirou a questão do caderno, ou a revisão da IA aceitou a resposta: sai na hora.
// until (só na revisão) é a hora do pedido: erro gravado depois dela fica, porque o aluno errou a questão de novo
// enquanto esperava a IA.
export function removeMistake(list, key, until) {
  return list.filter(e => e?.key !== key || Date.parse(e.date) > Date.parse(until));
}

// Erro lido do navegador ou de um arquivo de backup, antes de ir para a tela. A chave tem de ser a do material e
// do enunciado: é por ela que a questão sai do caderno quando o aluno acerta.
export function validMistake(e) {
  return !!e && validQuestion(e.item) && isText(e.title) && e.title.trim() !== '' && isText(e.area) &&
    isDate(e.date) && e.key === mistakeKey(e.title, e.item.question);
}

// Os erros agrupados por material, na ordem em que cada material apareceu: [título, erros].
export function byMaterial(mistakes) {
  const groups = new Map();
  for (const m of mistakes) groups.set(m.title, [...(groups.get(m.title) || []), m]);
  return [...groups];
}

// Texto que vai num pedido à IA: sem espaços nas pontas e cortado por caractere inteiro (o backend conta
// caracteres, e meio emoji no fim faria o pedido ser recusado).
const cut = (text, max) => [...String(text).trim()].slice(0, max).join('');

// "Não entendi, me explique" numa questão respondida do quiz: a pergunta que vai ao tutor.
// given é o que o aluno respondeu (o índice da opção ou o texto digitado) e só entra quando ele errou.
export function whyQuestion(q, given, ok) {
  return 'Não entendi esta questão: "' + q.question + '". ' +
    (ok ? '' : 'Respondi "' + (q.type === 'short' ? cut(given, 500) : q.options[given]) + '". ') +
    'A resposta certa é "' + expectedText(q) +
    '". Explique de outro jeito, em passos curtos, por que essa é a resposta.';
}

// "Não entendi, me explique" num tópico do resumo.
export function whyTopic(concept) {
  return 'Explique de outro jeito este tópico: "' + concept + '".';
}

// Corpo do pedido de "Pedir revisão da IA" (/api/grade), nos limites do backend: enunciado e resposta com até 500
// caracteres, gabarito com até 200. O gabarito vai como está no material, com as formas separadas por "|".
export function gradeRequest(q, given, area, level) {
  return { question: cut(q.question, 500), expected: cut(q.answer, 200), answer: cut(given, 500), area, level };
}

// A revisão da IA aceitou a resposta que a comparação de texto marcou como errada: a última resposta de quiz
// gravada para a questão (mesmo material e mesmo enunciado) passa a valer como acerto.
// until é a hora do pedido de revisão: resposta gravada depois dela não é a que a IA viu.
export function fixLastQuizEvent(events, title, q, until) {
  const at = events
    .map(e => e?.kind === 'quiz' && e.title === title && e.q === q && !(Date.parse(e.date) > Date.parse(until)))
    .lastIndexOf(true);
  return events.map((e, i) => (i === at ? { ...e, ok: true } : e));
}

// Cópia de segurança: os dados ficam presos a um navegador, e o arquivo os leva para outro computador.
// Lê o texto do arquivo e devolve as listas já conferidas, ou null se ele não é um backup do Cérebro (JSON de
// objeto com versao 1). O arquivo vem de fora: cada item passa pela mesma conferência da leitura do navegador, e
// o que não passa fica de fora e é contado em fora, para o aviso dizer o que não entrou. Material sem data válida
// também sai: é pela data que mergeBackup o reconhece. O perfil (user) só vale com nome de 1 a 50 caracteres, o
// limite do formulário, e área da lista; senão é null. Dele só entram o nome e a área. Backup de antes da revisão
// espaçada não tem cartoes (as caixas dos cartões): vale lista vazia.
export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.versao !== 1) return null;
  const list = (value, ok) => (Array.isArray(value) ? value.filter(ok) : []);
  const saved = list(data.saved, m => validMaterial(m) && isDate(m.date));
  const events = list(data.events, validEvent);
  const erros = list(data.erros, validMistake);
  const cartoes = list(data.cartoes, validCardReview);
  const left = (value, kept) => (Array.isArray(value) ? value.length - kept.length : 0);
  const name = isText(data.user?.name) ? data.user.name.trim() : '';
  return {
    saved,
    events,
    erros,
    cartoes,
    fora: {
      saved: left(data.saved, saved), events: left(data.events, events), erros: left(data.erros, erros),
      cartoes: left(data.cartoes, cartoes),
    },
    user: name && name.length <= 50 && AREAS.includes(data.user.area) ? { name, area: data.user.area } : null,
  };
}

// Junta o backup lido (novo) ao que está gravado no navegador (atual) sem duplicar: importar o mesmo arquivo
// duas vezes não muda nada. O perfil fica com o App (importBackup): só entra num navegador que ainda não tem um.
export function mergeBackup(atual, novo) {
  // Material com o mesmo título e a mesma data já está na biblioteca. O que entra com id já usado, ou sem id,
  // ganha id novo: é pelo id que a tela marca o material como salvo e o exclui.
  const ids = new Set(atual.saved.map(m => m?.id));
  const dated = m => JSON.stringify([m?.title, m?.date]);
  const have = new Set(atual.saved.map(dated));
  const fresh = [];
  for (const m of novo.saved) {
    if (!have.has(dated(m))) {
      const id = Number.isSafeInteger(m.id) && !ids.has(m.id)
        ? m.id
        : Math.max(0, ...[...ids].filter(Number.isSafeInteger)) + 1;
      have.add(dated(m));
      ids.add(id);
      fresh.push({ ...m, id });
    }
  }
  // Resposta igual (tipo, data, material e enunciado) não repete. A lista fica em ordem de data: o desempenho
  // conta a primeira resposta de cada questão no dia, e a primeira é a que foi gravada antes.
  const answered = e => JSON.stringify([e?.kind, e?.date, e?.title, e?.q]);
  const seen = new Set(atual.events.map(answered));
  const events = [...atual.events];
  for (const e of novo.events) {
    if (!seen.has(answered(e))) {
      seen.add(answered(e));
      events.push(e);
    }
  }
  const time = e => Date.parse(e?.date) || 0;
  events.sort((a, b) => time(a) - time(b));
  // Erros e cartões juntam pela chave: o que tem chave nova entra no fim, e o que já está gravado só dá lugar ao do
  // arquivo quando newer diz que ele é mais novo.
  const byKey = (current, incoming, newer) => {
    const merged = [...current];
    for (const e of incoming) {
      const at = merged.findIndex(old => old?.key === e.key);
      if (at < 0) merged.push(e);
      else if (newer(e, merged[at])) merged[at] = e;
    }
    return merged;
  };
  // Erro com a mesma chave fica com a data mais recente (errar de novo volta a questão ao degrau 0) e, com a mesma
  // data, com o degrau mais alto: os acertos que vieram depois do erro.
  const erros = byKey(atual.erros, novo.erros, (e, old) =>
    time(e) > time(old) || (time(e) === time(old) && stepOf(e) > stepOf(old)));
  // Cartão com a mesma chave fica com a mudança mais recente.
  const cartoes = byKey(atual.cartoes, novo.cartoes, (e, old) => time(e) > time(old));
  // O que entra fica no topo da biblioteca, como o material recém-salvo.
  return { saved: [...fresh, ...atual.saved], events, erros, cartoes };
}

// Contagens numa frase: "2 materiais, 1 resposta e 3 questões do caderno de erros", cada palavra no singular ou no
// plural. items é uma lista de [número, singular, plural].
function countList(items) {
  const said = items.map(([n, one, many]) => n + ' ' + (n === 1 ? one : many));
  return said.length > 1 ? said.slice(0, -1).join(', ') + ' e ' + said[said.length - 1] : said.join('');
}

// As quatro partes do backup, cada uma com o seu número, para countList.
const backupItems = ({ saved, events, erros, cartoes }) => [
  [saved, 'material', 'materiais'],
  [events, 'resposta', 'respostas'],
  [erros, 'questão do caderno de erros', 'questões do caderno de erros'],
  [cartoes, 'cartão com data de volta', 'cartões com data de volta'],
];

// Aviso depois de exportar: o que foi no arquivo, contado como a tela mostra (só o que passa na conferência).
export function backupSummary(backup) {
  return 'Backup gerado: ' + countList(backupItems({
    saved: backup.saved.filter(validMaterial).length,
    events: backup.events.filter(validEvent).length,
    erros: backup.erros.filter(validMistake).length,
    cartoes: backup.cartoes.filter(validCardReview).length,
  })) + '.';
}

// Aviso depois de importar: quantos materiais entraram ou, sem material novo, se vieram respostas, erros ou caixas de
// cartões. Depois, só quando houver, o que ficou de fora por estar incompleto (fora, de readBackup) e o nome do perfil
// que entrou.
// As respostas que a tela usa valem pelo conteúdo, não pelo tamanho: no histórico compactado (compactEvents), a resposta
// anterior que o backup traz toma o lugar da que ficou e muda o acerto sem mudar o tamanho da lista. O item estragado
// fica de fora: mergeBackup o leva para o começo da lista, e a tela não o mostra.
export function backupNote(atual, junto, fora = {}, perfil = '') {
  const materials = junto.saved.length - atual.saved.length;
  const shown = list => JSON.stringify(list.filter(validEvent));
  const same = k => JSON.stringify(junto[k]) === JSON.stringify(atual[k]);
  const main = materials ? (materials === 1 ? '1 material importado' : materials + ' materiais importados')
    : shown(junto.events) !== shown(atual.events) || !same('erros') || !same('cartoes')
      ? 'Desempenho e caderno de erros atualizados'
      : 'Nada novo neste arquivo';
  const left = countList(backupItems(fora).filter(([n]) => n > 0));
  const parts = [
    main, left && 'Ficaram de fora, por estarem incompletos: ' + left, perfil && 'Perfil de ' + perfil + ' importado',
  ].filter(Boolean);
  // Uma frase só fica como sempre, sem ponto; com mais de uma, cada uma termina com ponto.
  return parts.length > 1 ? parts.join('. ') + '.' : main;
}

// Linha do backup no pé da Biblioteca e do Desempenho. last é a data do último backup, em texto ISO; valor inválido
// vale como nunca. Novo é o material ou a resposta com data depois dele. Os dias contam pelo calendário, no fuso do
// aluno: backup ontem às 23h, conferido à 1h, foi "há 1 dia". due (lembrar o backup) quando há algo novo e são 5
// materiais novos ou 7 dias ou mais desde o backup (sem backup, desde o registro mais antigo).
export function backupStatus({ saved, events, last, now }) {
  const done = isDate(last);
  const since = done ? Date.parse(last) : -Infinity;
  const newer = list => list.map(x => Date.parse(x?.date)).filter(time => time > since);
  const materials = newer(saved);
  const fresh = [...materials, ...newer(events)];
  const noon = date => Date.parse(localDay(date) + 'T12:00');
  const daysTo = date => Math.round((noon(now) - noon(date)) / 864e5);
  const age = done ? daysTo(last) : fresh.length ? daysTo(fresh.reduce((a, b) => Math.min(a, b))) : 0;
  return {
    text: !done ? 'Você ainda não fez backup'
      : 'Último backup: ' + (age < 1 ? 'hoje' : age === 1 ? 'há 1 dia' : 'há ' + age + ' dias'),
    due: fresh.length > 0 && (materials.length >= 5 || age >= 7),
  };
}
