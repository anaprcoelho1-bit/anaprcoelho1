import { balancePortfolio } from '../balance';
import { STATUS } from '../model';
import { DEFAULT_PARAMETERS as P } from '../parameters';
import { scoreInitiative } from '../scoring';
import { cycleOf, ISelectionCandidate, rankByIpp, selectPortfolio, summarizeCapacity } from '../selection';
import { initiative, scores } from './fixtures';
import { IInitiative } from '../model';

const CYCLE = '2026-T4';
const capacity = [{ cycle: CYCLE, team: 'Equipe A', total: 1000, sustainment: 200 }];

function candidate(item: IInitiative): ISelectionCandidate {
  return { item, ipp: scoreInitiative(item.scores, P).ipp, gatePasses: true, mandatory: item.legalObligation };
}

describe('capacidade (etapa 5)', () => {
  it('identifica o ciclo trimestral', () => {
    expect(cycleOf(new Date(2026, 9, 2))).toBe('2026-T4');
    expect(cycleOf(new Date(2027, 0, 1))).toBe('2027-T1');
  });

  it('capacidade alocável = total − sustentação − reserva', () => {
    const { overall, teams } = summarizeCapacity(
      capacity.concat([{ cycle: '2026-T3', team: 'Equipe A', total: 9999, sustainment: 0 }]),
      CYCLE,
      P
    );
    expect(overall.available).toBe(800);
    expect(overall.reserve).toBe(120);
    expect(overall.allocable).toBe(680);
    expect(teams).toHaveLength(1);
    expect(teams[0].wipLimit).toBe(2);
  });
});

describe('ordenação pelo IPP', () => {
  it('entre IPPs semelhantes, a de menor duração vem primeiro', () => {
    const entries = [
      { item: initiative({ id: 101, durationMonths: 12 }), ipp: 1.52 },
      { item: initiative({ id: 102, durationMonths: 3 }), ipp: 1.55 },
      { item: initiative({ id: 103, durationMonths: 10 }), ipp: 1.58 },
      { item: initiative({ id: 104, durationMonths: 20 }), ipp: 1.61 },
      { item: initiative({ id: 105 }), ipp: undefined }
    ];
    expect(rankByIpp(entries, P).map((e) => e.item.id)).toEqual([104, 102, 103, 101]);
  });
});

