import assert from "node:assert/strict";
import { test } from "node:test";
import { safeWebhookUrl } from "../src/alerts.js";
import { RulesAgent } from "../src/agent.js";
import { defaultCampaigns } from "../src/campaigns.js";
import { createApp } from "../src/http.js";
import { David } from "../src/service.js";
import { RecordingSquare } from "../src/square.js";
import { world } from "./helpers.js";

const GUEST = "+14165550111";
const KITCHEN = "+14165550201", MANAGER = "+14165550202", DESK = "+14165550203";

/** A world where David has a kitchen phone, a Slack-style webhook, a manager and a night desk. */
async function alertWorld(now = new Date("2026-03-10T15:00:00Z")) {
  const w = await world({ now });
  const posts: { url: string; text: string }[] = [];
  const state = { failWebhook: false };
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (state.failWebhook) throw new Error("connection refused");
    posts.push({ url: String(url), text: JSON.parse(String(init?.body)).text });
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  const david = new David(w.store, w.sms, new RulesAgent(), () => w.clock.now, () => new RecordingSquare(), fetchImpl);
  await w.store.setContact(w.hotel.id, { department: "room_service", smsNumber: KITCHEN, webhookUrl: "https://hooks.example.com/kitchen" });
  await w.store.setContact(w.hotel.id, { department: "manager", smsNumber: MANAGER, webhookUrl: null });
  await w.store.setContact(w.hotel.id, { department: "front_desk", smsNumber: DESK, webhookUrl: null });
  const text = (body: string, from = GUEST) => david.handleInbound(w.hotel, { from, body });
  const sentTo = (n: string) => w.sms.sent.filter((m) => m.to === n).map((m) => m.body);
  return { ...w, david, posts, state, text, sentTo };
}

test("a webhook must be public https", () => {
  assert(safeWebhookUrl("https://hooks.slack.com/services/T0/B0/xyz"));
  for (const bad of ["http://hooks.slack.com/x", "https://localhost/x", "https://10.0.0.5/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://printer.local/x", "https://user:pw@hooks.example.com/x", "https://intranet/x", "not a url"]) {
    assert(!safeWebhookUrl(bad), bad);
  }
});

// ── Telling the people who do the work ─────────────────────

test("a room service text reaches the kitchen's phone and webhook, with the room and the allergy", async () => {
  const w = await alertWorld();
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Priya", lastName: "Nair", consent: "opted_in", consentSource: "booking_form" });
  await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, room: "612", arrival: "2026-03-09", departure: "2026-03-12" });
  await w.store.learn(w.hotel.id, guest.id, { kind: "dietary", key: "allergy", value: "shellfish", source: "guest" }, w.clock.now, null);
  const r = await w.text("can I get a club sandwich please");
  assert.equal(r.requests.length, 1);
  const line = w.sentTo(KITCHEN)[0]!;
  assert.match(line, /^Room service · Room 612 · Priya Nair: /);
  assert.match(line, /allergy: shellfish/);
  assert.equal(w.posts[0]!.url, "https://hooks.example.com/kitchen");
  assert.equal(w.posts[0]!.text, line, "the webhook gets the same line");
  assert.equal(w.sentTo(MANAGER).length, 0, "a routine request doesn't bother the manager");
  assert((await w.store.request(r.requests[0]!.id))!.notifiedAt);
});

test("an urgent request or a complaint also tells the manager", async () => {
  const w = await alertWorld();
  await w.text("this is unacceptable, the room is filthy");
  const manager = w.sentTo(MANAGER);
  assert.equal(manager.length, 1);
  assert.match(manager[0]!, /Front desk .*Needs a person/);
});

test("with nobody configured, or a dead webhook, the guest still gets their reply and the request still exists", async () => {
  const w = await alertWorld();
  w.state.failWebhook = true;
  const r = await w.text("a club sandwich please");
  assert.match(r.reply!, /arranged/);
  assert.equal(w.sentTo(KITCHEN).length, 1, "the text still went");
  const bare = await world();
  const r2 = await bare.david.handleInbound(bare.hotel, { from: GUEST, body: "extra towels" });
  assert.equal(r2.requests.length, 1);
  assert.equal(bare.sms.sent.filter((m) => m.to !== GUEST).length, 0, "nobody to tell, nobody told");
});

// ── Reminders and escalation ───────────────────────────────

