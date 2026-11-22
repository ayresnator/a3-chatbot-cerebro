import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { m } from 'motion/react';
import { Icon } from './icons.jsx';
import { appear, undoExit } from './anim.js';
import { addDays, planLine } from './lib.js';

// Pedaços de tela usados por mais de uma página (App.jsx e as páginas carregadas à parte): os contadores, a linha do
// backup, o plano até a prova e a data dela, o "Desfazer", a espera de um pedido à IA, os esqueletos e o campo que cresce
// com o texto.

// Campo de várias linhas (field é o ref dele) que cresce com o texto entre o mínimo e o máximo do CSS e volta ao mínimo
// quando esvazia: a caixa do Dúvidas e o editor do Estudar. Medir encolhe o campo por um instante: a rolagem da página
// volta ao lugar em vez de pular.
export function useFit(field, value) {
  function fit() {
    const el = field.current;
    const top = window.scrollY;
    el.style.height = '0px';
    el.style.height = el.scrollHeight + 'px';
    if (window.scrollY !== top) window.scrollTo(0, top);
  }
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    // A primeira medida pode sair antes de a fonte da página chegar (o rascunho volta logo na abertura): com a fonte,
    // as linhas mudam de largura, e o campo se mede de novo. O arquivo da fonte pode chegar depois do primeiro desenho
    // (font-display: swap): o ready pode já ter passado, e o loadingdone avisa quando ela termina de carregar.
    const refit = () => field.current && fit();
    document.fonts.ready.then(refit);
    document.fonts.addEventListener('loadingdone', refit);
    window.addEventListener('resize', fit);
    return () => {
      document.fonts.removeEventListener('loadingdone', refit);
      window.removeEventListener('resize', fit);
    };
  }, []);
}

// Contador da faixa de progresso, em frase ("3 dias seguidos de estudo"). No Estudar e no Desempenho cada contador é um
// cartão de número, e o primeiro fica em destaque (styles.css, .stats).
export function Stat({ value, label }) {
  return <p className="stat"><strong>{value}</strong> {label}</p>;
}

// Pé da Biblioteca e do Desempenho: os dados ficam só neste navegador, a data do último backup e o botão que baixa o
// mesmo arquivo do Exportar. Quando há o que perder (lib.js, backupStatus), a linha lembra o backup e o botão ganha
// destaque. variants: no Desempenho a linha é um bloco da página e entra como os outros.
export function BackupNote({ status, onExport, variants }) {
  return (
    <m.div className="backup-note" variants={variants}>
      <p>
        Seus dados ficam só neste navegador. Limpar os dados do navegador apaga tudo. <strong>{status.text}.</strong>
        {status.due && ' Faça um backup para não perder o que é novo.'}
      </p>
      <button type="button" className={status.due ? 'primary' : undefined} onClick={onExport}>
        <Icon name="exportar" />
        Fazer backup
      </button>
    </m.div>
  );
}

