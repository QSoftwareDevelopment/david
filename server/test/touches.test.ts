import assert from "node:assert/strict";
import { test } from "node:test";
import { roomTouches } from "../src/touches.js";
import type { Memory } from "../src/types.js";

const mem = (kind: Memory["kind"], key: string, value: string, source: Memory["source"] = "guest", hidden = false): Memory => ({
  id: key, guestId: "g", kind, key, value, confidence: 0.8, evidence: 2, source, hidden, firstSeen: "2026-01-01T00:00:00Z", lastSeen: "2026-01-01T00:00:00Z",
});
const stay = { notes: null };

test("a returning guest gets a welcome-back note and touches from what David knows", () => {
  const t = roomTouches({
    memories: [mem("preference", "pillows", "firm pillows"), mem("habit", "usual room service", "oat flat white, usually in the morning", "observed"), mem("occasion", "anniversary", "here for an anniversary"), mem("dietary", "allergy", "shellfish")],
    pastStays: 2, stay, firstName: "Sam", vip: false,
  });
  assert.match(t[0]!.text, /Welcome back, Sam\. Your 3rd stay/);
  assert.equal(t[0]!.because, "2 past stays");
  const text = t.map((x) => x.text);
  assert(text.includes("Firm pillows on the bed."));
  assert(text.includes("Leave a card offering their usual: oat flat white."), "the habit is offered, not assumed");
  assert(text.includes("Handwritten note for their anniversary."));
  assert(text.includes("Allergy: shellfish. Keep it out of any welcome treat."));
  assert.equal(t.find((x) => x.text.startsWith("Leave a card"))!.because, "David noticed");
});

test("a first-time guest only gets touches for what they actually said", () => {
  const t = roomTouches({ memories: [mem("preference", "temperature", "likes the room cool")], pastStays: 0, stay, firstName: "Ada", vip: false });
  assert.deepEqual(t.map((x) => x.text), ["Cool the room before they arrive."]);
  assert.deepEqual(roomTouches({ memories: [], pastStays: 0, stay, firstName: "Ada", vip: false }), []);
});

test("hidden memories are never acted on, repeats are dropped, and the list is capped", () => {
  assert.deepEqual(roomTouches({ memories: [mem("preference", "pillows", "firm pillows", "guest", true)], pastStays: 0, stay, firstName: null, vip: false }), []);
  const t = roomTouches({ memories: [mem("preference", "coffee", "oat flat white"), mem("habit", "usual room service", "oat flat white, usually in the morning", "observed")], pastStays: 0, stay, firstName: null, vip: false });
  assert.equal(t.length, 2, "a coffee preference and a coffee habit read differently, both kept");
  const many = roomTouches({ memories: ["a", "b", "c", "d", "e", "f", "g"].map((k) => mem("dislike", k, k)), pastStays: 5, stay, firstName: "X", vip: true });
  assert.equal(many.length, 6);
  assert.match(many[0]!.text, /5th|6th/);
});