test("a request nobody has touched gets one reminder, then one heads-up to the manager, never more", async () => {
  const w = await alertWorld();
  const r = await w.text("a club sandwich please");
  const id = r.requests[0]!.id;
  const kitchenAtStart = w.sentTo(KITCHEN).length;

  w.clock.now = new Date(w.clock.now.getTime() + 5 * 60_000);
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 0, escalated: 0 }, "5 minutes is nothing");

  w.clock.now = new Date(w.clock.now.getTime() + 11 * 60_000); // 16 min: past half of 30
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 1, escalated: 0 });
  assert.match(w.sentTo(KITCHEN).at(-1)!, /^Still open after 16 min\. Room service/);
  assert.equal(w.sentTo(KITCHEN).length, kitchenAtStart + 1);
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 0, escalated: 0 }, "once is enough");

  w.clock.now = new Date(w.clock.now.getTime() + 20 * 60_000); // 36 min: past the promise
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 0, escalated: 1 });
  assert.match(w.sentTo(MANAGER).at(-1)!, /^Nobody has picked this up in 36 min\. Room service/);
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 0, escalated: 0 });
  assert.equal((await w.store.request(id))!.escalatedAt !== null, true);
});

test("a request somebody started is left alone", async () => {
  const w = await alertWorld();
  const r = await w.text("a club sandwich please");
  await w.david.setRequestStatus(w.hotel, r.requests[0]!.id, "in_progress", false);
  w.clock.now = new Date(w.clock.now.getTime() + 90 * 60_000);
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 0, escalated: 0 });
});

test("the reminders ride on the regular tick", async () => {
  const w = await alertWorld();
  await w.text("a club sandwich please");
  w.clock.now = new Date(w.clock.now.getTime() + 20 * 60_000);
  const t = await w.david.runTick(w.hotel.id);
  assert.equal(t.reminded, 1);
});

// ── The morning briefing ───────────────────────────────────

test("the manager gets one briefing a day, at the briefing hour, not before", async () => {
  const w = await alertWorld(new Date("2026-03-10T10:00:00Z")); // 6:00 in Toronto
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Amara", lastName: "Okoye", consent: "opted_in", consentSource: "booking_form", vip: true });
  const stay = await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, arrival: "2026-03-10", departure: "2026-03-13", notes: "Celebrating a birthday" });
  await w.store.setStayEta(stay.id, "23:30");
  await w.store.createRequest({ hotelId: w.hotel.id, guestId: guest.id, stayId: stay.id, kind: "restaurant", summary: "Restaurant: table for two at 7:30" });

  assert.equal((await w.david.runTick(w.hotel.id)).briefed, 0, "too early");
  w.clock.now = new Date("2026-03-10T12:00:00Z"); // 8:00
  assert.equal((await w.david.runTick(w.hotel.id)).briefed, 1);
  const text = w.sentTo(MANAGER).find((m) => m.startsWith("Good morning"))!;
  assert.match(text, /The Harbour House|Test Hotel/);
  assert.match(text, /Amara Okoye \(first stay, VIP, ~11:30 pm LATE\)/);
  assert.match(text, /asked for table for two at 7:30/);
  assert.match(text, /Note: Celebrating a birthday/);
  assert.match(text, /Open now: Restaurant 1\./);
  assert.equal((await w.david.runTick(w.hotel.id)).briefed, 0, "once a day");
  w.clock.now = new Date("2026-03-11T12:00:00Z");
  assert.equal((await w.david.runTick(w.hotel.id)).briefed, 1, "and again tomorrow");
});

test("no manager number, no briefing", async () => {
  const w = await world({ now: new Date("2026-03-10T12:00:00Z") });
  assert.equal((await w.david.runTick(w.hotel.id)).briefed, 0);
});

// ── Arrival times ──────────────────────────────────────────

test("a guest saying when they'll arrive is saved with the stay, and a late one warns the night desk", async () => {
  const w = await alertWorld();
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Sam", lastName: "Rivera", consent: "opted_in", consentSource: "booking_form" });
  const stay = await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, room: "804", arrival: "2026-03-12", departure: "2026-03-14" });
  const r = await w.text("Hi, we land around 11:30pm so will be there late");
  assert.equal((await w.store.stay(stay.id))!.eta, "23:30");
  assert.match(r.reply!, /around 11:30 pm/);
  assert.match(r.reply!, /night team/);
  assert.equal(r.requests.length, 0, "it's information, not a task");
  assert.match(w.sentTo(DESK)[0]!, /^Late arrival · Sam Rivera · Room 804: expects to arrive around 11:30 pm\./);

  const early = await w.text("actually we'll be arriving at 3 in the afternoon");
  assert.equal((await w.store.stay(stay.id))!.eta, "15:00");
  assert.doesNotMatch(early.reply!, /night team/);
  assert.equal(w.sentTo(DESK).length, 1, "an ordinary arrival doesn't alert anyone");
});

// ── How is everything, 1 to 10? ────────────────────────────

