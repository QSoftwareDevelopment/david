import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/http.js";
import { twilioSignature } from "../src/sms.js";
import { seedDemo } from "../src/seed.js";
import { world } from "./helpers.js";

async function demoApp() {
  const w = await world({ hotelSlug: "scratch" });
  const hotel = await seedDemo(w.store, w.clock.now);
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms, clock: { now: w.clock.now, offsetMs: 0 } });
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  return { ...w, hotel, app, call };
}

test("the seeded demo hotel has everything the app needs", async () => {
  const d = await demoApp();
  const me = await d.call("GET", "/api/me");
  assert.equal(me.json.hotel.name, "The Harbour House");
  const dash = await d.call("GET", "/api/dashboard");
  assert(dash.json.stats.inHouse >= 1);
  assert(dash.json.stats.memoriesTotal >= 6);
  const guests = await d.call("GET", "/api/guests");
  assert.equal(guests.json.guests.length, 6);
  assert((await d.call("GET", "/api/services")).json.services.length >= 15);
  assert.equal((await d.call("GET", "/api/campaigns")).json.campaigns.length, 5);
});

test("a regular's profile shows what David remembers and what they usually do", async () => {
  const d = await demoApp();
  const sam = (await d.call("GET", "/api/guests?q=sam")).json.guests[0];
  assert.equal(sam.stayCount, 3);
  const profile = (await d.call("GET", `/api/guests/${sam.id}`)).json;
  const keys = profile.memories.map((m: any) => m.key);
  assert(keys.includes("pillows") && keys.includes("usual room service"));
  assert.equal(profile.stays.length, 3);
});

test("a simulated guest text gets an answer, a request, and a memory", async () => {
  const d = await demoApp();
  const r = await d.call("POST", "/api/demo/inbound", { phone: "+14165550122", body: "Could I get a club sandwich and some extra towels?" });
  assert.equal(r.status, 200);
  assert.equal(r.json.requests.length, 2);
  assert.match(r.json.reply, /shellfish/, "Priya's remembered allergy reaches the kitchen");
  const reqs = (await d.call("GET", "/api/requests?status=new")).json.requests;
  assert(reqs.some((x: any) => /club sandwich.*allergy: shellfish/i.test(x.summary)));
});

test("moving a request on can message the guest", async () => {
  const d = await demoApp();
  const reqs = (await d.call("GET", "/api/requests?status=new")).json.requests;
  const before = d.sms.sent.length;
  const r = await d.call("PATCH", `/api/requests/${reqs[0].id}`, { status: "done", notify: true });
  assert.equal(r.json.request.status, "done");
  assert.equal(d.sms.sent.length, before + 1);
});

test("a staff member can hide a memory and add one", async () => {
  const d = await demoApp();
  const sam = (await d.call("GET", "/api/guests?q=sam")).json.guests[0];
  const profile = (await d.call("GET", `/api/guests/${sam.id}`)).json;
  const pillows = profile.memories.find((m: any) => m.key === "pillows");
  await d.call("PATCH", `/api/memories/${pillows.id}`, { hidden: true });
  const after = (await d.call("GET", `/api/guests/${sam.id}`)).json.memories.find((m: any) => m.key === "pillows");
  assert.equal(after.hidden, true);
  // David doesn't bring it back by learning it again.
  await d.david.handleInbound(d.hotel, { from: sam.phone, body: "I like firm pillows" });
  assert.equal((await d.call("GET", `/api/guests/${sam.id}`)).json.memories.find((m: any) => m.key === "pillows").hidden, true);
  const added = await d.call("POST", `/api/guests/${sam.id}/memories`, { kind: "preference", key: "newspaper", value: "FT every morning" });
  assert.equal(added.status, 201);
  assert.equal(added.json.memory.source, "staff");
});

test("adding a guest with a stay, and refusing bad input", async () => {
  const d = await demoApp();
  const ok = await d.call("POST", "/api/guests", { phone: "(416) 555-0166", firstName: "Ada", consent: true, stay: { arrival: "2026-04-01", departure: "2026-04-04" } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.guest.phone, "+14165550166");
  assert.equal(ok.json.guest.consent, "opted_in");
  assert.equal((await d.call("POST", "/api/guests", { phone: "nope" })).status, 400);
  assert.equal((await d.call("POST", "/api/guests", { phone: "+14165550177", stay: { arrival: "2026-04-04", departure: "2026-04-01" } })).status, 400);
});

test("campaigns can be created, changed, previewed and removed", async () => {
  const d = await demoApp();
  const made = await d.call("POST", "/api/campaigns", { name: "Spa offer", kind: "custom", offsetDays: 1, sendHour: 14, messageMode: "custom", template: "Hi {first_name}, 20% off the spa today." });
  assert.equal(made.status, 201);
  const id = made.json.campaign.id;
  assert.equal((await d.call("PATCH", `/api/campaigns/${id}`, { enabled: false })).json.campaign.enabled, false);
  const sam = (await d.call("GET", "/api/guests?q=sam")).json.guests[0];
  assert.match((await d.call("POST", `/api/campaigns/${id}/preview`, { guestId: sam.id })).json.text, /Hi Sam, 20% off the spa today/);
  assert.equal((await d.call("DELETE", `/api/campaigns/${id}`)).status, 200);
  assert.equal((await d.call("PATCH", `/api/campaigns/${id}`, { enabled: true })).status, 404);
});

test("advancing the demo clock triggers the day's campaigns", async () => {
  const d = await demoApp();
  const r = await d.call("POST", "/api/demo/tick");
  assert(r.json.sent >= 1, "Sam's pre-arrival text is due");
  const sam = (await d.call("GET", "/api/guests?q=sam")).json.guests[0];
  const thread = (await d.call("GET", `/api/guests/${sam.id}`)).json.thread;
  assert(thread.some((m: any) => m.author === "campaign" && /Welcome back/.test(m.body)));
});

test("the Twilio webhook verifies its signature and routes by the hotel's number", async () => {
  const w = await world();
  const app = createApp({ store: w.store, david: w.david, demo: false, twilioAuthToken: "tok", publicUrl: "https://david.example.com" });
  const form = { From: "+14165550111", To: "+14165550100", Body: "extra towels please", MessageSid: "SMabc" };
  const send = (params: Record<string, string>, sig?: string) =>
    app.request("/webhooks/twilio/sms", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...(sig ? { "x-twilio-signature": sig } : {}) }, body: new URLSearchParams(params) });

  assert.equal((await send(form)).status, 403, "no signature");
  assert.equal((await send(form, "bad")).status, 403, "wrong signature");
  const good = twilioSignature("tok", "https://david.example.com/webhooks/twilio/sms", form);
  const res = await send(form, good);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<Response><\/Response>/);
  assert.equal(w.sms.sent.length, 1);
  assert.equal(w.sms.sent[0]!.to, "+14165550111");
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1);

  const stranger = { ...form, To: "+19995550000", MessageSid: "SMdef" };
  assert.equal((await send(stranger, twilioSignature("tok", "https://david.example.com/webhooks/twilio/sms", stranger))).status, 200);
  assert.equal(w.sms.sent.length, 1, "a number that isn't a hotel's gets no reply");
});

