import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';
import {
  decisionEffect,
  emptyStored,
  ICapacityRow,
  IDecisionRecord,
  IInitiative,
  IMethodologyParameters,
  IModelFieldValues,
  IPortfolioInput,
  IScoreSheet,
  mergeParameters
} from '../../methodology';
import { CAPACITY_FIELDS, DECISION_FIELDS, INITIATIVE_FIELDS as F, IPortfolioSource, SCORE_SHEET_FIELDS } from './fields';

type Row = Record<string, unknown>;

const PAGE_SIZE = 5000;
const READ_HEADERS = { Accept: 'application/json;odata=nometadata' };
const WRITE_HEADERS = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' };

export interface IListLinks {
  displayForm?: string;
  newForm?: string;
  view?: string;
}

export class ListNotFoundError extends Error {
  public constructor(public readonly listTitle: string) {
    super(`A lista "${listTitle}" não foi encontrada neste site.`);
    // Necessário para instanceof com compilação para ES5.
    Object.setPrototypeOf(this, ListNotFoundError.prototype);
    this.name = 'ListNotFoundError';
  }
}

/** Leitura e gravação das listas do portfólio via REST do SharePoint. */
export class PortfolioRepository {
  public constructor(
    private readonly client: SPHttpClient,
    private readonly webUrl: string,
    private readonly source: IPortfolioSource
  ) {}

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  /** Lê metodologia.json; na ausência do arquivo, usa os padrões do documento. */
  public async loadParameters(): Promise<{ params: IMethodologyParameters; warning?: string }> {
    const path = (this.source.parametersUrl ?? '').trim();
    if (!path) {
      return { params: mergeParameters(undefined) };
    }
    const url = /^https?:\/\//i.test(path) ? path : path.charAt(0) === '/' ? `${new URL(this.webUrl).origin}${path}` : `${this.webUrl}/${path}`;
    try {
      const response = await this.client.get(url, SPHttpClient.configurations.v1, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        return { params: mergeParameters(undefined), warning: `Parâmetros não encontrados em ${path} (HTTP ${response.status}); usando os valores padrão da metodologia.` };
      }
      return { params: mergeParameters(await response.json()) };
    } catch {
      return { params: mergeParameters(undefined), warning: `Não foi possível ler ${path}; usando os valores padrão da metodologia.` };
    }
  }

  /** URLs dos formulários e da exibição padrão da lista de iniciativas. */
  public async loadListLinks(): Promise<IListLinks> {
    const url = `${this.listUrl(this.source.initiativesList)}?$select=DefaultDisplayFormUrl,DefaultNewFormUrl,DefaultViewUrl`;
    const response = await this.client.get(url, SPHttpClient.configurations.v1, { headers: READ_HEADERS });
    if (response.status === 404) {
      throw new ListNotFoundError(this.source.initiativesList);
    }
    if (!response.ok) {
      return {};
    }
    const list: Row = await response.json();
    const origin = new URL(this.webUrl).origin;
    const absolute = (value: unknown): string | undefined => (value ? `${origin}${String(value)}` : undefined);
    return {
      displayForm: absolute(list.DefaultDisplayFormUrl),
      newForm: absolute(list.DefaultNewFormUrl),
      view: absolute(list.DefaultViewUrl)
    };
  }

  public async loadInput(params: IMethodologyParameters): Promise<IPortfolioInput> {
    const [initiatives, capacity, decisions, scoreSheets] = await Promise.all([
      this.loadInitiatives(params),
      this.loadOptional(this.source.capacityList, () => this.loadCapacity()),
      this.loadOptional(this.source.decisionsList, () => this.loadDecisions()),
      this.loadOptional(this.source.scoresList, () => this.loadScoreSheets(params))
    ]);
    return { initiatives, capacity, decisions, scoreSheets };
  }

