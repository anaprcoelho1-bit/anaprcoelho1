/**
 * Nomes internos das colunas das listas do portfólio. Devem coincidir com
 * provisioning/gestao-portfolio.config.json (as colunas das notas vêm de metodologia.json).
 */
export const INITIATIVE_FIELDS = {
  title: 'Title',
  code: 'Codigo',
  status: 'Situacao',
  businessOwner: 'ResponsavelNegocio',
  initiativeManager: 'GestorIniciativa',
  unit: 'UnidadeDemandante',
  team: 'Equipe',
  problem: 'Descricao',
  solution: 'SolucaoProposta',
  expectedBenefit: 'BeneficioEsperado',
  benefitIndicator: 'IndicadorBeneficio',
  objective: 'ObjetivoEstrategico',
  nature: 'Natureza',
  motivation: 'Motivacao',
  horizon: 'Horizonte',
  size: 'Porte',
  effortHours: 'EsforcoEstimado',
  cycleEffortHours: 'EsforcoCiclo',
  cost: 'CustoEstimado',
  durationMonths: 'DuracaoMeses',
  feasibility: 'Viabilidade',
  legalObligation: 'ObrigacaoLegal',
  legalDeadline: 'PrazoLegal',
  dependencies: 'Dependencias',
  criticalDependencyBlocked: 'DependenciaBloqueada',
  riskResponseDefined: 'RespostaRiscoDefinida',
  capacityAllocated: 'CapacidadeAlocada',
  authorizedOn: 'DataAutorizacao',
  plannedStart: 'InicioPrevisto',
  baselineEnd: 'TerminoPrevisto',
  projectedEnd: 'TerminoProjetado',
  approvedCost: 'CustoAprovado',
  projectedCost: 'CustoProjetado',
  progress: 'PercentualConcluido',
  lastDeliveryOn: 'DataUltimaEntrega',
  benefitCompromised: 'BeneficioComprometido',
  benefitRealized: 'BeneficioRealizado',
  lastDecision: 'UltimaDecisao',
  lastDecisionJustification: 'JustificativaDecisao',
  lastDecisionOn: 'DataUltimaDecisao',
  // Gravadas pelo modelo
  rank: 'PosicaoRanking',
  ippBand: 'LeituraIPP',
  trafficLight: 'Semaforo',
  alerts: 'AlertasModelo',
  suggestion: 'SugestaoModelo',
  authority: 'Alcada',
  modelUpdatedOn: 'AtualizadoModelo'
};

export const DECISION_FIELDS = {
  title: 'Title',
  initiative: 'Iniciativa',
  decisionPoint: 'PontoDecisao',
  decision: 'Decisao',
  justification: 'Justificativa',
  body: 'Instancia',
  date: 'DataDecisao',
  previousStatus: 'SituacaoAnterior',
  newStatus: 'SituacaoNova'
};

export const CAPACITY_FIELDS = {
  cycle: 'Title',
  team: 'Equipe',
  total: 'CapacidadeTotal',
  sustainment: 'Sustentacao',
  reservePercent: 'ReservaPercentual',
  wipLimit: 'LimiteWIP'
};

export const SCORE_SHEET_FIELDS = {
  initiative: 'Iniciativa'
};

export interface IPortfolioSource {
  /** URL (relativa ao servidor ou absoluta) do arquivo metodologia.json publicado. Vazio usa os padrões. */
  parametersUrl: string;
  initiativesList: string;
  decisionsList: string;
  capacityList: string;
  scoresList: string;
  /** Ciclo de capacidade (ex.: 2026-T4). Vazio usa o trimestre atual. */
  cycle: string;
}

export const DEFAULT_SOURCE: IPortfolioSource = {
  parametersUrl: 'SiteAssets/gestao-portfolio/metodologia.json',
  initiativesList: 'Iniciativas',
  decisionsList: 'Registro de Decisões',
  capacityList: 'Mapa de Capacidade',
  scoresList: 'Pontuações do Comitê',
  cycle: ''
};
