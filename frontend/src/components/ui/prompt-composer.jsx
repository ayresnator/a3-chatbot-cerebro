import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Icon } from '../../icons.jsx';
import { useFit } from '../../ui.jsx';
import { byKeyboard } from '../../anim.js';
import { AREAS, LEVELS, LEVEL_NOTES, askKey, rove, typeDelay } from '../../lib.js';

// Caixa do editor da tela Estudar (#61), o Prompt Composer do 21st.dev adaptado ao Cérebro: o cartão de vidro com o
// brilho que segue o ponteiro, a frase de exemplo que se escreve no campo vazio, o campo que cresce com o texto, a área
// em chips, o nível num menu e o "Perguntar ao Cérebro" que pulsa quando há o que enviar. Do original ficaram de fora o
// registro de construção e a prévia (uma simulação: aqui a espera e o resultado são de verdade e ficam na página do
// material), os anexos (o backend só recebe texto), os ícones de pixel e as frases que se escrevem e se apagam sem fim
// (WCAG 2.2.2). O texto, a área, o nível e quem pergunta continuam no App; as ferramentas do editor (ditado, arquivo,
// exemplo, limpar) chegam prontas, como filhos, e o arquivo solto sobre a caixa vai para o App (onFile).

// Mouse ou caneta: no toque não há ponteiro parado sobre a caixa para o brilho seguir.
const FINE = window.matchMedia('(pointer: fine)').matches;

// A frase de exemplo do campo vazio: o começo de um dos exemplos prontos da área, sorteado, que se escreve uma vez em
// menos de 5 s (lib.js, typeDelay) e fica parado. Com movimento reduzido, ou quando ela aparece por uma ação do teclado
// (Tab para fora do campo, setas nos chips), já vem inteira. Fica fora do leitor de tela (o campo tem o nome e a frase
// fixa dele) e da tradução do navegador, que trocaria o texto por baixo do React e derrubaria a tela.
function Typed({ lines }) {
  const calm = useReducedMotion();
  const [line] = useState(() => lines[Math.floor(Math.random() * lines.length)]);
  const [shown, setShown] = useState(() => (calm || byKeyboard() ? line.length : 0));
  useEffect(() => {
    if (shown) return;
    let n = 0;
    let timer = setTimeout(function tick() {
      setShown(++n);
      if (n < line.length) timer = setTimeout(tick, typeDelay(n));
    }, typeDelay(0));
    return () => clearTimeout(timer);
  }, []);
  return (
    <span className="typed" aria-hidden="true" translate="no">
      {line.slice(0, shown)}
      {shown < line.length && <i className="caret"></i>}
    </span>
  );
}