  public async loadInitiatives(params: IMethodologyParameters): Promise<IInitiative[]> {
    const criteria = params.valueCriteria.concat(params.costRiskCriteria).map((c) => c.field);
    const simple = [
      'Id', 'Created', F.title, F.code, F.status, F.unit, F.team, F.problem, F.solution, F.expectedBenefit, F.benefitIndicator,
      F.objective, F.nature, F.motivation, F.horizon, F.size, F.effortHours, F.cycleEffortHours, F.cost, F.durationMonths,
      F.feasibility, F.legalObligation, F.legalDeadline, F.criticalDependencyBlocked, F.riskResponseDefined, F.capacityAllocated,
      F.authorizedOn, F.plannedStart, F.baselineEnd, F.projectedEnd, F.approvedCost, F.projectedCost, F.progress, F.lastDeliveryOn,
      F.benefitCompromised, F.benefitRealized, F.lastDecision, F.lastDecisionOn, F.rank, F.ippBand, F.trafficLight, F.alerts,
      F.suggestion, F.authority, `${F.dependencies}Id`, `${F.businessOwner}/Title`, `${F.initiativeManager}/Title`
    ].concat(criteria);
    const query = `$select=${simple.join(',')}&$expand=${F.businessOwner},${F.initiativeManager}`;
    const rows = await this.readAll(this.source.initiativesList, query);

    return rows.map((row) => {
      const scores: Record<string, number | undefined> = {};
      criteria.forEach((field) => {
        scores[field] = num(row[field]);
      });
      return {
        id: row.Id as number,
        code: text(row[F.code]),
        title: text(row[F.title]),
        status: text(row[F.status]),
        created: date(row.Created) ?? new Date(),
        businessOwner: person(row[F.businessOwner]),
        initiativeManager: person(row[F.initiativeManager]),
        unit: text(row[F.unit]),
        team: text(row[F.team]),
        problem: text(row[F.problem]),
        solution: text(row[F.solution]),
        expectedBenefit: text(row[F.expectedBenefit]),
        benefitIndicator: text(row[F.benefitIndicator]),
        objective: text(row[F.objective]),
        nature: text(row[F.nature]),
        motivation: text(row[F.motivation]),
        horizon: text(row[F.horizon]),
        size: text(row[F.size]),
        effortHours: num(row[F.effortHours]),
        cycleEffortHours: num(row[F.cycleEffortHours]),
        cost: num(row[F.cost]),
        durationMonths: num(row[F.durationMonths]),
        feasibility: text(row[F.feasibility]),
        legalObligation: row[F.legalObligation] === true,
        legalDeadline: date(row[F.legalDeadline]),
        scores,
        dependencyIds: ids(row[`${F.dependencies}Id`]),
        criticalDependencyBlocked: row[F.criticalDependencyBlocked] === true,
        riskResponseDefined: row[F.riskResponseDefined] === true,
        capacityAllocated: row[F.capacityAllocated] === true,
        authorizedOn: date(row[F.authorizedOn]),
        plannedStart: date(row[F.plannedStart]),
        baselineEnd: date(row[F.baselineEnd]),
        projectedEnd: date(row[F.projectedEnd]),
        approvedCost: num(row[F.approvedCost]),
        projectedCost: num(row[F.projectedCost]),
        progress: num(row[F.progress]),
        lastDeliveryOn: date(row[F.lastDeliveryOn]),
        benefitCompromised: row[F.benefitCompromised] === true,
        benefitRealized: num(row[F.benefitRealized]),
        lastDecision: text(row[F.lastDecision]),
        lastDecisionOn: date(row[F.lastDecisionOn]),
        stored: {
          ...emptyStored(),
          rank: num(row[F.rank]),
          ippBand: text(row[F.ippBand]),
          trafficLight: text(row[F.trafficLight]),
          alerts: text(row[F.alerts]),
          suggestion: text(row[F.suggestion]),
          authority: text(row[F.authority])
        }
      };
    });
  }

  public async loadCapacity(): Promise<ICapacityRow[]> {
    const c = CAPACITY_FIELDS;
    const rows = await this.readAll(
      this.source.capacityList,
      `$select=Id,${c.cycle},${c.team},${c.total},${c.sustainment},${c.reservePercent},${c.wipLimit}`
    );
    return rows.map((row) => ({
      id: row.Id as number,
      cycle: text(row[c.cycle]),
      team: text(row[c.team]),
      total: num(row[c.total]) ?? 0,
      sustainment: num(row[c.sustainment]) ?? 0,
      reservePercent: num(row[c.reservePercent]),
      wipLimit: num(row[c.wipLimit])
    }));
  }

