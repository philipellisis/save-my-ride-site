import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { client, tableName } from './dynamo';

const HOURLY_AI_CALL_LIMIT = 20;

/**
 * Fixed-window rate limit on real Bedrock calls (cache hits don't count). Atomically increments
 * a per-hour counter in DynamoDB and reports whether this call is still within budget. A slight
 * over-count right at the window boundary is fine here — this is abuse prevention, not billing.
 */
export async function isWithinAiRateLimit(): Promise<boolean> {
  const hourBucket = new Date().toISOString().slice(0, 13); // e.g. "2026-09-23T14"
  const key = { PK: `RATE#bedrock#${hourBucket}`, SK: `RATE#bedrock#${hourBucket}` };
  const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // clean up well after the hour ends

  const res = await client.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: key,
      UpdateExpression: 'ADD callCount :one SET expiresAt = if_not_exists(expiresAt, :expiresAt)',
      ExpressionAttributeValues: { ':one': 1, ':expiresAt': expiresAt },
      ReturnValues: 'UPDATED_NEW',
    })
  );

  const count = (res.Attributes?.callCount as number | undefined) ?? 0;
  return count <= HOURLY_AI_CALL_LIMIT;
}
