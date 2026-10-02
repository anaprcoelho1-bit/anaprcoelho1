/**
 * Parâmetros da Metodologia de Gestão de Portfólio (pesos, faixas, limites).
 *
 * Os valores padrão abaixo reproduzem o documento da metodologia e são idênticos a
 * provisioning/metodologia.json (verificado em test/parameters.test.ts). Em produção, as web parts
 * leem o arquivo publicado em SiteAssets e usam estes valores apenas para o que estiver ausente.
 */

export interface ICriterion {
  /** Nome interno da coluna da nota (1 a 5) na lista de iniciativas. */
  field: string;
  label: string;
  weight: number;
  /** Descrição da nota mínima e da nota máxima. */
  low: string;
  high: string;
}

export interface IIppBand {
  min: number;
  label: string;
  recommendation: string;
  color: string;
}

export interface IAuthorityLevel {
  label: string;
  decider: string;
  maxEffortHours?: number;
  maxCost?: number;
}

export interface IObjective {
  name: string;
  priority: boolean;
  active: boolean;
}

export interface IBalanceBand {
  label: string;
  /** Valores da coluna que pertencem à faixa (colunas de escolha). */
  values?: string[];
  /** Intervalo de notas que pertence à faixa (colunas numéricas, ex.: risco). */
  scoreMin?: number;
  scoreMax?: number;
  target?: number;
  min?: number;
  max?: number;
}

export interface IBalanceDimension {
  key: string;
  label: string;
  field: string;
  risk: string;
  bands: IBalanceBand[];
}

export interface IRange {
  min: number;
  max: number;
}

export interface IMethodologyParameters {
  version: string;
  scale: IRange;
  valueCriteria: ICriterion[];
  costRiskCriteria: ICriterion[];
  maxValueCriteria: number;
  riskCriterionField: string;
  divergenceThreshold: number;
  ippBands: IIppBand[];
  entry: { minimumEffortHours: number };
  selection: { minimumIpp: number; similarIppTolerance: number; reservePercent: number; wipLimitPerTeam: number };
  authority: {
    levels: IAuthorityLevel[];
    transversalImpactField: string;
    transversalImpactMin: number;
    newBudgetField: string;
    newBudgetMin: number;
  };
  monitoring: {
    cycleDays: number;
    reviewCycleDays: number;
    yellowDeviationPercent: number;
    redDeviationPercent: number;
    stalledCycles: number;
    highRiskScore: number;
    criticalRiskScore: number;
    costGrowthLimitPercent: number;
    delayedThresholdPercent: number;
  };
  indicators: {
    alignmentTarget: number;
    topQuartileInExecutionTarget: number;
    capacityCommitment: IRange;
    benefitsRealizedTarget: number;
    delayedMax: number;
    earlyTermination: IRange;
    riskMax: number;
    concentrationSharePercent: number;
    lowRiskLevel: number;
    innovationMinSharePercent: number;
  };
  objectives: IObjective[];
  teams: string[];
  categories: { nature: string[]; motivation: string[]; horizon: string[]; size: string[] };
  balance: IBalanceDimension[];
}

const criterion = (field: string, label: string, weight: number, low: string, high: string): ICriterion => ({
  field,
  label,
  weight,
  low,
  high
});

