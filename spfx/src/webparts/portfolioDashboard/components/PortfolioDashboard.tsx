import * as React from 'react';
import { type SPHttpClient } from '@microsoft/sp-http';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { ActionButton } from '../../../common/ActionButton';
import { tint } from '../../../common/accents';
import { linkTarget } from '../../../common/links';
import { SectionHeader } from '../../../common/SectionHeader';
import { countByObjective, countByStatus, type IStatusConfig } from '../services/aggregate';
import { loadInitiatives, type IInitiativeRow } from '../services/InitiativeService';
import { ObjectiveBars } from './ObjectiveBars';
import { StatusDonut } from './StatusDonut';
import styles from './PortfolioDashboard.module.scss';

export interface IPortfolioDashboardSettings {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  indicatorsTitle: string;
  panelLinkText: string;
  panelLinkUrl: string;
  statusChartTitle: string;
  objectiveChartTitle: string;
  listTitle: string;
  statusField: string;
  objectiveField: string;
  statuses: IStatusConfig[];
}

export interface IPortfolioDashboardProps extends IPortfolioDashboardSettings {
  spHttpClient: SPHttpClient;
  webUrl: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; reason: string }
  | { kind: 'ready'; rows: IInitiativeRow[] };

const PortfolioDashboard: React.FC<IPortfolioDashboardProps> = (props) => {
  const { spHttpClient, webUrl, listTitle, statusField, objectiveField } = props;
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadInitiatives(spHttpClient, webUrl, listTitle, statusField, objectiveField)
      .then((rows) => !cancelled && setState({ kind: 'ready', rows }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', reason: error.message }));
    return () => {
      cancelled = true;
    };
  }, [spHttpClient, webUrl, listTitle, statusField, objectiveField]);

  const rows = state.kind === 'ready' ? state.rows : [];
  const statusCounts = countByStatus(rows, props.statuses ?? []);
  const objectiveCounts = countByObjective(rows);
  const format = (value: number): string => (state.kind === 'ready' ? value.toLocaleString('pt-BR') : '–');

  return (
    <section className={styles.dashboard}>
      <div className={styles.container}>
        <div className={styles.summary}>
          <SectionHeader title={props.title} subtitle={props.subtitle} />
          <ul className={styles.tiles}>
            {statusCounts.map((status, index) => (
              <li
                key={status.uniqueId ?? index}
                className={styles.tile}
                style={{ background: tint(status.color, 0.12), borderColor: tint(status.color, 0.22) }}
              >
                <span className={styles.tileValue} style={{ color: status.color }}>
                  {format(status.count)}
                </span>
                <span className={styles.tileLabel}>{status.label}</span>
              </li>
            ))}
          </ul>
          <ActionButton text={props.buttonText} url={props.buttonUrl} />
        </div>

        <div className={styles.indicators}>
          <div className={styles.indicatorsHeader}>
            <h2 className={styles.indicatorsTitle}>{props.indicatorsTitle}</h2>
            {props.panelLinkText && props.panelLinkUrl && (
              <a className={styles.panelLink} href={props.panelLinkUrl} {...linkTarget(props.panelLinkUrl)}>
                {props.panelLinkText}
              </a>
            )}
          </div>
          <div className={styles.chartCard}>
            {state.kind === 'loading' && <Spinner size={SpinnerSize.medium} label="Carregando indicadores..." />}
            {state.kind === 'error' && (
              <p className={styles.message} role="alert">
                {state.reason === 'not-found'
                  ? `A lista “${listTitle}” não foi encontrada neste site. Verifique o nome da lista nas propriedades da web part.`
                  : `Não foi possível carregar os indicadores (${state.reason}). Verifique a lista e os nomes internos das colunas.`}
              </p>
            )}
            {state.kind === 'ready' && rows.length === 0 && (
              <p className={styles.message}>Nenhuma iniciativa cadastrada na lista “{listTitle}” até o momento.</p>
            )}
            {state.kind === 'ready' && rows.length > 0 && (
              <div className={styles.charts}>
                <div className={styles.chart}>
                  <h3 className={styles.chartTitle}>{props.statusChartTitle}</h3>
                  <StatusDonut data={statusCounts} />
                </div>
                <div className={styles.chart}>
                  <h3 className={styles.chartTitle}>{props.objectiveChartTitle}</h3>
                  <ObjectiveBars data={objectiveCounts} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PortfolioDashboard;