// A área em chips: um grupo de opções de verdade. Só o chip marcado entra no Tab; as setas, o Home e o End contam do
// chip com o foco, marcam outro e levam o foco junto (lib.js, rove). A linha fica fora do Tab (tabIndex -1): no Firefox,
// a linha que rola de lado no celular entraria no Tab como uma parada a mais.
function Chips({ label, options, value, onChange }) {
  const row = useRef(null);
  const at = options.indexOf(value);

  // No celular os chips ficam numa linha que rola de lado. O chip marcado, ou o que recebe o foco pelo teclado, fica à
  // vista inteiro, com o anel de foco (o respiro da esquerda) e antes da faixa que esmaece a ponta (o da direita); mais
  // largo que a linha, fica o começo dele. Rola só a linha: um scrollIntoView rolaria a página também. O foco pelo
  // ponteiro não rola: o chip andaria entre o toque e o fim dele, e o clique se perderia.
  function reveal(chip) {
    const line = row.current;
    const pad = getComputedStyle(line);
    const start = chip.offsetLeft - (parseFloat(pad.paddingLeft) || 0);
    const end = chip.offsetLeft + chip.offsetWidth + (parseFloat(pad.paddingRight) || 0);
    if (start < line.scrollLeft) line.scrollLeft = start;
    else if (end > line.scrollLeft + line.clientWidth) line.scrollLeft = Math.min(start, end - line.clientWidth);
  }
  useLayoutEffect(() => {
    const chip = row.current.children[at];
    if (chip) reveal(chip);
  }, [at]);

  function keys(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const chips = [...row.current.children];
    const from = chips.indexOf(e.target);
    const to = rove(e.key, from < 0 ? at : from, options.length);
    if (to < 0) return;
    e.preventDefault();
    onChange(options[to]);
    chips[to].focus();
  }

  return (
    <div
      ref={row}
      className="chips"
      role="radiogroup"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={keys}
      onFocus={e => byKeyboard() && e.target !== row.current && reveal(e.target)}
    >
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          className="chip"
          aria-checked={option === value}
          tabIndex={option === value ? 0 : -1}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

// O nível num menu de verdade: o botão abre a lista, o foco vai para o nível marcado, as setas, o Home e o End andam
// nela, e ela fecha com o Esc, com a escolha, com o próprio botão (os três devolvem o foco ao botão), com o Tab e com o
// clique fora.
function LevelMenu({ value, onChange }) {
  const wrap = useRef(null);
  const button = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // O menu inteiro fica à vista (no celular, acima da barra de baixo: mobile.css), e só então o foco vai ao nível
    // marcado: rolar só até ele deixava os outros níveis atrás da barra, longe do dedo.
    const menu = wrap.current.querySelector('[role=menu]');
    menu.scrollIntoView({ block: 'nearest' });
    menu.querySelector('[aria-checked=true]')?.focus({ preventScroll: true });
    const outside = e => {
      if (!wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close() {
    setOpen(false);
    button.current.focus();
  }

  function keys(e) {
    // O Shift + Tab volta ao botão: fecha como o Esc (o foco ficaria no botão com a lista ainda aberta).
    if (e.key === 'Escape' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      close();
      return;
    }
    // O Tab segue para onde o navegador mandar, e a lista fecha. No Safari, onde botão não entra no Tab, o foco sai da
    // página, e a lista ficaria aberta sem um jeito de fechar pelo teclado.
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    const items = [...e.currentTarget.children];
    const to = rove(e.key, items.indexOf(document.activeElement), items.length);
    if (to < 0) return;
    e.preventDefault();
    items[to].focus();
  }

  return (
    // O foco que vai para outro controle fecha a lista. O que vai para lugar nenhum não: é a janela que perdeu o foco,
    // ou o clique do Safari, que não dá o foco ao botão clicado e tira o foco do item marcado (a lista fecharia antes de
    // o clique chegar ao item).
    <div
      ref={wrap}
      className="level"
      onBlur={e => e.relatedTarget && !wrap.current.contains(e.relatedTarget) && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        className="level-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'niveis' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {/* Em 380 px ou menos só o nível aparece (mobile.css); "Nível:" continua no nome do botão. */}
        <span className="level-word">Nível:</span> {value}
        <Icon name="abaixo" />
      </button>
      {open && (
        <div id="niveis" className="level-menu" role="menu" aria-label="Nível de aprendizado" onKeyDown={keys}>
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              role="menuitemradio"
              aria-checked={level === value}
              tabIndex={-1}
              onClick={() => {
                onChange(level);
                close();
              }}
            >
              <span>{level}</span>
              <small>{LEVEL_NOTES[level]}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// reason: o id do aviso que diz por que o "Perguntar" está desligado (o teto do dia, App.jsx). Ele descreve o botão e o
// campo, onde o Ctrl + Enter não pergunta e não diz nada. topic: um tema sozinho vira material (só com a IA).
export function PromptComposer({
  value, onChange, onSend, area, onArea, level, onLevel, waiting, cost, reason, onFile, topic = true, children,
}) {
  const field = useRef(null);
  const [focused, setFocused] = useState(false);
  // Um arquivo arrastado sobre a caixa: ela mostra onde soltar, e o arquivo solto vai para onFile, como o do "Abrir
  // arquivo" (App.jsx, openFile). Só arquivo: o texto arrastado continua indo para o campo, como sempre.
  const [drop, setDrop] = useState(false);
  const carriesFile = e => e.dataTransfer.types.includes('Files');
  // O arquivo solto fora da caixa (no título, na dica, no botão de gerar) não abre aqui, e o navegador também não o
  // abre na aba no lugar do Cérebro: o cursor mostra que ali não se solta. O que a caixa já tratou passa.
  useEffect(() => {
    const away = e => {
      if (e.defaultPrevented || !carriesFile(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', away);
    window.addEventListener('drop', away);
    return () => {
      window.removeEventListener('dragover', away);
      window.removeEventListener('drop', away);
    };
  }, []);
  const ready = !waiting && !!value.trim();
  // Lido quando o botão liga ou desliga: o botão que liga pelo teclado (o texto digitado) não pulsa (styles.css).
  const quiet = useMemo(byKeyboard, [ready]);
  // As frases de exemplo saem dos exemplos prontos (exemplos.js), que ficaram fora do JavaScript da abertura: a caixa os
  // busca quando monta. Até eles chegarem o campo vazio fica sem frase, e ela só começa a se escrever depois de 0,9 s.
  const [examples, setExamples] = useState(null);
  useEffect(() => {
    import('../../exemplos.js').then(setExamples, () => {});
  }, []);
  useFit(field, value);

  // O brilho do vidro segue o ponteiro: a posição vai direto para o CSS da caixa (--mx e --my), sem redesenhar nada.
  // Com movimento reduzido o CSS o deixa parado no meio da borda de cima.
  function sheen(e) {
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', ((e.clientX - box.left) / box.width) * 100 + '%');
    e.currentTarget.style.setProperty('--my', ((e.clientY - box.top) / box.height) * 100 + '%');
  }

  return (
    <div
      className="editor"
      data-drop={drop || undefined}
      onPointerMove={FINE ? sheen : undefined}
      onDragOver={e => {
        if (!carriesFile(e)) return;
        e.preventDefault();
        setDrop(true);
      }}
      onDragLeave={e => !e.currentTarget.contains(e.relatedTarget) && setDrop(false)}
      onDrop={e => {
        if (!carriesFile(e)) return;
        e.preventDefault();
        setDrop(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="editor-field">
        <textarea
          ref={field}
          rows={1}
          aria-label="Conteúdo ou pergunta para o Cérebro"
          aria-describedby={reason ? 'composer-keyboard-hint ' + reason : 'composer-keyboard-hint'}
          maxLength={20000}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            // Ctrl + Enter (⌘ + Enter no Mac) pergunta; o Enter sozinho fica com a caixa de texto e quebra a linha
            // (lib.js, askKey). O atalho repetido de uma tecla presa não pergunta de novo.
            if (!askKey(e.nativeEvent)) return;
            e.preventDefault();
            if (ready && !e.repeat) onSend();
          }}
          placeholder={topic ? 'Cole seu texto, anotações ou escreva um tema…' : 'Cole seu texto ou anotações…'}
        />
        {/* Com o foco no campo vale a frase fixa dele (placeholder); sem o foco ela some (styles.css) e a frase de
            exemplo se escreve no lugar. A key sorteia outra frase quando a área troca. */}
        {!value && !focused && examples && <Typed key={area} lines={examples.openers(area)} />}
        {drop && <span className="drop-note" aria-hidden="true">Solte para abrir o arquivo</span>}
      </div>
      <div className="editor-bar">
        <Chips label="Área de conhecimento" options={AREAS} value={area} onChange={onArea} />
        <LevelMenu value={level} onChange={onLevel} />
      </div>
      <div className="editor-tools">
        {children}
        {/* O contador e o "Perguntar" andam juntos: quando a linha quebra, os dois descem, à direita. */}
        <span className="editor-send">
          <span className="counter">{value.length.toLocaleString('pt-BR')} / 20.000</span>
          <button
            type="button"
            className="ask"
            data-quiet={(ready && quiet) || undefined}
            disabled={!ready}
            aria-describedby={reason}
            onClick={onSend}
          >
            {/* Em 550 px ou menos e no celular deitado o custo sai da tela, e em 380 px ou menos só "Perguntar" aparece
                (mobile.css); o nome inteiro e o custo continuam no botão. */}
            <span className="full">Perguntar ao Cérebro</span>
            {cost && <small>1 chamada de IA</small>}
            <span className="short" aria-hidden="true">Perguntar</span>
            <Icon name="seta" />
          </button>
        </span>
      </div>
    </div>
  );
}
