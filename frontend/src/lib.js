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
const MAX_INPUT = 20000;
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

export function read(k, d) {
  try {
    return JSON.parse(localStorage.getItem('cerebro-' + k)) ?? d;
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
// area e level também são opcionais, mas, se vierem, são texto: a tela os escreve no cabeçalho do material.
export function validMaterial(m) {
  const filled = (list, ok) => Array.isArray(list) && list.length > 0 && list.every(item => !!item && ok(item));
  const optional = v => v == null || isText(v);
  return !!m && isText(m.title) && m.title.trim() !== '' && optional(m.area) && optional(m.level) &&
    filled(m.summary, s => isText(s.concept) && isText(s.text) && optional(s.source)) &&
    filled(m.flashcards, c => isText(c.question) && isText(c.answer)) &&
    filled(m.quiz, validQuestion);
}

// Mesmo conteúdo, sem olhar id, data, área e nível. A demonstração gera sempre o mesmo material para o mesmo texto.
export function sameMaterial(a, b) {
  const content = m => JSON.stringify([m.title, m.summary, m.flashcards, m.quiz]);
  return content(a) === content(b);
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

// Rascunho do que estava aberto (editor, material, conversa), gravado a cada mudança para sobreviver a um F5.
// Volta já conferido: o que está fora do formato sai, e rascunho ausente ou estragado dá tudo vazio.
export function readDraft() {
  const d = read('rascunho', null) || {};
  const result = validMaterial(d.result) ? d.result : null;
  const chat = Array.isArray(d.chat)
    ? d.chat.filter(m => (m?.role === 'user' || m?.role === 'assistant') && isText(m.text))
    : [];
  // Pergunta que ficou sem resposta (F5 no meio do pedido) sai, como a que falha: iria sem resposta no histórico.
  while (chat.length && chat[chat.length - 1].role === 'user') chat.pop();
  const texts = list => Array.isArray(list) && list.every(isText);
  return {
    input: isText(d.input) && d.input.length <= MAX_INPUT ? d.input : '',
    area: AREAS.includes(d.area) ? d.area : '',
    level: LEVELS.includes(d.level) ? d.level : '',
    result,
    // Sem o material, a marca de reaproveitamento não tem o que reaproveitar.
    made: result && isText(d.made?.key) && texts(d.made.kinds)
      ? { key: d.made.key, kinds: d.made.kinds }
      : { key: '', kinds: [] },
    chat,
    tips: isText(d.tips?.key) && texts(d.tips.list) ? { key: d.tips.key, list: d.tips.list } : { key: '', list: [] },
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
    summary: pieces.map(s => ({ concept: clause(s), text: s })),
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
  };
}

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

// Respostas do quiz que contam no desempenho: de cada questão (mesmo dia, mesmo material, mesmo enunciado), só a
// primeira. Refazer a mesma questão fazia o percentual subir sem o aluno saber mais.
// A lista está na ordem em que foi gravada. Evento anterior a esta regra não tem q e conta como está.
// O resultado fica guardado por lista (FIRST): a mesma lista passa por quizRate, weakSpot e chartDays a cada resposta, e
// pelo areaLine de cada área a cada desenho do Desempenho.
// shortcut: vale enquanto ninguém muda a lista no lugar (o App e o lib.js sempre criam uma nova); se isso mudar, passar
// o resultado pronto como parâmetro.
const FIRST = new WeakMap();
export function firstAttempts(events) {
  if (!FIRST.has(events)) {
    const seen = new Set();
    FIRST.set(events, events.filter(e => {
      if (e.kind !== 'quiz') return false;
      if (!e.q) return true;
      const key = questionDay(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }
  return FIRST.get(events);
}

// A questão num dia: o dia, o material e o enunciado, em texto simples (JSON.stringify em cada resposta pesava). A
// quebra de linha separa os três: o título do material não tem quebra de linha, e o enunciado vem por último.
const questionDay = e => localDay(e.date) + '\n' + e.title + '\n' + e.q;

// Histórico enxuto, na abertura do app e depois de importar um backup: nos dias passados, de cada questão do quiz
// ficam a primeira resposta do dia e, se ela foi erro, o primeiro acerto do dia. As outras repetições ("Refazer o quiz
// todo", "Refazer meus erros") saem: nenhuma conta da tela as usa, e elas ocupavam o espaço do navegador que guarda a
// Biblioteca. Ficam como estão o dia de hoje, os cartões (o evento não diz qual cartão foi), a resposta antiga sem
// enunciado e o item estragado. Nada é resumido por dia, área ou material: a revisão espaçada e o acerto que ficou
// (#77 e #78) precisam, por questão e por cartão, da resposta de cada dia. Devolve outra lista, na mesma ordem.
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

// Autoavaliação nos cartões: quantos o aluno marcou "Acertei".
export function cardRate(events) {
  return tally(events.filter(e => e.kind === 'flashcard'));
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

// Linha de uma área na página Desempenho, com quiz e cartões separados.
// Sem resposta de quiz não há percentual: "0% de acerto" diria que o aluno errou tudo.
export function areaLine(events, area) {
  const quiz = tally(firstAttempts(events).filter(e => e.area === area));
  const cards = events.filter(e => e.kind === 'flashcard' && e.area === area).length;
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

// Sugestões ao lado da caixa do chat, sempre sobre o assunto: de partida (texto do editor ou área) até a primeira resposta;
// depois, as perguntas que a IA mandou junto com a última resposta. Se ela não mandar nenhuma, entram três fixas.
// As da IA só valem enquanto o texto do editor e a área são os da resposta: se o aluno muda de assunto, voltam as fixas.
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
export function hello({ user, area, level, input, api }) {
  return 'Olá' + (user?.name ? ', ' + user.name : '') + '! Sou o Cérebro, seu tutor ' +
    (area === 'Escolar' ? 'das matérias escolares' : 'de ' + area) + ' no nível ' + level + '. ' +
    (api
      ? 'Pergunte o que quiser ou escolha uma das sugestões abaixo. ' +
        (input.trim() ? 'Vou considerar o texto que está no editor.' : 'Se colar um texto no editor, respondo com base nele.')
      : 'Nesta demonstração eu organizo o seu texto em resumo, flashcards e quiz. As respostas a dúvidas ficam para a versão com IA.');
}

// Estado da IA no cabeçalho, a partir da resposta de /api/health: null enquanto ela não chegou, false se a consulta
// falhou ou não veio JSON. tone é a classe do ponto colorido.
export function healthLabel(health) {
  if (health == null) return { text: 'Conferindo a IA…', tone: '' };
  if (!health) return { text: 'Backend desligado', tone: 'off' };
  if (!health.ai_configured) return { text: 'IA não configurada', tone: 'warn' };
  const calls = health.calls_today;
  return {
    text: [
      'IA ativa',
      health.model_in_use || health.model,
      typeof calls === 'number' && calls + (calls === 1 ? ' chamada hoje' : ' chamadas hoje'),
    ].filter(Boolean).join(' · '),
    tone: 'ok',
  };
}

// Erro do backend em texto para o aluno: a frase em português e, entre colchetes, o código e o estado do provedor.
// detail em lista é o formato antigo (erros de validação em inglês, um por campo): vira uma frase só.
export function errorText(detail, status) {
  const message = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? 'Pedido recusado: confira o texto e tente de novo.'
    : detail?.message;
  const code = detail?.code;
  const provider = detail?.provider_status;
  return (message || 'Falha no backend (HTTP ' + status + ').') +
    (code ? ' [' + code + (provider ? ' · ' + provider : '') + ']' : '');
}

// Soma o trecho ditado ao texto do editor e corta no limite, sem deixar meio emoji no fim:
// sem o corte o ditado passava de 20.000 caracteres e o backend recusava o texto.
export function dictate(text, spoken) {
  return (text + ' ' + spoken).trim().slice(0, MAX_INPUT).replace(/[\uD800-\uDBFF]$/, '');
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

// Frase do fim do baralho.
export function deckSummary(deck) {
  const cards = new Set(deck.queue).size;
  const missed = deckMissed(deck).length;
  return cards + (cards === 1 ? ' cartão revisado; ' : ' cartões revisados; ') +
    (missed === 0 ? 'nenhum voltou' : missed === 1 ? '1 voltou' : missed + ' voltaram') + ' por erro.';
}

// Caderno de erros: as questões erradas de todos os materiais, para refazer. Cada erro é { key, item, title, area,
// date }: a questão inteira, o material e a área de onde veio e quando o aluno a errou por último.
// As funções recebem a lista como está gravada no navegador: item que a tela ignora fica onde está.

// Chave de uma questão no caderno: o material e o enunciado, sem acentos nem maiúsculas.
export function mistakeKey(title, question) {
  return fold(title) + '|' + fold(question);
}

// Errou: a questão entra no caderno ou, se já estava, fica no mesmo lugar com a data nova.
// item leva só os campos da questão: a que vem da tela traz junto a resposta dada na sessão.
export function addMistake(list, item, title, area, now) {
  const { type, question, options, answer, explanation, steps } = item;
  const key = mistakeKey(title, question);
  const entry = {
    key, item: { type, question, options, answer, explanation, steps }, title, area, date: new Date(now).toISOString(),
  };
  return list.some(e => e?.key === key) ? list.map(e => (e?.key === key ? entry : e)) : [...list, entry];
}

// Acertou: a questão só sai do caderno se o erro guardado é de outro dia. Acertar no mesmo dia, logo depois de
// ver a explicação, não prova que aprendeu.
export function clearMistake(list, key, now) {
  return list.filter(e => e?.key !== key || localDay(e.date) === localDay(now));
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
// o que não passa fica de fora. Material sem data válida também sai: é pela data que mergeBackup o reconhece.
export function readBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.versao !== 1) return null;
  const list = (value, ok) => (Array.isArray(value) ? value.filter(ok) : []);
  return {
    saved: list(data.saved, m => validMaterial(m) && isDate(m.date)),
    events: list(data.events, validEvent),
    erros: list(data.erros, validMistake),
  };
}

// Junta o backup lido (novo) ao que está gravado no navegador (atual) sem duplicar: importar o mesmo arquivo
// duas vezes não muda nada. O perfil não é importado.
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
  // Erro com a mesma chave fica com a data mais recente.
  const erros = [...atual.erros];
  for (const e of novo.erros) {
    const at = erros.findIndex(old => old?.key === e.key);
    if (at < 0) erros.push(e);
    else if (!(time(erros[at]) >= time(e))) erros[at] = e;
  }
  // O que entra fica no topo da biblioteca, como o material recém-salvo.
  return { saved: [...fresh, ...atual.saved], events, erros };
}

// Aviso depois de importar: quantos materiais entraram ou, sem material novo, se vieram respostas ou erros.
export function backupNote(atual, junto) {
  const materials = junto.saved.length - atual.saved.length;
  if (materials) return materials === 1 ? '1 material importado' : materials + ' materiais importados';
  return junto.events.length > atual.events.length || JSON.stringify(junto.erros) !== JSON.stringify(atual.erros)
    ? 'Desempenho e caderno de erros atualizados'
    : 'Nada novo neste arquivo';
}
