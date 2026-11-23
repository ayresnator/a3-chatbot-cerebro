import React from 'react';
import { m } from 'motion/react';
import { Icon } from './icons.jsx';
import { Stat, BackupNote, StudyPlan } from './ui.jsx';
import {
  AREAS, spokenDay, areaLine, plural, dayMistakes, CONF, calibration, sureText, retention, keptStat, keptLine, keptSplit,
} from './lib.js';

// Cada marca de certeza do quiz no painel "Sua certeza" (#80), na ordem dos botões.
const SURE_WHEN = { certeza: 'Quando marcou certeza', acho: 'Quando achou que sabia', chute: 'Quando chutou' };

// Página Desempenho, carregada à parte (App.jsx, lazyView): o código dela só vem quando o aluno chega nela ou quando
// o navegador fica livre. Os números e o estado continuam no App; aqui só o desenho. backup é a linha do pé (ui.jsx,
// BackupNote); plan, o plano até a prova (ui.jsx, StudyPlan), e onPlan abre a tarefa dele.
export default function Desempenho({
  rise, fade, streakDays, quizzes, cards, percent, chartArea, setChartArea, days, busiest, weakest, openWeak,
  hasMaterial, onStart, mistakes, due, redoMistakes, plan, onPlan, events, backup, onExport,
}) {
  // Questões do ponto fraco no caderno de erros: as que o "Refazer os erros de" abre.
  const own = weakest ? mistakes.filter(e => e.title === weakest.name) : [];
  // O acerto de cada marca de certeza nos últimos 30 dias (lib.js, calibration).
  const sure = calibration(events, new Date());
  // O acerto que ficou nos últimos 30 dias (#78, lib.js: retention), ao lado do acerto na hora.
  const kept = retention(events, new Date());
  const split = keptSplit(kept);
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
        <Stat {...keptStat(kept)} />
        <Stat
          value={percent(cards)}
          label={'autoavaliação nos cartões\u00a0· ' + cards.total + (cards.total === 1 ? ' cartão' : ' cartões')}
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
        {days.some(d => d.total) ? (
          <div className="chart">
            {/* A altura da barra é o número de respostas do dia. O rótulo diz o que mede ("6 respostas", "50% certas");
                no celular a coluna é estreita e fica a forma curta, "50% · 6" (mobile.css). O leitor de tela ouve a
                coluna por extenso (spokenDay). Só a barra de hoje (a última) vai em ciano; o dia sem resposta fica só
                com a data. */}
            <span className="chart-grid" aria-hidden="true"></span>
            {days.map((d, i) => (
              <div key={d.day} role="img" aria-label={spokenDay(d)}>
                {d.total > 0 && (
                  <>
                    <span className="full">
                      {d.total} {plural(d.total, 'resposta', 'respostas')}<br />{d.rate}% certas
                    </span>
                    <span className="short">{d.rate + '% · ' + d.total}</span>
                    <div
                      className={'chart-bar' + (i === days.length - 1 ? ' today' : '')}
                      style={{ '--h': d.total / busiest }}
                    ></div>
                  </>
                )}
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint chart-empty">Nenhuma resposta nos últimos 7 dias</p>
        )}
        <p className="chart-note">
          A altura da barra é o número de respostas do dia; o percentual é o acerto. Conta a primeira resposta de cada
          questão do quiz no dia. Os cartões ficam à parte: são autoavaliação.
        </p>
        <p className="chart-note">
          {keptLine(kept)} "Na hora" é a primeira vez que a questão aparece; "que ficou" é a mesma questão em outro dia.
        </p>
        <p className="chart-note">
          {split || 'Para medir o que ficou, refaça amanhã ou depois o quiz de um material da Biblioteca ou as questões ' +
            'do caderno de erros: a primeira resposta de cada questão no dia conta.'}
        </p>
      </m.section>
      <m.section className="panel" variants={rise}>
        <h2>Seu próximo passo</h2>
        {/* A prova mais próxima vem antes dos três casos. */}
        {plan.length > 0 && <StudyPlan rows={plan} onOpen={onPlan} />}
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
        <h3 className="subjects-label">Por área</h3>
        <ul className="subjects" role="list">
          {AREAS.map(a => (
            <li className="subject" key={a}>
              <strong>{a}</strong>
              <span>{areaLine(events, a)}</span>
            </li>
          ))}
        </ul>
      </m.section>
      {/* A certeza marcada no quiz contra o acerto: quem se acha seguro demais para de estudar cedo. */}
      <m.section className="panel" variants={rise}>
        <h2>Sua certeza</h2>
        <p>Quanto você acertou com cada marca, nos últimos 30 dias. Conta a primeira resposta de cada questão no dia.</p>
        {CONF.some(conf => sure[conf].total) ? (
          <ul className="subjects" role="list">
            {CONF.map(conf => (
              <li className="subject" key={conf}>
                <strong>{SURE_WHEN[conf]}</strong>
                <span>{sureText(sure[conf])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            Nenhuma resposta com a certeza marcada nos últimos 30 dias. No quiz, com a caixa "Marcar certeza" ligada, você
            marca "Tenho certeza", "Acho que sei" ou "Chutei" antes da correção.
          </p>
        )}
      </m.section>
      {backup && <BackupNote status={backup} onExport={onExport} variants={rise} />}
    </>
  );
}
