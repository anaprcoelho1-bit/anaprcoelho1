import { IInitiative } from './model';
import { IBalanceBand, IMethodologyParameters } from './parameters';
import { cycleDemand, normalize, sum } from './selection';

// ---------------------------------------------------------------------------
// Seção 6 – Balanceamento do portfólio
// ---------------------------------------------------------------------------

export type RangeStatus = 'ok' | 'below' | 'above' | 'na';

export interface IBandShare {
  label: string;
  share: number;
  weight: number;
  count: number;
  target?: number;
  min?: number;
  max?: number;
  status: RangeStatus;
}

export interface IDimensionBalance {
  key: string;
  label: string;
  risk: string;
  bands: IBandShare[];
  /** Participação sem classificação na dimensão (coluna vazia ou valor fora das faixas). */
  unclassifiedShare: number;
  balanced: boolean;
}

export interface IObjectiveShare {
  objective: string;
  priority: boolean;
  share: number;
  weight: number;
  count: number;
}

export interface IBalanceReport {
  /** "effort": participação pelas horas do ciclo; "count": pelo número de iniciativas (sem estimativas). */
  basis: 'effort' | 'count';
  totalWeight: number;
  dimensions: IDimensionBalance[];
  objectives: IObjectiveShare[];
  /** Objetivos prioritários sem nenhum investimento (órfãos). */
  orphanObjectives: string[];
  areas: { area: string; share: number; count: number }[];
}

export function rangeStatus(value: number | undefined, min?: number, max?: number): RangeStatus {
  if (value === undefined || isNaN(value)) {
    return 'na';
  }
  if (min !== undefined && value < min - 1e-9) {
    return 'below';
  }
  if (max !== undefined && value > max + 1e-9) {
    return 'above';
  }
  return 'ok';
}

/** Valor da iniciativa para a coluna da dimensão (categorias ou nota). */
function dimensionValue(item: IInitiative, field: string): string | number | undefined {
  if (item.scores[field] !== undefined) {
    return item.scores[field];
  }
  const map: Record<string, string> = {
    Horizonte: item.horizon,
    Motivacao: item.motivation,
    Natureza: item.nature,
    Porte: item.size,
    ObjetivoEstrategico: item.objective,
    UnidadeDemandante: item.unit,
    Equipe: item.team
  };
  return map[field];
}

function bandMatches(band: IBalanceBand, value: string | number | undefined): boolean {
  if (value === undefined || value === '') {
    return false;
  }
  if (typeof value === 'number') {
    return band.scoreMin !== undefined && band.scoreMax !== undefined && value >= band.scoreMin && value <= band.scoreMax;
  }
  return (band.values ?? []).some((candidate) => normalize(candidate) === normalize(value));
}

/**
 * Participação de cada faixa de equilíbrio no portfólio informado (normalmente o ativo + o selecionado).
 * O peso é a demanda de capacidade no ciclo; se nenhuma iniciativa tiver estimativa, usa a contagem.
 */
export function balancePortfolio(portfolio: IInitiative[], params: IMethodologyParameters): IBalanceReport {
  const hasEffort = portfolio.some((item) => (cycleDemand(item) ?? 0) > 0);
  const basis: 'effort' | 'count' = hasEffort ? 'effort' : 'count';
  const weightOf = (item: IInitiative): number => (basis === 'effort' ? cycleDemand(item) ?? 0 : 1);
  const totalWeight = sum(portfolio.map(weightOf));
  const share = (weight: number): number => (totalWeight > 0 ? (weight / totalWeight) * 100 : 0);

  const dimensions = params.balance.map((dimension) => {
    let classified = 0;
    const bands = dimension.bands.map((band) => {
      const members = portfolio.filter((item) => bandMatches(band, dimensionValue(item, dimension.field)));
      const weight = sum(members.map(weightOf));
      classified += weight;
      const value = totalWeight > 0 ? share(weight) : undefined;
      return {
        label: band.label,
        share: value ?? 0,
        weight,
        count: members.length,
        target: band.target,
        min: band.min,
        max: band.max,
        status: rangeStatus(value, band.min, band.max)
      };
    });
    return {
      key: dimension.key,
      label: dimension.label,
      risk: dimension.risk,
      bands,
      unclassifiedShare: totalWeight > 0 ? Math.max(0, share(totalWeight - classified)) : 0,
      balanced: bands.every((band) => band.status === 'ok' || band.status === 'na')
    };
  });

  const objectives = params.objectives
    .filter((o) => o.active)
    .map((o) => {
      const members = portfolio.filter((item) => item.objective === o.name);
      const weight = sum(members.map(weightOf));
      return { objective: o.name, priority: o.priority, share: share(weight), weight, count: members.length };
    });
  const orphanObjectives = totalWeight > 0 ? objectives.filter((o) => o.priority && o.weight === 0).map((o) => o.objective) : [];

  const areaWeights = new Map<string, { weight: number; count: number }>();
  portfolio.forEach((item) => {
    const area = item.unit || 'Não informada';
    const current = areaWeights.get(area) ?? { weight: 0, count: 0 };
    areaWeights.set(area, { weight: current.weight + weightOf(item), count: current.count + 1 });
  });
  const areas = Array.from(areaWeights.entries())
    .map(([area, value]) => ({ area, share: share(value.weight), count: value.count }))
    .sort((a, b) => b.share - a.share);

  return { basis, totalWeight, dimensions, objectives, orphanObjectives, areas };
}