export const DEFAULT_PARAMETERS: IMethodologyParameters = {
  version: '1.0',
  scale: { min: 1, max: 5 },
  valueCriteria: [
    criterion('NotaAlinhamento', 'Alinhamento estratégico', 5, 'Vínculo indireto/frágil', 'Contribui diretamente para objetivo prioritário'),
    criterion('NotaValor', 'Valor / benefício esperado', 5, 'Benefício marginal ou incerto', 'Benefício alto, mensurável e provável'),
    criterion('NotaImpactoUsuarios', 'Impacto para usuários / clientes', 4, 'Afeta poucos, de forma leve', 'Afeta muitos, resolve dor relevante'),
    criterion('NotaIndicadores', 'Contribuição para indicadores estratégicos', 4, 'Não move indicadores', 'Move indicador crítico de forma relevante'),
    criterion('NotaImpactoOrganizacional', 'Impacto organizacional', 3, 'Restrito a uma equipe', 'Transversal, muda processos-chave'),
    criterion('NotaUrgencia', 'Urgência / custo do atraso', 3, 'Postergar não gera perda', 'Postergar gera perda ou risco significativo')
  ],
  costRiskCriteria: [
    criterion('NotaEsforco', 'Esforço / consumo de capacidade', 4, 'Pequeno, equipe única', 'Muito alto, várias equipes por longo período'),
    criterion('NotaCusto', 'Custo', 3, 'Baixo ou já orçado', 'Alto, exige novo orçamento'),
    criterion('NotaRisco', 'Risco', 3, 'Riscos baixos e conhecidos', 'Riscos altos, incerteza elevada'),
    criterion('NotaDependencias', 'Dependências', 2, 'Autossuficiente', 'Depende de terceiros ou de outras iniciativas críticas')
  ],
  maxValueCriteria: 8,
  riskCriterionField: 'NotaRisco',
  divergenceThreshold: 2,
  ippBands: [
    { min: 1.5, label: 'Alto retorno relativo', recommendation: 'Priorizar fortemente', color: '#1e6e4a' },
    { min: 1.0, label: 'Retorno favorável', recommendation: 'Selecionar conforme capacidade', color: '#2b88d8' },
    { min: 0.7, label: 'Retorno limítrofe', recommendation: 'Reavaliar escopo ou fasear', color: '#8a6100' },
    { min: 0, label: 'Consome mais do que entrega', recommendation: 'Postergar, redesenhar ou descartar', color: '#b3261e' }
  ],
  entry: { minimumEffortHours: 80 },
  selection: { minimumIpp: 0.7, similarIppTolerance: 0.1, reservePercent: 15, wipLimitPerTeam: 2 },
  authority: {
    levels: [
      { label: 'Pequeno porte', decider: 'Gestor do Portfólio + responsável de negócio', maxEffortHours: 160, maxCost: 50000 },
      { label: 'Médio porte', decider: 'Comitê de Portfólio', maxEffortHours: 2000, maxCost: 500000 },
      { label: 'Grande porte / estratégico', decider: 'Alta gestão, sob recomendação do Comitê' }
    ],
    transversalImpactField: 'NotaImpactoOrganizacional',
    transversalImpactMin: 4,
    newBudgetField: 'NotaCusto',
    newBudgetMin: 5
  },
  monitoring: {
    cycleDays: 30,
    reviewCycleDays: 90,
    yellowDeviationPercent: 10,
    redDeviationPercent: 30,
    stalledCycles: 2,
    highRiskScore: 4,
    criticalRiskScore: 5,
    costGrowthLimitPercent: 30,
    delayedThresholdPercent: 20
  },
  indicators: {
    alignmentTarget: 100,
    topQuartileInExecutionTarget: 80,
    capacityCommitment: { min: 80, max: 85 },
    benefitsRealizedTarget: 70,
    delayedMax: 20,
    earlyTermination: { min: 5, max: 15 },
    riskMax: 3.0,
    concentrationSharePercent: 50,
    lowRiskLevel: 2.0,
    innovationMinSharePercent: 15
  },
  objectives: [
    { name: 'Gestão e Governança', priority: true, active: true },
    { name: 'Eficiência Operacional', priority: true, active: true },
    { name: 'Transformação Digital', priority: true, active: true },
    { name: 'Serviços ao Cidadão', priority: true, active: true },
    { name: 'Desenvolvimento Institucional', priority: false, active: true }
  ],
  teams: ['CIPP – Projetos', 'CIPP – Processos', 'Tecnologia da Informação', 'Áreas de negócio'],
  categories: {
    nature: ['Projeto', 'Produto', 'Programa', 'Iniciativa estratégica', 'Melhoria'],
    motivation: ['Obrigatória (legal/regulatória)', 'Estratégica', 'Sustentação/continuidade', 'Eficiência', 'Inovação'],
    horizon: ['Curto (até 6 meses)', 'Médio (6 a 18 meses)', 'Longo (acima de 18 meses)'],
    size: ['Pequeno', 'Médio', 'Grande']
  },
  balance: [
    {
      key: 'horizon',
      label: 'Horizonte',
      field: 'Horizonte',
      risk: 'Só curto prazo: erosão da competitividade. Só longo: ausência de resultados visíveis',
      bands: [
        { label: 'Curto', values: ['Curto (até 6 meses)'], target: 50, min: 40, max: 60 },
        { label: 'Médio', values: ['Médio (6 a 18 meses)'], target: 35, min: 25, max: 45 },
        { label: 'Longo', values: ['Longo (acima de 18 meses)'], target: 15, min: 5, max: 25 }
      ]
    },
    {
      key: 'innovation',
      label: 'Inovação × sustentação',
      field: 'Motivacao',
      risk: 'Pouca sustentação: acúmulo de dívida técnica e falhas operacionais',
      bands: [
        { label: 'Inovação/novo', values: ['Inovação'], target: 30, min: 20, max: 40 },
        { label: 'Evolução', values: ['Estratégica', 'Eficiência'], target: 40, min: 30, max: 50 },
        { label: 'Sustentação', values: ['Sustentação/continuidade'], target: 30, min: 20, max: 40 }
      ]
    },
    {
      key: 'mandatory',
      label: 'Obrigatório × estratégico',
      field: 'Motivacao',
      risk: 'Obrigatório dominante: portfólio reativo, estratégia não avança',
      bands: [
        { label: 'Obrigatório', values: ['Obrigatória (legal/regulatória)'], max: 30 },
        { label: 'Estratégico', values: ['Estratégica', 'Inovação', 'Eficiência'], min: 50 }
      ]
    },
    {
      key: 'risk',
      label: 'Risco',
      field: 'NotaRisco',
      risk: 'Sem risco algum: nenhuma inovação. Muito risco: fragilidade da carteira',
      bands: [
        { label: 'Baixo/médio', scoreMin: 1, scoreMax: 3, min: 70, max: 80 },
        { label: 'Alto', scoreMin: 4, scoreMax: 5, min: 20, max: 30 }
      ]
    }
  ]
};

