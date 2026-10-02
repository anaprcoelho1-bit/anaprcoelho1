import { FEASIBILITY, IInitiative, IScoreSheet, MANDATORY_MOTIVATION } from './model';
import { IAuthorityLevel, ICriterion, IIppBand, IMethodologyParameters } from './parameters';

// ---------------------------------------------------------------------------
// Seção 5.3 a 5.5 – Valor Ponderado, Custo-Risco Ponderado e IPP
// ---------------------------------------------------------------------------

export function isValidScore(value: number | undefined, params: IMethodologyParameters): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= params.scale.min && value <= params.scale.max;
}

/**
 * Índice ponderado de 0 a 100: (Σ nota × peso ÷ (nota máxima × Σ pesos)) × 100.
 * Com os pesos da metodologia, equivale a ÷120 (valor) e ÷60 (custo-risco).
 * Retorna undefined se alguma nota estiver ausente ou fora da escala.
 */
export function weightedIndex(
  criteria: ICriterion[],
  scores: Record<string, number | undefined>,
  params: IMethodologyParameters
): number | undefined {
  let sum = 0;
  let weights = 0;
  for (const c of criteria) {
    const score = scores[c.field];
    if (!isValidScore(score, params)) {
      return undefined;
    }
    sum += score * c.weight;
    weights += c.weight;
  }
  return weights > 0 ? (sum / (params.scale.max * weights)) * 100 : undefined;
}

export interface IScoreResult {
  vp?: number;
  cr?: number;
  ipp?: number;
  band?: IIppBand;
  /** Critérios ainda sem nota válida. */
  missing: string[];
}

export function scoreInitiative(scores: Record<string, number | undefined>, params: IMethodologyParameters): IScoreResult {
  const vp = weightedIndex(params.valueCriteria, scores, params);
  const cr = weightedIndex(params.costRiskCriteria, scores, params);
  const ipp = vp !== undefined && cr !== undefined && cr > 0 ? vp / cr : undefined;
  const missing = params.valueCriteria
    .concat(params.costRiskCriteria)
    .filter((c) => !isValidScore(scores[c.field], params))
    .map((c) => c.label);
  return { vp, cr, ipp, band: ipp === undefined ? undefined : ippBand(ipp, params), missing };
}

export function ippBand(ipp: number, params: IMethodologyParameters): IIppBand {
  const bands = params.ippBands.slice().sort((a, b) => b.min - a.min);
  return bands.find((band) => ipp >= band.min) ?? bands[bands.length - 1];
}

/** IPP arredondado como exibido (duas casas), evitando que 1,4999 apareça como 1,50 mas caia na faixa inferior. */
export function roundIpp(ipp: number): number {
  return Math.round(ipp * 100) / 100;
}

// ---------------------------------------------------------------------------
// Seção 5.2 – Pontos de controle (gates)
// ---------------------------------------------------------------------------

export type GateOutcome = 'pass' | 'mandatory' | 'unfeasible' | 'unaligned' | 'pending';

export interface IGateResult {
  outcome: GateOutcome;
  /** true = entra, false = não entra, undefined = depende de avaliação pendente. */
  passes?: boolean;
  label: string;
}

export function isMandatory(item: IInitiative): boolean {
  return item.legalObligation || item.motivation === MANDATORY_MOTIVATION;
}

export function evaluateGates(item: IInitiative, params: IMethodologyParameters): IGateResult {
  if (item.feasibility === FEASIBILITY.unfeasible) {
    return { outcome: 'unfeasible', passes: false, label: 'Não entra: inviável (legal, técnica ou operacionalmente)' };
  }
  const mandatory = isMandatory(item);
  const aligned = hasObjective(item, params);
  if (!mandatory && !aligned) {
    return { outcome: 'unaligned', passes: false, label: 'Não entra: sem vínculo com objetivo estratégico e não obrigatória' };
  }
  if (item.feasibility !== FEASIBILITY.feasible) {
    return { outcome: 'pending', label: 'Pendente: viabilidade não avaliada' };
  }
  return mandatory
    ? { outcome: 'mandatory', passes: true, label: 'Entra: obrigação legal/regulatória (capacidade reservada)' }
    : { outcome: 'pass', passes: true, label: 'Passa nos pontos de controle' };
}

export function hasObjective(item: IInitiative, params: IMethodologyParameters): boolean {
  return !!item.objective && params.objectives.some((o) => o.name === item.objective);
}

// ---------------------------------------------------------------------------
// Seção 3.3 – Critérios de entrada (necessários e cumulativos)
// ---------------------------------------------------------------------------

export interface IEntryCheck {
  key: string;
  label: string;
  met: boolean;
}

