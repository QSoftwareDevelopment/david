import { addDays, daysBetween, inQuietHours, localParts, zonedInstant } from "./time.js";
import type { Campaign, CampaignKind, Guest, Hotel, Stay } from "./types.js";

/**
 * Campaigns: the messages David sends first.
 *
 * Every campaign is a moment in a stay (a few days before arrival, the morning
 * of, mid-stay, after departure, long after) plus who it is for and what it
 * says. Which guests are due a message right now is a pure function of the
 * clock, the stays and what has already been sent, so it is tested without a
 * database or a phone.
 */

export const KIND_LABEL: Record<CampaignKind, string> = {
  pre_arrival: "Before they arrive",
  arrival_day: "Arrival day",
  mid_stay: "During the stay",
  post_stay: "After they leave",
  win_back: "Bring them back",
  custom: "Custom",
};

/** What a new hotel starts with. All editable, all switchable. */
export function defaultCampaigns(hotelId: string): Omit<Campaign, "id">[] {
  const base = { hotelId, enabled: true, messageMode: "generated" as const, template: "", guidance: "", audience: {} };
  return [
    { ...base, name: "Before you arrive", kind: "pre_arrival", offsetDays: -3, sendHour: 10, guidance: "Ask if there is anything they'd like prepared: room preferences, a dinner booking, flowers, airport pickup." },
    { ...base, name: "Arrival day", kind: "arrival_day", offsetDays: 0, sendHour: 11, guidance: "Let them know the room will be ready at check-in time and ask if they want anything set up." },
    { ...base, name: "How's your stay?", kind: "mid_stay", offsetDays: 1, sendHour: 17, guidance: "Check in lightly. Offer housekeeping, laundry or a late dinner." },
    { ...base, name: "Thank you", kind: "post_stay", offsetDays: 1, sendHour: 11, guidance: "Thank them, ask one open question about how it went, and mention that we will remember what they liked." },
    { ...base, name: "We'd love to have you back", kind: "win_back", offsetDays: 75, sendHour: 11, audience: { repeatOnly: false }, guidance: "Warm and short. Mention something we remember about them. Invite them to reply to plan a return." },
  ];
}

export interface DueInput {
  now: Date;
  hotel: Hotel;
  campaigns: Campaign[];
  /** Every non-cancelled stay near the window, with its guest. */
  stays: { stay: Stay; guest: Guest; pastStays: number }[];
  /** `${campaignId}:${stayId}` or `${campaignId}:guest:${guestId}` for everything already sent. */
  sent: Set<string>;
  /** When each guest last received any outbound text, for the one-a-day limit. */
  lastOutbound: Map<string, Date>;
}

export interface DueSend {
  campaign: Campaign;
  stay: Stay;
  guest: Guest;
  scheduledFor: Date;
  pastStays: number;
}

export interface Skipped {
  campaign: Campaign;
  stay: Stay;
  guest: Guest;
  reason: "no_consent" | "opted_out" | "audience" | "quiet_hours" | "too_soon" | "no_phone";
  /** True when it should be tried again on a later tick rather than recorded as done. */
  retry: boolean;
}

/** How long after its moment a campaign may still go out (a missed tick, a quiet-hours delay). */
export const GRACE_HOURS = 30;

export function targetDate(c: Campaign, s: Stay): string {
  if (c.kind === "post_stay" || c.kind === "win_back") return addDays(s.departure, c.offsetDays);
  return addDays(s.arrival, c.offsetDays);
}

export function planDue(input: DueInput): { due: DueSend[]; skipped: Skipped[] } {
  const { now, hotel } = input;
  const local = localParts(now, hotel.timezone);
  const quiet = inQuietHours(local, hotel.quietStart, hotel.quietEnd);
  const due: DueSend[] = [];
  const skipped: Skipped[] = [];
  const claimed = new Set<string>();

  for (const c of input.campaigns) {
    if (!c.enabled) continue;
    for (const { stay, guest, pastStays } of input.stays) {
      const key = c.kind === "win_back" ? `${c.id}:guest:${guest.id}` : `${c.id}:${stay.id}`;
      if (input.sent.has(key) || claimed.has(key)) continue;
      if (stay.status === "cancelled") continue;

      // Win-backs only apply to a guest who is not already booked again.
      if (c.kind === "win_back") {
        const later = input.stays.some((o) => o.guest.id === guest.id && o.stay.id !== stay.id && o.stay.arrival > stay.departure);
        const newest = input.stays.filter((o) => o.guest.id === guest.id).every((o) => o.stay.departure <= stay.departure);
        if (later || !newest) continue;
      }

      const when = zonedInstant(targetDate(c, stay), c.sendHour, hotel.timezone);
      const ageHours = (now.getTime() - when.getTime()) / 3_600_000;
      if (ageHours < 0 || ageHours > GRACE_HOURS) continue;

      const skip = (reason: Skipped["reason"], retry: boolean) => skipped.push({ campaign: c, stay, guest, reason, retry });
      if (guest.consent === "opted_out") { skip("opted_out", false); continue; }
      if (guest.consent !== "opted_in") { skip("no_consent", true); continue; }
      if (c.audience.repeatOnly && pastStays < 1) { skip("audience", false); continue; }
      if (c.audience.vipOnly && !guest.vip) { skip("audience", false); continue; }
      if (c.audience.minNights && daysBetween(stay.arrival, stay.departure) < c.audience.minNights) { skip("audience", false); continue; }
      if (quiet) { skip("quiet_hours", true); continue; }
      const last = input.lastOutbound.get(guest.id);
      if (last && now.getTime() - last.getTime() < 20 * 3_600_000) { skip("too_soon", true); continue; }

      claimed.add(key);
      // One campaign a day per guest: the first one due wins, the rest wait.
      input.lastOutbound.set(guest.id, now);
      due.push({ campaign: c, stay, guest, scheduledFor: when, pastStays });
    }
  }
  return { due, skipped };
}

/** `{first_name}`-style placeholders in a hotel's own words. */
export function fillTemplate(template: string, v: { firstName: string; hotel: string; arrival: string; room: string; checkin: string; checkout: string }): string {
  return template
    .replace(/\{first_name\}/gi, v.firstName)
    .replace(/\{hotel\}/gi, v.hotel)
    .replace(/\{arrival\}/gi, v.arrival)
    .replace(/\{room\}/gi, v.room)
    .replace(/\{checkin\}/gi, v.checkin)
    .replace(/\{checkout\}/gi, v.checkout);
}