  public async loadDecisions(): Promise<IDecisionRecord[]> {
    const d = DECISION_FIELDS;
    const rows = await this.readAll(
      this.source.decisionsList,
      `$select=Id,Created,${d.initiative}Id,${d.decisionPoint},${d.decision},${d.justification},${d.body},${d.date},${d.previousStatus},${d.newStatus}&$orderby=Id desc`
    );
    return rows.map((row) => ({
      id: row.Id as number,
      initiativeId: num(row[`${d.initiative}Id`]) ?? 0,
      decisionPoint: text(row[d.decisionPoint]),
      decision: text(row[d.decision]),
      justification: text(row[d.justification]),
      body: text(row[d.body]),
      date: date(row[d.date]) ?? date(row.Created) ?? new Date(),
      previousStatus: text(row[d.previousStatus]),
      newStatus: text(row[d.newStatus])
    }));
  }

  public async loadScoreSheets(params: IMethodologyParameters): Promise<IScoreSheet[]> {
    const criteria = params.valueCriteria.concat(params.costRiskCriteria).map((c) => c.field);
    const rows = await this.readAll(
      this.source.scoresList,
      `$select=Id,${SCORE_SHEET_FIELDS.initiative}Id,Author/Title,${criteria.join(',')}&$expand=Author`
    );
    return rows.map((row) => {
      const scores: Record<string, number | undefined> = {};
      criteria.forEach((field) => {
        scores[field] = num(row[field]);
      });
      return { initiativeId: num(row[`${SCORE_SHEET_FIELDS.initiative}Id`]) ?? 0, evaluator: person(row.Author), scores };
    });
  }

  // -------------------------------------------------------------------------
  // Gravação
  // -------------------------------------------------------------------------

  /**
   * Registra uma decisão: grava no Registro de Decisões e atualiza a iniciativa (situação, última
   * decisão e os campos atualizados automaticamente pela decisão, como data de autorização e linha de base).
   */
  public async recordDecision(
    item: IInitiative,
    pointKey: string,
    pointLabel: string,
    decision: string,
    body: string,
    justification: string,
    today: Date = new Date()
  ): Promise<void> {
    const effect = decisionEffect(item, pointKey, decision, today);
    const d = DECISION_FIELDS;
    await this.post(this.itemsUrl(this.source.decisionsList), {
      [d.title]: `${decision} – ${item.code || `#${item.id}`} ${item.title}`.substring(0, 255),
      [`${d.initiative}Id`]: item.id,
      [d.decisionPoint]: pointLabel,
      [d.decision]: decision,
      [d.justification]: justification,
      [d.body]: body,
      [d.date]: today.toISOString(),
      [d.previousStatus]: item.status,
      [d.newStatus]: effect.newStatus
    });

    const values: Row = {
      [F.status]: effect.newStatus,
      [F.lastDecision]: `${decision} (${pointLabel})`.substring(0, 255),
      [F.lastDecisionJustification]: justification,
      [F.lastDecisionOn]: today.toISOString()
    };
    const u = effect.updates;
    if (u.authorizedOn) {
      values[F.authorizedOn] = u.authorizedOn.toISOString();
    }
    if (u.approvedCost !== undefined) {
      values[F.approvedCost] = u.approvedCost;
    }
    if (u.baselineEnd) {
      values[F.baselineEnd] = u.baselineEnd.toISOString();
    }
    if (u.progress !== undefined) {
      values[F.progress] = u.progress;
    }
    await this.updateItem(this.source.initiativesList, item.id, values);
  }

  /** Grava as notas consolidadas (mediana das avaliações) na iniciativa. */
  public async applyScores(itemId: number, scores: Record<string, number>): Promise<void> {
    await this.updateItem(this.source.initiativesList, itemId, { ...scores });
  }

