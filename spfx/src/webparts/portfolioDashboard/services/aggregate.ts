import { IInitiativeRow } from './InitiativeService';

export interface IStatusConfig {
  uniqueId?: string;
  /** Valor exatamente como aparece na coluna de situação da lista. */
  value: string;
  /** Rótulo exibido no indicador (ex.: plural). */
  label: string;
  color: string;
}

export interface IStatusCount extends IStatusConfig {
  count: number;
}

export interface ICategoryCount {
  label: string;
  count: number;
}

const normalize = (text: string): string => text.trim().toLocaleLowerCase('pt-BR');

export function countByStatus(rows: IInitiativeRow[], statuses: IStatusConfig[]): IStatusCount[] {
  return statuses.map((status) => ({
    ...status,
    count: rows.filter((row) => normalize(row.status) === normalize(status.value)).length
  }));
}

export function countByObjective(rows: IInitiativeRow[]): ICategoryCount[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (row.objective) {
      counts.set(row.objective, (counts.get(row.objective) ?? 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

/** Escala "redonda" para o eixo do gráfico de barras: retorna o máximo e o passo das marcações. */
export function niceScale(maxValue: number, maxTicks: number = 5): { max: number; step: number } {
  if (maxValue <= 0) {
    return { max: 5, step: 1 };
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const steps = [1, 2, 5, 10].map((factor) => factor * magnitude).concat([20 * magnitude]);
  const step = steps.find((candidate) => Math.ceil(maxValue / candidate) <= maxTicks) ?? steps[steps.length - 1];
  return { max: Math.ceil(maxValue / step) * step, step };
}
