import { planDue } from "./campaigns.js";
import type { Agent, AgentContext } from "./agent.js";
import { habitsFrom, recall } from "./memory.js";
import type { ProposedRequest } from "./intents.js";
import { commandOf, helpReply, isRestart, normalizePhone, startReply, stopReply, trimForSms, type SmsProvider } from "./sms.js";
import type { Store } from "./store.js";
import { addDays, localParts } from "./time.js";
import type { Guest, GuestRequest, Hotel, RequestStatus } from "./types.js";

/**
 * Everything David does, in one place: take a text, answer it, log what the
 * guest wants, remember what they said, and send the messages he starts.
 *
 * The agent decides what to say; this class decides what happens. It owns the
 * rules that must never depend on a model: opt-outs, quiet hours, sending once,
 * and never losing a request.
 */

export interface InboundResult {
  duplicate: boolean;
  guestId: string | null;
  reply: string | null;
  requests: GuestRequest[];
  escalated: boolean;
  source: "rules" | "claude" | "command" | "none";
}

export class David {
  constructor(
    readonly store: Store,
    readonly sms: SmsProvider,
    readonly agent: Agent,
    readonly clock: () => Date = () => new Date(),
  ) {}

  private from(hotel: Hotel): string {
    return hotel.smsNumber ?? "+10000000000";
  }

  /** Send a text and keep a record, whatever happens. Returns whether it left. */
  private async deliver(hotel: Hotel, guest: Guest, body: string, author: "david" | "staff" | "campaign", campaignId: string | null = null): Promise<{ sent: boolean; messageId: string }> {
    const text = trimForSms(body, 1000);
    let sid: string | null = null;
    let sent = true;
    try {
      sid = (await this.sms.send({ from: this.from(hotel), to: guest.phone, body: text })).sid;
    } catch (error) {
      sent = false;
      console.error("[sms] send failed:", error instanceof Error ? error.message : error);
    }
    const m = await this.store.addMessage({ hotelId: hotel.id, guestId: guest.id, direction: "out", author, body: text, twilioSid: sid, status: sent ? "sent" : "failed", campaignId, at: this.clock() });
    return { sent, messageId: m.id };
  }

