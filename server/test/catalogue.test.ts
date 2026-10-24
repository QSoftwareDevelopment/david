import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalogue, interestsOf, lineText, sectionOf } from "../src/catalogue.js";
import { createApp } from "../src/http.js";
import { seedDemo } from "../src/seed.js";
import { world } from "./helpers.js";

async function demoApp() {
  const w = await world({ hotelSlug: "scratch" });
  await seedDemo(w.store, w.clock.now);
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms, clock: { now: w.clock.now, offsetMs: 0 } });
  const call = async (path: string) => ({ json: (await (await app.request(path)).json()) as any });
  return { ...w, call };
}

test("memories land in the section a hotel person would look for them", () => {
  assert.equal(sectionOf({ kind: "dietary", key: "allergy" }), "food");
  assert.equal(sectionOf({ kind: "preference", key: "coffee" }), "food");
  assert.equal(sectionOf({ kind: "habit", key: "usual room service" }), "food");
  assert.equal(sectionOf({ kind: "preference", key: "pillows" }), "room");
  assert.equal(sectionOf({ kind: "preference", key: "temperature" }), "room");
  assert.equal(sectionOf({ kind: "habit", key: "laundry timing" }), "laundry");
  assert.equal(sectionOf({ kind: "habit", key: "housekeeping timing" }), "housekeeping");
  assert.equal(sectionOf({ kind: "occasion", key: "birthday" }), "occasions");
  assert.equal(sectionOf({ kind: "dislike", key: "noise" }), "dislikes");
  assert.equal(sectionOf({ kind: "preference", key: "newspaper" }), "other");
});

test("lines read like a person wrote them", () => {
  assert.equal(lineText({ kind: "dietary", key: "allergy", value: "shellfish" }), "Allergic to shellfish");
  assert.equal(lineText({ kind: "dietary", key: "diet", value: "vegetarian" }), "Vegetarian");
  assert.equal(lineText({ kind: "preference", key: "coffee", value: "oat flat white" }), "Likes an oat flat white");
  assert.equal(lineText({ kind: "preference", key: "coffee", value: "decaf latte" }), "Likes a decaf latte");
  assert.equal(lineText({ kind: "preference", key: "pillows", value: "firm pillows" }), "Prefers firm pillows");
  assert.equal(lineText({ kind: "habit", key: "usual room service", value: "oat flat white, usually in the morning" }), "Usually: oat flat white, usually in the morning");
  assert.equal(lineText({ kind: "preference", key: "temperature", value: "likes the room cool" }), "Likes the room cool");
});

test("a regular's card shows what they like, what they actually order, and what is still unknown", async () => {
  const d = await demoApp();
  const sam = (await d.call("/api/guests?q=sam")).json.guests[0];
  const c = (await d.call(`/api/guests/${sam.id}`)).json.catalogue;
  const by = Object.fromEntries(c.sections.map((s: any) => [s.key, s]));
  assert.deepEqual(by.room.lines.map((l: any) => l.text).sort(), ["Prefers a quiet high floor", "Prefers firm pillows"]);
  assert.equal(by.room.lines.find((l: any) => /pillows/.test(l.text)).source, "guest");
  assert.equal(by.food.orders[0].item, "Oat flat white");
  assert(by.food.orders[0].count >= 6, "counted from real orders across stays");
  assert.match(by.food.lines.map((l: any) => l.text).join("|"), /Usually: oat flat white/);
  assert.equal(by.food.lines.find((l: any) => /Usually/.test(l.text)).source, "observed");
  assert.deepEqual(by.laundry.facts, ["Has asked for laundry 1 time"]);
  assert.equal(c.stats.pastStays, 2);
  assert.equal(c.stats.nights >= 6, true);
  assert(c.gaps.includes("Dietary needs or allergies"), "it says what to ask next");
  assert(!c.gaps.includes("Pillow, room or temperature preference"), "and not what it already knows");
  assert(c.highlights.length > 0 && c.highlights.length <= 3);
});

test("an allergy always leads, and is never marked uncertain", async () => {
  const d = await demoApp();
  const priya = (await d.call("/api/guests?q=priya")).json.guests[0];
  const c = (await d.call(`/api/guests/${priya.id}`)).json.catalogue;
  assert.equal(c.sections[0].key, "food");
  assert.deepEqual(c.sections[0].lines[0], { text: "Allergic to shellfish", source: "guest", sure: true, memoryId: c.sections[0].lines[0].memoryId });
  assert.equal(c.highlights[0], "Allergic to shellfish");
});

test("hidden memories are left out of the card and the list", async () => {
  const d = await demoApp();
  const sam = (await d.call("/api/guests?q=sam")).json.guests[0];
  const before = (await d.call(`/api/guests/${sam.id}`)).json;
  const pillows = before.memories.find((m: any) => m.key === "pillows");
  await d.store.setMemoryHidden(pillows.id, true);
  const after = (await d.call(`/api/guests/${sam.id}`)).json.catalogue;
  assert(!JSON.stringify(after).includes("firm pillows"));
  const listed = (await d.call("/api/guests?q=sam")).json.guests[0];
  assert(!listed.interests.some((i: string) => /pillows/.test(i)));
});

test("every guest in the list carries a few interests", async () => {
  const d = await demoApp();
  const list = (await d.call("/api/guests")).json.guests;
  const by = Object.fromEntries(list.map((g: any) => [g.firstName, g.interests]));
  assert.equal(by.Priya[0], "Allergic to shellfish");
  assert(by.Sam.length >= 2 && by.Sam.length <= 3);
  assert(by.Elena.some((i: string) => /anniversary/i.test(i)));
  assert.deepEqual(by.Marcus, [], "a first-time guest we know nothing about has none yet");
});

test("a guest we know nothing about gets a card that says so, not an empty page", () => {
  const c = buildCatalogue({
    guest: { id: "g", hotelId: "h", phone: "+14165550111", firstName: "Ada", lastName: null, language: "en", consent: "opted_in", consentAt: null, vip: false, notes: null, createdAt: "2026-01-01T00:00:00Z" },
    memories: [], requests: [], stays: [], today: "2026-03-10", now: new Date("2026-03-10T12:00:00Z"),
  });
  assert.deepEqual(c.sections, []);
  assert.deepEqual(c.gaps.slice(0, 3), ["Dietary needs or allergies", "Pillow, room or temperature preference", "Favourite food or drink"]);
  assert.deepEqual(interestsOf([]), []);
});