/**
 * Combina os parâmetros publicados com os padrões: cada chave de primeiro nível ausente (ou de tipo
 * inválido) usa o padrão; objetos simples são combinados campo a campo. Chaves iniciadas por "$"
 * (comentários) são ignoradas.
 */
export function mergeParameters(published: unknown): IMethodologyParameters {
  const result = JSON.parse(JSON.stringify(DEFAULT_PARAMETERS)) as IMethodologyParameters;
  if (!published || typeof published !== 'object' || Array.isArray(published)) {
    return result;
  }
  const source = published as Record<string, unknown>;
  const target = result as unknown as Record<string, unknown>;
  Object.keys(target).forEach((key) => {
    const value = source[key];
    const current = target[key];
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(current)) {
      if (Array.isArray(value) && value.length > 0) {
        target[key] = value;
      }
    } else if (current && typeof current === 'object') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        target[key] = { ...(current as object), ...stripComments(value as Record<string, unknown>) };
      }
    } else if (typeof value === typeof current) {
      target[key] = value;
    }
  });
  return result;
}

function stripComments(value: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  Object.keys(value).forEach((key) => {
    if (key.charAt(0) !== '$') {
      copy[key] = value[key];
    }
  });
  return copy;
}

/** Valida a coerência dos parâmetros (regras da seção 5.6). Retorna as mensagens de problema. */
export function validateParameters(params: IMethodologyParameters): string[] {
  const problems: string[] = [];
  if (params.valueCriteria.length === 0 || params.costRiskCriteria.length === 0) {
    problems.push('É necessário ao menos um critério de valor e um de custo, esforço e risco.');
  }
  if (params.valueCriteria.length > params.maxValueCriteria) {
    problems.push(
      `Há ${params.valueCriteria.length} critérios de valor; o máximo recomendado é ${params.maxValueCriteria} (modelos maiores perdem discriminação).`
    );
  }
  const fields = params.valueCriteria.concat(params.costRiskCriteria).map((c) => c.field);
  fields.forEach((field, index) => {
    if (fields.indexOf(field) !== index) {
      problems.push(`A coluna ${field} está repetida em mais de um critério.`);
    }
  });
  params.valueCriteria.concat(params.costRiskCriteria).forEach((c) => {
    if (!(c.weight > 0)) {
      problems.push(`O critério "${c.label}" precisa de peso maior que zero.`);
    }
  });
  if (fields.indexOf(params.riskCriterionField) < 0) {
    problems.push(`A coluna de risco (${params.riskCriterionField}) não corresponde a nenhum critério.`);
  }
  return problems;
}
