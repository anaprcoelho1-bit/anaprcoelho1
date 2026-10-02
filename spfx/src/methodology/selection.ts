import { ICapacityRow, IInitiative } from './model';
import { IMethodologyParameters } from './parameters';

// ---------------------------------------------------------------------------
// Ciclo e capacidade (Etapa 5 e seção 6.3)
// ---------------------------------------------------------------------------

/** Ciclo trimestral no formato "AAAA-Tn" (ex.: 2026-T4). */
export function cycleOf(date: Date): string {
  return `${date.getFullYear()}-T${Math.floor(date.getMonth() / 3) + 1}`;
}

export interface ICapacitySummary {
  team: string;
  total: number;
  sustainment: number;
  /** Capacidade total − sustentação/operação. */
  available: number;
  reserve: number;
  /** Capacidade alocável = total − sustentação − reserva. */
  allocable: number;
  wipLimit: number;
}

export function summarizeCapacity(rows: ICapacityRow[], cycle: string, params: IMethodologyParameters): {
  overall: ICapacitySummary;
  teams: ICapacitySummary[];
} {
  const teams: ICapacitySummary[] = [];
  rows
    .filter((row) => normalize(row.cycle) === normalize(cycle))
    .forEach((row) => {
      const available = Math.max(0, (row.total || 0) - (row.sustainment || 0));
      const reservePercent = row.reservePercent ?? params.selection.reservePercent;
      const reserve = (available * reservePercent) / 100;
      const summary: ICapacitySummary = {
        team: row.team,
        total: row.total || 0,
        sustainment: row.sustainment || 0,
        available,
        reserve,
        allocable: available - reserve,
        wipLimit: row.wipLimit ?? params.selection.wipLimitPerTeam
      };
      const existing = teams.find((team) => normalize(team.team) === normalize(row.team));
      if (existing) {
        existing.total += summary.total;
        existing.sustainment += summary.sustainment;
        existing.available += summary.available;
        existing.reserve += summary.reserve;
        existing.allocable += summary.allocable;
      } else {
        teams.push(summary);
      }
    });

  const overall: ICapacitySummary = {
    team: 'Total',
    total: sum(teams.map((t) => t.total)),
    sustainment: sum(teams.map((t) => t.sustainment)),
    available: sum(teams.map((t) => t.available)),
    reserve: sum(teams.map((t) => t.reserve)),
    allocable: sum(teams.map((t) => t.allocable)),
    wipLimit: 0
  };
  return { overall, teams };
}

/** Demanda de capacidade da iniciativa no ciclo (horas). */
export function cycleDemand(item: IInitiative): number | undefined {
  return item.cycleEffortHours ?? item.effortHours;
}

// ---------------------------------------------------------------------------
// Etapa 4 – Ordenação pelo IPP (com preferência pelo fluxo, seção 6.3)
// ---------------------------------------------------------------------------

export interface IRankable {
  item: IInitiative;
  ipp?: number;
}

/**
 * Ordena por IPP decrescente. Entre iniciativas de IPP semelhante (mesma faixa de tolerância,
 * padrão 0,10), a de menor duração vem primeiro: libera capacidade antes e antecipa benefícios.
 * Iniciativas sem IPP ficam fora do ranking.
 */
export function rankByIpp<T extends IRankable>(entries: T[], params: IMethodologyParameters): T[] {
  const tolerance = params.selection.similarIppTolerance > 0 ? params.selection.similarIppTolerance : 0.0001;
  return entries
    .filter((entry) => entry.ipp !== undefined)
    .sort((a, b) => {
      const bucketA = Math.floor((a.ipp as number) / tolerance + 1e-9);
      const bucketB = Math.floor((b.ipp as number) / tolerance + 1e-9);
      if (bucketA !== bucketB) {
        return bucketB - bucketA;
      }
      const durationA = a.item.durationMonths ?? Number.MAX_VALUE;
      const durationB = b.item.durationMonths ?? Number.MAX_VALUE;
      if (durationA !== durationB) {
        return durationA - durationB;
      }
      return (b.ipp as number) - (a.ipp as number) || a.item.id - b.item.id;
    });
}

