import assert from "node:assert/strict";
import { test } from "node:test";
import { departmentOf, kindsOf } from "../src/departments.js";
import { createApp } from "../src/http.js";
import { understand } from "../src/intents.js";
import { seedDemo } from "../src/seed.js";
import { REQUEST_KINDS } from "../src/types.js";
import { world } from "./helpers.js";

async function demoApp() {
  const w = await world({ hotelSlug: "scratch" });
  await seedDemo(w.store, w.clock.now);
  const app = createApp({ store: w.store, david: w.david, demo: true, recorder: w.sms, clock: { now: w.clock.now, offsetMs: 0 } });
  const as = (who?: string) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json", ...(who ? { "x-view-as": who } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  return { ...w, as };
}

test("every kind of request has exactly one department", () => {
  for (const k of REQUEST_KINDS) assert(kindsOf(departmentOf(k)).includes(k), k);
  assert.equal(departmentOf("amenities"), "housekeeping");
  assert.equal(departmentOf("late_checkout"), "front_desk");
  assert.equal(departmentOf("restaurant"), "restaurant");
});

test("a table request goes to the restaurant, a sent-up dinner to room service", () => {
  const kinds = (t: string) => understand(t, []).requests.map((r) => r.kind);
  assert.deepEqual(kinds("Could we book a table for two tonight at 7:30?"), ["restaurant"]);
  assert.deepEqual(kinds("dinner reservation for four tomorrow please"), ["restaurant"]);
  assert.deepEqual(kinds("Can I order dinner to my room?"), ["room_service"]);
});

test("a manager sees every department on the main board", async () => {
  const d = await demoApp();
  const dash = (await d.as("manager")("GET", "/api/dashboard")).json;
  assert.equal(dash.departments.length, 6);
  const by = Object.fromEntries(dash.departments.map((x: any) => [x.department, x]));
  assert.equal(by.laundry.open, 1);
  assert.equal(by.restaurant.open, 1);
  assert.equal(by.maintenance.open, 1);
  assert(by.housekeeping.open >= 1);
  assert(by.maintenance.oldestMinutes >= 170, "the oldest wait is shown");
  assert(dash.arrivals.length >= 1, "arrivals are part of the main window");
  assert.equal((await d.as("manager")("GET", "/api/requests")).json.requests.length >= 5, true);
});

test("a department sees only its own requests and numbers", async () => {
  const d = await demoApp();
  const laundry = d.as("laundry");
  const list = (await laundry("GET", "/api/requests?status=new,in_progress")).json.requests;
  assert.deepEqual([...new Set(list.map((r: any) => r.kind))], ["laundry"]);
  const dash = (await laundry("GET", "/api/dashboard")).json;
  assert.equal(dash.stats.openRequests, 1);
  assert.deepEqual(dash.arrivals, [], "only the front desk sees arrivals");
  assert.deepEqual(dash.departments, []);
  assert(dash.urgent.every((r: any) => r.kind === "laundry"));
  // Asking for someone else's queue doesn't work.
  const sneaky = (await laundry("GET", "/api/requests?department=maintenance&status=new")).json.requests;
  assert(sneaky.every((r: any) => r.kind === "laundry"));
});

test("a department can work its own requests, not anyone else's", async () => {
  const d = await demoApp();
  const mine = (await d.as("laundry")("GET", "/api/requests?status=new,in_progress")).json.requests[0];
  const done = await d.as("laundry")("PATCH", `/api/requests/${mine.id}`, { status: "done", notify: false });
  assert.equal(done.status, 200);
  assert.equal(done.json.request.status, "done");
  const theirs = (await d.as("manager")("GET", "/api/requests?department=restaurant&status=new")).json.requests[0];
  const blocked = await d.as("laundry")("PATCH", `/api/requests/${theirs.id}`, { status: "done" });
  assert.equal(blocked.status, 403);
  assert.equal((await d.store.request(theirs.id))!.status, "new", "nothing changed");
  assert.equal((await d.as("laundry")("PATCH", `/api/requests/${mine.id}`, { priority: "urgent" })).status, 403, "only a manager reprioritises");
});

test("a department can't open guests, messages, campaigns, the menu, settings or the team", async () => {
  const d = await demoApp();
  const kitchen = d.as("room_service");
  const guest = (await d.as("manager")("GET", "/api/guests")).json.guests[0];
  for (const [m, p] of [["GET", "/api/guests"], ["GET", `/api/guests/${guest.id}`], ["GET", "/api/conversations"], ["GET", "/api/campaigns"], ["GET", "/api/services"], ["PATCH", "/api/hotel"], ["GET", "/api/team"], ["PUT", "/api/square"], ["POST", `/api/guests/${guest.id}/messages`]] as const) {
    assert.equal((await kitchen(m, p, m === "GET" ? undefined : {})).status, 403, `${m} ${p}`);
  }
  assert.equal((await kitchen("GET", "/api/me")).json.access.department, "room_service");
});

