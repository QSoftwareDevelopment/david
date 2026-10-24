import { createHmac } from "node:crypto";
import { arrivalsOn, etaWords, isLateEta } from "./arrivals.js";
import { DEPARTMENT_LABEL, departmentOf, type Department } from "./departments.js";
import { reminderPlan } from "./promises.js";
import type { SmsProvider } from "./sms.js";
import type { Store } from "./store.js";
import { localParts } from "./time.js";
import type { GuestRequest, Hotel } from "./types.js";

/**
 * Telling people where they already look.
 *
 * Hotels run on a kitchen phone, a Slack channel and a duty manager. David
 * sends each department's requests there, by text and/or a webhook, so staff
 * don't have to live in another app. Everything here is best effort: an alert
 * that can't be delivered is logged, never thrown, because the guest's reply
 * and the request itself must not depend on it.
 */

type Who = Department | "manager";
/** "Housekeeping: extra towels" reads as "extra towels" once the department is named. "Needs a person:" stays. */
const CATEGORY_PREFIX = /^(Room service|Housekeeping|Laundry|Amenities|Maintenance|Transport|Restaurant|Late check-out|Early check-in):\s*/;

/** A webhook must be https and must not point inside a network: the server will call whatever is configured. */
export function safeWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
    if (/^\[/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false; // raw IPs, v4 or v6
    return true;
  } catch {
    return false;
  }
}

export class Alerts {
  constructor(
    private readonly store: Store,
    private readonly sms: SmsProvider,
    private readonly clock: () => Date,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Send a line to a department's phone and webhook. Returns whether anything went out. */
  async tell(hotel: Hotel, who: Who, text: string): Promise<boolean> {
    const contact = (await this.store.contacts(hotel.id)).find((c) => c.department === who);
    if (!contact) return false;
    let sent = false;
    if (contact.smsNumber) {
      try {
        await this.sms.send({ from: hotel.smsNumber ?? "+10000000000", to: contact.smsNumber, body: text.slice(0, 600) });
        sent = true;
      } catch (e) {
        console.error("[alerts] text failed:", e instanceof Error ? e.message : e);
      }
    }
    if (contact.webhookUrl && safeWebhookUrl(contact.webhookUrl)) {
      try {
        const res = await this.fetchImpl(contact.webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
        sent = sent || res.ok;
        if (!res.ok) console.error("[alerts] webhook said", res.status);
      } catch (e) {
        console.error("[alerts] webhook failed:", e instanceof Error ? e.message : e);
      }
    }
    return sent;
  }

  /**
   * Post a structured payload to a department's own system (a restaurant's booking or POS software).
   * Signed so the receiver can trust it: `X-David-Signature: t=<unix seconds>,v1=<hmac-sha256 of "t.body">`.
   */
  async integrate(contact: { integrationUrl: string | null; integrationSecret: string | null }, payload: unknown, idempotencyKey: string): Promise<{ ok: boolean; status: number | null; error?: string }> {
    if (!contact.integrationUrl) return { ok: false, status: null, error: "No system connected." };
    if (!safeWebhookUrl(contact.integrationUrl)) return { ok: false, status: null, error: "That address isn't a public https URL." };
    const body = JSON.stringify(payload);
    const t = Math.floor(this.clock().getTime() / 1000);
    const sig = createHmac("sha256", contact.integrationSecret ?? "").update(`${t}.${body}`).digest("hex");
    try {
      const res = await this.fetchImpl(contact.integrationUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-david-signature": `t=${t},v1=${sig}`, "idempotency-key": idempotencyKey },
        body, signal: AbortSignal.timeout(8000),
      });
      return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: `Their system answered ${res.status}.` };
    } catch (e) {
      return { ok: false, status: null, error: e instanceof Error ? e.message : "Could not reach their system." };
    }
  }

  private line(r: GuestRequest, guestName: string, room: string | null, prefix = ""): string {
    const what = r.summary.replace(CATEGORY_PREFIX, "");
    return `${prefix}${r.priority === "urgent" ? "URGENT " : ""}${DEPARTMENT_LABEL[departmentOf(r.kind)]}${room ? ` · Room ${room}` : ""} · ${guestName}: ${what}`;
  }

  /** A new request: tell its department, and the manager too when it's urgent or needs a person. */
  async newRequest(hotel: Hotel, r: GuestRequest, guestName: string, room: string | null): Promise<void> {
    try {
      const text = this.line(r, guestName, room);
      // A department set to "review" hears about it from the front desk, once it has been sent on.
      if (r.dispatchedAt === null) await this.tell(hotel, "front_desk", `To send to ${DEPARTMENT_LABEL[departmentOf(r.kind)]}: ${text}`);
      else await this.tell(hotel, departmentOf(r.kind), text);
      if (r.priority === "urgent" || r.details.escalation) await this.tell(hotel, "manager", text);
      await this.store.markRequest(r.id, "notified_at", this.clock());
    } catch (e) {
      console.error("[alerts] new request:", e instanceof Error ? e.message : e);
    }
  }

