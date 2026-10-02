/** Item genérico das listas editáveis (cards, etapas, critérios, ferramentas). */
export interface ISectionItem {
  uniqueId?: string;
  title: string;
  description?: string;
  icon?: string;
  url?: string;
  accent?: AccentName;
}

export type AccentName = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'yellow' | 'red' | 'navy';