test("the status webhook updates delivery", async () => {
  const w = await world();
  const app = createApp({ store: w.store, david: w.david, demo: true });
  await w.david.handleInbound(w.hotel, { from: "+14165550111", body: "towels please" });
  const sid = w.sms.sent[0]!.sid;
  await app.request("/webhooks/twilio/status", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ MessageSid: sid, MessageStatus: "delivered" }) });
  const guest = (await w.store.guestByPhone(w.hotel.id, "+14165550111"))!;
  assert.equal((await w.store.thread(guest.id)).at(-1)!.status, "delivered");
});

test("outside the demo the staff API needs a signed-in user who belongs to the hotel", async () => {
  const w = await world();
  const users: Record<string, { userId: string; email: string }> = { alice: { userId: "11111111-1111-1111-1111-111111111111", email: "a@x.com" }, bob: { userId: "22222222-2222-2222-2222-222222222222", email: "b@x.com" } };
  await w.store.addStaff(users.alice!.userId, w.hotel.id, "a@x.com", "owner");
  const app = createApp({ store: w.store, david: w.david, demo: false, verify: async (t) => users[t] ?? null });
  const get = (path: string, token?: string) => app.request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal((await get("/api/guests")).status, 401);
  assert.equal((await get("/api/guests", "nobody")).status, 401);
  assert.equal((await get("/api/guests", "bob")).status, 403, "signed in, but not staff here");
  assert.equal((await get("/api/guests", "alice")).status, 200);
  const other = await w.store.createHotel({ name: "Other", slug: "other" });
  const r = await app.request("/api/guests", { headers: { authorization: "Bearer alice", "x-hotel-id": other.id } });
  assert.equal(r.status, 403, "asking for a hotel she doesn't belong to is refused, never served");
});

test("a signed-in user can create a hotel and becomes its owner, with the default campaigns", async () => {
  const w = await world();
  const app = createApp({ store: w.store, david: w.david, demo: false, verify: async (t) => (t === "carol" ? { userId: "33333333-3333-3333-3333-333333333333", email: "c@x.com" } : null) });
  const post = (b: unknown, token = "carol") => app.request("/api/hotels", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(b) });
  assert.equal((await post({ name: "New Inn" }, "nobody")).status, 401);
  const res = await post({ name: "New Inn", timezone: "Europe/London" });
  assert.equal(res.status, 201);
  const hotel = ((await res.json()) as any).hotel;
  assert.equal(hotel.slug, "new-inn");
  assert.equal((await post({ name: "New Inn" })).status, 201, "a second hotel with the same name gets its own slug");
  assert.equal((await w.store.campaigns(hotel.id)).length, 5);
  assert.equal((await w.store.hotelsForUser("33333333-3333-3333-3333-333333333333")).length, 2);
  assert.equal((await post({ name: "Bad", timezone: "Mars/Base" })).status, 400);
});

test("the cron endpoint needs its secret", async () => {
  const w = await world({ withCampaigns: true });
  const app = createApp({ store: w.store, david: w.david, demo: false, cronSecret: "s3cret" });
  assert.equal((await app.request("/cron/tick", { method: "POST" })).status, 401);
  assert.equal((await app.request("/cron/tick", { method: "POST", headers: { authorization: "Bearer wrong" } })).status, 401);
  assert.equal((await app.request("/cron/tick", { method: "POST", headers: { authorization: "Bearer s3cret" } })).status, 200);
});

test("today's arrivals show what the guest asked for and how to make the stay theirs", async () => {
  const d = await demoApp();
  const dash = (await d.call("GET", "/api/dashboard")).json;
  const amara = dash.arrivals.find((a: any) => a.guest.firstName === "Amara");
  assert(amara, "Amara arrives today");
  assert.equal(amara.pastStays, 1);
  assert.deepEqual(amara.asked.map((r: any) => r.kind).sort(), ["amenities", "restaurant", "room_service"]);
  assert.equal(amara.stay.notes, "Celebrating her partner's birthday");
  const touches = amara.touches.map((t: any) => t.text);
  assert.match(touches[0], /Welcome back, Amara\. Your 2nd stay/);
  assert(touches.includes("Feather-free pillows on the bed."));
  assert(touches.includes("Handwritten note for their birthday."));
  assert(touches.some((t: string) => /usual: oat flat white/.test(t)));
});
