import { ACTIVE_STATUSES, IInitiative, isOneOf, LEGACY_PLANNED, STATUS } from './model';

/**
 * Pontos de decisão da metodologia (◆ 1 a 4) e encerramento (etapa 9).
 * Cada opção define a nova situação da iniciativa; undefined mantém a situação atual.
 */

export const BODIES = {
  manager: 'Gestor do Portfólio + responsável de negócio',
  committee: 'Comitê de Portfólio',
  executive: 'Alta gestão'
};

export const ALL_BODIES = [BODIES.manager, BODIES.committee, BODIES.executive];

export interface IDecisionOption {
  decision: string;
  description: string;
  /** Nova situação; undefined mantém a atual. */
  newStatus?: string;
  requiresJustification: boolean;
  /** Restringe a opção a estas situações (além das do ponto de decisão). */
  onlyFrom?: string[];
  /** Exclui a opção nestas situações. */
  notFrom?: string[];
}

export interface IDecisionPoint {
  key: string;
  label: string;
  step: string;
  from: string[];
  defaultBody: string;
  options: IDecisionOption[];
}

const option = (
  decision: string,
  description: string,
  newStatus: string | undefined,
  requiresJustification: boolean,
  extra: Partial<IDecisionOption> = {}
): IDecisionOption => ({ decision, description, newStatus, requiresJustification, ...extra });

export const DECISION_POINTS: IDecisionPoint[] = [
  {
    key: 'PD1',
    label: '◆ 1 – Elegibilidade',
    step: 'Etapa 2 – Análise e avaliação',
    from: [STATUS.registered, STATUS.inAnalysis, STATUS.inDetailing],
    defaultBody: BODIES.committee,
    options: [
      option('Iniciar análise', 'Registro conferido; a iniciativa passa a ser qualificada.', STATUS.inAnalysis, false, {
        onlyFrom: [STATUS.registered, STATUS.inDetailing]
      }),
      option('Elegível', 'Entra na avaliação de prioridade.', STATUS.eligible, false),
      option('Devolver para detalhamento', 'Retorna ao proponente para completar a ficha.', STATUS.inDetailing, true),
      option('Recusar', 'Não atende aos critérios de entrada ou aos pontos de controle.', STATUS.notEligible, true)
    ]
  },
  {
    key: 'PD2',
    label: '◆ 2 – Composição do portfólio',
    step: 'Etapa 5 – Seleção e balanceamento',
    from: [STATUS.eligible, STATUS.prioritized, STATUS.selected, STATUS.queued, STATUS.pendingApproval],
    defaultBody: BODIES.committee,
    options: [
      option('Selecionar', 'Cabe na capacidade e no equilíbrio do portfólio.', STATUS.selected, false),
      option('Manter em fila', 'Não coube na capacidade do ciclo; permanece na fila.', STATUS.queued, true),
      option('Descartar', 'Não será feita; o proponente recebe o motivo.', STATUS.discarded, true)
    ]
  },
  {
    key: 'PD3',
    label: '◆ 3 – Autorização',
    step: 'Etapa 6 – Autorização',
    from: [STATUS.selected, STATUS.pendingApproval],
    defaultBody: BODIES.committee,
    options: [
      option('Aprovar integralmente', 'Recursos alocados, responsáveis designados e marcos definidos.', STATUS.authorized, false),
      option('Aprovar por fase/incremento', 'Autoriza apenas a primeira fase; nova decisão ao fim dela.', STATUS.authorized, true),
      option('Aprovar condicionalmente', 'Autoriza mediante condições registradas na justificativa.', STATUS.authorized, true),
      option('Postergar', 'Fica pendente de aprovação (sem capacidade ou pessoas nomeadas).', STATUS.pendingApproval, true)
    ]
  },
  {
    key: 'PD4',
    label: '◆ 4 – Revisão do portfólio',
    step: 'Etapa 8 – Revisão e replanejamento',
    from: [STATUS.authorized, STATUS.inProgress, LEGACY_PLANNED, STATUS.suspended],
    defaultBody: BODIES.committee,
    options: [
      option('Manter', 'Prioridade, benefício e execução confirmados.', undefined, false, { notFrom: [STATUS.suspended] }),
      option('Repriorizar', 'Sobe ou desce na ordem; capacidade realocada.', undefined, true, { notFrom: [STATUS.suspended] }),
      option('Acelerar', 'Recebe capacidade adicional.', undefined, true, { notFrom: [STATUS.suspended] }),
      option('Suspender', 'Sai do portfólio ativo; registre o ponto de parada e as condições de retomada.', STATUS.suspended, true, {
        notFrom: [STATUS.suspended]
      }),
      option('Replanejar', 'Nova linha de base aprovada (prazo e custo projetados passam a ser a referência).', undefined, true, {
        notFrom: [STATUS.suspended]
      }),
      option('Retomar', 'Condições de retomada atendidas; volta ao portfólio ativo.', STATUS.authorized, true, {
        onlyFrom: [STATUS.suspended]
      }),
      option('Substituir', 'Encerrada; a sucessora deve ser registrada e autorizada.', STATUS.cancelled, true),
      option('Encerrar', 'Retirada definitiva; registre as lições aprendidas.', STATUS.cancelled, true)
    ]
  },
  {
    key: 'ENC',
    label: 'Encerramento ou retirada',
    step: 'Etapa 9 – Encerramento ou retirada',
    from: [STATUS.authorized, STATUS.inProgress, LEGACY_PLANNED, STATUS.suspended],
    defaultBody: BODIES.committee,
    options: [
      option('Concluir', 'Entregas registradas; capacidade liberada; medição de benefícios iniciada.', STATUS.completed, false),
      option('Cancelar', 'Registre o motivo e as lições aprendidas; comunique as partes interessadas.', STATUS.cancelled, true),
      option('Absorver', 'Incorporada a outra iniciativa ou à operação/produto.', STATUS.absorbed, true)
    ]
  }
];

