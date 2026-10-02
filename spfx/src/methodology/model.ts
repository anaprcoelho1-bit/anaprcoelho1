/** Situações do ciclo de vida de uma iniciativa (coluna "Situação" da lista de iniciativas). */
export const STATUS = {
  registered: 'Registrada',
  inAnalysis: 'Em análise',
  inDetailing: 'Em detalhamento',
  notEligible: 'Não elegível',
  eligible: 'Elegível',
  prioritized: 'Priorizada',
  selected: 'Selecionada',
  queued: 'Em fila',
  discarded: 'Descartada',
  pendingApproval: 'Pendente de aprovação',
  authorized: 'Autorizada',
  inProgress: 'Em andamento',
  suspended: 'Suspensa',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  absorbed: 'Absorvida'
};

/** Todas as situações, na ordem do fluxo (usada como opções da coluna de escolha). */
export const ALL_STATUSES: string[] = Object.keys(STATUS).map((key) => (STATUS as Record<string, string>)[key]);

/** Situação "Planejada" das primeiras versões da lista: tratada como "Autorizada". */
export const LEGACY_PLANNED = 'Planejada';

/** Fila de entrada (etapas 1 e 2): registradas e em análise. */
export const INTAKE_STATUSES = [STATUS.registered, STATUS.inAnalysis, STATUS.inDetailing];
/** Candidatas à priorização e à seleção (etapas 3 a 6). */
export const CANDIDATE_STATUSES = [STATUS.eligible, STATUS.prioritized, STATUS.selected, STATUS.queued, STATUS.pendingApproval];
/** Portfólio ativo: autorizadas e em execução (consomem capacidade). */
export const ACTIVE_STATUSES = [STATUS.authorized, STATUS.inProgress, LEGACY_PLANNED];
/** Fora do portfólio ativo. */
export const CLOSED_STATUSES = [
  STATUS.notEligible,
  STATUS.discarded,
  STATUS.suspended,
  STATUS.completed,
  STATUS.cancelled,
  STATUS.absorbed
];

export const FEASIBILITY = { notAssessed: 'Não avaliada', feasible: 'Viável', unfeasible: 'Inviável' };

export const MANDATORY_MOTIVATION = 'Obrigatória (legal/regulatória)';

/** Iniciativa normalizada (independente de como está gravada no SharePoint). */
export interface IInitiative {
  id: number;
  code: string;
  title: string;
  status: string;
  created: Date;

  businessOwner: string;
  initiativeManager: string;
  unit: string;
  team: string;

  problem: string;
  solution: string;
  expectedBenefit: string;
  benefitIndicator: string;

  objective: string;
  nature: string;
  motivation: string;
  horizon: string;
  size: string;

  /** Esforço total estimado (horas). */
  effortHours?: number;
  /** Demanda de capacidade no ciclo atual (horas). Na ausência, usa-se o esforço total. */
  cycleEffortHours?: number;
  cost?: number;
  durationMonths?: number;

  feasibility: string;
  legalObligation: boolean;
  legalDeadline?: Date;

  /** Notas dos critérios, por nome interno da coluna. */
  scores: Record<string, number | undefined>;

  dependencyIds: number[];
  criticalDependencyBlocked: boolean;
  riskResponseDefined: boolean;

  capacityAllocated: boolean;
  authorizedOn?: Date;
  plannedStart?: Date;
  baselineEnd?: Date;
  projectedEnd?: Date;
  approvedCost?: number;
  projectedCost?: number;
  progress?: number;
  lastDeliveryOn?: Date;
  benefitCompromised: boolean;
  /** Percentual do benefício previsto efetivamente medido (0 a 100). */
  benefitRealized?: number;

  lastDecision: string;
  lastDecisionOn?: Date;

  /** Valores gravados pelo modelo na última sincronização (para gravar só o que mudou). */
  stored: IStoredModelFields;
}

export interface IStoredModelFields {
  rank?: number;
  ippBand: string;
  trafficLight: string;
  alerts: string;
  suggestion: string;
  authority: string;
}

/** Linha do Mapa de Capacidade: capacidade de uma equipe em um ciclo (horas). */
export interface ICapacityRow {
  id?: number;
  cycle: string;
  team: string;
  total: number;
  sustainment: number;
  reservePercent?: number;
  wipLimit?: number;
}

/** Registro de Decisões. */
export interface IDecisionRecord {
  id?: number;
  initiativeId: number;
  decisionPoint: string;
  decision: string;
  justification: string;
  body: string;
  date: Date;
  previousStatus: string;
  newStatus: string;
}

/** Pontuação individual de um membro do comitê. */
export interface IScoreSheet {
  initiativeId: number;
  evaluator: string;
  scores: Record<string, number | undefined>;
}

export interface IPortfolioInput {
  initiatives: IInitiative[];
  capacity: ICapacityRow[];
  decisions: IDecisionRecord[];
  scoreSheets: IScoreSheet[];
}

export function isOneOf(value: string, list: string[]): boolean {
  return list.indexOf(value) >= 0;
}

export function emptyStored(): IStoredModelFields {
  return { ippBand: '', trafficLight: '', alerts: '', suggestion: '', authority: '' };
}
