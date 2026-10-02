import { STATUS } from '../model';
import {
  costDeviation,
  permanenceTriggers,
  scheduleDeviation,
  suggestReviewDecision,
  trafficLight
} from '../monitoring';
import { DEFAULT_PARAMETERS as P, mergeParameters } from '../parameters';
import { availableDecisionPoints, decisionEffect } from '../workflow';
import { initiative, scores, TODAY } from './fixtures';

const daysAgo = (days: number): Date => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - days);

describe('desvios e semáforo (seção 9.1)', () => {
  const base = {
    status: STATUS.inProgress,
    plannedStart: new Date(2026, 0, 1),
    baselineEnd: new Date(2026, 11, 31),
    approvedCost: 100000,
    lastDeliveryOn: daysAgo(10)
  };

  it('verde dentro das faixas', () => {
    const item = initiative({ ...base, projectedEnd: new Date(2026, 11, 31), projectedCost: 105000 });
    expect(scheduleDeviation(item)).toBe(0);
    expect(costDeviation(item)).toBe(5);
    expect(trafficLight(item, TODAY, P).color).toBe('Verde');
  });

  it('amarelo com desvio entre 10% e 30% ou risco alto sem resposta', () => {
    const delayed = initiative({ ...base, projectedEnd: new Date(2027, 1, 15) });
    expect(Math.round(scheduleDeviation(delayed) as number)).toBe(13);
    expect(trafficLight(delayed, TODAY, P).color).toBe('Amarelo');

    const risky = initiative({ ...base, scores: { ...scores(4, 2), NotaRisco: 4 }, riskResponseDefined: false });
    const light = trafficLight(risky, TODAY, P);
    expect(light.color).toBe('Amarelo');
    expect(light.reasons).toEqual(['Risco alto sem resposta definida']);
  });

  it('vermelho com desvio acima de 30%, benefício comprometido, dependência bloqueada ou parada há 2 ciclos', () => {
    expect(trafficLight(initiative({ ...base, projectedCost: 140000 }), TODAY, P).color).toBe('Vermelho');
    expect(trafficLight(initiative({ ...base, benefitCompromised: true }), TODAY, P).color).toBe('Vermelho');
    expect(trafficLight(initiative({ ...base, criticalDependencyBlocked: true }), TODAY, P).color).toBe('Vermelho');
    const stalled = trafficLight(initiative({ ...base, lastDeliveryOn: daysAgo(61) }), TODAY, P);
    expect(stalled.color).toBe('Vermelho');
    expect(stalled.reasons[0]).toContain('Sem entregas há 2 ciclos');
  });

  it('não considera parada a iniciativa que ainda não começou', () => {
    const future = initiative({ ...base, plannedStart: new Date(2026, 11, 1), lastDeliveryOn: undefined, authorizedOn: daysAgo(100) });
    expect(trafficLight(future, TODAY, P).color).toBe('Verde');
  });
});

describe('permanência (seção 3.3) e matriz de revisão (seção 10.2)', () => {
  it('objetivo extinto sugere encerrar', () => {
    const params = mergeParameters({
      objectives: P.objectives.map((o) => (o.name === 'Transformação Digital' ? { ...o, active: false } : o))
    });
    const item = initiative({ status: STATUS.inProgress });
    const triggers = permanenceTriggers(item, TODAY, params);
    expect(triggers.map((t) => t.key)).toEqual(['objective']);
    expect(suggestReviewDecision(item, triggers, 1.2, 'Verde', params).decision).toBe('Encerrar');
  });

  it('custo acima de +30% sugere replanejar', () => {
    const item = initiative({ status: STATUS.inProgress, approvedCost: 100, projectedCost: 135 });
    const triggers = permanenceTriggers(item, TODAY, P);
    expect(triggers.map((t) => t.key)).toEqual(['cost']);
    expect(triggers[0].suggestion).toBe('Replanejar');
  });

  it('autorizada sem equipe há mais de um ciclo sugere suspender', () => {
    const item = initiative({ status: STATUS.authorized, capacityAllocated: false, authorizedOn: daysAgo(91), plannedStart: daysAgo(91), lastDeliveryOn: daysAgo(5) });
    expect(permanenceTriggers(item, TODAY, P).map((t) => t.key)).toEqual(['capacity']);
  });

  it('IPP desfavorável sugere encerrar; prazo legal em risco sugere acelerar; demais, manter', () => {
    const item = initiative({ status: STATUS.inProgress });
    expect(suggestReviewDecision(item, [], 0.5, 'Verde', P).decision).toBe('Encerrar');
    const legal = initiative({
      status: STATUS.inProgress,
      plannedStart: new Date(2026, 0, 1),
      baselineEnd: new Date(2026, 9, 1),
      projectedEnd: new Date(2026, 11, 1),
      legalDeadline: new Date(2026, 10, 1)
    });
    expect(suggestReviewDecision(legal, [], 1.2, 'Amarelo', P).decision).toBe('Acelerar');
    expect(suggestReviewDecision(item, [], 1.2, 'Amarelo', P)).toEqual({ decision: 'Manter', reason: 'Manter com plano de ação' });
  });
});

describe('pontos de decisão', () => {
  it('oferece apenas as decisões válidas para a situação', () => {
    expect(availableDecisionPoints(STATUS.registered).map((p) => p.key)).toEqual(['PD1']);
    expect(availableDecisionPoints(STATUS.inAnalysis)[0].options.map((o) => o.decision)).toEqual([
      'Elegível',
      'Devolver para detalhamento',
      'Recusar'
    ]);
    expect(availableDecisionPoints(STATUS.selected).map((p) => p.key)).toEqual(['PD2', 'PD3']);
    const suspended = availableDecisionPoints(STATUS.suspended);
    expect(suspended.map((p) => p.key)).toEqual(['PD4', 'ENC']);
    expect(suspended[0].options.map((o) => o.decision)).toEqual(['Retomar', 'Substituir', 'Encerrar']);
    expect(availableDecisionPoints(STATUS.completed)).toEqual([]);
  });

  it('autorização registra a data e fixa o custo aprovado', () => {
    const item = initiative({ status: STATUS.selected, cost: 5000, approvedCost: undefined });
    const effect = decisionEffect(item, 'PD3', 'Aprovar integralmente', TODAY);
    expect(effect.newStatus).toBe(STATUS.authorized);
    expect(effect.updates).toEqual({ authorizedOn: TODAY, approvedCost: 5000 });
  });

  it('replanejar aprova nova linha de base sem mudar a situação', () => {
    const item = initiative({ status: STATUS.inProgress, projectedCost: 130, projectedEnd: new Date(2027, 2, 1) });
    const effect = decisionEffect(item, 'PD4', 'Replanejar', TODAY);
    expect(effect.newStatus).toBe(STATUS.inProgress);
    expect(effect.updates).toEqual({ approvedCost: 130, baselineEnd: new Date(2027, 2, 1) });
  });

  it('rejeita decisão incompatível com a situação', () => {
    expect(() => decisionEffect(initiative({ status: STATUS.registered }), 'PD3', 'Aprovar integralmente', TODAY)).toThrow();
  });
});
