import { serve } from "@hono/node-server";
import { chooseAgent, type Agent } from "../src/agent.js";
import { defaultCampaigns } from "../src/campaigns.js";
import { migrate, pgliteDb } from "../src/db.js";
import { createApp } from "../src/http.js";
import { OperaClient, pushToOpera, syncFromOpera } from "../src/opera.js";
import { David } from "../src/service.js";
import { normalizePhone, RecordingSms } from "../src/sms.js";
import { RecordingSquare } from "../src/square.js";
import { Store } from "../src/store.js";
import { addDays, localParts, zonedInstant } from "../src/time.js";
import type { Hotel } from "../src/types.js";
import { buildHotel, HOTEL } from "./hotel.js";
import { createOperaMock, SANDBOX_CREDENTIALS } from "./opera-mock.js";

/**
 * The Opera sandbox: a fake boutique hotel in a fake Opera, with David connected to it.
 *
 *   npm run sandbox              run every scenario and print a pass/fail report
 *   npm run sandbox -- --verbose also print each conversation
 *   npm run sandbox -- --serve   then keep running: David on :8787 (demo API) and the fake Opera on :8790
 *
 * Nothing leaves this machine: texts go to a recording phone, Square is a recording one, the database is in
 * memory, and Opera is the mock. With ANTHROPIC_API_KEY set, Claude writes David's replies (a real API call);
 * without it, the rules agent does.
 */

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose");

interface Check { group: string; name: string; ok: boolean; detail?: string }

