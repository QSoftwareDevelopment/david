import assert from "node:assert/strict";
import { test } from "node:test";
import { world } from "./helpers.js";

// 11:00 local on 2026-03-10 (Toronto, EDT).
const NOW = new Date("2026-03-10T15:00:00Z");
const PHONE = "+14165550111";

async function guestWithStay(w: Awaited<ReturnType<typeof world>>, opts: { consent?: "opted_in" | "unknown" | "opted_out"; arrival?: string; departure?: string; phone?: string } = {}) {
  const g = await w.store.createGuest({ hotelId: w.hotel.id, phone: opts.phone ?? PHONE, firstName: "Sam", consent: opts.consent ?? "opted_in" });
  const s = await w.store.createStay({ hotelId: w.hotel.id, guestId: g.id, arrival: opts.arrival ?? "2026-03-13", departure: opts.departure ?? "2026-03-16" });
  return { g, s };
}

test("the pre-arrival text goes out on its day, once, and says how to stop", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { g } = await guestWithStay(w);
  const r = await w.david.runTick(w.hotel.id);
  assert.deepEqual(r, { sent: 1, skipped: 0, failed: 0 });
  assert.equal(w.sms.sent.length, 1);
  assert.match(w.sms.sent[0]!.body, /Hi Sam/);
  assert.match(w.sms.sent[0]!.body, /Test Hotel/);
  assert.match(w.sms.sent[0]!.body, /Reply STOP to opt out/, "the first text to a guest says how to opt out");
  assert.equal((await w.store.thread(g.id))[0]!.author, "campaign");
  const again = await w.david.runTick(w.hotel.id);
  assert.equal(again.sent, 0, "ticking again sends nothing");
  assert.equal(w.sms.sent.length, 1);
});

test("a returning guest is welcomed back with something David remembers", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { g } = await guestWithStay(w);
  await w.store.createStay({ hotelId: w.hotel.id, guestId: g.id, arrival: "2025-12-01", departure: "2025-12-04" });
  await w.store.learn(w.hotel.id, g.id, { kind: "preference", key: "pillows", value: "firm pillows", source: "guest" }, new Date("2025-12-02T12:00:00Z"));
  await w.david.runTick(w.hotel.id);
  const text = w.sms.sent[0]!.body;
  assert.match(text, /Welcome back/);
  assert.match(text, /firm pillows/);
});

test("a guest who has not said yes is not texted, until they do", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { g } = await guestWithStay(w, { consent: "unknown" });
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 0);
  await w.store.setConsent(g.id, "opted_in", "booking_form");
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 1, "sent as soon as consent is on file");
});

test("an opted-out guest is never texted, and it is recorded once", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  await guestWithStay(w, { consent: "opted_out" });
  const first = await w.david.runTick(w.hotel.id);
  assert.deepEqual([first.sent, first.skipped], [0, 1]);
  const second = await w.david.runTick(w.hotel.id);
  assert.deepEqual([second.sent, second.skipped], [0, 0]);
  assert.equal(w.sms.sent.length, 0);
});

test("quiet hours hold the text until morning", async () => {
  const w = await world({ now: new Date("2026-03-11T02:30:00Z"), withCampaigns: true }); // 22:30 local on the 10th
  await guestWithStay(w);
  const [pre] = await w.store.campaigns(w.hotel.id);
  await w.store.updateCampaign(pre!.id, { sendHour: 20 });
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 0, "22:30 is quiet");
  w.clock.now = new Date("2026-03-11T12:05:00Z"); // 08:05 local
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 1, "sent at 08:05");
});

test("a hotel can write the words itself", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  await guestWithStay(w);
  const [pre] = await w.store.campaigns(w.hotel.id);
  await w.store.updateCampaign(pre!.id, { messageMode: "custom", template: "Hi {first_name}! {hotel} here. Room ready from {checkin}." });
  await w.david.runTick(w.hotel.id);
  assert.equal(w.sms.sent[0]!.body, "Hi Sam! Test Hotel here. Room ready from 15:00. - David Reply STOP to opt out.");
});

test("a campaign that is switched off sends nothing", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  await guestWithStay(w);
  for (const c of await w.store.campaigns(w.hotel.id)) await w.store.updateCampaign(c.id, { enabled: false });
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 0);
});

test("the thank-you goes out the day after they leave", async () => {
  const w = await world({ now: new Date("2026-03-17T15:00:00Z"), withCampaigns: true });
  await guestWithStay(w, { arrival: "2026-03-13", departure: "2026-03-16" });
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 1);
  assert.match(w.sms.sent[0]!.body, /Thank you for staying/);
});

test("stay statuses follow the dates", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { s } = await guestWithStay(w, { arrival: "2026-03-09", departure: "2026-03-12" });
  await w.david.runTick(w.hotel.id);
  assert.equal((await w.store.staysOf(s.guestId))[0]!.status, "in_house");
  w.clock.now = new Date("2026-03-13T15:00:00Z");
  await w.david.runTick(w.hotel.id);
  assert.equal((await w.store.staysOf(s.guestId))[0]!.status, "departed");
});

test("campaigns only reach their own hotel's guests", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const other = await w.store.createHotel({ name: "Other", slug: "other", smsNumber: "+14165550200" });
  const g = await w.store.createGuest({ hotelId: other.id, phone: "+14165550222", firstName: "Lee", consent: "opted_in" });
  await w.store.createStay({ hotelId: other.id, guestId: g.id, arrival: "2026-03-13", departure: "2026-03-15" });
  assert.equal((await w.david.runTick(w.hotel.id)).sent, 0, "the other hotel has no campaigns of its own, and is not ours to text");
});

test("a campaign can be previewed for a real guest without sending", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { g } = await guestWithStay(w);
  await w.store.learn(w.hotel.id, g.id, { kind: "preference", key: "coffee", value: "oat flat white", source: "guest" }, NOW);
  const [pre] = await w.store.campaigns(w.hotel.id);
  const text = await w.david.preview(w.hotel, pre!.id, g.id);
  assert.match(text, /Sam/);
  assert.match(text, /oat flat white/);
  assert.equal(w.sms.sent.length, 0);
  assert.match(await w.david.preview(w.hotel, pre!.id, null), /Alex/, "a sample guest when none is chosen");
});

test("the dashboard counts what staff scan for", async () => {
  const w = await world({ now: NOW, withCampaigns: true });
  const { g } = await guestWithStay(w, { arrival: "2026-03-10", departure: "2026-03-12" });
  await w.david.handleInbound(w.hotel, { from: g.phone, body: "extra towels please, urgent leak in the bathroom" });
  const d = await w.store.dashboard(w.hotel.id, "2026-03-10");
  assert.equal(d.arrivalsToday, 1);
  assert.equal(d.inHouse, 1);
  assert(d.openRequests >= 1);
  assert.equal(d.guestsTotal, 1);
});
