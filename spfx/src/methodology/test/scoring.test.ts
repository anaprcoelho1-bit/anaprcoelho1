import { DEFAULT_PARAMETERS as P, mergeParameters, validateParameters } from '../parameters';
import {
  authorityLevel,
  consolidateScores,
  entryCriteria,
  evaluateGates,
  findPossibleDuplicates,
  ippBand,
  scoreInitiative,
  weightedIndex
} from '../scoring';
import { FEASIBILITY } from '../model';
import { initiative, scores } from './fixtures';

function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripComments);
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    Object.keys(value as object).forEach((key) => {
      if (key.charAt(0) !== '$') {
        copy[key] = stripComments((value as Record<string, unknown>)[key]);
      }
    });
    return copy;
  }
  return value;
}

describe('parâmetros', () => {
  it('os padrões do código são iguais a provisioning/metodologia.json', () => {
    // Executado a partir de lib-commonjs/methodology/test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const published = require('../../../../provisioning/metodologia.json');
    expect(stripComments(published)).toEqual(P);
  });

  it('os pesos padrão somam 24 (valor) e 12 (custo/risco), como no documento', () => {
    expect(P.valueCriteria.reduce((s, c) => s + c.weight, 0)).toBe(24);
    expect(P.costRiskCriteria.reduce((s, c) => s + c.weight, 0)).toBe(12);
    expect(validateParameters(P)).toEqual([]);
  });

  it('combina parâmetros parciais com os padrões', () => {
    const merged = mergeParameters({ selection: { reservePercent: 20 }, version: '2027.1', teams: [] });
    expect(merged.selection.reservePercent).toBe(20);
    expect(merged.selection.minimumIpp).toBe(0.7);
    expect(merged.version).toBe('2027.1');
    expect(merged.teams).toEqual(P.teams);
    expect(mergeParameters(null)).toEqual(P);
  });

  it('aponta modelo com critérios de valor demais', () => {
    const many = { ...P, valueCriteria: P.valueCriteria.concat(P.valueCriteria.slice(0, 3).map((c) => ({ ...c, field: `${c.field}X` }))) };
    expect(validateParameters(many)[0]).toContain('máximo recomendado é 8');
  });
});

describe('VP, CR e IPP (seção 5)', () => {
  it('aplica as fórmulas ÷120 e ÷60 do documento', () => {
    const notes = {
      NotaAlinhamento: 4,
      NotaValor: 5,
      NotaImpactoUsuarios: 3,
      NotaIndicadores: 4,
      NotaImpactoOrganizacional: 2,
      NotaUrgencia: 5,
      NotaEsforco: 3,
      NotaCusto: 2,
      NotaRisco: 4,
      NotaDependencias: 1
    };
    const result = scoreInitiative(notes, P);
    expect(result.vp).toBeCloseTo((94 / 120) * 100, 6);
    expect(result.cr).toBeCloseTo((32 / 60) * 100, 6);
    expect(result.ipp).toBeCloseTo(94 / 120 / (32 / 60), 6);
    expect(result.band?.label).toBe('Retorno favorável');
    expect(result.missing).toEqual([]);
  });

  it('extremos: VP 100 e CR 20 dão IPP 5', () => {
    const result = scoreInitiative(scores(5, 1), P);
    expect(result.vp).toBe(100);
    expect(result.cr).toBe(20);
    expect(result.ipp).toBe(5);
  });

  it('não calcula com nota ausente ou fora da escala', () => {
    const notes: Record<string, number | undefined> = { ...scores(3, 3), NotaUrgencia: undefined };
    expect(weightedIndex(P.valueCriteria, notes, P)).toBeUndefined();
    const result = scoreInitiative({ ...scores(3, 3), NotaRisco: 7 }, P);
    expect(result.ipp).toBeUndefined();
    expect(result.missing).toEqual(['Risco']);
  });

  it('classifica nas faixas de IPP', () => {
    expect(ippBand(1.5, P).recommendation).toBe('Priorizar fortemente');
    expect(ippBand(1.49, P).recommendation).toBe('Selecionar conforme capacidade');
    expect(ippBand(1, P).recommendation).toBe('Selecionar conforme capacidade');
    expect(ippBand(0.99, P).recommendation).toBe('Reavaliar escopo ou fasear');
    expect(ippBand(0.7, P).recommendation).toBe('Reavaliar escopo ou fasear');
    expect(ippBand(0.69, P).recommendation).toBe('Postergar, redesenhar ou descartar');
  });
});

