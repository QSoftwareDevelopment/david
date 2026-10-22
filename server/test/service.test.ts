import assert from "node:assert/strict";
import { test } from "node:test";
import { world } from "./helpers.js";

const GUEST = "+14165550111";
const inbound = (w: Awaited<ReturnType<typeof world>>, body: string, from = GUEST, sid?: string) => w.david.handleInbound(w.hotel, { from, body, sid });

test("a first text creates the guest, answers, and logs the request", async () => {
  const w = await world();
  const r = await inbound(w, "Hi, could I get extra towels please?");
  assert.equal(r.source, "rules");
  assert.equal(r.requests.length, 1);
  assert.equal(r.requests[0]!.kind, "housekeeping");
  assert.equal(r.requests[0]!.status, "new");
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  assert.equal(guest.consent, "opted_in", "they texted us, so we may answer");
  assert.equal(w.sms.sent.length, 1);
  assert.equal(w.sms.sent[0]!.to, GUEST);
  assert.equal(w.sms.sent[0]!.from, "+14165550100");
  assert.match(w.sms.sent[0]!.body, /arranged housekeeping/i);
  const thread = await w.store.thread(guest.id);
  assert.deepEqual(thread.map((m) => [m.direction, m.author]), [["in", "guest"], ["out", "david"]]);
});

test("the same Twilio message is never handled twice", async () => {
  const w = await world();
  await inbound(w, "towels please", GUEST, "SM123");
  const again = await inbound(w, "towels please", GUEST, "SM123");
  assert.equal(again.duplicate, true);
  assert.equal(w.sms.sent.length, 1);
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1);
});

test("rephrasing a request within minutes does not create a second one", async () => {
  const w = await world();
  await inbound(w, "extra towels please");
  await inbound(w, "sorry, could I get some more towels?");
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1);
});

test("STOP ends the conversation for good; START brings it back", async () => {
  const w = await world();
  await inbound(w, "towels please");
  const stop = await inbound(w, "STOP");
  assert.equal(stop.source, "command");
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  assert.equal(guest.consent, "opted_out");
  const before = w.sms.sent.length;
  const silent = await inbound(w, "I need laundry");
  assert.equal(silent.reply, null, "no answer to an opted-out guest");
  assert.equal(w.sms.sent.length, before, "nothing sent");
  assert.equal((await w.store.thread(guest.id)).at(-1)!.body, "I need laundry", "but staff can still see it");
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1, "and no request was made");
  await inbound(w, "START");
  assert.equal((await w.store.guestByPhone(w.hotel.id, GUEST))!.consent, "opted_in");
  assert((await inbound(w, "I need laundry")).requests.length === 1);
});

test("a new number that texts STOP first is recorded as opted out", async () => {
  const w = await world();
  await inbound(w, "stop", "+14165550999");
  assert.equal((await w.store.guestByPhone(w.hotel.id, "+14165550999"))!.consent, "opted_out");
});

test("HELP gets the help text", async () => {
  const w = await world();
  const r = await inbound(w, "HELP");
  assert.match(r.reply!, /Reply STOP to opt out/);
});

test("David remembers what a guest says and keeps it for next time", async () => {
  const w = await world();
  await inbound(w, "I'm allergic to shellfish and I like firm pillows");
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  const mems = await w.store.memories(guest.id);
  assert.deepEqual(mems.map((m) => `${m.kind}:${m.key}:${m.value}`).sort(), ["dietary:allergy:shellfish", "preference:pillows:firm pillows"]);
  assert.match(w.sms.sent[0]!.body, /noted/i);
});

test("a remembered allergy travels with every food order", async () => {
  const w = await world();
  await inbound(w, "I'm allergic to shellfish");
  const r = await inbound(w, "Can I get a club sandwich?");
  assert.match(r.requests[0]!.summary, /\[allergy: shellfish\]/);
  assert.match(w.sms.sent.at(-1)!.body, /shellfish allergy to the kitchen/);
});