export async function runSandbox(opts: { verbose?: boolean; agent?: Agent } = {}) {
  // The hotel's clock: today at 11:30 in Saigon, after the morning campaigns are due.
  const checks: Check[] = [];
  let group = "";
  const check = (name: string, ok: boolean, detail?: string) => checks.push({ group, name, ok, detail });
  const today = localParts(new Date(), HOTEL.timezone).date;
  const clock = { now: new Date(zonedInstant(today, 11, HOTEL.timezone).getTime() + 30 * 60_000) };

  const opera = createOperaMock(HOTEL.code, () => buildHotel(today));
  const client = new OperaClient({ baseUrl: "https://opera.sandbox.invalid", hotelCode: HOTEL.code, ...SANDBOX_CREDENTIALS }, opera.fetch, () => clock.now.getTime());

  const db = await pgliteDb();
  await db.exec("create role anon; create role authenticated;").catch(() => {});
  await migrate(db);
  const store = new Store(db);
  const sms = new RecordingSms();
  const agent = opts.agent ?? chooseAgent(process.env);
  const david = new David(store, sms, agent, () => clock.now, () => new RecordingSquare());

  let hotel: Hotel = await store.createHotel({ name: HOTEL.name, slug: "lotus-house", timezone: HOTEL.timezone, smsNumber: HOTEL.smsNumber, tone: "warm, gracious and brief, like a boutique hotel's best concierge", signature: "- David" });
  hotel = (await store.updateHotel(hotel.id, { reviewUrl: HOTEL.reviewUrl, whatsappNumber: HOTEL.whatsappNumber }))!;
  for (const c of defaultCampaigns(hotel.id)) await store.createCampaign(c);
  const svc = (category: string, name: string, priceCents: number | null = null) =>
    store.createService({ hotelId: hotel.id, category: category as never, name, description: "", priceCents, availableFrom: null, availableUntil: null, active: true });
  for (const [cat, name, price] of [
    ["room_service", "Oat flat white", 400], ["room_service", "Vietnamese iced coffee", 350], ["room_service", "Pho bo", 900], ["room_service", "Banh mi", 700],
    ["room_service", "Club sandwich", 1200], ["room_service", "Caesar salad", 1000], ["room_service", "Bottle of champagne", 9500],
    ["housekeeping", "Extra towels", null], ["housekeeping", "Extra pillows", null], ["laundry", "Same-day laundry", 1500], ["amenity", "Crib", null], ["transport", "Airport car service", 2500],
  ] as const) await svc(cat, name, price);

  const phoneOf = (given: string) => normalizePhone(opera.state.data.profiles.find((p) => p.givenName === given)!.mobile!)!;
  const guestOf = async (given: string) => (await store.guestByPhone(hotel.id, phoneOf(given)))!;
  const textsTo = (given: string) => sms.sent.filter((m) => m.to.replace(/^whatsapp:/, "") === phoneOf(given));
  const say = async (given: string, body: string) => {
    const r = await david.handleInbound(hotel, { from: phoneOf(given), body });
    if (opts.verbose) console.log(`\n  ${given}: ${body}\n  David: ${r.reply ?? "(no reply)"}`);
    return r;
  };

  // ── 1. Connect to Opera and sync ───────────────────────────
  group = "Opera sync";
  // The first connection imports a year of history, so David knows the regulars; after that, the usual window.
  const sync = await syncFromOpera(store, hotel, client, today, clock.now, { daysBack: 400, daysAhead: 60 });
  check("signs in and reads every reservation", sync.reservations === opera.state.data.reservations.length, `${sync.reservations} reservations`);
  check("creates one guest per mobile number", sync.guestsCreated === opera.state.data.profiles.filter((p) => p.mobile).length, `${sync.guestsCreated} guests`);
  check("imports past stays, so regulars are known", (await store.pastStayCount((await guestOf("Linh")).id, today)) === 2);
  check("skips a profile with no mobile and says why", sync.skipped.length === 1 && sync.skipped[0]!.name === "Lars Eriksson", sync.skipped.map((s) => `${s.name}: ${s.reason}`).join("; "));
  check("brings over allergies and preferences", (await store.memories((await guestOf("Linh")).id)).some((m) => m.key === "allergy" && m.value === "peanuts"));
  check("marks VIPs", (await guestOf("Linh")).vip && (await guestOf("Thu Ha")).vip && !(await guestOf("Minh")).vip);
  check("respects an opt-out recorded in Opera", (await guestOf("An")).consent === "opted_out");
  check("leaves consent unknown when Opera doesn't say", (await guestOf("Carlos")).consent === "unknown");
  check("cancelled booking is cancelled in David", (await store.staysOf((await guestOf("Giulia")).id))[0]?.status === "cancelled");
  check("in-house guests are in house, with their room", (await store.currentStay((await guestOf("Daniel")).id, today))?.room === "302");
  const again = await syncFromOpera(store, hotel, client, today, clock.now);
  check("syncing again changes nothing", again.guestsCreated + again.staysCreated + again.staysUpdated + again.memoriesLearned === 0, JSON.stringify({ ...again, skipped: again.skipped.length }));

  // ── 2. Messages David sends first ──────────────────────────
  group = "Campaigns (11:30)";
  const morning = await david.runTick(hotel.id);
  check("campaigns ran", morning.sent > 0, JSON.stringify(morning));
  check("pre-arrival message to the guest arriving in 3 days", textsTo("Ji-woo").length === 1);
  check("arrival-day message to the VIP arriving today", textsTo("Linh").length === 1);
  check("thank-you to the guest who left yesterday", textsTo("Olivia").length === 1);
  check("nothing to the guest who opted out in Opera", textsTo("An").length === 0);
  check("nothing to the guest with unknown consent", textsTo("Carlos").length === 0);
  check("nothing to the cancelled booking", textsTo("Giulia").length === 0);
  check("win-back to the guest who left 75 days ago", textsTo("Hiroshi").length === 1);
  if (opts.verbose) for (const m of sms.sent) console.log(`\n  → ${m.to}: ${m.body}`);

  // ── 3. Guests write in ─────────────────────────────────────
  group = "Guest conversations";
  const ac = await say("Daniel", "The air con in my room isn't working, it's really hot");
  check("broken air con becomes a maintenance request", ac.requests.some((r) => r.kind === "maintenance"));
  const towels = await say("Sophie", "Could we get two extra towels please?");
  check("towels become a housekeeping request", towels.requests.some((r) => r.kind === "housekeeping"));
  await say("Sophie", "By the way, we're both vegetarian");
  check("a diet the guest mentions is remembered", (await store.memories((await guestOf("Sophie")).id)).some((m) => m.kind === "dietary" && /vegetarian/i.test(m.value)));
  const late = await say("Minh", "Can I get a late check-out tomorrow?");
  check("late check-out request is logged", late.requests.some((r) => r.kind === "late_checkout"));
  const food = await say("Emma", "Could I order a club sandwich to my room?");
  check("room service order is logged", food.requests.some((r) => r.kind === "room_service"));
  const angry = await say("Thu Ha", "This is ridiculous, the room is dirty and I want a refund");
  check("an angry VIP demanding a refund is escalated", angry.escalated);
  const angryVi = await say("Linh", "Phòng bẩn quá, tôi muốn hoàn tiền");
  check("a Vietnamese refund demand is escalated", angryVi.escalated);
  const eta = await say("Ji-woo", "Thanks! We land late, should arrive around 11:30pm");
  const jiwooStay = (await store.staysOf((await guestOf("Ji-woo")).id))[0];
  check("an arrival time from the guest is saved on the stay", jiwooStay?.eta === "23:30", `eta ${jiwooStay?.eta ?? "none"} · reply: ${eta.reply ?? ""}`);
  const rating = await say("Olivia", "9");
  check("a 9 after the thank-you sends the review link", !!rating.reply?.includes(HOTEL.reviewUrl), rating.reply ?? "");
  const stop = await say("Mei", "STOP");
  check("STOP opts the guest out", (await guestOf("Mei")).consent === "opted_out", stop.reply ?? "");

  // ── 4. Later that day ──────────────────────────────────────
  group = "Campaigns (17:30)";
  clock.now = new Date(zonedInstant(today, 17, HOTEL.timezone).getTime() + 30 * 60_000);
  const before = sms.sent.length;
  await david.runTick(hotel.id);
  const evening = sms.sent.slice(before);
  check("mid-stay check-in reaches the in-house guest who hasn't written", evening.some((m) => m.to === phoneOf("Rahul")), `${evening.length} sent`);
  check("…but waits for guests David already texted today (one message a day)", !evening.some((m) => [phoneOf("Sophie"), phoneOf("Daniel"), phoneOf("Thu Ha")].includes(m.to)));
  check("still nothing to the guest who opted out", textsTo("An").length === 0);
  check("nothing to the guest who texted STOP", textsTo("Mei").filter((m) => m.body !== stop.reply).length === 0);

  // ── 5. Write back to Opera ─────────────────────────────────
  group = "Opera write-back";
  const push = await pushToOpera(store, hotel, client, today, { currency: HOTEL.currency });
  check("maintenance becomes a work order for room 302", opera.state.workOrders.some((w) => w.code === "ENG" && w.roomId === "302"), opera.state.workOrders.map((w) => `${w.serviceRequestId} ${w.code} ${w.roomId}`).join(", "));
  check("housekeeping becomes a work order for room 401", opera.state.workOrders.some((w) => w.code === "HSK" && w.roomId === "401"));
  check("room service is charged to the folio", opera.state.charges.some((c) => /club sandwich/i.test(c.description) && c.amount === 12), opera.state.charges.map((c) => `${c.description} ${c.amount} ${c.currency}`).join(", "));
  check("the new diet is proposed to Opera for approval, not written", opera.state.proposals.some((p) => p.preferenceType === "DIET" && /vegetarian/i.test(p.preferenceValue) && p.status === "PendingApproval"));
  check("nothing Opera already knew is sent back", !opera.state.proposals.some((p) => /peanuts/.test(p.preferenceValue)));
  const counts = () => opera.state.workOrders.length + opera.state.charges.length + opera.state.proposals.length;
  const n = counts();
  await pushToOpera(store, hotel, client, today, { currency: HOTEL.currency });
  check("pushing again doesn't duplicate anything", counts() === n);
  check("no write-back failed", push.failed.length === 0, push.failed.map((f) => `${f.what}: ${f.error}`).join("; "));

  return { hotel, store, david, sms, opera, client, clock, checks };
}

