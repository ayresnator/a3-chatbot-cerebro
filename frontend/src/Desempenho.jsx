import React from 'react';
import { m } from 'motion/react';
import { Icon } from './icons.jsx';
import { Stat } from './ui.jsx';
import { AREAS, spokenDay, areaLine } from './lib.js';

// Página Desempenho, carregada à parte (App.jsx, lazyView): o código dela só vem quando o aluno chega nela ou quando
// o navegador fica livre. Os números e o estado continuam no App; aqui só o desenho.
export default function Desempenho({
  rise, fade, streakDays, quizzes, cards, percent, chartArea, setChartArea, days, busiest, weakest, mistakes, redoMistakes,
  events,
}) {
  return (
    <>
      <m.div className="stats" variants={rise}>
        <Stat value={streakDays} label={streakDays === 1 ? 'dia de sequência' : 'dias de sequência'} />
        <Stat value={quizzes.total} label="questões respondidas" />
        <Stat value={percent(quizzes)} label="acerto no quiz" />
        <Stat
          value={percent(cards)}
          label={'autoavaliação nos cartões · ' + cards.total + (cards.total === 1 ? ' cartão' : ' cartões')}
        />
      </m.div>
      {/* Com a lista "Área do gráfico" dentro, o painel só esmaece (anim.js, fade). */}
      <m.section className="panel" variants={fade}>
        <div className="panel-head">
          <h2>Respostas e acertos nos últimos 7 dias</h2>
          <label className="inline-field">
            Área do gráfico
            <select value={chartArea} onChange={e => setChartArea(e.target.value)}>
              {['Todas', ...AREAS].map(a => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <div className="chart">
          {/* A altura da barra é o número de respostas do dia; o percentual de acerto vai escrito em cima. */}
          {/* 7,5 rem no maior dia: em tela estreita o rótulo quebra em até três linhas e ainda cabe na caixa. */}
          {days.map(d => (
            <div key={d.day} role="img" aria-label={spokenDay(d)}>
              <span>{d.total ? d.rate + '% · ' + d.total : '—'}</span>
              <div className="chart-bar" style={{ '--h': d.total / busiest }}></div>
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        <p className="chart-note">
          Conta a primeira resposta de cada questão do quiz no dia. Os cartões ficam à parte: são autoavaliação.
        </p>
      </m.section>
      <m.section className="panel" variants={rise}>
        <h2>Seu próximo passo</h2>
        <p>
          {weakest
            ? 'Revise "' + weakest.name + '": você errou ' + weakest.wrong + ' de ' + weakest.total +
              ' questões nos últimos 7 dias.'
            : 'Responda flashcards e quizzes para descobrir seus pontos de revisão.'}
        </p>
        {mistakes.length > 0 && (
          <button type="button" className="primary" onClick={redoMistakes}>
            <Icon name="refazer" />
            Refazer meus erros ({mistakes.length})
          </button>
        )}
        <ul className="subjects" role="list">
          {AREAS.map(a => (
            <li className="subject" key={a}>
              <strong>{a}</strong>
              <span>{areaLine(events, a)}</span>
            </li>
          ))}
        </ul>
      </m.section>
    </>
  );
}