  /** Grava os campos calculados pelo modelo (ranking, semáforo, alertas, sugestão, alçada e código). */
  public async writeModelFields(itemId: number, values: IModelFieldValues, now: Date = new Date()): Promise<void> {
    const row: Row = {
      // null limpa a coluna no SharePoint.
      [F.rank]: values.rank ?? null,
      [F.ippBand]: values.ippBand,
      [F.trafficLight]: values.trafficLight || null,
      [F.alerts]: values.alerts,
      [F.suggestion]: values.suggestion.substring(0, 255),
      [F.authority]: values.authority.substring(0, 255),
      [F.modelUpdatedOn]: now.toISOString()
    };
    if (values.code) {
      row[F.code] = values.code;
    }
    if (values.status) {
      row[F.status] = values.status;
    }
    await this.updateItem(this.source.initiativesList, itemId, row);
  }

  // -------------------------------------------------------------------------
  // REST
  // -------------------------------------------------------------------------

  private listUrl(listTitle: string): string {
    return `${this.webUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle.replace(/'/g, "''"))}')`;
  }

  private itemsUrl(listTitle: string): string {
    return `${this.listUrl(listTitle)}/items`;
  }

  private async readAll(listTitle: string, query: string): Promise<Row[]> {
    let url: string | undefined = `${this.itemsUrl(listTitle)}?${query}&$top=${PAGE_SIZE}`;
    const rows: Row[] = [];
    while (url) {
      const response: SPHttpClientResponse = await this.client.get(url, SPHttpClient.configurations.v1, { headers: READ_HEADERS });
      if (response.status === 404) {
        throw new ListNotFoundError(listTitle);
      }
      if (!response.ok) {
        throw new Error(await errorMessage(response, `Falha ao ler a lista "${listTitle}"`));
      }
      const page: { value: Row[]; 'odata.nextLink'?: string } = await response.json();
      page.value.forEach((row) => rows.push(row));
      url = page['odata.nextLink'];
    }
    return rows;
  }

  /** Listas complementares (capacidade, decisões, pontuações) podem não existir: retorna vazio. */
  private async loadOptional<T>(listTitle: string, load: () => Promise<T[]>): Promise<T[]> {
    if (!listTitle) {
      return [];
    }
    try {
      return await load();
    } catch (error) {
      if (error instanceof ListNotFoundError) {
        return [];
      }
      throw error;
    }
  }

  private async post(url: string, body: Row): Promise<void> {
    const response = await this.client.post(url, SPHttpClient.configurations.v1, { headers: WRITE_HEADERS, body: JSON.stringify(body) });
    if (!response.ok) {
      throw new Error(await errorMessage(response, 'Falha ao gravar'));
    }
  }

  private async updateItem(listTitle: string, id: number, body: Row): Promise<void> {
    const response = await this.client.post(`${this.itemsUrl(listTitle)}(${id})`, SPHttpClient.configurations.v1, {
      headers: { ...WRITE_HEADERS, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await errorMessage(response, `Falha ao atualizar o item ${id} da lista "${listTitle}"`));
    }
  }
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

async function errorMessage(response: SPHttpClientResponse, prefix: string): Promise<string> {
  try {
    const body = await response.json();
    const message = body?.['odata.error']?.message?.value ?? body?.error?.message;
    if (message) {
      return `${prefix}: ${message}`;
    }
  } catch {
    // corpo sem JSON
  }
  return response.status === 403 ? `${prefix}: sem permissão de edição.` : `${prefix} (HTTP ${response.status}).`;
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'Label' in (value as Row)) {
    return String((value as Row).Label ?? '').trim();
  }
  return String(value).trim();
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? undefined : parsed;
}

function date(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function person(value: unknown): string {
  return value && typeof value === 'object' ? text((value as Row).Title) : '';
}

function ids(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((id) => typeof id === 'number') as number[];
  }
  if (value && typeof value === 'object' && Array.isArray((value as Row).results)) {
    return ids((value as Row).results);
  }
  return typeof value === 'number' ? [value] : [];
}