// Plano até a prova (#86; lib.js, studyPlan): uma linha por material com a prova mais próxima e o botão que abre a
// tarefa de hoje, na faixa "Seu progresso" do Estudar e no começo de "Seu próximo passo", no Desempenho. A tarefa feita
// e os cartões em dia ficam sem botão. O nome do botão leva o material: com dois na lista, eles não se confundem.
const TASK_BUTTONS = {
  quiz: ['Fazer o quiz', 'quizzes'],
  cartoes: ['Revisar os cartões', 'flashcards'],
  erros: ['Refazer os erros', 'refazer'],
  prova: ['Abrir o resumo', 'resumos'],
};
export function StudyPlan({ rows, onOpen }) {
  return (
    <div className="plan">
      <ul role="list">
        {rows.map(row => {
          const [label, icon] = TASK_BUTTONS[row.task];
          return (
            <li key={row.material.title}>
              <p>{planLine(row)}</p>
              {(row.task === 'prova' || row.left.length > 0) && (
                <button type="button" aria-label={label + ' de "' + row.material.title + '"'} onClick={() => onOpen(row)}>
                  <Icon name={icon} />
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="hint">Plano sugerido pelo app, sem IA. Não é promessa de nota.</p>
    </div>
  );
}

// "Data da prova", no cabeçalho do material (#86). A data vale completa e dentro do prazo, de hoje a um ano, e o campo
// vazio apaga a data. Ela é gravada 0,4 s depois da última mudança, como o rascunho (cada seta gravava a biblioteca
// inteira e trocava o aviso), e na hora com o Enter, ao sair do campo ou ao sair da página. O que não vale (fora do
// prazo ou só um pedaço da data, badInput) fica no campo, sem gravar; ao sair dele, ganha a nota, que o leitor de tela
// ouve (say). Durante a digitação não: o ano passa por 0002 e 0202. Ao apagar as três partes, o Chrome só avisa a
// primeira: o campo é lido também ao soltar o Backspace e o Delete. Na tela o rótulo é "Prova": com ele, o campo e o
// "Salvar material" cabem numa linha em 390 px. O nome inteiro fica no campo.
export function ExamDate({ value, today, onSave, say }) {
  const [edit, setEdit] = useState(null);
  const timer = useRef(0);
  const pending = useRef(null);
  useEffect(() => {
    const flush = () => pending.current?.();
    const hide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hide);
      clearTimeout(timer.current);
    };
  }, []);
  function read({ value: day, validity }, now) {
    clearTimeout(timer.current);
    pending.current = null;
    if (!validity.valid) {
      const note = validity.badInput ? 'Complete a data ou apague as três partes.'
        : 'Escolha uma data entre hoje e daqui a um ano.';
      setEdit({ day, note: now ? note : '' });
      if (now) say(note);
    } else if (day === value) setEdit(null);
    else {
      setEdit({ day });
      pending.current = () => {
        clearTimeout(timer.current);
        pending.current = null;
        onSave(day);
      };
      if (now) pending.current();
      else timer.current = setTimeout(pending.current, 400);
    }
  }
  return (
    <div className="exam-date">
      <label className="inline-field">
        Prova
        <input
          type="date"
          aria-label="Data da prova"
          min={today}
          max={addDays(today, 365)}
          value={edit ? edit.day : value}
          aria-invalid={!!edit?.note || undefined}
          aria-describedby={edit?.note ? 'prova-nota' : undefined}
          onChange={e => read(e.target)}
          onKeyUp={e => (e.key === 'Backspace' || e.key === 'Delete') && read(e.target)}
          onKeyDown={e => e.key === 'Enter' && read(e.target, true)}
          onBlur={e => read(e.target, true)}
        />
      </label>
      {edit?.note && <p className="hint" id="prova-nota">{edit.note}</p>}
    </div>
  );
}

// "Desfazer" que fica na lista até o aluno sair da página: o aviso some sozinho, este não. Fica dentro de um
// AnimatePresence com popLayout: entra como os outros blocos pequenos (anim.js, POP), e ao sair deixa o fluxo na
// hora, para a lista subir junto em vez de pular no fim da saída (o popLayout mede a linha pelo ref). A saída é a
// dela (anim.js, undoExit): mais curta que a dos outros blocos, porque a lista sobe por baixo.
export const UndoRow = React.forwardRef(function UndoRow({ undo, onUndo, pop }, ref) {
  const variants = useMemo(() => ({ ...pop, exit: undoExit }), [pop]);
  return (
    <m.div ref={ref} className="undo-row" variants={variants} initial={appear()} animate="show" exit="exit">
      <span id="desfazer-texto">{undo.text}</span>
      <button type="button" aria-describedby="desfazer-texto" onClick={() => onUndo(undo)}>
        <Icon name="desfazer" />
        Desfazer
      </button>
    </m.div>
  );
});

// Segundos de um pedido à IA, contados de quando ele saiu (since), e o limite de verdade: a resposta costuma chegar
// em menos de 1 min, e o navegador desiste em 105 s (App.jsx, requestAPI). Fora do que o leitor de tela lê: ele
// anunciaria um número por segundo.
export function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="elapsed" aria-hidden="true">
      {seconds > 0 && seconds + ' s'}
      <span className="wait-limit">
        {(seconds > 0 ? ' · ' : '') + (seconds < 60 ? 'a IA pode levar até 1 min' : 'o limite é 105 s')}
      </span>
    </span>
  );
}

// Segundos que faltam para os botões da IA voltarem depois do limite por minuto (until: a hora da volta, App.jsx). Os
// números ficam fora do leitor de tela, como no Elapsed; "Pode tentar de novo." entra no fim, dentro do alerta do erro,
// e é lido uma vez.
export function Countdown({ until }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.ceil((until - now) / 1000);
  return seconds > 0 ? <span className="elapsed" aria-hidden="true">{'Faltam ' + seconds + ' s.'}</span> : 'Pode tentar de novo.';
}

// O lugar do orbe vazio: 20 px, com o display block do canvas dele e a mesma classe e o mesmo style (a espera pede
// inline-block).
function Hole({ className, style }) {
  return <span className={className} style={{ width: 20, height: 20, display: 'block', ...style }} aria-hidden="true"></span>;
}

// O orbe chega à parte (React.lazy): só as esperas da IA e o ditado o mostram, e o código dele (27 kB) saiu do
// JavaScript da abertura. O App o busca quando o navegador fica livre; até ele chegar, fica o lugar vazio. Se o arquivo
// não vier (sem rede, ou uma versão nova publicada com a aba aberta), o lugar fica vazio: sem isto, o erro derrubava a
// tela inteira (ErrorBoundary, App.jsx).
const ThinkingOrb = lazy(() => import('thinking-orbs').then(mod => ({ default: mod.ThinkingOrb }), () => ({ default: Hole })));
// O canvas do orbe não lê var(--accent): a cor sai do CSS uma vez, no primeiro orbe, e trocar o ciano no styles.css
// troca o orbe junto.
let accent = '';

// Orbe da IA (thinking-orbs): 20 px, no tema escuro e no ciano do --accent (styles.css). Fica fora do leitor de tela: o
// texto ou o nome do botão ao lado já diz o que acontece.
export function Orb(props) {
  accent ||= getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return (
    <Suspense fallback={<Hole {...props} />}>
      <ThinkingOrb size={20} theme="dark" color={accent} aria-hidden="true" {...props} />
    </Suspense>
  );
}

// Espera de um pedido à IA: um fio indeterminado (nada aqui finge saber quanto falta), o que está acontecendo, os
// segundos, o limite e o Cancelar. Fica no lugar onde a resposta vai entrar, ou na faixa de cima (.busy) quando esse
// lugar não está na tela: nunca nos dois (App.jsx, waitInline), para o Cancelar não aparecer duas vezes.
// orb é o estado do orbe antes do texto. Ele fica dentro do texto, e não ao lado: numa espera estreita o texto quebra
// junto com ele em vez de descer sozinho para a linha de baixo.
export function Wait({ label, since, onCancel, orb }) {
  return (
    <div className="wait">
      <span className="wait-bar" aria-hidden="true"></span>
      <span className="wait-text">
        {/* A biblioteca põe display block no style; inline-block deixa o orbe na linha do texto (styles.css, .wait-orb). */}
        {orb && <Orb state={orb} className="wait-orb" style={{ display: 'inline-block' }} />}
        {label} <Elapsed since={since} />
      </span>
      {onCancel && <button type="button" className="link" onClick={onCancel}>Cancelar</button>}
    </div>
  );
}

// Bloco do esqueleto: parado, em tom baixo, na largura e na altura do que vai chegar no lugar. Só aparece numa espera
// de verdade; quem se move é o fio da espera, um só por vez.
export function Sk({ w, h, className = '' }) {
  return <span className={'sk' + (className ? ' ' + className : '')} style={{ width: w, height: h }} aria-hidden="true"></span>;
}

const TOPIC_W = ['48%', '36%', '54%', '42%', '30%', '46%'];

// Resumo a caminho: a linha de ferramentas, o bloco "Tente responder antes de ler" quando ele vai abrir (pretest; senão,
// o botão "Tentar antes de ler" na linha) e seis tópicos numerados com título e três linhas, como o .summary pronto.
export function SummarySkeleton({ pretest }) {
  return (
    <div aria-hidden="true">
      <div className="row summary-tools">
        <Sk w="11rem" className="sk-control" />
        <Sk w="9rem" />
        <Sk w="8.5rem" className="sk-check" />
        {!pretest && <Sk w="10rem" className="sk-control" />}
        <Sk w="6.5rem" className="sk-control" />
      </div>
      {pretest && (
        <div className="pretest">
          <h3><Sk w="15rem" /></h3>
          <p className="hint">
            <Sk w="100%" />
            <Sk w="100%" className="sk-phone" />
            <Sk w="100%" className="sk-phone" />
            <Sk w="60%" />
          </p>
          {['60%', '45%'].map(w => (
            <div key={w} className="pretest-item">
              <p><Sk w={w} /></p>
              <Sk className="sk-area" />
            </div>
          ))}
          <div className="row">
            <Sk w="7.5rem" className="sk-control" />
            <Sk w="4.25rem" className="sk-control" />
          </div>
        </div>
      )}
      <ol className="summary" role="list">
        {TOPIC_W.map((w, i) => (
          <li key={i}>
            <Sk w="1rem" className="sk-n" />
            <div className="sk-measure">
              <Sk w={w} className="sk-h3" />
              <Sk className="sk-read" />
              <Sk w="94%" className="sk-read" />
              <Sk w="68%" className="sk-read" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Cartão a caminho: o cabeçalho do baralho, o cartão, o campo "Sua resposta" (com a caixa "Escrever antes de virar"
// ligada, write) e os três botões de avaliação.
export function CardSkeleton({ write }) {
  return (
    <div aria-hidden="true">
      <div className="study-head">
        <Sk w="7rem" />
        <Sk w="4.5rem" className="sk-tag" />
      </div>
      <div className="marks"></div>
      <div className="flashcard sk-card">
        <Sk w="70%" className="sk-face" />
        <Sk w="45%" className="sk-face" />
        <Sk w="11rem" />
      </div>
      {write && (
        <div className="card-form">
          <Sk w="10rem" className="sk-label" />
          <Sk className="sk-control" />
        </div>
      )}
      <div className="row center verdicts">
        <Sk w="7.5rem" className="sk-control" />
        <Sk w="9rem" className="sk-control" />
        <Sk w="7.5rem" className="sk-control" />
      </div>
    </div>
  );
}

const OPTION_W = ['70%', '55%', '62%', '48%'];

// Quiz a caminho: o cabeçalho, as marcas das questões, o enunciado e quatro opções. No cabeçalho, a etiqueta do tipo
// e a vaga da caixa "Marcar certeza" ficam juntas, como no quiz pronto.
export function QuizSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="study-head">
        <Sk w="7.5rem" />
        <div className="quiz-tools">
          <Sk w="8rem" className="sk-tag" />
          <Sk w="7.75rem" className="sk-check" />
        </div>
      </div>
      <div className="marks">
        {OPTION_W.concat(OPTION_W.slice(0, 2)).map((_, i) => <Sk key={i} className="sk-mark" />)}
      </div>
      <div className="quiz-question">
        <Sk w="92%" className="sk-face" />
        <Sk w="58%" className="sk-face" />
      </div>
      <div className="options">
        {OPTION_W.map((w, i) => (
          <div key={i} className="sk-option">
            <Sk className="sk-letter" />
            <Sk w={w} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Esqueletos das páginas carregadas à parte (App.jsx, lazyView): o Suspense mostra um deles só enquanto o código da
// página não chegou, com a mesma arrumação da página pronta. Em geral o código já veio antes (preload).
export function DesempenhoSkeleton({ rise }) {
  return (
    <>
      <m.div className="stats" variants={rise} aria-hidden="true">
        {['7rem', '9rem', '7rem', '10rem', '12rem'].map((w, i) => (
          <p key={i} className="stat"><Sk w={w} /></p>
        ))}
      </m.div>
      <m.section className="panel" variants={rise} aria-hidden="true">
        <div className="panel-head">
          <Sk w="18rem" className="sk-h2" />
          <Sk w="14rem" className="sk-control" />
        </div>
        <div className="chart">
          {[0.35, 0.6, 0.2, 0.8, 0.5, 0.15, 0.45].map((h, i) => (
            <div key={i}>
              <Sk w="2.5rem" />
              <span className="chart-bar sk-bar" style={{ '--h': h }}></span>
              <Sk w="2rem" />
            </div>
          ))}
        </div>
        <Sk w="70%" className="sk-note" />
        {/* A linha do acerto na hora e do que ficou, e a divisão dele (#78). */}
        <Sk w="80%" className="sk-note" />
        <Sk w="60%" className="sk-note" />
      </m.section>
      <m.section className="panel" variants={rise} aria-hidden="true">
        <Sk w="10rem" className="sk-h2" />
        <Sk w="60%" className="sk-note" />
      </m.section>
      {/* O painel "Sua certeza" (#80). */}
      <m.section className="panel" variants={rise} aria-hidden="true">
        <Sk w="7rem" className="sk-h2" />
        <Sk w="60%" className="sk-note" />
      </m.section>
    </>
  );
}

export function BibliotecaSkeleton({ rise }) {
  return (
    <m.section className="panel" variants={rise} aria-hidden="true">
      <div className="toolbar">
        <Sk className="sk-control sk-grow" />
        <Sk w="8rem" className="sk-control" />
        <Sk w="7rem" className="sk-control" />
        <Sk w="7rem" className="sk-control" />
      </div>
      <Sk w="80%" className="sk-note" />
      {/* A linha do simulado: o nome, a frase, o tamanho e o botão. */}
      <div className="exam-row">
        <div>
          <Sk w="5.5rem" className="sk-h3" />
          <Sk w="70%" />
        </div>
        <Sk w="8.5rem" className="sk-control" />
        <Sk w="11rem" className="sk-control" />
      </div>
      <ul className="library" role="list">
        {['55%', '40%', '62%'].map((w, i) => (
          <li key={i} className="library-item">
            <div>
              <Sk w="8rem" />
              <Sk w={w} className="sk-h3" />
              <Sk w="14rem" />
            </div>
            <Sk w="5.5rem" className="sk-control" />
            <Sk w="2.75rem" className="sk-control" />
          </li>
        ))}
      </ul>
    </m.section>
  );
}

// Formulário do perfil enquanto o código dele chega (o título e o texto já estão na janela): os dois rótulos na altura
// da linha deles, os dois campos e o botão, nas medidas do formulário pronto. A janela não muda quando ele chega.
export function PerfilSkeleton() {
  return (
    <div className="profile-form" aria-hidden="true">
      {['11rem', '9rem'].map(w => (
        <span key={w} className="sk-field">
          <Sk w={w} className="sk-label" />
          <Sk className="sk-control" />
        </span>
      ))}
      <Sk className="sk-control sk-submit" />
    </div>
  );
}

// Onde o fundo em ondas roda: a tela larga do computador, com mouse. Na tela estreita o texto fica direto sobre o fundo,
// e as ondas claras derrubariam o contraste; celular e tablet deitados, sem mouse, também ficam de fora. Em cores
// forçadas o fundo é do sistema. Acompanha a janela e as preferências do sistema enquanto a página está aberta. A
// largura é a em que o dock entra (mobile.css), em rem como lá: 851 px com a letra padrão.
const WAVES_MEDIA = ['(min-width: 53.1875rem) and (hover: hover) and (pointer: fine)', '(forced-colors: active)',
  '(prefers-reduced-motion: reduce)', '(prefers-contrast: more), (forced-colors: active)']
  .map(query => window.matchMedia(query));
// Onde as ondas rodam, o fundo parado entra antes da primeira tela (data-waves, styles.css) e o pedaço delas é pedido
// junto com o app (issue #136). O Waves pede de novo e recebe o mesmo módulo; a falha é dele para tratar.
if (WAVES_MEDIA[0].matches && !WAVES_MEDIA[1].matches) {
  document.documentElement.setAttribute('data-waves', '');
  import('./waves.js').catch(() => {});
}
function watchWavesMedia(change) {
  WAVES_MEDIA.forEach(list => list.addEventListener('change', change));
  return () => WAVES_MEDIA.forEach(list => list.removeEventListener('change', change));
}
export function useWavesAllowed() {
  return useSyncExternalStore(watchWavesMedia, () => WAVES_MEDIA[0].matches && !WAVES_MEDIA[1].matches);
}
// Movimento reduzido no sistema, lido ao vivo: as ondas param, e voltam a andar, sem recarregar a página. O
// useReducedMotion da Motion, que o resto do app usa, guarda o valor da abertura.
export function useWavesStill() {
  return useSyncExternalStore(watchWavesMedia, () => WAVES_MEDIA[2].matches);
}
// Contraste alto ou cores forçadas: a lua do Dúvidas sai da tela (styles.css), e o "Fundo animado" só tem as ondas
// para parar.
export function useMoonHidden() {
  return useSyncExternalStore(watchWavesMedia, () => WAVES_MEDIA[3].matches);
}

// Fundo em ondas (issue #92), onde useWavesAllowed deixa (on). Com animate falso (movimento reduzido ou o "Fundo animado"
// desligado, App.jsx), o quadro fica parado. O shader vem num pedaço à parte do JS (waves.js), baixado só
// onde as ondas rodam. data-waves no html deixa o vidro da barra de cima, do dock e do palco opaco e põe o fundo
// parado nas margens (styles.css); com o primeiro quadro ele vira "on", e o canvas aparece por cima. Sem WebGL, ou
// com o contexto perdido, volta a ficar sem valor: fica o fundo parado. Numa troca de animate o "on" fica: o canvas
// guarda o último quadro até o do novo começo sair. onActive leva ao App o que o startWaves
// avisa: sem as ondas (false), o botão "Fundo animado" fica só com a lua do Dúvidas para parar.
export function Waves({ on, animate, onActive }) {
  const canvas = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!on) {
      root.removeAttribute('data-waves');
      return;
    }
    // Sem valor, o fundo parado; "on", o canvas por cima. Num começo novo o "on" fica até o aviso seguinte.
    if (!root.hasAttribute('data-waves')) root.setAttribute('data-waves', '');
    const report = active => {
      root.setAttribute('data-waves', active ? 'on' : '');
      onActive(active);
    };
    let stop = null;
    let live = true;
    import('./waves.js').then(({ startWaves }) => {
      if (live) stop = startWaves(canvas.current, { animate, onActive: report });
    }, () => report(false));
    return () => {
      live = false;
      stop?.();
    };
  }, [on, animate]);
  // O contexto pode se perder com as ondas desligadas (a janela estreitada para menos de 851 px, por exemplo): sem
  // ninguém ouvindo a perda, o navegador não o devolve, e as ondas só voltariam com a página recarregada. Este ouvinte
  // fica o tempo todo e só pede a volta; com as ondas ligadas, o do waves.js cuida do resto.
  useEffect(() => {
    canvas.current.addEventListener('webglcontextlost', e => e.preventDefault());
    return () => document.documentElement.removeAttribute('data-waves');
  }, []);
  return <canvas ref={canvas} className="waves" aria-hidden="true" />;
}
