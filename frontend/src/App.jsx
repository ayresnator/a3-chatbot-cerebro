import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { animate } from 'motion/mini';
import {
  AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, usePresence, useReducedMotion,
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
  PerfilSkeleton, Countdown,
} from './ui.jsx';
import {
  AREAS, LEVELS, EXAMPLE, read, readList, readUser, readDraft, demoStorage, storageKey, newId, backupStatus,
  backupSummary, deckRestart, validMaterial, sameMaterial, validEvent, fold, demo,
  shortAnswerOk, expectedText, streak, quizRate, cardRate, weakSpot, chartDays, spokenDay, lastDays, areaLine, plural,
  deckStart, deckRight, deckWrong, deckLater, deckMissed, deckRedo, deckSummary, fitsAbove,
  matches, libraryCount, hints, hello, chatSubject, healthLabel, errorText, ERRORS, FAILS, dictate, dictationError,
  localDay, mistakeKey, addMistake, clearMistake, removeMistake, validMistake, byMaterial, whyQuestion, whyTopic,
  gradeRequest, fixLastQuizEvent, readBackup, mergeBackup, backupNote, pickExample, AI_NOTE, markExample, sourceLabel,
  originNote,
} from './lib.js';

const CONFIG = window.CEREBRO_CONFIG || {};
// ?demo no endereço abre a demonstração pelo Vite (http://localhost:5173/?demo),
// sem servir a raiz do repositório, onde fica o .env.
const DEMO = CONFIG.demo === true || new URLSearchParams(window.location.search).has('demo');
// A demonstração grava em chaves próprias (lib.js, storageKey): antes da primeira leitura, a do rascunho logo abaixo.
demoStorage(DEMO);
const API_BASE = DEMO ? '' : (CONFIG.apiBaseUrl || window.location.origin).replace(/\/$/, '');
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
const VERDICT_EFFECT = {
  correta: 'Agora conta como acerto, e a questão saiu do caderno de erros.',
  parcial: 'Parcial não vale ponto: a resposta continua contando como erro, e a questão fica no caderno de erros.',
  incorreta: 'A resposta continua contando como erro, e a questão fica no caderno de erros.',
};

