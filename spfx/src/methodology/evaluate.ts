import { balancePortfolio, IBalanceReport, rangeStatus } from './balance';
import {
  ACTIVE_STATUSES,
  CANDIDATE_STATUSES,
  CLOSED_STATUSES,
  IDecisionRecord,
  IInitiative,
  INTAKE_STATUSES,
  IPortfolioInput,
  isOneOf,
  IScoreSheet,
  STATUS
} from './model';
import {
  daysBetween,
  IPermanenceTrigger,
  ITrafficLightResult,
  permanenceTriggers,
  scheduleDeviation,
  suggestReviewDecision,
  trafficLight
} from './monitoring';
import { IAuthorityLevel, IMethodologyParameters } from './parameters';
import {
  authorityLevel,
  consolidateScores,
  entryCriteria,
  evaluateGates,
  findPossibleDuplicates,
  IEntryCheck,
  IGateResult,
  isMandatory,
  IScoreConsolidation,
  IScoreResult,
  scoreInitiative
} from './scoring';
import { cycleDemand, cycleOf, formatNumber, ISelectionDecision, ISelectionResult, selectPortfolio, sum } from './selection';

export type Stage = 'intake' | 'candidate' | 'active' | 'closed';

export interface IEvaluatedInitiative extends IScoreResult {
  item: IInitiative;
  stage: Stage;
  gate: IGateResult;
  entry: IEntryCheck[];
  entryMet: boolean;
  authority: IAuthorityLevel;
  duplicates: number[];
  consolidation?: IScoreConsolidation;
  rank?: number;
  topQuartile: boolean;
  selection?: ISelectionDecision;
  light?: ITrafficLightResult;
  scheduleDeviation?: number;
  triggers: IPermanenceTrigger[];
  /** Sugestão do modelo para a próxima decisão (texto curto) e o motivo. */
  suggestion: string;
  suggestionReason: string;
  /** Código gerado quando a iniciativa ainda não tem um (INI-AAAA-NNN). */
  generatedCode?: string;
}

export type IndicatorStatus = 'ok' | 'warn' | 'bad' | 'na';

export interface IIndicator {
  id: number;
  name: string;
  formula: string;
  value?: number;
  display: string;
  target: string;
  frequency: string;
  status: IndicatorStatus;
  detail: string;
}

export interface IPortfolioEvaluation {
  today: Date;
  cycle: string;
  params: IMethodologyParameters;
  items: IEvaluatedInitiative[];
  byId: Map<number, IEvaluatedInitiative>;
  selection: ISelectionResult;
  /** Balanceamento do portfólio ativo + sugerido para seleção. */
  balance: IBalanceReport;
  /** Balanceamento apenas do portfólio ativo. */
  activeBalance: IBalanceReport;
  indicators: IIndicator[];
  readings: string[];
  /** Registro de Decisões (mais recentes primeiro). */
  decisions: IDecisionRecord[];
}

export function stageOf(status: string): Stage {
  if (isOneOf(status, ACTIVE_STATUSES)) {
    return 'active';
  }
  if (isOneOf(status, CANDIDATE_STATUSES)) {
    return 'candidate';
  }
  if (isOneOf(status, CLOSED_STATUSES)) {
    return 'closed';
  }
  if (isOneOf(status, INTAKE_STATUSES) || !status) {
    return 'intake';
  }
  return 'intake';
}

export function initiativeCode(item: IInitiative): string {
  const id = `00${item.id}`;
  return `INI-${item.created.getFullYear()}-${id.substring(id.length - Math.max(3, String(item.id).length))}`;
}

