import type { BusinessHours, BusyInterval, TimeSlot } from './models';

const GRANULARITY_MINUTES = 30;

function overlaps(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some((interval) => {
    const busyStart = new Date(interval.start);
    const busyEnd = new Date(interval.end);
    return start < busyEnd && end > busyStart;
  });
}

/**
 * Generates bookable slots in the visitor's local time, against the shop's
 * business hours and the busy intervals returned by GET /schedule.
 */
export function generateSlots(
  businessHours: BusinessHours,
  busyIntervals: BusyInterval[],
  durationHours: number,
  daysAhead = 10
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const durationMs = durationHours * 60 * 60 * 1000;
  const maxCalendarDaysToScan = daysAhead * 3 + 7; // generous cushion to skip past weekends/closed days

  let openDaysFound = 0;
  for (let dayOffset = 0; dayOffset < maxCalendarDaysToScan && openDaysFound < daysAhead; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    if (!businessHours.daysOpen.includes(day.getDay())) continue;

    const dayOpen = new Date(day);
    dayOpen.setHours(businessHours.openHour, 0, 0, 0);
    const dayClose = new Date(day);
    dayClose.setHours(businessHours.closeHour, 0, 0, 0);

    if (dayClose <= now) continue;
    openDaysFound++;

    let cursor = dayOpen > now ? dayOpen : roundUpToGranularity(now);

    while (cursor.getTime() + durationMs <= dayClose.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMs);
      if (!overlaps(cursor, slotEnd, busyIntervals)) {
        slots.push({
          start: new Date(cursor),
          end: slotEnd,
          label: cursor.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          dayLabel: cursor.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        });
      }
      cursor = new Date(cursor.getTime() + GRANULARITY_MINUTES * 60 * 1000);
    }
  }

  return slots;
}

function roundUpToGranularity(date: Date): Date {
  const result = new Date(date);
  const minutes = result.getMinutes();
  const remainder = minutes % GRANULARITY_MINUTES;
  if (remainder !== 0) {
    result.setMinutes(minutes + (GRANULARITY_MINUTES - remainder));
  }
  result.setSeconds(0, 0);
  return result;
}
