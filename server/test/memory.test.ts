import assert from "node:assert/strict";
import { test } from "node:test";
import { currentConfidence, habitsFrom, merge, recall, describe } from "../src/memory.js";
import type { GuestRequest, Memory } from "../src/types.js";

const now = new Date("2026-03-10T12:00:00Z");
const mem = (p: Partial<Memory> = {}): Memory => ({
  id: "m", guestId: "g", kind: "preference", key: "pillows", value: "firm pillows", confidence: 0.8, evidence: 1, source: "guest",
  hidden: false, firstSeen: now.toISOString(), lastSeen: now.toISOString(), ...p,
});

test("a first sighting starts at a confidence set by where it came from", () => {
  const guest = merge(null, { kind: "preference", key: "pillows", value: "firm", source: "guest" }, now)!;
  const seen = merge(null, { kind: "habit", key: "x", value: "y", source: "observed" }, now)!;
  assert(guest.confidence > seen.confidence);
  assert.equal(guest.evidence, 1);
  assert.equal(merge(null, { kind: "dietary", key: "allergy", value: "nuts", source: "guest" }, now)!.confidence, 0.95);
});

test("seeing the same thing again raises confidence and counts the evidence", () => {
  const first = merge(null, { kind: "habit", key: "usual", value: "oat flat white", source: "observed" }, now)!;
  const second = merge({ ...mem(), ...first, id: "m", guestId: "g" }, { kind: "habit", key: "usual", value: "Oat Flat White", source: "observed" }, now)!;
  assert(second.confidence > first.confidence);
  assert.equal(second.evidence, 2);
  assert.equal(second.value, "oat flat white", "the original wording is kept");
});

test("what a guest said is not overwritten by something David inferred", () => {
  const held = mem({ source: "guest", confidence: 0.8, value: "firm pillows" });
  const out = merge(held, { kind: "preference", key: "pillows", value: "soft pillows", source: "observed" }, now)!;
  assert.equal(out.value, "firm pillows");
  assert(out.confidence < 0.8, "doubt creeps in, but the guest's words stand");
});

test("what a guest says now replaces an older inference", () => {
  const held = mem({ source: "observed", confidence: 0.6, value: "soft pillows" });
  const out = merge(held, { kind: "preference", key: "pillows", value: "firm pillows", source: "guest" }, now)!;
  assert.equal(out.value, "firm pillows");
  assert.equal(out.source, "guest");
});

test("a memory staff have hidden stays hidden", () => {
  assert.equal(merge(mem({ hidden: true }), { kind: "preference", key: "pillows", value: "firm pillows", source: "guest" }, now), null);
});

test("confidence fades with time, but never for dietary needs", () => {
  const old = new Date("2025-03-10T12:00:00Z").toISOString();
  assert(currentConfidence(mem({ lastSeen: old }), now) < 0.8);
  assert(currentConfidence(mem({ lastSeen: old }), now) >= 0.8 * 0.33 - 1e-9);
  assert.equal(currentConfidence(mem({ kind: "dietary", lastSeen: old }), now), 0.8);
});

test("recall puts dietary needs first and drops hidden and faded facts", () => {
  const list = recall([
    mem({ id: "1", kind: "habit", key: "a", confidence: 0.9 }),
    mem({ id: "2", kind: "dietary", key: "allergy", value: "nuts", confidence: 0.95 }),
    mem({ id: "3", kind: "preference", key: "b", hidden: true }),
    mem({ id: "4", kind: "preference", key: "c", confidence: 0.1 }),
    mem({ id: "5", kind: "occasion", key: "anniversary", confidence: 0.8 }),
  ], now);
  assert.deepEqual(list.map((m) => m.id), ["2", "5", "1"]);
});

test("describe says when David is not certain", () => {
  assert.match(describe(mem({ confidence: 0.3 }), now), /not certain/);
  assert.doesNotMatch(describe(mem({ confidence: 0.9 }), now), /not certain/);
});

const req = (p: Partial<GuestRequest>): GuestRequest => ({
  id: "r", hotelId: "h", guestId: "g", stayId: null, kind: "room_service", summary: "", details: {}, status: "done", priority: "normal", createdBy: "david",
  createdAt: "2026-02-01T12:00:00Z", updatedAt: "", completedAt: null, ...p,
});

test("one order is not a habit; the same order again, at the same time of day, is", () => {
  const one = [req({ details: { items: ["oat flat white"] } })];
  assert.deepEqual(habitsFrom(one, "America/Toronto"), []);
  const three = [0, 1, 2].map((i) => req({ id: String(i), details: { items: ["Oat flat white"] }, createdAt: `2026-02-0${i + 1}T12:15:00Z` }));
  const habits = habitsFrom(three, "America/Toronto");
  assert.equal(habits.length, 1);
  assert.match(habits[0]!.value, /Oat flat white, usually in the morning/);
  assert.equal(habits[0]!.source, "observed");
});

test("cancelled requests teach nothing", () => {
  const rs = [0, 1].map((i) => req({ id: String(i), status: "cancelled", details: { items: ["pizza"] } }));
  assert.deepEqual(habitsFrom(rs, "America/Toronto"), []);
});

test("regular laundry or housekeeping asks become a timing habit", () => {
  const rs = [0, 1].map((i) => req({ id: String(i), kind: "laundry", createdAt: `2026-02-0${i + 1}T14:00:00Z` }));
  assert.match(habitsFrom(rs, "America/Toronto")[0]!.value, /laundry in the morning/);
});
