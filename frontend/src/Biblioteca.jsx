import React, { useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Icon } from './icons.jsx';
import { UndoRow, BackupNote } from './ui.jsx';
import { byKeyboard } from './anim.js';
import { AREAS, plural, daysUntil, inDays } from './lib.js';

// Página Biblioteca, carregada à parte (App.jsx, lazyView). A lista, a busca e o desfazer continuam no App; aqui só o
// desenho. onRemove recebe o item da lista para a saída marcada (anim.js, leave). backup é a linha do pé (ui.jsx,
// BackupNote). O simulado também fica no App (startExam): exam é a frase dele, com o tamanho pedido (examSize). onShare
// abre a janela "Compartilhar" do material (App.jsx, openShare).
export default function Biblioteca({
  fade, pop, query, setQuery, filter, setFilter, shown, saved, undo, onUndo, backup, onExport, onImport, onOpen,
  onShare, onRemove, onStart, exam, examSize, onExamSize, onExam,
}) {
  const picker = useRef(null);
  const now = new Date();
  // Com a lista de áreas na barra, o painel só esmaece (anim.js, fade).
  return (
    <m.section className="panel" variants={fade}>
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
        {/* O nome do filtro na tela, como "Área do gráfico" no Desempenho: só "Todas" não dizia o que ele filtra. */}
        <label className="inline-field">
          Área
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            {['Todas', ...AREAS].map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
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
        Exportar baixa um arquivo com a biblioteca, o desempenho, o caderno de erros, as caixas dos cartões e o perfil.
        Cada material vai com o texto usado para gerá-lo, de até 20.000 caracteres, que também ocupa espaço neste
        navegador. Importar junta esse arquivo ao que já está neste navegador, sem duplicar, e só traz o perfil se este
        navegador ainda não tem um.
      </p>
      {/* O simulado sai dos materiais da lista: a busca e o filtro de área escolhem o conjunto. Sem nenhum na lista, a
          linha sai junto com ela. */}
      {shown.length > 0 && (
        <div className="exam-row">
          <div>
            <h2>Simulado</h2>
            <p id="simulado-conta">{exam} desta lista, misturadas. A correção fica para o fim.</p>
          </div>
          <label className="inline-field">
            Questões
            <select value={examSize} onChange={e => onExamSize(Number(e.target.value))}>
              {[10, 20, 30].map(n => <option key={n}>{n}</option>)}
            </select>
          </label>
          {/* O segundo clique de um clique duplo em "Voltar à Biblioteca" cai aqui: ele não começa outro simulado. */}
          <button type="button" aria-describedby="simulado-conta" onClick={e => e.detail < 2 && onExam()}>
            <Icon name="quizzes" />
            Começar simulado
          </button>
        </div>
      )}
      {/* popLayout: a linha que sai deixa o fluxo na hora, e a lista sobe junto (App.jsx, undoNow; anim.js, flipList). */}
      <AnimatePresence mode="popLayout" custom={byKeyboard()}>
        {undo?.kind === 'material' && <UndoRow key="desfazer" undo={undo} onUndo={onUndo} pop={pop} />}
      </AnimatePresence>
      {shown.length > 0 && (
        <ul className="library" role="list">
          {shown.map(s => (
            <li className="library-item" key={s.id} data-id={s.id} data-flip>
              <div>
                {/* A data da prova (#86), de hoje em diante. */}
                <small>
                  {s.area} · {new Date(s.date).toLocaleDateString('pt-BR')}
                  {daysUntil(s.prova, now) !== null && <> · <strong>prova {inDays(daysUntil(s.prova, now))}</strong></>}
                </small>
                <h2>{s.title}</h2>
                <p>
                  {'Resumo · ' + s.flashcards.length + ' ' + plural(s.flashcards.length, 'cartão', 'cartões') +
                    ' · ' + s.quiz.length + ' ' + plural(s.quiz.length, 'questão', 'questões')}
                </p>
              </div>
              {/* O nome começa pelo texto da tela (o controle por voz acha "Abrir") e diz qual material abre. */}
              <button type="button" className="open" aria-label={'Abrir ' + s.title} onClick={() => onOpen(s)}>
                Abrir
                <Icon name="abrir" />
              </button>
              <button
                type="button"
                className="icon-button share"
                aria-label={'Compartilhar ' + s.title}
                aria-haspopup="dialog"
                onClick={() => onShare(s)}
              >
                <Icon name="compartilhar" />
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
      {/* Biblioteca vazia e busca sem resultado pedem coisas diferentes do aluno. */}
      {!shown.length && (saved.length ? (
        <div className="empty">
          <h2>Nenhum material encontrado</h2>
          <p>Nada com essa busca ou essa área. Apague a busca ou escolha "Todas".</p>
        </div>
      ) : (
        <div className="empty">
          <h2>Sua biblioteca está vazia</h2>
          {/* O material gerado entra aqui sozinho, sem "Salvar" (App.jsx, generate): a frase não pede para salvar. */}
          <p>
            Os materiais que você gerar ficam guardados aqui, para estudar de novo depois. Se você tem um backup, use
            Importar.
          </p>
          <button type="button" className="primary" onClick={onStart}>Gerar um material</button>
        </div>
      ))}
      {backup && <BackupNote status={backup} onExport={onExport} />}
    </m.section>
  );
}
