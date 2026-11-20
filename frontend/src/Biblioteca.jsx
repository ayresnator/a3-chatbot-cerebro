import React, { useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Icon } from './icons.jsx';
import { UndoRow, BackupNote } from './ui.jsx';
import { byKeyboard } from './anim.js';
import { AREAS } from './lib.js';

// Página Biblioteca, carregada à parte (App.jsx, lazyView). A lista, a busca e o desfazer continuam no App; aqui só o
// desenho. onRemove recebe o item da lista para a saída marcada (anim.js, leave). backup é a linha do pé (ui.jsx,
// BackupNote).
export default function Biblioteca({
  rise, pop, query, setQuery, filter, setFilter, shown, saved, undo, onUndo, backup, onExport, onImport, onOpen,
  onRemove,
}) {
  const picker = useRef(null);
  return (
    <m.section className="panel" variants={rise}>
      <div className="toolbar">
        <label className="search">
          <Icon name="buscar" />
          <input
            id="busca"
            type="search"
            placeholder="Buscar materiais…"
            aria-label="Buscar materiais"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <select aria-label="Filtrar área" value={filter} onChange={e => setFilter(e.target.value)}>
          {['Todas', ...AREAS].map(a => <option key={a}>{a}</option>)}
        </select>
        <button type="button" onClick={onExport}>
          <Icon name="exportar" />
          Exportar
        </button>
        <button type="button" onClick={() => picker.current.click()}>
          <Icon name="importar" />
          Importar
        </button>
        <input ref={picker} type="file" accept=".json,application/json" hidden onChange={onImport} />
      </div>
      <p className="hint">
        Exportar baixa um arquivo com a biblioteca, o desempenho, o caderno de erros e o perfil. Importar junta esse
        arquivo ao que já está neste navegador, sem duplicar, e só traz o perfil se este navegador ainda não tem um.
      </p>
      {/* popLayout: a linha que sai deixa o fluxo na hora, e a lista sobe junto (App.jsx, undoNow; anim.js, flipList). */}
      <AnimatePresence mode="popLayout" custom={byKeyboard()}>
        {undo?.kind === 'material' && <UndoRow key="desfazer" undo={undo} onUndo={onUndo} pop={pop} />}
      </AnimatePresence>
      {shown.length > 0 && (
        <ul className="library" role="list">
          {shown.map(s => (
            <li className="library-item" key={s.id} data-id={s.id} data-flip>
              <div>
                <small>{s.area} · {new Date(s.date).toLocaleDateString('pt-BR')}</small>
                <h2>{s.title}</h2>
                <p>Resumo · {s.flashcards.length} flashcards · {s.quiz.length} questões</p>
              </div>
              <button type="button" className="open" onClick={() => onOpen(s)}>
                Abrir
                <Icon name="abrir" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={'Excluir ' + s.title}
                onClick={e => onRemove(s, e.currentTarget.closest('li'))}
              >
                <Icon name="excluir" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!shown.length && (
        <div className="empty">
          <h2>Nenhum material encontrado</h2>
          {/* Biblioteca vazia e busca sem resultado pedem coisas diferentes do aluno. */}
          <p>
            {saved.length
              ? 'Nada com essa busca ou essa área. Apague a busca ou escolha "Todas".'
              : 'Os materiais que você gerar ficam guardados aqui, para estudar de novo depois.'}
          </p>
        </div>
      )}
      {backup && <BackupNote status={backup} onExport={onExport} />}
    </m.section>
  );
}
