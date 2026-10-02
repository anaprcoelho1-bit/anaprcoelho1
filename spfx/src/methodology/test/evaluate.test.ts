import { evaluatePortfolio, IEvaluatedInitiative, IIndicator, initiativeCode, modelFieldsChanged, modelFieldValues } from '../evaluate';
import { FEASIBILITY, IPortfolioInput, STATUS } from '../model';
import { DEFAULT_PARAMETERS as P } from '../parameters';
import { initiative, scores, TODAY } from './fixtures';

function scenario(): IPortfolioInput {
  return {
    initiatives: [
      // Portfólio ativo
      initiative({ id: 1, status: STATUS.inProgress, objective: 'Transformação Digital', cycleEffortHours: 300, scores: scores(5, 2), team: 'Equipe A',
        plannedStart: new Date(2026, 0, 1), baselineEnd: new Date(2026, 11, 31), projectedEnd: new Date(2027, 2, 20), lastDeliveryOn: new Date(2026, 8, 20) }),
      initiative({ id: 2, status: STATUS.authorized, objective: 'Eficiência Operacional', cycleEffortHours: 200, scores: scores(3, 3), progress: 10, team: 'Equipe A' }),
      // Candidatas
      initiative({ id: 3, status: STATUS.eligible, objective: 'Serviços ao Cidadão', cycleEffortHours: 100, scores: scores(4, 2) }),
      initiative({ id: 4, status: STATUS.prioritized, objective: 'Gestão e Governança', cycleEffortHours: 500, scores: scores(4, 3) }),
      // Fila de entrada
      initiative({ id: 5, status: STATUS.registered, businessOwner: '', code: '', created: new Date(2026, 8, 1) }),
      initiative({ id: 6, status: STATUS.inAnalysis, feasibility: FEASIBILITY.unfeasible }),
      // Encerradas
      initiative({ id: 7, status: STATUS.completed, benefitRealized: 60 }),
      initiative({ id: 8, status: STATUS.completed, benefitRealized: 120 })
    ],
    capacity: [{ cycle: '2026-T4', team: 'Equipe A', total: 1000, sustainment: 400 }],
    decisions: [
      { initiativeId: 9, decisionPoint: 'PD4', decision: 'Suspender', justification: 'x', body: 'Comitê', date: new Date(2026, 8, 1), previousStatus: STATUS.inProgress, newStatus: STATUS.suspended },
      { initiativeId: 10, decisionPoint: 'PD4', decision: 'Encerrar', justification: 'x', body: 'Comitê', date: new Date(2025, 0, 1), previousStatus: STATUS.inProgress, newStatus: STATUS.cancelled }
    ],
    scoreSheets: []
  };
}

describe('avaliação do portfólio', () => {
  const result = evaluatePortfolio(scenario(), P, TODAY);
  const item = (id: number): IEvaluatedInitiative => result.byId.get(id)!;

  it('classifica os estágios e o ranking', () => {
    expect(result.cycle).toBe('2026-T4');
    expect(item(1).stage).toBe('active');
    expect(item(3).stage).toBe('candidate');
    expect(item(5).stage).toBe('intake');
    expect(item(7).stage).toBe('closed');
    // IPP: 1 → 2,5; 3 → 2,0; 4 → 80/60 ≈ 1,33; 2 → 1,0
    expect([1, 3, 4, 2].map((id) => item(id).rank)).toEqual([1, 2, 3, 4]);
    expect(item(1).topQuartile).toBe(true);
    expect(item(3).topQuartile).toBe(false);
  });

  it('sugere a composição pela capacidade', () => {
    // Alocável: (1000 − 400) × 85% = 510; ativo consome 500; restam 10 h.
    expect(result.selection.capacity.allocable).toBe(510);
    expect(item(3).suggestion).toBe('Manter em fila');
    expect(item(4).suggestion).toBe('Manter em fila');
  });

  it('sugere a decisão da fila de entrada', () => {
    expect(item(5).suggestion).toBe('Iniciar análise');
    expect(item(5).suggestionReason).toContain('responsável de negócio');
    expect(item(6).suggestion).toBe('Recusar');
  });

  it('monitora o portfólio ativo', () => {
    expect(item(1).light?.color).toBe('Amarelo');
    expect(item(1).scheduleDeviation).toBeGreaterThan(20);
    expect(item(1).suggestion).toBe('Manter');
  });

  it('calcula os 8 indicadores', () => {
    const value = (id: number): IIndicator => result.indicators.find((i) => i.id === id)!;
    expect(result.indicators).toHaveLength(8);
    expect(value(1).value).toBe(100);
    expect(value(2).value).toBe(100); // quartil superior = iniciativa 1, em execução
    expect(value(3).value).toBeCloseTo((500 / 600) * 100, 6);
    expect(value(3).status).toBe('ok');
    expect(value(4).value).toBe(80); // média de 60% e 100% (limitado)
    expect(value(5).display).toBe('2 OE sem investimento');
    expect(value(6).value).toBe(50);
    expect(value(6).status).toBe('bad');
    expect(value(7).value).toBeCloseTo((1 / 3) * 100, 6);
    expect(value(8).value).toBeCloseTo((2 * 300 + 3 * 200) / 500, 6);
  });

  it('gera os campos do modelo e as transições automáticas', () => {
    const active = modelFieldValues(item(2));
    expect(active.status).toBe(STATUS.inProgress); // autorizada com progresso
    expect(active.trafficLight).toBe('Verde');

    const eligible = modelFieldValues(item(3));
    expect(eligible.status).toBe(STATUS.prioritized); // elegível já pontuada
    expect(eligible.rank).toBe(2);
    expect(eligible.ippBand).toBe('Alto retorno relativo – Priorizar fortemente');

    const intake = modelFieldValues(item(5));
    expect(intake.code).toBe('INI-2026-005');
    expect(intake.alerts).toContain('Critério de entrada pendente: Responsável de negócio identificado');
    expect(modelFieldsChanged(item(5), intake)).toBe(true);
  });

  it('não regrava o que não mudou', () => {
    const closed = item(7);
    const values = modelFieldValues(closed);
    closed.item.stored = { rank: values.rank, ippBand: values.ippBand, trafficLight: '', alerts: values.alerts, suggestion: '', authority: '' };
    expect(modelFieldsChanged(closed, values)).toBe(false);
  });

  it('gera códigos com o ano de registro', () => {
    expect(initiativeCode(initiative({ id: 1234, created: new Date(2025, 5, 1) }))).toBe('INI-2025-1234');
  });
});
