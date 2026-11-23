// Movimento do app de estudo, pela skill design-motion-principles (github.com/kylezantos/design-motion-principles),
// com os pesos que o dono confirmou: Emil primeiro (o que o aluno faz muitas vezes fica instantâneo ou quase), Jakub
// depois (entrada = opacidade, 8 px de subida e 4 px de desfoque numa mola sem balanço; saída mais curta e mais
// discreta), Jhey só nos estados vazios e no fim do baralho e do quiz.
// Regras deste arquivo: nada que o teclado disparou se move; só transform, opacity e filter; movimento reduzido é só a
// opacidade, curta, sem deslocamento nem desfoque. O desfoque fica só no título da página, onde ele diz "entrou em
// foco": ele roda no fio principal a cada quadro, e no material que chega, na janela, no fim do baralho e do quiz e no
// material excluído pesava sem mudar a leitura. Os outros blocos só sobem e aparecem, e o bloco com uma lista de opções
// (<select>) dentro só esmaece (fade).
import { flushSync } from 'react-dom';
import { animate } from 'motion/mini';
import { stagger } from 'motion/react';

// Uma curva só, a --ease do styles.css (EASE_OUT); EASE_IN, que acelera para fora, só nas saídas. Três tempos, os do
// styles.css: 0,16 s no retorno e nas saídas curtas, 0,2 s na janela e no que esmaece, 0,36 s no que entra ou desliza.
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_IN = [0.55, 0, 1, 0.45];
// O que entra: a página (na abertura do app e na troca de seção), os blocos pequenos e o fim do baralho e do quiz.
const SPRING = { type: 'spring', duration: 0.36, bounce: 0 };

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Quem disparou a última ação: o teclado (Enter, Espaço, Esc, setas) ou o ponteiro (mouse, toque, caneta).
// <html data-input> leva o mesmo corte às transições do CSS. Tecla só de modificador (Shift, Ctrl) não conta.
let keyboard = false;
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
window.addEventListener('keydown', e => {
  if (MODIFIERS.has(e.key)) return;
  keyboard = true;
  document.documentElement.dataset.input = 'teclado';
}, true);
window.addEventListener('pointerdown', () => {
  keyboard = false;
  document.documentElement.dataset.input = 'ponteiro';
}, true);
export const byKeyboard = () => keyboard;

// Saída que não se move (custom = true nas variantes de saída): a ação veio do teclado, a página estava rolada, o
// aluno passou direto por ela ou o retorno da questão, que sai a cada questão.
const gone = { opacity: 0, transition: { duration: 0 } };
const FADE = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } } };

// Bloco da página: sobe 8 px; com blur, também sai de um desfoque de 4 px (só o título). Sem balanço a mola não passa
// do ponto (nada de desfoque negativo). No fim o filtro sai (transitionEnd): parado em blur(0px) ele deixaria o bloco
// numa camada à parte.
const rise = (transition, blur = false) => ({
  hidden: { opacity: 0, y: 8, ...(blur && { filter: 'blur(4px)' }) },
  show: { opacity: 1, y: 0, ...(blur && { filter: 'blur(0px)', transitionEnd: { filter: 'none' } }), transition },
});
// Bloco com uma lista de opções (<select>) dentro: só esmaece, na mesma mola, sem subir nem crescer. Mover um bloco com
// uma lista dentro fazia o Chromium recalcular o layout a cada quadro da entrada da página.
const fade = transition => ({ hidden: { opacity: 0 }, show: { opacity: 1, transition } });

// Página que abre: o m.div da página (view), o título (title) e os outros blocos (rise). A que sai só esmaece por cima
// da nova, numa mola curta que some logo no começo (AnimatePresence com popLayout a tira do fluxo na hora, e styles.css
// tira o clique dela): a troca nunca segura o aluno. Sem desfoque: 2 px de desfoque na página inteira paravam o
// desenho da tela por 0,2 a 0,3 s a cada troca (medido no Chromium), e a entrada da nova não aparecia.
// Troca de seção (ROUTINE): a nova começa na hora, na mola de 0,36 s; só o título e o bloco seguinte se escalonam
// (0,04 s), os outros vêm com o segundo. Assenta em ~0,4 s.
// Abertura do app (OPENING): os blocos entram um depois do outro, 0,04 s entre eles (uma página tem até 5), na mesma
// mola.
// Movimento reduzido (CALM): a página que sai some na hora (as duas esmaecendo juntas misturavam os títulos) e a nova
// esmaece de 0 a 1 em 0,16 s, sem subir.
const EXIT_FAST = { type: 'spring', duration: 0.16, bounce: 0 };
const VIEW = {
  hidden: {},
  show: { transition: { delayChildren: i => Math.min(i, 1) * 0.04 } },
  exit: still => (still ? gone : { opacity: 0, transition: EXIT_FAST }),
};
export const ROUTINE = { view: VIEW, title: rise(SPRING, true), rise: rise(SPRING), fade: fade(SPRING) };
export const OPENING = {
  view: { ...VIEW, show: { transition: { delayChildren: stagger(0.04) } } },
  title: rise(SPRING, true),
  rise: rise(SPRING),
  fade: fade(SPRING),
};
export const CALM = { view: { hidden: {}, show: {}, exit: gone }, title: FADE, rise: FADE, fade: FADE };