// ---------------------------------------------------------------------------
// Etapa 5 – Seleção pela capacidade (Ponto de decisão 2)
// ---------------------------------------------------------------------------

export type SelectionSuggestion = 'select' | 'queue' | 'discard';

export interface ISelectionCandidate extends IRankable {
  /** Resultado dos pontos de controle: true entra, false não entra, undefined pendente. */
  gatePasses?: boolean;
  mandatory: boolean;
}

export interface ISelectionDecision {
  id: number;
  suggestion: SelectionSuggestion;
  reasons: string[];
  /** Ids selecionados em conjunto por dependência. */
  selectedWith: number[];
}

export interface ISelectionResult {
  cycle: string;
  capacity: ICapacitySummary;
  teams: ICapacitySummary[];
  /** Horas já comprometidas com o portfólio ativo. */
  committedByActive: number;
  /** Horas das iniciativas sugeridas para seleção. */
  selectedDemand: number;
  remaining: number;
  /** (Ativo + selecionado) ÷ capacidade disponível × 100. */
  commitmentPercent?: number;
  decisions: Map<number, ISelectionDecision>;
  order: number[];
  alerts: string[];
}

interface ITeamUsage {
  hours: number;
  count: number;
}

/**
 * Percorre a lista priorizada de cima para baixo alocando capacidade até o limite.
 * - O portfólio ativo consome capacidade primeiro.
 * - Obrigatórias (legal/regulatória) entram com capacidade reservada, mesmo além do limite (com alerta).
 * - Iniciativas que não passam nos pontos de controle ou com IPP abaixo do mínimo são sugeridas para descarte.
 * - Dependências: a iniciativa só é selecionada em conjunto com as dependências ainda não priorizadas
 *   ("priorizar em conjunto ou não priorizar"); se o conjunto não couber, vai para a fila.
 * - Limite de WIP por equipe e capacidade por equipe (quando cadastrada) também são respeitados.
 */