test("repeat orders become a habit, and David offers it instead of assuming", async () => {
  const w = await world();
  // A guest on their own, ordering the same coffee on three mornings.
  for (const day of ["2026-03-01", "2026-03-02", "2026-03-03"]) {
    w.clock.now = new Date(`${day}T12:10:00Z`); // 07:10 local
    const r = await inbound(w, "Could I get an oat flat white please");
    await w.store.updateRequest(r.requests[0]!.id, { status: "done" });
  }
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  const habit = (await w.store.memories(guest.id)).find((m) => m.kind === "habit" && m.key === "usual room service");
  assert(habit, "a habit was learned");
  assert.match(habit!.value, /oat flat white, usually in the morning/i);
  assert.equal(habit!.source, "observed");
  assert(habit!.evidence >= 1);

  w.clock.now = new Date("2026-03-04T12:30:00Z");
  const vague = await inbound(w, "Can I order some room service?");
  assert.match(vague.reply!, /usual/i);
  assert.match(vague.reply!, /oat flat white/i);
  const yes = await inbound(w, "yes");
  assert.equal(yes.requests[0]?.kind, "room_service");
  assert.match(yes.requests[0]!.summary, /oat flat white/i);
});

test("a complaint brings in a person", async () => {
  const w = await world();
  const r = await inbound(w, "This is unacceptable, the room is filthy. I want the manager.");
  assert.equal(r.escalated, true);
  const open = await w.store.listRequests(w.hotel.id);
  assert(open.some((x) => x.priority === "urgent" && x.kind === "other"));
  assert.match(w.sms.sent[0]!.body, /duty manager/i);
});

test("small talk gets a friendly answer and no request", async () => {
  const w = await world();
  const r = await inbound(w, "thanks!");
  assert.equal(r.requests.length, 0);
  assert(r.reply);
});

test("David gives up guessing after two tries and asks a person to step in", async () => {
  const w = await world();
  await inbound(w, "hmm what about the thing");
  await inbound(w, "you know, the thing from before");
  const third = await inbound(w, "the thing??");
  assert.equal(third.escalated, true);
});

test("staff can write to a guest, but not to one who opted out", async () => {
  const w = await world();
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Sam", consent: "opted_in" });
  await w.david.staffReply(w.hotel, guest.id, "Your table is ready.");
  assert.equal(w.sms.sent.at(-1)!.body, "Your table is ready.");
  assert.equal((await w.store.thread(guest.id)).at(-1)!.author, "staff");
  await w.store.setConsent(guest.id, "opted_out", "test");
  await assert.rejects(w.david.staffReply(w.hotel, guest.id, "hello"), /opted out/);
});

test("marking a request done can tell the guest", async () => {
  const w = await world();
  const r = await inbound(w, "extra towels please");
  const before = w.sms.sent.length;
  await w.david.setRequestStatus(w.hotel, r.requests[0]!.id, "done", true);
  assert.equal(w.sms.sent.length, before + 1);
  assert.match(w.sms.sent.at(-1)!.body, /all taken care of: (extra )?towels\./);
  const quiet = await inbound(w, "I need laundry done");
  await w.david.setRequestStatus(w.hotel, quiet.requests[0]!.id, "in_progress", false);
  assert.equal(w.sms.sent.length, before + 2, "only David's reply to the laundry text; no notification");
});

test("a send that fails is recorded, not lost", async () => {
  const w = await world();
  w.sms.send = async () => { throw new Error("carrier down"); };
  const r = await inbound(w, "extra towels please");
  assert.equal(r.requests.length, 1, "the request is still logged");
  const guest = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  assert.equal((await w.store.thread(guest.id)).at(-1)!.status, "failed");
});

test("hotels cannot see each other's guests, requests or memories", async () => {
  const w = await world();
  const other = await w.store.createHotel({ name: "Other", slug: "other", smsNumber: "+14165550200" });
  await inbound(w, "I'm allergic to nuts, and can I get towels");
  assert.equal(await w.store.guestByPhone(other.id, GUEST), null);
  assert.deepEqual(await w.store.listRequests(other.id), []);
  const again = await w.david.handleInbound(other, { from: GUEST, body: "hello" });
  assert.deepEqual(await w.store.memories(again.guestId!), [], "the same phone is a stranger at another hotel");
  const mine = (await w.store.guestByPhone(w.hotel.id, GUEST))!;
  assert.notEqual(mine.id, again.guestId);
});
