import { AccentName } from './types';

/** Paleta de destaques usada nos cards e indicadores do layout. */
export const ACCENTS: Record<AccentName, { color: string; background: string }> = {
  blue: { color: '#1f6fc5', background: '#e8f1fb' },
  green: { color: '#1e6e4a', background: '#e5f4ec' },
  orange: { color: '#0b3b5c', background: '#fdf1e3' },
  purple: { color: '#3d3f8f', background: '#ececfa' },
  teal: { color: '#0e8a7e', background: '#e2f4f1' },
  yellow: { color: '#8a6100', background: '#fff5d6' },
  red: { color: '#b3261e', background: '#fde9ea' },
  navy: { color: '#0b3b5c', background: '#e6eff6' }
};

export const ACCENT_OPTIONS: { key: AccentName; text: string }[] = [
  { key: 'blue', text: 'Azul' },
  { key: 'green', text: 'Verde' },
  { key: 'orange', text: 'Laranja' },
  { key: 'purple', text: 'Lilás' },
  { key: 'teal', text: 'Verde-água' },
  { key: 'yellow', text: 'Amarelo' },
  { key: 'red', text: 'Vermelho' },
  { key: 'navy', text: 'Azul-marinho' }
];

export function accentOf(name: AccentName | undefined): { color: string; background: string } {
  return ACCENTS[name ?? 'blue'] ?? ACCENTS.blue;
}

/** Converte "#rrggbb" em rgba com a opacidade informada (fundo suave dos indicadores). */
export function tint(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) {
    return hex;
  }
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