export function selectPortfolio(
  active: IInitiative[],
  candidates: ISelectionCandidate[],
  capacityRows: ICapacityRow[],
  cycle: string,
  params: IMethodologyParameters,
  /** Iniciativas concluídas: dependências satisfeitas. */
  completedIds: number[] = []
): ISelectionResult {
  const { overall, teams } = summarizeCapacity(capacityRows, cycle, params);
  const decisions = new Map<number, ISelectionDecision>();
  const alerts: string[] = [];
  const usage = new Map<string, ITeamUsage>();
  const teamKey = (team: string): string => normalize(team);
  const teamCapacity = (team: string): ICapacitySummary | undefined => teams.find((t) => teamKey(t.team) === teamKey(team));
  const use = (item: IInitiative, hours: number): void => {
    if (!item.team) {
      return;
    }
    const current = usage.get(teamKey(item.team)) ?? { hours: 0, count: 0 };
    usage.set(teamKey(item.team), { hours: current.hours + hours, count: current.count + 1 });
  };

  let committedByActive = 0;
  active.forEach((item) => {
    const hours = cycleDemand(item) ?? 0;
    committedByActive += hours;
    use(item, hours);
  });

  const satisfied: number[] = active.map((item) => item.id).concat(completedIds);
  let selectedDemand = 0;
  const remainingCapacity = (): number => overall.allocable - committedByActive - selectedDemand;

  const select = (entry: ISelectionCandidate, reasons: string[], selectedWith: number[]): void => {
    const hours = cycleDemand(entry.item) ?? 0;
    selectedDemand += hours;
    use(entry.item, hours);
    satisfied.push(entry.item.id);
    decisions.set(entry.item.id, { id: entry.item.id, suggestion: 'select', reasons, selectedWith });
  };

  const ranked = rankByIpp(candidates, params);
  const unranked = candidates.filter((c) => c.ipp === undefined);
  const byId = new Map<number, ISelectionCandidate>();
  candidates.forEach((c) => byId.set(c.item.id, c));

  // 1. Obrigatórias: capacidade reservada de forma visível.
  ranked
    .concat(unranked)
    .filter((c) => c.mandatory && c.gatePasses === true)
    .forEach((entry) => {
      const reasons = ['Obrigação legal/regulatória: entra com capacidade reservada.'];
      if ((cycleDemand(entry.item) ?? 0) > remainingCapacity()) {
        reasons.push('Excede a capacidade alocável do ciclo.');
        alerts.push(`A obrigatória "${entry.item.title}" excede a capacidade alocável: rever o restante do portfólio.`);
      }
      select(entry, reasons, []);
    });

  // 2. Demais, em ordem de prioridade.
  const isCandidateForSelection = (c: ISelectionCandidate | undefined): boolean =>
    !!c && c.gatePasses === true && c.ipp !== undefined && c.ipp >= params.selection.minimumIpp && cycleDemand(c.item) !== undefined;

  ranked.forEach((entry) => {
    const id = entry.item.id;
    if (decisions.has(id)) {
      return;
    }
    if (entry.gatePasses === false) {
      decisions.set(id, { id, suggestion: 'discard', reasons: ['Não passa nos pontos de controle.'], selectedWith: [] });
      return;
    }
    if (entry.gatePasses === undefined) {
      decisions.set(id, { id, suggestion: 'queue', reasons: ['Viabilidade ainda não avaliada.'], selectedWith: [] });
      return;
    }
    if ((entry.ipp as number) < params.selection.minimumIpp) {
      decisions.set(id, {
        id,
        suggestion: 'discard',
        reasons: [`IPP abaixo de ${formatNumber(params.selection.minimumIpp)}: postergar, redesenhar ou descartar.`],
        selectedWith: []
      });
      return;
    }
    if (cycleDemand(entry.item) === undefined) {
      decisions.set(id, { id, suggestion: 'queue', reasons: ['Sem estimativa de esforço para confrontar com a capacidade.'], selectedWith: [] });
      return;
    }

    // Conjunto: a iniciativa + dependências ainda não satisfeitas (transitivamente).
    const group: ISelectionCandidate[] = [];
    const blockedBy: string[] = [];
    const visit = (current: ISelectionCandidate): void => {
      if (group.indexOf(current) >= 0) {
        return;
      }
      group.push(current);
      current.item.dependencyIds.forEach((depId) => {
        if (satisfied.indexOf(depId) >= 0) {
          return;
        }
        const dep = byId.get(depId);
        const depDecision = decisions.get(depId);
        if (!isCandidateForSelection(dep) || (depDecision && depDecision.suggestion !== 'select')) {
          blockedBy.push(dep ? `"${dep.item.title}"` : `#${depId}`);
          return;
        }
        visit(dep as ISelectionCandidate);
      });
    };
    visit(entry);

    if (blockedBy.length > 0) {
      decisions.set(id, {
        id,
        suggestion: 'queue',
        reasons: [`Bloqueada: depende de ${blockedBy.join(', ')}, que não está priorizada.`],
        selectedWith: []
      });
      return;
    }

    const groupHours = sum(group.map((c) => cycleDemand(c.item) ?? 0));
    const reasons: string[] = [];
    if (groupHours > remainingCapacity() + 1e-9) {
      reasons.push(`Sem capacidade no ciclo: precisa de ${formatHours(groupHours)}, restam ${formatHours(Math.max(0, remainingCapacity()))}.`);
    }
    const teamDemand = new Map<string, ITeamUsage>();
    group.forEach((c) => {
      if (!c.item.team) {
        return;
      }
      const current = teamDemand.get(teamKey(c.item.team)) ?? { hours: 0, count: 0 };
      teamDemand.set(teamKey(c.item.team), { hours: current.hours + (cycleDemand(c.item) ?? 0), count: current.count + 1 });
    });
    teamDemand.forEach((demand, key) => {
      const capacity = teams.find((t) => teamKey(t.team) === key);
      const used = usage.get(key) ?? { hours: 0, count: 0 };
      if (!capacity) {
        return;
      }
      if (used.hours + demand.hours > capacity.allocable + 1e-9) {
        reasons.push(`Sem capacidade na equipe ${capacity.team}.`);
      }
      if (capacity.wipLimit > 0 && used.count + demand.count > capacity.wipLimit) {
        reasons.push(`Limite de iniciativas simultâneas (WIP ${capacity.wipLimit}) da equipe ${capacity.team} atingido.`);
      }
    });

    if (reasons.length > 0) {
      if (entry.item.size === 'Grande' || groupHours > overall.allocable / 2) {
        reasons.push('Avaliar fatiamento: uma primeira fase menor pode entregar parte do benefício.');
      }
      decisions.set(id, { id, suggestion: 'queue', reasons, selectedWith: [] });
      return;
    }

    // Seleciona as dependências primeiro, depois a iniciativa.
    group
      .slice(1)
      .reverse()
      .forEach((dep) => select(dep, [`Selecionada em conjunto com "${entry.item.title}" (dependência).`], [id]));
    const selectReasons: string[] = [];
    if ((entry.ipp as number) < 1) {
      selectReasons.push('Retorno limítrofe: reavaliar escopo ou fasear.');
    }
    select(entry, selectReasons, group.slice(1).map((c) => c.item.id));
  });

  unranked.forEach((entry) => {
    if (!decisions.has(entry.item.id)) {
      decisions.set(entry.item.id, {
        id: entry.item.id,
        suggestion: entry.gatePasses === false ? 'discard' : 'queue',
        reasons: [entry.gatePasses === false ? 'Não passa nos pontos de controle.' : 'Pontuação incompleta: IPP não calculado.'],
        selectedWith: []
      });
    }
  });

  if (capacityRows.length > 0 && overall.total === 0) {
    alerts.push(`Não há capacidade cadastrada para o ciclo ${cycle}.`);
  } else if (capacityRows.length === 0) {
    alerts.push('Mapa de capacidade vazio: cadastre a capacidade das equipes para o ciclo.');
  }
  if (overall.allocable > 0 && committedByActive > overall.allocable) {
    alerts.push('O portfólio ativo já excede a capacidade alocável: avaliar suspensões antes de novas entradas.');
  }
  const teamsWithoutCapacity: string[] = [];
  active
    .concat(candidates.map((c) => c.item))
    .forEach((item) => {
      if (item.team && overall.total > 0 && !teamCapacity(item.team) && teamsWithoutCapacity.indexOf(item.team) < 0) {
        teamsWithoutCapacity.push(item.team);
      }
    });
  if (teamsWithoutCapacity.length > 0) {
    alerts.push(`Equipes sem capacidade cadastrada no ciclo: ${teamsWithoutCapacity.join(', ')}.`);
  }

  const committed = committedByActive + selectedDemand;
  return {
    cycle,
    capacity: overall,
    teams,
    committedByActive,
    selectedDemand,
    remaining: overall.allocable - committed,
    commitmentPercent: overall.available > 0 ? (committed / overall.available) * 100 : undefined,
    decisions,
    order: ranked.map((c) => c.item.id),
    alerts
  };
}

export function normalize(text: string): string {
  return (text ?? '').trim().toLocaleLowerCase('pt-BR');
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function formatNumber(value: number, digits: number = 2): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatHours(value: number): string {
  return `${Math.round(value).toLocaleString('pt-BR')} h`;
}