/** Avalia o portfólio inteiro: aplica todas as regras da metodologia aos dados informados. */
export function evaluatePortfolio(
  input: IPortfolioInput,
  params: IMethodologyParameters,
  today: Date = new Date(),
  cycle: string = cycleOf(today)
): IPortfolioEvaluation {
  const open = input.initiatives.filter((item) => stageOf(item.status) !== 'closed');
  const duplicates = findPossibleDuplicates(open);
  const sheetsById = new Map<number, IScoreSheet[]>();
  input.scoreSheets.forEach((sheet) => sheetsById.set(sheet.initiativeId, (sheetsById.get(sheet.initiativeId) ?? []).concat(sheet)));

  const items: IEvaluatedInitiative[] = input.initiatives.map((item) => {
    const entry = entryCriteria(item, params);
    const sheets = sheetsById.get(item.id);
    const stage = stageOf(item.status);
    return {
      ...scoreInitiative(item.scores, params),
      item,
      stage,
      gate: evaluateGates(item, params),
      entry,
      entryMet: entry.every((check) => check.met),
      authority: authorityLevel(item, params),
      // Verificação de duplicidade (etapa 2): só para quem ainda está na entrada ou na seleção.
      duplicates: stage === 'intake' || stage === 'candidate' ? duplicates.get(item.id) ?? [] : [],
      consolidation: sheets ? consolidateScores(sheets, params) : undefined,
      topQuartile: false,
      triggers: [],
      suggestion: '',
      suggestionReason: '',
      generatedCode: item.code ? undefined : initiativeCode(item)
    };
  });
  const byId = new Map<number, IEvaluatedInitiative>();
  items.forEach((entry) => byId.set(entry.item.id, entry));

  const active = items.filter((e) => e.stage === 'active');
  const candidates = items.filter((e) => e.stage === 'candidate');

  // Etapas 4 e 5: ordenação e seleção pela capacidade.
  const selection = selectPortfolio(
    active.map((e) => e.item),
    candidates.map((e) => ({ item: e.item, ipp: e.ipp, gatePasses: e.gate.passes, mandatory: isMandatory(e.item) })),
    input.capacity,
    cycle,
    params,
    items.filter((e) => e.item.status === STATUS.completed).map((e) => e.item.id)
  );

  // Ranking geral (ativas + candidatas) e quartil superior de IPP.
  const ranked = active
    .concat(candidates)
    .filter((e) => e.ipp !== undefined)
    .sort((a, b) => (b.ipp as number) - (a.ipp as number) || a.item.id - b.item.id);
  ranked.forEach((e, index) => {
    e.rank = index + 1;
  });
  const quartileSize = Math.ceil(ranked.length / 4);
  ranked.slice(0, quartileSize).forEach((e) => {
    e.topQuartile = true;
  });

  // Sugestões e monitoramento por estágio.
  items.forEach((e) => {
    if (e.stage === 'intake') {
      suggestIntake(e);
    } else if (e.stage === 'candidate') {
      e.selection = selection.decisions.get(e.item.id);
      const map: Record<string, string> = { select: 'Selecionar', queue: 'Manter em fila', discard: 'Descartar' };
      if (e.selection) {
        e.suggestion = map[e.selection.suggestion];
        e.suggestionReason = e.selection.reasons.join(' ');
      }
      if (e.item.status === STATUS.selected || e.item.status === STATUS.pendingApproval) {
        e.suggestion = e.selection && e.selection.suggestion !== 'select' ? e.suggestion : 'Autorizar';
        e.suggestionReason = e.suggestionReason || `Alçada: ${e.authority.decider}.`;
      }
      e.triggers = permanenceTriggers(e.item, today, params).filter((t) => t.key === 'objective');
    } else if (e.stage === 'active') {
      e.light = trafficLight(e.item, today, params);
      e.scheduleDeviation = scheduleDeviation(e.item);
      e.triggers = permanenceTriggers(e.item, today, params);
      const review = suggestReviewDecision(e.item, e.triggers, e.ipp, e.light.color, params);
      e.suggestion = review.decision;
      e.suggestionReason = review.reason;
    } else {
      e.suggestion = '';
    }
  });

  const selectedIds = Array.from(selection.decisions.values())
    .filter((d) => d.suggestion === 'select')
    .map((d) => d.id);
  const proposed = active.map((e) => e.item).concat(selectedIds.map((id) => (byId.get(id) as IEvaluatedInitiative).item));
  const balance = balancePortfolio(proposed, params);
  const activeBalance = balancePortfolio(
    active.map((e) => e.item),
    params
  );

  const indicators = computeIndicators(items, input, selection, activeBalance, params, today);
  const readings = combinedReadings(indicators, activeBalance, params);

  const decisions = input.decisions.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
  return { today, cycle, params, items, byId, selection, balance, activeBalance, indicators, readings, decisions };
}

