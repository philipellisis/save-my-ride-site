export interface RepairCatalogEntry {
  key: string;
  label: string;
  baselineHours: number;
  defaultPartsCostLow: number;
  defaultPartsCostHigh: number;
}

export interface RepairCatalog {
  shopRatePerHour: number;
  repairs: RepairCatalogEntry[];
}

/** Hours/parts only — no dollar amounts baked in, so costs can always be recomputed against the
 * CURRENT shop rate (see estimate-math.ts). This is what gets cached and what Bedrock/fallback produce. */
export interface RawRepairEstimate {
  estimatedHours: number;
  partsCostLow: number;
  partsCostHigh: number;
  explanation: string;
}

export interface BusyInterval {
  /** ISO 8601 */
  start: string;
  /** ISO 8601 */
  end: string;
  recordId: string;
}

export interface BusinessHours {
  timeZone: string;
  daysOpen: number[]; // 0=Sunday .. 6=Saturday
  openHour: number; // 24h local, e.g. 9
  closeHour: number; // 24h local, e.g. 17
}

export interface ScheduleResponse {
  businessHours: BusinessHours;
  busyIntervals: BusyInterval[];
  syncedAt: string;
}

export interface RepairEstimate {
  estimatedHours: number;
  partsCostLow: number;
  partsCostHigh: number;
  laborCost: number;
  totalLow: number;
  totalHigh: number;
  explanation: string;
}

export interface EstimateRequestBody {
  year: number;
  make: string;
  model: string;
  repairKey: string;
  freeformDescription?: string;
}

export interface BookingRequestBody {
  customerName: string;
  customerContactInfo: string;
  customerAddress?: string;
  year: number;
  make: string;
  model: string;
  repairKey: string;
  freeformDescription?: string;
  scheduledWorkDate: string; // ISO 8601 start time
  estimate: RepairEstimate;
}

export interface AppointmentRecord {
  recordId: string;
  scheduledWorkDate: string;
  estimatedHours: number;
}