test("only managers and owners run the team", async () => {
  const d = await demoApp();
  const team = (await d.as("manager")("GET", "/api/team")).json;
  assert.equal(team.members.length, 6);
  assert.equal((await d.as("manager")("POST", "/api/team/invites", { email: "x@y.ca", role: "staff" })).status, 400, "a department is required");
  const ok = await d.as("manager")("POST", "/api/team/invites", { email: "Night.Manager@Harbourhouse.ca", role: "manager" });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.invites[0].email, "night.manager@harbourhouse.ca");
  assert.equal((await d.as("manager")("POST", "/api/team/invites", { email: "kitchen@harbourhouse.ca", role: "staff", department: "laundry" })).status, 400, "already on the team");
  const owner = team.members.find((m: any) => m.role === "owner");
  assert.equal((await d.as("manager")("DELETE", `/api/team/${owner.userId}`)).status, 400, "the owner stays");
  const kitchenUser = team.members.find((m: any) => m.department === "room_service");
  const moved = await d.as("manager")("PATCH", `/api/team/${kitchenUser.userId}`, { role: "staff", department: "restaurant" });
  assert.equal(moved.json.members.find((m: any) => m.userId === kitchenUser.userId).department, "restaurant");
  assert.equal((await d.as("manager")("DELETE", `/api/team/${kitchenUser.userId}`)).json.members.length, 5);
  assert.equal((await d.as("laundry")("POST", "/api/team/invites", { email: "a@b.ca", role: "manager" })).status, 403);
});

// ── Real sign-in: invitations and what a department member is allowed to be ──

test("someone invited by email gets that access the first time they sign in", async () => {
  const w = await world({ hotelSlug: "real" });
  const owner = "11111111-1111-4111-8111-111111111111", chef = "22222222-2222-4222-8222-222222222222", stranger = "33333333-3333-4333-8333-333333333333";
  await w.store.addStaff(owner, w.hotel.id, "boss@hotel.ca", "owner");
  const people: Record<string, { userId: string; email: string }> = {
    "t-owner": { userId: owner, email: "boss@hotel.ca" }, "t-chef": { userId: chef, email: "Chef@Hotel.ca" }, "t-stranger": { userId: stranger, email: "nobody@else.ca" },
  };
  const app = createApp({ store: w.store, david: w.david, demo: false, verify: async (t) => people[t] ?? null });
  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  assert.equal((await call("t-chef", "GET", "/api/requests")).status, 403, "not on the team yet");
  assert.equal((await call("t-owner", "POST", "/api/team/invites", { email: "chef@hotel.ca", role: "staff", department: "room_service" })).status, 201);
  const me = await call("t-chef", "GET", "/api/me");
  assert.equal(me.status, 200);
  assert.deepEqual(me.json.access, { role: "staff", department: "room_service" });
  assert.equal((await call("t-chef", "GET", "/api/guests")).status, 403);
  assert.equal((await call("t-chef", "GET", "/api/requests")).status, 200);
  assert.equal((await call("t-owner", "GET", "/api/team")).json.invites.length, 0, "the invitation is used up");
  assert.equal((await call("t-stranger", "GET", "/api/requests")).status, 403);
});

test("an owner or manager can view the hotel as a department, which only ever narrows what they see", async () => {
  const w = await world({ hotelSlug: "lens" });
  await seedDemo(w.store, w.clock.now);
  const hotel = (await w.store.hotelBySlug("lens"))!;
  const gm = "44444444-4444-4444-8444-444444444444", chef = "55555555-5555-4555-8555-555555555555";
  await w.store.addStaff(gm, hotel.id, "gm@lens.ca", "manager");
  await w.store.addStaff(chef, hotel.id, "chef@lens.ca", "staff", "room_service");
  const people: Record<string, { userId: string; email: string }> = { gm: { userId: gm, email: "gm@lens.ca" }, chef: { userId: chef, email: "chef@lens.ca" } };
  const app = createApp({ store: w.store, david: w.david, demo: false, verify: async (t) => people[t] ?? null });
  const call = async (token: string, path: string, lens?: string) => {
    const res = await app.request(path, { headers: { authorization: `Bearer ${token}`, ...(lens ? { "x-view-as": lens } : {}) } });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  assert.equal((await call("gm", "/api/guests")).status, 200);
  const me = (await call("gm", "/api/me", "laundry")).json;
  assert.deepEqual(me.access, { role: "staff", department: "laundry" });
  assert.deepEqual(me.actualAccess, { role: "manager", department: null }, "the app can always offer a way back");
  assert.equal((await call("gm", "/api/guests", "laundry")).status, 403, "viewing as laundry looks like laundry");
  assert((await call("gm", "/api/requests?status=new,in_progress", "laundry")).json.requests.every((r: any) => r.kind === "laundry"));
  assert.equal((await call("gm", "/api/guests", "manager")).status, 200, "a non-department lens changes nothing");
  // A department member can't use it to see more, or to see another department.
  assert.equal((await call("chef", "/api/guests", "manager")).status, 403);
  const other = (await call("chef", "/api/requests?status=new,in_progress", "laundry")).json.requests;
  assert(other.every((r: any) => r.kind === "room_service"), "still only their own department");
  assert.deepEqual((await call("chef", "/api/me", "laundry")).json.access, { role: "staff", department: "room_service" });
});

test("the front desk sees today's arrivals, with what they asked for and how to make the stay theirs", async () => {
  const d = await demoApp();
  const dash = (await d.as("front_desk")("GET", "/api/dashboard")).json;
  const amara = dash.arrivals.find((a: any) => a.guest.firstName === "Amara");
  assert(amara, "Amara arrives today");
  assert(amara.asked.length >= 2);
  assert.match(amara.touches[0].text, /Welcome back, Amara/);
  assert.equal(dash.stats.arrivalsToday, 1);
  assert.deepEqual(dash.departments, [], "still no view of other departments");
  assert.equal((await d.as("front_desk")("GET", "/api/guests")).status, 403, "guest profiles stay closed");
  for (const other of ["laundry", "restaurant", "room_service", "housekeeping", "maintenance"]) {
    assert.deepEqual((await d.as(other)("GET", "/api/dashboard")).json.arrivals, [], `${other} sees no arrivals`);
  }
});