function suggestIntake(e: IEvaluatedInitiative): void {
  if (e.gate.passes === false) {
    e.suggestion = 'Recusar';
    e.suggestionReason = e.gate.label;
    return;
  }
  const pending = e.entry.filter((check) => !check.met);
  if (pending.length > 0) {
    e.suggestion = e.item.status === STATUS.registered ? 'Iniciar análise' : 'Devolver para detalhamento';
    e.suggestionReason = `Pendências: ${pending.map((p) => p.label.toLocaleLowerCase('pt-BR')).join('; ')}.`;
    return;
  }
  if (e.duplicates.length > 0) {
    e.suggestion = 'Verificar duplicidade';
    e.suggestionReason = `Nome semelhante a outras iniciativas (#${e.duplicates.join(', #')}).`;
    return;
  }
  e.suggestion = 'Elegível';
  e.suggestionReason = 'Atende aos critérios de entrada e aos pontos de controle.';
}

// ---------------------------------------------------------------------------
// Seção 11 – Indicadores e leitura combinada
// ---------------------------------------------------------------------------

const TERMINATION_DECISIONS = ['Suspender', 'Encerrar', 'Substituir', 'Cancelar'];

function percent(value: number | undefined): string {
  return value === undefined ? '–' : `${Math.round(value).toLocaleString('pt-BR')}%`;
}

