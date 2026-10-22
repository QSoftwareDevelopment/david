import assert from "node:assert/strict";
import { test } from "node:test";
import { RulesAgent } from "../src/agent.js";
import { createApp } from "../src/http.js";
import { David } from "../src/service.js";
import { HttpSquare, RecordingSquare, type SquareMenuItem } from "../src/square.js";
import { world } from "./helpers.js";

const CREDS = { accessToken: "sq-secret-token", locationId: "LOC1", environment: "sandbox" as const };
const GUEST = "+14165550111";

async function squareWorld(items?: SquareMenuItem[]) {
  const w = await world();
  const sq = new RecordingSquare(items);
  const david = new David(w.store, w.sms, new RulesAgent(), () => w.clock.now, () => sq);
  const connect = async () => {
    await w.store.setSquare(w.hotel.id, CREDS);
    return w.store.syncSquareMenu(w.hotel.id, await sq.menu(), w.clock.now);
  };
  const text = (body: string, from = GUEST) => david.handleInbound(w.hotel, { from, body });
  return { ...w, david, sq, connect, text };
}

const fakeFetch = (pages: unknown[], seen: { url: string; init?: RequestInit }[] = [], status = 200) => {
  let i = 0;
  const f = (async (url: string, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify(pages[Math.min(i++, pages.length - 1)]), { status });
  }) as unknown as typeof fetch;
  return { f, seen };
};

// ── Square's API ───────────────────────────────────────────

test("reads the menu across pages, naming variations and skipping what isn't sold here", async () => {
  const { f, seen } = fakeFetch([
    { cursor: "next", objects: [
      { id: "I1", type: "ITEM", present_at_all_locations: true, item_data: { name: "Latte", description: "Double shot", variations: [
        { id: "V1", type: "ITEM_VARIATION", item_variation_data: { name: "Regular", price_money: { amount: 450 } } }] } },
      { id: "I2", type: "ITEM", present_at_all_locations: true, item_data: { name: "Burger", variations: [
        { id: "V2", type: "ITEM_VARIATION", item_variation_data: { name: "Single", price_money: { amount: 1800 } } },
        { id: "V3", type: "ITEM_VARIATION", item_variation_data: { name: "Double", price_money: { amount: 2400 } } }] } },
      { id: "I3", type: "ITEM", is_deleted: true, present_at_all_locations: true, item_data: { name: "Gone", variations: [] } },
    ] },
    { objects: [
      { id: "I4", type: "ITEM", present_at_location_ids: ["OTHER"], item_data: { name: "Elsewhere", variations: [{ id: "V4", type: "ITEM_VARIATION", item_variation_data: { name: "x" } }] } },
      { id: "I5", type: "ITEM", present_at_all_locations: true, item_data: { name: "Water", variations: [{ id: "V5", type: "ITEM_VARIATION", item_variation_data: { name: "Still" } }] } },
    ] },
  ]);
  const menu = await new HttpSquare(CREDS, f).menu();
  assert.deepEqual(menu.map((m) => [m.name, m.variationId, m.priceCents]), [
    ["Latte", "V1", 450], ["Burger (Single)", "V2", 1800], ["Burger (Double)", "V3", 2400], ["Water", "V5", null],
  ]);
  assert.match(seen[0]!.url, /^https:\/\/connect\.squareupsandbox\.com\/v2\/catalog\/list\?types=ITEM$/);
  assert.match(seen[1]!.url, /cursor=next/);
  assert.equal((seen[0]!.init!.headers as Record<string, string>).authorization, "Bearer sq-secret-token");
});

test("creates an order with the ticket name, lines and an idempotency key", async () => {
  const { f, seen } = fakeFetch([{ order: { id: "ORD1" } }]);
  const r = await new HttpSquare({ ...CREDS, environment: "production" }, f).createOrder({ key: "k1", ticketName: "Rm 412 · Sam", lines: [{ variationId: "V1", quantity: 2, note: "allergy: nuts" }] });
  assert.equal(r.orderId, "ORD1");
  assert.equal(seen[0]!.url, "https://connect.squareup.com/v2/orders");
  const body = JSON.parse(String(seen[0]!.init!.body));
  assert.equal(body.idempotency_key, "k1");
  assert.deepEqual(body.order, { location_id: "LOC1", ticket_name: "Rm 412 · Sam", line_items: [{ catalog_object_id: "V1", quantity: "2", note: "allergy: nuts" }] });
});

test("a Square error becomes a readable message", async () => {
  const { f } = fakeFetch([{ errors: [{ code: "UNAUTHORIZED", detail: "This request could not be authorized." }] }], [], 401);
  await assert.rejects(() => new HttpSquare(CREDS, f).menu(), /Square 401: This request could not be authorized\./);
});

