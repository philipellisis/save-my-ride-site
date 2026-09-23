import type { RawRepairEstimate, RepairCatalogEntry, RepairEstimate } from '../types/domain';

/** Applies the CURRENT shop rate to a raw (hours + parts) estimate — used identically whether the
 * raw estimate just came from Bedrock, a fallback, or a cached quote, so a later shop-rate change
 * never retroactively changes what a past quote said, while still using today's rate for math. */
export function computeEstimate(raw: RawRepairEstimate, shopRatePerHour: number): RepairEstimate {
  const laborCost = round2(raw.estimatedHours * shopRatePerHour);
  const totalLow = round2(laborCost + raw.partsCostLow);
  const totalHigh = round2(laborCost + raw.partsCostHigh);

  return {
    estimatedHours: raw.estimatedHours,
    partsCostLow: round2(raw.partsCostLow),
    partsCostHigh: round2(raw.partsCostHigh),
    laborCost,
    totalLow,
    totalHigh,
    explanation: raw.explanation,
  };
}

/** Used when Bedrock is unavailable or the hourly AI call budget is used up — a straightforward
 * quote from the shop's own standard baseline numbers instead of an AI-generated one. */
export function fallbackEstimate(repair: RepairCatalogEntry): RawRepairEstimate {
  return {
    estimatedHours: repair.baselineHours,
    partsCostLow: repair.defaultPartsCostLow,
    partsCostHigh: repair.defaultPartsCostHigh,
    explanation:
      'This estimate uses our standard shop pricing for this type of job. Final pricing will be confirmed at the shop.',
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
