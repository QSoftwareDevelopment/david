/**
 * Hotel-local time, without a date library.
 *
 * Everything is stored in UTC. Anything a guest would notice (is it too late to
 * text them, what day is their check-in, is it 7am where they are) is decided
 * in the hotel's own time zone.
 */

export interface Local {
  /** YYYY-MM-DD in the hotel's zone. */
  date: string;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
}

export function localParts(at: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday,
  };
}

/** `YYYY-MM-DD` plus a number of days. Calendar arithmetic, no zones involved. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  return Math.round((t - f) / 86_400_000);
}

/**
 * Whether it is quiet hours in the hotel: the window may wrap midnight, so
 * 21 to 8 means 21:00 through 07:59.
 */
export function inQuietHours(local: Pick<Local, "hour">, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? local.hour >= start && local.hour < end : local.hour >= start || local.hour < end;
}

/** The UTC instant of a local date and hour in a zone. */
export function zonedInstant(date: string, hour: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hour, 0);
  const shown = localParts(new Date(guess), timeZone);
  const [sy, sm, sd] = shown.date.split("-").map(Number) as [number, number, number];
  const seen = Date.UTC(sy, sm - 1, sd, shown.hour, shown.minute);
  return new Date(guess - (seen - guess));
}
