import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { animate } from 'motion/mini';
import {
  AnimatePresence, LazyMotion, MotionConfig, domMin, m, usePresence, useReducedMotion,
} from 'motion/react';
import { BrandMark, Icon } from './icons.jsx';
import { Pen } from './marks.jsx';
import { ChatComposer } from './components/ui/chat-composer.jsx';
import { PromptComposer } from './components/ui/prompt-composer.jsx';
import {
  ROUTINE, OPENING, CALM, POP, POP_CALM, FOCUS, FOCUS_CALM, FINALE, HERO, HERO_CALM, EASE_IN, EASE_OUT, MODAL,
  byKeyboard, appear, reduced, enter, flipList, leave,
} from './anim.js';
import {
  Stat, UndoRow, Wait, Orb, Sk, SummarySkeleton, CardSkeleton, QuizSkeleton, DesempenhoSkeleton, BibliotecaSkeleton,
  PerfilSkeleton, Countdown, StudyPlan, ExamDate, Waves, useWavesAllowed, useWavesStill,
} from './ui.jsx';
import {
  AREAS, LEVELS, EXAMPLE, read, readList, readUser, readDraft, demoStorage, storageKey, newId, backupStatus,
  backdropMoves,
  backupSummary, deckRestart, validMaterial, sameMaterial, validEvent, fold, demo, capText, MAX_INPUT,
  shortAnswerOk, expectedText, streak, quizRate, cardRate, weakSpot, chartDays, spokenDay, lastDays, areaLine, plural,
  deckStart, deckRight, deckWrong, deckLater, deckMissed, deckRedo, deckSummary, fitsAbove, nameCut,
  validCardReview, scheduleCard, dueCards, dayCards,
  noticeTime, topicCount, chartLine,
  matches, libraryCount, hints, chatHistory, hello, chatSubject, subjectKey, healthLabel, capReached, errorText, rateAtCap, pauseNotice, ERRORS,
  FAILS, dictate, dictationError, NO_DICTATION, examPool, mockExam, examScore, examLine,
  localDay, mistakeKey, noteAnswer, removeMistake, validMistake, byMaterial, whyQuestion, whyTopic, CONF, guessLine,
  seenStep, readSeen, stepOf, dueOf, dueMistakes, dayMistakes, backOn, restoreMistake, provaOf, studyPlan,
  gradeRequest, explainRequest, fixLastQuizEvent, readBackup, mergeBackup, backupNote, compactEvents, AI_NOTE, markExample, sourceLabel,
  shareFile, cardLines, ankiFile, fileName,
  quizSource, mergeQuiz, QUIZ_CAP, savedCopy,
  originNote, virtualNote, findSource, markPieces, textOrigin, readWriteFirst, spokenCard, CARD_REMINDER,
  pretestCards, readSkips, pretestOpens, recallStart, recallLine, nextSkips, markRecall, shownMarks,
} from './lib.js';

const CONFIG = window.CEREBRO_CONFIG || {};
// ?demo no endereço abre a demonstração pelo Vite (http://localhost:5173/?demo),
// sem servir a raiz do repositório, onde fica o .env.
const DEMO = CONFIG.demo === true || new URLSearchParams(window.location.search).has('demo');
// A demonstração grava em chaves próprias (lib.js, storageKey): antes da primeira leitura, a do rascunho logo abaixo.
demoStorage(DEMO);
// Modo estudo (#85), o build do celular, com semIA no config.js: os dados são os de verdade, nas chaves do app com IA, e
// nenhum pedido vai para a /api. Os botões de gerar organizam o texto por frases, como na demonstração. Com ?demo, vale
// a demonstração.
const SEM_IA = !DEMO && CONFIG.semIA === true;
const API_BASE = DEMO || SEM_IA ? '' : (CONFIG.apiBaseUrl || window.location.origin).replace(/\/$/, '');
// Tela de toque: o teclado da tela não tem Shift + Enter nem Ctrl + Enter (o Enter só pula linha e quem envia é o
// botão) e abre sozinho quando o foco vai para um campo.
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
// No Mac o atalho do editor é ⌘ + Enter, e a dica embaixo dele diz isso.
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
// Foco da questão nova do quiz: no computador, direto na caixa da resposta curta; no toque, o enunciado, para o
// teclado da tela não abrir sozinho. E o de quem chega ao Dúvidas para perguntar: a caixa (no toque, o título).
const QUESTION_FOCUS = TOUCH ? ['.quiz-question'] : ['.quiz-form input', '.quiz-question'];
const ASK_FOCUS = [TOUCH ? '#chat-titulo' : '#pergunta'];
// O que estava aberto antes de um F5 (editor, material, conversa), lido uma vez na abertura.
const DRAFT = readDraft();

// O foco caiu no body ou está dentro do que vai sair da tela (sel): quem pergunta leva o foco para outro lugar.
function adrift(sel) {
  const at = document.activeElement;
  return !at || at === document.body || !!at.closest(sel);
}

