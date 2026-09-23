import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { BusyInterval } from '../types/domain';

export const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('Missing TABLE_NAME env var');
  return name;
}

const SYNC_META_KEY = { PK: 'META#SYNC', SK: 'META#SYNC' };

export async function getLastSyncedAt(): Promise<Date | undefined> {
  const res = await client.send(new GetCommand({ TableName: tableName(), Key: SYNC_META_KEY }));
  const value = res.Item?.lastSyncedAt as string | undefined;
  return value ? new Date(value) : undefined;
}

export async function markSynced(now: Date): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: { ...SYNC_META_KEY, lastSyncedAt: now.toISOString() },
    })
  );
}

export interface FutureAppointmentInput {
  recordId: string;
  scheduledWorkDate: string;
  estimatedHours: number;
}

/** Replaces the cached set of future appointments synced from Airtable. */
export async function replaceFutureAppointments(appointments: FutureAppointmentInput[]): Promise<void> {
  if (appointments.length === 0) return;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const chunks: FutureAppointmentInput[][] = [];
  for (let i = 0; i < appointments.length; i += 25) {
    chunks.push(appointments.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName()]: chunk.map((appt) => ({
            PutRequest: {
              Item: appointmentItem(appt, nowSeconds),
            },
          })),
        },
      })
    );
  }
}

export async function putAppointment(appt: FutureAppointmentInput): Promise<void> {
  await client.send(
    new PutCommand({ TableName: tableName(), Item: appointmentItem(appt, Math.floor(Date.now() / 1000)) })
  );
}

function appointmentItem(appt: FutureAppointmentInput, nowSeconds: number) {
  const scheduledMs = new Date(appt.scheduledWorkDate).getTime();
  const expiresAt = Math.floor(scheduledMs / 1000) + appt.estimatedHours * 3600 + 3600; // +1hr buffer past job end
  return {
    PK: `APPT#${appt.recordId}`,
    SK: `APPT#${appt.recordId}`,
    GSI1PK: 'SCHEDULE',
    GSI1SK: `${appt.scheduledWorkDate}#${appt.recordId}`,
    recordId: appt.recordId,
    scheduledWorkDate: appt.scheduledWorkDate,
    estimatedHours: appt.estimatedHours,
    expiresAt: Math.max(expiresAt, nowSeconds + 60),
  };
}

/** Queries future appointments between now and `now + days`, sorted by start time. */
export async function queryFutureAppointments(days: number): Promise<BusyInterval[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const res = await client.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'ScheduleIndex',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': 'SCHEDULE',
        ':start': `${now.toISOString()}#`,
        ':end': `${horizon.toISOString()}#￿`,
      },
    })
  );

  return (res.Items ?? []).map((item) => {
    const startMs = new Date(item.scheduledWorkDate as string).getTime();
    const endMs = startMs + (item.estimatedHours as number) * 3600 * 1000;
    return {
      recordId: item.recordId as string,
      start: item.scheduledWorkDate as string,
      end: new Date(endMs).toISOString(),
    };
  });
}
