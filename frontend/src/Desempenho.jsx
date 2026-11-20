import React from 'react';
import { m } from 'motion/react';
import { Icon } from './icons.jsx';
import { Stat } from './ui.jsx';
import { AREAS, spokenDay, areaLine, plural } from './lib.js';

// Página Desempenho, carregada à parte (App.jsx, lazyView): o código dela só vem quando o aluno chega nela ou quando
// o navegador fica livre. Os números e o estado continuam no App; aqui só o desenho.
export default function Desempenho({
  rise, streakDays, quizzes, cards, percent, chartArea, setChartArea, days, busiest, weakest, openWeak, hasMaterial,
  onStart, mistakes, redoMistakes, events,
}) {
  // Questões do ponto fraco no caderno de erros: as que o "Refazer os erros de" abre.
  const own = weakest ? mistakes.filter(e => e.title === weakest.name).length : 0;
  const redoAll = mistakes.length > 0 && (
    <button type="button" className="primary" onClick={() => redoMistakes()}>
      <Icon name="refazer" />
      Refazer meus erros ({mistakes.length})
    </button>
  );
  return (
    <>
      <m.div className="stats" variants={rise}>
        <Stat value={streakDays} label={plural(streakDays, 'dia seguido de estudo', 'dias seguidos de estudo')} />
        <Stat value={quizzes.total} label={plural(quizzes.total, 'questão respondida', 'questões respondidas')} />
        <Stat value={percent(quizzes)} label="acerto no quiz" />
        <Stat
          value={percent(cards)}
          label={'autoavaliação nos cartões · ' + cards.total + (cards.total === 1 ? ' cartão' : ' cartões')}
        />
      </m.div>
      <m.section className="panel" variants={rise}>
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
          {/* A altura da barra é o número de respostas do dia. O rótulo diz o que mede ("6 respostas", "50% certas");
              no celular a coluna é estreita e fica a forma curta, "50% · 6" (mobile.css). O leitor de tela ouve a
              coluna por extenso (spokenDay). */}
          {/* 7,5 rem no maior dia: em tela estreita o rótulo quebra em até três linhas e ainda cabe na caixa. */}
          {days.map(d => (
            <div key={d.day} role="img" aria-label={spokenDay(d)}>
              <span className="full">
                {d.total ? <>{d.total} {plural(d.total, 'resposta', 'respostas')}<br />{d.rate}% certas</> : '—'}
              </span>
              <span className="short">{d.total ? d.rate + '% · ' + d.total : '—'}</span>
              <div className="chart-bar" style={{ '--h': d.total / busiest }}></div>
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        <p className="chart-note">
          A altura da barra é o número de respostas do dia; o percentual é o acerto. Conta a primeira resposta de cada
          questão do quiz no dia. Os cartões ficam à parte: são autoavaliação.
        </p>
      </m.section>
      <m.section className="panel" variants={rise}>
        <h2>Seu próximo passo</h2>
        {/* Três casos: nenhuma resposta no quiz, nenhum material com erro e o material que mais errou (weakSpot). */}
        {!quizzes.total ? (
          <>
            <p>Responda um quiz para ver aqui o material que pede revisão.</p>
            {/* O mesmo par do caderno de erros vazio. */}
            <button type="button" className="primary" onClick={onStart}>
              {hasMaterial ? 'Fazer o quiz do material aberto' : 'Gerar um material'}
            </button>
          </>
        ) : !weakest ? (
          <>
            <p>Nenhum material pede revisão nos últimos 7 dias.</p>
            <p className="hint">Um material aparece aqui quando tem 3 ou mais respostas no quiz e algum erro.</p>
            {redoAll && <div className="row">{redoAll}</div>}
          </>
        ) : (
          <>
            <p>
              {'Revise "' + weakest.name + '": você errou ' + weakest.wrong + ' de ' + weakest.total +
                ' questões nos últimos 7 dias.'}
            </p>
            <div className="row">
              {own > 0 ? (
                <button type="button" className="primary" onClick={() => redoMistakes(weakest.name)}>
                  <Icon name="refazer" />
                  {'Refazer os erros de "' + weakest.name + '" (' + own + ')'}
                </button>
              ) : redoAll}
              {openWeak && (
                <button type="button" onClick={openWeak}>
                  {'Abrir "' + weakest.name + '"'}
                  <Icon name="abrir" />
                </button>
              )}
            </div>
          </>
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
