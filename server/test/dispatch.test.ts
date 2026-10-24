import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { RulesAgent } from "../src/agent.js";
import { DemoPos, partyOf, timeOf } from "../src/demopos.js";
import { createApp } from "../src/http.js";
import { David } from "../src/service.js";
import { RecordingSquare } from "../src/square.js";
import { seedDemo } from "../src/seed.js";
import { world } from "./helpers.js";

const GUEST = "+14165550111";
const DESK = "+14165550203", MANAGER = "+14165550202", RESTAURANT = "+14165550301", KITCHEN = "+14165550201", LAUNDRY = "+14165550401";
const SECRET = "whsec_test_secret";
const SYSTEM = "https://booking.example.com/api/reservations";

async function deskWorld(now = new Date("2026-03-10T21:00:00Z")) {
  const w = await world({ now });
  const posted: { url: string; headers: Record<string, string>; body: any; raw: string }[] = [];
  const state = { systemStatus: 200 };
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const raw = String(init?.body ?? "");
    if (String(url) === SYSTEM) {
      posted.push({ url: String(url), headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)), body: JSON.parse(raw), raw });
      return new Response("{}", { status: state.systemStatus });
    }
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  const david = new David(w.store, w.sms, new RulesAgent(), () => w.clock.now, () => new RecordingSquare(), fetchImpl);
  const hotelId = w.hotel.id;
  await w.store.setContact(hotelId, { department: "front_desk", smsNumber: DESK, webhookUrl: null });
  await w.store.setContact(hotelId, { department: "manager", smsNumber: MANAGER, webhookUrl: null });
  await w.store.setContact(hotelId, { department: "restaurant", smsNumber: RESTAURANT, webhookUrl: null, dispatch: "review", integrationUrl: SYSTEM, integrationSecret: SECRET });
  await w.store.setContact(hotelId, { department: "room_service", smsNumber: KITCHEN, webhookUrl: null });
  await w.store.setContact(hotelId, { department: "laundry", smsNumber: LAUNDRY, webhookUrl: null });

  const guest = await w.store.createGuest({ hotelId, phone: GUEST, firstName: "Amara", lastName: "Okoye", consent: "opted_in", consentSource: "booking_form", vip: true });
  const old = await w.store.createStay({ hotelId, guestId: guest.id, room: "715", arrival: "2025-11-01", departure: "2025-11-04" });
  const stay = await w.store.createStay({ hotelId, guestId: guest.id, room: "715", arrival: "2026-03-10", departure: "2026-03-13", partySize: 2 });
  await w.store.refreshStayStatuses(hotelId, "2026-03-10");
  await w.store.learn(hotelId, guest.id, { kind: "dietary", key: "allergy", value: "shellfish", source: "guest" }, w.clock.now, null);
  await w.store.learn(hotelId, guest.id, { kind: "occasion", key: "anniversary", value: "here for an anniversary", source: "guest" }, w.clock.now, null);
  await w.store.learn(hotelId, guest.id, { kind: "preference", key: "pillows", value: "feather-free pillows", source: "guest" }, w.clock.now, null);
  const dined = await w.store.createRequest({ hotelId, guestId: guest.id, stayId: old.id, kind: "restaurant", summary: "Restaurant: table for two at 8pm", details: { items: [] }, at: new Date("2025-11-02T22:00:00Z") });
  await w.store.markDispatched(dined.id, "Front desk", null, new Date("2025-11-02T22:00:00Z"));
  await w.store.updateRequest(dined.id, { status: "done" });
  await w.store.setConfirmation(dined.id, { status: "confirmed", table: "T3, Window 3", time: "8:00 pm", at: "2025-11-02T22:05:00Z" });

  const text = (body: string) => david.handleInbound(w.hotel, { from: GUEST, body });
  const sentTo = (n: string) => w.sms.sent.filter((m) => m.to === n).map((m) => m.body);
  const app = createApp({ store: w.store, david, demo: true, recorder: w.sms });
  const as = (who?: string) => async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json", ...(who ? { "x-view-as": who } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  return { ...w, david, guest, stay, posted, state, text, sentTo, app, as };
}

const ASK = "Could we book a table for two tonight at 7:30? It's our anniversary.";