describe('seleção pela capacidade (ponto de decisão 2)', () => {
  it('percorre a lista priorizada alocando até o limite', () => {
    const active = initiative({ status: STATUS.inProgress, team: 'Equipe A', cycleEffortHours: 300 });
    const mandatory = initiative({ legalObligation: true, scores: scores(2, 4), cycleEffortHours: 200 });
    const high = initiative({ scores: scores(5, 2), cycleEffortHours: 100 });
    const second = initiative({ scores: scores(4, 2), cycleEffortHours: 150 });
    const low = initiative({ scores: scores(2, 4), cycleEffortHours: 10 });

    const result = selectPortfolio([active], [low, second, high, mandatory].map(candidate), capacity, CYCLE, P);

    expect(result.decisions.get(mandatory.id)?.suggestion).toBe('select');
    expect(result.decisions.get(high.id)?.suggestion).toBe('select');
    expect(result.decisions.get(second.id)?.suggestion).toBe('queue');
    expect(result.decisions.get(second.id)?.reasons[0]).toContain('Sem capacidade no ciclo');
    expect(result.decisions.get(low.id)?.suggestion).toBe('discard');
    expect(result.committedByActive).toBe(300);
    expect(result.selectedDemand).toBe(300);
    expect(result.remaining).toBe(80);
    expect(result.commitmentPercent).toBe(75);
  });

  it('obrigatória entra mesmo sem capacidade, com alerta', () => {
    const active = initiative({ status: STATUS.inProgress, cycleEffortHours: 650 });
    const mandatory = initiative({ legalObligation: true, cycleEffortHours: 200 });
    const result = selectPortfolio([active], [candidate(mandatory)], capacity, CYCLE, P);
    expect(result.decisions.get(mandatory.id)?.suggestion).toBe('select');
    expect(result.alerts.join(' ')).toContain('excede a capacidade alocável');
  });

  it('seleciona em conjunto com a dependência ainda não priorizada', () => {
    const dependency = initiative({ scores: scores(3, 3), cycleEffortHours: 50 });
    const main = initiative({ scores: scores(5, 2), cycleEffortHours: 100, dependencyIds: [dependency.id] });
    const result = selectPortfolio([], [candidate(main), candidate(dependency)], capacity, CYCLE, P);
    expect(result.decisions.get(main.id)?.suggestion).toBe('select');
    expect(result.decisions.get(main.id)?.selectedWith).toEqual([dependency.id]);
    expect(result.decisions.get(dependency.id)?.reasons[0]).toContain('em conjunto');
    expect(result.selectedDemand).toBe(150);
  });

  it('dependência fora do portfólio bloqueia a iniciativa', () => {
    const main = initiative({ scores: scores(5, 2), cycleEffortHours: 100, dependencyIds: [999] });
    const result = selectPortfolio([], [candidate(main)], capacity, CYCLE, P);
    expect(result.decisions.get(main.id)?.suggestion).toBe('queue');
    expect(result.decisions.get(main.id)?.reasons[0]).toContain('Bloqueada');
  });

  it('dependência já ativa ou concluída está satisfeita', () => {
    const done = initiative({ status: STATUS.inProgress, cycleEffortHours: 10 });
    const main = initiative({ scores: scores(5, 2), cycleEffortHours: 100, dependencyIds: [done.id, 555] });
    const result = selectPortfolio([done], [candidate(main)], capacity, CYCLE, P, [555]);
    expect(result.decisions.get(main.id)?.suggestion).toBe('select');
  });

  it('respeita o limite de WIP da equipe', () => {
    const active = initiative({ status: STATUS.inProgress, team: 'Equipe A', cycleEffortHours: 50 });
    const first = initiative({ team: 'Equipe A', scores: scores(5, 2), cycleEffortHours: 50 });
    const second = initiative({ team: 'Equipe A', scores: scores(4, 2), cycleEffortHours: 50 });
    const result = selectPortfolio([active], [candidate(first), candidate(second)], capacity, CYCLE, P);
    expect(result.decisions.get(first.id)?.suggestion).toBe('select');
    expect(result.decisions.get(second.id)?.suggestion).toBe('queue');
    expect(result.decisions.get(second.id)?.reasons.join(' ')).toContain('WIP 2');
  });

  it('sem estimativa ou com pontuação incompleta vai para a fila', () => {
    const noEstimate = initiative({ effortHours: undefined, cycleEffortHours: undefined });
    const noScore = initiative({ scores: {} });
    const result = selectPortfolio([], [candidate(noEstimate), candidate(noScore)], capacity, CYCLE, P);
    expect(result.decisions.get(noEstimate.id)?.suggestion).toBe('queue');
    expect(result.decisions.get(noScore.id)?.reasons[0]).toContain('IPP não calculado');
  });

  it('alerta quando não há capacidade cadastrada', () => {
    const result = selectPortfolio([], [], [], CYCLE, P);
    expect(result.alerts[0]).toContain('Mapa de capacidade vazio');
  });
});

describe('balanceamento (seção 6)', () => {
  it('calcula a participação de cada faixa pela demanda de capacidade', () => {
    const portfolio = [
      initiative({ horizon: 'Curto (até 6 meses)', cycleEffortHours: 50, scores: scores(4, 2) }),
      initiative({ horizon: 'Médio (6 a 18 meses)', cycleEffortHours: 30, scores: scores(4, 4) }),
      initiative({ horizon: 'Longo (acima de 18 meses)', cycleEffortHours: 20, scores: scores(4, 2) })
    ];
    const report = balancePortfolio(portfolio, P);
    expect(report.basis).toBe('effort');
    const horizon = report.dimensions.find((d) => d.key === 'horizon');
    expect(horizon?.bands.map((b) => b.share)).toEqual([50, 30, 20]);
    expect(horizon?.balanced).toBe(true);

    const innovation = report.dimensions.find((d) => d.key === 'innovation');
    expect(innovation?.bands.map((b) => b.status)).toEqual(['below', 'above', 'below']);

    const risk = report.dimensions.find((d) => d.key === 'risk');
    expect(risk?.bands.map((b) => b.share)).toEqual([70, 30]);
    expect(risk?.balanced).toBe(true);

    expect(report.orphanObjectives).toEqual(['Gestão e Governança', 'Eficiência Operacional', 'Serviços ao Cidadão']);
  });

  it('usa a contagem quando não há estimativas', () => {
    const report = balancePortfolio([initiative({ effortHours: undefined, cycleEffortHours: undefined })], P);
    expect(report.basis).toBe('count');
    expect(report.totalWeight).toBe(1);
  });
});
