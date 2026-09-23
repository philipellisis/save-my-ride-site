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
  start: string;
  end: string;
  recordId: string;
}

export interface BusinessHours {
  timeZone: string;
  daysOpen: number[];
  openHour: number;
  closeHour: number;
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

export interface EstimateRequest {
  year: number;
  make: string;
  model: string;
  repairKey: string;
  freeformDescription?: string;
}

export interface BookingRequest {
  customerName: string;
  customerContactInfo: string;
  customerAddress?: string;
  year: number;
  make: string;
  model: string;
  repairKey: string;
  freeformDescription?: string;
  scheduledWorkDate: string;
  estimate: RepairEstimate;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  label: string;
  dayLabel: string;
}
