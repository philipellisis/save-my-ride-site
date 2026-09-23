export interface RepairCatalogEntry {
  key: string;
  label: string;
  baselineHours: number | null;
}

export interface RepairCatalog {
  shopRatePerHour: number;
  repairs: RepairCatalogEntry[];
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
