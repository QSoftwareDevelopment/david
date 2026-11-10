import assert from "node:assert/strict";
import { test } from "node:test";
import { RulesAgent } from "../src/agent.js";
import { OperaClient, OperaError } from "../src/opera.js";
import { buildHotel, HOTEL } from "../sandbox/hotel.js";
import { createOperaMock, SANDBOX_CREDENTIALS } from "../sandbox/opera-mock.js";
import { runSandbox } from "../sandbox/run.js";

const TODAY = "2026-03-10";
const config = { baseUrl: "https://opera.test", hotelCode: HOTEL.code, ...SANDBOX_CREDENTIALS };

test("the Opera sandbox passes every check", async () => {
  const { checks } = await runSandbox({ agent: new RulesAgent() });
  const failed = checks.filter((c) => !c.ok).map((c) => `${c.group}: ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  assert.deepEqual(failed, []);
  assert(checks.length >= 40);
});

test("the client reads every page of reservations and parses OHIP's shapes", async () => {
  const opera = createOperaMock(HOTEL.code, () => buildHotel(TODAY));
  const client = new OperaClient(config, opera.fetch);
  const all = await client.reservations("2025-01-01", "2027-01-01");
  assert.equal(all.length, opera.state.data.reservations.length);
  const linh = all.find((r) => r.comments.includes("Anniversary: flowers in room on arrival"))!;
  assert.deepEqual([linh.roomId, linh.eta, linh.status, linh.confirmationNo.startsWith("LH")], ["402", "15:00", "Reserved", true]);
  const p = await client.profile(linh.profileId);
  assert.deepEqual([p.givenName, p.vipCode, p.smsOptIn], ["Linh", "VIP1", true]);
  assert(p.preferences.some((x) => x.type === "ALLERGY" && x.value === "peanuts"));
});

test("the fake Opera refuses what the real one would", async () => {
  const opera = createOperaMock(HOTEL.code, () => buildHotel(TODAY));
  await assert.rejects(new OperaClient({ ...config, clientSecret: "wrong" }, opera.fetch).rooms(), (e: unknown) => e instanceof OperaError && e.status === 401);
  await assert.rejects(new OperaClient({ ...config, hotelCode: "OTHER" }, opera.fetch).rooms(), (e: unknown) => e instanceof OperaError && e.status === 403);
  const client = new OperaClient(config, opera.fetch);
  const booked = opera.state.data.reservations.find((r) => r.status === "Reserved")!;
  await assert.rejects(client.postCharge(booked.reservationId, { transactionCode: "RS", amount: 5, currency: "USD", description: "x", externalReference: "t1" }), (e: unknown) => e instanceof OperaError && e.status === 409);
  const first = await client.createServiceRequest({ roomId: "302", code: "ENG", description: "AC", priority: "High", profileId: null, externalReference: "same" });
  const second = await client.createServiceRequest({ roomId: "302", code: "ENG", description: "AC", priority: "High", profileId: null, externalReference: "same" });
  assert.equal(first.serviceRequestId, second.serviceRequestId);
  assert.equal(opera.state.workOrders.length, 1);
});

test("the client signs in once and reuses its token", async () => {
  const opera = createOperaMock(HOTEL.code, () => buildHotel(TODAY));
  const client = new OperaClient(config, opera.fetch);
  await client.rooms();
  await client.rooms();
  assert.equal(opera.state.calls.filter((c) => c.path === "/oauth/v1/tokens").length, 1);
});