// Aviso fixo onde há texto escrito pela IA: a conversa, o "Não entendi, me explique" e o quiz do caderno de erros. A
// demonstração não usa IA e não mostra. O aviso do material segue o material, e não o modo (cabeçalho do material).
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
  const [name, setName] = useState(user?.name || '');
  const [area, setArea] = useState(DRAFT.area || (AREAS.includes(user?.area) ? user.area : 'Tecnologia'));
  const [level, setLevel] = useState(DRAFT.level || 'Básico');
  const [input, setInput] = useState(DRAFT.input);
  const [result, setResult] = useState(DRAFT.result);
  // Espera de um pedido à IA fora do chat: { kind, label, orb, since }. kind é o pedido (gerar, why, review, example),
  // para a espera aparecer no botão dele; label vai na espera, e orb é o estado do orbe ao lado dele (ui.jsx,
  // Wait); since é a hora do pedido, para os segundos.
  // Na geração, prior é o material aberto no clique (o esqueleto só cobre ele); na revisão, answer é a resposta revista.
  const [busy, setBusy] = useState(null);
  // Aviso de erro do Estudar e do Dúvidas: { message, tech, until } (Problem, abaixo), ou null.
  const [error, setError] = useState(null);
  // Limite por minuto: a hora em que os botões da IA voltam (o backend manda quantos segundos esperar), ou 0.
  const [pausedUntil, setPausedUntil] = useState(0);
  // Quantos tópicos do resumo aparecem: 'todos', '6' ou '3' (a lista "Mostrar"). O texto de cada tópico não muda.
  const [size, setSize] = useState('todos');
  // Material ou evento estragado fica fora da tela, mas continua gravado: quem grava parte da lista do navegador.
  const [saved, setSaved] = useState(() => readList('saved').filter(validMaterial));
  const [events, setEvents] = useState(() => readList('events').filter(validEvent));
  // Data do último backup (Exportar ou "Fazer backup"), em texto ISO: a linha do pé da Biblioteca e do Desempenho.
  const [lastBackup, setLastBackup] = useState(() => read('backup', null));
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
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
  // Material que estava aberto quando o quiz do caderno de erros tomou o lugar dele. Só vale enquanto result é o
  // material temporário do caderno (result.virtual).
  const [parked, setParked] = useState(null);
  // "Não entendi, me explique": { item, text } ou { item, error }; item é a questão ou o tópico do pedido.
  // Só com item, a resposta ainda não chegou.
  const [why, setWhy] = useState(null);
  // Ditado em andamento: o botão vira "Parar ditado".
  const [listening, setListening] = useState(false);
  // Última geração: { key }, o texto, a área e o nível do material aberto. Com eles iguais aos do editor, o Estudar
  // troca o botão de gerar pelos que só abrem o material.
  const made = useRef(DRAFT.made);
  // Material de verdade que está aberto: durante o quiz do caderno de erros é o que ficou guardado.
  const opened = result?.virtual ? parked : result;
  // Página e material aberto deste desenho. generate() espera a IA por até 105 s e, na volta, ainda enxerga os do
  // clique. O texto do editor, a área e o nível vão junto: na volta da IA, addExample() confere se o aluno mexeu neles
  // durante a espera.
  const latest = useRef({});
  latest.current = { page, result: opened, input, area, level };
  const noticeTimer = useRef(null);
  const chatEnd = useRef(null);
  // Pedido à IA em andamento (AbortController): o botão "Cancelar" da espera o interrompe.
  const pending = useRef(null);
  const recognition = useRef(null);
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
  // de ela assentar (0,35 s): o aluno passou direto, e a troca corta para a nova, sem entrada nem saída.
  const viewKey = MATERIAL.includes(page) ? 'material' : page;
  const viewAt = useRef({ key: null, at: -Infinity });
  const live = viewAt.current.key === viewKey;
  const cut = !live && performance.now() - viewAt.current.at < 350;
  // Variantes do Motion (anim.js): com movimento reduzido, só a opacidade. A primeira página (a abertura do app) entra
  // na mola de 0,45 s, bloco a bloco; as trocas de seção, na de 0,3 s.
  const calm = useReducedMotion();
  const { view: viewIn, title: titleIn, rise } = calm ? CALM : viewAt.current.key === null ? OPENING : ROUTINE;
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

  // O texto do editor, o material aberto e a conversa sobrevivem a um F5. O material temporário do caderno de erros
  // não entra: no lugar dele vai o que estava aberto.
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

  useEffect(() => {
    const hidden = () => document.visibilityState === 'hidden' && saveDraft();
    window.addEventListener('pagehide', saveDraft);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', saveDraft);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  // Outra aba gravou a biblioteca, o desempenho, o caderno de erros, o perfil ou a data do backup: esta mostra a
  // mudança sem F5, com a mesma conferência da abertura. O evento não chega à aba que gravou. O rascunho fica de fora:
  // cada aba fica com o seu. key null: outra aba apagou tudo.
  useEffect(() => {
    const sync = e => {
      const changed = k => e.key === null || e.key === storageKey(k);
      if (changed('saved')) setSaved(readList('saved').filter(validMaterial));
      if (changed('events')) setEvents(readList('events').filter(validEvent));
      if (changed('erros')) setMistakes(readList('erros').filter(validMistake));
      if (changed('backup')) setLastBackup(read('backup', null));
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

  // O código das páginas carregadas à parte vem quando o navegador fica livre: na hora do clique ele já está aqui e
  // o esqueleto do Suspense não pisca.
  useEffect(() => {
    const load = () => [Desempenho, Biblioteca, Perfil].forEach(page => page.preload().catch(() => {}));
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
  }, [page]);

  useLayoutEffect(() => {
    viewAt.current = { key: viewKey, at: performance.now() };
  }, [viewKey]);

  // O caderno mostrou estas marcas: na próxima visita elas aparecem prontas.
  useEffect(() => {
    if (page === 'Erros') mistakes.forEach(m => penned.add(m.key + m.date));
  }, [page, mistakes]);

  // O desfazer que fica na tela é da página onde a ação aconteceu: trocar de página encerra a chance.
  useEffect(() => setUndo(null), [page]);

  // O aviso de erro do Estudar (texto curto, geração que falhou) sai quando o texto do editor muda: digitado, ditado,
  // trocado pelo exemplo ou desfeito. Antes ele ficava na tela com o texto já certo. O do limite por minuto fica até a
  // espera acabar: é ele que conta os segundos até os botões da IA voltarem.
  useEffect(() => setError(e => (e?.until > Date.now() ? e : null)), [input]);

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
    const [selector, fallback, show, whole] = focusAfter.current;
    focusAfter.current = null;
    // A última ocorrência: numa troca de página, a que sai (AnimatePresence, popLayout) fica no DOM antes da nova.
    const last = s => s && [...document.querySelectorAll(s)].pop();
    // Com show, o foco não rola a página: o navegador centraliza o que recebe o foco, e no celular deitado as marcas da
    // caneta saíam pelo topo. Quem rola é o show. Se o bloco inteiro (whole) cabe no que sobra da janela (no celular a
    // raiz desconta a barra de baixo e o "Próxima questão" preso, mobile.css; a faixa fica dentro do bloco e conta uma
    // vez só), ele vem todo, com o botão de seguir; senão, só o último elemento que casa, com as marcas ✓ e ✗ e a nota
    // acima da faixa.
    (last(selector) || last(fallback))?.focus({ preventScroll: !!show });
    if (!show) return;
    const box = last(whole);
    const fits = box && fitsAbove(box.offsetHeight, innerHeight,
      getComputedStyle(document.documentElement).scrollPaddingBottom, box.querySelector('.next-row')?.offsetHeight);
    (fits ? box : last(show))?.scrollIntoView({ block: 'nearest' });
  });

  // O erro aparece junto do que o aluno clicou; se estiver fora da vista (no celular), a página rola até ele.
  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }, [error]);

  // O material temporário do caderno de erros só vale na página do quiz: sair dela por qualquer caminho (menu,
  // logotipo, botão de um aviso) traz de volta o material que estava aberto, com o quiz no início.
  // Mudar o estado durante o desenho faz o React refazer o desenho na hora: a página nova nunca aparece com o
  // material temporário.
  if (result?.virtual && page !== 'Quizzes') {
    setResult(parked);
    restart();
  }

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

  // Volta ao início do quiz. "list" = só as questões erradas; sem ele, o quiz completo.
  function restartQuiz(list = null) {
    setIdx(0);
    setDone(false);
    setAnswer(null);
    setAnswers([]);
    setRetry(list);
    setWhy(null);
  }

  // Volta ao início do quiz e do baralho: só quando o material aberto muda (gerado, aberto da biblioteca, o quiz do
  // caderno de erros entrando ou saindo). Trocar de aba ou de página não recomeça: o aluno volta onde estava.
  function restart() {
    restartQuiz();
    setFlip(false);
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

  // Aviso com ação fica 10 segundos, para dar tempo de clicar, e não some enquanto o mouse ou o foco estão nele.
  // O temporizador do aviso anterior é cancelado: ele apagava o aviso novo antes da hora.
  function toast(text, action) {
    clearTimeout(noticeTimer.current);
    setNotice({ text, action });
    noticeTimer.current = setTimeout(() => setNotice(null), action ? 10000 : 3200);
  }

  // O leitor de tela lê o texto novo da região fixa. O mesmo texto outra vez (gerar de novo o mesmo material, a mesma
  // contagem da busca) ganha um espaço no fim: sem mudança na região, ele não seria lido.
  function say(text) {
    setSpoken(s => (s === text ? text + '\u00a0' : text));
  }

  function holdNotice() {
    clearTimeout(noticeTimer.current);
  }

  function releaseNotice() {
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
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
  function event(kind, ok, topic = area, q, title = result?.title) {
    const entry = { kind, ok, area: topic, title, q, date: new Date().toISOString() };
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

  // De onde vem a questão ou o tópico: o material aberto ou, no quiz do caderno de erros, o material e a área que
  // a questão traz. Área e nível vão nos pedidos à IA, que só aceita os das listas: material antigo ou importado
  // pode não ter (e o do caderno não tem nível), e aí valem a área do editor e o nível Básico.
  function origin(item) {
    const from = result.virtual ? item : result;
    return {
      title: from.title,
      area: AREAS.includes(from.area) ? from.area : area,
      level: LEVELS.includes(result.level) ? result.level : 'Básico',
    };
  }

  // O menu sempre sai do quiz do caderno de erros, até o botão Quizzes, que não troca de página: volta o material que
  // estava aberto, com o quiz no início. Fora disso o menu não recomeça o quiz nem o baralho.
  function go(next) {
    if (result?.virtual) {
      setResult(parked);
      restart();
    }
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
      setError({ message: 'Escreva um tema (mínimo 3 caracteres com IA) ou cole um texto completo (mínimo 30 na demonstração).' });
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
    setBusy({ kind: 'gerar', label: 'Gerando o material…', orb: 'working', since: Date.now(), prior: result });
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
      const material = { ...data, area, level };
      const twin = readList('saved').find(m =>
        validMaterial(m) && sameMaterial(m, material) && m.area === area && m.level === level);
      setResult(twin || store(material) || material);
      made.current = { key };
      setEditorChat(false);
      // O quiz e o baralho recomeçam com outro material. O "Gerar de novo" da demonstração, com o mesmo texto, reabre o
      // mesmo, e eles seguem onde estavam. Depois da espera pela IA recomeçam sempre: durante ela o aluno pode ter
      // aberto outro material ou o quiz do caderno de erros.
      if (wait || !previous || !sameMaterial(previous, data)) restart();
      const at = latest.current.page;
      if (at === 'Estudar' || MATERIAL.includes(at)) {
        // Na página do material o esqueleto dá lugar a ele ali mesmo; quem voltou ao Estudar vai para o Resumo.
        if (at === 'Estudar') setPage(target);
        // O leitor de tela ouve que ele chegou, e o foco que estava na espera, no botão de gerar ou no body vai para o
        // título dele.
        say('Material pronto: ' + data.title + '.');
        if (adrift('main, .busy')) focusAfter.current = ['#material-titulo'];
        if (kept) toast('O material anterior foi guardado na biblioteca');
      } else {
        // O aluno saiu para outra página enquanto esperava: fica onde está e abre o material quando quiser.
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
      // Se nesse meio-tempo ele abriu outro material, fica nele.
      const back = wait && MATERIAL.includes(latest.current.page) && latest.current.result === result;
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
  // (biblioteca, desempenho, caderno de erros e perfil), para levar a outro computador. Parte do que está gravado, não
  // das listas desta aba. O material aberto que ainda não está na biblioteca vai para lá antes, como quando outro toma
  // o lugar dele, e assim vai no arquivo.
  function exportBackup() {
    const unsaved = !!opened && !opened.id;
    const entry = unsaved ? store(opened) : null;
    if (entry) setResult(entry);
    const backup = {
      versao: 1, saved: readList('saved'), events: readList('events'), erros: readList('erros'), user: readUser(),
    };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    link.download = 'cerebro-backup-' + localDay(new Date()) + '.json';
    link.click();
    // O arquivo sai da memória um minuto depois: liberar na hora cancela o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
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
      toast('Este arquivo não é um backup do Cérebro.');
      return;
    }
    const before = { saved: readList('saved'), events: readList('events'), erros: readList('erros') };
    const after = mergeBackup(before, backup);
    if (!persist('saved', after.saved)) return;
    setSaved(after.saved.filter(validMaterial));
    if (!persist('events', after.events)) return;
    setEvents(after.events.filter(validEvent));
    if (!persist('erros', after.erros)) return;
    setMistakes(after.erros.filter(validMistake));
    // O perfil do arquivo (já conferido em readBackup) só entra num navegador que ainda não tem um: o daqui vale mais.
    // A área do editor não muda.
    const profile = backup.user && !readUser() && persist('user', backup.user) ? backup.user : null;
    if (profile) {
      setUser(profile);
      setName(profile.name);
    }
    toast(backupNote(before, after, backup.fora, profile?.name));
  }

  // "Acertei" segue para o próximo cartão; "Errei" põe o cartão de novo no fim da fila. Os dois ficam registrados, com
  // a pergunta do cartão: como no quiz, o desempenho conta só a primeira avaliação de cada cartão no dia.
  // Os dois botões ficam desabilitados no cartão novo (ainda não virado): o foco passa para o cartão.
  function cardNext(ok) {
    event('flashcard', ok, result.area, fold(card.question));
    setFlip(false);
    setDeck(ok ? deckRight(session) : deckWrong(session));
    cardMotion.current = 'translateX(12px)';
    focusAfter.current = ['.flashcard', '.deck-done h2'];
  }

  // given é o que o aluno respondeu: a tela final mostra ao lado da resposta certa.
  // A questão errada entra no caderno de erros; a certa sai dele, se o erro guardado é de outro dia (lib.js).
  // As opções ficam desabilitadas e o foco ia para a página: ele passa ao retorno, que diz se acertou.
  function submit(value) {
    if (answer !== null) return;
    const q = quizList[idx];
    const ok = q.type === 'short' ? shortAnswerOk(q.answer, value) : value === q.answer;
    const from = origin(q);
    const now = new Date();
    setAnswer({ value, ok });
    setAnswers([...answers, { ...q, ok, given: value }]);
    event('quiz', ok, from.area, fold(q.question), from.title);
    notebook(list => (ok
      ? clearMistake(list, mistakeKey(from.title, q.question), now)
      : addMistake(list, q, from.title, from.area, now)));
    // Depois do foco, a página rola até o retorno inteiro ficar à vista; na janela baixa, onde ele não cabe, até a
    // última linha com marca da caneta (ou o próprio retorno).
    focusAfter.current = ['#retorno', null, '#retorno, .feedback .answer-line', '.feedback'];
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
      focusAfter.current = QUESTION_FOCUS;
    }
  }

  // "Refazer meus erros": o quiz abre num material temporário com as questões do caderno, cada uma com o material
  // e a área de onde veio. O material que estava aberto fica guardado e volta quando o aluno sai do quiz.
  // Com title, só as questões desse material ("Refazer os erros de", no Desempenho).
  function redoMistakes(title) {
    setParked(opened);
    setResult({
      virtual: true,
      title: 'Caderno de erros',
      area: '',
      level: '',
      summary: [],
      flashcards: [],
      quiz: mistakes.filter(m => !title || m.title === title).map(m => ({ ...m.item, title: m.title, area: m.area })),
    });
    openPage('Quizzes', QUESTION_FOCUS);
    restart();
    // Um aviso ainda na tela com o botão "Abrir" (material pronto) reiniciaria este quiz em vez de abrir o material.
    setNotice(null);
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
  // seguir adiante não aparece em outro lugar. button é o id do botão do pedido.
  async function explain(item, text, content, button) {
    if (waiting) return;
    const from = origin(item);
    setWhy({ item });
    setBusy({ kind: 'why', label: 'Esperando a explicação…', orb: 'composing', since: Date.now() });
    // A espera nasce junto com a explicação e não seria lida.
    say('Esperando a explicação…');
    try {
      const data = await callAI('/api/chat', {
        question: text, content, area: from.area, level: from.level, history: [],
      });
      setWhy({ item, text: data.answer });
    } catch (e) {
      setWhy(e.cancelled ? null : { item, error: e });
    } finally {
      // O Cancelar sai com a espera: o foco que estava nele volta ao botão do pedido.
      if (adrift('.why, .busy')) focusAfter.current = ['#' + button, 'main h1'];
      setBusy(null);
    }
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
    setBusy({ kind: 'review', label: 'Esperando a revisão…', orb: 'solving', since: Date.now(), answer: mine });
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
        notebook(list => removeMistake(list, mistakeKey(from.title, q.question), asked));
      }
    } catch (e) {
      if (!e.cancelled) setAnswer(a => (a === mine ? { ...a, review: { error: e } } : a));
    } finally {
      // O Cancelar sai com a espera: o foco que estava nele volta ao botão do pedido.
      if (adrift('.review-wait, .busy')) focusAfter.current = ['#pedir-revisao', 'main h1'];
      setBusy(null);
    }
  }

  // Pergunta enviada pelo editor já é o conteúdo: não manda o mesmo texto duas vezes ao modelo, e o chat passa a ser
  // sobre o texto do editor. As outras levam o assunto do chat (subject): o material aberto ou o texto do editor.
  // O servidor não guarda conversa: as 6 últimas mensagens vão junto, para ele entender um "me dê um exemplo".
  // O texto do editor já vai em content (ou é a própria pergunta), então a cópia dele fica fora do histórico.
  // Pergunta que falhou sai da conversa: sem isso ela ia sem resposta no histórico do próximo pedido. Se veio da caixa, volta para a caixa.
  // A caixa só é esvaziada quando a pergunta saiu dela: sugestão clicada ou envio pelo editor não apagam um rascunho.
  async function ask(message = question) {
    if (waiting || !message.trim()) return;
    const msg = message.trim();
    const mine = { role: 'user', text: msg };
    const own = msg === input.trim();
    const topic = own ? { content: input, area, level } : subject;
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
        text: 'Na demonstração, posso organizar o texto, mas não responder dúvidas com IA. As explicações personalizadas estarão disponíveis na versão com IA ativada. Trecho para revisar: ' + (topic.content || EXAMPLE).slice(0, 450),
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
        history: chat
          .filter(m => m.text !== input.trim())
          .slice(-6)
          .map(m => ({ role: m.role, text: [...m.text].slice(0, 4000).join('') })),
      });
      setChat(c => [...c, { role: 'assistant', text: data.answer }]);
      setTips({ key: JSON.stringify([topic.content, topic.area]), list: Array.isArray(data.suggestions) ? data.suggestions : [] });
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
    if (!Speech) {
      toast('Ditado indisponível neste navegador. Use Chrome e permita o microfone.');
      return;
    }
    const speech = new Speech();
    speech.lang = 'pt-BR';
    speech.onresult = e => setInput(s => dictate(s, e.results[0][0].transcript));
    speech.onerror = e => toast(dictationError(e.error));
    speech.onend = () => setListening(false);
    recognition.current = speech;
    speech.start();
    setListening(true);
    toast('Ouvindo…');
  }

  // "Usar um exemplo": com a IA ligada, ela escreve um texto de estudo sobre um tema sorteado pelo servidor na área e
  // no nível escolhidos (1 chamada da cota), sem repetir o tema do exemplo anterior. Na demonstração, com a IA
  // desligada ou se ela falhar, entra um exemplo pronto da mesma área (lib.js). A área e o nível não mudam.
  async function addExample() {
    // Um pedido à IA por vez: o segundo clique durante a espera não pede outro.
    if (waiting) return;
    const ai = !!API_BASE && health?.ai_configured !== false;
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
      // O aluno mexeu durante a espera no que o exemplo usa: o que ele fez vale mais. O exemplo apagaria o texto no
      // meio da digitação (o Desfazer do editor some na primeira tecla) ou longe da vista (some também na troca de
      // página), e o exemplo da área ou do nível do clique ficaria com outra área ou outro nível na tela.
      const now = latest.current;
      const changed = now.input !== input ? 'o texto do editor mudou'
        : now.area !== area || now.level !== level ? 'a área ou o nível mudou'
        : input.trim() && now.page !== 'Estudar' ? 'você saiu do Estudar' : '';
      if (changed) {
        toast('O exemplo não entrou: ' + changed + ' durante a espera');
        return;
      }
    }
    const example = written || pickExample(area, { topic: exampleTopic.current, text: input });
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
  // Abrir de novo o que já está aberto (ele fica no topo da lista) não recomeça o quiz nem o baralho.
  function openSaved(material) {
    if (keep(result)) toast('O material anterior foi guardado na biblioteca');
    made.current = { key: '' };
    setEditorChat(false);
    setResult(material);
    openPage('Resumos', ['#material-titulo']);
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
  const quiz = quizList[idx];
  const wrong = answers.filter(a => !a.ok);
  const right = answers.length - wrong.length;
  const session = deck || deckStart(result?.flashcards?.length || 0);
  const card = result?.flashcards?.[session.queue[session.pos]];
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
  // Sem respostas não há percentual: "0%" diria que o aluno errou tudo.
  const percent = r => (r.total ? r.rate + '%' : '—');
  const summary = result?.summary || [];
  const topics = size === 'todos' ? summary : summary.slice(0, Number(size));
  // A busca dobra o texto de todos os materiais: só na Biblioteca e só quando a lista, a busca ou o filtro mudam.
  const shown = useMemo(
    () => (page === 'Biblioteca' ? saved.filter(s => matches(s, query, filter)) : []),
    [page, saved, query, filter]
  );
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
  const chatHints = hints({ chat, input: subject.content, area: subject.area, tips });
  const greeting = hello({
    user, area: subject.area, level: subject.level, input: subject.content, title: subject.title, api: !!API_BASE,
  });
  // Um pedido à IA por vez: a geração do material e a resposta do chat não correm juntas. Na espera do limite por
  // minuto nenhum sai. Sempre true ou false: asking guarda a hora do pedido, e aria-disabled só vale com "true".
  const waiting = !!busy || !!asking || !!pausedUntil;
  // IA sem chave neste computador: o botão de gerar fica desligado, e o aviso embaixo do editor diz por quê.
  const aiOff = !!API_BASE && health?.ai_configured === false;
  // O custo do clique ("1 chamada de IA") vai nos botões que chamam a IA, só quando ela está ligada: a demonstração e o
  // backend sem a IA configurada não gastam chamada.
  const cost = !!API_BASE && !aiOff;
  // O material aberto saiu do texto, da área e do nível do editor: no lugar do botão de gerar ficam os que só abrem.
  const fresh = !!result && made.current.key === JSON.stringify([input, area, level]);
  const isSaved = !!result?.id && saved.some(s => s.id === result.id);
  const status = API_BASE ? healthLabel(health) : { text: 'Modo demonstração', tone: 'demo' };
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
    : busy?.kind === 'review' && page === 'Quizzes' && !done && answer === busy.answer;
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
  // A página que sai esmaece por cima da nova; sai sem movimento quando a troca veio do teclado, quando a página
  // estava rolada (a nova começa do topo e a antiga apareceria deslocada) ou quando o aluno passou direto por ela (cut).
  const still = byKeyboard() || window.scrollY > 80 || cut;
  // Na espera do limite por minuto, as páginas com botões da IA explicam por que eles estão desligados. Se a mensagem
  // que conta os segundos saiu (outra página, a explicação do "Não entendi" ou a revisão fechou) ou não conta esta
  // espera, o aviso de erro conta no lugar dela. No resumo e no quiz, a explicação ou a revisão que falhou já conta.
  const pause = !!pausedUntil && ['Estudar', 'Dúvidas', 'Resumos', 'Quizzes'].includes(page) && error?.until !== pausedUntil
    && !(MATERIAL.includes(page) && [why?.error, answer?.review?.error].some(e => e?.until === pausedUntil))
    && { message: ERRORS.AI_RATE_LIMITED, until: pausedUntil };
  const problem = pause || error;
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

  // LazyMotion com domAnimation: só a parte da Motion que estas animações usam (sem arrastar nem layout). MotionConfig
  // com reducedMotion="user" é a rede de segurança: com movimento reduzido, nenhum deslocamento passa.
  return (
    <MotionConfig reducedMotion="user">
    <LazyMotion features={domAnimation} strict>
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
              setPage('Estudar');
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
            <span className="orb" aria-hidden="true"></span>
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
              troca no meio de outra (cut) a nova aparece parada e a do meio some na hora. */}
          <AnimatePresence mode="popLayout" custom={still}>
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
                    <p className="lead">Cole o texto da aula ou escreva um tema, escolha a área e o nível e gere o material.</p>
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
                      {/* Na espera, aria-disabled e não disabled: o botão desligado perdia o foco (addExample não pede
                          outro exemplo enquanto espera). */}
                      <button
                        type="button"
                        id="usar-exemplo"
                        className="tool"
                        aria-disabled={waiting || undefined}
                        onClick={addExample}
                      >
                        <Icon name="exemplo" />
                        <span className="full">Usar um exemplo</span>
                        {/* O custo só aparece quando o clique chama a IA (addExample); sem ela o exemplo é pronto. */}
                        {API_BASE && health?.ai_configured !== false && <small className="full">1 chamada de IA</small>}
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
                        funciona sem IA. */}
                    <p className="note" id="aviso-ia">
                      <Icon name={API_BASE && !aiOff ? 'privacidade' : 'info'} />
                      {aiOff ? (
                        <span>
                          A IA não está ligada neste computador: o botão de gerar fica desligado.{' '}
                          <a href="?demo">Ver a demonstração</a>
                        </span>
                      ) : API_BASE
                        ? 'Seu texto é enviado ao Google Gemini para gerar o material. Não cole dados pessoais.'
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
                        aria-describedby={aiOff ? 'aviso-ia' : undefined}
                        aria-busy={busy?.kind === 'gerar' || undefined}
                        onClick={() => generate()}
                      >
                        {/* A espera (o fio, os segundos e o Cancelar) fica na página do material ou na faixa de
                            cima: aqui o botão só diz que está gerando. */}
                        <Icon name={fresh ? 'refazer' : 'resumos'} />
                        {busy?.kind === 'gerar'
                          ? 'Gerando…'
                          : fresh ? 'Gerar de novo' : 'Gerar resumo, flashcards e quiz'}
                        {cost && busy?.kind !== 'gerar' && <small>1 chamada de IA</small>}
                      </button>
                    </div>
                  </m.div>
                  {errorBanner}
                  <m.section className="progress" aria-labelledby="progresso" variants={rise}>
                    <div className="progress-head">
                      <h2 id="progresso">Seu progresso</h2>
                      {mistakes.length > 0 && (
                        <button type="button" className="link" onClick={() => openPage('Erros')}>
                          {mistakes.length + (mistakes.length === 1 ? ' questão para rever' : ' questões para rever')}
                        </button>
                      )}
                      <button type="button" className="link" onClick={() => openPage('Desempenho')}>
                        Ver meu desempenho
                        <Icon name="seta" />
                      </button>
                    </div>
                    <div className="stats">
                      <Stat
                        value={streakDays + (streakDays === 1 ? ' dia' : ' dias')}
                        label={plural(streakDays, 'seguido de estudo', 'seguidos de estudo')}
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
                <m.div variants={rise}>
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
                            <Wait label={busy.label} orb={busy.orb} since={busy.since} onCancel={cancelAI} />
                          </div>
                        </div>
                        {tablist(true)}
                        <div role="tabpanel" aria-label={TABS.find(([p]) => p === page)?.[1]}>
                          {page === 'Resumos' ? <SummarySkeleton /> : page === 'Flashcards' ? <CardSkeleton /> : <QuizSkeleton />}
                        </div>
                      </m.section>
                    ) : !result ? (
                      <m.section key="vazio" className="panel empty" variants={focusIn} initial={live && appear()} animate="show" exit="exit">
                        <h2>Seu próximo aprendizado está por aqui.</h2>
                        <p>Adicione um texto para criar seu material de estudo.</p>
                        <div className="row center">
                          <button type="button" className="primary" onClick={() => openPage('Estudar')}>Adicionar conteúdo</button>
                          {saved.length > 0 && (
                            <button type="button" onClick={() => openPage('Biblioteca')}>
                              Abrir da biblioteca ({saved.length})
                            </button>
                          )}
                        </div>
                      </m.section>
                    ) : (
                      <m.section key="material" className="panel material" variants={focusIn} initial={live && appear()} animate="show" exit="exit">
                        {/* O material temporário do caderno de erros só tem quiz: sem o botão de salvar e sem as abas. */}
                        <div className="result-header">
                          <div>
                            <h2 id="material-titulo" tabIndex={-1}>{result.title}</h2>
                            <p className="meta">
                              {result.virtual ? 'Questões que você errou' : [result.area, result.level].filter(Boolean).join(' · ')}
                            </p>
                            {/* O aviso segue o material, e não o modo: só o da demonstração (semIA) não tem texto da IA.
                                O dos outros diz de onde ele veio (lib.js, originNote). */}
                            {result.virtual
                              ? aiNote
                              : result.semIA !== true && <p className="ai-note">{originNote(summary)}</p>}
                          </div>
                          {!result.virtual && (
                            <button type="button" aria-disabled={isSaved || undefined} onClick={isSaved ? undefined : save}>
                              <Icon name={isSaved ? 'check' : 'salvar'} />
                              {isSaved ? 'Salvo' : 'Salvar material'}
                            </button>
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
                                  <select value={size} onChange={e => setSize(e.target.value)}>
                                    <option value="todos">Todos os tópicos</option>
                                    <option value="6">Os 6 primeiros</option>
                                    <option value="3">Os 3 primeiros</option>
                                  </select>
                                </label>
                                <span className="topic-count">
                                  {'Mostrando ' + topics.length + ' de ' + summary.length +
                                    (summary.length === 1 ? ' tópico' : ' tópicos')}
                                </span>
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
                              <ol className="summary" role="list">
                                {topics.map((s, i) => (
                                  <li key={i}>
                                    <span className="topic-n" aria-hidden="true">{i + 1}</span>
                                    <div>
                                      <h3 tabIndex={-1}>{s.concept}</h3>
                                      <p>{s.text}</p>
                                      {s.source?.trim() && <p className="source">{sourceLabel(s)}</p>}
                                      {/* Sem trecho, ou com trecho do exemplo da própria IA, nada conferiu o tópico. O
                                          exemplo pronto não é da IA: o trecho dele confere, como o do aluno. */}
                                      {result.semIA !== true && (s.ia || !s.source?.trim()) && (
                                        <span className="ai-tag">Explicação da IA: confira</span>
                                      )}
                                      {API_BASE && (
                                        <div className="ai-ask">
                                          <button
                                            type="button"
                                            id={'explicar-' + i}
                                            aria-disabled={waiting || undefined}
                                            onClick={() => explain(s, whyTopic(s.concept), s.text, 'explicar-' + i)}
                                          >
                                            Não entendi, me explique <small>1 chamada de IA</small>
                                          </button>
                                        </div>
                                      )}
                                      {why?.item === s && <Why {...why} wait={busy} onCancel={cancelAI} pop={pop} focusIn={focusIn} />}
                                    </div>
                                  </li>
                                ))}
                              </ol>
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
                              <button
                                type="button"
                                className="primary"
                                onClick={() => openPage('Flashcards', ['.flashcard', 'main h1'])}
                              >
                                Estudar flashcards deste resumo
                                <Icon name="seta" />
                              </button>
                            </>
                          )}
                          {page === 'Flashcards' && (session.pos >= session.queue.length ? (
                            // Fim do baralho (Jhey): o painel sobe com um balanço curto e a caneta passa por cada cartão.
                            <m.div className="empty deck-done" variants={calm ? POP_CALM : FINALE} initial={appear()} animate="show">
                              <h2 tabIndex={-1}>Baralho concluído</h2>
                              <p>{deckSummary(session)}</p>
                              <DeckMarks session={session} finale />
                              {/* Recomeçar tira esta tela, com o botão: o foco vai para o primeiro cartão. */}
                              <div className="row center">
                                <button
                                  type="button"
                                  className="primary"
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
                                    setFlip(false);
                                    focusAfter.current = ['.flashcard'];
                                  }}
                                >
                                  Recomeçar
                                </button>
                                <span className="tag">{flip ? 'Resposta' : 'Pergunta'}</span>
                              </div>
                              <Meter value={session.pos} max={session.queue.length} label="Cartões avaliados" />
                              <DeckMarks session={session} fresh />
                              <button
                                type="button"
                                className={'flashcard' + (flip ? ' flipped' : '')}
                                onClick={() => {
                                  setFlip(!flip);
                                  // Só o nome do botão muda ao virar, e nem todo leitor de tela lê: a região fixa diz a
                                  // face nova (flip ainda é o de antes do clique).
                                  say(flip ? 'Pergunta: ' + card.question : 'Resposta: ' + card.answer);
                                  cardMotion.current = 'perspective(900px) rotateX(-10deg)';
                                }}
                              >
                                <span ref={cardText} className="face-text">{flip ? card.answer : card.question}</span>
                                {/* A dica serve ao mouse, ao toque e ao teclado. */}
                                <span className="face-hint">
                                  <Icon name="refazer" />
                                  {flip ? 'Mostrar a pergunta' : 'Mostrar a resposta'}
                                </span>
                              </button>
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
                                    setFlip(false);
                                    cardMotion.current = 'translateX(12px)';
                                    toast('Cartão movido para o final do baralho');
                                  }}
                                >
                                  <Icon name="refazer" />
                                  Revisar depois
                                </button>
                                <button type="button" className="primary" disabled={!flip} onClick={() => cardNext(true)}>
                                  <Icon name="check" />
                                  Acertei
                                </button>
                              </div>
                            </>
                          ))}
                          {page === 'Quizzes' && (done ? (
                            // Fim do quiz (Jhey): o painel sobe com um balanço curto e a caneta marca cada erro, em fila.
                            <m.div className="empty quiz-done" variants={calm ? POP_CALM : FINALE} initial={appear()} animate="show">
                              <h2 tabIndex={-1}>{Math.round(right / Math.max(1, answers.length) * 100)}% de aproveitamento</h2>
                              <p>Você acertou {right} de {answers.length}.</p>
                              {wrong.length > 0 ? (
                                <ol className="review" role="list">
                                  {wrong.map((q, i) => (
                                    <li key={i}>
                                      <Pen kind="errei" draw delay={0.3 + Math.min(i, 8) * 0.08} />
                                      <div>
                                        <strong>{q.question}</strong>
                                        <span>Sua resposta: {q.type === 'short' ? q.given : q.options[q.given]}</span>
                                        <span>Resposta certa: {expectedText(q)}</span>
                                        {q.explanation && <span>{q.explanation}</span>}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p>Você acertou todas!</p>
                              )}
                              {/* O estudante novo descobre o caderno aqui. No quiz do próprio caderno já há "Voltar ao
                                  caderno". A frase só aparece enquanto vale: o fim do quiz continua na tela na volta de
                                  outra página, e o aluno pode ter tirado do caderno uma das questões. */}
                              {wrong.length > 0 && !result.virtual &&
                                wrong.every(q => mistakes.some(e => e.key === mistakeKey(result.title, q.question))) && (
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    restartQuiz();
                                    focusAfter.current = QUESTION_FOCUS;
                                  }}
                                >
                                  Refazer o quiz todo
                                </button>
                                {result.virtual ? (
                                  <button type="button" onClick={() => openPage('Erros')}>Voltar ao caderno</button>
                                ) : (
                                  <button type="button" onClick={() => openPage('Flashcards', ['.flashcard', 'main h1'])}>
                                    Ir para os flashcards
                                  </button>
                                )}
                              </div>
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
                                <span className="tag">
                                  {quiz.type === 'short' ? 'Resposta curta'
                                    : quiz.type === 'boolean' ? 'Verdadeiro ou falso'
                                    : 'Múltipla escolha'}
                                </span>
                              </div>
                              <Meter value={answers.length} max={quizList.length} label="Questões respondidas" />
                              <QuizMarks total={quizList.length} answers={answers} idx={idx} />
                              {result.virtual && <p className="hint">Do material: {quiz.title}</p>}
                              {/* O enunciado dá a descrição da caixa da resposta e o nome do grupo das alternativas: o
                                  leitor de tela lê a pergunta junto com elas. */}
                              <h2 id={'questao-' + idx} className="quiz-question" tabIndex={-1}>{quiz.question}</h2>
                              {quiz.type === 'short' ? (
                                // Questão nova ou recomeçada: o campo abre vazio. Respondida, ele mostra o que o aluno
                                // escreveu, também na volta de outra aba ou página.
                                <form
                                  key={idx + '-' + answers.length}
                                  className="quiz-form"
                                  onSubmit={e => {
                                    e.preventDefault();
                                    const field = e.target.elements.response;
                                    // Só espaços vale como campo vazio: limpo, o campo mostra o aviso do required.
                                    // Enviado, virava erro gravado no desempenho e no caderno de erros.
                                    if (!field.value.trim()) {
                                      field.value = '';
                                      field.reportValidity();
                                      return;
                                    }
                                    submit(field.value);
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
                                  <button disabled={answer !== null} className="primary">Responder</button>
                                </form>
                              ) : (
                                <div className="options" role="group" aria-labelledby={'questao-' + idx}>
                                  {quiz.options.map((o, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      disabled={answer !== null}
                                      className={'option' + (answer && i === quiz.answer ? ' correct' : answer?.value === i ? ' wrong' : '')}
                                      onClick={() => submit(i)}
                                    >
                                      <span className="letter">{String.fromCharCode(65 + i)}</span>
                                      <span className="option-text">{o}</span>
                                      {/* Certo e errado também em texto: a cor sozinha não serve a quem não a distingue. */}
                                      {answer && i === quiz.answer && <Pen kind="certo" note="certa" draw />}
                                      {answer?.value === i && i !== quiz.answer && <Pen kind="errei" note="sua resposta" draw />}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* O retorno entra em 0,35 s e sai na hora, junto com a questão: o aluno passa de questão a
                                  cada uma (com saída, ele pulava 132 px e ficava legível embaixo da questão nova). */}
                              {answer && (
                                <m.div
                                  key={'retorno-' + idx}
                                  className={'feedback ' + (answer.ok ? 'good' : 'bad')}
                                  role="status"
                                  variants={pop}
                                  initial={appear()}
                                  animate="show"
                                >
                                  <strong id="retorno" tabIndex={-1}>{answer.ok ? 'Acertou!' : 'Vamos revisar esse conceito.'}</strong>
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
                                      <Wait label={busy.label} orb={busy.orb} since={busy.since} onCancel={cancelAI} />
                                    </div>
                                  )}
                                  {answer.review?.verdict && (
                                    <m.div variants={focusIn} initial={appear()} animate="show">
                                      <p><strong>Revisão da IA: {answer.review.verdict}</strong></p>
                                      <p>{answer.review.feedback}</p>
                                      <p>{VERDICT_EFFECT[answer.review.verdict]}</p>
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
                                        onClick={() => explain(quiz, whyQuestion(quiz, answer.value, answer.ok), quiz.explanation, 'explicar-questao')}
                                      >
                                        Não entendi, me explique <small>1 chamada de IA</small>
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
                                          Pedir revisão da IA <small>1 chamada de IA</small>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {/* No celular o botão fica preso acima da barra de baixo: o retorno pode ser longo. */}
                                  <div className="next-row">
                                    <button type="button" className="primary" onClick={nextQuestion}>
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
                <section className="chat-stage" data-state={chat.length ? 'conversa' : 'heroi'}>
                  <span className="moon" aria-hidden="true"></span>
                  <div className="chat-head">
                    {/* O fio embaixo do título tem a largura dele: os dois ficam numa caixa da largura do título. */}
                    <div className="chat-title-box">
                      <m.h1 id="chat-titulo" className="chat-title" tabIndex={-1} variants={hero.title}>
                        Como posso ajudar hoje?
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
                      {/* Mensagem nova entra; nenhuma sai com movimento (Nova conversa limpa na hora). As que já estavam
                          na conversa quando a página abriu não animam à parte (initial false). A pergunta enviada pelo
                          teclado aparece parada. A resposta toma o lugar do balão de espera, que esmaece por cima dela. */}
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
                        {/* O balão de espera só tem os três pontos: quem diz que o Cérebro está escrevendo é a pílula
                            acima da caixa, uma vez só para o leitor de tela. */}
                        {asking && (
                          <m.div
                            key="espera"
                            className="message assistant thinking"
                            aria-hidden="true"
                            variants={pop}
                            initial={appear()}
                            animate="show"
                            exit="exit"
                          >
                            <span className="dots"><span></span><span></span><span></span></span>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  {/* Uma só rolagem, a da página: com mensagens a caixa fica presa embaixo (acima da barra, no celular). */}
                  <div className="chat-dock">
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
                    {API_BASE && (
                      <m.div className="suggestions" role="group" aria-label="Sugestões de perguntas" variants={hero.chips}>
                        {chatHints.map((h, i) => (
                          <m.button
                            key={i}
                            type="button"
                            variants={hero.chip}
                            disabled={waiting}
                            onClick={() => {
                              // O chip fica desligado durante a espera, e o foco iria para o body: vai para a caixa (no
                              // toque não, para o teclado da tela não abrir sozinho).
                              if (!TOUCH) document.getElementById('pergunta').focus();
                              ask(h);
                            }}
                          >
                            {h}
                          </m.button>
                        ))}
                      </m.div>
                    )}
                  </div>
                  <div ref={chatEnd} className="chat-end"></div>
                </section>
              )}
              {page === 'Erros' && (
                <m.section className="panel" variants={rise}>
                  {mistakes.length > 0 && (
                    <div className="erros-head">
                      <p className="hint">
                        Uma questão sai daqui quando você acerta em outro dia, ou quando você mesmo a tira.
                      </p>
                      {/* As marcas são as da lista abaixo. A seta, como elas, fica fora do leitor de tela: ele lê os
                          passos da lista em ordem. */}
                      <ol className="ladder" role="list" aria-label="Caminho de uma questão no caderno">
                        <li><Pen kind="errei" /> errei</li>
                        <li><Icon name="seta" /><Pen kind="refazer" /> refazer em outro dia</li>
                        <li><Icon name="seta" /><Pen kind="certo" /> certo em outro dia: sai do caderno</li>
                      </ol>
                      <button type="button" className="primary" onClick={() => redoMistakes()}>
                        <Icon name="refazer" />
                        Refazer meus erros ({mistakes.length})
                      </button>
                    </div>
                  )}
                  {/* popLayout: a linha que sai deixa o fluxo na hora, e a lista sobe junto (undoNow, flipList). Fora da
                      condição da lista, como na Biblioteca: tirar a última questão não leva o Desfazer junto. */}
                  <AnimatePresence mode="popLayout" custom={byKeyboard()}>
                    {undo?.kind === 'erro' && <UndoRow key="desfazer" undo={undo} onUndo={undoNow} pop={pop} />}
                  </AnimatePresence>
                  {mistakes.length === 0 ? (
                    <div className="empty">
                      <h2>Nenhuma questão para rever.</h2>
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
                              // Errada hoje: ✗. De outro dia: ↻, já dá para refazer e tirar do caderno acertando.
                              const fresh = localDay(m.date) === today;
                              return (
                                <li key={m.key} data-key={m.key} data-flip>
                                  {/* Só a marca de um erro novo desde a última visita se desenha (penned), depois que a
                                      página assenta (~0,35 s); as outras o aluno já viu e aparecem prontas. */}
                                  <Pen
                                    kind={fresh ? 'errei' : 'refazer'}
                                    note={fresh ? 'errei hoje' : 'refazer'}
                                    draw={!penned.has(m.key + m.date)}
                                    delay={0.3 + Math.min(i, 6) * 0.06}
                                  />
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
                                    Tirar do caderno
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
                    streakDays={streakDays}
                    quizzes={quizzes}
                    cards={cards}
                    percent={percent}
                    chartArea={chartArea}
                    setChartArea={setChartArea}
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
                    redoMistakes={redoMistakes}
                    events={events}
                    backup={backupLine}
                    onExport={exportBackup}
                  />
                </Suspense>
              )}
              {page === 'Biblioteca' && (
                <Suspense fallback={<BibliotecaSkeleton rise={rise} />}>
                  <Biblioteca
                    rise={rise}
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
                    onRemove={(material, item) => leave(item, () => remove(material))}
                    onStart={() => openPage('Estudar')}
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
            <Wait label={busy.label} orb={busy.orb} since={busy.since} onCancel={API_BASE ? cancelAI : null} />
          </m.div>
        )}
      </AnimatePresence>
      <div className="toast-region" role="status">
        {/* Um aviso por vez: o novo entra enquanto o anterior esmaece fora do fluxo (popLayout). O mesmo texto outra vez
            (o cartão movido de novo) só renova o tempo, sem piscar. */}
        {/* anchorY bottom: a faixa fica presa embaixo, e o aviso que sai continua no mesmo lugar (com top ele pulava). */}
        {/* Só o mouse e o foco do teclado seguram o aviso. O toque virava "mouse em cima" e prendia o aviso por cima dos
            botões do cartão; na tela de toque o corpo dele deixa o toque passar (styles.css). */}
        <AnimatePresence mode="popLayout" anchorY="bottom" custom={byKeyboard()}>
          {notice && (
            <m.div
              key={notice.text}
              className="toast"
              variants={pop}
              initial={appear()}
              animate="show"
              exit="exit"
              onPointerEnter={e => e.pointerType === 'mouse' && holdNotice()}
              onPointerLeave={e => e.pointerType === 'mouse' && releaseNotice()}
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
              <h2 id="profile-title">{user ? 'Seu perfil' : 'Seu próximo aprendizado começa aqui.'}</h2>
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
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
    </LazyMotion>
    </MotionConfig>
  );
}

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
function Modal({ className, labelledBy, back, sheet = false, onClose, children }) {
  const box = useRef(null);
  const [present, safeToRemove] = usePresence();
  useLayoutEffect(() => {
    const dialog = box.current;
    const opener = document.activeElement;
    dialog.showModal();
    if (!byKeyboard()) {
      if (reduced()) {
        animate(dialog, { opacity: [0, 1] }, { duration: MODAL.calmIn });
      } else if (sheet) {
        // A curva da folha do iOS: sai rápido da barra e assenta devagar.
        animate(dialog, { transform: ['translateY(100%)', 'none'] }, { duration: MODAL.sheetIn, ease: MODAL.sheetEase });
      } else {
        const o = opener?.getBoundingClientRect?.();
        const d = dialog.getBoundingClientRect();
        if (o?.width) dialog.style.transformOrigin = (o.left + o.width / 2 - d.left) + 'px ' + (o.top + o.height / 2 - d.top) + 'px';
        animate(dialog, { opacity: [0, 1], transform: ['scale(0.96)', 'none'], filter: ['blur(4px)', 'blur(0px)'] }, { duration: MODAL.in, ease: EASE_OUT })
          .then(() => (dialog.style.filter = ''));
      }
    }
    return () => {
      if (dialog.open) dialog.close();
      // Quem abriu pode estar na página e fora da vista: com o celular girado para 600 px ou mais, o "Mais" some
      // (mobile.css). Aí vale o primeiro de back que está na tela.
      const shown = el => el?.isConnected && el.getClientRects().length > 0;
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
          {wait?.kind === 'why' && <Wait label={wait.label} orb={wait.orb} since={wait.since} onCancel={onCancel} />}
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
        <h2>Algo quebrou nesta tela.</h2>
        <button className="primary" onClick={() => window.location.reload()}>Recarregar a página</button>
      </section>
    );
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
