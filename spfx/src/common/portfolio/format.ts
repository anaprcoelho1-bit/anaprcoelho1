import { IIndicator, IndicatorStatus, RangeStatus } from '../../methodology';

export function fmtNumber(value: number | undefined, digits: number = 0): string {
  return value === undefined || isNaN(value)
    ? '–'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtIpp = (value: number | undefined): string => fmtNumber(value, 2);
export const fmtIndex = (value: number | undefined): string => fmtNumber(value, 1);
export const fmtPercent = (value: number | undefined): string => (value === undefined ? '–' : `${fmtNumber(value)}%`);
export const fmtHours = (value: number | undefined): string => (value === undefined ? '–' : `${fmtNumber(value)} h`);

export function fmtCurrency(value: number | undefined): string {
  return value === undefined ? '–' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function fmtDate(value: Date | undefined): string {
  return value ? value.toLocaleDateString('pt-BR') : '–';
}

export const STATUS_COLORS: Record<IndicatorStatus | RangeStatus, string> = {
  ok: '#1e6e4a',
  warn: '#8a6100',
  bad: '#b3261e',
  na: '#6b7785',
  below: '#8a6100',
  above: '#b3261e'
};

export const INDICATOR_STATUS_LABEL: Record<IndicatorStatus, string> = {
  ok: 'Na meta',
  warn: 'Atenção',
  bad: 'Fora da meta',
  na: 'Sem dados'
};

export const RANGE_STATUS_LABEL: Record<RangeStatus, string> = {
  ok: 'Dentro da faixa',
  below: 'Abaixo da faixa',
  above: 'Acima da faixa',
  na: 'Sem dados'
};

export const LIGHT_COLORS: Record<string, string> = {
  Verde: '#2e9e5b',
  Amarelo: '#e3b505',
  Vermelho: '#d64541'
};

export const SUGGESTION_COLORS: Record<string, string> = {
  Selecionar: '#1e6e4a',
  Autorizar: '#1e6e4a',
  Elegível: '#1e6e4a',
  Manter: '#1e6e4a',
  'Manter em fila': '#8a6100',
  'Iniciar análise': '#1f6fc5',
  'Devolver para detalhamento': '#8a6100',
  'Verificar duplicidade': '#8a6100',
  Acelerar: '#1f6fc5',
  Replanejar: '#8a6100',
  Suspender: '#b3261e',
  Descartar: '#b3261e',
  Recusar: '#b3261e',
  Encerrar: '#b3261e'
};

export function indicatorTitle(indicator: IIndicator): string {
  return `${indicator.name}: ${indicator.display} (meta ${indicator.target}). ${indicator.detail}`;
}
