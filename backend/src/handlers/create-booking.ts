import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createWorkRecord } from '../lib/airtable-client';
import { putAppointment, queryFutureAppointments } from '../lib/dynamo';
import { hasConflict } from '../lib/availability';
import { findRepair } from '../lib/repair-catalog';
import { isPreflight, jsonResponse, preflightResponse } from '../lib/http';
import type { BookingRequestBody } from '../types/domain';

const CONFLICT_CHECK_WINDOW_DAYS = 60;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (isPreflight(event)) return preflightResponse(event);

  try {
    const body = JSON.parse(event.body ?? '{}') as Partial<BookingRequestBody>;

    const missing = [
      'customerName',
      'customerContactInfo',
      'year',
      'make',
      'model',
      'repairKey',
      'scheduledWorkDate',
      'estimate',
    ].filter((key) => !(body as Record<string, unknown>)[key]);

    if (missing.length > 0) {
      return badRequest(event, `Missing required fields: ${missing.join(', ')}`);
    }

    const repair = findRepair(body.repairKey!);
    if (!repair) {
      return badRequest(event, `Unknown repairKey: ${body.repairKey}`);
    }

    const estimatedHours = body.estimate!.estimatedHours;

    const busyIntervals = await queryFutureAppointments(CONFLICT_CHECK_WINDOW_DAYS);
    if (hasConflict(body.scheduledWorkDate!, estimatedHours, busyIntervals)) {
      return jsonResponse(event, 409, { message: 'That time slot was just booked. Please pick another.' });
    }

    const repairDescription =
      repair.key === 'other' ? body.freeformDescription ?? 'Other (no description provided)' : repair.label;

    const notes = [
      `Requested repair: ${repairDescription}`,
      '',
      '--- AI Estimate Reasoning ---',
      body.estimate!.explanation,
      `Estimated: ${estimatedHours}h labor, parts $${body.estimate!.partsCostLow}-$${body.estimate!.partsCostHigh}, total $${body.estimate!.totalLow}-$${body.estimate!.totalHigh}`,
    ].join('\n');

    const recordId = await createWorkRecord({
      CustomerName: body.customerName!,
      CustomerContactInfo: body.customerContactInfo!,
      CustomerAddress: body.customerAddress,
      Year: body.year!,
      Make: body.make!,
      Model: body.model!,
      ScheduledWorkDate: body.scheduledWorkDate!,
      QuotedHours: estimatedHours,
      QuotedAmount: Math.round(((body.estimate!.totalLow + body.estimate!.totalHigh) / 2) * 100) / 100,
      State: 'Pending',
      Notes: notes,
    });

    await putAppointment({
      recordId,
      scheduledWorkDate: body.scheduledWorkDate!,
      estimatedHours,
    });

    return jsonResponse(event, 201, { recordId });
  } catch (err) {
    console.error('create-booking failed', err);
    return jsonResponse(event, 500, { message: 'Failed to create booking' });
  }
};

function badRequest(event: APIGatewayProxyEventV2, message: string) {
  return jsonResponse(event, 400, { message });
}
