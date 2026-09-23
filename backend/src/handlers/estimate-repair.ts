import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getRepairEstimate } from '../lib/bedrock';
import { findRepair, repairCatalog } from '../lib/repair-catalog';
import { isPreflight, jsonResponse, preflightResponse } from '../lib/http';
import type { EstimateRequestBody } from '../types/domain';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (isPreflight(event)) return preflightResponse(event);

  try {
    const body = JSON.parse(event.body ?? '{}') as Partial<EstimateRequestBody>;

    if (!body.year || !body.make || !body.model || !body.repairKey) {
      return badRequest(event, 'year, make, model, and repairKey are required');
    }

    const repair = findRepair(body.repairKey);
    if (!repair) {
      return badRequest(event, `Unknown repairKey: ${body.repairKey}`);
    }
    if (repair.key === 'other' && !body.freeformDescription?.trim()) {
      return badRequest(event, 'freeformDescription is required when repairKey is "other"');
    }

    const estimate = await getRepairEstimate({
      year: body.year,
      make: body.make,
      model: body.model,
      repairLabel: repair.label,
      baselineHours: repair.baselineHours,
      freeformDescription: body.freeformDescription,
      shopRatePerHour: repairCatalog.shopRatePerHour,
    });

    return jsonResponse(event, 200, estimate);
  } catch (err) {
    console.error('estimate-repair failed', err);
    return jsonResponse(event, 500, { message: 'Failed to generate estimate' });
  }
};

function badRequest(event: APIGatewayProxyEventV2, message: string) {
  return jsonResponse(event, 400, { message });
}
