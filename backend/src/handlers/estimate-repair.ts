import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getAiRepairEstimate } from '../lib/bedrock';
import { findRepair, repairCatalog } from '../lib/repair-catalog';
import { computeEstimate, fallbackEstimate } from '../lib/estimate-math';
import { getCachedQuote, saveQuote } from '../lib/quote-cache';
import { isWithinAiRateLimit } from '../lib/rate-limiter';
import { isPreflight, jsonResponse, preflightResponse } from '../lib/http';
import type { EstimateRequestBody, RawRepairEstimate, RepairCatalogEntry } from '../types/domain';

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

    const quoteKey = {
      year: body.year,
      make: body.make,
      model: body.model,
      repairKey: body.repairKey,
      freeformDescription: body.freeformDescription,
    };

    const raw = await getRawEstimate(quoteKey, repair);
    const estimate = computeEstimate(raw, repairCatalog.shopRatePerHour);

    return jsonResponse(event, 200, estimate);
  } catch (err) {
    console.error('estimate-repair failed', err);
    return jsonResponse(event, 500, { message: 'Failed to generate estimate' });
  }
};

async function getRawEstimate(
  quoteKey: {
    year: number;
    make: string;
    model: string;
    repairKey: string;
    freeformDescription?: string;
  },
  repair: RepairCatalogEntry
): Promise<RawRepairEstimate> {
  const cached = await getCachedQuote(quoteKey);
  if (cached) {
    return cached;
  }

  let raw: RawRepairEstimate;

  const withinBudget = await isWithinAiRateLimit();
  if (!withinBudget) {
    console.warn('Hourly AI rate limit reached, using standard shop pricing instead');
    raw = fallbackEstimate(repair);
  } else {
    try {
      raw = await getAiRepairEstimate({
        year: quoteKey.year,
        make: quoteKey.make,
        model: quoteKey.model,
        repairLabel: repair.label,
        baselineHours: repair.baselineHours,
        freeformDescription: quoteKey.freeformDescription,
        shopRatePerHour: repairCatalog.shopRatePerHour,
      });
    } catch (err) {
      console.error('Bedrock estimate failed, using standard shop pricing instead', err);
      raw = fallbackEstimate(repair);
    }
  }

  await saveQuote(quoteKey, raw);
  return raw;
}

function badRequest(event: APIGatewayProxyEventV2, message: string) {
  return jsonResponse(event, 400, { message });
}
