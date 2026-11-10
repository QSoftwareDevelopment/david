import assert from "node:assert/strict";
import { test } from "node:test";
import { fillTemplate, planDue, type DueInput } from "../src/campaigns.js";
import type { Campaign, Guest, Hotel, Stay } from "../src/types.js";

const hotel: Hotel = { id: "h", name: "Test", slug: "t", timezone: "America/Toronto", smsNumber: null, tone: "", signature: "", quietStart: 21, quietEnd: 8, checkinTime: "15:00", checkoutTime: "11:00" };
const guest = (p: Partial<Guest> = {}): Guest => ({ id: "g1", hotelId: "h", phone: "+14165550111", firstName: "Sam", lastName: null, language: "en", consent: "opted_in", consentAt: null, vip: false, notes: null, createdAt: "", ...p });
const stay = (p: Partial<Stay> = {}): Stay => ({ id: "s1", hotelId: "h", guestId: "g1", room: null, arrival: "2026-03-13", departure: "2026-03-16", partySize: 2, status: "booked", notes: null, ...p });
const camp = (p: Partial<Campaign> = {}): Campaign => ({ id: "c1", hotelId: "h", name: "x", kind: "pre_arrival", enabled: true, offsetDays: -3, sendHour: 10, messageMode: "generated", template: "", guidance: "", audience: {}, ...p });

// 11:00 in Toronto on 2026-03-10 (EDT)
const NOW = new Date("2026-03-10T15:00:00Z");
const input = (p: Partial<DueInput> = {}): DueInput => ({ now: NOW, hotel, campaigns: [camp()], stays: [{ stay: stay(), guest: guest(), pastStays: 0 }], sent: new Set(), lastOutbound: new Map(), ...p });

test("a campaign is due from its hour on its day, and not before", () => {
  assert.equal(planDue(input()).due.length, 1);
  assert.equal(planDue(input({ now: new Date("2026-03-10T13:00:00Z") })).due.length, 0, "09:00 is before the 10:00 send time");
  assert.equal(planDue(input({ now: new Date("2026-03-09T15:00:00Z") })).due.length, 0, "the day before");
});

test("a missed moment is still sent for a while, then dropped", () => {
  assert.equal(planDue(input({ now: new Date("2026-03-11T13:00:00Z") })).due.length, 1, "next morning at 09:00, 23 hours late");
  assert.equal(planDue(input({ now: new Date("2026-03-11T22:00:00Z") })).due.length, 0, "more than a day late");
});

test("a late catch-up never talks about an arrival that has already happened", () => {
  // Arrival day was 2026-03-10 at 10:00; the next morning is within the grace window but the guest is already here.
  const arrival = camp({ kind: "arrival_day", offsetDays: 0 });
  const here = stay({ arrival: "2026-03-10", departure: "2026-03-13" });
  assert.equal(planDue(input({ campaigns: [arrival], stays: [{ stay: here, guest: guest(), pastStays: 0 }] })).due.length, 1, "on the day");
  assert.equal(planDue(input({ now: new Date("2026-03-11T13:00:00Z"), campaigns: [arrival], stays: [{ stay: here, guest: guest(), pastStays: 0 }] })).due.length, 0, "the day after");
  // Pre-arrival due 2026-03-09 at 10:00, caught up on arrival day: too late.
  const pre = camp({ kind: "pre_arrival", offsetDays: -1 });
  assert.equal(planDue(input({ now: new Date("2026-03-10T13:00:00Z"), campaigns: [pre], stays: [{ stay: here, guest: guest(), pastStays: 0 }] })).due.length, 0, "on arrival day");
});

test("nothing is sent twice", () => {
  assert.equal(planDue(input({ sent: new Set(["c1:s1"]) })).due.length, 0);
});

test("consent is required, and an opt-out is permanent", () => {
  const unknown = planDue(input({ stays: [{ stay: stay(), guest: guest({ consent: "unknown" }), pastStays: 0 }] }));
  assert.equal(unknown.due.length, 0);
  assert.deepEqual([unknown.skipped[0]!.reason, unknown.skipped[0]!.retry], ["no_consent", true]);
  const out = planDue(input({ stays: [{ stay: stay(), guest: guest({ consent: "opted_out" }), pastStays: 0 }] }));
  assert.deepEqual([out.skipped[0]!.reason, out.skipped[0]!.retry], ["opted_out", false]);
});