describe('pontos de controle (seção 5.2)', () => {
  it('inviável não entra, independentemente do valor', () => {
    const gate = evaluateGates(initiative({ feasibility: FEASIBILITY.unfeasible, scores: scores(5, 1) }), P);
    expect(gate.outcome).toBe('unfeasible');
    expect(gate.passes).toBe(false);
  });

  it('obrigatória entra mesmo sem objetivo estratégico', () => {
    const gate = evaluateGates(initiative({ legalObligation: true, objective: '' }), P);
    expect(gate.outcome).toBe('mandatory');
    expect(gate.passes).toBe(true);
  });

  it('sem objetivo e não obrigatória não entra', () => {
    expect(evaluateGates(initiative({ objective: '' }), P).outcome).toBe('unaligned');
    expect(evaluateGates(initiative({ objective: 'Objetivo inexistente' }), P).outcome).toBe('unaligned');
  });

  it('viabilidade não avaliada fica pendente', () => {
    const gate = evaluateGates(initiative({ feasibility: FEASIBILITY.notAssessed }), P);
    expect(gate.outcome).toBe('pending');
    expect(gate.passes).toBeUndefined();
  });
});

describe('critérios de entrada (seção 3.3)', () => {
  it('ficha completa atende a todos', () => {
    expect(entryCriteria(initiative(), P).every((c) => c.met)).toBe(true);
  });

  it('aponta cada pendência', () => {
    const checks = entryCriteria(
      initiative({ businessOwner: '', expectedBenefit: '', effortHours: 40, feasibility: FEASIBILITY.notAssessed }),
      P
    );
    const pending = checks.filter((c) => !c.met).map((c) => c.key);
    expect(pending).toEqual(['owner', 'benefit', 'feasible', 'size']);
  });
});

describe('alçadas (seção 8.2)', () => {
  it('pequeno porte decide no Gestor do Portfólio', () => {
    expect(authorityLevel(initiative({ effortHours: 100, cost: 1000, scores: scores(3, 2) }), P).label).toBe('Pequeno porte');
  });

  it('impacto transversal sobe para o Comitê', () => {
    const notes = { ...scores(3, 2), NotaImpactoOrganizacional: 4 };
    expect(authorityLevel(initiative({ effortHours: 100, cost: 1000, scores: notes }), P).label).toBe('Médio porte');
  });

  it('novo orçamento ou valor acima do limite vai à alta gestão', () => {
    expect(authorityLevel(initiative({ effortHours: 100, cost: 1000, scores: { ...scores(3, 2), NotaCusto: 5 } }), P).label).toBe(
      'Grande porte / estratégico'
    );
    expect(authorityLevel(initiative({ effortHours: 5000, cost: 1000, scores: scores(3, 2) }), P).label).toBe('Grande porte / estratégico');
  });
});

describe('duplicidade e pontuação colegiada', () => {
  it('identifica nomes semelhantes', () => {
    const a = initiative({ title: 'Implantação do sistema de gestão de contratos' });
    const b = initiative({ title: 'Implantar sistema gestão contratos' });
    const c = initiative({ title: 'Implantação do sistema de gestão documental' });
    const d = initiative({ title: 'Sistema de gestão de contratos – implantação' });
    const result = findPossibleDuplicates([a, b, c, d]);
    expect(result.get(a.id)).toEqual([d.id]);
    expect(result.has(c.id)).toBe(false);
  });

  it('aponta divergência acima de 2 pontos e calcula a mediana', () => {
    const sheets = [
      { initiativeId: 1, evaluator: 'A', scores: { ...scores(4, 2), NotaValor: 1 } },
      { initiativeId: 1, evaluator: 'B', scores: { ...scores(4, 2), NotaValor: 4 } },
      { initiativeId: 1, evaluator: 'C', scores: { ...scores(5, 4), NotaValor: 4 } }
    ];
    const result = consolidateScores(sheets, P);
    expect(result.divergences.map((d) => d.field)).toEqual(['NotaValor']);
    expect(result.medians.NotaValor).toBe(4);
    expect(result.medians.NotaEsforco).toBe(2);
    expect(result.readyToConsolidate).toBe(false);
  });

  it('diferença de exatamente 2 pontos não é divergência', () => {
    const sheets = [
      { initiativeId: 1, evaluator: 'A', scores: scores(2, 2) },
      { initiativeId: 1, evaluator: 'B', scores: scores(4, 3) }
    ];
    const result = consolidateScores(sheets, P);
    expect(result.divergences).toEqual([]);
    expect(result.readyToConsolidate).toBe(true);
    expect(result.medians.NotaAlinhamento).toBe(3);
  });
});