  /** A text arrived for this hotel. */
  async handleInbound(hotel: Hotel, input: { from: string; body: string; sid?: string | null }): Promise<InboundResult> {
    const phone = normalizePhone(input.from);
    const body = input.body.trim();
    const none: InboundResult = { duplicate: false, guestId: null, reply: null, requests: [], escalated: false, source: "none" };
    if (!phone || !body) return none;

    if (input.sid && (await this.store.messageBySid(input.sid))) return { ...none, duplicate: true };

    const now = this.clock();
    let guest = await this.store.guestByPhone(hotel.id, phone);
    const cmd = commandOf(body);
    if (!guest) guest = await this.store.createGuest({ hotelId: hotel.id, phone, consent: cmd === "stop" ? "opted_out" : "opted_in", consentSource: "inbound_text" });

    await this.store.addMessage({ hotelId: hotel.id, guestId: guest.id, direction: "in", author: "guest", body, twilioSid: input.sid ?? null, at: now });

    // The words every texting service must honour come before anything else.
    if (cmd === "stop") {
      await this.store.setConsent(guest.id, "opted_out", "stop_keyword");
      await this.deliver(hotel, guest, stopReply(hotel.name), "david");
      return { ...none, guestId: guest.id, reply: stopReply(hotel.name), source: "command" };
    }
    if (cmd === "start" || (guest.consent === "opted_out" && isRestart(body))) {
      await this.store.setConsent(guest.id, "opted_in", "start_keyword");
      await this.deliver(hotel, guest, startReply(hotel.name), "david");
      return { ...none, guestId: guest.id, reply: startReply(hotel.name), source: "command" };
    }
    if (cmd === "help") {
      await this.deliver(hotel, guest, helpReply(hotel.name), "david");
      return { ...none, guestId: guest.id, reply: helpReply(hotel.name), source: "command" };
    }
    // Opted out, and not asking back in: stay silent. Staff can still see the text.
    if (guest.consent === "opted_out") return { ...none, guestId: guest.id };
    // They texted us: that is consent to be answered.
    if (guest.consent === "unknown") {
      await this.store.setConsent(guest.id, "opted_in", "inbound_text");
      guest = { ...guest, consent: "opted_in" };
    }

    const today = localParts(now, hotel.timezone).date;
    const [stay, memories, thread, catalog, open, pastStays] = await Promise.all([
      this.store.currentStay(guest.id, today),
      this.store.memories(guest.id),
      this.store.thread(guest.id, 30),
      this.store.services(hotel.id, true),
      this.store.openRequestsOf(guest.id),
      this.store.pastStayCount(guest.id, today),
    ]);

    const ctx: AgentContext = { hotel, guest, stay, memories: recall(memories, now), thread, catalog, openRequests: open, inbound: body, now, pastStays };
    const result = await this.agent.respond(ctx);

    // Log what was asked for, once, however many times they rephrase it.
    const created: GuestRequest[] = [];
    for (const r of result.requests) {
      const dup = open.find((o) => o.kind === r.kind && now.getTime() - new Date(o.createdAt).getTime() < 15 * 60_000);
      if (dup) continue;
      created.push(await this.store.createRequest({
        hotelId: hotel.id, guestId: guest.id, stayId: stay?.id ?? null, kind: r.kind, summary: r.summary,
        details: { items: r.items, when: r.when, original: body },
        priority: r.urgent ? "urgent" : "normal", at: now,
      }));
    }
    if (result.escalate) {
      const already = open.find((o) => o.kind === "other" && o.priority === "urgent");
      if (!already) created.push(await this.store.createRequest({ hotelId: hotel.id, guestId: guest.id, stayId: stay?.id ?? null, kind: "other", summary: `Needs a person: "${body.slice(0, 200)}"`, details: { escalation: true, original: body }, priority: "urgent", at: now }));
    }

    // Remember what they said, and what they keep doing.
    for (const f of result.facts) await this.store.learn(hotel.id, guest.id, f, now, stay?.id ?? null);
    if (created.length) {
      for (const f of habitsFrom(await this.store.recentRequests(guest.id), hotel.timezone)) await this.store.learn(hotel.id, guest.id, f, now, stay?.id ?? null);
    }

    await this.deliver(hotel, guest, result.reply, "david");
    return { duplicate: false, guestId: guest.id, reply: result.reply, requests: created, escalated: result.escalate, source: result.source };
  }

  /** Staff write to a guest from the app. */
  async staffReply(hotel: Hotel, guestId: string, body: string): Promise<{ sent: boolean }> {
    const guest = await this.store.guest(guestId);
    if (!guest || guest.hotelId !== hotel.id) throw new Error("No such guest.");
    if (guest.consent === "opted_out") throw new Error("This guest has opted out of texts.");
    const { sent } = await this.deliver(hotel, guest, body, "staff");
    return { sent };
  }

  /** Staff move a request along; optionally tell the guest. */
  async setRequestStatus(hotel: Hotel, requestId: string, status: RequestStatus, notify: boolean): Promise<GuestRequest | null> {
    const existing = await this.store.request(requestId);
    if (!existing || existing.hotelId !== hotel.id) return null;
    const updated = await this.store.updateRequest(requestId, { status });
    if (updated && notify && status !== existing.status) {
      const guest = await this.store.guest(existing.guestId);
      if (guest && guest.consent === "opted_in") {
        const name = guest.firstName ? `${guest.firstName}, ` : "";
        // "Housekeeping: extra towels [allergy: nuts]" reads as "extra towels" to a guest.
        const what = updated.summary.replace(/\s*\[.*\]$/, "").replace(/^[A-Za-z][A-Za-z -]*:\s*/, "");
        const line =
          status === "in_progress" ? `${name}our team is on it now: ${what}.`
          : status === "done" ? `${name}all taken care of: ${what}. Anything else, just text me.`
          : null;
        if (line) await this.deliver(hotel, guest, line, "david");
      }
    }
    return updated;
  }