export function computeIndicators(
  items: IEvaluatedInitiative[],
  input: IPortfolioInput,
  selection: ISelectionResult,
  activeBalance: IBalanceReport,
  params: IMethodologyParameters,
  today: Date
): IIndicator[] {
  const t = params.indicators;
  const active = items.filter((e) => e.stage === 'active');
  const portfolio = items.filter((e) => e.stage === 'active' || e.stage === 'candidate');
  const ratio = (part: number, total: number): number | undefined => (total > 0 ? (part / total) * 100 : undefined);

  // 1. Alinhamento estratégico
  const aligned = portfolio.filter((e) => params.objectives.some((o) => o.name === e.item.objective)).length;
  const alignment = ratio(aligned, portfolio.length);

  // 2. Prioritárias em execução (quartil superior de IPP)
  const quartile = items.filter((e) => e.topQuartile);
  const topInExecution = ratio(quartile.filter((e) => e.stage === 'active').length, quartile.length);

  // 3. Capacidade comprometida (portfólio ativo ÷ capacidade disponível)
  const capacity = ratio(selection.committedByActive, selection.capacity.available);

  // 4. Benefícios realizados
  const measured = items.filter((e) => e.item.benefitRealized !== undefined);
  const benefits = measured.length > 0 ? sum(measured.map((e) => Math.min(100, Math.max(0, e.item.benefitRealized as number)))) / measured.length : undefined;

  // 5. Investimento por objetivo estratégico
  const orphans = activeBalance.orphanObjectives;
  const distribution = activeBalance.objectives
    .filter((o) => o.share > 0)
    .sort((a, b) => b.share - a.share)
    .map((o) => `${o.objective} ${percent(o.share)}`)
    .join(' · ');

  // 6. Iniciativas atrasadas
  const delayed = active.filter((e) => (e.scheduleDeviation ?? 0) > params.monitoring.delayedThresholdPercent).length;
  const delayedShare = ratio(delayed, active.length);

  // 7. Suspensas ou encerradas antecipadamente no período (ciclo de revisão)
  const terminated = input.decisions.filter(
    (d) => TERMINATION_DECISIONS.indexOf(d.decision) >= 0 && daysBetween(d.date, today) <= params.monitoring.reviewCycleDays && daysBetween(d.date, today) >= 0
  ).length;
  const termination = ratio(terminated, active.length + terminated);

  // 8. Nível de risco (média ponderada pela demanda de capacidade)
  const risky = active.filter((e) => e.item.scores[params.riskCriterionField] !== undefined);
  const riskWeights = risky.map((e) => cycleDemand(e.item) ?? 0);
  const useWeights = sum(riskWeights) > 0;
  const riskLevel =
    risky.length > 0
      ? sum(risky.map((e, i) => (e.item.scores[params.riskCriterionField] as number) * (useWeights ? riskWeights[i] : 1))) /
        (useWeights ? sum(riskWeights) : risky.length)
      : undefined;

  const status = (ok: boolean | undefined, warn?: boolean): IndicatorStatus => (ok === undefined ? 'na' : ok ? 'ok' : warn ? 'warn' : 'bad');
  const capacityStatus = rangeStatus(capacity, t.capacityCommitment.min, t.capacityCommitment.max);
  const terminationStatus = rangeStatus(termination, t.earlyTermination.min, t.earlyTermination.max);

  return [
    {
      id: 1,
      name: 'Alinhamento estratégico do portfólio',
      formula: 'Iniciativas com vínculo estratégico declarado ÷ total × 100',
      value: alignment,
      display: percent(alignment),
      target: `${t.alignmentTarget}%`,
      frequency: 'Trimestral',
      status: status(alignment === undefined ? undefined : alignment >= t.alignmentTarget, true),
      detail: `${aligned} de ${portfolio.length} iniciativas (ativas e candidatas)`
    },
    {
      id: 2,
      name: 'Prioritárias em execução',
      formula: 'Iniciativas do quartil superior de IPP em execução ÷ total do quartil × 100',
      value: topInExecution,
      display: percent(topInExecution),
      target: `≥ ${t.topQuartileInExecutionTarget}%`,
      frequency: 'Mensal',
      status: status(topInExecution === undefined ? undefined : topInExecution >= t.topQuartileInExecutionTarget, (topInExecution ?? 0) >= t.topQuartileInExecutionTarget - 20),
      detail: `${quartile.filter((e) => e.stage === 'active').length} de ${quartile.length} no quartil superior`
    },
    {
      id: 3,
      name: 'Capacidade comprometida',
      formula: 'Capacidade alocada ÷ capacidade disponível × 100',
      value: capacity,
      display: percent(capacity),
      target: `${t.capacityCommitment.min}% – ${t.capacityCommitment.max}%`,
      frequency: 'Mensal',
      status: capacityStatus === 'na' ? 'na' : capacityStatus === 'ok' ? 'ok' : (capacity as number) > 100 ? 'bad' : 'warn',
      detail: `${Math.round(selection.committedByActive).toLocaleString('pt-BR')} h de ${Math.round(selection.capacity.available).toLocaleString('pt-BR')} h disponíveis no ciclo ${selection.cycle}`
    },
    {
      id: 4,
      name: 'Benefícios realizados',
      formula: 'Benefícios efetivamente medidos ÷ benefícios previstos × 100',
      value: benefits,
      display: percent(benefits),
      target: `≥ ${t.benefitsRealizedTarget}%`,
      frequency: 'Semestral',
      status: status(benefits === undefined ? undefined : benefits >= t.benefitsRealizedTarget, (benefits ?? 0) >= t.benefitsRealizedTarget - 20),
      detail: measured.length > 0 ? `Média de ${measured.length} iniciativas com benefício medido` : 'Nenhum benefício medido até o momento'
    },
    {
      id: 5,
      name: 'Investimento por objetivo estratégico',
      formula: 'Recursos alocados por OE ÷ total × 100',
      value: activeBalance.totalWeight > 0 ? orphans.length : undefined,
      display: activeBalance.totalWeight > 0 ? (orphans.length === 0 ? 'Todos os OE' : `${orphans.length} OE sem investimento`) : '–',
      target: 'Nenhum OE prioritário com 0%',
      frequency: 'Trimestral',
      status: activeBalance.totalWeight > 0 ? status(orphans.length === 0) : 'na',
      detail: orphans.length > 0 ? `Sem investimento: ${orphans.join(', ')}` : distribution || 'Sem iniciativas ativas'
    },
    {
      id: 6,
      name: 'Iniciativas atrasadas',
      formula: `Iniciativas com desvio de prazo > ${params.monitoring.delayedThresholdPercent}% ÷ total ativo × 100`,
      value: delayedShare,
      display: percent(delayedShare),
      target: `≤ ${t.delayedMax}%`,
      frequency: 'Mensal',
      status: status(delayedShare === undefined ? undefined : delayedShare <= t.delayedMax),
      detail: `${delayed} de ${active.length} iniciativas ativas`
    },
    {
      id: 7,
      name: 'Iniciativas suspensas ou encerradas antecipadamente',
      formula: 'Nº no período ÷ total ativo × 100',
      value: termination,
      display: percent(termination),
      target: `${t.earlyTermination.min}% – ${t.earlyTermination.max}%`,
      frequency: 'Trimestral',
      status: terminationStatus === 'na' ? 'na' : terminationStatus === 'ok' ? 'ok' : 'warn',
      detail: `${terminated} decisões de suspensão/encerramento nos últimos ${params.monitoring.reviewCycleDays} dias`
    },
    {
      id: 8,
      name: 'Nível de risco do portfólio',
      formula: 'Média ponderada do risco das iniciativas ativas (escala 1–5)',
      value: riskLevel,
      display: riskLevel === undefined ? '–' : formatNumber(riskLevel, 1),
      target: `≤ ${formatNumber(t.riskMax, 1)}`,
      frequency: 'Mensal',
      status: status(riskLevel === undefined ? undefined : riskLevel <= t.riskMax),
      detail: `${risky.length} iniciativas ativas com nota de risco`
    }
  ];
}