test("a restaurant request waits at the front desk instead of going straight to the restaurant", async () => {
  const w = await deskWorld();
  const r = await w.text(ASK);
  const req = r.requests[0]!;
  assert.equal(req.kind, "restaurant");
  assert.equal(req.dispatchedAt, null);
  assert.equal(w.sentTo(RESTAURANT).length, 0, "the restaurant hasn't been bothered yet");
  assert.match(w.sentTo(DESK)[0]!, /^To send to Restaurant: Restaurant · Room 715 · Amara Okoye: table for two tonight at 7:30, an anniversary/);
  assert.equal(w.posted.length, 0);
  assert.deepEqual((await w.as("restaurant")("GET", "/api/requests?status=new")).json.requests, [], "the restaurant doesn't see it yet");
  const desk = (await w.as("front_desk")("GET", "/api/requests?status=new")).json.requests;
  assert.equal(desk.length, 1);
  assert.equal(desk[0].dispatchedAt, null);
  assert.equal((await w.as("manager")("GET", "/api/dashboard")).json.toSend.length, 1);
});

test("sending it on posts a signed reservation with everything the restaurant should know", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  const res = await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, { note: "Bring a small cake. They love the window." });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.delivered, { text: true, system: true });

  const call = w.posted[0]!;
  assert.equal(call.headers["idempotency-key"], `david-${req.id}`);
  const [, t, sig] = call.headers["x-david-signature"]!.match(/^t=(\d+),v1=([0-9a-f]+)$/)!;
  assert.equal(sig, createHmac("sha256", SECRET).update(`${t}.${call.raw}`).digest("hex"), "the receiver can verify who sent it");
  const p = call.body;
  assert.equal(p.schema, "david.handoff.v1");
  assert.equal(p.requestId, req.id);
  assert.equal(p.department, "restaurant");
  assert.equal(p.summary, "table for two tonight at 7:30, an anniversary");
  assert.equal(p.requestedFor, "tonight at 7:30");
  assert.equal(p.frontDeskNote, "Bring a small cake. They love the window.");
  assert.equal(p.guest.name, "Amara Okoye");
  assert.equal(p.guest.vip, true);
  assert.equal(p.guest.pastStays, 1);
  assert.equal(p.stay.room, "715");
  assert.equal(p.stay.partySize, 2);
  assert.deepEqual(p.dietary, ["Allergic to shellfish"]);
  assert(p.onFile.some((f: any) => /anniversary/i.test(f.text)), "occasions come through");
  assert(!JSON.stringify(p).includes("pillows"), "what only housekeeping needs stays out");
  assert.deepEqual(p.previousRequests, [{ date: "2025-11-02", summary: "table for two at 8pm", status: "done", table: "T3, Window 3", time: "8:00 pm" }]);

  const briefing = w.sentTo(RESTAURANT)[0]!;
  assert.match(briefing, /^Restaurant · Amara Okoye · Room 715/);
  assert.match(briefing, /From the front desk: Bring a small cake/);
  assert.match(briefing, /Dietary: Allergic to shellfish/);
  assert.match(briefing, /Before: 2025-11-02 table for two at 8pm \(T3, Window 3\)/);
  assert.match(briefing, /Guest: VIP, stay 2, welcome back, 2 in the party/);

  const stored = (await w.store.request(req.id))!;
  assert(stored.dispatchedAt);
  assert.equal(stored.dispatchNote, "Bring a small cake. They love the window.");
  assert.equal((await w.as("restaurant")("GET", "/api/requests?status=new")).json.requests.length, 1, "now the restaurant sees it");
  assert.equal((await w.as("manager")("GET", "/api/dashboard")).json.toSend.length, 0);
});

test("if their system can't be reached nothing is marked sent, and pressing the button again works", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  w.state.systemStatus = 503;
  const failed = await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, {});
  assert.equal(failed.status, 502);
  assert.match(failed.json.error, /Restaurant's system didn't take it: Their system answered 503/);
  assert.equal((await w.store.request(req.id))!.dispatchedAt, null);
  assert.equal(w.sentTo(RESTAURANT).length, 0, "no half-sent briefing");
  w.state.systemStatus = 200;
  assert.equal((await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, {})).status, 200);
  assert.equal(w.sentTo(RESTAURANT).length, 1);
});

test("only the front desk and managers can send things on", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  for (const who of ["restaurant", "laundry", "housekeeping"]) {
    assert.equal((await w.as(who)("POST", `/api/requests/${req.id}/dispatch`, {})).status, 403, who);
    assert.equal((await w.as(who)("POST", "/api/requests/dispatch-all", {})).status, 403, who);
  }
  assert.equal((await w.store.request(req.id))!.dispatchedAt, null);
  assert.equal((await w.as("manager")("POST", `/api/requests/${req.id}/dispatch`, {})).status, 200);
});

