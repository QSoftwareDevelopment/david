import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultCampaigns } from "../src/campaigns.js";
import { createApp } from "../src/http.js";
import { RecordingSms, TwilioSms, addressFor, parseAddress, twilioSignature } from "../src/sms.js";
import { world } from "./helpers.js";

const GUEST = "+14165550111";
const SMS_NUMBER = "+14165550100";
const WA_NUMBER = "+14155238886";
const TEMPLATE = "HX" + "a".repeat(32);

async function waWorld(now = new Date("2026-03-10T15:00:00Z")) {
  const w = await world({ now, withCampaigns: true });
  await w.store.updateHotel(w.hotel.id, { whatsappNumber: WA_NUMBER });
  const hotel = (await w.store.hotel(w.hotel.id))!;
  const app = createApp({ store: w.store, david: w.david, demo: false, twilioAuthToken: "tok", publicUrl: "https://david.test" });
  const webhook = async (params: Record<string, string>) => {
    const url = "https://david.test/webhooks/twilio/sms";
    const res = await app.request("/webhooks/twilio/sms", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilioSignature("tok", url, params) },
      body: new URLSearchParams(params),
    });
    return res.status;
  };
  return { ...w, hotel, app, webhook };
}

test("WhatsApp addresses split into a phone and a channel", () => {
  assert.deepEqual(parseAddress("whatsapp:+14165550111"), { phone: "+14165550111", channel: "whatsapp" });
  assert.deepEqual(parseAddress("WhatsApp: +1 (416) 555-0111"), { phone: "+14165550111", channel: "whatsapp" });
  assert.deepEqual(parseAddress("+14165550111"), { phone: "+14165550111", channel: "sms" });
  assert.deepEqual(parseAddress("whatsapp:nonsense"), { phone: null, channel: "whatsapp" });
  assert.equal(addressFor("+14165550111", "whatsapp"), "whatsapp:+14165550111");
  assert.equal(addressFor("+14165550111", "sms"), "+14165550111");
});

test("Twilio is asked for WhatsApp with the whatsapp: prefix, and for templates with a Content SID and no body", async () => {
  const calls: URLSearchParams[] = [];
  const fake = (async (_u: string, init?: RequestInit) => { calls.push(init!.body as URLSearchParams); return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }); }) as unknown as typeof fetch;
  const t = new TwilioSms("AC1", "tok", fake);
  await t.send({ from: WA_NUMBER, to: GUEST, body: "Hello", channel: "whatsapp" });
  await t.send({ from: WA_NUMBER, to: GUEST, body: "ignored", channel: "whatsapp", template: { contentSid: TEMPLATE, variables: { "1": "Sam", "2": "Harbour House" } } });
  await t.send({ from: SMS_NUMBER, to: GUEST, body: "Plain text" });
  assert.deepEqual(Object.fromEntries(calls[0]!), { From: `whatsapp:${WA_NUMBER}`, To: `whatsapp:${GUEST}`, Body: "Hello" });
  assert.deepEqual(Object.fromEntries(calls[1]!), { From: `whatsapp:${WA_NUMBER}`, To: `whatsapp:${GUEST}`, ContentSid: TEMPLATE, ContentVariables: '{"1":"Sam","2":"Harbour House"}' });
  assert.deepEqual(Object.fromEntries(calls[2]!), { From: SMS_NUMBER, To: GUEST, Body: "Plain text" });
});

test("a WhatsApp message to the hotel's WhatsApp number is answered on WhatsApp, from that number", async () => {
  const w = await waWorld();
  const status = await w.webhook({ From: `whatsapp:${GUEST}`, To: `whatsapp:${WA_NUMBER}`, Body: "extra towels please", MessageSid: "SMwa1" });
  assert.equal(status, 200);
  assert.equal(w.sms.sent.length, 1);
  assert.equal(w.sms.sent[0]!.channel, "whatsapp");
  assert.equal(w.sms.sent[0]!.from, WA_NUMBER);
  assert.equal(w.sms.sent[0]!.to, GUEST);
  assert.match(w.sms.sent[0]!.body, /housekeeping/i);
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  assert.equal(guest.channel, "whatsapp");
  assert.deepEqual((await w.store.thread(guest.id)).map((m) => [m.direction, m.channel]), [["in", "whatsapp"], ["out", "whatsapp"]]);
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1, "same requests as over SMS");
});

test("the same person is one guest on both apps, and David follows them", async () => {
  const w = await waWorld();
  await w.webhook({ From: GUEST, To: SMS_NUMBER, Body: "hi", MessageSid: "SMa" });
  await w.webhook({ From: `whatsapp:${GUEST}`, To: `whatsapp:${WA_NUMBER}`, Body: "a club sandwich please", MessageSid: "SMb" });
  await w.webhook({ From: GUEST, To: SMS_NUMBER, Body: "extra towels", MessageSid: "SMc" });
  assert.equal((await w.store.listGuests(w.hotel.id)).length, 1);
  assert.deepEqual(w.sms.sent.map((m) => m.channel ?? "sms"), ["sms", "whatsapp", "sms"]);
  assert.equal(w.sms.sent[2]!.from, SMS_NUMBER);
});