  /** Send every campaign message that is due. Safe to call as often as you like. */
  async runTick(hotelId?: string): Promise<{ sent: number; skipped: number; failed: number }> {
    const totals = { sent: 0, skipped: 0, failed: 0 };
    const hotels = hotelId ? [await this.store.hotel(hotelId)].filter((h): h is Hotel => !!h) : await this.store.allHotels();
    for (const hotel of hotels) {
      const r = await this.tickHotel(hotel);
      totals.sent += r.sent; totals.skipped += r.skipped; totals.failed += r.failed;
    }
    return totals;
  }

  private async tickHotel(hotel: Hotel) {
    const now = this.clock();
    const today = localParts(now, hotel.timezone).date;
    await this.store.refreshStayStatuses(hotel.id, today);
    const campaigns = (await this.store.campaigns(hotel.id)).filter((c) => c.enabled);
    if (campaigns.length === 0) return { sent: 0, skipped: 0, failed: 0 };

    const stays = await this.store.staysBetween(hotel.id, addDays(today, -400), addDays(today, 70));
    const guests = new Map((await this.store.guestsByIds([...new Set(stays.map((s) => s.guestId))])).map((g) => [g.id, g]));
    const withGuests = [];
    for (const stay of stays) {
      const guest = guests.get(stay.guestId);
      if (!guest) continue;
      withGuests.push({ stay, guest, pastStays: await this.store.pastStayCount(guest.id, stay.arrival) });
    }

    const { due, skipped } = planDue({ now, hotel, campaigns, stays: withGuests, sent: await this.store.sendKeys(hotel.id), lastOutbound: await this.store.lastOutboundMap(hotel.id) });
    const out = { sent: 0, skipped: 0, failed: 0 };

    for (const s of skipped) {
      if (s.retry) continue;
      await this.store.recordSend({ campaignId: s.campaign.id, hotelId: hotel.id, guestId: s.guest.id, stayId: s.campaign.kind === "win_back" ? null : s.stay.id, scheduledFor: now, status: "skipped", reason: s.reason });
      out.skipped++;
    }

    for (const d of due) {
      const memories = recall(await this.store.memories(d.guest.id), now);
      const firstOutbound = (await this.store.lastOutboundAt(d.guest.id)) === null;
      const text = await this.agent.compose({ hotel, guest: d.guest, stay: d.stay, memories, campaign: d.campaign, now, pastStays: d.pastStays, firstOutbound });
      const { sent, messageId } = await this.deliver(hotel, d.guest, text, "campaign", d.campaign.id);
      await this.store.recordSend({ campaignId: d.campaign.id, hotelId: hotel.id, guestId: d.guest.id, stayId: d.campaign.kind === "win_back" ? null : d.stay.id, scheduledFor: d.scheduledFor, status: sent ? "sent" : "failed", messageId, reason: sent ? null : "send_failed" });
      sent ? out.sent++ : out.failed++;
    }
    return out;
  }

  /** What a campaign would say to a particular guest, without sending it. */
  async preview(hotel: Hotel, campaignId: string, guestId: string | null): Promise<string> {
    const campaign = await this.store.campaign(campaignId);
    if (!campaign || campaign.hotelId !== hotel.id) throw new Error("No such campaign.");
    const now = this.clock();
    const today = localParts(now, hotel.timezone).date;
    let guest = guestId ? await this.store.guest(guestId) : null;
    if (guest && guest.hotelId !== hotel.id) guest = null;
    const sample: Guest = guest ?? { id: "sample", hotelId: hotel.id, phone: "+15550000000", firstName: "Alex", lastName: null, language: "en", consent: "opted_in", consentAt: null, vip: false, notes: null, createdAt: now.toISOString() };
    const stay = (guest ? await this.store.currentStay(guest.id, today) : null) ?? { id: "sample", hotelId: hotel.id, guestId: sample.id, room: null, arrival: addDays(today, 3), departure: addDays(today, 5), partySize: 2, status: "booked" as const, notes: null };
    const memories = guest ? recall(await this.store.memories(guest.id), now) : [];
    const pastStays = guest ? await this.store.pastStayCount(guest.id, today) : 0;
    return this.agent.compose({ hotel, guest: sample, stay, memories, campaign, now, pastStays, firstOutbound: false });
  }
}

export type { ProposedRequest };
