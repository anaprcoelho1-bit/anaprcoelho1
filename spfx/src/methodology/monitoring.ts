import { ACTIVE_STATUSES, IInitiative, isOneOf, STATUS } from './model';
import { IMethodologyParameters } from './parameters';

const DAY = 24 * 60 * 60 * 1000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// ---------------------------------------------------------------------------
// Desvios de prazo e custo
// ---------------------------------------------------------------------------

/** Desvio de prazo (%): atraso projetado do término ÷ duração da linha de base. */
export function scheduleDeviation(item: IInitiative): number | undefined {
  if (!item.plannedStart || !item.baselineEnd || !item.projectedEnd) {
    return undefined;
  }
  const baseline = item.baselineEnd.getTime() - item.plannedStart.getTime();
  if (baseline <= 0) {
    return undefined;
  }
  return ((item.projectedEnd.getTime() - item.baselineEnd.getTime()) / baseline) * 100;
}

/** Desvio de custo (%): custo projetado em relação ao custo aprovado (linha de base). */
export function costDeviation(item: IInitiative): number | undefined {
  if (!item.approvedCost || item.projectedCost === undefined) {
    return undefined;
  }
  return ((item.projectedCost - item.approvedCost) / item.approvedCost) * 100;
}

/** Dias sem entrega ou marco (desde a última entrega, a autorização ou o início previsto). */
export function daysWithoutProgress(item: IInitiative, today: Date): number | undefined {
  const reference = item.lastDeliveryOn ?? item.authorizedOn ?? item.plannedStart;
  if (!reference || (item.plannedStart && item.plannedStart > today)) {
    return undefined;
  }
  return daysBetween(reference, today);
}

export function isStalled(item: IInitiative, today: Date, params: IMethodologyParameters): boolean {
  const days = daysWithoutProgress(item, today);
  return days !== undefined && days >= params.monitoring.stalledCycles * params.monitoring.cycleDays;
}

// ---------------------------------------------------------------------------
// Seção 9.1 – Semáforo
// ---------------------------------------------------------------------------

export type TrafficLight = 'Verde' | 'Amarelo' | 'Vermelho';

export interface ITrafficLightResult {
  color: TrafficLight;
  reasons: string[];
}

export function trafficLight(item: IInitiative, today: Date, params: IMethodologyParameters): ITrafficLightResult {
  const m = params.monitoring;
  const red: string[] = [];
  const yellow: string[] = [];
  const deviations: [string, number | undefined][] = [
    ['prazo', scheduleDeviation(item)],
    ['custo', costDeviation(item)]
  ];
  deviations.forEach(([label, value]) => {
    if (value === undefined) {
      return;
    }
    if (value > m.redDeviationPercent) {
      red.push(`Desvio de ${label} de ${Math.round(value)}% (acima de ${m.redDeviationPercent}%)`);
    } else if (value >= m.yellowDeviationPercent) {
      yellow.push(`Desvio de ${label} de ${Math.round(value)}%`);
    }
  });
  if (item.benefitCompromised) {
    red.push('Benefício comprometido');
  }
  if (item.criticalDependencyBlocked) {
    red.push('Dependência crítica bloqueada');
  }
  if (isStalled(item, today, params)) {
    red.push(`Sem entregas há ${m.stalledCycles} ciclos ou mais`);
  }
  const risk = item.scores[params.riskCriterionField];
  if (risk !== undefined && risk >= m.highRiskScore && !item.riskResponseDefined) {
    yellow.push('Risco alto sem resposta definida');
  }
  if (red.length > 0) {
    return { color: 'Vermelho', reasons: red.concat(yellow) };
  }
  if (yellow.length > 0) {
    return { color: 'Amarelo', reasons: yellow };
  }
  return { color: 'Verde', reasons: [] };
}

export const TRAFFIC_LIGHT_ACTION: Record<TrafficLight, string> = {
  Verde: 'Seguir',
  Amarelo: 'Plano de ação na próxima reunião mensal',
  Vermelho: 'Levar ao Comitê para decisão de continuidade'
};

// ---------------------------------------------------------------------------
// Seção 3.3 – Critérios de permanência e sugestão da revisão (seção 10.2)
// ---------------------------------------------------------------------------

export interface IPermanenceTrigger {
  key: string;
  label: string;
  /** Decisão da matriz de revisão sugerida para o gatilho. */
  suggestion: string;
}

export function permanenceTriggers(item: IInitiative, today: Date, params: IMethodologyParameters): IPermanenceTrigger[] {
  const triggers: IPermanenceTrigger[] = [];
  const m = params.monitoring;
  if (item.objective) {
    const objective = params.objectives.find((o) => o.name === item.objective);
    if (!objective || !objective.active) {
      triggers.push({ key: 'objective', label: 'Objetivo estratégico alterado ou extinto', suggestion: 'Encerrar' });
    }
  }
  if (item.benefitCompromised) {
    triggers.push({ key: 'benefit', label: 'Premissas de valor não se confirmaram (benefício comprometido)', suggestion: 'Encerrar' });
  }
  const cost = costDeviation(item);
  if (cost !== undefined && cost > m.costGrowthLimitPercent) {
    triggers.push({
      key: 'cost',
      label: `Custo cresceu ${Math.round(cost)}%, além da faixa acordada (+${m.costGrowthLimitPercent}%)`,
      suggestion: 'Replanejar'
    });
  }
  const risk = item.scores[params.riskCriterionField];
  if (risk !== undefined && risk >= m.criticalRiskScore && !item.riskResponseDefined) {
    triggers.push({ key: 'risk', label: 'Risco crítico sem resposta viável', suggestion: 'Replanejar' });
  }
  if (
    item.status === STATUS.authorized &&
    !item.capacityAllocated &&
    item.authorizedOn &&
    daysBetween(item.authorizedOn, today) > m.reviewCycleDays
  ) {
    triggers.push({ key: 'capacity', label: 'Aprovada sem equipe alocada há mais de um ciclo', suggestion: 'Suspender' });
  }
  if (isOneOf(item.status, ACTIVE_STATUSES) && isStalled(item, today, params)) {
    triggers.push({ key: 'progress', label: `Sem entregas ou marcos por ${m.stalledCycles} ciclos consecutivos`, suggestion: 'Suspender' });
  }
  return triggers;
}

/** Decisão sugerida para a reunião de revisão (matriz 10.2), para iniciativas do portfólio ativo. */
export function suggestReviewDecision(
  item: IInitiative,
  triggers: IPermanenceTrigger[],
  ipp: number | undefined,
  light: TrafficLight,
  params: IMethodologyParameters
): { decision: string; reason: string } {
  if (triggers.length > 0) {
    return { decision: triggers[0].suggestion, reason: triggers[0].label };
  }
  if (ipp !== undefined && ipp < params.selection.minimumIpp) {
    return { decision: 'Encerrar', reason: 'IPP tornou-se desfavorável' };
  }
  const delay = scheduleDeviation(item);
  if (item.legalDeadline && delay !== undefined && delay > 0 && item.projectedEnd && item.projectedEnd > item.legalDeadline) {
    return { decision: 'Acelerar', reason: 'Término projetado após o prazo legal' };
  }
  if (light === 'Vermelho') {
    return { decision: 'Replanejar', reason: 'Semáforo vermelho: decidir a continuidade no Comitê' };
  }
  return { decision: 'Manter', reason: light === 'Amarelo' ? 'Manter com plano de ação' : 'Prioridade, benefício e execução confirmados' };
}
