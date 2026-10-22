import type { RequestKind } from "./types.js";

/**
 * How long a guest should wait, by kind of request. David tells guests "about
 * 30 minutes" for room service; this is the same promise in numbers, so a
 * request that sits past it can be reminded and then escalated.
 */
const MINUTES: Record<RequestKind, number> = {
  room_service: 30,
  restaurant: 20,
  housekeeping: 30,
  amenities: 20,
  laundry: 240,
  maintenance: 60,
  transport: 20,
  late_checkout: 30,
  early_checkin: 60,
  other: 30,
};

export const promiseMinutes = (kind: RequestKind, urgent = false): number => (urgent ? Math.min(15, MINUTES[kind]) : MINUTES[kind]);

/** When to nudge the department, and when to bring in the manager. */
export function reminderPlan(kind: RequestKind, urgent: boolean): { remindAfter: number; escalateAfter: number } {
  const promise = promiseMinutes(kind, urgent);
  return urgent ? { remindAfter: 5, escalateAfter: promise } : { remindAfter: Math.max(10, Math.round(promise / 2)), escalateAfter: promise };
}
