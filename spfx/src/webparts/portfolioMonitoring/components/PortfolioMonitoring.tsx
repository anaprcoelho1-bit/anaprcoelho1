import * as React from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import {
  costDeviation,
  IEvaluatedInitiative,
  IIndicator,
  IPortfolioEvaluation,
  monitoringAlerts,
  STATUS,
  TRAFFIC_LIGHT_ACTION,
  TrafficLight
} from '../../../methodology';
import {
  fmtDate,
  fmtPercent,
  INDICATOR_STATUS_LABEL,
  LIGHT_COLORS,
  STATUS_COLORS
} from '../../../common/portfolio/format';
import { IListLinks } from '../../../common/portfolio/PortfolioRepository';
import { DecisionButton, DecisionPanel, Dot, InitiativeName, Pill, PortfolioShell, SuggestionPill } from '../../../common/portfolio/PortfolioUi';
import { type IPortfolioComponentProps, type IPortfolioWebPartSettings } from '../../../common/portfolio/PortfolioWebPartBase';
import { usePortfolio } from '../../../common/portfolio/usePortfolio';
import styles from '../../../common/portfolio/Portfolio.module.scss';

export type IPortfolioMonitoringSettings = IPortfolioWebPartSettings;

const LIGHT_ORDER: Record<string, number> = { Vermelho: 0, Amarelo: 1, Verde: 2 };

export const IndicatorCards: React.FC<{ indicators: IIndicator[] }> = ({ indicators }) => (
  <ul className={styles.cards} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
    {indicators.map((indicator) => (
      <li key={indicator.id} className={styles.card} style={{ borderLeftColor: STATUS_COLORS[indicator.status] }} title={indicator.formula}>
        <span className={styles.cardDetail}>
          {indicator.id}. {indicator.frequency}
        </span>
        <span className={styles.cardValue}>{indicator.display}</span>
        <span className={styles.cardLabel}>{indicator.name}</span>
        <span className={styles.cardDetail}>
          Meta: {indicator.target} · <span style={{ color: STATUS_COLORS[indicator.status], fontWeight: 600 }}>{INDICATOR_STATUS_LABEL[indicator.status]}</span>
        </span>
        <span className={styles.cardDetail}>{indicator.detail}</span>
      </li>
    ))}
  </ul>
);

const ActivePortfolio: React.FC<{
  evaluation: IPortfolioEvaluation;
  links: IListLinks;
  canEdit: boolean;
  onDecide: (entry: IEvaluatedInitiative) => void;
}> = ({ evaluation, links, canEdit, onDecide }) => {
  const rows = evaluation.items
    .filter((e) => e.stage === 'active' || e.item.status === STATUS.suspended)
    .sort(
      (a, b) =>
        (a.stage === 'active' ? 0 : 1) - (b.stage === 'active' ? 0 : 1) ||
        (LIGHT_ORDER[a.light?.color ?? ''] ?? 3) - (LIGHT_ORDER[b.light?.color ?? ''] ?? 3) ||
        (a.rank ?? 9999) - (b.rank ?? 9999)
    );
  const counts: Record<TrafficLight, number> = { Vermelho: 0, Amarelo: 0, Verde: 0 };
  rows.forEach((e) => {
    if (e.light) {
      counts[e.light.color]++;
    }
  });

  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>Portfólio ativo – semáforo e revisão</h3>
      <ul className={styles.legend} style={{ marginBottom: 12 }}>
        {(Object.keys(counts) as TrafficLight[]).map((color) => (
          <li key={color} title={TRAFFIC_LIGHT_ACTION[color]}>
            <Dot color={LIGHT_COLORS[color]} />
            <strong>{counts[color]}</strong>&nbsp;{color.toLocaleLowerCase('pt-BR')} – {TRAFFIC_LIGHT_ACTION[color]}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <MessageBar messageBarType={MessageBarType.info}>Nenhuma iniciativa autorizada ou em andamento.</MessageBar>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.center}>Sinal</th>
                <th>Iniciativa</th>
                <th>Responsáveis</th>
                <th className={styles.num}>Progresso</th>
                <th className={styles.num}>Desvio de prazo</th>
                <th className={styles.num}>Desvio de custo</th>
                <th>Alertas e critérios de permanência</th>
                <th>Decisão sugerida (revisão)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const alerts = monitoringAlerts(e);
                return (
                  <tr key={e.item.id}>
                    <td className={styles.center}>{e.light ? <Dot color={LIGHT_COLORS[e.light.color]} label={e.light.color} /> : <Pill text="Suspensa" color="#6b7785" />}</td>
                    <td className={styles.nameCell}>
                      <InitiativeName entry={e} displayFormUrl={links.displayForm} />
                      <span className={styles.code}>
                        {e.item.status} · término {fmtDate(e.item.projectedEnd ?? e.item.baselineEnd)}
                      </span>
                    </td>
                    <td className={styles.small}>
                      {e.item.businessOwner && <div>Negócio: {e.item.businessOwner}</div>}
                      {e.item.initiativeManager && <div>Gestor: {e.item.initiativeManager}</div>}
                      {e.item.team && <div>{e.item.team}</div>}
                    </td>
                    <td className={styles.num}>{fmtPercent(e.item.progress)}</td>
                    <td className={styles.num}>{fmtPercent(e.scheduleDeviation)}</td>
                    <td className={styles.num}>{fmtPercent(costDeviation(e.item))}</td>
                    <td>
                      {alerts.length === 0 ? (
                        <span className={styles.small}>Dentro das faixas acordadas</span>
                      ) : (
                        <ul className={styles.reasons}>
                          {alerts.map((alert) => (
                            <li key={alert}>{alert}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      {e.stage === 'active' ? <SuggestionPill entry={e} /> : <span className={styles.small}>Avaliar retomada ou encerramento</span>}
                      {e.stage === 'active' && e.suggestionReason && <div className={styles.small}>{e.suggestionReason}</div>}
                    </td>
                    <td>
                      <DecisionButton entry={e} canEdit={canEdit} onClick={onDecide} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.small} style={{ marginTop: 10 }}>
        O monitoramento do portfólio não substitui a gestão de cada iniciativa: o portfólio olha para o conjunto; o gerente de projeto/produto olha
        para o componente.
      </p>
    </div>
  );
};

const PortfolioMonitoring: React.FC<IPortfolioComponentProps<IPortfolioMonitoringSettings>> = (props) => {
  const hook = usePortfolio(props);
  const [deciding, setDeciding] = React.useState<IEvaluatedInitiative | undefined>();

  return (
    <PortfolioShell title={props.title} subtitle={props.subtitle} hook={hook} canEdit={props.canEdit} showSync={true}>
      {(evaluation, links) => (
        <>
          <IndicatorCards indicators={evaluation.indicators} />
          {evaluation.readings.length > 0 && (
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Leitura combinada dos indicadores</h3>
              <ul className={styles.reasons} style={{ fontSize: 13, color: 'inherit' }}>
                {evaluation.readings.map((reading) => (
                  <li key={reading}>{reading}</li>
                ))}
              </ul>
            </div>
          )}
          <ActivePortfolio evaluation={evaluation} links={links} canEdit={props.canEdit} onDecide={setDeciding} />
          <DecisionPanel
            entry={deciding}
            repository={hook.repository}
            onDismiss={() => setDeciding(undefined)}
            onSaved={() => {
              setDeciding(undefined);
              hook.reload();
            }}
          />
        </>
      )}
    </PortfolioShell>
  );
};

export default PortfolioMonitoring;