export function entryCriteria(item: IInitiative, params: IMethodologyParameters): IEntryCheck[] {
  const effort = item.effortHours;
  const belowThreshold = effort !== undefined && effort < params.entry.minimumEffortHours;
  return [
    { key: 'owner', label: 'Responsável de negócio identificado', met: !!item.businessOwner },
    {
      key: 'objective',
      label: 'Vínculo com objetivo estratégico (ou obrigação legal/regulatória)',
      met: hasObjective(item, params) || isMandatory(item)
    },
    { key: 'benefit', label: 'Problema/oportunidade e benefício esperado descritos', met: !!item.problem && !!item.expectedBenefit },
    { key: 'estimate', label: 'Estimativa preliminar de esforço/custo', met: effort !== undefined || item.cost !== undefined },
    { key: 'feasible', label: 'Viável técnica, legal e operacionalmente', met: item.feasibility === FEASIBILITY.feasible },
    {
      key: 'size',
      label: `Acima do limiar mínimo de porte (${params.entry.minimumEffortHours} h)`,
      met: effort !== undefined && !belowThreshold
    }
  ];
}

// ---------------------------------------------------------------------------
// Seção 8.2 – Alçadas
// ---------------------------------------------------------------------------

export function authorityLevel(item: IInitiative, params: IMethodologyParameters): IAuthorityLevel {
  const levels = params.authority.levels;
  const transversal = (item.scores[params.authority.transversalImpactField] ?? 0) >= params.authority.transversalImpactMin;
  const newBudget = (item.scores[params.authority.newBudgetField] ?? 0) >= params.authority.newBudgetMin;
  const minimumLevel = newBudget ? levels.length - 1 : transversal ? Math.min(1, levels.length - 1) : 0;

  for (let index = minimumLevel; index < levels.length; index++) {
    const level = levels[index];
    const effortOk = level.maxEffortHours === undefined || (item.effortHours ?? 0) <= level.maxEffortHours;
    const costOk = level.maxCost === undefined || (item.cost ?? 0) <= level.maxCost;
    if (effortOk && costOk) {
      return level;
    }
  }
  return levels[levels.length - 1];
}

// ---------------------------------------------------------------------------
// Etapa 2 – Verificação de duplicidade (nomes semelhantes)
// ---------------------------------------------------------------------------

const STOP_WORDS = ['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'um', 'uma', 'ao', 'aos'];

export function titleTokens(title: string): string[] {
  const normalized = title
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  const tokens: string[] = [];
  normalized.split(' ').forEach((token) => {
    if (token.length > 1 && STOP_WORDS.indexOf(token) < 0 && tokens.indexOf(token) < 0) {
      tokens.push(token);
    }
  });
  return tokens;
}

export function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const shared = a.filter((token) => b.indexOf(token) >= 0).length;
  return shared / (a.length + b.length - shared);
}

/** Pares de iniciativas com nomes semelhantes (Jaccard ≥ limiar, padrão 0,7), por id. */
export function findPossibleDuplicates(items: IInitiative[], threshold: number = 0.7): Map<number, number[]> {
  const result = new Map<number, number[]>();
  const tokens = items.map((item) => titleTokens(item.title));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (Math.min(tokens[i].length, tokens[j].length) >= 2 && similarity(tokens[i], tokens[j]) >= threshold) {
        result.set(items[i].id, (result.get(items[i].id) ?? []).concat(items[j].id));
        result.set(items[j].id, (result.get(items[j].id) ?? []).concat(items[i].id));
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Etapa 4 – Pontuação colegiada: divergências e consolidação
// ---------------------------------------------------------------------------

export interface IDivergence {
  field: string;
  label: string;
  min: number;
  max: number;
}

export interface IScoreConsolidation {
  evaluators: string[];
  /** Mediana por critério (arredondada para inteiro), apenas para critérios com ao menos uma nota. */
  medians: Record<string, number>;
  /** Critérios com diferença superior ao limite (padrão: 2 pontos) entre avaliadores. */
  divergences: IDivergence[];
  /** Todas as notas preenchidas por todos os avaliadores e sem divergência. */
  readyToConsolidate: boolean;
}

export function consolidateScores(sheets: IScoreSheet[], params: IMethodologyParameters): IScoreConsolidation {
  const criteria = params.valueCriteria.concat(params.costRiskCriteria);
  const medians: Record<string, number> = {};
  const divergences: IDivergence[] = [];
  let complete = sheets.length > 0;

  criteria.forEach((c) => {
    const values = sheets
      .map((sheet) => sheet.scores[c.field])
      .filter((value): value is number => isValidScore(value, params))
      .sort((a, b) => a - b);
    if (values.length < sheets.length) {
      complete = false;
    }
    if (values.length === 0) {
      return;
    }
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    medians[c.field] = Math.round(median);
    const min = values[0];
    const max = values[values.length - 1];
    if (max - min > params.divergenceThreshold) {
      divergences.push({ field: c.field, label: c.label, min, max });
    }
  });

  return {
    evaluators: sheets.map((sheet) => sheet.evaluator),
    medians,
    divergences,
    readyToConsolidate: complete && divergences.length === 0
  };
}
