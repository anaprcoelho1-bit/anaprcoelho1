import { emptyStored, FEASIBILITY, IInitiative, STATUS } from '../model';

let nextId = 1;

/** Iniciativa completa e elegível; os testes sobrescrevem apenas o que importa. */
export function initiative(overrides: Partial<IInitiative> = {}): IInitiative {
  const id = overrides.id ?? nextId++;
  return {
    id,
    code: `INI-2026-${id}`,
    title: `Iniciativa ${id}`,
    status: STATUS.eligible,
    created: new Date(2026, 0, 10),
    businessOwner: 'Maria',
    initiativeManager: '',
    unit: 'CIPP',
    team: '',
    problem: 'Problema descrito',
    solution: 'Solução',
    expectedBenefit: 'Benefício descrito',
    benefitIndicator: '',
    objective: 'Transformação Digital',
    nature: 'Projeto',
    motivation: 'Estratégica',
    horizon: 'Curto (até 6 meses)',
    size: 'Médio',
    effortHours: 400,
    cycleEffortHours: 100,
    cost: 10000,
    durationMonths: 6,
    feasibility: FEASIBILITY.feasible,
    legalObligation: false,
    scores: scores(4, 2),
    dependencyIds: [],
    criticalDependencyBlocked: false,
    riskResponseDefined: true,
    capacityAllocated: true,
    benefitCompromised: false,
    lastDecision: '',
    stored: emptyStored(),
    ...overrides
  };
}

/** Notas uniformes: todos os critérios de valor = value; todos os de custo/risco = cost. */
export function scores(value: number, cost: number): Record<string, number> {
  return {
    NotaAlinhamento: value,
    NotaValor: value,
    NotaImpactoUsuarios: value,
    NotaIndicadores: value,
    NotaImpactoOrganizacional: value,
    NotaUrgencia: value,
    NotaEsforco: cost,
    NotaCusto: cost,
    NotaRisco: cost,
    NotaDependencias: cost
  };
}

export const TODAY = new Date(2026, 9, 2);