// ── Syncing the menu ───────────────────────────────────────

test("sync adds new items, links a hand-made one with the same name, and hides what left Square", async () => {
  const w = await squareWorld();
  await w.store.createService({ hotelId: w.hotel.id, category: "room_service", name: "Club sandwich", description: "", priceCents: 100, availableFrom: "11:00", availableUntil: "23:00", active: true });
  await w.store.createService({ hotelId: w.hotel.id, category: "housekeeping", name: "Extra towels", description: "", priceCents: null, availableFrom: null, availableUntil: null, active: true });
  const first = await w.connect();
  assert.deepEqual(first, { added: 5, updated: 1, hidden: 0 });
  let all = await w.store.services(w.hotel.id);
  assert.equal(all.filter((s) => s.name === "Club sandwich").length, 1, "linked, not listed twice");
  const club = all.find((s) => s.name === "Club sandwich")!;
  assert.equal(club.squareVariationId, "V-CLUB");
  assert.equal(club.priceCents, 2500, "Square owns the price");
  assert.equal(club.availableFrom, "11:00", "the hotel's hours are kept");
  assert(all.some((s) => s.name === "Extra towels" && !s.squareVariationId), "other categories are untouched");

  w.sq.items = w.sq.items.filter((i) => i.variationId !== "V-BURG");
  assert.deepEqual(await w.store.syncSquareMenu(w.hotel.id, await w.sq.menu(), w.clock.now), { added: 0, updated: 5, hidden: 1 });
  all = await w.store.services(w.hotel.id);
  assert.equal(all.find((s) => s.name === "Harbour burger")!.active, false);
});

test("sync keeps an item the hotel switched off switched off", async () => {
  const w = await squareWorld();
  await w.connect();
  const eggs = (await w.store.services(w.hotel.id)).find((s) => s.name === "Eggs Benedict")!;
  await w.store.updateService(eggs.id, { active: false });
  await w.store.syncSquareMenu(w.hotel.id, await w.sq.menu(), w.clock.now);
  assert.equal((await w.store.services(w.hotel.id)).find((s) => s.name === "Eggs Benedict")!.active, false);
});

// ── Orders ─────────────────────────────────────────────────

test("a room service text becomes a Square order tied to the request", async () => {
  const w = await squareWorld();
  await w.connect();
  const r = await w.text("Can I get a club sandwich and a harbour burger please");
  const req = r.requests[0]!;
  assert.equal(req.kind, "room_service");
  assert.match(req.squareOrderId!, /^demo-order-/);
  assert.equal(req.squareError ?? null, null);
  assert.equal(w.sq.orders.length, 1);
  assert.deepEqual(w.sq.orders[0]!.lines.map((l) => [l.variationId, l.quantity]).sort(), [["V-BURG", 1], ["V-CLUB", 1]]);
  assert.equal(w.sq.orders[0]!.key, `david-${req.id}`);
  assert(w.sms.sent.length === 1, "the guest still gets their reply");
});

test("the kitchen sees the allergy on every line and the room on the ticket", async () => {
  const w = await squareWorld();
  await w.connect();
  const guest = await w.store.createGuest({ hotelId: w.hotel.id, phone: GUEST, firstName: "Priya", lastName: "Nair", consent: "opted_in", consentSource: "booking_form" });
  await w.store.createStay({ hotelId: w.hotel.id, guestId: guest.id, room: "412", arrival: "2026-03-09", departure: "2026-03-12", partySize: 1 });
  await w.store.learn(w.hotel.id, guest.id, { kind: "dietary", key: "allergy", value: "shellfish", source: "guest", confidence: 0.9 }, w.clock.now, null);
  await w.text("club sandwich please");
  const order = w.sq.orders[0]!;
  assert.equal(order.ticketName, "Rm 412 · Priya");
  assert.match(order.lines[0]!.note!, /allergy: shellfish/);
});

test("housekeeping and laundry never go to Square", async () => {
  const w = await squareWorld();
  await w.connect();
  await w.text("extra towels please");
  assert.equal(w.sq.orders.length, 0);
});

test("without Square connected, room service works exactly as before", async () => {
  const w = await squareWorld();
  const r = await w.text("a club sandwich please");
  assert.equal(r.requests[0]!.kind, "room_service");
  assert.equal(r.requests[0]!.squareOrderId ?? null, null);
  assert.equal(r.requests[0]!.squareError ?? null, null);
  assert.equal(w.sq.orders.length, 0);
});