async function afterCampaignText(kind: "mid_stay" | "post_stay", opts: { hoursAgo?: number; reviewUrl?: string } = {}) {
  const w = await alertWorld();
  if (opts.reviewUrl) await w.store.updateHotel(w.hotel.id, { reviewUrl: opts.reviewUrl });
  const hotel = (await w.store.hotel(w.hotel.id))!;
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Sam", lastName: "Rivera", consent: "opted_in", consentSource: "booking_form" });
  await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, room: "804", arrival: "2026-03-08", departure: "2026-03-11" });
  const campaign = await w.store.createCampaign(defaultCampaigns(w.hotel.id).find((c) => c.kind === kind)!);
  await w.store.addMessage({ hotelId: w.hotel.id, guestId: guest.id, direction: "out", author: "campaign", body: "On a scale of 1 to 10, how is your stay?", campaignId: campaign.id, at: new Date(w.clock.now.getTime() - (opts.hoursAgo ?? 1) * 3600_000) });
  return { ...w, hotel, guest, ask: (body: string) => w.david.handleInbound(hotel, { from: GUEST, body }) };
}

test("a high score after the thank-you text gets a review link", async () => {
  const w = await afterCampaignText("post_stay", { reviewUrl: "https://g.page/r/harbour/review" });
  const r = await w.ask("10");
  assert.match(r.reply!, /https:\/\/g\.page\/r\/harbour\/review/);
  assert.equal(r.requests.length, 0);
  assert.deepEqual(await w.store.feedbackSince(w.hotel.id, new Date(0)), [{ score: 10, moment: "post_stay" }]);
});

test("a high score mid-stay is thanked, not sent to a review site yet", async () => {
  const w = await afterCampaignText("mid_stay", { reviewUrl: "https://g.page/r/harbour/review" });
  const r = await w.ask("9");
  assert.doesNotMatch(r.reply!, /g\.page/);
  assert.match(r.reply!, /Wonderful to hear, Sam/);
});

test("a middling score asks what to improve", async () => {
  const w = await afterCampaignText("post_stay");
  assert.match((await w.ask("8/10")).reply!, /What's one thing we could have done better/);
});

test("a low score brings in the duty manager straight away", async () => {
  const w = await afterCampaignText("mid_stay");
  const r = await w.ask("4");
  assert.match(r.reply!, /I've asked our duty manager to reach out to you personally/);
  assert.equal(r.requests[0]!.priority, "urgent");
  assert.match(r.requests[0]!.summary, /rated their stay so far 4\/10/);
  assert.match(w.sentTo(MANAGER).at(-1)!, /Front desk · Room 804 · Sam Rivera: Needs a person: guest rated their stay so far 4\/10/);
});

test("a number that isn't an answer to a rating text is just a message", async () => {
  const cold = await alertWorld();
  const r = await cold.text("9");
  assert.equal((await cold.store.feedbackSince(cold.hotel.id, new Date(0))).length, 0);
  assert.doesNotMatch(r.reply!, /Wonderful|duty manager/);
  const stale = await afterCampaignText("post_stay", { hoursAgo: 100 });
  await stale.ask("9");
  assert.equal((await stale.store.feedbackSince(stale.hotel.id, new Date(0))).length, 0, "a campaign text from days ago doesn't count");
});

// ── Settings API ───────────────────────────────────────────

test("the alerts settings check numbers and webhooks, and can send a test", async () => {
  const w = await alertWorld();
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  const view = (await call("GET", "/api/alerts")).json;
  assert.equal(view.contacts.length, 7);
  assert.equal(view.contacts.find((c: any) => c.department === "room_service").smsNumber, KITCHEN);
  assert.equal((await call("PUT", "/api/alerts/laundry", { smsNumber: "123" })).status, 400);
  assert.equal((await call("PUT", "/api/alerts/laundry", { webhookUrl: "http://10.0.0.1/hook" })).status, 400);
  const ok = await call("PUT", "/api/alerts/laundry", { smsNumber: "(416) 555-0204", webhookUrl: "https://hooks.slack.com/services/T/B/x" });
  assert.equal(ok.json.contacts.find((c: any) => c.department === "laundry").smsNumber, "+14165550204");
  assert.equal((await call("POST", "/api/alerts/laundry/test")).json.sent, true);
  assert.match(w.sentTo("+14165550204")[0]!, /Test from David/);
  assert.equal((await call("PUT", "/api/alerts/laundry", {})).json.contacts.find((c: any) => c.department === "laundry").smsNumber, null, "empty clears it");
  assert.equal((await call("PUT", "/api/alerts/pool", {})).status, 404);
  assert.equal((await call("PATCH", "/api/hotel", { reviewUrl: "http://x.com" })).status, 400);
  assert.equal((await call("PATCH", "/api/hotel", { reviewUrl: "https://g.page/r/x", briefingHour: 6 })).json.hotel.reviewUrl, "https://g.page/r/x");
  assert.equal((await call("PUT", "/api/alerts/laundry", {})).status, 200);
});