/** Leitura combinada dos indicadores (seção 11.1). */
export function combinedReadings(indicators: IIndicator[], balance: IBalanceReport, params: IMethodologyParameters): string[] {
  const t = params.indicators;
  const value = (id: number): number | undefined => indicators.find((i) => i.id === id)?.value;
  const readings: string[] = [];
  const capacity = value(3);
  const delayed = value(6);
  if (capacity !== undefined && capacity > 100 && delayed !== undefined && delayed > t.delayedMax) {
    readings.push('Capacidade acima de 100% com muitos atrasos: portfólio superdimensionado; é preciso suspender, não cobrar mais.');
  }
  const alignment = value(1);
  const benefits = value(4);
  if (alignment !== undefined && alignment >= t.alignmentTarget && benefits !== undefined && benefits < t.benefitsRealizedTarget) {
    readings.push('Alinhamento de 100% com benefícios baixos: vínculo estratégico declarado, mas formal; benefícios mal definidos.');
  }
  if (value(7) === 0) {
    readings.push('Nenhum encerramento no período: ausência de disciplina de descontinuidade; iniciativas que não agregam valor permanecem no portfólio.');
  }
  const top = balance.objectives.slice().sort((a, b) => b.share - a.share)[0];
  if (top && balance.totalWeight > 0 && top.share > t.concentrationSharePercent) {
    readings.push(`Investimento concentrado em "${top.objective}" (${percent(top.share)}): desequilíbrio estratégico ou captura por área influente.`);
  }
  const risk = value(8);
  const innovation = balance.dimensions.find((d) => d.key === 'innovation')?.bands.find((b) => b.label.toLocaleLowerCase('pt-BR').indexOf('inova') === 0);
  if (risk !== undefined && risk <= t.lowRiskLevel && innovation && innovation.share < t.innovationMinSharePercent) {
    readings.push('Risco baixo com poucas iniciativas de inovação: portfólio conservador demais para sustentar a estratégia de longo prazo.');
  }
  return readings;
}

