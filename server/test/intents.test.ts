import assert from "node:assert/strict";
import { test } from "node:test";
import { factsIn, understand } from "../src/intents.js";
import type { Service } from "../src/types.js";

const svc = (category: Service["category"], name: string): Service => ({ id: name, hotelId: "h", category, name, description: "", priceCents: null, availableFrom: null, availableUntil: null, active: true });
const catalog = [svc("room_service", "Club sandwich"), svc("room_service", "Oat flat white"), svc("housekeeping", "Extra towels"), svc("laundry", "Dry cleaning")];
const kinds = (t: string) => understand(t, catalog).requests.map((r) => r.kind);

test("it hears the common asks", () => {
  assert.deepEqual(kinds("Can I get a club sandwich sent up?"), ["room_service"]);
  assert.deepEqual(kinds("could we get extra towels please"), ["housekeeping"]);
  assert.deepEqual(kinds("I need some laundry done"), ["laundry"]);
  assert.deepEqual(kinds("the AC isn't working"), ["maintenance"]);
  assert.deepEqual(kinds("can you book me a taxi to the airport at 6am"), ["transport"]);
  assert.deepEqual(kinds("any chance of a late checkout?"), ["late_checkout"]);
  assert.deepEqual(kinds("Can we check in early tomorrow"), ["early_checkin"]);
});

test("more than one ask in a message becomes more than one request", () => {
  assert.deepEqual(kinds("Extra towels and a club sandwich please").sort(), ["housekeeping", "room_service"]);
});

test("menu items are matched by name, and generic foods are still caught", () => {
  assert.deepEqual(understand("one oat flat white and a club sandwich", catalog).requests[0]!.items.sort(), ["Club sandwich", "Oat flat white"]);
  assert(understand("I'd like a pizza and a coffee", catalog).requests[0]!.items.includes("pizza"));
});

test("a menu item and the same thing said generically are one item, not two", () => {
  assert.deepEqual(understand("could I get some extra towels", catalog).requests[0]!.items, ["Extra towels"]);
});

test("timing is kept in the guest's own words", () => {
  assert.equal(understand("towels tonight please", catalog).requests[0]!.when, "tonight");
  assert.equal(understand("breakfast at 7:30 am", catalog).requests[0]!.when?.toLowerCase(), "at 7:30 am");
});

test("urgent words only raise the urgency of things that can be urgent", () => {
  assert(understand("there's a leak in the bathroom, urgent", catalog).requests[0]!.urgent);
  assert(!understand("breakfast asap", catalog).requests[0]!.urgent);
});

test("telling David not to disturb is a preference, not a request", () => {
  const u = understand("No housekeeping before 10am please", catalog);
  assert.equal(u.requests.length, 0);
  assert.equal(u.facts[0]!.key, "housekeeping");
  assert.match(u.facts[0]!.value, /not before 10am/);
});

test("it learns what a guest says about themselves", () => {
  const f = factsIn("I'm allergic to shellfish and I like firm pillows. We're here for our anniversary.");
  assert.deepEqual(f.map((x) => [x.kind, x.key]).sort(), [["dietary", "allergy"], ["occasion", "anniversary"], ["preference", "pillows"]].sort());
  assert.equal(f.find((x) => x.key === "allergy")!.value, "shellfish");
  assert(f.every((x) => x.source === "guest"));
  assert.equal(factsIn("I'm vegan").find((x) => x.key === "diet")!.value, "vegan");
  assert.equal(factsIn("gluten free please")[0]!.value, "gluten-free");
});

test("complaints are escalated, thanks are small talk", () => {
  assert(understand("This is unacceptable, I want the manager", catalog).escalate);
  assert(understand("Thanks!", catalog).smallTalk);
  assert(!understand("Thanks, can I get towels?", catalog).smallTalk);
});

test("nothing is invented from a message that asks for nothing", () => {
  const u = understand("what time is it", catalog);
  assert.deepEqual([u.requests.length, u.facts.length, u.escalate, u.smallTalk], [0, 0, false, false]);
});