// Tela Dúvidas (#57, no estilo do Animated AI Chat): o título sobe 10 px, o fio embaixo dele se desenha da esquerda
// para a direita, a saudação aparece, a caixa esmaece e os chips entram em cascata. Vale na abertura da página e
// quando o herói volta (Nova conversa). Movimento reduzido: só a opacidade, curta, tudo junto.
// A caixa não cresce: as listas de área e de nível ficam dentro dela (fade, acima). Se ela trocar as listas por chips e
// um menu, como o editor do Estudar, o crescimento de 0,98 pode voltar.
export const HERO = {
  title: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: SPRING } },
  rule: { hidden: { opacity: 0, scaleX: 0 }, show: { opacity: 1, scaleX: 1, transition: { duration: 0.36, delay: 0.2, ease: EASE_OUT } } },
  lead: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.36, delay: 0.1, ease: EASE_OUT } } },
  box: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { ...SPRING, delay: 0.05 } } },
  chips: { hidden: {}, show: { transition: { delayChildren: stagger(0.06, { startDelay: 0.15 }) } } },
  chip: { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: SPRING } },
};
export const HERO_CALM = { title: FADE, rule: FADE, lead: FADE, box: FADE, chips: {}, chip: FADE };

// Bloco pequeno que aparece depois da página (erro, desfazer, retorno, aviso, mensagem, faixa de espera): sobe 6 px e
// aparece, sem desfoque; a saída é só a opacidade, na mola curta que some logo (com ease-in o retorno da questão
// anterior ficava legível embaixo da questão nova).
export const POP = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: SPRING },
  exit: still => (still ? gone : { opacity: 0, transition: EXIT_FAST }),
};
export const POP_CALM = {
  ...FADE,
  exit: still => (still ? gone : { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }),
};

// A linha "Desfazer" sai do fluxo na hora (popLayout) enquanto a lista sobe para o lugar dela. A saída é curta e cai
// logo no começo (ease-out), para a linha não ficar legível por cima da lista; no movimento reduzido a lista não
// desliza, então a linha some na hora.
export const undoExit = still => (still || reduced() ? gone : { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } });

// O que estava carregando ficou pronto no mesmo lugar (o material no lugar do esqueleto, a explicação no lugar das
// linhas): esmaece, sem subir, porque o lugar já era dele.
export const FOCUS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.36, ease: EASE_OUT } },
  exit: still => (still ? gone : { opacity: 0, transition: EXIT_FAST }),
};
export const FOCUS_CALM = POP_CALM;

// Fim do baralho e do quiz (Jhey: o único lugar com um pouco de brincadeira): sobe de 0,97, na mola sem balanço.
export const FINALE = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING },
};

// Janela e folha (App.jsx, Modal), em segundos. O fundo escuro é do CSS (styles.css, dialog::backdrop): entra em
// --t-fade e sai junto com elas, então out, sheetOut e calmOut têm de bater com as saídas de lá.
export const MODAL = {
  in: 0.2,
  out: 0.16, // = --t-fast, a saída do fundo da janela
  sheetIn: 0.36,
  sheetOut: 0.2, // = --t-fade, a saída do fundo da folha (.sheet[data-closing])
  // Reaberta no meio da saída.
  settle: 0.16,
  // Movimento reduzido: só a opacidade.
  calmIn: 0.16,
  calmOut: 0.16, // = --t-fast
};

// Primeiro estado de um bloco que entra: parado (initial false) quando a ação veio do teclado.
export const appear = () => (keyboard ? false : 'hidden');

// Texto que mudou no lugar (o cartão virado ou o seguinte): só ele esmaece de 0,3 e chega de start (um giro leve ou um
// passo para o lado) em 0,16 s; o cartão fica parado. Um clique no meio do caminho segue de onde o texto
// está, sem recomeçar: o animate do Motion com um valor só parte do valor atual. O estado final é o normal da página:
// se a animação falhar, o texto continua visível.
export function enter(el, start) {
  if (!el || keyboard) return;
  const calm = reduced();
  if (!el.getAnimations().length) {
    el.style.opacity = '0.3';
    if (!calm) el.style.transform = start;
  }
  animate(el, calm ? { opacity: 1 } : { opacity: 1, transform: 'none' }, { duration: 0.16, ease: EASE_OUT });
}

// Mudança numa lista sem pulo (FLIP): mede onde estava cada bloco [data-flip] de scope, aplica commit() na hora
// (flushSync) e faz quem mudou de lugar deslizar do lugar antigo ao novo, só com transform. Bloco novo esmaece.
export function flipList(scope, commit) {
  const blocks = () => (scope ? [...scope.querySelectorAll('[data-flip]')] : []);
  const before = new Map(blocks().map(el => [el, el.getBoundingClientRect().top]));
  flushSync(commit);
  if (!before.size || keyboard || reduced()) return;
  for (const el of blocks()) {
    const top = before.get(el);
    if (top === undefined) {
      animate(el, { opacity: [0, 1] }, { duration: 0.2, ease: EASE_OUT });
      continue;
    }
    const dy = top - el.getBoundingClientRect().top;
    if (Math.abs(dy) > 0.5) animate(el, { transform: ['translateY(' + dy + 'px)', 'none'] }, { duration: 0.36, ease: EASE_OUT });
  }
}

// Exclusão com saída marcada (uma saída que importa pode chamar mais atenção que as outras): o item desliza 16 px
// para a esquerda e some em 0,2 s; só então a exclusão acontece e a lista fecha o vão com flipList().
// Se a exclusão não acontecer (o navegador recusou gravar), o item volta.
export function leave(item, commit) {
  const scope = item?.closest('.panel');
  if (!item || keyboard || reduced()) return flipList(scope, commit);
  item.style.pointerEvents = 'none';
  animate(item, { opacity: 0, transform: 'translateX(-16px)' }, { duration: 0.2, ease: EASE_IN })
    .then(() => {
      flipList(scope, commit);
      if (!item.isConnected) return;
      item.style.pointerEvents = '';
      animate(item, { opacity: 1, transform: 'none' }, { duration: 0.16, ease: EASE_OUT });
    });
}