// ---------------------------------------------------------------------------
// Campos gravados pelo modelo na lista (sincronização)
// ---------------------------------------------------------------------------

export interface IModelFieldValues {
  code?: string;
  rank?: number;
  ippBand: string;
  trafficLight: string;
  alerts: string;
  suggestion: string;
  authority: string;
  /** Transição automática de situação (Elegível com notas → Priorizada; Autorizada com progresso → Em andamento). */
  status?: string;
}

/** Gatilhos de permanência já cobertos por um motivo do semáforo (evita alertas repetidos). */
const COVERED_BY_LIGHT: Record<string, string> = {
  cost: 'Desvio de custo',
  progress: 'Sem entregas',
  benefit: 'Benefício comprometido'
};

/** Alertas de monitoramento: motivos do semáforo + critérios de permanência não cobertos por eles. */
export function monitoringAlerts(e: IEvaluatedInitiative): string[] {
  const reasons = e.light ? e.light.reasons.slice() : [];
  e.triggers.forEach((t) => {
    const covered = COVERED_BY_LIGHT[t.key];
    const alreadyShown = covered !== undefined && reasons.some((r) => r.indexOf(covered) === 0);
    if (!alreadyShown && reasons.indexOf(t.label) < 0) {
      reasons.push(t.label);
    }
  });
  return reasons;
}

export function modelFieldValues(e: IEvaluatedInitiative): IModelFieldValues {
  const alerts: string[] = [];
  if (e.stage === 'intake' || e.stage === 'candidate') {
    e.entry.filter((c) => !c.met).forEach((c) => alerts.push(`Critério de entrada pendente: ${c.label}`));
    if (e.gate.passes !== true) {
      alerts.push(e.gate.label);
    }
    if (e.duplicates.length > 0) {
      alerts.push(`Possível duplicidade com #${e.duplicates.join(', #')}`);
    }
    if (e.consolidation && e.consolidation.divergences.length > 0) {
      alerts.push(
        `Divergência de notas: ${e.consolidation.divergences.map((d) => `${d.label} (${d.min}–${d.max})`).join('; ')}`
      );
    }
  }
  monitoringAlerts(e).forEach((r) => {
    if (alerts.indexOf(r) < 0) {
      alerts.push(r);
    }
  });

  let status: string | undefined;
  if (e.item.status === STATUS.eligible && e.ipp !== undefined) {
    status = STATUS.prioritized;
  } else if (e.item.status === STATUS.authorized && (e.item.progress ?? 0) > 0) {
    status = STATUS.inProgress;
  }

  return {
    code: e.generatedCode,
    rank: e.rank,
    ippBand: e.band ? `${e.band.label} – ${e.band.recommendation}` : '',
    trafficLight: e.light?.color ?? '',
    alerts: alerts.join('\n'),
    suggestion: e.suggestion ? (e.suggestionReason ? `${e.suggestion}: ${e.suggestionReason}` : e.suggestion) : '',
    authority: e.stage === 'closed' ? '' : `${e.authority.label} – ${e.authority.decider}`,
    status
  };
}

/** true se algum campo do modelo mudou em relação ao gravado na lista. */
export function modelFieldsChanged(e: IEvaluatedInitiative, values: IModelFieldValues): boolean {
  const s = e.item.stored;
  return (
    !!values.code ||
    !!values.status ||
    s.rank !== values.rank ||
    s.ippBand !== values.ippBand ||
    s.trafficLight !== values.trafficLight ||
    s.alerts !== values.alerts ||
    s.suggestion !== values.suggestion ||
    s.authority !== values.authority
  );
}
