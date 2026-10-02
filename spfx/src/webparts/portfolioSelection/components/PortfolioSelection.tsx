import * as React from 'react';
import { ChoiceGroup } from '@fluentui/react/lib/ChoiceGroup';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import {
  cycleDemand,
  IBalanceReport,
  IEvaluatedInitiative,
  IPortfolioEvaluation,
  SelectionSuggestion
} from '../../../methodology';
import { tint } from '../../../common/accents';
import { fmtHours, fmtPercent, RANGE_STATUS_LABEL, STATUS_COLORS } from '../../../common/portfolio/format';
import { IListLinks } from '../../../common/portfolio/PortfolioRepository';
import { DecisionButton, DecisionPanel, InitiativeName, IppCell, Pill, PortfolioShell } from '../../../common/portfolio/PortfolioUi';
import { type IPortfolioComponentProps, type IPortfolioWebPartSettings } from '../../../common/portfolio/PortfolioWebPartBase';
import { usePortfolio } from '../../../common/portfolio/usePortfolio';
import styles from '../../../common/portfolio/Portfolio.module.scss';
import { ValueEffortMatrix } from './ValueEffortMatrix';

export type IPortfolioSelectionSettings = IPortfolioWebPartSettings;

export const SUGGESTION_LABEL: Record<SelectionSuggestion, string> = { select: 'Selecionar', queue: 'Fila', discard: 'Descartar' };
export const SUGGESTION_COLOR: Record<SelectionSuggestion, string> = { select: '#1e6e4a', queue: '#8a6100', discard: '#b3261e' };
const BAND_COLORS = ['#0f4c75', '#2b88d8', '#14a38b', '#e3b505', '#3d3f8f', '#d64541'];

