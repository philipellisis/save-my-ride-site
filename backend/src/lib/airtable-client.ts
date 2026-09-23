const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

interface AirtableListResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

function getConfig() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_AUTOWORK_BASE_ID;
  const tableId = process.env.AIRTABLE_AUTOWORK_TABLE_ID;
  if (!apiKey || !baseId || !tableId) {
    throw new Error('Missing AIRTABLE_API_KEY, AIRTABLE_AUTOWORK_BASE_ID, or AIRTABLE_AUTOWORK_TABLE_ID');
  }
  return { apiKey, baseId, tableId };
}

async function airtableFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = getConfig();
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export interface FutureWorkFields {
  ScheduledWorkDate?: string;
  QuotedHours?: number;
  State?: string;
}

/** Fetches every Work record scheduled at or after now, paging through results. */
export async function listFutureWorkRecords(): Promise<AirtableRecord<FutureWorkFields>[]> {
  const { baseId, tableId } = getConfig();
  const records: AirtableRecord<FutureWorkFields>[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set('filterByFormula', 'IS_AFTER({ScheduledWorkDate}, NOW())');
    params.append('fields[]', 'ScheduledWorkDate');
    params.append('fields[]', 'QuotedHours');
    params.append('fields[]', 'State');
    if (offset) params.set('offset', offset);

    const data = await airtableFetch<AirtableListResponse<FutureWorkFields>>(
      `${AIRTABLE_API_BASE}/${baseId}/${tableId}?${params.toString()}`
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export interface CreateWorkFields {
  CustomerName: string;
  CustomerContactInfo: string;
  CustomerAddress?: string;
  Year: number;
  Make: string;
  Model: string;
  ScheduledWorkDate: string;
  QuotedHours: number;
  QuotedAmount: number;
  State: 'Pending';
  Notes: string;
}

export async function createWorkRecord(fields: CreateWorkFields): Promise<string> {
  const { baseId, tableId } = getConfig();
  const data = await airtableFetch<AirtableRecord<CreateWorkFields>>(`${AIRTABLE_API_BASE}/${baseId}/${tableId}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  return data.id;
}