test("a department reads the briefing for its own sent requests, and nobody else's", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  assert.equal((await w.as("restaurant")("GET", `/api/requests/${req.id}/handoff`)).status, 403, "not until it has been sent");
  assert.equal((await w.as("front_desk")("GET", `/api/requests/${req.id}/handoff`)).status, 200, "the desk previews it");
  await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, {});
  const mine = await w.as("restaurant")("GET", `/api/requests/${req.id}/handoff`);
  assert.equal(mine.status, 200);
  assert(mine.json.handoff.lines.some((l: string) => /Dietary: Allergic to shellfish/.test(l)));
  assert.equal((await w.as("laundry")("GET", `/api/requests/${req.id}/handoff`)).status, 403);
});

test("each department only gets what it acts on", async () => {
  const w = await deskWorld();
  const laundry = await w.store.createRequest({ hotelId: w.hotel.id, guestId: w.guest.id, stayId: w.stay.id, kind: "laundry", summary: "Laundry: two shirts", details: { items: ["shirts"] } });
  const hk = await w.store.createRequest({ hotelId: w.hotel.id, guestId: w.guest.id, stayId: w.stay.id, kind: "housekeeping", summary: "Housekeeping: extra pillows", details: { items: ["extra pillows"] } });
  const l = (await w.david.handoffFor(w.hotel, laundry))!;
  const h = (await w.david.handoffFor(w.hotel, hk))!;
  assert(!l.text.includes("shellfish") && !l.text.includes("pillows"), "laundry doesn't need allergies or pillows");
  assert(h.text.includes("Prefers feather-free pillows") && !h.text.includes("shellfish"), "housekeeping gets pillows, not allergies");
});

test("urgent things and the front desk's own work never wait to be sent", async () => {
  const w = await deskWorld();
  await w.store.setContact(w.hotel.id, { department: "maintenance", smsNumber: "+14165550501", webhookUrl: null, dispatch: "review" });
  const r = await w.text("there is water leaking from the ceiling, urgent");
  const leak = r.requests.find((x) => x.kind === "maintenance")!;
  assert(leak.dispatchedAt, "an urgent leak goes straight to maintenance");
  assert.equal(w.sentTo("+14165550501").length, 1);
  const late = await w.store.createRequest({ hotelId: w.hotel.id, guestId: w.guest.id, stayId: w.stay.id, kind: "late_checkout", summary: "Late check-out" });
  assert(late.dispatchedAt, "the front desk doesn't hold its own requests");
});

test("send everything at once", async () => {
  const w = await deskWorld();
  await w.store.setContact(w.hotel.id, { department: "laundry", smsNumber: LAUNDRY, webhookUrl: null, dispatch: "review" });
  await w.text(ASK);
  await w.text("can I get laundry done today?");
  assert.equal((await w.as("manager")("GET", "/api/dashboard")).json.toSend.length, 2);
  w.state.systemStatus = 500;
  const first = (await w.as("front_desk")("POST", "/api/requests/dispatch-all", {})).json;
  assert.equal(first.sent, 1, "laundry went");
  assert.equal(first.failed.length, 1, "the restaurant's system was down");
  w.state.systemStatus = 200;
  const second = (await w.as("front_desk")("POST", "/api/requests/dispatch-all", {})).json;
  assert.deepEqual([second.sent, second.failed.length], [1, 0]);
  assert.equal((await w.as("manager")("GET", "/api/dashboard")).json.toSend.length, 0);
});

// ── The system answers back ────────────────────────────────

test("their system confirms a table: the request is done and the guest is told where and when", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, {});
  const confirm = (body: unknown, secret = SECRET) => w.as()("POST", "/webhooks/integrations/confirm", body, { authorization: `Bearer ${secret}` });

  assert.equal((await confirm({ requestId: req.id, status: "confirmed" }, "whsec_wrong")).status, 401);
  assert.equal((await w.as()("POST", "/webhooks/integrations/confirm", { requestId: req.id, status: "confirmed" })).status, 401, "no secret, no entry");
  assert.equal((await confirm({ requestId: "not-a-uuid", status: "confirmed" })).status, 400);

  const ok = await confirm({ requestId: req.id, status: "confirmed", table: "T5, Booth 1", time: "7:30 pm", note: "Happy anniversary!" });
  assert.equal(ok.status, 200);
  const stored = (await w.store.request(req.id))!;
  assert.equal(stored.status, "done");
  assert.deepEqual({ ...stored.confirmation, at: undefined }, { status: "confirmed", table: "T5, Booth 1", time: "7:30 pm", note: "Happy anniversary!", source: "restaurant", at: undefined });
  const told = w.sentTo(GUEST).at(-1)!;
  assert.match(told, /Good news, Amara: your table is confirmed \(7:30 pm, T5, Booth 1\)\. Happy anniversary!/);
});

