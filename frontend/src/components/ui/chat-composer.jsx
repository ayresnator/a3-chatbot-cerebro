import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { Icon } from '../../icons.jsx';
import { useFit } from '../../ui.jsx';
import { appear, byKeyboard } from '../../anim.js';
import { AREAS, LEVELS, slashHints } from '../../lib.js';

// Caixa de pergunta da tela Dúvidas (#57), o Animated AI Chat do 21st.dev adaptado ao Cérebro: o campo de várias linhas
// que cresce com o texto, a faixa com os atalhos, a área e o nível (ou o material aberto, about), o botão que troca a
// fonte (swap) e o Enviar, a lista de atalhos que abre com "/" e o brilho que segue o ponteiro. Quem pergunta continua
// sendo o App (ask); aqui ficam o texto, o teclado e a lista.

// Mouse ou caneta: no toque não há ponteiro parado sobre a tela para o brilho seguir.
const FINE = window.matchMedia('(pointer: fine)').matches;
// A mola do brilho, a mesma do Animated AI Chat.
const FOLLOW = { damping: 25, stiffness: 150, mass: 0.5 };

// reason: o id do aviso que diz por que o Enviar está desligado (o teto do dia, App.jsx). Ele descreve o Enviar e o
// campo, onde o Enter não envia e não diz nada.
export function ChatComposer({
  value, onChange, onSend, hints, area, onArea, level, onLevel, about, swap, onSwap, waiting, touch, cost, status, note,
  reason, variants, pop,
}) {
  const field = useRef(null);
  const list = useRef(null);
  // Lista de atalhos: fechada (false), aberta pelo "/" (true) ou pelo botão ('todas'), e o item marcado nela.
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const calm = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glowX = useSpring(x, FOLLOW);
  const glowY = useSpring(y, FOLLOW);
  // Com "/" no começo, as sugestões que casam com o resto; aberta pelo botão, todas (até com um "/xyz" que não casa com
  // nenhuma), até o aluno digitar de novo. Sem o "/" (a caixa esvaziada pelo envio, por exemplo), nenhuma: a lista não
  // reabre sozinha depois de enviar um "/xyz" que não casava com nada.
  const items = open === 'todas' ? hints : slashHints(hints, value) ?? [];
  const shown = open && items.length > 0;
  // A lista encolhe enquanto o aluno digita: o item marcado nunca passa do último.
  const at = Math.min(active, items.length - 1);
  // O id de cada item é a posição dele na lista inteira: filtrar não dá a outro texto o id do item marcado, e o leitor de
  // tela anuncia o novo primeiro item (aria-activedescendant muda junto).
  const optionId = h => 'atalho-' + hints.indexOf(h);
  const current = shown ? optionId(items[at]) : undefined;
  const glow = focused && FINE && !calm;

  // O campo cresce com o texto entre o mínimo e o máximo do CSS (60 e 200 px) e volta ao mínimo quando esvazia depois
  // do envio.
  useFit(field, value);

  // Clique fora da lista, do botão de atalhos e do campo fecha a lista.
  useEffect(() => {
    if (!shown) return;
    const outside = e => {
      if (e.target !== field.current && !e.target.closest?.('.palette, .shortcuts')) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [shown]);

  // O item marcado pelas setas fica à vista quando a lista é mais alta que o espaço dela (rola só a lista, não a página).
  useEffect(() => {
    const option = current && document.getElementById(current);
    if (!option) return;
    const box = list.current;
    if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
    }
  }, [current]);

  // O pointermove só existe enquanto o campo tem o foco.
  useEffect(() => {
    if (!glow) return;
    const move = e => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [glow]);

  // Texto digitado: "/" no começo, sem espaço, abre a lista; qualquer outro texto a fecha (lib.js, slashHints).
  function type(text) {
    onChange(text);
    setOpen(slashHints(hints, text) !== null);
    setActive(0);
  }

  // O item vai para a caixa, sem enviar, com o cursor no fim. Ele entra pelo próprio campo (execCommand), como se fosse
  // digitado: o Ctrl+Z traz de volta o rascunho que ele trocou. No toque, sem teclado físico, o foco não vai para o
  // campo, para o teclado da tela não abrir sozinho: o item só troca o texto, e o aluno envia pelo botão.
  function pick(text) {
    setOpen(false);
    const el = field.current;
    if (!touch || byKeyboard()) el.focus();
    if (document.activeElement === el) {
      el.select();
      if (document.execCommand('insertText', false, text)) return;
    }
    onChange(text);
  }

  // O botão abre a lista com todas as sugestões e põe o foco no campo, de onde as setas, o Tab, o Enter e o Esc a
  // controlam. No toque o foco fica onde estava (o aluno toca no item), a não ser que o botão tenha vindo do teclado.
  function toggle() {
    setOpen(shown ? false : 'todas');
    setActive(0);
    if (!shown && (!touch || byKeyboard())) field.current.focus();
  }

  function keys(e) {
    // Tecla da composição de texto (acento, IME) é de quem compõe: não marca outro item, não fecha a lista, não escolhe
    // nem envia.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (shown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActive((at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
      return;
    }
    if (shown && (e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) {
      e.preventDefault();
      pick(items[at]);
      return;
    }
    if (open && e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    // Enter envia e Shift + Enter quebra a linha: aqui é um chat (no editor do Estudar o Enter quebra a linha). No
    // toque o Enter só quebra a linha (o teclado do celular não tem Shift + Enter) e quem envia é o botão. O Enter
    // repetido de uma tecla presa não envia.
    if (!touch && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!waiting && !e.repeat && value.trim()) onSend();
    }
  }

  return (
    <div className="composer">
      {status}
      {/* A lista fica acima da caixa. O mousedown não tira o foco do campo: o clique no item faz o mesmo que o Enter. O
          ponteiro que anda sobre um item o marca: um item só fica marcado por vez, e o Enter escolhe o que está à vista. */}
      <AnimatePresence custom={byKeyboard()}>
        {shown && (
          <m.div key="atalhos" className="palette" variants={pop} initial={appear()} animate="show" exit="exit">
            <div
              ref={list}
              id="atalhos"
              role="listbox"
              aria-label="Sugestões de pergunta"
              onMouseDown={e => e.preventDefault()}
            >
              {items.map((h, i) => (
                <div
                  key={i}
                  id={optionId(h)}
                  role="option"
                  aria-selected={i === at}
                  onMouseMove={() => i !== at && setActive(i)}
                  onClick={() => pick(h)}
                >
                  {h}
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <m.form
        className="composer-box"
        variants={variants}
        onSubmit={e => {
          e.preventDefault();
          // O Enviar fica desligado assim que a caixa esvazia, e o foco que estava nele iria para o body: volta ao campo
          // (no toque não, para o teclado da tela não abrir sozinho).
          if (!touch) field.current.focus();
          onSend();
        }}
      >
        {/* Papel de caixa de texto, não de combobox: aria-activedescendant diz ao leitor de tela qual item está marcado. */}
        <textarea
          ref={field}
          id="pergunta"
          rows={1}
          aria-label="Sua dúvida"
          aria-describedby={[about && 'chat-sobre', 'chat-dica', reason].filter(Boolean).join(' ')}
          aria-controls={shown ? 'atalhos' : undefined}
          aria-activedescendant={current}
          value={value}
          onChange={e => type(e.target.value)}
          onKeyDown={keys}
          onFocus={() => {
            // O brilho nasce no meio da caixa e dali segue o ponteiro.
            const r = field.current.getBoundingClientRect();
            x.jump(r.left + r.width / 2);
            y.jump(r.top + r.height / 2);
            glowX.jump(x.get());
            glowY.jump(y.get());
            setFocused(true);
          }}
          onBlur={e => {
            setFocused(false);
            // O foco que vai para o botão de atalhos não fecha a lista: o clique nele é que decide.
            if (!e.relatedTarget?.closest('.shortcuts')) setOpen(false);
          }}
          placeholder="O que você quer entender?"
          maxLength={4000}
          required
        />
        <div className="composer-bar">
          {/* O mousedown não tira o foco do campo: no Safari o clique não dá foco ao botão, o campo perdia o foco, a lista
              fechava e o clique a reabria. */}
          <button
            type="button"
            className="shortcuts"
            aria-label="Atalhos"
            aria-expanded={shown}
            aria-controls={shown ? 'atalhos' : undefined}
            onMouseDown={e => e.preventDefault()}
            onClick={toggle}
          >
            <Icon name="atalhos" />
          </button>
          {/* Com o material aberto como assunto, a área e o nível são os dele: no lugar das listas, o título. O campo
              também é descrito por esta linha, para o leitor de tela dizer sobre o que vai a pergunta. */}
          {about ? (
            <p id="chat-sobre" className="composer-about">
              Sobre: <strong>{about.title}</strong> · {about.area} · {about.level}
            </p>
          ) : (
            <>
              {/* A mesma área e o mesmo nível do Estudar (App.jsx): trocar aqui troca lá. */}
              <select aria-label="Área de conhecimento" value={area} onChange={e => onArea(e.target.value)}>
                {AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
              <select aria-label="Nível de aprendizado" value={level} onChange={e => onLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </>
          )}
          {/* Fica no mesmo lugar nas duas fontes: o foco continua nele depois do clique, com o nome da outra fonte. */}
          {swap && <button type="button" className="link" onClick={onSwap}>{swap}</button>}
          <button type="submit" className="primary" disabled={waiting || !value.trim()} aria-describedby={reason}>
            <span>Enviar</span>
            {cost && <small>1 pedido à IA</small>}
            <Icon name="seta" />
          </button>
        </div>
      </m.form>
      <div className="composer-foot">
        <p id="chat-dica">{touch ? '/ abre os atalhos' : 'Enter envia · Shift + Enter quebra a linha · / abre os atalhos'}</p>
        {note}
      </div>
      {/* Preso à janela dentro do palco (portal no main): atrás do texto e por cima do vidro, sem desfoque. */}
      {glow && createPortal(
        <m.div className="pointer-glow" aria-hidden="true" style={{ x: glowX, y: glowY }} />,
        field.current.closest('main'),
      )}
    </div>
  );
}
