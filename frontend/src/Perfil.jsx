import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { animate } from 'motion/mini';
import { Icon } from './icons.jsx';
import { AREAS } from './lib.js';
import { EASE_OUT, byKeyboard } from './anim.js';

// Formulário da janela do perfil local, carregado à parte (App.jsx, lazyView); o Fechar, o título e o texto já estão
// na janela. O nome e a área continuam no App; ao confirmar, onSave recebe o perfil. O foco vai para o nome quando o
// formulário aparece, chegue ele junto com a janela ou depois dela. Chegando depois, no lugar do esqueleto (do mesmo
// tamanho), ele só esmaece, em 0,18 s; junto com a janela, a entrada é a dela.
export default function Perfil({ name, setName, area, onSave }) {
  const form = useRef(null);
  const field = useRef(null);
  // A janela já estava aberta: o showModal (App.jsx, Modal) roda depois deste efeito quando os dois chegam juntos.
  useLayoutEffect(() => {
    if (form.current.closest('dialog')?.open && !byKeyboard()) {
      animate(form.current, { opacity: [0, 1] }, { duration: 0.18, ease: EASE_OUT });
    }
  }, []);
  useEffect(() => field.current?.focus(), []);
  return (
    <form
      ref={form}
      className="profile-form"
      onSubmit={e => {
        e.preventDefault();
        // A área só vale ao confirmar: antes, mexer na lista e fechar no "×" já trocava a área do editor.
        onSave({ name: name.trim() || 'Estudante', area: e.currentTarget.elements.area.value });
      }}
    >
      <label>
        Como podemos te chamar?
        <input
          ref={field}
          name="nome"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          maxLength={50}
          autoComplete="given-name"
        />
      </label>
      <label>
        Sua área principal
        <select name="area" defaultValue={area}>
          {AREAS.map(a => <option key={a}>{a}</option>)}
        </select>
      </label>
      <button className="primary">
        Começar a estudar
        <Icon name="seta" />
      </button>
    </form>
  );
}