  /** A guest told us when they'll arrive, and it's late. */
  async lateArrival(hotel: Hotel, guestName: string, eta: string, room: string | null): Promise<void> {
    await this.tell(hotel, "front_desk", `Late arrival · ${guestName}${room ? ` · Room ${room}` : ""}: expects to arrive around ${etaWords(eta)}.`);
  }

  /**
   * One nudge to the department when a request has sat untouched, and one
   * heads-up to the manager if it still has, past the promise made to the guest.
   * Each request is reminded once and escalated once, so alerts never pile up.
   */
  async remind(hotel: Hotel): Promise<{ reminded: number; escalated: number }> {
    const now = this.clock();
    const out = { reminded: 0, escalated: 0 };
    for (const r of await this.store.untouchedRequests(hotel.id)) {
      const age = (now.getTime() - new Date(r.createdAt).getTime()) / 60_000;
      if (age > 24 * 60) continue; // too old to be news
      const plan = reminderPlan(r.kind, r.priority === "urgent");
      const mins = Math.round(age);
      const held = r.dispatchedAt === null;
      if (age >= plan.escalateAfter && !r.escalatedAt) {
        await this.tell(hotel, "manager", this.line(r, r.guestName, r.room, held ? `Still waiting at the front desk after ${mins} min. ` : `Nobody has picked this up in ${mins} min. `));
        await this.store.markRequest(r.id, "escalated_at", now);
        if (!r.remindedAt) await this.store.markRequest(r.id, "reminded_at", now);
        out.escalated++;
      } else if (age >= plan.remindAfter && !r.remindedAt && !r.escalatedAt) {
        await this.tell(hotel, held ? "front_desk" : departmentOf(r.kind), this.line(r, r.guestName, r.room, held ? `Waiting to be sent to ${DEPARTMENT_LABEL[departmentOf(r.kind)]} (${mins} min). ` : `Still open after ${mins} min. `));
        await this.store.markRequest(r.id, "reminded_at", now);
        out.reminded++;
      }
    }
    return out;
  }

  /** The morning briefing, once a day, at the hotel's briefing hour. */
  async briefing(hotel: Hotel): Promise<boolean> {
    const now = this.clock();
    const local = localParts(now, hotel.timezone);
    if (local.hour < (hotel.briefingHour ?? 7)) return false;
    if ((await this.store.lastBriefing(hotel.id)) === local.date) return false;
    const manager = (await this.store.contacts(hotel.id)).find((c) => c.department === "manager");
    if (!manager) return false;
    // Claim the day first, so two overlapping ticks can't both send it.
    await this.store.setLastBriefing(hotel.id, local.date);
    const [arrivals, stats, board, ratings] = await Promise.all([
      arrivalsOn(this.store, now, hotel.id, local.date), this.store.dashboard(hotel.id, local.date),
      this.store.departmentBoard(hotel.id, local.date, now), this.store.feedbackSince(hotel.id, new Date(now.getTime() - 24 * 3600_000)),
    ]);
    return this.tell(hotel, "manager", briefingText({ hotel, date: local.date, arrivals, inHouse: stats.inHouse, departing: stats.departuresToday, board, ratings }));
  }
}

export function briefingText(d: {
  hotel: Hotel; date: string;
  arrivals: Awaited<ReturnType<typeof arrivalsOn>>;
  inHouse: number; departing: number;
  board: { label: string; open: number }[];
  ratings: { score: number }[];
}): string {
  const lines = [`Good morning. ${d.hotel.name}, ${new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`))}.`];
  lines.push(`${d.arrivals.length} arriving, ${d.inHouse} in house, ${d.departing} departing.`);
  for (const a of d.arrivals.slice(0, 6)) {
    const name = [a.guest.firstName, a.guest.lastName].filter(Boolean).join(" ") || a.guest.phone;
    const tags = [a.pastStays > 0 ? `stay ${a.pastStays + 1}` : "first stay", a.guest.vip ? "VIP" : null, a.stay.eta ? `~${etaWords(a.stay.eta)}${isLateEta(a.stay.eta) ? " LATE" : ""}` : null].filter(Boolean).join(", ");
    const asked = a.asked.slice(0, 2).map((r) => r.summary.replace(CATEGORY_PREFIX, "")).join("; ");
    lines.push(`- ${name} (${tags})${asked ? `: asked for ${asked}` : ""}${a.stay.notes ? `. Note: ${a.stay.notes}` : ""}`);
  }
  const open = d.board.filter((b) => b.open > 0).map((b) => `${b.label} ${b.open}`);
  lines.push(open.length ? `Open now: ${open.join(", ")}.` : "Nothing open right now.");
  if (d.ratings.length) lines.push(`Last 24h guest ratings: ${(d.ratings.reduce((n, r) => n + r.score, 0) / d.ratings.length).toFixed(1)}/10 from ${d.ratings.length}.`);
  return lines.join("\n");
}
