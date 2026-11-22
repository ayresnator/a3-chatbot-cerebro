import React from 'react';
import { answerLine, printNote, sourceLabel } from './lib.js';

// Folha de impressão do material (App.jsx, printSheet), carregada à parte. Ela só aparece na impressão, em papel branco
// com letra preta (styles.css, .folha), e a tela continua escura. O resumo com os trechos, os cartões para recortar e
// dobrar, o quiz e, numa página à parte, o gabarito, com as letras das opções como na tela do quiz.
export default function Folha({ material }) {
  const { title, summary, flashcards, quiz } = material;
  const meta = [material.area, material.level].filter(Boolean).join(' · ');
  // Como na tela: só o material da demonstração (semIA) não tem texto da IA.
  const ai = material.semIA !== true;
  return (
    <article className="folha">
      <header>
        <h1>{title}</h1>
        {meta && <p>{meta}</p>}
        {ai && <p>{printNote(summary, material.texto)}</p>}
      </header>
      <section>
        <h2>Resumo</h2>
        <ol>
          {summary.map((s, i) => (
            <li key={i}>
              <h3>{s.concept}</h3>
              <p>{s.text}</p>
              {s.source?.trim() && <p className="folha-trecho">{sourceLabel(s, material.texto)}</p>}
              {ai && (s.ia || !s.source?.trim()) && <p className="folha-etiqueta">Explicação da IA: confira</p>}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>Flashcards</h2>
        <p>Recorte nas linhas tracejadas e dobre na pontilhada: a pergunta fica na frente, e a resposta, atrás.</p>
        <ol className="folha-cartoes">
          {flashcards.map((c, i) => (
            <li key={i}>
              <p>{c.question}</p>
              <p>{c.answer}</p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>Quiz</h2>
        <ol>
          {quiz.map((q, i) => (
            <li key={i}>
              <p>{q.question}</p>
              {q.type === 'short' ? (
                <div className="folha-linhas">
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <ul>
                  {q.options.map((o, k) => <li key={k}>{String.fromCharCode(65 + k) + ') ' + o}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
      <section className="folha-gabarito">
        <h2>Gabarito</h2>
        <ol>
          {quiz.map((q, i) => (
            <li key={i}>
              <p><strong>{answerLine(q)}</strong></p>
              {q.explanation && <p>{q.explanation}</p>}
              {q.steps?.length > 0 && <ol>{q.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
