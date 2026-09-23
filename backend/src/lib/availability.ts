import type { BusinessHours, BusyInterval } from '../types/domain';

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timeZone: 'America/New_York',
  daysOpen: [1, 2, 3, 4, 5], // Mon-Fri
  openHour: 9,
  closeHour: 17,
};

/**
 * Pure instant-overlap check (no timezone math needed) — used to guard against
 * double-booking when a new appointment is created. Slot *generation* against
 * business hours happens client-side, in the visitor's local time.
 */
export function hasConflict(startIso: string, durationHours: number, busyIntervals: BusyInterval[]): boolean {
  const start = new Date(startIso).getTime();
  const end = start + durationHours * 3600 * 1000;

  return busyIntervals.some((interval) => {
    const busyStart = new Date(interval.start).getTime();
    const busyEnd = new Date(interval.end).getTime();
    return start < busyEnd && end > busyStart;
  });
}
