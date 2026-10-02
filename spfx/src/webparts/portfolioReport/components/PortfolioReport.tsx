import * as React from 'react';
import { DefaultButton } from '@fluentui/react/lib/Button';
import { daysBetween, IEvaluatedInitiative, IPortfolioEvaluation } from '../../../methodology';
import { fmtDate, fmtHours, fmtPercent, INDICATOR_STATUS_LABEL, LIGHT_COLORS, STATUS_COLORS } from '../../../common/portfolio/format';
import { Dot, Pill, PortfolioShell, SuggestionPill } from '../../../common/portfolio/PortfolioUi';
import { type IPortfolioComponentProps, type IPortfolioWebPartSettings } from '../../../common/portfolio/PortfolioWebPartBase';
import { usePortfolio } from '../../../common/portfolio/usePortfolio';
import styles from '../../../common/portfolio/Portfolio.module.scss';
import { Roadmap } from './Roadmap';

export type IPortfolioReportSettings = IPortfolioWebPartSettings;

const MAX_ROWS = 12;

const More: React.FC<{ total: number; shown: number; where: string }> = ({ total, shown, where }) =>
  total > shown ? (
    <p className={styles.small} style={{ marginTop: 8 }}>
      E mais {total - shown} — veja a lista completa em {where}.
    </p>
  ) : null;

const Report: React.FC<{ evaluation: IPortfolioEvaluation }> = ({ evaluation }) => {
  const items = evaluation.items;
  const s = evaluation.selection;
  const active = items.filter((e) => e.stage === 'active');
  const bySuggestion = (key: string): IEvaluatedInitiative[] => items.filter((e) => e.stage === 'candidate' && e.selection?.suggestion === key);
  const attention = active
    .filter((e) => e.light && e.light.color !== 'Verde')
    .sort((a, b) => (a.light?.color === 'Vermelho' ? 0 : 1) - (b.light?.color === 'Vermelho' ? 0 : 1));
  const periodDays = evaluation.params.monitoring.reviewCycleDays;
  const allDecisions = evaluation.decisions.filter((d) => daysBetween(d.date, evaluation.today) <= periodDays);
  // Relatório de no máximo 2 páginas: os itens mais relevantes; o restante fica nas páginas operacionais.
  const decisions = allDecisions.slice(0, MAX_ROWS);
  const attentionShown = attention.slice(0, MAX_ROWS);
  const unbalanced = evaluation.activeBalance.dimensions.filter((d) => !d.balanced);
  const roadmapItems = active.concat(bySuggestion('select'));

  const summary = [
    { value: String(active.length), label: 'Iniciativas no portfólio ativo' },
    { value: String(bySuggestion('select').length), label: 'Sugeridas para seleção' },
    { value: String(bySuggestion('queue').length), label: 'Em fila' },
    { value: String(items.filter((e) => e.stage === 'intake').length), label: 'Em análise' },
    { value: fmtPercent(s.commitmentPercent), label: `Capacidade comprometida (${s.cycle})` },
    { value: fmtHours(s.remaining), label: 'Saldo de capacidade alocável' }
  ];

  return (
    <>
      <ul className={styles.cards}>
        {summary.map((card) => (
          <li key={card.label} className={styles.card}>
            <span className={styles.cardValue}>{card.value}</span>
            <span className={styles.cardLabel}>{card.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.panelGrid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>1. Indicadores do portfólio</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Indicador</th>
                <th className={styles.num}>Resultado</th>
                <th className={styles.num}>Meta</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.indicators.map((indicator) => (
                <tr key={indicator.id}>
                  <td>
                    {indicator.id}. {indicator.name}
                  </td>
                  <td className={styles.num}>
                    <strong>{indicator.display}</strong>
                  </td>
                  <td className={styles.num}>{indicator.target}</td>
                  <td>
                    <Pill text={INDICATOR_STATUS_LABEL[indicator.status]} color={STATUS_COLORS[indicator.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>2. Leitura e pontos de atenção</h3>
          {evaluation.readings.length + s.alerts.length + unbalanced.length === 0 ? (
            <p className={styles.small}>Sem alertas de capacidade ou de equilíbrio.</p>
          ) : (
            <ul className={styles.reasons} style={{ fontSize: 12.5, color: 'inherit' }}>
              {evaluation.readings.concat(s.alerts).map((text) => (
                <li key={text}>{text}</li>
              ))}
              {unbalanced.map((d) => (
                <li key={d.key}>
                  Equilíbrio fora das faixas em <strong>{d.label}</strong>:{' '}
                  {d.bands
                    .filter((b) => b.status !== 'ok' && b.status !== 'na')
                    .map((b) => `${b.label} ${fmtPercent(b.share)}`)
                    .join(', ')}
                  . {d.risk}.
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>
          3. Iniciativas em vermelho e amarelo ({attention.filter((e) => e.light?.color === 'Vermelho').length} vermelho,{' '}
          {attention.filter((e) => e.light?.color === 'Amarelo').length} amarelo)
        </h3>
        {attention.length === 0 ? (
          <p className={styles.small}>Todas as iniciativas ativas estão dentro das faixas acordadas.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Iniciativa</th>
                <th>Motivos</th>
                <th>Decisão sugerida</th>
              </tr>
            </thead>
            <tbody>
              {attentionShown.map((e) => (
                <tr key={e.item.id}>
                  <td>
                    <Dot color={LIGHT_COLORS[e.light?.color ?? 'Verde']} label={e.light?.color} />
                    <span className={styles.itemTitle}>{e.item.title}</span>
                    <span className={styles.code}>{e.item.code || e.generatedCode}</span>
                  </td>
                  <td className={styles.small}>{(e.light?.reasons ?? []).join('; ')}</td>
                  <td>
                    <SuggestionPill entry={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <More total={attention.length} shown={attentionShown.length} where="Monitoramento do Portfólio" />
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>4. Roadmap do portfólio</h3>
        <Roadmap items={roadmapItems} today={evaluation.today} />
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>
          5. Decisões dos últimos {periodDays} dias ({allDecisions.length})
        </h3>
        {decisions.length === 0 ? (
          <p className={styles.small}>Nenhuma decisão registrada no período.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Iniciativa</th>
                <th>Ponto de decisão</th>
                <th>Decisão</th>
                <th>Instância</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, index) => {
                const entry = evaluation.byId.get(d.initiativeId);
                return (
                  <tr key={d.id ?? index}>
                    <td className={styles.nowrap}>{fmtDate(d.date)}</td>
                    <td>{entry ? entry.item.title : `#${d.initiativeId}`}</td>
                    <td className={styles.small}>{d.decisionPoint}</td>
                    <td>
                      <strong>{d.decision}</strong>
                    </td>
                    <td className={styles.small}>{d.body}</td>
                    <td className={styles.small}>{d.justification}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <More total={allDecisions.length} shown={decisions.length} where="Registro de Decisões" />
      </div>
    </>
  );
};

const PortfolioReport: React.FC<IPortfolioComponentProps<IPortfolioReportSettings>> = (props) => {
  const hook = usePortfolio(props);
  return (
    <PortfolioShell
      title={props.title}
      subtitle={props.subtitle}
      hook={hook}
      canEdit={props.canEdit}
      tools={<DefaultButton iconProps={{ iconName: 'Print' }} text="Imprimir / PDF" onClick={() => window.print()} />}
    >
      {(evaluation) => <Report evaluation={evaluation} />}
    </PortfolioShell>
  );
};

export default PortfolioReport;
