/** Small, pure helpers for showing things. Kept free of React so they are easy to test. */

export function fullName(g: { firstName: string | null; lastName: string | null; phone: string }): string {
  return [g.firstName, g.lastName].filter(Boolean).join(' ') || prettyPhone(g.phone);
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]![0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '')).toUpperCase();
}

/** +14165550111 → (416) 555-0111 for North American numbers; anything else is left alone. */
export function prettyPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** 2026-03-13 → Fri 13 Mar. Calendar maths only; no time zones involved. */
export function dateShort(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

export function nights(arrival: string, departure: string): number {
  return Math.round((Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86_400_000);
}

export function clockTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function money(cents: number | null): string {
  return cents == null ? '' : `$${(cents / 100).toFixed(2)}`;
}

export const REQUEST_LABEL: Record<string, string> = {
  room_service: 'Room service',
  housekeeping: 'Housekeeping',
  laundry: 'Laundry',
  amenities: 'Amenities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  late_checkout: 'Late check-out',
  early_checkin: 'Early check-in',
  other: 'Other',
};

export const MEMORY_LABEL: Record<string, string> = {
  dietary: 'Dietary',
  dislike: 'Dislikes',
  occasion: 'Occasion',
  preference: 'Prefers',
  habit: 'Habit',
  contact: 'Contact',
};

export const CAMPAIGN_LABEL: Record<string, string> = {
  pre_arrival: 'Before they arrive',
  arrival_day: 'Arrival day',
  mid_stay: 'During the stay',
  post_stay: 'After they leave',
  win_back: 'Bring them back',
  custom: 'Custom',
};

/** "3 days before arrival at 10:00" in words, for the campaigns list. */
export function campaignTiming(kind: string, offsetDays: number, sendHour: number): string {
  const hour = `${((sendHour + 11) % 12) + 1}:00 ${sendHour < 12 ? 'am' : 'pm'}`;
  const after = kind === 'post_stay' || kind === 'win_back';
  const ref = after ? 'departure' : 'arrival';
  if (offsetDays === 0) return `Day of ${ref}, ${hour}`;
  const n = Math.abs(offsetDays);
  const days = `${n} day${n === 1 ? '' : 's'}`;
  return `${days} ${offsetDays < 0 ? 'before' : 'after'} ${ref}, ${hour}`;
}