test("when Square is down the request and the reply still happen, and a retry works", async () => {
  const w = await squareWorld();
  await w.connect();
  w.sq.fail = "Square 503: temporarily unavailable";
  const r = await w.text("club sandwich please");
  const req = r.requests[0]!;
  assert.match(req.squareError!, /Not sent to Square: Square 503/);
  assert.equal(req.squareOrderId ?? null, null);
  assert.equal(w.sms.sent.length, 1);
  assert.equal((await w.store.listRequests(w.hotel.id)).length, 1);

  w.sq.fail = null;
  const again = await w.david.sendToSquare(w.hotel, (await w.store.request(req.id))!);
  assert.match(again.squareOrderId!, /^demo-order-/);
  assert.equal(again.squareError ?? null, null);
  await w.david.sendToSquare(w.hotel, again);
  assert.equal(w.sq.orders.length, 1, "retrying never makes a second order");
});

test("an item that isn't a Square item is flagged for the kitchen, the rest is sent", async () => {
  const w = await squareWorld();
  await w.connect();
  await w.store.createService({ hotelId: w.hotel.id, category: "room_service", name: "Caesar salad", description: "", priceCents: 1900, availableFrom: null, availableUntil: null, active: true });
  const r = await w.text("club sandwich and a caesar salad");
  const req = r.requests[0]!;
  assert(req.squareOrderId);
  assert.match(req.squareError!, /Not on Square, tell the kitchen: .*Caesar salad/i);
  assert.deepEqual(w.sq.orders[0]!.lines.map((l) => l.variationId), ["V-CLUB"]);
});

test("an order with nothing from Square says so instead of sending an empty order", async () => {
  const w = await squareWorld();
  await w.connect();
  await w.store.createService({ hotelId: w.hotel.id, category: "room_service", name: "Caesar salad", description: "", priceCents: 1900, availableFrom: null, availableUntil: null, active: true });
  const r = await w.text("a caesar salad please");
  assert.match(r.requests[0]!.squareError!, /nothing in this order matches a Square item/);
  assert.equal(w.sq.orders.length, 0);
});

// ── The API ────────────────────────────────────────────────

test("connecting checks the credentials, imports the menu, and never reveals the token", async () => {
  const w = await squareWorld();
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json", "x-hotel-id": w.hotel.id }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, text: await res.text() };
  };

  assert.equal((await call("PUT", "/api/square", { locationId: "LOC1" })).status, 400, "a token is required the first time");
  w.sq.fail = "Square 401: This request could not be authorized.";
  const bad = await call("PUT", "/api/square", { accessToken: "wrong", locationId: "LOC1" });
  assert.equal(bad.status, 400);
  assert.match(bad.text, /Square said no: This request could not be authorized/);
  assert.equal(await w.store.squareCredentials(w.hotel.id), null, "bad credentials aren't kept");

  w.sq.fail = null;
  const ok = await call("PUT", "/api/square", { accessToken: "sq-secret-token", locationId: "LOC1", environment: "sandbox" });
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.text).added, 6);
  assert.equal(JSON.parse(ok.text).square.connected, true);

  for (const path of ["/api/me", "/api/square", "/api/hotel"]) {
    const r = await call(path === "/api/hotel" ? "PATCH" : "GET", path, path === "/api/hotel" ? { tone: "calm" } : undefined);
    assert(!r.text.includes("sq-secret-token"), `${path} must not leak the token`);
  }

  // Saving again without a token keeps the stored one.
  assert.equal((await call("PUT", "/api/square", { locationId: "LOC2", environment: "sandbox" })).status, 200);
  assert.equal((await w.store.squareCredentials(w.hotel.id))!.accessToken, "sq-secret-token");
  assert.equal((await w.store.squareCredentials(w.hotel.id))!.locationId, "LOC2");

  assert.equal((await call("DELETE", "/api/square")).status, 200);
  assert.equal(await w.store.squareCredentials(w.hotel.id), null);
  assert((await w.store.services(w.hotel.id)).every((s) => !s.squareVariationId), "menu items stay, unlinked");
  assert.equal((await call("POST", "/api/square/sync")).status, 400);
});

test("staff can resend an order from the request", async () => {
  const w = await squareWorld();
  await w.connect();
  w.sq.fail = "Square 500: boom";
  const r = await w.text("club sandwich please");
  w.sq.fail = null;
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms });
  const res = await app.request(`/api/requests/${r.requests[0]!.id}/square`, { method: "POST", headers: { "x-hotel-id": w.hotel.id } });
  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.match(json.request.squareOrderId, /^demo-order-/);
});
