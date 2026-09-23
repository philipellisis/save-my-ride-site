import { createHash } from 'node:crypto';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { client, tableName } from './dynamo';
import type { RawRepairEstimate } from '../types/domain';

const QUOTE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — repair pricing drifts, don't cache forever

export interface QuoteCacheKey {
  year: number;
  make: string;
  model: string;
  repairKey: string;
  freeformDescription?: string;
}

function buildCacheKey(key: QuoteCacheKey): string {
  // Freeform text only matters for "other" — catalog repairs ignore it so all requests for the
  // same vehicle/repair combo share a cache entry regardless of stray whitespace/case.
  const freeform = key.repairKey === 'other' ? (key.freeformDescription ?? '').trim().toLowerCase() : '';
  const normalized = [key.year, key.make.trim().toLowerCase(), key.model.trim().toLowerCase(), key.repairKey, freeform].join(
    '|'
  );
  return createHash('sha256').update(normalized).digest('hex');
}

export async function getCachedQuote(key: QuoteCacheKey): Promise<RawRepairEstimate | undefined> {
  const hash = buildCacheKey(key);
  const res = await client.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `QUOTE#${hash}`, SK: `QUOTE#${hash}` } })
  );
  if (!res.Item) return undefined;

  return {
    estimatedHours: res.Item.estimatedHours,
    partsCostLow: res.Item.partsCostLow,
    partsCostHigh: res.Item.partsCostHigh,
    explanation: res.Item.explanation,
  };
}

export async function saveQuote(key: QuoteCacheKey, quote: RawRepairEstimate): Promise<void> {
  const hash = buildCacheKey(key);
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `QUOTE#${hash}`,
        SK: `QUOTE#${hash}`,
        year: key.year,
        make: key.make,
        model: key.model,
        repairKey: key.repairKey,
        freeformDescription: key.freeformDescription ?? null,
        estimatedHours: quote.estimatedHours,
        partsCostLow: quote.partsCostLow,
        partsCostHigh: quote.partsCostHigh,
        explanation: quote.explanation,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS,
      },
    })
  );
}
