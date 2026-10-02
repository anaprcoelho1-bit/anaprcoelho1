import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';

export interface IInitiativeRow {
  status: string;
  objective: string;
}

interface IListItemsResponse {
  value: Record<string, unknown>[];
  'odata.nextLink'?: string;
}

const PAGE_SIZE = 5000;

/** Lê Situação e Objetivo estratégico de todas as iniciativas da lista (com paginação). */
export async function loadInitiatives(
  client: SPHttpClient,
  webUrl: string,
  listTitle: string,
  statusField: string,
  objectiveField: string
): Promise<IInitiativeRow[]> {
  const list = encodeURIComponent(listTitle.replace(/'/g, "''"));
  const select = [statusField, objectiveField].map(encodeURIComponent).join(',');
  let url: string | undefined = `${webUrl}/_api/web/lists/getbytitle('${list}')/items?$select=${select}&$top=${PAGE_SIZE}`;
  const rows: IInitiativeRow[] = [];

  while (url) {
    const response: SPHttpClientResponse = await client.get(url, SPHttpClient.configurations.v1, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'not-found' : `HTTP ${response.status}`);
    }
    const page: IListItemsResponse = await response.json();
    page.value.forEach((item) => {
      rows.push({ status: asText(item[statusField]), objective: asText(item[objectiveField]) });
    });
    url = page['odata.nextLink'];
  }

  return rows;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'Label' in (value as Record<string, unknown>)) {
    // Campo de metadados gerenciados.
    return String((value as Record<string, unknown>).Label ?? '').trim();
  }
  return String(value).trim();
}