test("a system can only answer for its own department's requests", async () => {
  const w = await deskWorld();
  const laundry = await w.store.createRequest({ hotelId: w.hotel.id, guestId: w.guest.id, stayId: w.stay.id, kind: "laundry", summary: "Laundry: shirts" });
  const res = await w.as()("POST", "/webhooks/integrations/confirm", { requestId: laundry.id, status: "confirmed" }, { authorization: `Bearer ${SECRET}` });
  assert.equal(res.status, 404, "the restaurant's key can't close a laundry request");
  assert.equal((await w.store.request(laundry.id))!.status, "new");
});

test("a refusal goes back to the front desk, not to the guest", async () => {
  const w = await deskWorld();
  const req = (await w.text(ASK)).requests[0]!;
  await w.as("front_desk")("POST", `/api/requests/${req.id}/dispatch`, {});
  const guestTexts = w.sentTo(GUEST).length;
  await w.as()("POST", "/webhooks/integrations/confirm", { requestId: req.id, status: "declined", note: "Fully booked until 9" }, { authorization: `Bearer ${SECRET}` });
  assert.equal(w.sentTo(GUEST).length, guestTexts, "the guest hears nothing until there's an answer");
  assert.match(w.sentTo(DESK).at(-1)!, /Restaurant couldn't take it · Amara Okoye: table for two tonight at 7:30, an anniversary\. Reason: Fully booked until 9\. Please offer the guest an alternative\./);
  const stored = (await w.store.request(req.id))!;
  assert.notEqual(stored.status, "done");
  assert.equal(stored.confirmation!.status, "declined");
});

// ── Reminders ──────────────────────────────────────────────

test("a request sitting at the desk reminds the desk, not the department", async () => {
  const w = await deskWorld();
  await w.text(ASK);
  const restaurantTexts = w.sentTo(RESTAURANT).length;
  w.clock.now = new Date(w.clock.now.getTime() + 12 * 60_000);
  assert.deepEqual(await w.david.alerts.remind(w.hotel), { reminded: 1, escalated: 0 });
  assert.match(w.sentTo(DESK).at(-1)!, /^Waiting to be sent to Restaurant \(12 min\)\./);
  assert.equal(w.sentTo(RESTAURANT).length, restaurantTexts);
  w.clock.now = new Date(w.clock.now.getTime() + 15 * 60_000);
  assert.equal((await w.david.alerts.remind(w.hotel)).escalated, 1);
  assert.match(w.sentTo(MANAGER).at(-1)!, /Still waiting at the front desk after 27 min/);
});

// ── Settings ───────────────────────────────────────────────

test("connecting a system gives it a secret, shown once, and the settings guard what makes sense", async () => {
  const w = await deskWorld();
  const put = (dept: string, body: unknown) => w.as("manager")("PUT", `/api/alerts/${dept}`, body);
  const connected = await put("housekeeping", { smsNumber: "416 555 0600", integrationUrl: "https://hk.example.com/hook", dispatch: "review" });
  assert.equal(connected.status, 200);
  assert.match(connected.json.secret, /^whsec_[0-9a-f]{48}$/);
  const row = connected.json.contacts.find((c: any) => c.department === "housekeeping");
  assert.deepEqual([row.dispatch, row.integrationUrl, row.hasSecret, row.secretTail], ["review", "https://hk.example.com/hook", true, connected.json.secret.slice(-4)]);
  assert(!JSON.stringify(connected.json.contacts).includes(connected.json.secret), "the list never contains the secret");
  const again = await put("housekeeping", { smsNumber: "416 555 0600", integrationUrl: "https://hk.example.com/hook", dispatch: "review" });
  assert.equal(again.json.secret, undefined, "not shown a second time");
  const rotated = await w.as("manager")("POST", "/api/alerts/housekeeping/secret");
  assert.notEqual(rotated.json.secret, connected.json.secret);
  assert.equal((await w.as()("POST", "/webhooks/integrations/confirm", { requestId: "11111111-1111-4111-8111-111111111111", status: "confirmed" }, { authorization: `Bearer ${connected.json.secret}` })).status, 401, "the old secret stops working");

  assert.equal((await put("laundry", { integrationUrl: "http://insecure.example.com/x" })).status, 400);
  assert.equal((await put("laundry", { integrationUrl: "https://10.0.0.5/x" })).status, 400);
  assert.equal((await put("front_desk", { dispatch: "review" })).status, 400, "the desk can't hold requests for itself");
  assert.equal((await put("manager", { integrationUrl: "https://x.example.com/y" })).status, 400);
  assert.equal((await w.as("manager")("POST", "/api/alerts/laundry/secret")).status, 400, "no system, no secret");

  const test = await w.as("manager")("POST", "/api/alerts/restaurant/test");
  assert.deepEqual(test.json.system, { ok: true, error: null });
  assert.equal(w.posted.at(-1)!.body.test, true);
  const cleared = await put("housekeeping", { integrationUrl: null, dispatch: "direct" });
  assert.equal(cleared.json.contacts.find((c: any) => c.department === "housekeeping").hasSecret, false, "removing the system removes its secret");
});

// ── The demo restaurant system ─────────────────────────────

test("the demo restaurant system books a fitting table and calls back", async () => {
  assert.equal(partyOf("table for six tonight", 2), 6);
  assert.equal(partyOf("a table tonight", 3), 3);
  assert.equal(timeOf("tonight at 7:30"), "7:30 pm");
  assert.equal(timeOf("at 8pm please"), "8 pm" === timeOf("at 8pm please") ? "8 pm" : "8:00 pm");
  const booked: { id: string; table: string; time: string }[] = [];
  const pos = new DemoPos(async (id, c) => { booked.push({ id, ...c }); }, 0);
  const post = (payload: object) => pos.fetch("https://pos.demo.invalid/reservations", { method: "POST", body: JSON.stringify(payload) });
  const base = { schema: "david.handoff.v1", guest: { name: "A" }, stay: { room: "1", partySize: 2 }, onFile: [], dietary: [], previousRequests: [] };
  assert.equal((await post({ ...base, requestId: "r1", summary: "table for two at 7:30", requestedFor: "7:30 pm" })).status, 200);
  assert.equal((await post({ ...base, requestId: "r2", summary: "table for two at 7:30", requestedFor: "7:30 pm" })).status, 200);
  assert.equal((await post({ ...base, requestId: "r3", summary: "table for 7", requestedFor: "9 pm" })).status, 200);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(booked.map((b) => b.id), ["r1", "r2", "r3"]);
  assert.notEqual(pos.bookings[0]!.table, pos.bookings[1]!.table, "two bookings at the same time don't share a table");
  assert.equal(pos.tables.find((t) => t.id === pos.bookings[2]!.table)!.seats, 8, "a party of seven gets the long table");
  assert.equal((await post({ test: true })).status, 200);
});

test("in the demo, sending the seeded restaurant request books a table and tells the guest", async () => {
  const w = await world({ hotelSlug: "scratch" });
  await seedDemo(w.store, w.clock.now);
  let david!: David;
  const pos = new DemoPos(async (id, c) => {
    const request = (await w.store.request(id))!;
    await david.applyConfirmation((await w.store.hotel(request.hotelId))!, request, { status: "confirmed", table: c.table, time: c.time, note: null, source: "demo POS" });
  }, 0);
  david = new David(w.store, w.sms, new RulesAgent(), () => w.clock.now, undefined, pos.fetch);
  const hotel = (await w.store.hotelBySlug("harbour-house"))!;
  const held = await w.store.heldRequests(hotel.id);
  assert.equal(held.length, 1);
  assert.match(held[0]!.summary, /table for two tonight at 7:30/);
  const res = await david.dispatchRequest(hotel, held[0]!.id, "Front desk", "A birthday: bring a candle");
  assert.equal(res!.error, undefined);
  await new Promise((r) => setTimeout(r, 30));
  const done = (await w.store.request(held[0]!.id))!;
  assert.equal(done.status, "done");
  assert.match(done.confirmation!.table!, /^T\d+, /);
  assert.equal(pos.bookings[0]!.occasion !== null, true, "her birthday reaches the restaurant");
  assert.deepEqual(pos.bookings[0]!.previous.map((p) => p.table), ["T3, Window 3"], "and her last visit");
  assert.match(w.sms.sent.at(-1)!.body, /your table is confirmed/);
});

test("what is waiting to be sent is listed once on the dashboard, not also under needs attention", async () => {
  const w = await deskWorld();
  await w.text(ASK);
  for (const who of ["manager", "front_desk"]) {
    const d = (await w.as(who)("GET", "/api/dashboard")).json;
    assert.equal(d.toSend.length, 1, who);
    assert(!d.urgent.some((r: any) => r.dispatchedAt === null), `${who}: held requests aren't repeated`);
  }
});