/** Pontos de decisão (com as opções válidas) disponíveis para a situação atual. */
export function availableDecisionPoints(status: string): IDecisionPoint[] {
  return DECISION_POINTS.filter((point) => isOneOf(status, point.from))
    .map((point) => ({
      ...point,
      options: point.options.filter(
        (o) => (!o.onlyFrom || isOneOf(status, o.onlyFrom)) && (!o.notFrom || !isOneOf(status, o.notFrom))
      )
    }))
    .filter((point) => point.options.length > 0);
}

export function findDecisionPoint(key: string): IDecisionPoint | undefined {
  return DECISION_POINTS.find((point) => point.key === key);
}

export interface IDecisionEffect {
  newStatus: string;
  /** Campos da iniciativa a atualizar (chaves do modelo, convertidas para colunas pela camada de dados). */
  updates: Partial<Pick<IInitiative, 'authorizedOn' | 'approvedCost' | 'baselineEnd' | 'progress' | 'capacityAllocated'>>;
}

/** Efeito de aplicar uma decisão: nova situação e campos atualizados automaticamente. */
export function decisionEffect(item: IInitiative, pointKey: string, decision: string, today: Date): IDecisionEffect {
  const point = availableDecisionPoints(item.status).find((p) => p.key === pointKey);
  const chosen = point?.options.find((o) => o.decision === decision);
  if (!point || !chosen) {
    throw new Error(`A decisão "${decision}" não é válida para a situação "${item.status}".`);
  }
  const updates: IDecisionEffect['updates'] = {};
  if (pointKey === 'PD3' && chosen.newStatus === STATUS.authorized) {
    updates.authorizedOn = today;
    if (item.approvedCost === undefined && item.cost !== undefined) {
      updates.approvedCost = item.cost;
    }
  }
  if (decision === 'Retomar') {
    updates.authorizedOn = today;
  }
  if (decision === 'Replanejar') {
    if (item.projectedCost !== undefined) {
      updates.approvedCost = item.projectedCost;
    }
    if (item.projectedEnd) {
      updates.baselineEnd = item.projectedEnd;
    }
  }
  if (decision === 'Concluir') {
    updates.progress = 100;
  }
  return { newStatus: chosen.newStatus ?? item.status, updates };
}

/** Situações em que a iniciativa está no portfólio ativo. */
export function isActive(status: string): boolean {
  return isOneOf(status, ACTIVE_STATUSES);
}
