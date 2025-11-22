// lib/nurtureTiming.ts

export type NurtureStage = 'DAY_1' | 'DAY_2' | 'DAY_3' | 'DAY_5' | 'DAY_7';

// The order of your tight loop
const STAGE_SEQUENCE: NurtureStage[] = ['DAY_1', 'DAY_2', 'DAY_3', 'DAY_5', 'DAY_7'];

// Offsets (in hours) from the *current* stage send time to the *next* stage
// Based on your spec:
// DAY_1  -> +24h  -> DAY_2
// DAY_2  -> +24h  -> DAY_3
// DAY_3  -> +48h  -> DAY_5
// DAY_5  -> +48h  -> DAY_7
// DAY_7  -> stop (handoff to long-term drip later)
const STAGE_NEXT_OFFSET_HOURS: Record<NurtureStage, number> = {
  DAY_1: 24,
  DAY_2: 24,
  DAY_3: 48,
  DAY_5: 48,
  DAY_7: 0, // no next stage in this tight loop
};

// Business hours window (agent local time)
// You can tweak these if needed
const BUSINESS_START_HOUR = 9;   // 9 AM
const BUSINESS_START_MINUTE = 15; // 9:15 AM
const BUSINESS_END_HOUR = 20;   // 8 PM

// Jitter in minutes: 15–65
const JITTER_MIN_MINUTES = 15;
const JITTER_MAX_MINUTES = 65;

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Apply "Safety Valve": if time is outside business hours, move it into the window
function applyBusinessHoursWindow(date: Date): Date {
  const d = new Date(date);
  const hour = d.getHours();
  const minute = d.getMinutes();

  // If before start window → same day at 9:15 AM
  const isBeforeStart =
    hour < BUSINESS_START_HOUR ||
    (hour === BUSINESS_START_HOUR && minute < BUSINESS_START_MINUTE);

  // If after end window → next day at 9:15 AM
  const isAfterEnd = hour > BUSINESS_END_HOUR;

  if (!isBeforeStart && !isAfterEnd) {
    // Already inside window
    return d;
  }

  // If before window, schedule for today at 9:15
  if (isBeforeStart) {
    d.setHours(BUSINESS_START_HOUR, BUSINESS_START_MINUTE, 0, 0);
    return d;
  }

  // If after window, schedule for tomorrow at 9:15
  d.setDate(d.getDate() + 1);
  d.setHours(BUSINESS_START_HOUR, BUSINESS_START_MINUTE, 0, 0);
  return d;
}

/**
 * Given the current stage and when that stage was sent,
 * compute the next stage and next_nurture_at.
 */
export function computeNextNurture(
  currentStage: NurtureStage,
  previousSentAtISO: string
): { nextStage: NurtureStage | null; nextNurtureAt: string | null } {
  const idx = STAGE_SEQUENCE.indexOf(currentStage);

  // If stage is unknown or we're at the last stage (DAY_7), stop the tight loop.
  if (idx === -1 || idx === STAGE_SEQUENCE.length - 1) {
    return { nextStage: null, nextNurtureAt: null };
  }

  const nextStage = STAGE_SEQUENCE[idx + 1];
  const offsetHours = STAGE_NEXT_OFFSET_HOURS[currentStage] ?? 0;

  const previousSentAt = new Date(previousSentAtISO);
  if (Number.isNaN(previousSentAt.getTime())) {
    throw new Error(`Invalid previousSentAtISO: ${previousSentAtISO}`);
  }

  // Base: previous sent time + offset
  let targetTime = addHours(previousSentAt, offsetHours);

  // Apply jitter (Bot Breaker)
  const jitterMinutes = randomInt(JITTER_MIN_MINUTES, JITTER_MAX_MINUTES);
  targetTime = addMinutes(targetTime, jitterMinutes);

  // Apply Safety Valve (Business Hours)
  targetTime = applyBusinessHoursWindow(targetTime);

  return {
    nextStage,
    nextNurtureAt: targetTime.toISOString(),
  };
}