test("a WhatsApp message to a number that isn't the hotel's is ignored, and so is a hotel with no WhatsApp number", async () => {
  const w = await waWorld();
  await w.webhook({ From: `whatsapp:${GUEST}`, To: "whatsapp:+14155550000", Body: "hello", MessageSid: "SMx" });
  assert.equal(w.sms.sent.length, 0);
  await w.store.updateHotel(w.hotel.id, { whatsappNumber: null });
  await w.webhook({ From: `whatsapp:${GUEST}`, To: `whatsapp:${WA_NUMBER}`, Body: "hello", MessageSid: "SMy" });
  assert.equal(w.sms.sent.length, 0);
});

test("STOP on WhatsApp opts the guest out everywhere", async () => {
  const w = await waWorld();
  await w.webhook({ From: `whatsapp:${GUEST}`, To: `whatsapp:${WA_NUMBER}`, Body: "STOP", MessageSid: "SMs" });
  assert.equal((await w.store.guestByPhone(w.hotel.id, GUEST))!.consent, "opted_out");
  assert.equal(w.sms.sent[0]!.channel, "whatsapp");
  assert.match(w.sms.sent[0]!.body, /unsubscribed|won't text/i);
});

// ── David speaks first ─────────────────────────────────────

async function guestOnWhatsApp(w: Awaited<ReturnType<typeof waWorld>>, arrival: string, lastWroteHoursAgo: number) {
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Sam", lastName: "Rivera", consent: "opted_in", consentSource: "booking_form" });
  await w.store.setGuestChannel(guest.id, "whatsapp");
  await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, arrival, departure: "2026-03-20" });
  await w.store.addMessage({ hotelId: w.hotel.id, guestId: guest.id, direction: "in", author: "guest", body: "hi", channel: "whatsapp", at: new Date(w.clock.now.getTime() - lastWroteHoursAgo * 3600_000) });
  return guest;
}

test("inside the 24-hour window a campaign goes out as ordinary WhatsApp text", async () => {
  const w = await waWorld();
  await guestOnWhatsApp(w, "2026-03-13", 3);
  const t = await w.david.runTick(w.hotel.id);
  assert.equal(t.sent, 1);
  assert.equal(w.sms.sent[0]!.channel, "whatsapp");
  assert.equal(w.sms.sent[0]!.template, undefined);
  assert.match(w.sms.sent[0]!.body, /Hi Sam/);
});

test("outside the window it uses the hotel's approved template, with the guest's name and the hotel", async () => {
  const w = await waWorld();
  await w.store.updateHotel(w.hotel.id, { whatsappTemplates: { pre_arrival: TEMPLATE } });
  const guest = await guestOnWhatsApp(w, "2026-03-13", 60);
  const t = await w.david.runTick(w.hotel.id);
  assert.equal(t.sent, 1);
  const sent = w.sms.sent[0]!;
  assert.equal(sent.channel, "whatsapp");
  assert.deepEqual(sent.template, { contentSid: TEMPLATE, variables: { "1": "Sam", "2": "Test Hotel" } });
  const last = (await w.store.thread(guest.id)).at(-1)!;
  assert.equal(last.channel, "whatsapp");
  assert.match(last.body, /^\[WhatsApp template: Before you arrive\]$/);
});

test("outside the window with no template, David texts them instead rather than failing", async () => {
  const w = await waWorld();
  await guestOnWhatsApp(w, "2026-03-13", 60);
  await w.david.runTick(w.hotel.id);
  assert.equal(w.sms.sent.length, 1);
  assert.equal(w.sms.sent[0]!.channel, "sms");
  assert.equal(w.sms.sent[0]!.from, SMS_NUMBER);
});

// ── Settings ───────────────────────────────────────────────

test("the hotel's WhatsApp number and templates are validated and saved", async () => {
  const w = await waWorld();
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms });
  const patch = async (body: unknown) => {
    const res = await app.request("/api/hotel", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as any };
  };
  assert.equal((await patch({ whatsappNumber: "nope" })).status, 400);
  assert.equal((await patch({ whatsappTemplates: { pre_arrival: "not-a-sid" } })).status, 400);
  const ok = await patch({ whatsappNumber: "whatsapp:+1 415 523 8886", whatsappTemplates: { pre_arrival: TEMPLATE, post_stay: TEMPLATE } });
  assert.equal(ok.json.hotel.whatsappNumber, "+14155238886");
  assert.deepEqual(ok.json.hotel.whatsappTemplates, { pre_arrival: TEMPLATE, post_stay: TEMPLATE });
  const cleared = await patch({ whatsappTemplates: { post_stay: "" } });
  assert.deepEqual(cleared.json.hotel.whatsappTemplates, { pre_arrival: TEMPLATE }, "a blank removes just that one");
  assert.equal((await patch({ whatsappNumber: "" })).json.hotel.whatsappNumber, null);
});

test("the demo can text David as a WhatsApp guest", async () => {
  const w = await waWorld();
  await w.store.updateHotel(w.hotel.id, { whatsappNumber: WA_NUMBER });
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: new RecordingSms() });
  const res = await app.request("/api/demo/inbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: GUEST, body: "hello", channel: "whatsapp" }) });
  assert.equal(res.status, 200);
  assert.equal((await w.store.guestByPhone(w.hotel.id, GUEST))!.channel, "whatsapp");
});
