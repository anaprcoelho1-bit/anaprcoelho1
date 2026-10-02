import * as React from 'react';
import { DefaultButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { IEvaluatedInitiative, IMethodologyParameters, IPortfolioEvaluation } from '../../../methodology';
import { fmtDate, fmtIndex, fmtNumber } from '../../../common/portfolio/format';
import { IListLinks } from '../../../common/portfolio/PortfolioRepository';
import {
  DecisionButton,
  DecisionPanel,
  InitiativeName,
  IppCell,
  Pill,
  PortfolioShell,
  SuggestionPill
} from '../../../common/portfolio/PortfolioUi';
import { type IPortfolioComponentProps, type IPortfolioWebPartSettings } from '../../../common/portfolio/PortfolioWebPartBase';
import { IPortfolioHook, usePortfolio } from '../../../common/portfolio/usePortfolio';
import styles from '../../../common/portfolio/Portfolio.module.scss';

export type IPortfolioPrioritizationSettings = IPortfolioWebPartSettings;

const GATE_COLORS: Record<string, string> = {
  pass: '#1e6e4a',
  mandatory: '#3d3f8f',
  pending: '#8a6100',
  unfeasible: '#b3261e',
  unaligned: '#b3261e'
};

const GATE_SHORT: Record<string, string> = {
  pass: 'Passa',
  mandatory: 'Obrigatória',
  pending: 'Viabilidade pendente',
  unfeasible: 'Inviável',
  unaligned: 'Sem alinhamento'
};

interface ITableProps {
  rows: IEvaluatedInitiative[];
  evaluation: IPortfolioEvaluation;
  links: IListLinks;
  canEdit: boolean;
  onDecide: (entry: IEvaluatedInitiative) => void;
}

/** Avaliações individuais do comitê: divergências e consolidação pela mediana. */
const ScoreSheets: React.FC<{ entry: IEvaluatedInitiative; canEdit: boolean; hook: IPortfolioHook }> = ({ entry, canEdit, hook }) => {
  const [saving, setSaving] = React.useState(false);
  const c = entry.consolidation;
  if (!c) {
    return <span className={styles.small}>Sem avaliações individuais</span>;
  }
  const differs = Object.keys(c.medians).some((field) => entry.item.scores[field] !== c.medians[field]);
  return (
    <div>
      <span className={styles.small} title={c.evaluators.join(', ')}>
        {c.evaluators.length} avaliador(es)
      </span>
      {c.divergences.map((d) => (
        <div key={d.field}>
          <Pill text={`${d.label}: ${d.min}–${d.max}`} color="#b3261e" title="Divergência: discutir antes de consolidar" />
        </div>
      ))}
      {canEdit && c.readyToConsolidate && differs && (
        <DefaultButton
          text={saving ? 'Gravando...' : 'Aplicar mediana'}
          disabled={saving}
          title="Grava na iniciativa a mediana das notas dos avaliadores"
          styles={{ root: { minWidth: 0, padding: '0 8px', height: 26, marginTop: 4 } }}
          onClick={() => {
            setSaving(true);
            hook.repository
              .applyScores(entry.item.id, c.medians)
              .then(() => hook.reload())
              .catch((error: Error) => window.alert(error.message))
              .then(() => setSaving(false))
              .catch(() => setSaving(false));
          }}
        />
      )}
    </div>
  );
};

const PriorityMatrix: React.FC<ITableProps & { hook: IPortfolioHook }> = ({ rows, links, canEdit, onDecide, hook }) => {
  if (rows.length === 0) {
    return <p className={styles.empty}>Nenhuma iniciativa elegível ou ativa no portfólio.</p>;
  }
  return (
    <div className={styles.tableWrap} style={{ marginTop: 12 }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.num}>#</th>
            <th>Iniciativa</th>
            <th>Objetivo / motivação</th>
            <th className={styles.num} title="Valor Ponderado (0 a 100)">
              VP
            </th>
            <th className={styles.num} title="Custo-Risco Ponderado (0 a 100)">
              CR
            </th>
            <th className={styles.num} title="Índice de Prioridade do Portfólio = VP ÷ CR">
              IPP
            </th>
            <th>Leitura</th>
            <th>Pontos de controle</th>
            <th>Avaliações</th>
            <th>Situação</th>
            <th>Sugestão do modelo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.item.id}>
              <td className={styles.num}>{e.rank ?? '–'}</td>
              <td className={styles.nameCell}>
                <InitiativeName entry={e} displayFormUrl={links.displayForm} />
              </td>
              <td>
                {e.item.objective || <span className={styles.muted}>Sem objetivo</span>}
                <span className={styles.code}>{e.item.motivation}</span>
              </td>
              <td className={styles.num}>{fmtIndex(e.vp)}</td>
              <td className={styles.num}>{fmtIndex(e.cr)}</td>
              <td className={styles.num}>
                <IppCell entry={e} />
              </td>
              <td>{e.band ? <Pill text={e.band.recommendation} color={e.band.color} title={e.band.label} /> : <span className={styles.small}>Notas pendentes: {e.missing.length}</span>}</td>
              <td>
                <Pill text={GATE_SHORT[e.gate.outcome]} color={GATE_COLORS[e.gate.outcome]} title={e.gate.label} />
              </td>
              <td>
                <ScoreSheets entry={e} canEdit={canEdit} hook={hook} />
              </td>
              <td className={styles.nowrap}>{e.item.status}</td>
              <td>
                <SuggestionPill entry={e} />
                {e.suggestionReason && <div className={styles.small}>{e.suggestionReason}</div>}
              </td>
              <td>
                <DecisionButton entry={e} canEdit={canEdit} onClick={onDecide} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const IntakeQueue: React.FC<ITableProps> = ({ rows, evaluation, links, canEdit, onDecide }) => {
  if (rows.length === 0) {
    return <p className={styles.empty}>Nenhuma iniciativa aguardando análise.</p>;
  }
  return (
    <div className={styles.tableWrap} style={{ marginTop: 12 }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Iniciativa</th>
            <th>Registro</th>
            <th>Critérios de entrada</th>
            <th>Pontos de controle</th>
            <th>Duplicidade</th>
            <th>Situação</th>
            <th>Sugestão do modelo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const met = e.entry.filter((c) => c.met).length;
            return (
              <tr key={e.item.id}>
                <td className={styles.nameCell}>
                  <InitiativeName entry={e} displayFormUrl={links.displayForm} />
                  {e.item.unit && <span className={styles.code}>{e.item.unit}</span>}
                </td>
                <td className={styles.nowrap}>{fmtDate(e.item.created)}</td>
                <td>
                  <strong>
                    {met}/{e.entry.length}
                  </strong>
                  <ul className={styles.reasons} style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {e.entry.map((c) => (
                      <li key={c.key}>
                        <Icon iconName={c.met ? 'CheckMark' : 'Cancel'} className={c.met ? styles.check : styles.cross} aria-label={c.met ? 'Atende' : 'Pendente'} />{' '}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <Pill text={GATE_SHORT[e.gate.outcome]} color={GATE_COLORS[e.gate.outcome]} title={e.gate.label} />
                </td>
                <td>
                  {e.duplicates.length === 0 ? (
                    <span className={styles.small}>Nenhuma</span>
                  ) : (
                    e.duplicates.map((id) => {
                      const other = evaluation.byId.get(id);
                      return (
                        <div key={id} className={styles.small}>
                          {other ? other.item.title : `#${id}`}
                        </div>
                      );
                    })
                  )}
                </td>
                <td className={styles.nowrap}>{e.item.status || '–'}</td>
                <td>
                  <SuggestionPill entry={e} />
                  {e.suggestionReason && <div className={styles.small}>{e.suggestionReason}</div>}
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
  );
};

/** Transparência: critérios, pesos, fórmulas e faixas vigentes. */
const CriteriaReference: React.FC<{ params: IMethodologyParameters }> = ({ params }) => {
  const sumWeights = (list: { weight: number }[]): number => list.reduce((s, c) => s + c.weight, 0);
  const valueMax = params.scale.max * sumWeights(params.valueCriteria);
  const costMax = params.scale.max * sumWeights(params.costRiskCriteria);
  const criteriaTable = (title: string, list: IMethodologyParameters['valueCriteria'], note: string): React.ReactElement => (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      <p className={styles.small}>{note}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Critério</th>
              <th className={styles.num}>Peso</th>
              <th>Nota {params.scale.min}</th>
              <th>Nota {params.scale.max}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.field}>
                <td className={styles.itemTitle}>{c.label}</td>
                <td className={styles.num}>{c.weight}</td>
                <td>{c.low}</td>
                <td>{c.high}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Soma dos pesos</strong>
              </td>
              <td className={styles.num}>
                <strong>{sumWeights(list)}</strong>
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      <div className={styles.panelGrid}>
        {criteriaTable('Critérios de valor', params.valueCriteria, `Valor Ponderado (VP) = (Σ nota × peso ÷ ${valueMax}) × 100 → escala 0 a 100.`)}
        {criteriaTable(
          'Critérios de custo, esforço e risco',
          params.costRiskCriteria,
          `Aqui nota ${params.scale.min} = muito baixo (favorável) e nota ${params.scale.max} = muito alto (desfavorável). Custo-Risco Ponderado (CR) = (Σ nota × peso ÷ ${costMax}) × 100.`
        )}
      </div>
      <div className={styles.panelGrid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Índice de Prioridade do Portfólio (IPP = VP ÷ CR)</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Faixa de IPP</th>
                  <th>Leitura</th>
                  <th>Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {params.ippBands
                  .slice()
                  .sort((a, b) => b.min - a.min)
                  .map((band, index, all) => (
                    <tr key={band.label}>
                      <td className={styles.nowrap}>
                        {index === 0
                          ? `≥ ${fmtNumber(band.min, 2)}`
                          : band.min === 0
                            ? `< ${fmtNumber(all[index - 1].min, 2)}`
                            : `${fmtNumber(band.min, 2)} – ${fmtNumber(all[index - 1].min - 0.01, 2)}`}
                      </td>
                      <td>{band.label}</td>
                      <td>
                        <Pill text={band.recommendation} color={band.color} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Pontos de controle (avaliação binária)</h3>
          <ul className={styles.reasons} style={{ fontSize: 13, color: 'inherit' }}>
            <li>
              <strong>Viabilidade:</strong> se inviável (legal, técnica ou operacionalmente), não entra, independentemente do valor.
            </li>
            <li>
              <strong>Obrigatoriedade legal/regulatória:</strong> entra no portfólio, mas é pontuada e tem capacidade reservada de forma visível.
            </li>
            <li>
              <strong>Alinhamento mínimo:</strong> sem vínculo com objetivo estratégico e não obrigatória, não entra.
            </li>
          </ul>
          <p className={styles.small}>
            Regras da pontuação: feita em conjunto pelo comitê; divergências superiores a {params.divergenceThreshold} pontos na mesma nota são
            discutidas antes de consolidar. Entre iniciativas de IPP semelhante (diferença até {fmtNumber(params.selection.similarIppTolerance, 2)}),
            prioriza-se a de menor duração. Pesos revistos anualmente — nunca no meio de uma priorização.
          </p>
        </div>
      </div>
    </div>
  );
};

const PortfolioPrioritization: React.FC<IPortfolioComponentProps<IPortfolioPrioritizationSettings>> = (props) => {
  const hook = usePortfolio(props);
  const [deciding, setDeciding] = React.useState<IEvaluatedInitiative | undefined>();

  return (
    <PortfolioShell title={props.title} subtitle={props.subtitle} hook={hook} canEdit={props.canEdit} showSync={true}>
      {(evaluation, links) => {
        const intake = evaluation.items.filter((e) => e.stage === 'intake').sort((a, b) => a.item.created.getTime() - b.item.created.getTime());
        const matrix = evaluation.items
          .filter((e) => e.stage === 'candidate' || e.stage === 'active')
          .sort((a, b) => (a.rank ?? Number.MAX_VALUE) - (b.rank ?? Number.MAX_VALUE) || a.item.id - b.item.id);
        const divergent = matrix.filter((e) => e.consolidation && e.consolidation.divergences.length > 0).length;
        const duplicates = intake.concat(matrix).filter((e) => e.duplicates.length > 0).length;
        const cards = [
          { value: intake.length, label: 'Na fila de entrada', detail: 'Registradas, em análise ou em detalhamento' },
          { value: evaluation.items.filter((e) => e.stage === 'candidate').length, label: 'Candidatas', detail: 'Elegíveis aguardando seleção ou autorização' },
          { value: matrix.filter((e) => e.ipp !== undefined).length, label: 'Com IPP calculado', detail: 'Ativas e candidatas com todas as notas' },
          { value: divergent, label: 'Com divergência de notas', detail: `Diferença maior que ${evaluation.params.divergenceThreshold} pontos entre avaliadores` },
          { value: duplicates, label: 'Possíveis duplicidades', detail: 'Nomes semelhantes a outra iniciativa aberta' }
        ];
        return (
          <>
            <ul className={styles.cards}>
              {cards.map((card) => (
                <li key={card.label} className={styles.card}>
                  <span className={styles.cardValue}>{fmtNumber(card.value)}</span>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <span className={styles.cardDetail}>{card.detail}</span>
                </li>
              ))}
            </ul>
            <Pivot aria-label="Visões da priorização" overflowBehavior="menu">
              <PivotItem headerText={`Matriz de priorização (${matrix.length})`} itemIcon="BulletedList2">
                <PriorityMatrix rows={matrix} evaluation={evaluation} links={links} hook={hook} canEdit={props.canEdit} onDecide={setDeciding} />
              </PivotItem>
              <PivotItem headerText={`Fila de entrada (${intake.length})`} itemIcon="Inbox">
                <IntakeQueue rows={intake} evaluation={evaluation} links={links} canEdit={props.canEdit} onDecide={setDeciding} />
              </PivotItem>
              <PivotItem headerText="Critérios e pesos" itemIcon="Equalizer">
                <CriteriaReference params={evaluation.params} />
              </PivotItem>
            </Pivot>
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

export default PortfolioPrioritization;