// Aceita erros JSON do Python e erros de proxy em texto/HTML sem ocultar a causa. O erro sai com a frase para o aluno
// (message), os detalhes técnicos (tech) e a espera do limite por minuto (wait): lib.js, errorText e FAILS.
// stop é o sinal do botão "Cancelar" da espera: o pedido para na hora e o erro sai marcado com cancelled, para a tela
// não mostrar uma falha que o aluno pediu.
async function requestAPI(path, payload, stop) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 105000);
  const cancel = () => controller.abort();
  stop?.addEventListener('abort', cancel);
  try {
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw Object.assign(Error(FAILS.noJson), {
        tech: 'HTTP ' + response.status + ', resposta sem JSON. Confira o Python em http://127.0.0.1:8000 e o proxy do Vite.',
      });
    }
    if (!response.ok) {
      throw Object.assign(Error(), errorText(data?.detail, response.status));
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (stop?.aborted) throw Object.assign(Error('Pedido cancelado.'), { cancelled: true });
      throw Object.assign(Error(FAILS.timeout), { tech: 'O navegador desistiu depois de 105 s sem resposta do backend.' });
    }
    if (error instanceof TypeError) {
      throw Object.assign(Error(FAILS.off), { tech: 'Sem conexão com o backend (' + error.message + ').' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    stop?.removeEventListener('abort', cancel);
  }
}

// As oito seções, na ordem do menu: a página e o nome do ícone e da cor da seção (styles.css, --tab-*).
const SECTIONS = [
  ['Estudar', 'estudar'], ['Dúvidas', 'duvidas'], ['Resumos', 'resumos'], ['Flashcards', 'flashcards'],
  ['Quizzes', 'quizzes'], ['Erros', 'erros'], ['Desempenho', 'desempenho'], ['Biblioteca', 'biblioteca'],
];
const SLUG = Object.fromEntries(SECTIONS);
// No celular a barra de baixo leva o caminho do estudo (Estudar, as três partes do material e o caderno de erros) e
// "Mais", uma folha com as outras três seções e o perfil. De 600 a 850 px as outras três também ficam na barra, e
// "Mais" sai (mobile.css).
const BAR = ['Estudar', 'Resumos', 'Flashcards', 'Quizzes', 'Erros'].map(n => [n, SLUG[n]]);
const MORE = ['Dúvidas', 'Desempenho', 'Biblioteca'].map(n => [n, SLUG[n]]);
// Um nome por seção, o mesmo no menu, no título, na aba do material e na aba do navegador. A chave da página não muda:
// ela está no setPage, nas abas e no data-page do CSS. Na barra do celular vai "Caderno": os seis nomes cabem em 320 px.
const NAMES = { Resumos: 'Resumo', Quizzes: 'Quiz', Erros: 'Caderno de erros' };
const SHORT = { Erros: 'Caderno' };
const TABS = [['Resumos', 'Resumo'], ['Flashcards', 'Flashcards'], ['Quizzes', 'Quiz']];
// O que o veredito da revisão da IA muda (review): "parcial" soa como meio ponto, e só "correta" muda a resposta.
// chute: "correta" numa resposta marcada como chute (#80) de uma questão que já estava no caderno. Ela conta como acerto
// e volta ao ponto do caderno de antes da resposta; a que não estava sai, como na "correta".
const VERDICT_EFFECT = {
  correta: 'Agora conta como acerto, e a questão saiu do caderno de erros.',
  chute: 'Agora conta como acerto. Como foi chute, a questão continua no caderno de erros, no ponto em que estava.',
  parcial: 'Parcial não vale ponto: a resposta continua contando como erro, e a questão fica no caderno de erros.',
  incorreta: 'A resposta continua contando como erro, e a questão fica no caderno de erros.',
};
// O veredito do comentário da IA sobre a explicação com as próprias palavras (#82), em frase: a palavra sozinha diz
// pouco. As definições são as da instrução da IA (backend/app/prompts.py, EXPLAIN), e o backend tira do comentário o que
// desmentiria a frase (main.explain).
const OWN_VERDICT = {
  completa: 'Explicação completa: as ideias essenciais do tópico estão no que você escreveu.',
  parcial: 'Explicação parcial: o que você escreveu está certo, mas faltou uma ideia essencial.',
  incorreta: 'Explicação incorreta: o que você escreveu contradiz o tópico ou fala de outra coisa.',
};
// Os botões da certeza (#80), na ordem de CONF (lib.js).
const SURE_LABELS = { certeza: 'Tenho certeza', acho: 'Acho que sei', chute: 'Chutei' };

// Aviso fixo onde há texto escrito pela IA: a conversa, o "Não entendi, me explique" e os materiais temporários (o
// caderno de erros, o simulado, a revisão do dia). A demonstração não usa IA e não mostra. O aviso do material segue o
// material, e não o modo (cabeçalho do material).
const aiNote = API_BASE && <p className="ai-note">{AI_NOTE}</p>;

// O modelo às vezes devolve **negrito** em Markdown: mostra em negrito em vez de asteriscos soltos.
// Só casa um par colado ao texto, para não mexer em código como "a ** 2" ou "x**2".
function rich(text) {
  return String(text)
    .split(/(^|[^\w*])\*\*(?=\S)(.*?\S)\*\*(?![\w*])/)
    .map((part, i) => i % 3 === 2 ? <strong key={i}>{part}</strong> : part);
}

// Páginas carregadas à parte (React.lazy): o código de cada uma só vem quando o aluno chega nela, ou antes, quando o
// navegador fica livre (preload, no App). Já carregada, a página desenha direto, sem passar pelo esqueleto do
// Suspense. A escolha vale para a montagem inteira: trocar no meio recriaria a página e refaria a entrada dela.
function lazyView(load) {
  let View = null;
  const preload = () => load().then(mod => (View = mod.default));
  const Lazy = lazy(() => preload().then(() => ({ default: View })));
  function Page(props) {
    const [Ready] = useState(() => View);
    return Ready ? <Ready {...props} /> : <Lazy {...props} />;
  }
  Page.preload = preload;
  return Page;
}
const Desempenho = lazyView(() => import('./Desempenho.jsx'));
const Biblioteca = lazyView(() => import('./Biblioteca.jsx'));
const Perfil = lazyView(() => import('./Perfil.jsx'));
// As três partes do material. Enquanto a IA gera, cada uma mostra o esqueleto dela: uma chamada traz as três.
const MATERIAL = TABS.map(([p]) => p);

function App() {
  const [page, setPage] = useState('Estudar');
  const [user, setUser] = useState(readUser);
  const [login, setLogin] = useState(false);
  // Folha "Mais" da barra de baixo, no celular.
  const [more, setMore] = useState(false);
  // Fundo em ondas (ui.jsx, Waves): só no computador com mouse. O "Fundo animado" para as ondas (WCAG 2.2.2) e fica
  // gravado no navegador, numa chave só para a demonstração e o app com IA (lib.js, storageKey); sem nada gravado,
  // elas andam. O botão fica na barra de cima; a folha "Mais" também tem um (#144), que no celular, sem ondas, não
  // aparece. Com movimento reduzido no sistema (wavesStill, lido ao vivo) as ondas ficam paradas e o botão some; sem as
  // ondas, também (lib.js, backdropMoves). A lua do Dúvidas é parada e não conta.
  const wavesAllowed = useWavesAllowed();
  const wavesStill = useWavesStill();
  const [fundo, setFundo] = useState(() => read('fundo', true) !== false);
  // O último aviso do Waves: false sem WebGL na GPU, com o shader recusado ou com o contexto perdido; null enquanto não
  // houve aviso, e as ondas contam como ligadas.
  const [wavesActive, setWavesActive] = useState(null);
  const fundoShown = backdropMoves({ still: wavesStill, waves: wavesAllowed && wavesActive !== false });
  // A troca do "Fundo animado" que o navegador não gravou: o aviso sai também na folha "Mais", junto do botão.
  const [fundoUnsaved, setFundoUnsaved] = useState(false);
  const toggleFundo = () => {
    setFundo(!fundo);
    setFundoUnsaved(!persist('fundo', !fundo));
  };
  // O botão some com a folha "Mais" aberta (movimento reduzido ou contraste alto ligados). Com o foco nele, o foco
  // cairia no body, fora da janela modal, e o primeiro Tab sairia da página: vai para o "Fechar". A função do ref não
  // muda, e o React só a chama com null logo antes de tirar o botão do DOM.
  const fundoButton = useRef(null);
  const fundoRef = useCallback(el => {
    if (!el && fundoButton.current === document.activeElement) {
      fundoButton.current.closest('dialog')?.querySelector('[aria-label=Fechar]')?.focus();
    }
    fundoButton.current = el;
  }, []);
  const [name, setName] = useState(user?.name || '');
  const [area, setArea] = useState(DRAFT.area || (AREAS.includes(user?.area) ? user.area : 'Tecnologia'));
  const [level, setLevel] = useState(DRAFT.level || 'Básico');
  const [input, setInput] = useState(DRAFT.input);
  const [result, setResult] = useState(DRAFT.result);
  // Espera de um pedido à IA fora do chat: { kind, label, since }. kind é o pedido (gerar, why, review, own,
  // example), para a espera aparecer no botão dele; label vai na espera (ui.jsx, Wait, só com o fio: o orbe fica na
  // pílula do Dúvidas); since é a hora do pedido, para os segundos.
  // Na geração, prior é o material aberto no clique (o esqueleto só cobre ele); na revisão, answer é a resposta revista;
  // no comentário da explicação com as próprias palavras, item é o tópico.
  const [busy, setBusy] = useState(null);
  // Aviso de erro do Estudar e do Dúvidas: { message, tech, until } (Problem, abaixo), ou null.
  const [error, setError] = useState(null);
  // Limite por minuto: a hora em que os botões da IA voltam (o backend manda quantos segundos esperar), ou 0.
  const [pausedUntil, setPausedUntil] = useState(0);
  // Quantos tópicos do resumo aparecem: 'todos', '6' ou '3' (a lista "Mostrar"). O texto de cada tópico não muda.
  const [size, setSize] = useState('todos');
  // "Esconder o texto" (modo lembrar, #81): cada tópico fica só com o título até o "Mostrar". Vale para todos os
  // materiais, como a lista "Mostrar", e não é gravado.
  const [hide, setHide] = useState(false);
  // Resumo ativo (#81) do material aberto: o "Tente responder antes de ler" e o que o aluno mostrou e marcou no modo
  // lembrar (lib.js, recallStart). Fica só na tela: nada vai para o desempenho, o caderno de erros nem o rascunho.
  const [recall, setRecall] = useState(() => recallStart(DRAFT.result));
  // Material ou evento estragado fica fora da tela, mas continua gravado: quem grava parte da lista do navegador.
  const [saved, setSaved] = useState(() => readList('saved').filter(validMaterial));
  const [events, setEvents] = useState(() => readList('events').filter(validEvent));
  // Data do último backup (Exportar ou "Fazer backup"), em texto ISO: a linha do pé da Biblioteca e do Desempenho.
  const [lastBackup, setLastBackup] = useState(() => read('backup', null));
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  // Campo "Sua resposta", embaixo do cartão: o que o aluno escreveu antes de virar (só nesta tela, não é gravado) e
  // locked, o cartão já virado: o campo fica só para leitura até o próximo cartão. write é a caixa "Escrever antes de
  // virar", que mostra o campo (lib.js, readWriteFirst).
  const [typed, setTyped] = useState('');
  const [locked, setLocked] = useState(false);
  const [write, setWrite] = useState(() => readWriteFirst(TOUCH));
  const [answer, setAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  // Marcar certeza (#80): com a caixa ligada, a opção escolhida (choice, o índice dela) espera a certeza para ir à
  // correção. A caixa (sure) fica no navegador e começa ligada; valor estragado vale ligada.
  const [choice, setChoice] = useState(null);
  const [sure, setSure] = useState(() => read('certeza', true) !== false);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  // Quantas questões o simulado da Biblioteca pede: 10, 20 ou 30 (startExam).
  const [examSize, setExamSize] = useState(10);
  const [chartArea, setChartArea] = useState('Todas');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState(DRAFT.chat);
  // O chat pergunta sobre o texto do editor mesmo com um material aberto: o aluno escolheu na caixa do Dúvidas ou
  // perguntou pelo editor. Abrir ou gerar outro material volta ao material (lib.js, chatSubject).
  const [editorChat, setEditorChat] = useState(DRAFT.editorChat);
  // Aviso na tela: { text, action }. action = { label, run } põe um botão no aviso (desfazer, abrir).
  const [notice, setNotice] = useState(null);
  // O que a região fixa do leitor de tela diz (#anuncio, fora do main): o que muda na tela sem um aviso visível.
  const [spoken, setSpoken] = useState('');
  // Desfazer sem prazo: { kind, text, run, focus }. O aviso some sozinho; este botão fica onde a ação aconteceu
  // (kind: 'texto' no editor, 'material' na biblioteca, 'erro' no caderno, 'conversa' no Dúvidas) até o aluno trocar
  // de página ou desfazer.
  const [undo, setUndo] = useState(null);
  const [retry, setRetry] = useState(null);
  const [tips, setTips] = useState(DRAFT.tips);
  // Espera da resposta do chat, mostrada dentro da conversa: a hora do pedido, ou false. busy é a espera dos outros
  // pedidos à IA: a geração do material, a explicação pedida de dentro do estudo e a revisão de uma resposta.
  const [asking, setAsking] = useState(false);
  // Resposta de /api/health: null enquanto não chegou, false se a consulta falhou.
  const [health, setHealth] = useState(null);
  // Baralho da sessão de flashcards: a fila de cartões e a posição nela (lib.js). null = todos os cartões, na ordem.
  const [deck, setDeck] = useState(null);
  // Caderno de erros: as questões erradas de todos os materiais (lib.js). Como a biblioteca, o que está estragado
  // fica fora da tela e continua gravado.
  const [mistakes, setMistakes] = useState(() => readList('erros').filter(validMistake));
  // Revisão espaçada dos cartões: a caixa e o dia de volta de cada cartão avaliado (lib.js, scheduleCard). Como o
  // caderno, o que está estragado fica fora da tela e continua gravado.
  const [boxes, setBoxes] = useState(() => readList('cartoes').filter(validCardReview));
  // Material que estava aberto quando o quiz do caderno de erros, o simulado ou a revisão do dia dos cartões tomou o
  // lugar dele. Só vale enquanto result é um material temporário (result.virtual).
  const [parked, setParked] = useState(null);
  // "Não entendi, me explique": { item, text } ou { item, error }; item é a questão ou o tópico do pedido.
  // Só com item, a resposta ainda não chegou.
  const [why, setWhy] = useState(null);
  // "Explicar com minhas palavras" (#82), num tópico por vez, como o why: { item, text, compared, review, error }. item
  // é o tópico; text, o que o aluno escreve, que só fica na tela; compared, a comparação à vista; review, o comentário da
  // IA ({ verdict, missing, misconception }); error, o erro do pedido. Nada disso é gravado nem conta no desempenho.
  const [own, setOwn] = useState(null);
  // "Questões novas deste material", no fim do quiz: { of, error } quando o pedido falhou, ou { of, list, resumo } com
  // as questões que entraram e se elas saíram do resumo. of é o material do pedido: o erro só aparece no fim do quiz dele.
  const [extra, setExtra] = useState(null);
  // Janela "Ver no texto" de um tópico do resumo: { texto, range, origin, concept }, ou null. range é onde o trecho
  // está no texto (lib.js, findSource), ou null; origin, de onde o texto veio (lib.js, textOrigin). Tudo é guardado no
  // clique: o material aberto pode mudar com a janela aberta (a geração que terminou longe do Estudar).
  const [passage, setPassage] = useState(null);
  // Ditado em andamento: o botão vira "Parar ditado".
  const [listening, setListening] = useState(false);
  // Arquivo sendo lido pelo "Abrir arquivo" (openFile): o botão diz que está lendo e não abre outro.
  const [reading, setReading] = useState(false);
  // Escolha de páginas do PDF com mais texto que o editor recebe: { reader, name, pages, total, from, to }. reader é o
  // arquivo.js, que junta as páginas escolhidas; total, os caracteres do PDF inteiro.
  const [pick, setPick] = useState(null);
  // Janela "Compartilhar" de um material (o do cabeçalho ou o de um item da Biblioteca), ou null.
  const [sharing, setSharing] = useState(null);
  // Folha de impressão na página: { material, Folha }, com o Folha.jsx, que chega à parte. Ela só aparece na impressão
  // (styles.css), e o afterprint a tira (useEffect de printing).
  const [printing, setPrinting] = useState(null);
  // Última geração: { key }, o texto, a área e o nível do material aberto. Com eles iguais aos do editor, o Estudar
  // troca o botão de gerar pelos que só abrem o material.
  const made = useRef(DRAFT.made);
  // Material de verdade que está aberto: durante o quiz do caderno de erros, o simulado e a revisão do dia é o que
  // ficou guardado.
  const opened = result?.virtual ? parked : result;
  // Página e material aberto deste desenho. generate() espera a IA por até 105 s e, na volta, ainda enxerga os do
  // clique. O texto do editor, a área e o nível vão junto: na volta da IA e do arquivo dos exemplos, addExample()
  // confere se o aluno mexeu neles durante a espera. virtual: o material temporário está na tela. done: o quiz
  // terminou, e o fim dele está na página do quiz.
  const latest = useRef({});
  latest.current = { page, result: opened, virtual: !!result?.virtual, done, input, area, level };
  const noticeTimer = useRef(null);
  const noticeEnd = useRef(0); // hora em que o aviso da tela sai sozinho (Date.now())
  const chatEnd = useRef(null);
  // A linha de chips de sugestão do Dúvidas: volta ao começo quando a lista muda (useLayoutEffect mais abaixo).
  const chipsRow = useRef(null);
  // Pedido à IA em andamento (AbortController): o botão "Cancelar" da espera o interrompe.
  const pending = useRef(null);
  const recognition = useRef(null);
  // O campo de arquivo, escondido, que o "Abrir arquivo" abre.
  const picker = useRef(null);
  // As páginas escolhidas na janela de páginas, que entram no editor quando ela sai (takePages).
  const pickDone = useRef(null);
  // Fim da saída da janela "Compartilhar": o aviso de cada saída espera por ele (closeShare).
  const shareGone = useRef(null);
  // Tema do último exemplo que entrou no editor: vai no pedido seguinte (avoid), para a IA não repetir o tema.
  const exampleTopic = useRef('');
  // Texto do último exemplo que a IA escreveu e pôs no editor ('' quando o exemplo é pronto e depois do Limpar): o
  // trecho do material que sai dele não é do aluno (generate). Vai no rascunho, para valer depois de um F5.
  const aiExample = useRef(DRAFT.exemplo);
  // O mesmo para o exemplo pronto, que também não é do aluno ('' quando o exemplo é da IA e depois do Limpar).
  const readyExample = useRef(DRAFT.exemploPronto);
  // Rascunho mais recente, gravado no navegador com atraso (veja abaixo).
  const draft = useRef(null);
  const viewed = useRef(false);
  // A página da vez (Resumos, Flashcards e Quizzes são a mesma, a do material) e a hora em que ela abriu, gravadas
  // depois de cada troca (useLayoutEffect abaixo). live: a página já estava na tela antes deste desenho, então o que
  // monta agora dentro dela anima à parte; o que vem junto com ela não, a entrada é a da página. cut: outra troca antes
  // de ela assentar (0,4 s: a mola de 0,36 s e o escalonamento): o aluno passou direto, e a troca corta para a nova, sem
  // entrada nem saída.
  const viewKey = MATERIAL.includes(page) ? 'material' : page;
  const viewAt = useRef({ key: null, at: -Infinity });
  const live = viewAt.current.key === viewKey;
  const cut = !live && performance.now() - viewAt.current.at < 400;
  // Variantes do Motion (anim.js): com movimento reduzido, só a opacidade. A primeira página (a abertura do app) entra
  // bloco a bloco; as trocas de seção, quase de uma vez. As duas na mola de 0,36 s.
  const calm = useReducedMotion();
  const { view: viewIn, title: titleIn, rise, fade } = calm ? CALM : viewAt.current.key === null ? OPENING : ROUTINE;
  const pop = calm ? POP_CALM : POP;
  const focusIn = calm ? FOCUS_CALM : FOCUS;
  const hero = calm ? HERO_CALM : HERO;
  const errorBox = useRef(null);
  const cardText = useRef(null);
  // Movimento pedido para o próximo desenho do cartão (virar ou passar para o seguinte).
  const cardMotion = useRef(null);
  // Marcas do caderno de erros já mostradas (chave e data do erro): na volta ao caderno só a de um erro novo desde a
  // última visita se desenha, as outras aparecem prontas. As que já estavam no caderno na abertura contam como vistas.
  const [penned] = useState(() => new Set(mistakes.map(m => m.key + m.date)));
  // Foco pedido por uma ação que tirou o controle da tela (excluir, desfazer, responder): [seletor, reserva] e, ao
  // responder, o que rola até a vista (show e whole, no efeito abaixo).
  const focusAfter = useRef(null);

  // O texto do editor, o material aberto e a conversa sobrevivem a um F5. O material temporário (caderno de erros,
  // simulado, revisão do dia) não entra: no lugar dele vai o que estava aberto.
  // Gravação que falha fica sem aviso: aqui seria um aviso por tecla.
  // A gravação espera 0,4 s sem mudança: gravar o rascunho inteiro a cada tecla pesava na digitação. Sair da página
  // (F5, fechar a aba) ou escondê-la grava na hora o que ainda não foi gravado.
  useEffect(() => {
    draft.current = {
      input, area, level, result: opened, made: made.current, chat, tips, editorChat,
      exemplo: aiExample.current, exemploPronto: readyExample.current,
    };
    const timer = setTimeout(saveDraft, 400);
    return () => clearTimeout(timer);
  }, [input, area, level, opened, chat, tips, editorChat]);

  // Na volta à aba, o estado da IA é conferido de novo: com o teto do dia atingido nenhum pedido sai, e é esta
  // consulta que mostra a virada do dia e religa os botões da IA.
  useEffect(() => {
    const visibility = () => (document.visibilityState === 'hidden' ? saveDraft() : API_BASE && checkHealth());
    window.addEventListener('pagehide', saveDraft);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', saveDraft);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  // Outra aba gravou a biblioteca, o desempenho, o caderno de erros, as caixas dos cartões, o perfil, a data do backup
  // ou o "Fundo animado": esta mostra a mudança sem F5, com a mesma conferência da abertura. O evento não chega à aba
  // que gravou. O rascunho fica de fora: cada aba fica com o seu. key null: outra aba apagou tudo.
  useEffect(() => {
    const sync = e => {
      const changed = k => e.key === null || e.key === storageKey(k);
      if (changed('saved')) setSaved(readList('saved').filter(validMaterial));
      if (changed('events')) setEvents(readList('events').filter(validEvent));
      if (changed('erros')) setMistakes(readList('erros').filter(validMistake));
      if (changed('cartoes')) setBoxes(readList('cartoes').filter(validCardReview));
      if (changed('backup')) setLastBackup(read('backup', null));
      if (changed('fundo')) setFundo(read('fundo', true) !== false);
      if (changed('user')) {
        const profile = readUser();
        setUser(profile);
        setName(profile?.name || '');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (API_BASE) checkHealth();
  }, []);

  // Modo estudo: o navegador é pedido para não apagar os dados sozinho, e o manifest entra só aqui (com ele, o navegador
  // oferece instalar o app; o app com IA e a demonstração ficam como estão). O service worker (sw-molde.js) guarda os
  // arquivos do build, e o app abre sem rede. A versão nova espera o "Atualizar" do aviso, oferecido quando ela chega,
  // na abertura e na volta à aba; com ele, esta página e as outras abas recarregam na versão nova.
  useEffect(() => {
    if (!SEM_IA) return;
    navigator.storage?.persist?.();
    document.head.append(Object.assign(document.createElement('link'), { rel: 'manifest', href: './manifest.webmanifest' }));
    const sw = navigator.serviceWorker;
    if (!sw) return;
    let reg = null;
    // Sem controller é a primeira visita: o service worker que chega não é versão nova.
    const offer = () => {
      if (reg?.waiting && sw.controller) {
        toast('Versão nova do Cérebro', { label: 'Atualizar', run: () => reg.waiting?.postMessage('atualizar') });
      }
    };
    const watch = worker => worker?.addEventListener('statechange', () => worker.state === 'installed' && offer());
    sw.register('./sw.js').then(r => {
      reg = r;
      watch(r.installing);
      r.addEventListener('updatefound', () => watch(r.installing));
      offer();
    }, () => {});
    const back = () => {
      if (document.visibilityState !== 'visible' || !reg) return;
      offer();
      reg.update().catch(() => {});
    };
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    document.addEventListener('visibilitychange', back);
    sw.addEventListener('controllerchange', reload);
    return () => {
      document.removeEventListener('visibilitychange', back);
      sw.removeEventListener('controllerchange', reload);
    };
  }, []);

  // A demonstração do build do modo estudo não registra o service worker, mas abre do cache dele: com o "Atualizar" de
  // outra aba, ela também recarrega na versão nova, e não pede depois um arquivo que já saiu do cache.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!DEMO || CONFIG.semIA !== true || !sw) return;
    const reload = () => window.location.reload();
    sw.addEventListener('controllerchange', reload);
    return () => sw.removeEventListener('controllerchange', reload);
  }, []);

  // Na abertura, o histórico gravado perde as repetições de dias passados (lib.js, compactEvents) e é gravado de novo
  // pelo persist(), como nas outras gravações. Relido aqui, depois do primeiro desenho: outra aba pode ter gravado nesse
  // meio-tempo. Se a gravação falhar, a lista gravada continua inteira. Os números da tela não mudam, e a próxima
  // resposta já parte da lista nova.
  useEffect(() => {
    const stored = readList('events');
    const list = compactEvents(stored, new Date());
    if (list.length < stored.length) persist('events', list);
  }, []);

  // O código das páginas carregadas à parte vem quando o navegador fica livre: na hora do clique ele já está aqui e
  // o esqueleto do Suspense não pisca. O do orbe da IA (ui.jsx, Orb) também: ele só aparece numa espera ou no ditado.
  useEffect(() => {
    const load = () => {
      [Desempenho, Biblioteca, Perfil].forEach(page => page.preload().catch(() => {}));
      import('thinking-orbs').catch(() => {});
    };
    if (!window.requestIdleCallback) {
      const timer = setTimeout(load, 1500);
      return () => clearTimeout(timer);
    }
    const id = requestIdleCallback(load, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, []);

  // A conversa ocupa a página, com a caixa de pergunta presa embaixo: sem isto a resposta nova chegava fora da vista.
  // Sem mensagens não rola: o herói começa do título.
  useEffect(() => {
    if (page === 'Dúvidas' && chat.length) chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [chat, asking, page]);

  // A página nova começa do topo; a entrada dela é a do m.div da página (key, anim.js: ROUTINE).
  useLayoutEffect(() => {
    document.title = (NAMES[page] || page) + ' · Cérebro';
    if (!viewed.current) {
      viewed.current = true;
      return;
    }
    window.scrollTo(0, 0);
    // No toque, o quiz chega com o enunciado à vista: nos telefones baixos, a faixa presa da certeza (#80) o cobria. A
    // rolagem para acima dela, ou do "Próxima questão", e da barra de baixo (mobile.css, scroll-padding da raiz). O foco
    // fica onde o aluno tocou.
    if (TOUCH && page === 'Quizzes') document.querySelector('.quiz-question')?.scrollIntoView({ block: 'nearest' });
  }, [page]);

  useLayoutEffect(() => {
    viewAt.current = { key: viewKey, at: performance.now() };
  }, [viewKey]);

  // O caderno mostrou estas marcas: na próxima visita elas aparecem prontas.
  useEffect(() => {
    if (page === 'Erros') mistakes.forEach(m => penned.add(m.key + m.date));
  }, [page, mistakes]);

  // O desfazer que fica na tela é da página onde a ação aconteceu: trocar de página encerra a chance. O do texto que a
  // janela "Ver no texto" leva ao editor nasce junto com a troca para o Estudar e fica (textToEditor).
  useEffect(() => setUndo(u => (u?.kind === 'texto' && page === 'Estudar' ? u : null)), [page]);

  // O aviso de erro do Estudar (texto curto, geração que falhou) sai quando o texto do editor muda: digitado, ditado,
  // trocado pelo exemplo ou desfeito. Antes ele ficava na tela com o texto já certo. O do limite por minuto fica até a
  // espera acabar: é ele que conta os segundos até os botões da IA voltarem.
  // Só chama setError quando há erro para tirar: sem a guarda, cada tecla fazia um segundo desenho, vazio. error fica
  // fora das dependências de propósito: com ele, o erro sumiria logo depois de aparecer.
  useEffect(() => {
    if (error && !(error.until > Date.now())) setError(null);
  }, [input]);

  // Os botões da IA voltam sozinhos quando a espera do limite por minuto acaba.
  useEffect(() => {
    if (!pausedUntil) return;
    const timer = setTimeout(() => setPausedUntil(0), pausedUntil - Date.now());
    return () => clearTimeout(timer);
  }, [pausedUntil]);

  // A frase da região fixa (#anuncio) sai dela 8 s depois de lida: a velha ("Gerando o material", depois de um erro ou
  // do Cancelar) não fica na página para quem a percorre com o leitor de tela.
  useEffect(() => {
    if (!spoken) return;
    const timer = setTimeout(() => setSpoken(''), 8000);
    return () => clearTimeout(timer);
  }, [spoken]);

  // O texto do cartão virado ou do seguinte muda com movimento, em 0,16 s, e o cartão fica parado: o aluno faz isso
  // muitas vezes (anim.js, enter).
  useLayoutEffect(() => {
    if (cardMotion.current) enter(cardText.current, cardMotion.current);
    cardMotion.current = null;
  });

  useEffect(() => {
    if (!focusAfter.current) return;
    const [selector, fallback, show, whole, lead] = focusAfter.current;
    focusAfter.current = null;
    // A última ocorrência: numa troca de página, a que sai (AnimatePresence, popLayout) fica no DOM antes da nova. Só a
    // que está na tela: o focus() num alvo escondido (display none) não pega, e o foco caía no body sem tentar a reserva.
    const last = s => s && [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).pop();
    // Com show (ou whole), o foco não rola a página: o navegador centraliza o que recebe o foco, e no celular deitado
    // as marcas da caneta saíam pelo topo. Quem rola é o show. Se o bloco inteiro (whole) cabe no que sobra da janela
    // (no celular a raiz desconta a barra de baixo e o "Próxima questão" preso, mobile.css; a faixa fica dentro do bloco
    // e conta uma vez só), ele vem todo, com o botão de seguir; senão, só o último elemento que casa, com as marcas ✓ e
    // ✗ e a nota acima da faixa. Sem caber, o lead (o cartão virado), quando há, leva o foco e sobe para o topo.
    const box = last(whole);
    // Só a faixa presa sai da reserva: na janela baixa ela rola com a página, e a raiz já não a desconta (mobile.css).
    const strip = box?.querySelector('.next-row');
    const fits = box && fitsAbove(box.offsetHeight, innerHeight,
      getComputedStyle(document.documentElement).scrollPaddingBottom,
      strip && getComputedStyle(strip).position === 'sticky' ? strip.offsetHeight : 0);
    const top = box && !fits && last(lead);
    (top || last(selector) || last(fallback))?.focus({ preventScroll: !!(show || box) });
    if (top) top.scrollIntoView({ block: 'start' });
    else (fits ? box : last(show))?.scrollIntoView({ block: 'nearest' });
  });

  // O erro aparece junto do que o aluno clicou; se estiver fora da vista (no celular), a página rola até ele.
  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }, [error]);

  // A folha de impressão (printSheet) entrou na página: o navegador abre a prévia, e o afterprint a tira. O título da aba
  // vira o do material enquanto isso: é o nome que o "Salvar como PDF" propõe. Se outra página já trocou o título, ele
  // fica.
  useEffect(() => {
    if (!printing) return;
    const title = document.title;
    const done = () => setPrinting(null);
    document.title = printing.material.title;
    window.addEventListener('afterprint', done);
    window.print();
    return () => {
      window.removeEventListener('afterprint', done);
      if (document.title === printing.material.title) document.title = title;
    };
  }, [printing]);

  // O material temporário (o quiz do caderno de erros, o simulado ou a revisão do dia dos cartões) só vale na página
  // dele, a que fica em virtual: sair dela por qualquer caminho (menu, logotipo, botão de um aviso) traz de volta o
  // material que estava aberto, com o quiz e o baralho no início.
  // Mudar o estado durante o desenho faz o React refazer o desenho na hora: a página nova nunca aparece com o
  // material temporário.
  if (result?.virtual && page !== result.virtual) {
    setResult(parked);
    restart();
  }

  // Outro material aberto: o resumo ativo começa do zero, também durante o desenho, como acima. O mesmo material em
  // outra cópia (o salvo agora, o mesmo da biblioteca, a volta do quiz do caderno de erros ou da revisão do dia) continua
  // onde estava, como o quiz e o baralho.
  if (opened && recall.of !== opened) {
    setRecall(recall.of && sameMaterial(recall.of, opened) ? { ...recall, of: opened } : recallStart(opened));
  }

  // O campo do "Explicar com minhas palavras" é de um tópico do material aberto. Aberto outro material, ou outra cópia
  // do mesmo (da biblioteca), o tópico dele sai da tela: o campo fecha, e o comentário pedido sai junto, porque não teria
  // onde aparecer e seria anunciado sem nada na tela. O material temporário guarda o aberto (opened), e o campo fica.
  useEffect(() => {
    if (!own || opened?.summary?.includes(own.item)) return;
    if (busy?.kind === 'own') cancelAI();
    setOwn(null);
  }, [opened]);

  // Grava também na aba (sessionStorage): o F5 traz o rascunho desta aba (lib.js, readDraft). Cada gravação tem o seu
  // try: a que falha não impede a outra.
  function saveDraft() {
    if (!draft.current) return;
    const text = JSON.stringify(draft.current);
    try {
      localStorage.setItem(storageKey('rascunho'), text);
    } catch {}
    try {
      sessionStorage.setItem(storageKey('rascunho'), text);
    } catch {}
  }

  // Volta ao início do quiz. "list" = só as questões erradas, ou só as novas; sem ele, o quiz completo. O erro do pedido
  // de questões novas sai junto com o fim do quiz onde ele estava.
  function restartQuiz(list = null) {
    setIdx(0);
    setDone(false);
    setAnswer(null);
    setChoice(null);
    setAnswers([]);
    setRetry(list);
    setWhy(null);
    setExtra(x => (x?.error ? null : x));
  }

  // Volta ao início do quiz e do baralho: só quando o material aberto muda (gerado, aberto da biblioteca, o quiz do
  // caderno de erros, o simulado ou a revisão do dia entrando ou saindo). Trocar de aba ou de página não recomeça: o
  // aluno volta onde estava.
  function restart() {
    restartQuiz();
    freshCard();
    setDeck(null);
  }

  function persist(k, v) {
    try {
      localStorage.setItem(storageKey(k), JSON.stringify(v));
      return true;
    } catch {
      toast('Não foi possível salvar no navegador. Verifique o espaço e as permissões.');
      return false;
    }
  }

  // O aviso fica o tempo de ler o texto dele, e o com ação, pelo menos 10 segundos, para dar tempo de clicar (lib.js,
  // noticeTime); não some enquanto o mouse, o dedo ou o foco estão nele.
  // O temporizador do aviso anterior é cancelado: ele apagava o aviso novo antes da hora.
  function toast(text, action) {
    clearTimeout(noticeTimer.current);
    setNotice({ text, action });
    noticeEnd.current = Date.now() + noticeTime(text, action);
    noticeTimer.current = setTimeout(() => setNotice(null), noticeTime(text, action));
  }

  // O leitor de tela lê o texto novo da região fixa. O mesmo texto outra vez (gerar de novo o mesmo material, a mesma
  // contagem da busca) ganha um espaço no fim: sem mudança na região, ele não seria lido.
  function say(text) {
    setSpoken(s => (s === text ? text + '\u00a0' : text));
  }

  function holdNotice() {
    clearTimeout(noticeTimer.current);
  }

  // Soltar não encurta o aviso: ele sai na hora que já tinha (noticeEnd), ou 4 s depois de solto, o que vier por último.
  function releaseNotice() {
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), Math.max(4000, noticeEnd.current - Date.now()));
  }

  // Ação desfeita pelo aviso ou pelo botão que ficou na tela. focus é para onde vai o foco depois.
  function offerUndo(kind, text, run, focus) {
    const entry = { kind, text, run, focus };
    setUndo(entry);
    toast(text, { label: 'Desfazer', run: () => undoNow(entry) });
  }

  // O que volta para a lista entra com flipList() (anim.js): os itens abrem o vão em vez de pular. A linha do Desfazer
  // sai do fluxo no mesmo desenho (popLayout), então a medida já é a da lista final e nada pula no fim da saída dela.
  function undoNow(entry) {
    clearTimeout(noticeTimer.current);
    if (entry.focus) focusAfter.current = entry.focus;
    flipList(document.querySelector('main .panel'), () => {
      setUndo(u => (u === entry ? null : u));
      setNotice(null);
      entry.run();
    });
  }

  // O cabeçalho mostra o estado real da IA. A consulta não chama o provedor.
  async function checkHealth() {
    try {
      const response = await fetch(API_BASE + '/api/health', { signal: AbortSignal.timeout(5000) });
      setHealth((response.ok && await response.json()) || false);
    } catch {
      setHealth(false);
    }
  }

  // Todo pedido à IA termina com uma consulta nova: o contador de chamadas anda e um backend que caiu aparece na hora.
  // No limite por minuto os botões da IA ficam desligados pelo tempo que o backend mandou; o erro leva a hora da volta
  // (until) para a contagem dele.
  async function callAI(path, payload) {
    const stop = new AbortController();
    pending.current = stop;
    try {
      return await requestAPI(path, payload, stop.signal);
    } catch (e) {
      if (e.wait) {
        e.until = Date.now() + e.wait * 1000;
        setPausedUntil(e.until);
      }
      throw e;
    } finally {
      if (pending.current === stop) pending.current = null;
      // A frase de espera da região fixa ("Esperando a explicação…") só vale durante o pedido. Sem ela, a frase do teto
      // que chega logo depois (useLayoutEffect de capped) só se junta ao que foi dito no fim dele ("Material pronto").
      setSpoken('');
      checkHealth();
    }
  }

  // "Cancelar" na espera: o pedido em andamento para e a tela volta ao que estava, sem aviso de erro.
  function cancelAI() {
    pending.current?.abort();
  }

  // Outra aba pode ter gravado depois que esta abriu: a lista nova parte do que está no navegador, não da cópia
  // desta aba, que apagaria o que a outra gravou. Se o navegador recusar a gravação, o evento fica só nesta tela.
  // q é o enunciado da questão do quiz: com ele o desempenho conta só a primeira resposta de cada questão no dia.
  // extra leva campos a mais da resposta: a certeza marcada no quiz (conf, #80), o resultado da questão no outro dia
  // (prev, #78) e caderno: true, quando a questão estava no caderno de erros antes da resposta. É pelo caderno que a
  // véspera da prova sabe o que o caderno de erros tinha no começo do dia (lib.js, studyPlan).
  function event(kind, ok, topic = area, q, title = result?.title, extra) {
    const entry = { kind, ok, area: topic, title, q, ...extra, date: new Date().toISOString() };
    const next = [...readList('events'), entry];
    setEvents(persist('events', next) ? next.filter(validEvent) : [...events, entry]);
  }

  // Muda o caderno de erros a partir da lista do navegador, como event(). Se o navegador recusar a gravação, a
  // mudança vale só nesta tela. Devolve true se gravou.
  function notebook(change) {
    const next = change(readList('erros'));
    const stored = persist('erros', next);
    setMistakes(stored ? next.filter(validMistake) : change);
    return stored;
  }

  // Muda as caixas dos cartões a partir da lista do navegador, como notebook().
  function schedule(change) {
    const next = change(readList('cartoes'));
    setBoxes(persist('cartoes', next) ? next.filter(validCardReview) : change);
  }

  // De onde vem a questão ou o tópico: o material aberto ou, no quiz do caderno de erros e no simulado, o material e a
  // área que a questão traz. Área e nível vão nos pedidos à IA, que só aceita os das listas: material antigo ou
  // importado pode não ter (e o temporário não tem nível), e aí valem a área do editor e o nível Básico.
  function origin(item) {
    const from = result.virtual ? item : result;
    return {
      title: from.title,
      area: AREAS.includes(from.area) ? from.area : area,
      level: LEVELS.includes(result.level) ? result.level : 'Básico',
    };
  }

  // O menu sempre sai do material temporário, até o botão da página dele (Quizzes no caderno de erros e no simulado,
  // Flashcards na revisão do dia), que não troca de página: volta o material que estava aberto, com o quiz e o baralho
  // no início. Fora disso o menu não recomeça o quiz nem o baralho.
  function go(next) {
    if (result?.virtual) {
      setResult(parked);
      restart();
    }
    // O foco fica no menu, e só o título da janela muda: o leitor de tela ouve para onde o aluno foi.
    if (next !== page) say('Página ' + (NAMES[next] || next) + '.');
    setPage(next);
    // O aviso de erro é da página em que o pedido falhou: não acompanha o aluno para as outras.
    setError(null);
    setMore(false);
  }

  // Botão do conteúdo que leva a outra página: ele sai da tela com a página velha, e o foco iria para o body. O foco vai
  // para o título da página nova, ou para um lugar mais útil dela (focus).
  function openPage(next, focus = ['main h1']) {
    setPage(next);
    focusAfter.current = focus;
  }

  async function generate() {
    if (waiting) return;
    setError(null);
    if (input.trim().length < (API_BASE ? 3 : 30)) {
      setError({
        message: SEM_IA ? 'Cole um texto completo (mínimo 30 caracteres): sem IA, os botões organizam as frases dele.'
          : 'Escreva um tema (mínimo 3 caracteres com IA) ou cole um texto completo (mínimo 30 na demonstração).',
      });
      return;
    }
    // Uma resposta traz resumo, flashcards e quiz, e o material abre no Resumo. Todo clique gera material novo: com o
    // mesmo texto, a mesma área e o mesmo nível (made), o Estudar oferece abrir as partes sem chamar a IA.
    const key = JSON.stringify([input, area, level]);
    // Os exemplos que acompanham o texto deste clique: o Desfazer do aviso pode trocar tudo durante a espera.
    const example = aiExample.current;
    const ready = readyExample.current;
    const target = 'Resumos';
    // Espera de verdade só com a IA: o Resumo abre na hora, com o esqueleto dele no lugar onde o material vai entrar. A
    // demonstração é instantânea e não mostra espera nenhuma.
    // O quiz e o baralho só recomeçam quando o material chega: cancelar ou falhar devolve o anterior no mesmo ponto.
    const wait = !!API_BASE;
    setBusy({ kind: 'gerar', label: 'Gerando o material…', since: Date.now(), prior: result });
    if (wait) {
      setPage(target);
      // O botão apertado sai da tela com o Estudar: o foco espera no título da página do material, e o leitor de tela
      // ouve que a IA está trabalhando (os segundos ficam de fora).
      say('Gerando o material. A IA pode levar até 1 minuto.');
      focusAfter.current = ['main h1'];
    }
    try {
      let data;
      if (API_BASE) {
        data = await callAI('/api/generate', { content: input, area, level });
      } else {
        data = demo(input);
      }
      // A mesma conferência do rascunho e da biblioteca: o que abre aqui também volta depois de um F5.
      if (!validMaterial(data)) {
        throw Error('A IA mandou um material incompleto. Tente de novo.');
      }
      // Trecho copiado de um exemplo não é do aluno: o do exemplo da IA não confere nada (seria a IA citando a si
      // mesma), e o do exemplo pronto sai como texto de exemplo. As marcas ia e pronto vão com o material para a
      // biblioteca, o rascunho e o backup. Na demonstração o trecho é a própria frase: a do exemplo pronto ganha marca.
      data = { ...data, summary: markExample(data.summary, example, ready) };
      // O material aberto agora (não o do clique) vai para a biblioteca antes de o novo tomar o lugar.
      // Se o novo é igual a ele, não há o que guardar: é a demonstração, que repete o material do mesmo texto.
      const previous = latest.current.result;
      const kept = !!previous && !sameMaterial(previous, data) && keep(previous);
      // O novo também vai para a biblioteca na hora, depois do anterior, para ficar no topo: com o app em duas abas,
      // o rascunho de uma podia apagar o material que a outra gerou e não salvou. O que já está lá com o mesmo
      // conteúdo, a mesma área e o mesmo nível (a demonstração, no "Gerar de novo" com o mesmo texto) abre sem cópia.
      // Se o navegador recusar, ele abre sem id, e o "Salvar material" continua lá para tentar de novo.
      // O texto do clique vai junto (texto): é nele que a janela "Ver no texto" mostra o trecho de cada tópico.
      const material = { ...data, area, level, texto: input };
      const stored = readList('saved');
      const twin = stored.findIndex(m =>
        validMaterial(m) && sameMaterial(m, material) && m.area === area && m.level === level);
      // O que já está lá fica com o texto deste clique: a demonstração só usa as 8 primeiras frases, e o resto do texto
      // pode ter mudado. O material de antes do campo texto também o ganha. O igual que veio de um colega, com a mesma
      // área e o mesmo nível, perde a marca recebido: agora ele foi gerado aqui, do texto daqui. Com outra área ou
      // outro nível ele não é o gêmeo, e a Biblioteca fica com os dois.
      if (twin >= 0 && (stored[twin].texto !== input || stored[twin].recebido)) {
        const { recebido, ...mine } = stored[twin];
        stored[twin] = { ...mine, texto: input };
        if (persist('saved', stored)) setSaved(stored.filter(validMaterial));
      }
      const next = twin >= 0 ? stored[twin] : store(material) || material;
      // No material temporário (o quiz do caderno de erros, o simulado, a revisão do dia), o novo fica no lugar do
      // material guardado e abre quando o aluno sai dele: tomar o lugar do temporário apagava o quiz ou o baralho no
      // meio, e o simulado só corrige no fim.
      const away = latest.current.virtual;
      if (away) setParked(next);
      else setResult(next);
      made.current = { key };
      setEditorChat(false);
      // O quiz e o baralho recomeçam com outro material. O "Gerar de novo" da demonstração, com o mesmo texto, reabre o
      // mesmo, e eles seguem onde estavam. Depois da espera pela IA recomeçam sempre: durante ela o aluno pode ter
      // aberto outro material. No material temporário, só quando o aluno sai dele.
      if (!away && (wait || !previous || !sameMaterial(previous, data))) restart();
      const at = latest.current.page;
      if (!away && (at === 'Estudar' || MATERIAL.includes(at))) {
        // Na página do material o esqueleto dá lugar a ele ali mesmo; quem voltou ao Estudar vai para o Resumo.
        if (at === 'Estudar') setPage(target);
        // O leitor de tela ouve que ele chegou, e o foco que estava na espera, no botão de gerar ou no body vai para o
        // título dele.
        say('Material pronto: ' + data.title + '.');
        if (adrift('main, .busy')) focusAfter.current = ['#material-titulo'];
        if (kept) toast('O material anterior foi guardado na biblioteca');
      } else {
        // O aluno saiu para outra página enquanto esperava, ou está no material temporário: fica onde está e abre o
        // material quando quiser.
        if (adrift('.busy')) focusAfter.current = ['main h1'];
        toast('Material pronto' + (kept ? '. O anterior foi guardado na biblioteca' : ''), {
          label: 'Abrir',
          run: () => {
            openPage(target, ['#material-titulo']);
            restart();
          },
        });
      }
    } catch (e) {
      // Cancelado ou com erro, o aluno volta do esqueleto para o editor: o aviso de erro fica junto dos botões de gerar.
      // Se nesse meio-tempo ele abriu outro material ou o material temporário, fica nele.
      const back = wait && MATERIAL.includes(latest.current.page) && latest.current.result === result &&
        !latest.current.virtual;
      if (back) setPage('Estudar');
      // O foco que estava no que sai da tela vai para o erro (o alerta já é lido) ou, no Cancelar, para o botão que pediu
      // o material; longe do Estudar, para o título da página.
      if (adrift(back ? 'main, .busy' : '.busy')) {
        focusAfter.current = e.cancelled ? ['#gerar', 'main h1'] : ['#erro'];
      }
      if (e.cancelled) toast('Pedido cancelado');
      else setError({ ...e, message: 'Não deu para gerar o material. ' + e.message });
    } finally {
      setBusy(null);
    }
  }

  // Grava o material no topo da biblioteca e devolve a cópia gravada, ou null se o navegador recusou.
  // Parte da lista do navegador, não da cópia desta aba: outra aba pode ter salvo algo depois que esta abriu.
  function store(material) {
    const stored = readList('saved');
    const entry = { ...material, id: newId(stored), date: new Date().toISOString() };
    const next = [entry, ...stored];
    if (!persist('saved', next)) return null;
    setSaved(next.filter(validMaterial));
    return entry;
  }

  // Não duplica o que já está salvo e só avisa "salvo" quando o navegador gravou de verdade.
  function save() {
    if (!result) return;
    const stored = readList('saved');
    if (result.id && stored.some(s => s?.id === result.id)) {
      setSaved(stored.filter(validMaterial));
      toast('Este material já está na biblioteca');
      return;
    }
    const entry = store(result);
    if (!entry) return;
    setResult(entry);
    toast('Material salvo na biblioteca');
  }

  // "Data da prova" (ui.jsx, ExamDate): a data vai para o material na biblioteca, a partir da lista do navegador, como no
  // store(). O material que ainda não está lá é salvo com ela, e o aviso diz isso. Sem data, o campo prova sai.
  // provaMarcada é a hora em que a data foi marcada: com ela marcada hoje, a véspera conta dali (lib.js, studyPlan).
  // O rascunho é gravado junto: na saída da página (ExamDate grava no pagehide) não há outro desenho, e ele já tinha
  // sido gravado sem a data.
  function setExam(day) {
    const stored = readList('saved');
    const at = result.id ? stored.findIndex(s => s?.id === result.id) : -1;
    const { prova, provaMarcada, ...rest } = at < 0 ? result : stored[at];
    const material = day ? { ...rest, prova: day, provaMarcada: new Date().toISOString() } : rest;
    const note = day ? 'Prova marcada para ' + day.slice(8) + '/' + day.slice(5, 7) + ': o plano do dia fica no Estudar.'
      : 'Data da prova apagada.';
    const open = (opened, text) => {
      setResult(opened);
      toast(text);
      if (draft.current) {
        draft.current = { ...draft.current, result: opened };
        saveDraft();
      }
    };
    if (at < 0 && day) {
      const entry = store(material);
      if (entry) open(entry, 'Material salvo na biblioteca. ' + note);
      return;
    }
    if (at >= 0) {
      stored[at] = material;
      if (!persist('saved', stored)) return;
      setSaved(stored.filter(validMaterial));
    }
    // A cópia lida da biblioteca tem outros objetos. Com o resumo igual, a tela fica com os do material aberto, que o
    // campo do "Explicar com minhas palavras" (#82) segue: marcar a data não fecha o campo nem perde o comentário pedido.
    const same = JSON.stringify(material.summary) === JSON.stringify(result.summary);
    open(same ? { ...material, summary: result.summary } : material, note);
  }

  // Material aberto que ainda não foi para a biblioteca é guardado antes de outro tomar o lugar: ele custou uma
  // chamada de IA. Quem já tem id foi salvo ou veio de lá. Devolve true se guardou.
  function keep(previous) {
    return !!previous && !previous.id && !!store(previous);
  }

  // Exclui na hora, sem perguntar, e deixa desfazer: o material volta ao mesmo lugar da lista.
  // O botão de excluir sai da tela com o material: o foco vai para o "Desfazer" que fica no topo da lista.
  function remove(material) {
    const stored = readList('saved');
    const at = stored.findIndex(s => s?.id === material.id);
    const next = stored.filter(s => s?.id !== material.id);
    if (!persist('saved', next)) return;
    setSaved(next.filter(validMaterial));
    focusAfter.current = ['.undo-row button', '#busca'];
    offerUndo('material', 'Material excluído: ' + material.title, () => {
      const back = readList('saved');
      if (!back.some(s => s?.id === material.id)) back.splice(Math.max(at, 0), 0, material);
      if (persist('saved', back)) setSaved(back.filter(validMaterial));
    }, ['[data-id="' + material.id + '"] .open', '#busca']);
  }

  // Exportar (e o "Fazer backup" do pé da Biblioteca e do Desempenho): um arquivo com tudo o que este navegador guarda
  // (biblioteca, desempenho, caderno de erros, caixas dos cartões e perfil), para levar a outro computador. Parte do
  // que está gravado, não das listas desta aba. O material aberto que ainda não está na biblioteca vai para lá antes,
  // como quando outro toma o lugar dele, e assim vai no arquivo.
  function exportBackup() {
    const unsaved = !!opened && !opened.id;
    const entry = unsaved ? store(opened) : null;
    if (entry) setResult(entry);
    const backup = {
      versao: 1, saved: readList('saved'), events: readList('events'), erros: readList('erros'),
      cartoes: readList('cartoes'), questoes: readSeen(), user: readUser(),
    };
    download(new File([JSON.stringify(backup)], 'cerebro-backup-' + localDay(new Date()) + '.json',
      { type: 'application/json' }));
    // A data marca o clique: o navegador pode perguntar onde salvar, e o aluno, cancelar.
    const now = new Date().toISOString();
    if (persist('backup', now)) setLastBackup(now);
    toast(backupSummary(backup) + (entry ? ' O material aberto foi salvo na biblioteca e foi junto.'
      : unsaved ? ' O material aberto não pôde ser salvo no navegador e ficou de fora.' : ''));
  }

  // Importar: junta o arquivo ao que já está gravado, sem duplicar (lib.js). O arquivo vem de fora: o que não passa
  // na conferência fica de fora, e um arquivo que não é backup não muda nada.
  async function importBackup(e) {
    const file = e.target.files?.[0];
    // Sem esvaziar o campo, escolher o mesmo arquivo de novo não dispararia o onChange.
    e.target.value = '';
    if (!file) return;
    // Um backup cabe em poucos megabytes, o limite do armazenamento do navegador: arquivo maior não é um.
    const backup = file.size > 20e6 ? null : readBackup(await file.text().catch(() => ''));
    if (!backup) {
      toast('Este arquivo não é um backup do Cérebro');
      return;
    }
    // O histórico entra e sai sem as repetições de dias passados (lib.js, compactEvents): o backup não as traz de volta,
    // e o aviso no fim compara duas listas compactadas.
    const now = new Date();
    const before = {
      saved: readList('saved'), events: compactEvents(readList('events'), now), erros: readList('erros'),
      cartoes: readList('cartoes'), questoes: readList('questoes'),
    };
    const after = mergeBackup(before, backup);
    after.events = compactEvents(after.events, now);
    if (!persist('saved', after.saved)) return;
    setSaved(after.saved.filter(validMaterial));
    if (!persist('events', after.events)) return;
    setEvents(after.events.filter(validEvent));
    if (!persist('erros', after.erros)) return;
    setMistakes(after.erros.filter(validMistake));
    if (!persist('cartoes', after.cartoes)) return;
    setBoxes(after.cartoes.filter(validCardReview));
    if (!persist('questoes', after.questoes)) return;
    // O perfil do arquivo (já conferido em readBackup) só entra num navegador que ainda não tem um: o daqui vale mais.
    // A área do editor não muda.
    const profile = backup.user && !readUser() && persist('user', backup.user) ? backup.user : null;
    if (profile) {
      setUser(profile);
      setName(profile.name);
    }
    toast(backupNote(before, after, backup.fora, profile?.name));
  }

  // Baixa o arquivo (o backup, o arquivo para um colega, os cartões do Anki).
  function download(file) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    // O arquivo sai da memória um minuto depois: liberar na hora cancela o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  }

  // "Compartilhar", no cabeçalho do material e em cada item da Biblioteca. Nenhuma saída chama a IA ou o backend, e
  // nenhuma grava no navegador. A folha de impressão (Folha.jsx) começa a chegar aqui: no clique ela já veio.
  function openShare(material) {
    import('./Folha.jsx').catch(() => {});
    setSharing(material);
    focusAfter.current = ['#compartilhar-colega'];
  }

  // Cada saída fecha a janela, e o aviso dela espera a janela terminar de sair (a promessa que volta daqui): com a janela
  // na tela, a região do aviso fica inerte, e o leitor de tela não o lia (como em takePages).
  function closeShare() {
    setSharing(null);
    return new Promise(resolve => (shareGone.current = resolve));
  }

  // "Arquivo para um colega": só este material, no formato do backup (lib.js, shareFile), para o Importar da Biblioteca
  // do colega. Onde o navegador compartilha o arquivo, abre a folha de compartilhar do sistema; nos outros, ou se ele
  // recusar o arquivo, o arquivo é baixado. Fechar a folha do sistema (AbortError) não é erro.
  async function sendMaterial(material) {
    const file = new File([JSON.stringify(shareFile(material, new Date()))], fileName(material.title, '.json'),
      { type: 'application/json' });
    const gone = closeShare();
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: material.title });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    download(file);
    await gone;
    toast('Arquivo para o colega: ' + file.name + '. Ele o abre no Importar da Biblioteca.');
  }

  // "5 cartões", na janela e no aviso do Anki.
  const cardCount = material => material.flashcards.length + ' ' + plural(material.flashcards.length, 'cartão', 'cartões');

  // "Cartões para o Anki": o .txt com o cabeçalho que o Anki lê (lib.js, ankiFile). Sempre baixado: o Anki importa um
  // arquivo do computador.
  async function ankiCards(material) {
    const file = new File([ankiFile(material.flashcards)], fileName(material.title, '-anki.txt'), { type: 'text/plain' });
    const gone = closeShare();
    download(file);
    await gone;
    toast(cardCount(material) + ' em ' + file.name + '. No Anki, use Arquivo > Importar.');
  }

  // "Copiar cartões para o Quizlet": as linhas do Anki sem o cabeçalho (lib.js, cardLines), como o Copiar do resumo.
  async function quizletCards(material) {
    const count = material.flashcards.length;
    const gone = closeShare();
    let copied = true;
    try {
      await navigator.clipboard.writeText(cardLines(material.flashcards));
    } catch {
      copied = false;
    }
    await gone;
    toast(copied
      ? count + ' ' + plural(count, 'cartão copiado', 'cartões copiados') + '. No Quizlet, cole em Importar.'
      : 'Cópia indisponível neste navegador');
  }

  // "Imprimir ou salvar em PDF": a folha entra na página quando a janela sai, e o navegador abre a prévia (useEffect de
  // printing).
  async function printSheet(material) {
    const gone = closeShare();
    const sheet = import('./Folha.jsx').catch(() => null);
    await gone;
    const mod = await sheet;
    if (mod) setPrinting({ material, Folha: mod.default });
    else toast('Não foi possível abrir a folha de impressão. Recarregue a página e tente de novo.');
  }

  // Vira o cartão: o clique nele ou o Enter no campo "Sua resposta". from é onde o foco fica quando o cartão vira pelo
  // teclado; pelo ponteiro (o clique e o toque), não vem. Quem já viu a resposta não reescreve a sua: o campo fica só
  // para leitura até o próximo cartão.
  function turnCard(from) {
    setFlip(!flip);
    setLocked(true);
    // Só o nome do botão muda ao virar, e nem todo leitor de tela lê: a região fixa diz a face nova (flip ainda é o de
    // antes do clique).
    say(spokenCard(card, !flip, write && typed.trim() !== ''));
    cardMotion.current = 'perspective(900px) rotateX(-10deg)';
    // A resposta e o "Você escreveu" empurram o campo e os botões para baixo, às vezes para fora da janela ou para trás
    // da barra de baixo. Pelo teclado, se o bloco do cartão cabe na janela, a página rola até ele inteiro, e o foco fica
    // onde estava. Senão (a janela baixa: o celular deitado, o zoom de 200%), a resposta e o "Você escreveu" têm a vez:
    // o cartão sobe para o topo e leva o foco, e o Tab segue para o campo e os botões, que o scroll-padding traz acima
    // da barra. Pelo ponteiro, a página não rola: "Errei", "Revisar depois" ou "Acertei" subiriam para baixo dele, e o
    // segundo clique no mesmo lugar (para rever a pergunta, ou o fim de um duplo clique) avaliaria o cartão.
    if (!flip && from) focusAfter.current = [from, null, null, '.card-block', '.flashcard'];
  }

  // O cartão seguinte, ou o mesmo recomeçado, abre na pergunta e com o campo "Sua resposta" vazio e editável.
  function freshCard() {
    setFlip(false);
    setTyped('');
    setLocked(false);
  }

  // "Acertei" segue para o próximo cartão; "Errei" põe o cartão de novo no fim da fila. Os dois ficam registrados, com
  // a pergunta do cartão: como no quiz, o desempenho conta só a primeira avaliação de cada cartão no dia. Os dois mudam
  // também a caixa do cartão (lib.js, scheduleCard). Na revisão do dia, o cartão traz o material e a área de onde veio.
  // Os dois botões ficam desabilitados no cartão novo (ainda não virado): o foco passa para o cartão.
  function cardNext(ok) {
    const from = result.virtual ? card : result;
    event('flashcard', ok, from.area, fold(card.question), from.title);
    schedule(list => scheduleCard(list, from.title, card.question, ok, new Date()));
    freshCard();
    setDeck(ok ? deckRight(session) : deckWrong(session));
    cardMotion.current = 'translateX(12px)';
    focusAfter.current = ['.flashcard', '.deck-done h2'];
  }

  // given é o que o aluno respondeu: a tela final mostra ao lado da resposta certa. conf é a certeza que ele marcou
  // antes da correção (#80), ou nada com a caixa "Marcar certeza" desligada.
  // A questão errada entra no caderno de erros; a certa, no dia marcado, sobe um degrau dele, menos no chute (lib.js,
  // noteAnswer). As opções ficam desabilitadas e o foco ia para a página: ele passa ao retorno, que diz se acertou.
  function submit(value, conf) {
    if (answer !== null) return;
    const q = quizList[idx];
    const ok = q.type === 'short' ? shortAnswerOk(q.answer, value) : value === q.answer;
    const from = origin(q);
    const key = mistakeKey(from.title, q.question);
    const now = new Date();
    // before é o erro do caderno de antes da resposta: a revisão da IA que aceita um chute o devolve (review).
    const before = readList('erros').find(e => e?.key === key);
    setAnswer({ value, ok, conf, before });
    setAnswers([...answers, { ...q, ok, given: value, conf }]);
    // O índice do acerto que ficou (#78, lib.js: seenStep) dá o prev da resposta: lido antes de gravar a resposta, que
    // entraria no índice montado das respostas.
    const seen = seenStep(readSeen(), key, ok, now);
    const listed = mistakes.some(e => e.key === key);
    event('quiz', ok, from.area, fold(q.question), from.title, { conf, prev: seen.prev, ...(listed && { caderno: true }) });
    persist('questoes', seen.list);
    notebook(list => noteAnswer(list, q, from.title, from.area, ok, conf, now));
    // No simulado a tela não corrige: o foco vai para o botão de seguir, e o leitor de tela ouve só que a resposta ficou.
    if (blind) {
      say('Resposta registrada.');
      focusAfter.current = ['.exam-next .primary'];
      return;
    }
    // Depois do foco, a página rola até o retorno inteiro ficar à vista; na janela baixa, onde ele não cabe, até a
    // última linha com marca da caneta (ou o próprio retorno).
    focusAfter.current = ['#retorno', null, '#retorno, .feedback .answer-line', '.feedback'];
  }

  // Resposta curta: só espaços vale como campo vazio. Limpo, o campo mostra o aviso do required; enviado, virava erro
  // gravado no desempenho e no caderno de erros.
  function filled(field) {
    if (field.value.trim()) return true;
    field.value = '';
    field.reportValidity();
    return false;
  }

  // Próxima questão ou o resultado. O foco vai para a questão nova (no computador, direto para a caixa da resposta
  // curta; no celular não, para o teclado não abrir sozinho) ou para o título do resultado.
  function nextQuestion() {
    setWhy(null);
    if (idx + 1 >= quizList.length) {
      setDone(true);
      focusAfter.current = ['.quiz-done h2'];
    } else {
      setIdx(idx + 1);
      setAnswer(null);
      setChoice(null);
      focusAfter.current = QUESTION_FOCUS;
    }
  }

  // Quiz do caderno de erros ("Refazer os de hoje", "Treinar todas" e, no Desempenho, "Refazer os erros de"): o quiz
  // abre num material temporário com as questões da lista, cada uma com o material e a área de onde veio. O material
  // que estava aberto fica guardado e volta quando o aluno sai do quiz. virtual é a página do material temporário.
  function redoMistakes(list) {
    setParked(opened);
    setResult({
      virtual: 'Quizzes',
      title: 'Caderno de erros',
      area: '',
      level: '',
      summary: [],
      flashcards: [],
      quiz: list.map(m => ({ ...m.item, title: m.title, area: m.area })),
    });
    openPage('Quizzes', QUESTION_FOCUS);
    restart();
    // Um aviso ainda na tela com o botão "Abrir" (material pronto) reiniciaria este quiz em vez de abrir o material.
    setNotice(null);
  }

  // "Começar simulado" (Biblioteca): como o quiz do caderno de erros, o quiz abre num material temporário, aqui com
  // questões sorteadas dos materiais da lista na tela (a busca e o filtro de área), cada uma com o material e a área de
  // onde veio. A tela só corrige no fim (blind). Nada é gravado além das respostas, como em qualquer quiz.
  function startExam() {
    const quiz = mockExam(shown, examSize);
    setParked(opened);
    setResult({
      virtual: 'Quizzes', exam: true, title: 'Simulado', area: '', level: '', summary: [], flashcards: [], quiz,
    });
    openPage('Quizzes', QUESTION_FOCUS);
    restart();
    setNotice(null);
    say('Simulado com ' + examLine(quiz) + '. A correção fica para o fim.');
  }

  // O tamanho do simulado mudou: a frase ao lado diz quantas questões entram, e o leitor de tela ouve a mesma.
  function chooseExamSize(size) {
    setExamSize(size);
    say(examLine(examFrom, size));
  }

  // A "Área do gráfico" do Desempenho mudou: as colunas trocam longe do foco, e o leitor de tela ouve o total da área.
  function chooseChartArea(next) {
    setChartArea(next);
    say(chartLine(next, chartDays(events, next, new Date())));
  }

  // "Revisão do dia": os cartões que voltam hoje, de todos os materiais, num baralho temporário, como o quiz do caderno:
  // no máximo 20 por vez, os mais atrasados primeiro. O material que estava aberto fica guardado e volta quando o aluno
  // sai da página Flashcards. O cabeçalho troca sem trocar de página: o leitor de tela ouve onde o aluno está. O plano
  // até a prova (openTask) passa os cartões de hoje de um material.
  function dayDeck(cards = dayCards(cardsDue)) {
    setParked(opened);
    setResult({
      virtual: 'Flashcards',
      title: 'Revisão do dia',
      area: '',
      level: '',
      summary: [],
      flashcards: cards,
      quiz: [],
    });
    openPage('Flashcards', ['.flashcard', 'main h1']);
    restart();
    setNotice(null);
    say('Revisão do dia: ' + cards.length + ' ' + plural(cards.length, 'cartão', 'cartões') + '.');
  }

  // O botão do plano até a prova (ui.jsx, StudyPlan) abre a tarefa de hoje: as questões do material no caderno; os
  // cartões que faltam, numa revisão como a do dia, ou o baralho do material quando faltam todos; o quiz dele; ou, no dia
  // da prova, o resumo.
  function openTask({ material, task, left, whole }) {
    if (task === 'erros') return redoMistakes(left);
    if (task === 'cartoes' && !whole) return dayDeck(dayCards(left));
    const to = task === 'quiz' ? 'Quizzes' : task === 'cartoes' ? 'Flashcards' : 'Resumos';
    const focus = task === 'quiz' ? QUESTION_FOCUS : task === 'cartoes' ? ['.flashcard', 'main h1'] : ['#material-titulo'];
    if (opened?.id !== material.id) return openSaved(material, to, focus);
    // Já aberto, como no "Abrir" do Desempenho: o quiz e o baralho ficam onde estavam, e os que tinham terminado recomeçam.
    setEditorChat(false);
    go(to);
    focusAfter.current = focus;
    if (task === 'quiz' && done) restartQuiz();
    if (task === 'cartoes' && session.pos >= session.queue.length) setDeck(null);
  }

  // Tira a questão do caderno na hora, sem perguntar, e deixa desfazer, como a exclusão de um material.
  function drop(mistake) {
    if (!notebook(list => removeMistake(list, mistake.key))) return;
    focusAfter.current = ['.undo-row button', '.empty .primary'];
    offerUndo('erro', 'Questão tirada do caderno', () =>
      notebook(list => (list.some(e => e?.key === mistake.key) ? list : [...list, mistake])),
    ['[data-key="' + CSS.escape(mistake.key) + '"] .drop', '.erros-head .primary']);
  }

  // "Não entendi, me explique": o tutor responde no lugar do pedido, sem entrar na conversa da página Dúvidas.
  // item é a questão ou o tópico do pedido: a resposta só é desenhada nele, então a que chega depois de o aluno
  // seguir adiante não aparece em outro lugar. back é o seletor do botão do pedido, para onde o foco volta.
  async function explain(item, text, content, back) {
    if (waiting) return;
    const from = origin(item);
    setWhy({ item });
    setBusy({ kind: 'why', label: 'Esperando a explicação…', since: Date.now() });
    // A espera nasce junto com a explicação e não seria lida.
    say('Esperando a explicação…');
    // A explicação entra abaixo do botão e vem à vista (Why): na janela baixa o botão, que fica com o foco, saía pelo
    // alto. A página rola até ele, como no addQuestions.
    focusAfter.current = [null, null, back];
    try {
      const data = await callAI('/api/chat', {
        question: text, content, area: from.area, level: from.level, history: [],
      });
      setWhy({ item, text: data.answer });
    } catch (e) {
      setWhy(e.cancelled ? null : { item, error: e });
    } finally {
      // O Cancelar sai com a espera: o foco que estava nele volta ao botão do pedido.
      if (adrift('.why, .busy')) focusAfter.current = [back, 'main h1'];
      setBusy(null);
    }
  }

  // "Explicar com minhas palavras" (#82): o texto do tópico sai da tela, e o aluno escreve o que lembra. O botão fica no
  // lugar e abre ou fecha, um tópico por vez. Fechar, ou abrir outro, apaga o que foi escrito e desiste do comentário
  // pedido. O texto que sai ou volta acima do botão o leva para fora da janela, e o foco que já está nele não rola a
  // página: quem o traz de volta é o show (focusAfter).
  function toggleOwn(s, i) {
    if (busy?.kind === 'own') cancelAI();
    if (own?.item === s) {
      setOwn(null);
      // Com "Esconder o texto", o tópico volta escondido e o botão sai com ele: o foco vai ao "Mostrar".
      focusAfter.current = ['#minhas-' + i, '#mostrar-' + i, '#minhas-' + i + ', #mostrar-' + i];
      return;
    }
    setOwn({ item: s, text: '' });
    // No toque o foco fica no botão, para o teclado da tela não abrir sozinho, e o tópico inteiro vem à vista quando
    // cabe; senão, o botão, com o campo embaixo.
    focusAfter.current = TOUCH
      ? ['#minhas-' + i, null, '#minhas-' + i, '.summary > li:nth-child(' + (i + 1) + ')']
      : ['#proprio-campo'];
  }

  // "Pedir comentário da IA": a explicação vai como dado, e o comentário só fica na tela, sem entrar no desempenho nem
  // no caderno de erros. Campo em branco não gasta chamada: o aviso pede o texto, como o gerar sem texto. A resposta só
  // muda a explicação do pedido: fechar o tópico durante a espera desiste dele (toggleOwn).
  async function commentOwn() {
    if (waiting) return;
    const mine = own;
    const s = mine.item;
    if (!mine.text.trim()) {
      setOwn({ ...mine, error: { message: 'Escreva a sua explicação antes de pedir o comentário da IA.' } });
      focusAfter.current = ['#proprio-campo'];
      return;
    }
    const from = origin(s);
    let review = null;
    setOwn({ ...mine, error: null });
    setBusy({ kind: 'own', label: 'Esperando o comentário…', since: Date.now(), item: s });
    // A espera nasce junto com o comentário e não seria lida. Ela entra acima do botão e o empurra para trás da barra
    // de baixo: a página rola até ele, que fica com o foco.
    say('Esperando o comentário da IA…');
    focusAfter.current = [null, null, '#proprio-ia'];
    try {
      const data = await callAI('/api/explain', explainRequest(s, mine.text, from.area, from.level));
      if (!Object.keys(OWN_VERDICT).includes(data?.verdict) || !Array.isArray(data.missing)) {
        throw Error('A IA mandou um comentário incompleto. Tente de novo.');
      }
      review = {
        verdict: data.verdict,
        missing: data.missing.filter(piece => typeof piece === 'string'),
        misconception: typeof data.misconception === 'string' ? data.misconception : '',
      };
      setOwn(o => (o?.item === s ? { ...o, compared: true, review } : o));
    } catch (e) {
      if (!e.cancelled) setOwn(o => (o?.item === s ? { ...o, error: e } : o));
    } finally {
      // Com o comentário o botão do pedido sai da tela, e o foco que estava no tópico vai para o veredito; longe dele, o
      // leitor de tela ouve o veredito. O Cancelar sai com a espera: o foco que estava nele volta ao botão do pedido.
      if (adrift(review ? '.own, .busy' : '.own .wait, .busy')) {
        focusAfter.current = [review ? '#proprio-veredito' : '#proprio-ia', 'main h1'];
      } else if (review) {
        say('Comentário da IA: ' + OWN_VERDICT[review.verdict]);
      }
      setBusy(null);
    }
  }

  // "Ler o resumo" (answered) ou "Pular": o bloco "Tente responder antes de ler" sai, e o foco vai ao primeiro tópico,
  // onde a leitura começa. O que o aluno escreveu fica para o "Confira o que você pensou", no fim do resumo. A resposta
  // escrita zera a conta de pulos seguidos, e o pulo ou o bloco fechado em branco a aumenta (lib.js, nextSkips); no 2º
  // pulo seguido o aviso diz onde o bloco vai ficar.
  function closePretest(answered) {
    const before = readSkips();
    const { skips, warn } = nextSkips(before, answered ? recall.tries : []);
    if (skips !== before && persist('antes-de-ler', skips) && warn) {
      toast('Nos próximos resumos o bloco fica fechado, no botão "Tentar antes de ler"');
    }
    setRecall({ ...recall, pre: answered ? 'lido' : null });
    focusAfter.current = ['.summary li:first-child h3', 'main h1'];
  }

  // "Lembrei" ou "Não lembrei" num tópico do modo lembrar: o placar muda no fim da lista, longe do botão, e o leitor de
  // tela o ouve na hora. Nada disso conta no desempenho.
  function markTopic(i, ok) {
    const marks = markRecall(recall.marks, i, ok);
    setRecall({ ...recall, marks });
    say(recallLine(shownMarks(marks, topics.length)) || 'Nenhum tópico marcado.');
  }

  // "Pedir revisão da IA": a comparação de texto marca errado quem escreve o certo com outras palavras.
  // Se a IA aceita a resposta, ela passa a valer como certa na tela (answer e answers), no evento já gravado e no
  // caderno de erros. "parcial" e "incorreta" só são mostrados. A revisão fica guardada na própria resposta.
  async function review() {
    // O botão fica na tela, com aria-disabled, durante a espera e depois do veredito: o clique não pede outra revisão.
    if (waiting || answer.review?.verdict) return;
    const q = quiz;
    const mine = answer;
    const counted = answers[answers.length - 1];
    const from = origin(q);
    // O aluno pode seguir adiante, ou refazer a questão, enquanto espera: só muda a resposta que foi revista.
    // Na tela ela é reconhecida pelo próprio objeto; no que está gravado, por ser anterior a este pedido.
    const asked = new Date().toISOString();
    setBusy({ kind: 'review', label: 'Esperando a revisão…', since: Date.now(), answer: mine });
    // A espera entra acima do botão e, no celular, o empurra para trás do "Próxima questão" preso: a página rola até
    // ele, que fica com o foco.
    focusAfter.current = [null, null, '#pedir-revisao'];
    try {
      const data = await callAI('/api/grade', gradeRequest(q, mine.value, from.area, from.level));
      if (!['correta', 'parcial', 'incorreta'].includes(data?.verdict) || typeof data.feedback !== 'string') {
        throw Error('A IA mandou uma revisão incompleta. Tente de novo.');
      }
      const accepted = data.verdict === 'correta';
      setAnswer(a => (a === mine ? { ...a, ok: accepted, review: data } : a));
      if (accepted) {
        setAnswers(list => list.map(a => (a === counted ? { ...a, ok: true } : a)));
        const fix = list => fixLastQuizEvent(list, from.title, fold(q.question), asked);
        const next = fix(readList('events'));
        setEvents(persist('events', next) ? next.filter(validEvent) : fix);
        // O chute aceito é um acerto no chute, que não muda o caderno (noteAnswer): ele volta ao que era antes da resposta.
        const key = mistakeKey(from.title, q.question);
        notebook(list => (mine.conf === 'chute'
          ? restoreMistake(list, key, mine.before, asked)
          : removeMistake(list, key, asked)));
      }
    } catch (e) {
      if (!e.cancelled) setAnswer(a => (a === mine ? { ...a, review: { error: e } } : a));
    } finally {
      // O Cancelar sai com a espera: o foco que estava nele volta ao botão do pedido.
      if (adrift('.review-wait, .busy')) focusAfter.current = ['#pedir-revisao', 'main h1'];
      setBusy(null);
    }
  }

  // "Questões novas deste material", no fim do quiz: a IA escreve de 4 a 6 questões sobre o texto do material (o
  // guardado ou, no material de antes dele, o resumo: lib.js, quizSource), sem repetir as que ele já tem. Elas entram no
  // material e, se ele está na biblioteca, também lá (lib.js, mergeQuiz), e o quiz recomeça só com elas. O botão fica
  // fora do material temporário. Durante a espera o aluno pode sair do quiz: as questões vão para o material do pedido.
  // Como nas outras gravações, o material parte do que está no navegador, não da cópia desta aba (lib.js, savedCopy):
  // as questões que outra aba juntou a ele ficam, o pedido evita as perguntas delas e o teto conta com elas.
  async function addQuestions() {
    const material = result;
    if (waiting || material.quiz.length >= QUIZ_CAP) return;
    const base = savedCopy(material, readList('saved'));
    if (base.quiz.length >= QUIZ_CAP) {
      setExtra({ of: material, error: { message: 'Este material já tem ' + QUIZ_CAP + ' questões na Biblioteca. Abra-o de lá para ver todas.' } });
      focusAfter.current = [null, null, '#erro-questoes'];
      return;
    }
    const { fromSummary, ...source } = quizSource(base);
    const from = origin(material);
    // O material do pedido está aberto: esta cópia ou outra dele, aberta de novo da biblioteca durante a espera.
    const isOpen = now => now.result === material || (!!material.id && now.result?.id === material.id);
    setExtra(null);
    setBusy({ kind: 'questoes', label: 'Escrevendo questões novas…', since: Date.now(), of: material });
    // A espera nasce no fim do quiz e não seria lida. Com o botão no pé da janela ela nasceria fora da vista: a página
    // rola até ela, e o foco fica no botão.
    say('Escrevendo questões novas…');
    focusAfter.current = [null, null, '.quiz-wait'];
    try {
      const data = await callAI('/api/quiz', { ...source, area: from.area, level: from.level });
      const stored = readList('saved');
      const at = material.id ? stored.findIndex(s => s?.id === material.id) : -1;
      const copy = savedCopy(base, stored);
      const quiz = mergeQuiz(copy.quiz, data?.quiz);
      const list = quiz.slice(copy.quiz.length);
      if (!list.length) throw Error('A IA não mandou questões novas para este material. Tente de novo.');
      // As questões são texto da IA: o material da demonstração (semIA) passa a mostrar o aviso. O que saiu da
      // biblioteca durante a espera perde a id: aberto, ele volta a ser guardado quando outro toma o lugar (keep).
      const { semIA, id, ...rest } = copy;
      const next = at >= 0 ? { ...rest, id, quiz } : { ...rest, quiz };
      if (at >= 0) {
        stored[at] = next;
        if (persist('saved', stored)) setSaved(stored.filter(validMaterial));
      }
      // O material do pedido continua aberto (ou guardado atrás do quiz do caderno de erros ou do simulado): ele troca
      // pelo novo, e o resumo ativo, que não mudou, continua onde estava.
      const now = latest.current;
      const open = isOpen(now);
      if (open) {
        if (now.virtual) setParked(next);
        else {
          setResult(next);
          restartQuiz(list);
        }
        setRecall(r => ({ ...r, of: next }));
        // O campo do "Explicar com minhas palavras" também continua: o tópico dele passa a ser o mesmo do material novo,
        // que vem da biblioteca com outros objetos. Sem isso, o efeito de opened fechava o campo e apagava o texto.
        setOwn(o => o && { ...o, item: next.summary[now.result.summary.indexOf(o.item)] ?? o.item });
      }
      setExtra({ of: next, list, resumo: fromSummary });
      const note = list.length + ' ' + plural(list.length, 'questão nova', 'questões novas') +
        (open && !now.virtual ? ' no quiz' : ' no quiz de "' + material.title + '"') +
        (fromSummary ? '. Questões feitas a partir do resumo' : '');
      if (open && !now.virtual && now.page === 'Quizzes') {
        // O fim do quiz sai da tela: o foco vai para a primeira questão nova.
        say(note + '.');
        if (adrift('main, .busy')) focusAfter.current = QUESTION_FOCUS;
      } else {
        if (adrift('.busy')) focusAfter.current = ['main h1'];
        if (open && !now.virtual) toast(note, { label: 'Abrir', run: () => openPage('Quizzes', QUESTION_FOCUS) });
        else toast(open || at >= 0 ? note : 'As questões novas não entraram: o material foi fechado durante a espera');
      }
    } catch (e) {
      // Cancelado, nada muda. O erro fica no fim do quiz, embaixo do botão, que fica com o foco e à vista com ele. Quem
      // saiu de lá durante a espera recebe o aviso, com "Abrir" se o fim do quiz do material continua lá.
      if (!e.cancelled) {
        const now = latest.current;
        const open = isOpen(now) && !now.virtual;
        setExtra({ of: open ? now.result : material, error: e });
        if (!open || !now.done || now.page !== 'Quizzes') {
          toast('Não deu para escrever as questões novas' + (open ? '' : ' de "' + material.title + '"'), open && now.done
            ? { label: 'Abrir', run: () => openPage('Quizzes', ['#questoes-novas', 'main h1']) }
            : undefined);
        }
      }
      if (adrift('.quiz-done, .busy')) focusAfter.current = ['#questoes-novas', 'main h1', e.cancelled ? null : '#erro-questoes'];
    } finally {
      setBusy(null);
    }
  }

  // Pergunta enviada pelo editor já é o conteúdo: não manda o mesmo texto duas vezes ao modelo, e o chat passa a ser
  // sobre o texto do editor. As outras levam o assunto do chat (subject): o material aberto ou o texto do editor.
  // O servidor não guarda conversa: as 6 últimas mensagens do assunto vão junto, para ele entender um "me dê um exemplo".
  // Cada mensagem leva a marca do assunto (key), e a conversa de outro assunto, que fica na tela, não vai (lib.js, chatHistory).
  // O texto do editor já vai em content (ou é a própria pergunta), então a cópia dele fica fora do histórico.
  // Pergunta que falhou sai da conversa: sem isso ela ia sem resposta no histórico do próximo pedido. Se veio da caixa, volta para a caixa.
  // A caixa só é esvaziada quando a pergunta saiu dela: sugestão clicada ou envio pelo editor não apagam um rascunho.
  async function ask(message = question) {
    if (waiting || !message.trim()) return;
    const msg = message.trim();
    const own = msg === input.trim();
    const topic = own ? { content: input, area, level } : subject;
    // A marca da pergunta pelo editor é a do texto do editor (lib.js, chatSubject).
    const key = own ? subjectKey(input, area) : subject.key;
    const mine = { role: 'user', text: msg, key };
    if (own) setEditorChat(true);
    // A pergunta nova encerra o Desfazer de "Nova conversa": ele não pode mais trocar a conversa que começa agora.
    if (undo?.kind === 'conversa') {
      setUndo(null);
      setNotice(n => (n?.text === undo.text ? null : n));
    }
    setError(null);
    if (message === question) setQuestion('');
    setChat(c => [...c, mine]);
    if (!API_BASE) {
      setChat(c => [...c, {
        role: 'assistant',
        text: (SEM_IA
          ? 'No modo estudo não há IA neste aparelho: as respostas a dúvidas precisam do computador com a IA. '
          : 'Na demonstração, posso organizar o texto, mas não responder dúvidas com IA. As explicações personalizadas estarão disponíveis na versão com IA ativada. ') +
          'Trecho para revisar: ' + (topic.content || EXAMPLE).slice(0, 450),
        key,
      }]);
      return;
    }
    // Pergunta mandada do editor: a pílula de espera nasce junto com a página do Dúvidas e não seria lida.
    if (latest.current.page !== 'Dúvidas') say('Cérebro está escrevendo…');
    setAsking(Date.now());
    try {
      const data = await callAI('/api/chat', {
        question: msg,
        content: own ? '' : topic.content,
        area: topic.area,
        level: topic.level,
        history: chatHistory(chat, key, input.trim()),
      });
      setChat(c => [...c, { role: 'assistant', text: data.answer, key }]);
      setTips({ key, list: Array.isArray(data.suggestions) ? data.suggestions : [] });
    } catch (e) {
      if (!e.cancelled) setError(e);
      setChat(c => c.filter(m => m !== mine));
      if (message === question) setQuestion(q => q || msg);
    } finally {
      setAsking(false);
    }
  }

  // Ditado em pt-BR pelo navegador. Clicar de novo enquanto ouve para o ditado.
  function dictation() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    // O Brave tem a interface do ditado, mas não o serviço de voz: pedir o microfone ali seria à toa.
    if (!Speech || navigator.brave) {
      toast(NO_DICTATION);
      return;
    }
    const speech = new Speech();
    speech.lang = 'pt-BR';
    speech.onresult = e => setInput(s => dictate(s, e.results[0][0].transcript));
    speech.onerror = e => toast(dictationError(e.error, navigator.onLine));
    speech.onend = () => setListening(false);
    recognition.current = speech;
    speech.start();
    setListening(true);
    toast('Ouvindo…');
  }

  // "Usar um exemplo": com a IA ligada, ela escreve um texto de estudo sobre um tema sorteado pelo servidor na área e
  // no nível escolhidos (1 chamada da cota), sem repetir o tema do exemplo anterior. Na demonstração, com a IA
  // desligada, no teto do dia ou se ela falhar, entra um exemplo pronto da mesma área (exemplos.js). A área e o nível
  // não mudam.
  async function addExample() {
    // Um pedido à IA por vez: o segundo clique durante a espera não pede outro. No teto do dia o exemplo é o pronto, sem
    // pedido nenhum.
    if (waiting && !capped) return;
    const ai = cost;
    let written = null;
    if (ai) {
      setBusy({ kind: 'example', label: 'Escrevendo um exemplo…', since: Date.now() });
      // A faixa de espera nasce com o texto e não é lida.
      say('Escrevendo um exemplo…');
      try {
        const data = await callAI('/api/example', { area, level, avoid: exampleTopic.current.slice(0, 120) });
        if (typeof data?.topic !== 'string' || typeof data.text !== 'string' || !data.text.trim()) {
          throw Error('Exemplo incompleto recebido do backend');
        }
        written = { topic: data.topic, text: data.text.trim() };
      } catch (e) {
        // Cancelado, nada muda. Outra falha (rede, cota, resposta fora do formato) cai no exemplo pronto. No limite por
        // minuto os botões da IA ficam desligados alguns segundos (callAI): o aviso de erro conta a espera.
        if (e.cancelled) return;
        if (e.wait) setError(e);
      } finally {
        // O botão desabilitado na espera, ou o Cancelar da faixa que sai com ela, deixa o foco no vazio: ele volta ao
        // botão. Quem foi escrever ou foi para outra página continua onde está.
        const at = document.activeElement;
        if (!at || at === document.body || at.closest('.busy')) focusAfter.current = ['#usar-exemplo'];
        setBusy(null);
      }
    }
    // Os exemplos prontos ficam à parte (exemplos.js), fora do JavaScript da abertura; a caixa do editor já os trouxe.
    // O arquivo pode não vir (a rede caiu depois da abertura, ou saiu uma versão nova com a aba aberta): o aviso diz o
    // que fazer, em vez de o clique não dar em nada.
    const examples = written ? null : await import('./exemplos.js').catch(() => null);
    if (!written && !examples) {
      toast('Não foi possível carregar os exemplos. Recarregue a página.');
      return;
    }
    // O aluno mexeu durante a espera no que o exemplo usa: o que ele fez vale mais. O exemplo apagaria o texto no meio
    // da digitação (o Desfazer do editor some na primeira tecla) ou longe da vista (some também na troca de página), e
    // o exemplo da área ou do nível do clique ficaria com outra área ou outro nível na tela. A conferência fica depois
    // das duas esperas, a da IA e a do arquivo dos exemplos: numa rede lenta o arquivo também demora.
    const now = latest.current;
    const changed = now.input !== input ? 'o texto do editor mudou'
      : now.area !== area || now.level !== level ? 'a área ou o nível mudou'
      : input.trim() && now.page !== 'Estudar' ? 'você saiu do Estudar' : '';
    if (changed) {
      toast('O exemplo não entrou: ' + changed + ' durante a espera');
      return;
    }
    const example = written || examples.pickExample(area, { topic: exampleTopic.current, text: input });
    // O aviso diz quem escreveu. O texto fica guardado em aiExample, o da IA, ou em readyExample, o pronto: o material
    // feito dele cita o trecho como "No exemplo escrito pela IA" ou "No texto de exemplo", e não como "No seu texto".
    const note = (written ? 'Exemplo escrito pela IA (confira os fatos): '
      : ai ? 'A IA não respondeu. Exemplo pronto adicionado: ' : 'Exemplo adicionado: ') + example.topic;
    const before = [aiExample.current, readyExample.current];
    exampleTopic.current = example.topic;
    aiExample.current = written ? example.text : '';
    readyExample.current = written ? '' : example.text;
    setInput(example.text);
    // O exemplo troca o que estava no editor: com outro texto lá, dá para desfazer, e o exemplo anterior volta junto.
    // O Desfazer do aviso some com ele e leva o foco ao Limpar.
    if (input.trim()) {
      offerUndo('texto', note, () => {
        [aiExample.current, readyExample.current] = before;
        setInput(input);
      }, ['#limpar', 'main h1']);
    } else toast(note);
  }

  // "Abrir arquivo", ou o arquivo solto sobre o editor: o PDF, o TXT ou o MD é lido no navegador (arquivo.js, que chega
  // no primeiro uso), sem chamar a IA. O texto entra no editor (putFile); o PDF com mais texto que o editor recebe abre
  // antes a escolha de páginas (pick).
  async function openFile(file) {
    if (!file || reading) return;
    setError(null);
    setReading(true);
    // O botão diz "Lendo o arquivo…", mas o leitor de tela não relê o nome do botão que tem o foco.
    say('Lendo o arquivo…');
    let reader;
    let got;
    try {
      reader = await import('./arquivo.js');
      got = await reader.readFile(file);
    } catch (e) {
      // A frase de cada arquivo que não abre vem do arquivo.js (code); sem ela, o próprio arquivo.js não chegou. file:
      // o aviso fica à frente da contagem do limite por minuto (lib.js, pauseNotice).
      setError(Object.assign(e.code ? e : {
        message: 'Não foi possível abrir arquivos agora. Recarregue a página e tente de novo.', tech: String(e),
      }, { file: true }));
      return;
    } finally {
      setReading(false);
    }
    // O aluno mexeu no editor durante a leitura, ou saiu do Estudar com texto nele: o que ele fez vale mais, como no
    // exemplo (addExample).
    const now = latest.current;
    const changed = now.input !== input ? 'o texto do editor mudou'
      : input.trim() && now.page !== 'Estudar' ? 'você saiu do Estudar' : '';
    if (changed) {
      toast('O arquivo não entrou: ' + changed + ' durante a leitura');
      return;
    }
    if (got.pages) {
      const { pages } = got;
      setPick({
        reader, name: file.name, pages, total: reader.pageSpan(pages, 1, pages.length).length, from: 1,
        to: reader.firstPages(pages),
      });
    } else {
      putFile(got.text, 'Texto do arquivo: ' + file.name +
        (got.cut ? '. Entrou só o começo: o editor recebe até 20.000 caracteres' : ''));
    }
  }

  // O texto do arquivo toma o lugar do que estava no editor. É do aluno: os exemplos guardados saem, e o trecho do
  // material volta a ser "No seu texto". Com outro texto lá, o Desfazer devolve os dois, como no exemplo (addExample).
  function putFile(text, note) {
    const before = input;
    const examples = [aiExample.current, readyExample.current];
    aiExample.current = readyExample.current = '';
    setInput(text);
    // O campo cresce com o texto e empurra as ferramentas para baixo: o "Abrir arquivo", onde o foco costuma estar,
    // fica à vista, sem ir para trás da barra de baixo do celular.
    focusAfter.current = [null, null, '#abrir-arquivo'];
    if (before.trim()) {
      offerUndo('texto', note, () => {
        [aiExample.current, readyExample.current] = examples;
        setInput(before);
      }, ['#limpar', 'main h1']);
    } else toast(note);
  }

  // "Usar estas páginas" na escolha de páginas. Passou do limite, o botão fica desligado; com uma página só, ela entra
  // cortada no limite, como o TXT longo. O texto e o aviso entram quando a janela já saiu (pickDone, no onExitComplete
  // dela): com ela aberta, a região do aviso fica inerte e o leitor de tela não o lia.
  function takePages() {
    const { name, from, to } = pick;
    const text = capText(picked);
    const note = 'Texto do arquivo: ' + name + ', ' + (from === to ? 'página ' + from : 'páginas ' + from + ' a ' + to) +
      (over ? '. Entrou só o começo da página: o editor recebe até 20.000 caracteres' : '');
    pickDone.current = () => putFile(text, note);
    setPick(null);
  }

  // "Levar este texto ao editor", na janela "Ver no texto": o texto do material volta ao Estudar, para gerar de novo.
  // Com outro texto no editor dá para desfazer, como no exemplo, e o texto anterior volta com os exemplos dele. O texto
  // de um exemplo continua valendo como exemplo: o material gerado dele de novo não diz "No seu texto" (markExample).
  // A janela fecha junto com a troca de página, e o foco vai para o título do Estudar (Modal, back).
  function textToEditor({ texto, origin }) {
    const before = input;
    const examples = [aiExample.current, readyExample.current];
    aiExample.current = origin === 'ia' ? texto : '';
    readyExample.current = origin === 'pronto' ? texto : '';
    setInput(texto);
    setPassage(null);
    go('Estudar');
    if (before === texto) toast('Este texto já está no editor');
    else if (before.trim()) {
      offerUndo('texto', 'Texto do material no editor', () => {
        [aiExample.current, readyExample.current] = examples;
        setInput(before);
      }, ['#limpar', 'main h1']);
    } else toast('Texto do material no editor');
  }

  // Abas Resumo, Flashcards e Quiz: as setas, Home e End trocam de aba e levam o foco junto. O quiz e o baralho ficam
  // onde estavam.
  function tabKeys(e) {
    const at = TABS.findIndex(([p]) => p === page);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const [next] = TABS[(to + TABS.length) % TABS.length];
    setPage(next);
    // A aba dentro desta mesma faixa: a do esqueleto da geração não tem id.
    e.currentTarget.querySelector('[data-tab=' + SLUG[next] + ']')?.focus();
  }

  // Item da biblioteca aberto: o material que estava aberto e ainda não foi salvo vai para a biblioteca antes.
  // Abrir de novo o que já está aberto (ele fica no topo da lista) não recomeça o quiz nem o baralho. O plano até a
  // prova (openTask) abre a parte da tarefa (to), com o foco nela.
  function openSaved(material, to = 'Resumos', focus = ['#material-titulo']) {
    if (keep(result)) toast('O material anterior foi guardado na biblioteca');
    made.current = { key: '' };
    setEditorChat(false);
    setResult(material);
    openPage(to, focus);
    if (!result || !sameMaterial(result, material)) restart();
  }

  // Perfil confirmado na janela (Perfil.jsx). A área do editor só muda quando o perfil é criado ou a área principal
  // muda: quem abre a janela só para corrigir o nome continua na área em que está estudando. user ainda é o anterior.
  function saveProfile(profile) {
    if (!user || profile.area !== user.area) setArea(profile.area);
    setUser(profile);
    setLogin(false);
    if (persist('user', profile)) toast(user ? 'Perfil atualizado' : 'Seu espaço está pronto');
  }

  const quizList = retry || result?.quiz || [];
  // Simulado (startExam): a correção fica para o fim. "Refazer as que errei" volta com a correção na hora.
  const blind = !!result?.exam && !retry;
  const quiz = quizList[idx];
  const wrong = answers.filter(a => !a.ok);
  const right = answers.length - wrong.length;
  const session = deck || deckStart(result?.flashcards?.length || 0);
  const card = result?.flashcards?.[session.queue[session.pos]];
  // Virado o cartão, o que o aluno escreveu no campo aparece logo abaixo da resposta ("Você escreveu").
  const wrote = write && locked && typed.trim() !== '';
  const today = localDay(new Date());
  // Os números do desempenho só mudam com as respostas (ou na virada do dia), não a cada tecla no editor.
  // Quiz e cartões são números separados: nos cartões é o aluno quem diz se acertou.
  const { quizzes, cards, streakDays, studied, weakest } = useMemo(() => {
    const now = new Date();
    return {
      quizzes: quizRate(events),
      cards: cardRate(events),
      streakDays: streak(events, now),
      studied: lastDays(events, 7, now),
      weakest: weakSpot(events, now),
    };
  }, [events, today]);
  const days = useMemo(() => chartDays(events, chartArea, new Date()), [events, chartArea, today]);
  // Revisão espaçada (lib.js): os cartões e as questões do caderno que voltam hoje. Os cartões saem do material aberto
  // e da biblioteca; o material temporário não conta (opened é o que ficou guardado).
  const cardsDue = useMemo(
    () => dueCards(boxes, [opened, ...saved].filter(Boolean), new Date()),
    [boxes, opened, saved, today]
  );
  const mistakesDue = useMemo(() => dueMistakes(mistakes, new Date()), [mistakes, today]);
  // O plano até a prova (lib.js, studyPlan): só no Estudar e no Desempenho, fora do caminho de cada resposta.
  const plan = useMemo(
    () => (page === 'Estudar' || page === 'Desempenho' ? studyPlan(saved, { events, mistakes, boxes }, new Date()) : []),
    [page, saved, events, mistakes, boxes, today]
  );
  // Sem respostas não há percentual: "0%" diria que o aluno errou tudo.
  const percent = r => (r.total ? r.rate + '%' : '—');
  const summary = result?.summary || [];
  const topics = size === 'todos' ? summary : summary.slice(0, Number(size));
  // As perguntas do "Tente responder antes de ler" e as marcas do modo lembrar dos tópicos que estão na lista.
  const pretest = pretestCards(result?.flashcards || []);
  const marked = shownMarks(recall.marks, topics.length);
  // O campo do "Explicar com minhas palavras" só aparece no Resumo, no tópico dele: fora daí o erro do comentário não
  // está na tela, e o aviso do alto conta a espera do limite por minuto (counted, alerts).
  const ownShown = page === 'Resumos' && topics.includes(own?.item);
  // A busca dobra o texto de todos os materiais: só na Biblioteca e só quando a lista, a busca ou o filtro mudam.
  const shown = useMemo(
    () => (page === 'Biblioteca' ? saved.filter(s => matches(s, query, filter)) : []),
    [page, saved, query, filter]
  );
  // As questões de onde sai o simulado: as dos materiais da lista (lib.js, examPool).
  const examFrom = useMemo(() => examPool(shown), [shown]);
  // O leitor de tela ouve quantos materiais a busca ou o filtro deixou, meio segundo depois da última mudança: a cada
  // tecla ele seria atropelado. Abrir a Biblioteca não é anunciado (page fica fora das dependências).
  useEffect(() => {
    if (page !== 'Biblioteca') return;
    const timer = setTimeout(() => latest.current.page === 'Biblioteca' && say(libraryCount(shown.length)), 500);
    return () => clearTimeout(timer);
  }, [query, filter]);
  // A linha do backup, no pé da Biblioteca e do Desempenho: só nessas páginas, fora do caminho de cada resposta.
  const backupLine = useMemo(
    () => (page === 'Biblioteca' || page === 'Desempenho'
      ? backupStatus({ saved, events, last: lastBackup, now: new Date() })
      : null),
    [page, saved, events, lastBackup, today]
  );
  const busiest = Math.max(1, ...days.map(d => d.total));
  // O material do ponto fraco, para o "Abrir" do Desempenho: o aberto ou, na biblioteca, o mais novo com o mesmo título
  // (a demonstração dá o mesmo título ao mesmo texto). O ponto fraco de evento antigo, sem título, não acha nenhum.
  const weakMaterial = weakest && [opened, ...saved].find(s => s?.title === weakest.name);
  // O chat pergunta sobre o material aberto ou sobre o texto do editor (lib.js): o pedido, as sugestões, a saudação e a
  // caixa usam o mesmo assunto.
  const subject = chatSubject({ material: opened, made: made.current.key, editor: editorChat, input, area, level });
  const chatHints = hints({ chat, input: subject.content, area: subject.area, tips, key: subject.key });
  const greeting = hello({
    user, area: subject.area, level: subject.level, input: subject.content, title: subject.title, api: !!API_BASE,
    study: SEM_IA,
  });
  // Teto de chamadas por dia escolhido pelo grupo (lib.js, capReached): até a contagem recomeçar, os botões da IA ficam
  // desligados, com o motivo junto deles.
  const capped = !!API_BASE && capReached(health);
  // O erro do pedido de questões novas só está na tela no fim do quiz do material do pedido: só ali ele já diz a frase
  // e conta os segundos do limite por minuto.
  const extraError = page === 'Quizzes' && done && extra?.of === result ? extra.error : null;
  // Um pedido à IA por vez: a geração do material e a resposta do chat não correm juntas. Na espera do limite por
  // minuto nenhum sai, nem no teto do dia. Sempre true ou false: asking guarda a hora do pedido, e aria-disabled só vale
  // com "true".
  const waiting = !!busy || !!asking || !!pausedUntil || capped;
  // IA sem chave neste computador: o botão de gerar fica desligado, e o aviso embaixo do editor diz por quê.
  const aiOff = !!API_BASE && health?.ai_configured === false;
  // O custo do clique ("1 pedido à IA") vai nos botões que chamam a IA, só quando ela está ligada: a demonstração, o
  // backend sem a IA configurada e o teto do dia não gastam chamada.
  const cost = !!API_BASE && !aiOff && !capped;
  // Nos botões que pedem à IA de dentro do estudo ("Não entendi, me explique" e "Pedir revisão da IA"), o custo dá lugar
  // ao motivo no teto do dia: eles ficam desligados com o motivo ao lado.
  const askCost = capped ? 'teto do dia atingido' : '1 pedido à IA';
  // O teto chegou (o último pedido gastou a última chamada, ou a aba abriu ou voltou com ele): o leitor de tela ouve
  // por que os botões da IA desligaram. Se o foco estava num deles (outra aba gastou o resto), ele iria para o body:
  // antes da pintura, vai para o título da página.
  useLayoutEffect(() => {
    if (!capped) return;
    // A espera do limite por minuto que está na tela passa a dizer o teto (lib.js, rateAtCap).
    setError(rateAtCap);
    setWhy(w => (w?.error?.until ? { ...w, error: rateAtCap(w.error) } : w));
    setAnswer(a => (a?.review?.error?.until ? { ...a, review: { error: rateAtCap(a.review.error) } } : a));
    setOwn(o => (o?.error?.until ? { ...o, error: rateAtCap(o.error) } : o));
    setExtra(x => (x?.error?.until ? { ...x, error: rateAtCap(x.error) } : x));
    // Quando o alerta de um pedido na tela já diz a frase, a região fixa não a repete. A frase que acabou de entrar nela
    // ("Material pronto", do pedido que gastou a última chamada) vai junto: trocada logo depois, não chegaria ao leitor
    // de tela.
    const alerts = [error, ...(MATERIAL.includes(page) ? [why?.error, answer?.review?.error, ownShown && own.error, extraError] : [])];
    if (!alerts.some(e => rateAtCap(e)?.message?.endsWith(ERRORS.AI_BUDGET_REACHED))) {
      say([spoken.trim(), ERRORS.AI_BUDGET_REACHED].filter(Boolean).join(' '));
    }
    if (document.activeElement?.disabled) [...document.querySelectorAll('main h1')].pop()?.focus();
    // A virada do dia religa os botões da IA: o leitor de tela ouve, como no fim da espera do limite por minuto, e o
    // aviso de erro que dizia o teto sai.
    return () => {
      say('Os botões da IA voltaram.');
      setError(e => (e?.message?.endsWith(ERRORS.AI_BUDGET_REACHED) ? null : e));
    };
  }, [capped]);
  // O material aberto saiu do texto, da área e do nível do editor: no lugar do botão de gerar ficam os que só abrem.
  const fresh = !!result && made.current.key === JSON.stringify([input, area, level]);
  const isSaved = !!result?.id && saved.some(s => s.id === result.id);
  // A escolha de páginas: o texto das páginas marcadas, contado como o contador do editor, e se ele passa do limite.
  const picked = pick ? pick.reader.pageSpan(pick.pages, pick.from, pick.to) : '';
  const over = picked.length > MAX_INPUT;
  const status = API_BASE ? healthLabel(health)
    : { text: SEM_IA ? 'Modo estudo · sem IA' : 'Modo demonstração', tone: 'demo' };
  const slug = SLUG[page];
  const inMore = MORE.some(([n]) => n === page);
  // A geração espera a IA: a página do material mostra o esqueleto da parte aberta, se o material aberto ainda é o
  // do clique (o aluno pode abrir outro da biblioteca enquanto espera).
  const making = busy?.kind === 'gerar' && result === busy.prior;
  // A espera de busy fica no lugar da resposta quando esse lugar está na tela (o esqueleto do material, a explicação
  // do tópico ou da questão aberta, a revisão no retorno); senão, na faixa de cima. Decidido aqui, não no CSS: a faixa
  // só monta (e só então entra) quando aparece de verdade, e não fica na tela quando a resposta chega no lugar dela.
  const waitInline = making ? MATERIAL.includes(page)
    : busy?.kind === 'why' ? (page === 'Resumos' && topics.includes(why?.item)) || (page === 'Quizzes' && !done && why?.item === quiz)
    : busy?.kind === 'own' ? ownShown && own.item === busy.item
    : busy?.kind === 'review' ? page === 'Quizzes' && !done && answer === busy.answer
    : busy?.kind === 'questoes' && page === 'Quizzes' && done && result === busy.of;
  const band = !!busy && !waitInline;
  // A faixa de espera fica no lugar do atalho do Dúvidas (no celular, da marca), que sai do Tab enquanto isso, e no
  // Dúvidas o atalho também sai (styles.css). Se o foco estava nele, vai para o item da página aberta no menu, o mesmo
  // destino, em vez de cair no body; fora do toque, quem chega ao Dúvidas pelo atalho segue para a caixa (focusAfter).
  // De 600 a 850 px a faixa também cobre o perfil da barra de cima, que sai do Tab do mesmo jeito (mobile.css).
  // Antes da pintura: o foco não chega a sumir da tela.
  useLayoutEffect(() => {
    const was = document.activeElement;
    if (!was?.closest('.topbar') || getComputedStyle(was).visibility !== 'hidden') return;
    [...document.querySelectorAll('.rail [aria-current=page], .tabbar [aria-current=page], .tabbar [data-current]')]
      .find(item => item.getClientRects().length)?.focus();
  }, [band, page]);
  // A pílula de espera do chat sai quando a resposta chega ou o aluno cancela: se o foco estava no Cancelar dela, vai
  // para a caixa, onde a pergunta cancelada volta, em vez de cair no body. No toque fica, para o teclado não abrir.
  useLayoutEffect(() => {
    if (!asking && !TOUCH && document.activeElement?.closest('.chat-status')) document.getElementById('pergunta')?.focus();
  }, [asking]);
  // A lista de sugestões mudou (a resposta trouxe outras, "Nova conversa", o Desfazer dela, outro assunto): a linha de
  // chips, que rola de lado no celular (mobile.css), volta ao começo. Ela guardava a rolagem do aluno, e a lista nova
  // chegava com o 1º chip fora da vista. Antes da pintura: a lista nova não chega a aparecer rolada. Com a mesma
  // lista, a linha fica onde o aluno a pôs.
  useLayoutEffect(() => {
    if (chipsRow.current) chipsRow.current.scrollLeft = 0;
  }, [chatHints.join('\n')]);
  // Dica do dock (styles.css): o Esc esconde a que está aberta sem mexer no ponteiro nem no foco (WCAG 1.4.13).
  useEffect(() => {
    const hide = e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.rail .nav-item:hover, .rail .nav-item:focus-visible')
        .forEach(item => item.setAttribute('data-dica-fora', ''));
    };
    document.addEventListener('keydown', hide);
    return () => document.removeEventListener('keydown', hide);
  }, []);
  // Com o texto ampliado no aparelho os nomes da barra de baixo não cabem, e ela rola de lado. Quando a rolagem
  // cortaria o nome do "Mais" (lib.js, nameCut), data-rola o prende na ponta, com fundo, e os outros itens passam por
  // baixo dele (mobile.css). Preso, ele não muda nenhuma das medidas da conta.
  useEffect(() => {
    const bar = document.querySelector('.tabbar');
    const more = bar.lastElementChild;
    const watch = new ResizeObserver(() => bar.toggleAttribute('data-rola', nameCut(bar.scrollWidth, bar.clientWidth,
      more.offsetWidth, more.lastElementChild.offsetWidth, getComputedStyle(bar).paddingRight)));
    [bar, ...bar.children].forEach(item => watch.observe(item));
    return () => watch.disconnect();
  }, []);
  // A página que sai esmaece por cima da nova; sai sem movimento quando a troca veio do teclado, quando a página
  // estava rolada (a nova começa do topo e a antiga apareceria deslocada) ou quando o aluno passou direto por ela (cut).
  const still = byKeyboard() || window.scrollY > 80 || cut;
  // Na espera do limite por minuto, as páginas com botões da IA explicam por que eles estão desligados (lib.js,
  // pauseNotice). Se a mensagem que conta os segundos saiu (outra página, a explicação do "Não entendi" ou a revisão
  // fechou) ou não conta esta espera, o aviso de erro conta no lugar dela. No teto do dia, não: os botões não voltam no
  // fim da espera.
  const pause = pauseNotice({
    until: pausedUntil, page, error, capped,
    counted: MATERIAL.includes(page)
      && [why?.error, answer?.review?.error, ownShown && own.error, extraError].some(e => e?.until === pausedUntil),
  });
  const problem = pause || error;
  // O motivo do teto do dia fica junto dos botões da IA, no aviso do Estudar e embaixo da caixa do Dúvidas, e descreve o
  // campo e o botão de enviar (reason). Enquanto o aviso de erro já diz o mesmo (o pedido que bateu no teto, ou a espera
  // do limite por minuto no teto), ele sai: a frase não aparece duas vezes.
  const capNote = capped && !problem?.message?.endsWith(ERRORS.AI_BUDGET_REACHED);
  const errorBanner = (
    <AnimatePresence custom={byKeyboard()}>
      {problem && (
        <m.div
          key="erro"
          ref={errorBox}
          id="erro"
          role="alert"
          className="error"
          tabIndex={-1}
          variants={pop}
          initial={appear()}
          animate="show"
          exit="exit"
        >
          <Icon name="alerta" />
          <Problem error={problem} />
        </m.div>
      )}
    </AnimatePresence>
  );
  // Abas Resumo, Flashcards e Quiz. No esqueleto da geração (wait) elas trocam a parte que espera, sem ids: os do
  // material pronto não se repetem enquanto um esmaece por cima do outro.
  const tablist = wait => (
    <div className="tabs" role="tablist" aria-label="Partes do material" onKeyDown={tabKeys}>
      {TABS.map(([p, l]) => (
        <button
          key={p}
          type="button"
          role="tab"
          id={wait ? undefined : 'aba-' + SLUG[p]}
          data-tab={SLUG[p]}
          aria-selected={page === p}
          aria-controls={wait ? undefined : 'material-painel'}
          tabIndex={page === p ? 0 : -1}
          onClick={() => setPage(p)}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const navButton = ([n, s], className, short = false) => (
    <button
      key={n}
      type="button"
      className={className}
      data-tab={s}
      aria-current={page === n ? 'page' : undefined}
      onClick={() => go(n)}
    >
      <Icon name={s} />
      <span>{(short && SHORT[n]) || NAMES[n] || n}</span>
    </button>
  );

  const profileButton = onClick => (
    <button type="button" className="profile" aria-haspopup="dialog" onClick={onClick}>
      <span className="avatar" aria-hidden="true">{(user?.name || 'V')[0].toUpperCase()}</span>
      <span className="profile-text">
        {user?.name || 'Visitante'}
        <small>{user ? 'Perfil local' : 'Criar perfil local'}</small>
      </span>
    </button>
  );

  return (
    <div className="app" data-page={slug}>
      {/* O primeiro Tab da página: só aparece com o foco (styles.css) e leva o foco ao título da página, no palco, sem as
          paradas da barra de cima e do menu. O main não ganha tabindex: no Safari o clique num botão dá o foco ao
          ancestral focável, e o menu do nível do editor fecharia antes de o clique chegar ao item. */}
      <a
        className="skip-link"
        href="#conteudo"
        onClick={e => {
          e.preventDefault();
          [...document.querySelectorAll('main h1')].pop()?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <Waves on={wavesAllowed} animate={fundo && !wavesStill} onActive={setWavesActive} />
      <div className="shell">
        <header className="topbar">
          {/* A marca leva ao Estudar. No celular a barra fica só com ela e o estado da IA (mobile.css): o perfil e o
              Dúvidas estão na folha "Mais". De 600 a 850 px o perfil continua aqui, e o Dúvidas fica na barra de
              baixo. */}
          <a
            className="brand"
            href="#"
            onClick={e => {
              e.preventDefault();
              go('Estudar');
            }}
          >
            <BrandMark />
            <span className="brand-name">
              Cérebro
              <small>Meu espaço</small>
            </span>
          </a>
          {/* Atalho para o Dúvidas, pelo mesmo caminho do menu (go). Quem chega por ele vem perguntar: o foco vai para a
              caixa (no toque, para o Dúvidas do dock, e o teclado não abre sozinho). No Dúvidas ele some (styles.css). */}
          <button
            type="button"
            className="ask-pill"
            onClick={() => {
              if (!TOUCH) focusAfter.current = ['#pergunta'];
              go('Dúvidas');
            }}
          >
            <span className="ask-pill-text">Pergunte ao Cérebro</span>
            <Icon name="buscar" />
          </button>
          <div className="top-actions">
            {/* O estado da IA vai sempre escrito: a cor do ponto sozinha não diz nada a quem não a distingue. */}
            {/* Enquanto confere, o ponto fica vazado e o texto diz isso; a troca de estado esmaece no lugar. */}
            {/* A dica (title) explica que a conta é deste computador e a cota, do projeto inteiro. Com a IA ativa, o modelo
                vai à parte: com a barra estreita ele sai da vista e continua no leitor de tela (styles.css, @container). */}
            <p className="ai-status" data-tone={status.tone} title={status.note}>
              <span className="status-dot" aria-hidden="true"></span>
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span key={status.text} className="status-text" variants={focusIn} initial="hidden" animate="show" exit="exit">
                  {status.model
                    ? <>IA ativa<span className="status-model">{' · ' + status.model}</span>{status.count && ' · ' + status.count}</>
                    : status.text}
                </m.span>
              </AnimatePresence>
            </p>
            {/* O nome não muda; o estado vai no aria-pressed e no ícone (pausar com o fundo andando, tocar com ele
                parado). Vale na hora. No celular este sai, e fica o da folha "Mais" (mobile.css). */}
            {fundoShown && (
              <button
                type="button"
                className="icon-button"
                aria-pressed={fundo}
                aria-label="Fundo animado"
                title="Fundo animado"
                onClick={toggleFundo}
              >
                <Icon name={fundo ? 'pausar' : 'tocar'} />
              </button>
            )}
            {profileButton(() => setLogin(true))}
          </div>
        </header>
        {/* As seções num dock de vidro preso à esquerda do palco, só com os ícones: o nome de cada uma continua no botão
            e aparece numa dica (styles.css). --i leva a pílula ciano até a seção aberta. Ele vem depois da barra de
            cima, como na tela: o Tab passa pela barra, pelo dock e então pela página. No celular o dock sai e fica a
            barra de baixo (mobile.css).
            A dica sai depois da escolha, para não ficar sobre a página nova, e com o Esc (useEffect acima); volta
            quando o ponteiro ou o foco deixam o item. */}
        <nav
          className="rail"
          aria-label="Seções"
          style={{ '--i': SECTIONS.findIndex(([n]) => n === page) }}
          onClick={e => e.target.closest('.nav-item')?.setAttribute('data-dica-fora', '')}
          onPointerOut={e => {
            const item = e.target.closest('.nav-item');
            if (item && !item.contains(e.relatedTarget)) item.removeAttribute('data-dica-fora');
          }}
          onBlur={e => {
            // Com o ponteiro ainda parado no item a dica continua fora; o onPointerOut a devolve quando ele sair.
            const item = e.target.closest('.nav-item');
            if (!item?.matches(':hover')) item?.removeAttribute('data-dica-fora');
          }}
        >
          {SECTIONS.map(s => navButton(s, 'nav-item'))}
        </nav>
        {/* data-instant: a página que sai some sem movimento (styles.css). */}
        <main id="conteudo" style={{ '--sec': 'var(--tab-' + slug + ')' }} data-instant={calm || still || undefined}>
          {/* Cada página é um m.div novo (key): a entrada roda quando ela abre e só então. Os filhos com
              variants={rise} são os blocos que existem desde a abertura; o resto entra sem animação.
              Resumos, Flashcards e Quizzes são abas do mesmo material: a mesma key, então trocar de aba não refaz a
              entrada e a aba que tem o foco do teclado continua na tela (com uma key por página ela era recriada e o
              foco caía na página).
              A página que sai (popLayout) sai do fluxo na hora e esmaece por cima da nova, sem receber clique. Numa
              troca no meio de outra (cut) a nova aparece parada e a do meio some na hora.
              presenceAffectsLayout false: sem ele a página passava um contexto novo a cada desenho do App, e cada tecla
              redesenhava o que mora dentro dela, até os balões da conversa (ChatLog). Ele só importa para animação de
              layout, que o app não usa. */}
          <AnimatePresence mode="popLayout" custom={still} presenceAffectsLayout={false}>
            <m.div
              key={viewKey}
              className="view"
              variants={viewIn}
              initial={cut ? false : appear()}
              animate="show"
              exit="exit"
            >
              {/* O Dúvidas tem o título dele, no herói do chat. */}
              {page !== 'Dúvidas' && (
                <m.div className="page-head" variants={titleIn}>
                  <h1 className="page-title" tabIndex={-1}>{NAMES[page] || page}</h1>
                  {page === 'Estudar' && (
                    <p className="lead">
                      Cole o texto da aula{API_BASE && ' ou escreva um tema'}, escolha a área e o nível e gere o material.
                    </p>
                  )}
                </m.div>
              )}
              {/* No Estudar o erro aparece junto dos botões de gerar; no Dúvidas, junto da caixa de pergunta. */}
              {page !== 'Estudar' && page !== 'Dúvidas' && errorBanner}
              {page === 'Estudar' && (
                <>
                  <m.div variants={rise}>
                    {/* A caixa do editor (prompt-composer.jsx): o campo, a área em chips, o nível no menu e, na última
                        linha, as ferramentas abaixo, o contador e o "Perguntar ao Cérebro" (pelo botão ou pelo Ctrl +
                        Enter). */}
                    <PromptComposer
                      value={input}
                      onChange={text => {
                        setInput(text);
                        if (undo?.kind === 'texto') setUndo(null);
                      }}
                      onSend={() => {
                        openPage('Dúvidas', ASK_FOCUS);
                        ask(input);
                      }}
                      area={area}
                      onArea={setArea}
                      level={level}
                      onLevel={setLevel}
                      waiting={waiting}
                      cost={cost}
                      reason={capNote ? 'aviso-ia' : undefined}
                      onFile={openFile}
                      topic={!!API_BASE}
                    >
                      {/* No celular cada ferramenta mostra só a palavra curta; o nome inteiro continua no botão. */}
                      <button type="button" className="tool" onClick={dictation}>
                        {/* Enquanto ouve, o orbe da IA toma o lugar do microfone, nos mesmos 20 px; o nome do botão já
                            diz "Parar ditado". */}
                        {listening
                          ? <Orb state="listening" />
                          : <Icon name="falar" />}
                        <span className="full">{listening ? 'Parar ditado' : 'Falar conteúdo'}</span>
                        <span className="short" aria-hidden="true">{listening ? 'Parar' : 'Falar'}</span>
                      </button>
                      {/* PDF, TXT ou MD, lido aqui mesmo (openFile); soltar o arquivo sobre a caixa faz o mesmo. Na
                          leitura, aria-disabled, como o exemplo na espera. A palavra curta vale em toda largura: com
                          "Abrir arquivo", no computador o contador e o "Perguntar ao Cérebro" desciam para outra linha. */}
                      <button
                        type="button"
                        id="abrir-arquivo"
                        className="tool"
                        aria-disabled={reading || undefined}
                        onClick={() => !reading && picker.current.click()}
                      >
                        <Icon name="arquivo" />
                        <span className="sr-only">{reading ? 'Lendo o arquivo…' : 'Abrir arquivo'}</span>
                        <span aria-hidden="true">{reading ? 'Lendo…' : 'Arquivo'}</span>
                      </button>
                      <input
                        ref={picker}
                        type="file"
                        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0];
                          // Sem esvaziar o campo, abrir o mesmo arquivo de novo não dispararia o onChange.
                          e.target.value = '';
                          openFile(file);
                        }}
                      />
                      {/* Na espera, aria-disabled e não disabled: o botão desligado perdia o foco (addExample não pede
                          outro exemplo enquanto espera). No teto do dia ele fica ligado, com o exemplo pronto. */}
                      <button
                        type="button"
                        id="usar-exemplo"
                        className="tool"
                        aria-disabled={(waiting && !capped) || undefined}
                        onClick={addExample}
                      >
                        <Icon name="exemplo" />
                        <span className="full">Usar um exemplo</span>
                        {/* O custo vai no nome quando o clique chama a IA (addExample); sem ela o exemplo é pronto. Fica
                            fora da tela: com ele, as quatro ferramentas não cabiam na linha do contador e do "Perguntar
                            ao Cérebro" no computador. */}
                        {cost && <small className="sr-only">1 pedido à IA</small>}
                        <span className="short" aria-hidden="true">Exemplo</span>
                      </button>
                      {/* Depois de Limpar (ou do exemplo por cima de um texto), o mesmo lugar vira Desfazer até o aluno
                          voltar a escrever: o foco fica no botão e a chance de voltar não some com o aviso. */}
                      {undo?.kind === 'texto' ? (
                        <button type="button" id="limpar" className="tool" onClick={() => undoNow(undo)}>
                          <Icon name="desfazer" />
                          <span>Desfazer</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id="limpar"
                          className="tool"
                          disabled={!input}
                          onClick={() => {
                            const before = input;
                            // O exemplo, da IA ou pronto, sai junto com o texto: o que o aluno escrever depois é
                            // dele. O Desfazer devolve os dois.
                            const examples = [aiExample.current, readyExample.current];
                            aiExample.current = readyExample.current = '';
                            setInput('');
                            offerUndo('texto', 'Texto apagado', () => {
                              [aiExample.current, readyExample.current] = examples;
                              setInput(before);
                            }, ['#limpar', 'main h1']);
                          }}
                        >
                          <Icon name="limpar" />
                          <span>Limpar</span>
                        </button>
                      )}
                    </PromptComposer>
                    <p id="composer-keyboard-hint" className="hint">
                      {TOUCH
                        ? 'Use o botão para perguntar ao Cérebro'
                        : <><kbd>{MAC ? '⌘' : 'Ctrl'}</kbd> + <kbd>Enter</kbd> para perguntar ao Cérebro</>}
                    </p>
                  </m.div>
                  <m.div variants={rise}>
                    {/* Sem a chave da IA, o aviso diz por que o botão de gerar está desligado e leva à demonstração, que
                        funciona sem IA. No teto do dia, diz o mesmo dele e o que funciona sem IA. No modo estudo, o que
                        os botões fazem sem IA e de onde vêm os materiais. */}
                    <p className="note" id="aviso-ia">
                      <Icon name={API_BASE && !aiOff && !capNote ? 'privacidade' : 'info'} />
                      {aiOff ? (
                        <span>
                          A IA não está ligada neste computador: o botão de gerar fica desligado.{' '}
                          <a href="?demo">Ver a demonstração</a>
                        </span>
                      ) : capNote ? ERRORS.AI_BUDGET_REACHED : API_BASE
                        ? 'Seu texto é enviado ao Google Gemini para gerar o material. Não cole dados pessoais.'
                        : SEM_IA ? 'Modo estudo, sem IA neste aparelho: os botões só organizam o texto por frases. ' +
                          'Para estudar os seus materiais, importe o backup na Biblioteca. Os dados ficam só aqui: ' +
                          'instale o app na tela inicial e exporte o backup para levar o progresso ao computador.'
                        : 'Demonstração local: conteúdo organizado por trechos, sem IA conectada. Nada daqui entra no ' +
                          'desempenho, no caderno de erros nem na biblioteca do app com IA.'}
                    </p>
                    <div className="actions" role="group" aria-label="Gerar material">
                      {/* Uma chamada traz resumo, flashcards e quiz. Com o material deste texto aberto, as três partes
                          só abrem, sem chamar a IA, e o botão de gerar vira o "Gerar de novo". A parte aberta tira o
                          botão da tela com o Estudar: o foco vai para o título do material (na espera, o da página).
                          Elas só trocam de página: continuam ligadas sem a chave da IA e na espera do limite por
                          minuto, quando o botão de gerar fica desligado. */}
                      {fresh && (
                        <div className="open-parts" role="group" aria-labelledby="abrir-partes">
                          <span id="abrir-partes">Abrir:</span>
                          {TABS.map(([p, l]) => (
                            <button
                              key={p}
                              type="button"
                              className="action"
                              data-tab={SLUG[p]}
                              onClick={() => {
                                go(p);
                                focusAfter.current = ['#material-titulo', 'main h1'];
                              }}
                            >
                              <Icon name={SLUG[p]} />
                              {l}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        id="gerar"
                        className={fresh ? 'action' : 'action primary'}
                        disabled={waiting || aiOff}
                        aria-describedby={aiOff || capNote ? 'aviso-ia' : undefined}
                        aria-busy={busy?.kind === 'gerar' || undefined}
                        onClick={() => generate()}
                      >
                        {/* A espera (o fio, os segundos e o Cancelar) fica na página do material ou na faixa de
                            cima: aqui o botão só diz que está gerando. */}
                        <Icon name={fresh ? 'refazer' : 'resumos'} />
                        {busy?.kind === 'gerar'
                          ? 'Gerando…'
                          : fresh ? 'Gerar de novo' : 'Gerar resumo, flashcards e quiz'}
                        {cost && busy?.kind !== 'gerar' && <small>1 pedido à IA</small>}
                      </button>
                    </div>
                  </m.div>
                  {errorBanner}
                  <m.section className="progress" aria-labelledby="progresso" variants={rise}>
                    <div className="progress-head">
                      <h2 id="progresso">Seu progresso</h2>
                      {/* A revisão espaçada: o link dos cartões abre a revisão do dia; o das questões, o caderno. */}
                      {cardsDue.length > 0 && (
                        <button type="button" className="link" onClick={() => dayDeck()}>
                          {cardsDue.length + ' ' + plural(cardsDue.length, 'cartão', 'cartões') + ' para hoje'}
                        </button>
                      )}
                      {mistakes.length > 0 && (
                        <button type="button" className="link" onClick={() => openPage('Erros')}>
                          {mistakesDue.length
                            ? mistakesDue.length + ' ' + plural(mistakesDue.length, 'questão', 'questões') + ' para hoje'
                            : mistakes.length + ' ' + plural(mistakes.length, 'questão', 'questões') + ' no caderno'}
                        </button>
                      )}
                      <button type="button" className="link" onClick={() => openPage('Desempenho')}>
                        Ver meu desempenho
                        <Icon name="seta" />
                      </button>
                    </div>
                    {plan.length > 0 && <StudyPlan rows={plan} onOpen={openTask} />}
                    <div className="stats">
                      <Stat
                        value={streakDays}
                        label={plural(streakDays, 'dia seguido de estudo', 'dias seguidos de estudo')}
                      />
                      <Stat value={cards.total} label={plural(cards.total, 'cartão revisado', 'cartões revisados')} />
                      <Stat
                        value={quizzes.total}
                        label={plural(quizzes.total, 'questão respondida', 'questões respondidas')}
                      />
                      <Stat value={percent(quizzes)} label="de acerto no quiz" />
                      {/* Os dias de estudo da semana, com a mesma caneta: ✓ dia com estudo, ○ dia sem. */}
                      <div
                        className="stat days"
                        role="img"
                        aria-label={'Dias com estudo nos últimos 7: ' + studied.filter(Boolean).length}
                      >
                        <span className="day-marks">
                          {studied.map((day, i) => <Pen key={i} kind={day ? 'certo' : 'novo'} />)}
                        </span>
                        <span>últimos 7 dias</span>
                      </div>
                    </div>
                  </m.section>
                </>
              )}
              {MATERIAL.includes(page) && (
                // Com a lista "Mostrar" do Resumo dentro, o bloco só esmaece (anim.js, fade).
                <m.div variants={fade}>
                  {/* Esqueleto, vazio ou material: a troca entre eles esmaece no lugar (popLayout tira do fluxo o que
                      sai). Na abertura da página nada disso anima à parte (live false: a entrada é a da página). O
                      initial fica em cada painel e não no AnimatePresence: lá ele valeria para tudo o que monta depois
                      dentro do painel (o fim do baralho e do quiz, a explicação), que então entraria sem movimento. */}
                  <AnimatePresence mode="popLayout" custom={byKeyboard()}>
                    {making ? (
                      <m.section
                        key="espera"
                        className="panel material material-wait"
                        aria-busy="true"
                        variants={focusIn}
                        initial={live && appear()}
                        animate="show"
                        exit="exit"
                      >
                        {/* O fio da espera corre na borda de cima do painel; o Cancelar fica onde fica o Salvar. A espera
                            nasce com o texto e não seria lida: quem anuncia é a região fixa (#anuncio). */}
                        <div className="result-header">
                          <div>
                            <Sk w="55%" className="sk-title" />
                            <Wait label={busy.label} since={busy.since} onCancel={cancelAI} />
                          </div>
                        </div>
                        {tablist(true)}
                        <div role="tabpanel" aria-label={TABS.find(([p]) => p === page)?.[1]}>
                          {page === 'Resumos'
                            ? <SummarySkeleton pretest={pretestOpens()} />
                            : page === 'Flashcards' ? <CardSkeleton write={write} /> : <QuizSkeleton />}
                        </div>
                      </m.section>
                    ) : !result ? (
                      <m.section key="vazio" className="panel empty" variants={focusIn} initial={live && appear()} animate="show" exit="exit">
                        <h2>Nenhum material aberto</h2>
                        <p>Cole o texto da aula no Estudar para gerar resumo, flashcards e quiz.</p>
                        <div className="row center">
                          <button type="button" className="primary" onClick={() => openPage('Estudar')}>Ir para Estudar</button>
                          {saved.length > 0 && (
                            <button type="button" onClick={() => openPage('Biblioteca')}>
                              Abrir da biblioteca ({saved.length})
                            </button>
                          )}
                          {page === 'Flashcards' && cardsDue.length > 0 && (
                            <button type="button" onClick={() => dayDeck()}>
                              Revisão do dia ({cardsDue.length})
                            </button>
                          )}
                        </div>
                      </m.section>
                    ) : (
                      <m.section key="material" className="panel material" variants={focusIn} initial={live && appear()} animate="show" exit="exit">
                        {/* O material temporário só tem uma parte (o quiz do caderno de erros e do simulado, os cartões da
                            revisão do dia): sem o botão de salvar e sem as abas. */}
                        <div className="result-header">
                          <div>
                            <h2 id="material-titulo" tabIndex={-1}>{result.title}</h2>
                            <p className="meta">
                              {result.exam ? examLine(result.quiz)
                                : result.virtual === 'Quizzes' ? 'Questões que você errou'
                                : result.virtual ? (new Set(result.flashcards.map(c => c.title)).size === 1
                                  ? 'Cartões de "' + result.flashcards[0].title + '"' : 'Cartões de vários materiais')
                                : [result.area, result.level].filter(Boolean).join(' · ')}
                            </p>
                            {/* O aviso segue o material, e não o modo: só o da demonstração (semIA) não tem texto da IA.
                                O dos outros diz de onde ele veio (lib.js, originNote). No modo estudo, o material
                                temporário leva o aviso, a menos que cada item venha de material feito no aparelho
                                (lib.js, virtualNote). */}
                            {result.virtual
                              ? aiNote || (SEM_IA &&
                                virtualNote([...result.quiz, ...result.flashcards], [opened, ...saved].filter(Boolean)) &&
                                <p className="ai-note">{AI_NOTE}</p>)
                              : result.semIA !== true && <p className="ai-note">{originNote(summary, result.recebido)}</p>}
                          </div>
                          {/* A data da prova monta o plano do Estudar e do Desempenho (#86). Ela, o Compartilhar e o
                              Salvar ficam juntos: na tela estreita, os três descem para baixo do título. */}
                          {!result.virtual && (
                            <div className="header-actions">
                              <ExamDate key={result.title} value={provaOf(result)} today={today} onSave={setExam} say={say} />
                              <button type="button" className="share" aria-haspopup="dialog" onClick={() => openShare(result)}>
                                <Icon name="compartilhar" />
                                <span>Compartilhar</span>
                              </button>
                              <button type="button" aria-disabled={isSaved || undefined} onClick={isSaved ? undefined : save}>
                                <Icon name={isSaved ? 'check' : 'salvar'} />
                                {isSaved ? 'Salvo' : 'Salvar material'}
                              </button>
                            </div>
                          )}
                        </div>
                        {!result.virtual && tablist(false)}
                        <div
                          id="material-painel"
                          role={result.virtual ? undefined : 'tabpanel'}
                          aria-labelledby={result.virtual ? undefined : 'aba-' + slug}
                        >
                          {page === 'Resumos' && (
                            <>
                              <div className="row summary-tools">
                                <label className="inline-field">
                                  Mostrar
                                  {/* A lista encolhe ou cresce longe do foco: o leitor de tela ouve a contagem ao lado. */}
                                  <select
                                    value={size}
                                    onChange={e => {
                                      setSize(e.target.value);
                                      say(topicCount(e.target.value, summary.length));
                                    }}
                                  >
                                    <option value="todos">Todos os tópicos</option>
                                    <option value="6">Os 6 primeiros</option>
                                    <option value="3">Os 3 primeiros</option>
                                  </select>
                                </label>
                                <span className="topic-count">{topicCount(size, summary.length)}</span>
                                {/* Ligar ou desligar começa outra rodada: todos os tópicos escondidos, sem marcas. */}
                                <label className="inline-field check">
                                  <input
                                    type="checkbox"
                                    checked={hide}
                                    onChange={e => {
                                      setHide(e.target.checked);
                                      setRecall({ ...recall, shown: {}, marks: {} });
                                      say(e.target.checked
                                        ? 'Só os títulos na tela. Tente lembrar cada tópico antes de mostrar.'
                                        : 'O texto de todos os tópicos está na tela.');
                                    }}
                                  />
                                  Esconder o texto
                                </label>
                                {/* O bloco pulado, ou o que já abre fechado depois de 2 pulos seguidos, volta por aqui. */}
                                {recall.pre === null && pretest.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRecall({ ...recall, pre: 'aberto' });
                                      // Como na questão nova do quiz: no toque o título, para o teclado da tela não abrir.
                                      focusAfter.current = TOUCH ? ['#antes-titulo'] : ['#antes-0', '#antes-titulo'];
                                    }}
                                  >
                                    Tentar antes de ler
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      // Copia o resumo inteiro, não só os tópicos que a lista "Mostrar" deixa na tela: o
                                      // aviso diz quantos foram.
                                      await navigator.clipboard.writeText(summary.map(s => s.concept + ': ' + s.text).join('\n'));
                                      toast('Resumo inteiro copiado: ' + summary.length +
                                        (summary.length === 1 ? ' tópico' : ' tópicos'));
                                    } catch {
                                      toast('Cópia indisponível neste navegador');
                                    }
                                  }}
                                >
                                  <Icon name="copiar" />
                                  Copiar
                                </button>
                              </div>
                              {/* Tentar responder antes de ler ajuda a fixar mesmo quando a resposta sai errada: ninguém
                                  corrige aqui, e o aluno compara no fim do resumo. */}
                              {recall.pre === 'aberto' && pretest.length > 0 && (
                                <section className="pretest" aria-labelledby="antes-titulo">
                                  <h3 id="antes-titulo" tabIndex={-1}>Tente responder antes de ler</h3>
                                  <p className="hint">
                                    Escreva o que você lembra, mesmo sem certeza. Ninguém corrige agora: no fim do resumo
                                    você compara com a resposta do material.
                                  </p>
                                  {pretest.map((card, n) => (
                                    <div key={n} className="pretest-item">
                                      <label htmlFor={'antes-' + n}>{card.question}</label>
                                      <textarea
                                        id={'antes-' + n}
                                        rows={2}
                                        maxLength={500}
                                        value={recall.tries[n]}
                                        onChange={e => {
                                          const text = e.target.value;
                                          setRecall(r => ({ ...r, tries: r.tries.map((t, k) => (k === n ? text : t)) }));
                                        }}
                                      />
                                    </div>
                                  ))}
                                  <div className="row">
                                    <button type="button" className="primary" onClick={() => closePretest(true)}>
                                      Ler o resumo
                                    </button>
                                    <button type="button" onClick={() => closePretest(false)}>Pular</button>
                                  </div>
                                </section>
                              )}
                              <ol className="summary" role="list">
                                {topics.map((s, i) => (
                                  // Escondido, o tópico fica só com o título e o "Mostrar" (styles.css, data-escondido).
                                  // Explicando com as próprias palavras (data-proprio), o tópico fica com o título, o botão e
                                  // o campo, também com "Esconder o texto": o texto volta na comparação.
                                  <li
                                    key={i}
                                    data-escondido={(hide && !recall.shown[i] && own?.item !== s) || undefined}
                                    data-proprio={own?.item === s || undefined}
                                  >
                                    <span className="topic-n" aria-hidden="true">{i + 1}</span>
                                    <div>
                                      {/* Os botões do tópico se repetem em todos: cada um leva o título dele na descrição, e na
                                          lista de botões do leitor de tela dá para saber de qual tópico é. */}
                                      <h3 id={'topico-' + i} tabIndex={-1}>{s.concept}</h3>
                                      {/* O botão fica no lugar e diz se o texto está à vista: o foco não se perde. */}
                                      {hide && (
                                        <button
                                          type="button"
                                          id={'mostrar-' + i}
                                          className="link reveal"
                                          aria-describedby={'topico-' + i}
                                          aria-expanded={!!recall.shown[i]}
                                          onClick={() => setRecall({ ...recall, shown: { ...recall.shown, [i]: !recall.shown[i] } })}
                                        >
                                          <Icon name="abaixo" />
                                          Mostrar
                                        </button>
                                      )}
                                      <p>{s.text}</p>
                                      {s.source?.trim() && <p className="source">{sourceLabel(s, result.recebido)}</p>}
                                      {/* O trecho dentro do texto inteiro, numa janela que abre nele. Material de antes do
                                          campo texto não guardou o texto e fica sem o botão. O recebido de um colega
                                          também: o texto de um arquivo mexido à mão não é o do aluno. */}
                                      {s.source?.trim() && result.recebido !== true && result.texto?.trim() && (
                                        <button
                                          type="button"
                                          className="link source-link"
                                          aria-describedby={'topico-' + i}
                                          aria-haspopup="dialog"
                                          onClick={() => {
                                            setPassage({
                                              texto: result.texto,
                                              range: findSource(result.texto, s.source),
                                              origin: textOrigin(summary),
                                              concept: s.concept,
                                            });
                                            focusAfter.current = ['.source-text mark', '.source-text'];
                                          }}
                                        >
                                          Ver no texto
                                        </button>
                                      )}
                                      {/* Sem trecho, ou com trecho do exemplo da própria IA, nada conferiu o tópico. O
                                          exemplo pronto não é da IA: o trecho dele confere, como o do aluno. */}
                                      {result.semIA !== true && (s.ia || !s.source?.trim()) && (
                                        <span className="ai-tag">Explicação da IA: confira</span>
                                      )}
                                      {/* A marca é do aluno sobre ele mesmo: fica só no placar do fim da lista. */}
                                      {hide && (
                                        <div className="row recall-marks" role="group" aria-label="Você lembrou deste tópico?">
                                          {[[true, 'Lembrei'], [false, 'Não lembrei']].map(([ok, label]) => (
                                            <button
                                              key={label}
                                              type="button"
                                              aria-describedby={'topico-' + i}
                                              aria-pressed={recall.marks[i] === ok}
                                              onClick={() => markTopic(i, ok)}
                                            >
                                              {recall.marks[i] === ok && <Icon name="check" />}
                                              {label}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      {/* O foco do "Não entendi" volta ao botão do pedido ou, com o tópico escondido durante
                                          a espera, ao "Mostrar" dele (ao "Explicar com minhas palavras", com o campo aberto):
                                          vale o último que está na tela, e o "Mostrar" vem antes. "Explicar com minhas
                                          palavras" não chama a IA e fica também na demonstração. */}
                                      <div className="ai-ask">
                                        <button
                                          type="button"
                                          id={'minhas-' + i}
                                          className="own-toggle"
                                          aria-describedby={'topico-' + i}
                                          aria-expanded={own?.item === s}
                                          onClick={() => toggleOwn(s, i)}
                                        >
                                          <Icon name="abaixo" />
                                          Explicar com minhas palavras
                                        </button>
                                        {API_BASE && (
                                          <button
                                            type="button"
                                            id={'explicar-' + i}
                                            aria-describedby={'topico-' + i}
                                            aria-disabled={waiting || undefined}
                                            onClick={() => explain(s, whyTopic(s.concept), s.text, '#mostrar-' + i + ', #minhas-' + i + ', #explicar-' + i)}
                                          >
                                            Não entendi, me explique <small>{askCost}</small>
                                          </button>
                                        )}
                                      </div>
                                      {/* Explicar sem olhar o texto mostra o que o aluno entendeu e o que falta: o campo vem
                                          no lugar do texto, e a comparação só aparece depois. Nada daqui é gravado. */}
                                      {own?.item === s && (
                                        <div className="own">
                                          {own.compared ? (
                                            <div className="own-compare">
                                              <div>
                                                <h4 id="proprio-voce" tabIndex={-1}>Você escreveu</h4>
                                                <p className="own-text">{own.text.trim() || 'Você não escreveu nada.'}</p>
                                              </div>
                                              <div>
                                                <h4>No resumo</h4>
                                                <p>
                                                  {markPieces(s.text, own.review?.missing || []).map((part, k) =>
                                                    part.mark ? <mark key={k}>{part.text}</mark> : part.text)}
                                                </p>
                                                {s.source?.trim() && <p className="source">{sourceLabel(s, result.recebido)}</p>}
                                                {result.semIA !== true && (s.ia || !s.source?.trim()) && (
                                                  <span className="ai-tag">Explicação da IA: confira</span>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <label htmlFor="proprio-campo">Sem olhar o texto, explique o tópico com suas palavras</label>
                                              <p className="hint" id="proprio-dica">De 2 a 5 frases, com até 1.000 caracteres.</p>
                                              <textarea
                                                id="proprio-campo"
                                                rows={4}
                                                maxLength={1000}
                                                aria-describedby="proprio-dica"
                                                readOnly={busy?.kind === 'own' && busy.item === s}
                                                value={own.text}
                                                onChange={e => {
                                                  const text = e.target.value;
                                                  // O aviso de campo em branco sai com o texto; o do limite por minuto
                                                  // fica até a espera acabar, como no Estudar.
                                                  setOwn(o => ({ ...o, text, error: o.error?.until > Date.now() ? o.error : null }));
                                                }}
                                              />
                                            </>
                                          )}
                                          {own.review && (
                                            <m.div className="own-review" variants={focusIn} initial={appear()} animate="show">
                                              <p id="proprio-veredito" tabIndex={-1}><strong>{OWN_VERDICT[own.review.verdict]}</strong></p>
                                              {own.review.missing.length > 0 && (
                                                <>
                                                  <p id="proprio-faltou">O que faltou, marcado no texto do resumo:</p>
                                                  <ul aria-labelledby="proprio-faltou">
                                                    {own.review.missing.map((piece, k) => <li key={k}>{piece}</li>)}
                                                  </ul>
                                                </>
                                              )}
                                              {own.review.misconception && <p>Equívoco: {own.review.misconception}</p>}
                                              <p className="hint">Comentário da IA: pode errar.</p>
                                            </m.div>
                                          )}
                                          {/* O comentário pedido espera no lugar onde ele vai entrar. */}
                                          {busy?.kind === 'own' && busy.item === s && (
                                            <div className="review-wait">
                                              <Sk className="sk-read" />
                                              <Sk w="72%" className="sk-read" />
                                              <Wait label={busy.label} since={busy.since} onCancel={cancelAI} />
                                            </div>
                                          )}
                                          {own.error && <div role="alert" className="error"><Problem error={own.error} /></div>}
                                          {!own.compared && (
                                            <div className="row">
                                              <button
                                                type="button"
                                                className="primary"
                                                onClick={() => {
                                                  // O campo sai da tela: o foco vai para o que o aluno escreveu.
                                                  setOwn({ ...own, compared: true });
                                                  focusAfter.current = ['#proprio-voce'];
                                                }}
                                              >
                                                Comparar
                                              </button>
                                            </div>
                                          )}
                                          {/* O aviso vem antes do botão, e o botão o leva na descrição. Sem nada escrito, a
                                              comparação fica sem o pedido à IA. */}
                                          {API_BASE && !own.review && (!own.compared || own.text.trim()) && (
                                            <>
                                              <p className="hint" id="proprio-aviso">O que você escreve vai para o Google Gemini.</p>
                                              <div className="ai-ask">
                                                <button
                                                  type="button"
                                                  id="proprio-ia"
                                                  aria-disabled={waiting || undefined}
                                                  aria-describedby="proprio-aviso"
                                                  onClick={commentOwn}
                                                >
                                                  Pedir comentário da IA <small>{askCost}</small>
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {why?.item === s && <Why {...why} wait={busy} onCancel={cancelAI} pop={pop} focusIn={focusIn} />}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                              {hide && marked.length > 0 && (
                                <div className="recall-score">
                                  <p>{recallLine(marked)}</p>
                                  {marked.includes(false) && (
                                    <>
                                      <p className="hint" id="para-rever">Para rever:</p>
                                      <ul aria-labelledby="para-rever">
                                        {topics.map((s, i) => recall.marks[i] === false && <li key={i}>{s.concept}</li>)}
                                      </ul>
                                    </>
                                  )}
                                </div>
                              )}
                              {/* Os flashcards e o quiz cobram também os tópicos escondidos: o fim da lista leva a eles.
                                  O botão some com o clique, e o foco vai ao primeiro tópico que apareceu. */}
                              {topics.length < summary.length && (
                                <div className="row">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      focusAfter.current = ['.summary li:nth-child(' + (topics.length + 1) + ') h3'];
                                      setSize('todos');
                                    }}
                                  >
                                    {summary.length - topics.length === 1
                                      ? 'Ver o outro tópico'
                                      : 'Ver os outros ' + (summary.length - topics.length) + ' tópicos'}
                                  </button>
                                </div>
                              )}
                              {recall.pre === 'lido' && (
                                <section className="pretest" aria-labelledby="confira-titulo">
                                  <h3 id="confira-titulo">Confira o que você pensou</h3>
                                  <ol className="pretest-review" role="list">
                                    {pretest.map((card, n) => (
                                      <li key={n}>
                                        <strong>{card.question}</strong>
                                        <span>
                                          {recall.tries[n].trim()
                                            ? 'Você escreveu: ' + recall.tries[n].trim()
                                            : 'Você não escreveu nada.'}
                                        </span>
                                        <span>No material: {card.answer}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </section>
                              )}
                              <button
                                type="button"
                                // Com o "Tente responder antes de ler" aberto, o ciano fica no "Ler o resumo" dele.
                                className={recall.pre === 'aberto' && pretest.length > 0 ? undefined : 'primary'}
                                onClick={() => openPage('Flashcards', ['.flashcard', 'main h1'])}
                              >
                                Estudar flashcards deste resumo
                                <Icon name="seta" />
                              </button>
                            </>
                          )}
                          {/* Acima do baralho do material, a revisão do dia: os cartões que voltam hoje, de todos os
                              materiais (lib.js, dueCards). */}
                          {page === 'Flashcards' && !result.virtual && cardsDue.length > 0 && (
                            <div className="row day-review">
                              <button type="button" onClick={() => dayDeck()}>
                                <Icon name="flashcards" />
                                Revisão do dia ({cardsDue.length})
                              </button>
                            </div>
                          )}
                          {page === 'Flashcards' && (session.pos >= session.queue.length ? (
                            // Fim do baralho (Jhey): o painel sobe com um balanço curto e a caneta passa por cada cartão.
                            <m.div className="empty deck-done" variants={calm ? POP_CALM : FINALE} initial={appear()} animate="show">
                              <h2 tabIndex={-1}>Baralho concluído</h2>
                              <p>{deckSummary(session)}</p>
                              <DeckMarks session={session} finale />
                              {/* Recomeçar tira esta tela, com o botão: o foco vai para o primeiro cartão. Na revisão do
                                  dia com mais de 20 cartões para hoje, o principal é seguir para os próximos. */}
                              <div className="row center">
                                {result.virtual && cardsDue.length > 0 && (
                                  <button type="button" className="primary" onClick={() => dayDeck()}>
                                    Revisão do dia ({cardsDue.length})
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={result.virtual && cardsDue.length > 0 ? undefined : 'primary'}
                                  onClick={() => {
                                    setDeck(null);
                                    focusAfter.current = ['.flashcard'];
                                  }}
                                >
                                  Revisar novamente
                                </button>
                                {deckMissed(session).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeck(deckRedo(session));
                                      focusAfter.current = ['.flashcard'];
                                    }}
                                  >
                                    <Icon name="refazer" />
                                    Refazer só os que errei
                                  </button>
                                )}
                              </div>
                            </m.div>
                          ) : card && (
                            <>
                              {/* Na revisão do dia o "Acertei" sobe a caixa do cartão: só o aluno sabe se lembrou. */}
                              {result.virtual && (
                                <p className="hint day-note">
                                  A caixa sobe pelo seu Acertei. Marque só o que você lembrou de verdade.
                                </p>
                              )}
                              <div className="study-head">
                                <span>Cartão {session.pos + 1} de {session.queue.length}</span>
                                {/* Trocar de aba ou de página não recomeça o baralho: este botão recomeça. Antes do primeiro
                                    cartão avaliado ele guarda o lugar invisível, e aparecer não empurra o cartão. No
                                    "Refazer só os que errei" recomeça só esses (deckRestart). */}
                                <button
                                  type="button"
                                  className="link"
                                  aria-label="Recomeçar o baralho"
                                  style={{ visibility: session.pos ? undefined : 'hidden' }}
                                  onClick={() => {
                                    setDeck(deckRestart(session));
                                    freshCard();
                                    focusAfter.current = ['.flashcard'];
                                  }}
                                >
                                  Recomeçar
                                </button>
                                <span className="tag">{flip ? 'Resposta' : 'Pergunta'}</span>
                              </div>
                              <Meter value={session.pos} max={session.queue.length} label="Cartões avaliados" />
                              <DeckMarks session={session} fresh />
                              {/* Como no quiz do caderno; o leitor de tela ouve o material junto com o cartão. */}
                              {result.virtual && <p className="hint" id="do-material">Do material: {card.title}</p>}
                              {/* O bloco que a página mostra inteiro ao virar o cartão pelo teclado, se cabe (turnCard).
                                  O detail do clique conta os cliques: é 0 quando o cartão vira pelo Enter ou espaço. */}
                              <div className="card-block">
                                <button
                                  type="button"
                                  className={'flashcard' + (flip ? ' flipped' : '')}
                                  aria-describedby={result.virtual ? 'do-material' : undefined}
                                  onClick={e => turnCard(e.detail ? null : '.flashcard')}
                                >
                                  <span ref={cardText} className="face-text">{flip ? card.answer : card.question}</span>
                                  {/* A dica serve ao mouse, ao toque e ao teclado. */}
                                  <span className="face-hint">
                                    <Icon name="refazer" />
                                    {flip ? 'Mostrar a pergunta' : 'Mostrar a resposta'}
                                  </span>
                                </button>
                                {/* Escrever antes de ver a resposta deixa a autoavaliação mais honesta. Virado o
                                    cartão, o texto inteiro do aluno vem logo abaixo da resposta, com o lembrete: no
                                    campo de uma linha a resposta longa ficava cortada. */}
                                {wrote && (
                                  <div className="card-wrote">
                                    <p>Você escreveu: {typed}</p>
                                    <p id="lembrete-cartao" className="hint">{CARD_REMINDER}</p>
                                  </div>
                                )}
                                {/* O campo fica fora do cartão (botão não leva controle dentro) e vem logo depois dele
                                    no Tab. autoComplete off: o navegador não guarda o que o aluno escreve. */}
                                {write && (
                                  <form
                                    className="card-form"
                                    onSubmit={e => {
                                      e.preventDefault();
                                      // O Enter vira o cartão para a resposta, como o clique (o foco e a rolagem
                                      // depois: turnCard); virado, não volta.
                                      if (!flip) turnCard('#resposta-cartao');
                                    }}
                                  >
                                    <label htmlFor="resposta-cartao">Sua resposta (opcional)</label>
                                    <input
                                      id="resposta-cartao"
                                      value={typed}
                                      onChange={e => setTyped(e.target.value)}
                                      readOnly={locked}
                                      placeholder={locked && !typed ? 'Escreva no próximo cartão' : undefined}
                                      maxLength={500}
                                      autoComplete="off"
                                      aria-describedby={wrote ? 'lembrete-cartao' : undefined}
                                    />
                                  </form>
                                )}
                                <div className="row center verdicts">
                                  <button type="button" className="no" disabled={!flip} onClick={() => cardNext(false)}>
                                    <Icon name="fechar" />
                                    Errei
                                  </button>
                                  <button
                                    type="button"
                                    disabled={session.pos + 1 >= session.queue.length}
                                    onClick={() => {
                                      setDeck(deckLater(session));
                                      freshCard();
                                      cardMotion.current = 'translateX(12px)';
                                      toast('Cartão movido para o final do baralho');
                                    }}
                                  >
                                    <Icon name="refazer" />
                                    Revisar depois
                                  </button>
                                  <button
                                    type="button"
                                    className="primary"
                                    disabled={!flip}
                                    onClick={() => cardNext(true)}
                                  >
                                    <Icon name="check" />
                                    Acertei
                                  </button>
                                </div>
                              </div>
                              {/* Embaixo dos botões, fora do caminho do Tab entre o cartão, o campo e a avaliação. A
                                  escolha fica no navegador (lib.js, readWriteFirst). */}
                              <label className="write-first">
                                <input
                                  type="checkbox"
                                  id="escrever"
                                  checked={write}
                                  onChange={e => {
                                    setWrite(e.target.checked);
                                    persist('escrever', e.target.checked);
                                    // Ligada, o campo entra acima da caixa e a empurra para baixo: a página rola
                                    // até ela, que continua com o foco, acima da barra de baixo.
                                    focusAfter.current = ['#escrever', null, '#escrever'];
                                  }}
                                />
                                Escrever antes de virar
                              </label>
                            </>
                          ))}
                          {page === 'Quizzes' && (done ? (
                            // Fim do quiz (Jhey): o painel sobe com um balanço curto e a caneta marca cada erro, em fila.
                            <m.div className="empty quiz-done" variants={calm ? POP_CALM : FINALE} initial={appear()} animate="show">
                              <h2 tabIndex={-1}>{Math.round(right / Math.max(1, answers.length) * 100)}% de aproveitamento</h2>
                              <p>Você acertou {right} de {answers.length}.</p>
                              {guessLine(answers) && <p>{guessLine(answers)}</p>}
                              {/* O fim do simulado diz também o acerto por material, nas linhas do acerto por área do
                                  Desempenho. */}
                              {blind && (
                                <ul className="subjects" role="list" aria-label="Acerto por material">
                                  {examScore(answers).map(([title, ok, total]) => (
                                    <li className="subject" key={title}>
                                      <strong>{title}</strong> <span>{ok} de {total}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {/* Sem erro, a linha "Você acertou 6 de 6." de cima já diz tudo. */}
                              {wrong.length > 0 && (
                                <ol className="review" role="list">
                                  {wrong.map((q, i) => (
                                    <li key={i}>
                                      <Pen kind="errei" draw delay={0.3 + Math.min(i, 8) * 0.08} />
                                      <div>
                                        <strong>{q.question}</strong>
                                        {result.exam && <span>Do material: {q.title}</span>}
                                        {/* No simulado, que não tem retorno, é aqui que o erro com certeza aparece. */}
                                        <span>
                                          Sua resposta: {q.type === 'short' ? q.given : q.options[q.given]}
                                          {q.conf === 'certeza' && ' (você tinha certeza)'}
                                        </span>
                                        <span>Resposta certa: {expectedText(q)}</span>
                                        {q.explanation && <span>{q.explanation}</span>}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              )}
                              {/* O estudante novo descobre o caderno aqui. No quiz do próprio caderno já há "Voltar ao
                                  caderno". A frase só aparece enquanto vale: o fim do quiz continua na tela na volta de
                                  outra página, e o aluno pode ter tirado do caderno uma das questões. No simulado cada
                                  questão vai para o caderno com o material de onde veio (origin). */}
                              {wrong.length > 0 && (!result.virtual || result.exam) &&
                                wrong.every(q => mistakes.some(e => e.key === mistakeKey(origin(q).title, q.question))) && (
                                <p>
                                  {wrong.length === 1
                                    ? 'A questão que você errou está no caderno de erros. '
                                    : 'As ' + wrong.length + ' questões que você errou estão no caderno de erros. '}
                                  <button type="button" className="link" onClick={() => openPage('Erros')}>
                                    Abrir o caderno de erros
                                  </button>
                                </p>
                              )}
                              {/* Recomeçar tira esta tela, com o botão: o foco vai para a primeira questão. */}
                              <div className="row center">
                                {wrong.length > 0 && (
                                  <button
                                    type="button"
                                    className="primary"
                                    onClick={() => {
                                      restartQuiz(wrong);
                                      focusAfter.current = QUESTION_FOCUS;
                                    }}
                                  >
                                    <Icon name="refazer" />
                                    Refazer as que errei
                                  </button>
                                )}
                                {/* O simulado não repete o mesmo sorteio: um novo sai na Biblioteca, que este fim oferece. */}
                                {!result.exam && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      restartQuiz();
                                      focusAfter.current = QUESTION_FOCUS;
                                    }}
                                  >
                                    Refazer o quiz todo
                                  </button>
                                )}
                                {/* Outras questões do mesmo material, escritas pela IA: o quiz recomeça só com elas. Fora da
                                    demonstração e do material temporário (o caderno de erros, o simulado). No teto de 30
                                    questões o botão fica desligado e diz por quê; na espera, com o foco nele. */}
                                {API_BASE && !result.virtual && (
                                  <button
                                    type="button"
                                    id="questoes-novas"
                                    className="action"
                                    aria-disabled={waiting || result.quiz.length >= QUIZ_CAP || undefined}
                                    aria-busy={busy?.kind === 'questoes' || undefined}
                                    onClick={addQuestions}
                                  >
                                    Questões novas deste material
                                    <small>
                                      {result.quiz.length >= QUIZ_CAP ? 'este material já tem ' + QUIZ_CAP + ' questões' : askCost}
                                    </small>
                                  </button>
                                )}
                                {/* Sair do quiz por aqui devolve o material que estava aberto, como pelo menu. Como
                                    as opções, o "Voltar à Biblioteca" ignora o segundo clique de um clique duplo. */}
                                {result.exam ? (
                                  <button type="button" onClick={e => e.detail < 2 && openPage('Biblioteca')}>
                                    Voltar à Biblioteca
                                  </button>
                                ) : result.virtual ? (
                                  <button type="button" onClick={() => openPage('Erros')}>Voltar ao caderno</button>
                                ) : (
                                  <button type="button" onClick={() => openPage('Flashcards', ['.flashcard', 'main h1'])}>
                                    Ir para os flashcards
                                  </button>
                                )}
                              </div>
                              {/* A espera das questões novas e o erro dela ficam embaixo do botão, no lugar do pedido. */}
                              {busy?.kind === 'questoes' && busy.of === result && (
                                <div className="quiz-wait">
                                  <Wait label={busy.label} since={busy.since} onCancel={cancelAI} />
                                </div>
                              )}
                              {extra?.error && extra.of === result && (
                                <div id="erro-questoes" role="alert" className="error"><Problem error={extra.error} /></div>
                              )}
                            </m.div>
                          ) : quiz && (
                            <>
                              <div className="study-head">
                                <span>Questão {idx + 1} de {quizList.length}</span>
                                {/* Como no baralho. No "Refazer as que errei" recomeça só as erradas (retry). O foco vai
                                    para a primeira questão como no "Refazer o quiz todo" (QUESTION_FOCUS). */}
                                <button
                                  type="button"
                                  className="link"
                                  aria-label="Recomeçar o quiz"
                                  style={{ visibility: answers.length ? undefined : 'hidden' }}
                                  onClick={() => {
                                    restartQuiz(retry);
                                    focusAfter.current = QUESTION_FOCUS;
                                  }}
                                >
                                  Recomeçar
                                </button>
                                {/* A etiqueta do tipo e a caixa "Marcar certeza" (#80) andam juntas: no celular, na linha
                                    de baixo do cabeçalho (mobile.css). */}
                                <div className="quiz-tools">
                                  <span className="tag">
                                    {quiz.type === 'short' ? 'Resposta curta'
                                      : quiz.type === 'boolean' ? 'Verdadeiro ou falso'
                                      : 'Múltipla escolha'}
                                  </span>
                                  <label className="inline-field check">
                                    <input
                                      type="checkbox"
                                      checked={sure}
                                      onChange={e => {
                                        setSure(e.target.checked);
                                        setChoice(null);
                                        persist('certeza', e.target.checked);
                                        say(e.target.checked ? 'Antes da correção, marque quanta certeza você tem.'
                                          : 'A resposta vai direto para a correção.');
                                      }}
                                    />
                                    Marcar certeza
                                  </label>
                                </div>
                              </div>
                              <Meter value={answers.length} max={quizList.length} label="Questões respondidas" />
                              {/* As marcas ✓ e ✗ seriam correção: no simulado ficam só o fio e o "Questão X de Y". */}
                              {!blind && <QuizMarks total={quizList.length} answers={answers} idx={idx} />}
                              {result.virtual && <p className="hint">Do material: {quiz.title}</p>}
                              {extra?.resumo && retry === extra.list && <p className="hint">Questões feitas a partir do resumo.</p>}
                              {/* O enunciado dá a descrição da caixa da resposta e o nome do grupo das alternativas: o
                                  leitor de tela lê a pergunta junto com elas. */}
                              <h2 id={'questao-' + idx} className="quiz-question" tabIndex={-1}>{quiz.question}</h2>
                              {quiz.type === 'short' ? (
                                // Questão nova ou recomeçada: o campo abre vazio. Respondida, ele mostra o que o aluno
                                // escreveu, também na volta de outra aba ou página.
                                <form
                                  key={idx + '-' + answers.length}
                                  id="resposta"
                                  className="quiz-form"
                                  onSubmit={e => {
                                    e.preventDefault();
                                    const field = e.target.elements.response;
                                    if (!filled(field)) return;
                                    // Com as marcas, o Enter não escolhe a certeza pelo aluno: o foco vai ao grupo dos
                                    // botões, e não ao primeiro, que o Enter seguinte (ou a tecla segurada) apertaria.
                                    if (sure) document.querySelector('.sure-row').focus();
                                    else submit(field.value);
                                  }}
                                >
                                  <input
                                    name="response"
                                    aria-label="Sua resposta"
                                    aria-describedby={'questao-' + idx}
                                    required
                                    maxLength={500}
                                    placeholder="Sua resposta"
                                    defaultValue={answer?.value}
                                    disabled={answer !== null}
                                  />
                                  {/* Com as marcas, os botões da certeza, embaixo, ficam no lugar do "Responder". */}
                                  {!sure && <button disabled={answer !== null} className="primary">Responder</button>}
                                </form>
                              ) : (
                                <div className="options" role="group" aria-labelledby={'questao-' + idx}>
                                  {quiz.options.map((o, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      disabled={answer !== null}
                                      // Com as marcas, a opção só é escolhida: quem a manda à correção é a certeza.
                                      aria-pressed={sure && !answer ? choice === i : undefined}
                                      className={'option' + (!answer && choice === i ? ' chosen'
                                        : blind ? (answer?.value === i ? ' chosen' : '')
                                        : answer && i === quiz.answer ? ' correct' : answer?.value === i ? ' wrong' : '')}
                                      // O segundo clique de um clique duplo no botão que estava aqui ("Próxima
                                      // questão", "Começar simulado") não responde: detail conta os cliques.
                                      onClick={e => e.detail < 2 && (sure ? setChoice(i) : submit(i))}
                                    >
                                      <span className="letter">{String.fromCharCode(65 + i)}</span>
                                      <span className="option-text">{o}</span>
                                      {/* Certo e errado também em texto: a cor sozinha não serve a quem não a distingue. */}
                                      {!blind && answer && i === quiz.answer && <Pen kind="certo" note="certa" draw />}
                                      {!blind && answer?.value === i && i !== quiz.answer && <Pen kind="errei" note="sua resposta" draw />}
                                      {/* No simulado a escolhida fica marcada, em texto também, sem dizer se acertou. Com as
                                          marcas, também a que espera a certeza. */}
                                      {((blind && answer?.value === i) || (!answer && choice === i)) && (
                                        <span className="pen pen--escolha"><span className="pen-note">sua resposta</span></span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Com as marcas, a certeza manda a resposta à correção. Os botões ficam fora do formulário
                                  da resposta curta, para o celular os prender acima da barra de baixo (mobile.css), e
                                  chegam ao campo pelo atributo form. */}
                              {sure && !answer && (
                                <Sureness
                                  ready={quiz.type === 'short' || choice !== null}
                                  form={quiz.type === 'short' ? 'resposta' : undefined}
                                  onPick={(conf, button) => {
                                    if (quiz.type === 'short') {
                                      const field = button.form.elements.response;
                                      if (filled(field)) submit(field.value, conf);
                                    } else if (choice === null) say('Escolha uma opção antes de marcar a certeza.');
                                    else submit(choice, conf);
                                  }}
                                />
                              )}
                              {/* No simulado não há retorno: depois da resposta, só o botão de seguir (submit leva o foco
                                  a ele). A correção, a explicação e os pedidos à IA ficam para o fim e para o "Refazer as
                                  que errei". */}
                              {/* Os dois "Próxima questão" ignoram o segundo clique de um clique duplo: no celular o botão
                                  da certeza que mandou a resposta estava no mesmo lugar. */}
                              {answer && blind && (
                                <div className="row exam-next">
                                  <button type="button" className="primary" onClick={e => e.detail < 2 && nextQuestion()}>
                                    {idx + 1 === quizList.length ? 'Ver resultado' : 'Próxima questão'}
                                    <Icon name="seta" />
                                  </button>
                                </div>
                              )}
                              {/* O retorno entra em 0,35 s e sai na hora, junto com a questão: o aluno passa de questão a
                                  cada uma (com saída, ele pulava 132 px e ficava legível embaixo da questão nova). */}
                              {answer && !blind && (
                                <m.div
                                  key={'retorno-' + idx}
                                  className={'feedback ' + (answer.ok ? 'good' : 'bad')}
                                  role="status"
                                  variants={pop}
                                  initial={appear()}
                                  animate="show"
                                >
                                  <strong
                                    id="retorno"
                                    tabIndex={-1}
                                    aria-describedby={!answer.ok && answer.conf === 'certeza' ? 'certeza-errada' : undefined}
                                  >
                                    {answer.ok ? 'Acertou' : 'Errou'}
                                  </strong>
                                  {/* Errou com "Tenho certeza" (#80): o aviso vem antes de tudo, e o leitor de tela o ouve
                                      junto com o título, que recebe o foco. */}
                                  {!answer.ok && answer.conf === 'certeza' && (
                                    <p id="certeza-errada" className="sure-miss">
                                      <Icon name="alerta" />
                                      Você tinha certeza. Leia a explicação com atenção.
                                    </p>
                                  )}
                                  {/* Errou a opção: a marcada e a certa também em texto, como no fim do quiz. No celular
                                      deitado as marcas delas, nas opções, podiam ficar fora da vista. */}
                                  {quiz.type !== 'short' && !answer.ok && (
                                    <>
                                      <p className="answer-line">Sua resposta: {quiz.options[answer.value]}</p>
                                      <p className="answer-line">Resposta certa: {expectedText(quiz)}</p>
                                    </>
                                  )}
                                  {quiz.type === 'short' && (
                                    <p className="answer-line">
                                      Resposta esperada: {expectedText(quiz)} <Pen kind="certo" note="certa" draw />
                                    </p>
                                  )}
                                  {quiz.type === 'short' && !answer.ok && (
                                    <p className="answer-line">
                                      Você respondeu: {answer.value} <Pen kind="errei" note="sua resposta" draw delay={0.2} />
                                    </p>
                                  )}
                                  <p>{quiz.explanation}</p>
                                  {quiz.steps?.length > 0 && <ol>{quiz.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                                  {/* A revisão pedida espera no lugar onde o veredito vai entrar. */}
                                  {busy?.kind === 'review' && busy.answer === answer && (
                                    <div className="review-wait">
                                      <Sk className="sk-read" />
                                      <Sk w="72%" className="sk-read" />
                                      <Wait label={busy.label} since={busy.since} onCancel={cancelAI} />
                                    </div>
                                  )}
                                  {answer.review?.verdict && (
                                    <m.div variants={focusIn} initial={appear()} animate="show">
                                      <p><strong>Revisão da IA: {answer.review.verdict}</strong></p>
                                      <p>{answer.review.feedback}</p>
                                      <p>
                                        {VERDICT_EFFECT[answer.review.verdict === 'correta' && answer.conf === 'chute' &&
                                          answer.before ? 'chute' : answer.review.verdict]}
                                      </p>
                                      <p className="hint">Revisão feita por IA: pode errar.</p>
                                    </m.div>
                                  )}
                                  {answer.review?.error && <div role="alert" className="error"><Problem error={answer.review.error} /></div>}
                                  {API_BASE && (
                                    <div className="ai-ask">
                                      <button
                                        type="button"
                                        id="explicar-questao"
                                        aria-disabled={waiting || undefined}
                                        onClick={() => explain(quiz, whyQuestion(quiz, answer.value, answer.ok), quiz.explanation, '#explicar-questao')}
                                      >
                                        Não entendi, me explique <small>{askCost}</small>
                                      </button>
                                      {/* Só a resposta curta é comparada por texto. Uma revisão por resposta: com o */}
                                      {/* veredito o botão fica desabilitado (se sumisse, o foco do teclado se perdia). */}
                                      {quiz.type === 'short' && answer.value.trim() && (!answer.ok || answer.review?.verdict) && (
                                        <button
                                          type="button"
                                          id="pedir-revisao"
                                          aria-disabled={waiting || !!answer.review?.verdict || undefined}
                                          aria-busy={busy?.kind === 'review' || undefined}
                                          onClick={review}
                                        >
                                          Pedir revisão da IA <small>{askCost}</small>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {/* No celular o botão fica preso acima da barra de baixo: o retorno pode ser longo. */}
                                  <div className="next-row">
                                    <button type="button" className="primary" onClick={e => e.detail < 2 && nextQuestion()}>
                                      {idx + 1 === quizList.length ? 'Ver resultado' : 'Próxima questão'}
                                      <Icon name="seta" />
                                    </button>
                                  </div>
                                </m.div>
                              )}
                              {why?.item === quiz && <Why {...why} wait={busy} onCancel={cancelAI} pop={pop} focusIn={focusIn} />}
                            </>
                          ))}
                        </div>
                      </m.section>
                    )}
                  </AnimatePresence>
                </m.div>
              )}
              {page === 'Dúvidas' && (
                // Sem mensagens, o herói (#57): o título, a saudação e a caixa no meio do palco, com a lua atrás. Com
                // mensagens, o mesmo título encolhe no alto, a conversa ocupa a coluna e a caixa fica presa embaixo.
                // A caixa é o mesmo elemento nos dois estados: o foco continua nela quando a primeira pergunta sai.
                // No teto do dia (data-teto) ela não fica presa embaixo (styles.css).
                <section
                  className="chat-stage"
                  data-state={chat.length ? 'conversa' : 'heroi'}
                  data-teto={capped ? '' : undefined}
                >
                  <span className="moon" aria-hidden="true"></span>
                  <div className="chat-head">
                    {/* O fio embaixo do título tem a largura dele: os dois ficam numa caixa da largura do título. */}
                    <div className="chat-title-box">
                      <m.h1 id="chat-titulo" className="chat-title" tabIndex={-1} variants={hero.title}>
                        Dúvidas
                      </m.h1>
                      {!chat.length && <m.span className="chat-rule" aria-hidden="true" variants={hero.rule}></m.span>}
                    </div>
                    {chat.length ? (
                      <button
                        type="button"
                        disabled={asking}
                        onClick={() => {
                          // Limpa na hora, sem perguntar, e deixa desfazer, como as outras ações: as respostas custaram
                          // chamadas de IA.
                          const before = { chat, tips };
                          setChat([]);
                          setTips({ key: '', list: [] });
                          // O botão sai com o cabeçalho compacto: o foco vai para o Desfazer que fica embaixo da
                          // saudação. Desfeito, ele vai para a caixa (no toque, para o título, sem abrir o teclado).
                          focusAfter.current = ['.chat-head .undo-row button', ...ASK_FOCUS];
                          // A pergunta nova encerra o Desfazer (ask); se ainda assim ele chegar aqui, a conversa nova fica.
                          offerUndo('conversa', 'Conversa apagada', () => {
                            setChat(c => (c.length ? c : before.chat));
                            setTips(t => (t.key ? t : before.tips));
                          }, ASK_FOCUS);
                        }}
                      >
                        Nova conversa
                      </button>
                    ) : (
                      <>
                        <m.p className="chat-lead" variants={hero.lead}>{greeting}</m.p>
                        <AnimatePresence mode="popLayout" custom={byKeyboard()}>
                          {undo?.kind === 'conversa' && <UndoRow key="desfazer" undo={undo} onUndo={undoNow} pop={pop} />}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                  <div className="chat-thread">
                    {/* A saudação volta como a primeira mensagem, fora do log: ela não é lida de novo quando a conversa
                        começa (no herói ela já estava na tela, embaixo do título). */}
                    {chat.length > 0 && (
                      <div className="message assistant">
                        <small>Cérebro</small>
                        <p>{greeting}</p>
                      </div>
                    )}
                    <div className="chat" role="log" aria-live="polite">
                      <ChatLog chat={chat} pop={pop} />
                    </div>
                  </div>
                  {/* Uma só rolagem, a da página: com mensagens a caixa fica presa embaixo (acima da barra, no celular). */}
                  <div className="chat-dock">
                    {API_BASE && (
                      <>
                        {/* O filtro do vidro dos chips (#110, do Liquid Glass Button do 21st.dev): um ruído que distorce e
                            desfoca o fundo atrás de cada chip (styles.css, .suggestions button::before). Um só para todos
                            os chips, fora da vista e do leitor de tela. */}
                        <svg className="glass-filter" aria-hidden="true" focusable="false">
                          <filter id="vidro-liquido" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="ruido" />
                            <feGaussianBlur in="ruido" stdDeviation="2" result="ruido-suave" />
                            <feDisplacementMap in="SourceGraphic" in2="ruido-suave" scale="70" xChannelSelector="R" yChannelSelector="B" result="distorcido" />
                            <feGaussianBlur in="distorcido" stdDeviation="4" />
                          </filter>
                        </svg>
                        {/* Os chips ficam acima da caixa (#109), também antes dela no Tab. Durante a espera da resposta eles
                            somem (data-espera): a pílula de espera fica no lugar deles, e os chips da resposta nova chegam
                            com ela. Com a lista do "/" aberta eles também somem (styles.css). */}
                        <m.div
                          ref={chipsRow}
                          className="suggestions"
                          role="group"
                          aria-label="Sugestões de perguntas"
                          data-espera={asking ? '' : undefined}
                          variants={hero.chips}
                        >
                          {chatHints.map((h, i) => (
                            <m.button
                              key={i}
                              type="button"
                              variants={hero.chip}
                              disabled={waiting}
                              onKeyUp={e => {
                                // O Tab que chega ao chip, na linha que rola de lado (mobile.css), rola a linha até ele:
                                // o navegador sozinho não rola um chip que já aparece em parte. Com folga, o chip fica
                                // inteiro junto da borda (o scroll-padding deixa um pedaço do vizinho); sem folga, no meio
                                // da linha; mais largo que ela, com o começo à vista. Só no Tab: o clique não move o chip
                                // entre apertar e soltar, e a volta para a aba, que dá o foco de novo ao chip, não rola nada.
                                const chip = e.currentTarget;
                                const row = chip.parentElement;
                                if (e.key !== 'Tab' || row.scrollWidth <= row.clientWidth) return;
                                const room = row.clientWidth - chip.offsetWidth;
                                const pad = 2 * (parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0);
                                chip.scrollIntoView({ block: 'nearest', inline: room < 0 ? 'start' : room < pad ? 'center' : 'nearest' });
                              }}
                              onClick={() => {
                                // O chip some durante a espera, e o foco iria para o body: vai para a caixa. No toque vai
                                // para o título, sem rolar a página: o teclado da tela não abre sozinho, e o leitor de
                                // tela não fica num chip escondido.
                                if (TOUCH) document.getElementById('chat-titulo').focus({ preventScroll: true });
                                else document.getElementById('pergunta').focus();
                                ask(h);
                              }}
                            >
                              {h}
                            </m.button>
                          ))}
                        </m.div>
                      </>
                    )}
                    <ChatComposer
                      value={question}
                      onChange={setQuestion}
                      onSend={() => ask()}
                      hints={chatHints}
                      area={area}
                      onArea={setArea}
                      level={level}
                      onLevel={setLevel}
                      about={subject.title ? subject : null}
                      swap={subject.swap}
                      onSwap={() => setEditorChat(e => !e)}
                      waiting={waiting}
                      touch={TOUCH}
                      cost={cost}
                      reason={capNote ? 'aviso-teto' : undefined}
                      variants={hero.box}
                      pop={pop}
                      note={aiNote}
                      status={
                        // A pílula da espera, logo acima da caixa: o orbe, o que acontece, os segundos e o Cancelar.
                        // O role status fica sempre na página, para a pílula que entra ser anunciada.
                        <div className="chat-status" role="status">
                          <AnimatePresence custom={byKeyboard()}>
                            {asking && (
                              <m.div key="espera" className="chat-wait" variants={pop} initial={appear()} animate="show" exit="exit">
                                <Wait label="Cérebro está escrevendo…" orb="composing" since={asking} onCancel={cancelAI} />
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      }
                    />
                    {errorBanner}
                    {/* No teto do dia o Enviar e os chips ficam desligados: o motivo fica embaixo da caixa. */}
                    {capNote && (
                      <p className="note" id="aviso-teto">
                        <Icon name="info" />
                        {ERRORS.AI_BUDGET_REACHED}
                      </p>
                    )}
                  </div>
                  <div ref={chatEnd} className="chat-end"></div>
                </section>
              )}
              {page === 'Erros' && (
                <m.section className="panel" variants={rise}>
                  {mistakes.length > 0 && (
                    <div className="erros-head">
                      {/* A regra numa linha só dela, e a escada e os botões embaixo. As de hoje vêm no máximo 10 por
                          vez, as mais atrasadas primeiro (lib.js, dayMistakes). Sem nenhuma para hoje, a frase diz
                          quando volta a próxima, e treinar todas vira o principal: o acerto antes do dia marcado não
                          sobe degrau. */}
                      <div className="erros-rule">
                        <p className="hint">
                          A questão sai daqui depois de 3 acertos em dias diferentes, cada um no dia marcado. Se errar,
                          ela volta ao começo. O acerto marcado como chute não conta.
                        </p>
                        {!mistakesDue.length && (
                          <p className="erros-next">
                            {'Nenhuma para hoje. A próxima ' + backOn(mistakes.map(dueOf).sort()[0], today) + '.'}
                          </p>
                        )}
                      </div>
                      {/* As marcas são as da lista abaixo, na ordem do caminho, e o ✓ é a saída. A seta, como elas,
                          fica fora do leitor de tela: ele lê os passos da lista em ordem. */}
                      <ol className="ladder" role="list" aria-label="Caminho de uma questão no caderno">
                        <li><Pen kind="errei" /> errei: volta amanhã</li>
                        <li><Icon name="seta" /><Pen kind="refazer" /> para hoje</li>
                        <li><Icon name="seta" /><Pen kind="novo" /> acertei: volta em 3 e 7 dias</li>
                        <li><Icon name="seta" /><Pen kind="certo" /> 3 acertos: sai do caderno</li>
                      </ol>
                      <div className="erros-actions">
                        {mistakesDue.length > 0 && (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => redoMistakes(dayMistakes(mistakesDue))}
                          >
                            <Icon name="refazer" />
                            Refazer os de hoje ({mistakesDue.length})
                          </button>
                        )}
                        <button
                          type="button"
                          className={mistakesDue.length ? undefined : 'primary'}
                          onClick={() => redoMistakes(mistakes)}
                        >
                          Treinar todas ({mistakes.length})
                        </button>
                      </div>
                    </div>
                  )}
                  {/* popLayout: a linha que sai deixa o fluxo na hora, e a lista sobe junto (undoNow, flipList). Fora da
                      condição da lista, como na Biblioteca: tirar a última questão não leva o Desfazer junto. */}
                  <AnimatePresence mode="popLayout" custom={byKeyboard()}>
                    {undo?.kind === 'erro' && <UndoRow key="desfazer" undo={undo} onUndo={undoNow} pop={pop} />}
                  </AnimatePresence>
                  {mistakes.length === 0 ? (
                    <div className="empty">
                      <h2>Nenhuma questão para rever</h2>
                      <p className="hint">As que você errar nos quizzes aparecem aqui.</p>
                      <button type="button" className="primary" onClick={() => openPage(result ? 'Quizzes' : 'Estudar')}>
                        {result ? 'Fazer o quiz do material aberto' : 'Gerar um material'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* data-flip: os blocos que deslizam para fechar o vão de uma questão tirada (anim.js, leave). */}
                      {byMaterial(mistakes).map(([title, list]) => (
                        <section className="mistakes" key={title}>
                          <h2 data-flip>{title}</h2>
                          {/* role="list": sem ele, uma lista sem marcadores deixa de ser lida como lista no Safari. */}
                          <ul role="list">
                            {list.map((m, i) => {
                              // Para hoje (ou atrasada): ↻, já dá para refazer e subir um degrau. Esperando o dia
                              // marcado: ✗ no degrau 0 (errou e volta amanhã), ○ depois de um acerto. A nota diz quando
                              // ela volta, e embaixo vão os acertos.
                              const due = dueOf(m);
                              return (
                                <li key={m.key} data-key={m.key} data-flip>
                                  <span className="mistake-when">
                                    {/* Só a marca de um erro novo desde a última visita se desenha (penned), depois
                                        que a página assenta (~0,35 s); as outras o aluno já viu e aparecem prontas. */}
                                    <Pen
                                      kind={due <= today ? 'refazer' : stepOf(m) ? 'novo' : 'errei'}
                                      note={backOn(due, today)}
                                      draw={!penned.has(m.key + m.date)}
                                      delay={0.3 + Math.min(i, 6) * 0.06}
                                    />
                                    <small>{stepOf(m)} de 3 acertos</small>
                                    {/* O último erro foi com "Tenho certeza" (#80). Só true vale: a marca vem do navegador. */}
                                    {m.sure === true && <small className="sure-note">você tinha certeza</small>}
                                  </span>
                                  <strong>{m.item.question}</strong>
                                  <details>
                                    <summary>
                                      <Icon name="abaixo" />
                                      Ver resposta
                                    </summary>
                                    <p>Resposta certa: {expectedText(m.item)}</p>
                                    {m.item.explanation && <p>{m.item.explanation}</p>}
                                  </details>
                                  <button
                                    type="button"
                                    className="drop"
                                    aria-label={'Tirar do caderno: ' + m.item.question}
                                    onClick={e => leave(e.currentTarget.closest('li'), () => drop(m))}
                                  >
                                    {/* Em 380 px ou menos fica a palavra curta: a nota "volta em 23/11" não cabia ao
                                        lado do nome inteiro, que continua no aria-label (mobile.css). */}
                                    <span className="full">Tirar do caderno</span>
                                    <span className="short" aria-hidden="true">Tirar</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ))}
                    </>
                  )}
                </m.section>
              )}
              {/* Desempenho e Biblioteca chegam à parte (lazyView): enquanto o código não vem, o esqueleto delas
                  segura o lugar e entra junto com a página. */}
              {page === 'Desempenho' && (
                <Suspense fallback={<DesempenhoSkeleton rise={rise} />}>
                  <Desempenho
                    rise={rise}
                    fade={fade}
                    streakDays={streakDays}
                    quizzes={quizzes}
                    cards={cards}
                    percent={percent}
                    chartArea={chartArea}
                    setChartArea={chooseChartArea}
                    days={days}
                    busiest={busiest}
                    weakest={weakest}
                    openWeak={weakMaterial && (() => {
                      if (weakMaterial !== opened) return openSaved(weakMaterial);
                      // O material já está aberto: nada vai para a biblioteca, e o quiz e o baralho ficam onde estavam.
                      // Como no openSaved, o chat volta ao material, e o foco vai ao título dele (o botão sai da tela com
                      // o Desempenho).
                      setEditorChat(false);
                      go('Resumos');
                      focusAfter.current = ['#material-titulo'];
                    })}
                    hasMaterial={!!result}
                    onStart={() => openPage(result ? 'Quizzes' : 'Estudar')}
                    mistakes={mistakes}
                    due={mistakesDue}
                    redoMistakes={redoMistakes}
                    plan={plan}
                    onPlan={openTask}
                    events={events}
                    backup={backupLine}
                    onExport={exportBackup}
                  />
                </Suspense>
              )}
              {page === 'Biblioteca' && (
                <Suspense fallback={<BibliotecaSkeleton rise={rise} />}>
                  <Biblioteca
                    fade={fade}
                    pop={pop}
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    shown={shown}
                    saved={saved}
                    undo={undo}
                    onUndo={undoNow}
                    backup={backupLine}
                    onExport={exportBackup}
                    onImport={importBackup}
                    onOpen={openSaved}
                    onShare={openShare}
                    onRemove={(material, item) => leave(item, () => remove(material))}
                    onStart={() => openPage('Estudar')}
                    exam={examLine(examFrom, examSize)}
                    examSize={examSize}
                    onExamSize={chooseExamSize}
                    onExam={startExam}
                  />
                </Suspense>
              )}
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      <nav className="tabbar" aria-label="Seções">
        {BAR.map(s => navButton(s, 'tab-item', true))}
        {MORE.map(s => navButton(s, 'tab-item tab-extra', true))}
        {/* Com a página aberta dentro da folha, "Mais" fica marcado como ela (data-current, a pílula ciano). */}
        <button
          type="button"
          className="tab-item"
          data-tab={inMore ? slug : 'mais'}
          data-current={inMore || undefined}
          aria-haspopup="dialog"
          aria-expanded={more}
          aria-label={inMore ? 'Mais, você está em ' + page : undefined}
          onClick={() => setMore(true)}
        >
          <Icon name="mais" />
          <span>Mais</span>
        </button>
      </nav>
      {/* Espera de um pedido à IA longe do lugar da resposta (o aluno saiu da página dela): a faixa de cima, com o fio,
          os segundos e o Cancelar, no lugar do atalho do Dúvidas; o atalho sai e o estado da IA esmaece enquanto ela
          está lá (styles.css). Com a espera no lugar da resposta (waitInline) a faixa não existe, e sai na hora quando
          a espera volta para lá. Ela nasce com o texto e não seria lida: quem anuncia é a região fixa (#anuncio). */}
      <AnimatePresence custom={byKeyboard() || waitInline}>
        {band && (
          <m.div key="espera" className="busy" variants={pop} initial={appear()} animate="show" exit="exit">
            <Wait label={busy.label} since={busy.since} onCancel={API_BASE ? cancelAI : null} />
          </m.div>
        )}
      </AnimatePresence>
      <div className="toast-region" role="status">
        {/* Um aviso por vez: o novo entra enquanto o anterior esmaece fora do fluxo (popLayout). O mesmo texto outra vez
            (o cartão movido de novo) só renova o tempo, sem piscar. */}
        {/* anchorY bottom: a faixa fica presa embaixo, e o aviso que sai continua no mesmo lugar (com top ele pulava). */}
        {/* O mouse em cima, o dedo parado e o foco do teclado seguram o aviso; quando saem, ele fica pelo menos mais 4 s. São os
            eventos de ponteiro: os de mouse, que o toque imita, não avisavam a saída do dedo, e o aviso ficava preso. */}
        <AnimatePresence mode="popLayout" anchorY="bottom" custom={byKeyboard()}>
          {notice && (
            <m.div
              key={notice.text}
              className="toast"
              variants={pop}
              initial={appear()}
              animate="show"
              exit="exit"
              onPointerEnter={holdNotice}
              onPointerLeave={releaseNotice}
              onFocus={holdNotice}
              onBlur={releaseNotice}
            >
                <span>{notice.text}</span>
                {notice.action && (
                  <button
                    type="button"
                    onClick={() => {
                      clearTimeout(noticeTimer.current);
                      setNotice(null);
                      notice.action.run();
                    }}
                  >
                    {notice.action.label}
                  </button>
                )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {/* Região fixa só para o leitor de tela, fora do main: uma região que nasce junto com o texto (a página que abre, a
          espera) não é lida, e o main troca a cada página. */}
      <p id="anuncio" className="sr-only" role="status">{spoken}</p>
      <AnimatePresence>
        {more && (
          <Modal
            key="mais"
            className="sheet"
            sheet
            labelledBy="mais-titulo"
            back=".rail [aria-current=page], .tabbar [aria-current=page]"
            onClose={() => setMore(false)}
          >
            <div className="dialog-body">
              <div className="sheet-head">
                <h2 id="mais-titulo">Mais seções</h2>
                <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setMore(false)}>
                  <Icon name="fechar" />
                </button>
              </div>
              <nav aria-label="Mais seções" className="sheet-nav">
                {MORE.map(s => navButton(s, 'nav-item'))}
              </nav>
              {profileButton(() => {
                setMore(false);
                setLogin(true);
              })}
              {fundoShown && (
                <>
                  <button ref={fundoRef} type="button" className="chip" aria-pressed={fundo} onClick={toggleFundo}>
                    <Icon name={fundo ? 'pausar' : 'tocar'} />
                    Fundo animado
                  </button>
                  {/* A gravação falhou: o aviso da tela (persist) sai atrás desta folha, na parte inerte da página, e
                      o leitor de tela não o lê. Este fica aqui dentro; a região já existe vazia, para o texto ser lido. */}
                  <p role="status">
                    {fundoUnsaved && 'Não foi possível salvar no navegador. A escolha vale só até recarregar a página.'}
                  </p>
                </>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* Escolha de páginas do PDF com mais texto que o editor recebe (openFile). As duas listas não deixam o
          intervalo ao contrário: a outra ponta acompanha. A contagem é lida a cada mudança: a região fica dentro da
          janela, porque com ela aberta o resto da página, o #anuncio também, fica inerte. */}
      <AnimatePresence
        onExitComplete={() => {
          pickDone.current?.();
          pickDone.current = null;
        }}
      >
        {pick && (
          <Modal
            key="paginas"
            className="pages-dialog"
            labelledBy="paginas-titulo"
            describedBy="paginas-texto"
            back="#abrir-arquivo"
            onClose={() => setPick(null)}
          >
            <div className="dialog-body">
              <h2 id="paginas-titulo">Escolha as páginas</h2>
              <p id="paginas-texto">
                {'"' + pick.name + '" tem ' + pick.pages.length + ' páginas e ' + pick.total.toLocaleString('pt-BR') +
                  ' caracteres. O editor recebe até 20.000: escolha as páginas que vão para ele.'}
              </p>
              <div className="page-range">
                <label>
                  Da página
                  <select
                    value={pick.from}
                    onChange={e => {
                      const from = Number(e.target.value);
                      setPick(p => ({ ...p, from, to: Math.max(p.to, from) }));
                    }}
                  >
                    {pick.pages.map((_, i) => <option key={i}>{i + 1}</option>)}
                  </select>
                </label>
                <label>
                  Até a página
                  <select
                    value={pick.to}
                    onChange={e => {
                      const to = Number(e.target.value);
                      setPick(p => ({ ...p, to, from: Math.min(p.from, to) }));
                    }}
                  >
                    {pick.pages.map((_, i) => <option key={i}>{i + 1}</option>)}
                  </select>
                </label>
              </div>
              <p id="paginas-contagem" className="page-count" role="status" data-over={over || undefined}>
                {picked.length.toLocaleString('pt-BR') + ' de 20.000 caracteres' + (!over ? ''
                  : pick.from === pick.to ? ': a página entra cortada no limite'
                  : ': passa do limite. Escolha menos páginas.')}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={over && pick.from !== pick.to}
                  aria-describedby="paginas-contagem"
                  onClick={takePages}
                >
                  Usar estas páginas
                </button>
                <button type="button" onClick={() => setPick(null)}>Cancelar</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* O formulário da janela do perfil chega à parte (Perfil.jsx). A janela abre na hora, com o Fechar, o título e o
          texto; enquanto o código não vem, o esqueleto do formulário fica no tamanho dele e a janela não muda. */}
      <AnimatePresence>
        {login && (
          <Modal
            key="perfil"
            className="profile-dialog"
            labelledBy="profile-title"
            back=".tabbar [aria-haspopup=dialog], .topbar .profile"
            onClose={() => setLogin(false)}
          >
            <div className="dialog-body">
              <button type="button" className="icon-button close" aria-label="Fechar" onClick={() => setLogin(false)}>
                <Icon name="fechar" />
              </button>
              <BrandMark />
              <h2 id="profile-title">{user ? 'Seu perfil' : 'Seu próximo aprendizado começa aqui'}</h2>
              <p>
                {user
                  ? 'Seu nome e sua área principal ficam só neste navegador. Não é uma conta com senha.'
                  : 'Crie um perfil local neste navegador. Não é uma conta com autenticação.'}
              </p>
              {/* A lista começa na área do perfil, não na do editor: salvar só o nome não troca a área principal. */}
              <Suspense fallback={<PerfilSkeleton />}>
                <Perfil
                  name={name}
                  setName={setName}
                  area={AREAS.includes(user?.area) ? user.area : area}
                  fresh={!user}
                  onSave={saveProfile}
                />
              </Suspense>
              {/* A dica do estado da IA (title) só aparece com o mouse em cima: aqui o teclado e o toque chegam a ela. */}
              {status.note && <p className="hint">{status.note}</p>}
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* "Ver no texto": o texto inteiro do material, com o trecho do tópico marcado. Só o texto rola, e ele abre no
          trecho: o foco vai para a marca (focusAfter, no clique), e o navegador a traz à vista. Sem o trecho no texto,
          a janela diz isso e abre no começo. O título diz de onde o texto veio (lib.js, textOrigin). */}
      <AnimatePresence>
        {passage && (
          <Modal
            key="texto"
            className="source-dialog"
            labelledBy="texto-titulo"
            describedBy="texto-nota"
            back="main h1"
            onClose={() => setPassage(null)}
          >
            <div className="dialog-body">
              <button type="button" className="icon-button close" aria-label="Fechar" onClick={() => setPassage(null)}>
                <Icon name="fechar" />
              </button>
              <h2 id="texto-titulo">
                {passage.origin === 'ia' ? 'Exemplo escrito pela IA' : passage.origin === 'pronto' ? 'Texto de exemplo' : 'Seu texto'}
              </h2>
              <p id="texto-nota">
                {passage.range
                  ? 'O trecho do tópico "' + passage.concept + '" está marcado.'
                  : 'Não achei este trecho exato no texto.'}
              </p>
              <div className="source-text" tabIndex={0} role="region" aria-label="Texto inteiro">
                {passage.range ? (
                  <>
                    {passage.texto.slice(0, passage.range[0])}
                    <mark tabIndex={-1}>{passage.texto.slice(...passage.range)}</mark>
                    {passage.texto.slice(passage.range[1])}
                  </>
                ) : passage.texto}
              </div>
              <button type="button" onClick={() => textToEditor(passage)}>
                <Icon name="estudar" />
                Levar este texto ao editor
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* "Compartilhar" (openShare): as quatro saídas do material, cada uma com o nome e a frase do que faz. O foco
          começa na primeira. */}
      <AnimatePresence
        onExitComplete={() => {
          shareGone.current?.();
          shareGone.current = null;
        }}
      >
        {sharing && (
          <Modal
            key="compartilhar"
            className="share-dialog"
            labelledBy="compartilhar-titulo"
            describedBy="compartilhar-texto"
            back="main h1"
            onClose={() => setSharing(null)}
          >
            <div className="dialog-body">
              <button type="button" className="icon-button close" aria-label="Fechar" onClick={() => setSharing(null)}>
                <Icon name="fechar" />
              </button>
              <h2 id="compartilhar-titulo">Compartilhar</h2>
              <p id="compartilhar-texto">{sharing.title}</p>
              <ul className="share-list" role="list">
                {[
                  ['colega', 'compartilhar', 'Arquivo para um colega', 'Só este material, sem o texto de onde ele saiu. O ' +
                    'colega o abre no Importar da Biblioteca.', sendMaterial],
                  ['anki', 'flashcards', 'Cartões para o Anki (.txt)', 'Um arquivo com ' + cardCount(sharing) +
                    ', para importar no Anki.', ankiCards],
                  ['quizlet', 'copiar', 'Copiar cartões para o Quizlet', cardCount(sharing) + ', para colar em Importar, ' +
                    'no Quizlet.', quizletCards],
                  ['imprimir', 'imprimir', 'Imprimir ou salvar em PDF', 'O resumo, os cartões para recortar e o quiz, com o ' +
                    'gabarito numa página à parte.', printSheet],
                ].map(([key, icon, label, note, run]) => (
                  <li key={key}>
                    <button
                      type="button"
                      id={'compartilhar-' + key}
                      className="share-option"
                      aria-labelledby={'compartilhar-' + key + '-nome'}
                      aria-describedby={'compartilhar-' + key + '-nota'}
                      onClick={() => run(sharing)}
                    >
                      <Icon name={icon} />
                      <span>
                        <span id={'compartilhar-' + key + '-nome'}>{label}</span>
                        <small id={'compartilhar-' + key + '-nota'}>{note}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      {/* A folha de impressão (printSheet): fora da tela; na impressão, só ela (styles.css). */}
      {printing && <printing.Folha material={printing.material} />}
    </div>
  );
}

// As mensagens da conversa do Dúvidas. Só se redesenham quando a conversa ou o movimento mudam (memo): cada tecla na
// caixa redesenha o App, e com 40 mensagens refazer os balões e o rich() de cada resposta pesava na digitação.
// Mensagem nova entra; nenhuma sai com movimento (Nova conversa limpa na hora). As que já estavam na conversa quando a
// página abriu não animam à parte (initial false). A pergunta enviada pelo teclado aparece parada. A espera da resposta
// fica só na pílula acima da caixa (.chat-wait), com o orbe e os segundos.
const ChatLog = React.memo(function ChatLog({ chat, pop }) {
  return (
    <AnimatePresence initial={false} mode="popLayout" custom={byKeyboard()}>
      {chat.map((msg, i) => (
        <m.div
          key={i}
          className={'message ' + msg.role}
          variants={pop}
          initial={msg.role === 'user' ? appear() : 'hidden'}
          animate="show"
        >
          <small>{msg.role === 'user' ? 'Você' : 'Cérebro'}</small>
          <p>{msg.role === 'user' ? msg.text : rich(msg.text)}</p>
        </m.div>
      ))}
    </AnimatePresence>
  );
});

// Margem do baralho: um ✓ ou ✗ da caneta para cada cartão já avaliado nesta sessão. O cartão errado volta para o fim
// da fila (lib.js): o que aparece de novo mais adiante na fila foi o errado. Com fresh, a marca mais nova se desenha,
// com a nota ao lado; "Revisar depois" só muda a ordem e não deixa marca. Com finale (fim do baralho), a caneta passa
// por todas, uma depois da outra.
function DeckMarks({ session, fresh = false, finale = false }) {
  const marks = session.queue.slice(0, session.pos).map((card, i) => session.queue.indexOf(card, i + 1) < 0);
  if (!marks.length) return null;
  const right = marks.filter(Boolean).length;
  const missed = marks.length - right;
  return (
    <div
      className="marks"
      role="img"
      aria-label={'Cartões avaliados: ' + right + (right === 1 ? ' acerto, ' : ' acertos, ') +
        missed + (missed === 1 ? ' erro' : ' erros')}
    >
      {marks.map((ok, i) => {
        const last = fresh && i === marks.length - 1;
        return (
          <Pen
            key={i}
            kind={ok ? 'certo' : 'errei'}
            draw={last || finale}
            delay={finale ? 0.25 + Math.min(i, 12) * 0.05 : 0}
            note={last ? (ok ? 'acertei' : 'errei') : undefined}
          />
        );
      })}
    </div>
  );
}

// Uma marca por questão do quiz, na ordem: ○ ainda sem resposta, ✓ certa, ✗ errada. A atual fica sublinhada.
function QuizMarks({ total, answers, idx }) {
  const right = answers.filter(a => a.ok).length;
  const missed = answers.length - right;
  return (
    <div
      className="marks"
      role="img"
      aria-label={'Até aqui: ' + right + (right === 1 ? ' certa, ' : ' certas, ') + missed + (missed === 1 ? ' errada' : ' erradas')}
    >
      {Array.from({ length: total }, (_, i) => (
        <Pen
          key={i}
          kind={!answers[i] ? 'novo' : answers[i].ok ? 'certo' : 'errei'}
          className={i === idx ? 'current' : ''}
        />
      ))}
    </div>
  );
}

// "Quanta certeza você tem?" (#80): os três botões que mandam a resposta à correção com a certeza. Sem a opção escolhida
// (ready false) eles ficam com aria-disabled, e não disabled: o Tab chega a eles e o leitor de tela ouve que estão
// desligados. Como as opções, ignoram o segundo clique de um clique duplo. onPick recebe a certeza e o botão; form é o
// id do formulário da resposta curta, que o botão alcança sem enviá-lo. O grupo recebe o foco do Enter no campo.
function Sureness({ ready, form, onPick }) {
  return (
    <div className="sure-row" role="group" aria-labelledby="certeza-titulo" tabIndex={-1}>
      <span id="certeza-titulo">Quanta certeza você tem?</span>
      {CONF.map(conf => (
        <button
          key={conf}
          type="button"
          form={form}
          aria-disabled={!ready || undefined}
          onClick={e => e.detail < 2 && onPick(conf, e.currentTarget)}
        >
          {SURE_LABELS[conf]}
        </button>
      ))}
    </div>
  );
}

// Fio de progresso de verdade: cartões já avaliados no baralho, questões já respondidas no quiz. O preenchimento
// anda por transform (styles.css, .meter), em 0,2 s; pelo teclado, na hora.
function Meter({ value, max, label }) {
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ '--p': max ? value / max : 0 }}></span>
    </div>
  );
}

// Janela modal nativa (<dialog> com showModal): o navegador prende o foco nela, deixa o resto da página inerte e
// fecha no Esc. Clicar no fundo escuro também fecha. Ao fechar, o foco volta ao botão que a abriu, ou a back quando
// ele saiu da tela (o perfil aberto de dentro da folha "Mais").
// Movimento: a janela nasce do botão que a abriu (transform-origin no centro dele) e a folha sobe da barra de baixo;
// a saída é mais curta, com o fundo escuro esmaecendo junto (styles.css, [data-closing]). Pelo teclado (Enter, Esc)
// ela abre e fecha parada. Fica dentro de um AnimatePresence: a saída roda antes de ela sair da árvore.
function Modal({ className, labelledBy, describedBy, back, sheet = false, onClose, children }) {
  const box = useRef(null);
  const [present, safeToRemove] = usePresence();
  useLayoutEffect(() => {
    const dialog = box.current;
    const opener = document.activeElement;
    dialog.showModal();
    if (!byKeyboard()) {
      if (reduced()) {
        animate(dialog, { opacity: [0, 1] }, { duration: MODAL.calmIn, ease: EASE_OUT });
      } else if (sheet) {
        // A folha sai rápido da barra e assenta devagar, na curva de tudo.
        animate(dialog, { transform: ['translateY(100%)', 'none'] }, { duration: MODAL.sheetIn, ease: EASE_OUT });
      } else {
        const o = opener?.getBoundingClientRect?.();
        const d = dialog.getBoundingClientRect();
        if (o?.width) dialog.style.transformOrigin = (o.left + o.width / 2 - d.left) + 'px ' + (o.top + o.height / 2 - d.top) + 'px';
        animate(dialog, { opacity: [0, 1], transform: ['scale(0.96)', 'none'] }, { duration: MODAL.in, ease: EASE_OUT });
      }
    }
    return () => {
      if (dialog.open) dialog.close();
      // Quem abriu pode estar na página e fora da vista: com o celular girado para 600 px ou mais, o "Mais" some
      // (mobile.css). Aí vale o primeiro de back que está na tela. O que está no que sai da tela (popLayout) também não
      // vale: o "Levar este texto ao editor" troca de página com a janela aberta.
      const shown = el => el?.isConnected && el.getClientRects().length > 0 && !el.closest('[data-motion-pop-id]');
      const to = shown(opener) ? opener : back && [...document.querySelectorAll(back)].find(shown);
      if (!document.querySelector('dialog[open]')) to?.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = box.current;
    if (present) {
      // Reaberta no meio da saída: volta ao normal.
      if ('closing' in dialog.dataset) {
        delete dialog.dataset.closing;
        animate(dialog, { opacity: 1, transform: 'none' }, { duration: MODAL.settle, ease: EASE_OUT });
      }
      return;
    }
    // Do teclado, ou com outra janela aberta por cima (a folha "Mais" passando para o perfil), sai na hora.
    if (byKeyboard() || document.querySelectorAll('dialog[open]').length > 1) {
      safeToRemove();
      return;
    }
    dialog.dataset.closing = '';
    const exit = reduced() ? { opacity: 0 } : sheet ? { transform: 'translateY(100%)' } : { opacity: 0, transform: 'scale(0.98)' };
    animate(dialog, exit, { duration: reduced() ? MODAL.calmOut : sheet ? MODAL.sheetOut : MODAL.out, ease: EASE_IN })
      .then(safeToRemove);
  }, [present]);
  return (
    <dialog
      ref={box}
      className={className}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClick={e => e.target === box.current && onClose()}
    >
      {children}
    </dialog>
  );
}

// Resposta do tutor a um "Não entendi, me explique", mostrada no lugar do pedido (retorno do quiz, tópico do
// resumo). Sem texto e sem erro, a resposta ainda não chegou: o esqueleto de três linhas e a espera (wait = busy)
// ficam onde ela vai entrar, e ela entra em foco no lugar deles.
function Why({ text, error, wait, onCancel, pop, focusIn }) {
  const box = useRef(null);
  // A resposta entra abaixo do botão do pedido: sem isto podia ficar fora da vista, como na conversa.
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest' });
  }, [text, error]);
  if (error) {
    return (
      <m.div ref={box} role="alert" className="error why-error" variants={pop} initial={appear()} animate="show">
        <Problem error={error} />
      </m.div>
    );
  }
  return (
    <m.div ref={box} className="why" role="status" variants={pop} initial={appear()} animate="show">
      <small>Cérebro</small>
      {text ? (
        <m.div variants={focusIn} initial={appear()} animate="show">
          <p>{rich(text)}</p>
          {aiNote}
        </m.div>
      ) : (
        <>
          <span className="sk-lines">
            <Sk className="sk-read" />
            <Sk w="90%" className="sk-read" />
            <Sk w="62%" className="sk-read" />
          </span>
          {wait?.kind === 'why' && <Wait label={wait.label} since={wait.since} onCancel={onCancel} />}
        </>
      )}
    </m.div>
  );
}

// Erro de um pedido (lib.js, errorText): a frase para o aluno e, embaixo, "Detalhes técnicos", fechado, com o código e a
// frase do backend para quem instalou o Cérebro. No limite por minuto a frase conta os segundos até os botões da IA
// voltarem (until, callAI).
function Problem({ error }) {
  return (
    <div>
      <p>
        {error.message}
        {error.until > 0 && <> <Countdown until={error.until} /></>}
      </p>
      {error.tech && (
        <details>
          <summary>Detalhes técnicos</summary>
          <p>{error.tech}</p>
        </details>
      )}
    </div>
  );
}

// Erro ao desenhar derrubava a árvore inteira do React e a tela ficava branca.
// Aqui o aluno vê o que houve e tem como sair.
class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="panel empty" role="alert">
        <h2>Algo quebrou nesta tela</h2>
        <button className="primary" onClick={() => window.location.reload()}>Recarregar a página</button>
      </section>
    );
  }
}

// LazyMotion com domMin: só a parte da Motion que estas animações usam, a entrada e a saída (sem gestos, arrastar nem
// layout). whileHover, whileTap, whileFocus e whileInView não funcionam com ele. MotionConfig com reducedMotion="user" é
// a rede de segurança: com movimento reduzido, nenhum deslocamento passa. Os dois ficam fora do App: o LazyMotion passa
// um contexto novo a cada desenho dele, e dentro do App cada tecla redesenhava todos os blocos animados da página, até
// os balões da conversa (ChatLog).
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMin} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </ErrorBoundary>
);