const CompositionTable: React.FC<{
  rows: IEvaluatedInitiative[];
  evaluation: IPortfolioEvaluation;
  links: IListLinks;
  canEdit: boolean;
  onDecide: (entry: IEvaluatedInitiative) => void;
}> = ({ rows, links, canEdit, onDecide }) => {
  if (rows.length === 0) {
    return <MessageBar messageBarType={MessageBarType.info}>Nenhuma candidata aguardando seleção.</MessageBar>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.num}>Ordem</th>
            <th>Iniciativa</th>
            <th className={styles.num}>IPP</th>
            <th>Equipe</th>
            <th className={styles.num}>Demanda no ciclo</th>
            <th>Sugestão</th>
            <th>Motivos</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e, index) => {
            const decision = e.selection;
            return (
              <tr key={e.item.id}>
                <td className={styles.num}>{index + 1}</td>
                <td className={styles.nameCell}>
                  <InitiativeName entry={e} displayFormUrl={links.displayForm} />
                </td>
                <td className={styles.num}>
                  <IppCell entry={e} />
                </td>
                <td>{e.item.team || <span className={styles.muted}>–</span>}</td>
                <td className={styles.num}>{fmtHours(cycleDemand(e.item))}</td>
                <td>{decision && <Pill text={SUGGESTION_LABEL[decision.suggestion]} color={SUGGESTION_COLOR[decision.suggestion]} />}</td>
                <td>
                  {decision && decision.reasons.length > 0 ? (
                    <ul className={styles.reasons}>
                      {decision.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className={styles.small}>Cabe na capacidade do ciclo.</span>
                  )}
                </td>
                <td className={styles.nowrap}>{e.item.status}</td>
                <td>
                  <DecisionButton entry={e} canEdit={canEdit} onClick={onDecide} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Capacidade e WIP por equipe (portfólio ativo + sugeridas). */
const TeamCapacity: React.FC<{ evaluation: IPortfolioEvaluation }> = ({ evaluation }) => {
  const s = evaluation.selection;
  const selected = (e: IEvaluatedInitiative): boolean => e.stage === 'active' || e.selection?.suggestion === 'select';
  const norm = (text: string): string => text.trim().toLocaleLowerCase('pt-BR');
  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>Mapa de capacidade por equipe – {s.cycle}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Equipe</th>
              <th className={styles.num}>Alocável</th>
              <th className={styles.num}>Ativo</th>
              <th className={styles.num}>Sugeridas</th>
              <th className={styles.num}>Saldo</th>
              <th className={styles.num}>Iniciativas simultâneas</th>
            </tr>
          </thead>
          <tbody>
            {s.teams.map((team) => {
              const members = evaluation.items.filter((e) => selected(e) && norm(e.item.team) === norm(team.team));
              const active = members.filter((e) => e.stage === 'active').reduce((sum, e) => sum + (cycleDemand(e.item) ?? 0), 0);
              const proposed = members.filter((e) => e.stage !== 'active').reduce((sum, e) => sum + (cycleDemand(e.item) ?? 0), 0);
              const balance = team.allocable - active - proposed;
              return (
                <tr key={team.team}>
                  <td className={styles.itemTitle}>{team.team}</td>
                  <td className={styles.num}>{fmtHours(team.allocable)}</td>
                  <td className={styles.num}>{fmtHours(active)}</td>
                  <td className={styles.num}>{fmtHours(proposed)}</td>
                  <td className={styles.num} style={{ color: balance < 0 ? '#b3261e' : undefined }}>
                    {fmtHours(balance)}
                  </td>
                  <td className={styles.num} style={{ color: members.length > team.wipLimit ? '#b3261e' : undefined }}>
                    {members.length} / {team.wipLimit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BalanceTable: React.FC<{ balance: IBalanceReport }> = ({ balance }) => {
  if (balance.totalWeight === 0) {
    return <p className={styles.empty}>Sem iniciativas no recorte selecionado.</p>;
  }
  return (
    <div className={styles.tableWrap} style={{ marginBottom: 16 }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dimensão</th>
            <th style={{ minWidth: 180 }}>Distribuição</th>
            <th>Faixa</th>
            <th className={styles.num}>Participação</th>
            <th className={styles.num}>Referência</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {balance.dimensions.map((dimension) =>
            dimension.bands.map((band, index) => (
              <tr key={`${dimension.key}-${band.label}`}>
                {index === 0 && (
                  <>
                    <td rowSpan={dimension.bands.length} title={dimension.risk}>
                      <span className={styles.itemTitle}>{dimension.label}</span>
                      {!dimension.balanced && <div className={styles.small}>Risco: {dimension.risk}</div>}
                      {dimension.unclassifiedShare > 0.5 && <div className={styles.small}>Sem classificação: {fmtPercent(dimension.unclassifiedShare)}</div>}
                    </td>
                    <td rowSpan={dimension.bands.length}>
                      <div className={styles.stack} role="img" aria-label={dimension.bands.map((b) => `${b.label} ${fmtPercent(b.share)}`).join(', ')}>
                        {dimension.bands.map((b, i) => (
                          <span
                            key={b.label}
                            className={styles.stackSegment}
                            style={{ width: `${b.share}%`, background: BAND_COLORS[i % BAND_COLORS.length] }}
                            title={`${b.label}: ${fmtPercent(b.share)}`}
                          />
                        ))}
                      </div>
                    </td>
                  </>
                )}
                <td>
                  <span className={styles.dot} style={{ background: BAND_COLORS[index % BAND_COLORS.length] }} aria-hidden={true} />
                  {band.label}
                </td>
                <td className={styles.num}>{fmtPercent(band.share)}</td>
                <td className={styles.num}>
                  {band.target !== undefined ? `${band.target}% ` : ''}
                  <span className={styles.muted}>{rangeText(band.min, band.max)}</span>
                </td>
                <td>
                  <Pill text={RANGE_STATUS_LABEL[band.status]} color={STATUS_COLORS[band.status]} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

function rangeText(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) {
    return `(${min}–${max}%)`;
  }
  if (min !== undefined) {
    return `(≥ ${min}%)`;
  }
  return max !== undefined ? `(até ${max}%)` : '';
}

/** Mapa de calor por objetivo estratégico: detectar objetivos sem investimento. */
const ObjectiveHeatmap: React.FC<{ evaluation: IPortfolioEvaluation }> = ({ evaluation }) => {
  const columns: { key: string; label: string; match: (e: IEvaluatedInitiative) => boolean }[] = [
    { key: 'active', label: 'Ativo', match: (e) => e.stage === 'active' },
    { key: 'select', label: 'Sugeridas', match: (e) => e.selection?.suggestion === 'select' },
    { key: 'queue', label: 'Em fila', match: (e) => e.selection?.suggestion === 'queue' },
    { key: 'intake', label: 'Em análise', match: (e) => e.stage === 'intake' }
  ];
  const objectives = evaluation.params.objectives.filter((o) => o.active);
  const cell = (objective: string, match: (e: IEvaluatedInitiative) => boolean): number =>
    evaluation.items.filter((e) => e.item.objective === objective && match(e)).reduce((sum, e) => sum + (cycleDemand(e.item) ?? 0), 0);
  const values = objectives.map((o) => columns.map((c) => cell(o.name, c.match)));
  const max = Math.max(1, ...values.map((row) => Math.max(...row)));
  const orphans = evaluation.balance.orphanObjectives;

  return (
    <>
      <h4 className={styles.panelTitle} style={{ fontSize: 13 }}>
        Mapa de calor por objetivo estratégico (horas no ciclo)
      </h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Objetivo estratégico</th>
              {columns.map((c) => (
                <th key={c.key} className={styles.num}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {objectives.map((o, row) => (
              <tr key={o.name}>
                <td>
                  <span className={styles.itemTitle}>{o.name}</span>
                  {o.priority && <span className={styles.code}>Prioritário</span>}
                  {orphans.indexOf(o.name) >= 0 && <Pill text="Sem investimento" color="#b3261e" />}
                </td>
                {values[row].map((value, col) => (
                  <td key={columns[col].key} className={styles.num} style={{ background: value > 0 ? tint('#0f4c75', 0.08 + (0.5 * value) / max) : undefined }}>
                    {value > 0 ? fmtHours(value) : '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const PortfolioSelection: React.FC<IPortfolioComponentProps<IPortfolioSelectionSettings>> = (props) => {
  const hook = usePortfolio(props);
  const [deciding, setDeciding] = React.useState<IEvaluatedInitiative | undefined>();
  const [scope, setScope] = React.useState<'proposed' | 'active'>('proposed');

  return (
    <PortfolioShell title={props.title} subtitle={props.subtitle} hook={hook} canEdit={props.canEdit} showSync={true}>
      {(evaluation, links) => {
        const s = evaluation.selection;
        const commitmentTarget = evaluation.params.indicators.capacityCommitment;
        const cards = [
          { value: fmtHours(s.capacity.total), label: 'Capacidade total', detail: `Ciclo ${s.cycle}` },
          { value: fmtHours(s.capacity.sustainment), label: 'Sustentação/operação', detail: 'Descontada da capacidade' },
          { value: fmtHours(s.capacity.reserve), label: 'Reserva para imprevistos', detail: `${evaluation.params.selection.reservePercent}% da disponível (padrão)` },
          { value: fmtHours(s.capacity.allocable), label: 'Capacidade alocável', detail: 'Total − sustentação − reserva' },
          { value: fmtHours(s.committedByActive), label: 'Comprometida (portfólio ativo)', detail: 'Autorizadas e em andamento' },
          { value: fmtHours(s.selectedDemand), label: 'Sugerida para seleção', detail: 'Candidatas que cabem no ciclo' },
          { value: fmtHours(s.remaining), label: 'Saldo', detail: s.remaining < 0 ? 'Acima da capacidade alocável' : 'Capacidade ainda livre' },
          {
            value: fmtPercent(s.commitmentPercent),
            label: 'Comprometimento',
            detail: `Referência: ${commitmentTarget.min}% a ${commitmentTarget.max}% da disponível`
          }
        ];
        const candidates = evaluation.items.filter((e) => e.stage === 'candidate');
        const ordered = s.order
          .map((id) => evaluation.byId.get(id) as IEvaluatedInitiative)
          .concat(candidates.filter((e) => s.order.indexOf(e.item.id) < 0));
        const balance = scope === 'proposed' ? evaluation.balance : evaluation.activeBalance;

        return (
          <>
            <ul className={styles.cards}>
              {cards.map((card) => (
                <li key={card.label} className={styles.card}>
                  <span className={styles.cardValue}>{card.value}</span>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <span className={styles.cardDetail}>{card.detail}</span>
                </li>
              ))}
            </ul>
            {s.alerts.length > 0 && (
              <ul className={styles.alerts}>
                {s.alerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            )}

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>◆ Ponto de decisão 2 – Composição sugerida</h3>
              <p className={styles.small}>
                A lista priorizada é percorrida de cima para baixo, alocando capacidade até o limite. O que não couber permanece na fila, não no
                portfólio ativo. Obrigatórias entram com capacidade reservada; dependências são selecionadas em conjunto.
              </p>
              <CompositionTable rows={ordered} evaluation={evaluation} links={links} canEdit={props.canEdit} onDecide={setDeciding} />
            </div>

            {s.teams.length > 0 && <TeamCapacity evaluation={evaluation} />}

            <div className={styles.panel}>
              <div className={styles.topBar}>
                <h3 className={styles.panelTitle}>Balanceamento do portfólio</h3>
                <ChoiceGroup
                  selectedKey={scope}
                  onChange={(_, o) => setScope(o?.key === 'active' ? 'active' : 'proposed')}
                  options={[
                    { key: 'proposed', text: 'Ativo + sugeridas' },
                    { key: 'active', text: 'Somente ativo' }
                  ]}
                  styles={{ flexContainer: { display: 'flex', gap: 16 } }}
                />
              </div>
              <p className={styles.small}>
                Priorizar produz uma lista; balancear produz um portfólio. Participação calculada{' '}
                {balance.basis === 'effort' ? 'pela demanda de capacidade no ciclo (horas)' : 'pelo número de iniciativas (sem estimativas de esforço)'}. As
                faixas são referências de partida, não regras.
              </p>
              <BalanceTable balance={balance} />
              <ObjectiveHeatmap evaluation={evaluation} />
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Matriz Valor × Custo-Risco</h3>
              <p className={styles.small}>Tamanho da bolha = custo estimado; cor = situação/sugestão. Passe o mouse para ver a iniciativa.</p>
              <ValueEffortMatrix evaluation={evaluation} />
            </div>

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
        );
      }}
    </PortfolioShell>
  );
};

export default PortfolioSelection;
