import React from 'react';
import { m } from 'motion/react';
import { Icon } from './icons.jsx';
import { Stat, BackupNote } from './ui.jsx';
import { AREAS, spokenDay, areaLine, plural, dayMistakes } from './lib.js';

// Página Desempenho, carregada à parte (App.jsx, lazyView): o código dela só vem quando o aluno chega nela ou quando
// o navegador fica livre. Os números e o estado continuam no App; aqui só o desenho. backup é a linha do pé (ui.jsx,
// BackupNote).
export default function Desempenho({
  rise, fade, streakDays, quizzes, cards, percent, chartArea, setChartArea, days, busiest, weakest, openWeak,
  hasMaterial, onStart, mistakes, due, redoMistakes, events, backup, onExport,
}) {
  // Questões do ponto fraco no caderno de erros: as que o "Refazer os erros de" abre.
  const own = weakest ? mistakes.filter(e => e.title === weakest.name) : [];
  // As questões do caderno para hoje (due, lib.js: dueMistakes), no máximo 10 por vez, como no caderno.
  const redoToday = due.length > 0 && (
    <button type="button" className="primary" onClick={() => redoMistakes(dayMistakes(due))}>
      <Icon name="refazer" />
      Refazer os de hoje ({due.length})
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
            {redoToday && <div className="row">{redoToday}</div>}
          </>
        ) : (
          <>
            <p>
              {'Revise "' + weakest.name + '": você errou ' + weakest.wrong + ' de ' + weakest.total +
                ' questões nos últimos 7 dias.'}
            </p>
            {/* Sem botão nenhum, a linha vazia somava a margem dela ao vão até a lista de áreas. As de hoje vêm
                primeiro, como no caderno; os erros do material ficam ao lado, como o "Treinar todas" de lá. */}
            {(own.length > 0 || redoToday || openWeak) && (
              <div className="row next-step">
                {redoToday}
                {own.length > 0 && (
                  <button type="button" className={redoToday ? undefined : 'primary'} onClick={() => redoMistakes(own)}>
                    {!redoToday && <Icon name="refazer" />}
                    {'Refazer os erros de "' + weakest.name + '" (' + own.length + ')'}
                  </button>
                )}
                {openWeak && (
                  <button type="button" onClick={openWeak}>
                    {'Abrir "' + weakest.name + '"'}
                    <Icon name="abrir" />
                  </button>
                )}
              </div>
            )}
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
      {backup && <BackupNote status={backup} onExport={onExport} variants={rise} />}
    </>
  );
}
