import React, { useLayoutEffect, useRef } from 'react';
import { animate } from 'motion/mini';
import { byKeyboard } from './anim.js';

// A caneta de correção: ○ novo, ✗ errei, ↻ refazer, ✓ certo. Traços feitos à mão em SVG, mais grossos que os ícones.
// Com draw, a marca se desenha quando aparece: cada traço tem pathLength 1 e o animate do Motion leva o
// stroke-dashoffset de 1 a 0, um traço depois do outro, em 0,52 s no total. Com movimento reduzido, ou quando a ação
// veio do teclado, ela já aparece pronta.
// A marca não é lida pelo leitor de tela: certo e errado vão em texto ao lado (a nota em Kalam ou o rótulo do grupo).
const STROKES = {
  novo: ['M12.6 4.4c-4.6-.4-8.2 2.7-8.3 7.1-.1 4.5 3.3 8.1 7.8 8.2 4.4.1 7.7-3.1 7.8-7.4.1-4.1-2.8-7.4-7.1-7.9-1.5-.2-2.9.1-4 .7'],
  errei: ['M5.5 5.8c4.1 3.6 8.4 8 12.8 12.6', 'M18.2 5.2C14 9.3 9.9 13.6 5.4 18.6'],
  refazer: [
    'M18.8 10.2c-.9-3.2-3.8-5.5-7.1-5.4-4 .1-7.1 3.4-7 7.4.1 4 3.4 7.1 7.4 7 2.4-.1 4.5-1.3 5.7-3.2',
    'M19.6 5.4l-.7 4.9-4.8-1.1',
  ],
  certo: ['M4.5 12.8c1.3 1 2.6 2.4 3.9 4.6.3.5.9.5 1.2 0 2.4-4.6 5.6-8.6 9.9-12.1'],
};
const DRAW = 0.52;
const EASE = [0.22, 1, 0.36, 1];

export function Pen({ kind, note, draw = false, delay = 0, className = '' }) {
  const root = useRef(null);
  // Antes da pintura: o traço começa escondido no mesmo quadro em que aparece, sem piscar pronto.
  useLayoutEffect(() => {
    if (!draw || byKeyboard() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const paths = [...root.current.querySelectorAll('path')];
    const step = DRAW / paths.length;
    paths.forEach((path, i) =>
      animate(path, { strokeDashoffset: ['1px', '0px'] }, { duration: step, delay: delay + i * step, ease: EASE }));
    const text = root.current.querySelector('.pen-note');
    if (text) animate(text, { opacity: [0, 1] }, { duration: 0.2, delay: delay + DRAW * 0.6, ease: EASE });
  }, []);
  return (
    <span ref={root} className={'pen pen--' + kind + (className ? ' ' + className : '')}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {STROKES[kind].map((d, i) => <path key={i} d={d} pathLength="1" />)}
      </svg>
      {note && <span className="pen-note">{note}</span>}
    </span>
  );
}