function report(list: Check[], agentName: string) {
  let last = "";
  console.log(`\nDavid × Opera sandbox · ${HOTEL.name} · agent: ${agentName}`);
  for (const c of list) {
    if (c.group !== last) { console.log(`\n${c.group}`); last = c.group; }
    console.log(`  ${c.ok ? "✔" : "✘"} ${c.name}${c.detail && (!c.ok || verbose) ? `  (${c.detail})` : ""}`);
  }
  const failed = list.filter((c) => !c.ok).length;
  console.log(`\n${list.length - failed} of ${list.length} checks passed${failed ? `, ${failed} failed` : ""}.`);
  return failed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const world = await runSandbox({ verbose });
  const failed = report(world.checks, process.env.ANTHROPIC_API_KEY && process.env.DAVID_AGENT !== "rules" ? "claude" : "rules");
  if (args.has("--serve")) {
    serve({ fetch: world.opera.app.fetch, port: 8790 }, () => console.log("\nFake Opera on http://localhost:8790  (GET /_sandbox/state to see what David wrote)"));
    const app = createApp({ store: world.store, david: world.david, demo: true, recorder: world.sms, clock: { now: world.clock.now, offsetMs: 0 } });
    serve({ fetch: app.fetch, port: 8787 }, () => console.log("David's demo API on http://localhost:8787, with Lotus House Saigon loaded"));
  } else {
    process.exit(failed ? 1 : 0);
  }
}