test("quiet hours hold a message until morning", () => {
  const night = new Date("2026-03-11T02:30:00Z"); // 22:30 local
  const evening = camp({ sendHour: 20, offsetDays: -3 }); // due 2026-03-10 20:00 local, 2.5h ago
  const r = planDue(input({ now: night, campaigns: [evening] }));
  assert.equal(r.due.length, 0);
  assert.deepEqual([r.skipped[0]!.reason, r.skipped[0]!.retry], ["quiet_hours", true]);
  const morning = new Date("2026-03-11T12:05:00Z"); // 08:05 local, 12h after
  assert.equal(planDue(input({ now: morning, campaigns: [evening] })).due.length, 1);
});

test("audiences: repeat guests only, VIPs only, minimum nights", () => {
  const repeat = camp({ audience: { repeatOnly: true } });
  assert.equal(planDue(input({ campaigns: [repeat] })).due.length, 0);
  assert.equal(planDue(input({ campaigns: [repeat], stays: [{ stay: stay(), guest: guest(), pastStays: 2 }] })).due.length, 1);
  assert.equal(planDue(input({ campaigns: [camp({ audience: { vipOnly: true } })] })).due.length, 0);
  assert.equal(planDue(input({ campaigns: [camp({ audience: { minNights: 5 } })] })).due.length, 0);
  assert.equal(planDue(input({ campaigns: [camp({ audience: { minNights: 3 } })] })).due.length, 1);
});

test("a guest gets at most one campaign text a day", () => {
  const two = [camp(), camp({ id: "c2", kind: "arrival_day", offsetDays: -3, sendHour: 10 })];
  assert.equal(planDue(input({ campaigns: two })).due.length, 1);
  const recent = new Map([["g1", new Date(NOW.getTime() - 3_600_000)]]);
  assert.equal(planDue(input({ lastOutbound: recent })).due.length, 0, "already texted an hour ago");
});

test("post-stay messages count from departure", () => {
  const post = camp({ kind: "post_stay", offsetDays: 1, sendHour: 11 });
  // departure 2026-03-16 +1 = 03-17 11:00 local
  assert.equal(planDue(input({ now: new Date("2026-03-17T15:00:00Z"), campaigns: [post] })).due.length, 1);
  assert.equal(planDue(input({ campaigns: [post] })).due.length, 0);
});

test("win-back goes to a past guest once, and not if they have booked again", () => {
  const win = camp({ id: "w", kind: "win_back", offsetDays: 75, sendHour: 11 });
  const away = new Date("2026-05-31T15:00:00Z"); // 2026-03-16 + 75d = 2026-05-30 -> due 05-30 11:00, still within grace on 05-31 10:00? use 05-30
  const day = new Date("2026-05-30T15:00:00Z");
  assert.equal(planDue(input({ now: day, campaigns: [win] })).due.length, 1);
  void away;
  const rebooked = [
    { stay: stay(), guest: guest(), pastStays: 0 },
    { stay: stay({ id: "s2", arrival: "2026-06-10", departure: "2026-06-12" }), guest: guest(), pastStays: 1 },
  ];
  assert.equal(planDue(input({ now: day, campaigns: [win], stays: rebooked })).due.length, 0);
  assert.equal(planDue(input({ now: day, campaigns: [win], sent: new Set(["w:guest:g1"]) })).due.length, 0);
});

test("disabled campaigns and cancelled stays are ignored", () => {
  assert.equal(planDue(input({ campaigns: [camp({ enabled: false })] })).due.length, 0);
  assert.equal(planDue(input({ stays: [{ stay: stay({ status: "cancelled" }), guest: guest(), pastStays: 0 }] })).due.length, 0);
});

test("templates fill in the guest's details", () => {
  const out = fillTemplate("Hi {first_name}, {hotel} is ready from {checkin}. Room {room}.", { firstName: "Sam", hotel: "Test", arrival: "Friday", room: "804", checkin: "15:00", checkout: "11:00" });
  assert.equal(out, "Hi Sam, Test is ready from 15:00. Room 804.");
});
