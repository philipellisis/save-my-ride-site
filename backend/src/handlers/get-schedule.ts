import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { listFutureWorkRecords } from '../lib/airtable-client';
import { getLastSyncedAt, markSynced, replaceFutureAppointments, queryFutureAppointments } from '../lib/dynamo';
import { DEFAULT_BUSINESS_HOURS } from '../lib/availability';
import { isPreflight, jsonResponse, preflightResponse } from '../lib/http';
import type { ScheduleResponse } from '../types/domain';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (isPreflight(event)) return preflightResponse(event);

  try {
    const days = Number(event.queryStringParameters?.days ?? '14');

    const lastSyncedAt = await getLastSyncedAt();
    const isStale = !lastSyncedAt || Date.now() - lastSyncedAt.getTime() > SYNC_INTERVAL_MS;

    if (isStale) {
      await syncFromAirtable();
    }

    const busyIntervals = await queryFutureAppointments(days);

    const body: ScheduleResponse = {
      businessHours: DEFAULT_BUSINESS_HOURS,
      busyIntervals,
      syncedAt: (isStale ? new Date() : lastSyncedAt!).toISOString(),
    };

    return jsonResponse(event, 200, body);
  } catch (err) {
    console.error('get-schedule failed', err);
    return jsonResponse(event, 500, { message: 'Failed to load schedule' });
  }
};

async function syncFromAirtable(): Promise<void> {
  const records = await listFutureWorkRecords();
  const appointments = records
    .filter((r) => r.fields.ScheduledWorkDate)
    .map((r) => ({
      recordId: r.id,
      scheduledWorkDate: r.fields.ScheduledWorkDate as string,
      estimatedHours: r.fields.QuotedHours ?? 1,
    }));

  await replaceFutureAppointments(appointments);
  await markSynced(new Date());
}
