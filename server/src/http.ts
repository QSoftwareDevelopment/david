import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { Principal } from "./auth.js";
import { defaultCampaigns } from "./campaigns.js";
import { DEPARTMENTS, DEPARTMENT_LABEL, canManage, departmentOf, isDepartment, isScoped, kindsOf, type Access, type Department } from "./departments.js";
import { safeWebhookUrl } from "./alerts.js";
import { arrivalsOn } from "./arrivals.js";
import { buildCatalogue, interestsOf } from "./catalogue.js";
import type { DemoPos } from "./demopos.js";
import type { David } from "./service.js";
import { EMPTY_TWIML, normalizePhone, parseAddress, validTwilioSignature, type RecordingSms } from "./sms.js";
import type { Store } from "./store.js";
import { localParts } from "./time.js";
import { CAMPAIGN_KINDS, MEMORY_KINDS, REQUEST_KINDS, type Hotel } from "./types.js";

export interface AppDeps {
  store: Store;
  david: David;
  demo: boolean;
  cronSecret?: string;
  twilioAuthToken?: string;
  /** Public base URL of this server, for Twilio signature checks. */
  publicUrl?: string;
  verify?: (token: string) => Promise<Principal | null>;
  corsOrigins?: string[];
  /** Demo only: the phone the simulator talks to, and a clock to move. */
  recorder?: RecordingSms;
  /** Demo only: the stand-in restaurant system. */
  pos?: DemoPos;
  clock?: { now: Date; offsetMs: number };
}

type Vars = { hotel: Hotel; principal: Principal | null; access: Access; actual: Access };

const phoneSchema = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "That doesn't look like a phone number." });
  return p as string;
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export function createApp(deps: AppDeps) {
  const { store, david } = deps;
  const app = new Hono<{ Variables: Vars }>();

  app.use("*", cors({ origin: deps.corsOrigins?.length ? deps.corsOrigins : (deps.demo ? "*" : []), allowHeaders: ["authorization", "content-type", "x-hotel-id", "x-view-as"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
  app.onError((err, c) => {
    if (err instanceof z.ZodError) return c.json({ error: err.issues[0]?.message ?? "Invalid input." }, 400);
    console.error("[http]", err);
    return c.json({ error: err instanceof Error && /No such|opted out/.test(err.message) ? err.message : "Something went wrong." }, err instanceof Error && /No such|opted out/.test(err.message) ? 400 : 500);
  });

  app.get("/health", (c) => c.json({ ok: true, demo: deps.demo, agent: process.env.ANTHROPIC_API_KEY && process.env.DAVID_AGENT !== "rules" ? "claude" : "rules" }));

  // ── Twilio ────────────────────────────────────────────────
  const twiml = (c: { body: (s: string, status?: number, h?: Record<string, string>) => Response }) => c.body(EMPTY_TWIML, 200, { "content-type": "text/xml" });
  // Outside the demo every Twilio webhook must be signed. Without an auth token there is no way
  // to tell Twilio from anyone else, so refuse rather than trust it.
  const fromTwilio = (reqUrl: string, path: string, form: Record<string, string>, signature: string | undefined) => {
    if (deps.demo) return true;
    if (!deps.twilioAuthToken) return false;
    const url = `${(deps.publicUrl ?? new URL(reqUrl).origin).replace(/\/$/, "")}${path}`;
    return validTwilioSignature(deps.twilioAuthToken, url, form, signature);
  };

  app.post("/webhooks/twilio/sms", async (c) => {
    const form = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([k, v]) => [k, String(v)]));
    if (!fromTwilio(c.req.url, "/webhooks/twilio/sms", form, c.req.header("x-twilio-signature"))) return c.text("Forbidden", 403);
    // The same webhook serves SMS and WhatsApp: Twilio marks WhatsApp numbers as `whatsapp:+1...`.
    const to = form.To ? parseAddress(form.To) : null;
    const hotel = to?.phone ? (to.channel === "whatsapp" ? await store.hotelByWhatsappNumber(to.phone) : await store.hotelBySmsNumber(to.phone)) : null;
    if (!hotel || !to || !form.From || !form.Body) return twiml(c);
    // Twilio waits about fifteen seconds. The reply goes out through the API, so
    // acknowledge in time whatever the model is doing.
    const work = david.handleInbound(hotel, { from: form.From, body: form.Body, sid: form.MessageSid, channel: to.channel }).catch((e) => console.error("[inbound]", e));
    await Promise.race([work, new Promise((r) => setTimeout(r, 12_000))]);
    return twiml(c);
  });

  app.post("/webhooks/twilio/status", async (c) => {
    const form = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([k, v]) => [k, String(v)]));
    if (!fromTwilio(c.req.url, "/webhooks/twilio/status", form, c.req.header("x-twilio-signature"))) return c.text("Forbidden", 403);
    if (form.MessageSid && form.MessageStatus) await store.setMessageStatus(form.MessageSid, form.MessageStatus);
    return c.body(null, 204);
  });

  // A department's own system (a restaurant's booking or POS software) reports back: a table, a time, or a no.
  // It identifies itself with the secret David gave it when it was connected.
  app.post("/webhooks/integrations/confirm", async (c) => {
    const secret = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const who = secret ? await store.contactBySecret(secret) : null;
    if (!who) return c.json({ error: "Unknown or missing secret." }, 401);
    const b = z.object({
      requestId: z.string().uuid(), status: z.enum(["confirmed", "declined", "seated", "done"]),
      table: z.string().trim().max(60).nullable().optional(), time: z.string().trim().max(60).nullable().optional(), note: z.string().trim().max(300).nullable().optional(),
    }).parse(await c.req.json());
    const request = await store.request(b.requestId);
    const hotel = await store.hotel(who.hotelId);
    if (!request || !hotel || request.hotelId !== who.hotelId || departmentOf(request.kind) !== who.department) return c.json({ error: "That request isn't yours." }, 404);
    const updated = await david.applyConfirmation(hotel, request, { status: b.status, table: b.table ?? null, time: b.time ?? null, note: b.note ?? null, source: who.department });
    return c.json({ ok: true, request: updated });
  });

  // ── Scheduled work ────────────────────────────────────────
  app.post("/cron/tick", async (c) => {
    const ok = deps.demo || (deps.cronSecret && c.req.header("authorization") === `Bearer ${deps.cronSecret}`);
    if (!ok) return c.json({ error: "Not authorised." }, 401);
    return c.json(await david.runTick());
  });

  // ── Staff API ─────────────────────────────────────────────
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/hotels" && c.req.method === "POST") return next();
    if (deps.demo) {
      const hotel = (await store.hotelBySlug("harbour-house")) ?? (await store.allHotels())[0];
      if (!hotel) return c.json({ error: "No demo hotel yet." }, 503);
      c.set("hotel", hotel);
      c.set("principal", null);
      // The demo has no accounts, so the app says who to pretend to be.
      const as = c.req.header("x-view-as");
      c.set("actual", { role: "owner", department: null });
      c.set("access", as === "manager" ? { role: "manager", department: null } : isDepartment(as) ? { role: "staff", department: as } : { role: "owner", department: null });
      return next();
    }
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const principal = token && deps.verify ? await deps.verify(token) : null;
    if (!principal) return c.json({ error: "Please sign in." }, 401);
    // An invitation is waiting for whoever signs in with that address.
    if (principal.email) await store.claimInvites(principal.userId, principal.email);
    const hotels = await store.hotelsForUser(principal.userId);
    const wanted = c.req.header("x-hotel-id");
    const hotel = (wanted ? hotels.find((h) => h.id === wanted) : hotels[0]) ?? null;
    if (!hotel) return c.json({ error: "You don't have a hotel yet." }, 403);
    c.set("hotel", hotel);
    c.set("principal", principal);
    const actual = (await store.staffAccess(principal.userId, hotel.id)) ?? { role: "staff" as const, department: null };
    c.set("actual", actual);
    // "View as": an owner or manager can look at the hotel the way a department does. It only ever
    // narrows what they see; nobody gets more than their own role allows.
    const lens = c.req.header("x-view-as");
    c.set("access", canManage(actual) && isDepartment(lens) ? { role: "staff", department: lens } : actual);
    return next();
  });

  // Someone who works one department gets their queue and nothing else: no guest
  // profiles, messages, campaigns, menu, settings or team.
  const DEPARTMENT_ROUTES: [string, RegExp][] = [
    ["GET", /^\/api\/me$/], ["GET", /^\/api\/dashboard$/], ["GET", /^\/api\/requests$/],
    ["PATCH", /^\/api\/requests\/[^/]+$/], ["POST", /^\/api\/requests\/[^/]+\/square$/],
    // The front desk sends requests on; any department may read the briefing for its own (checked in the handler).
    ["POST", /^\/api\/requests\/[^/]+\/dispatch$/], ["POST", /^\/api\/requests\/dispatch-all$/], ["GET", /^\/api\/requests\/[^/]+\/handoff$/],
  ];
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/hotels" && c.req.method === "POST") return next();
    if (isScoped(c.get("access")) && !DEPARTMENT_ROUTES.some(([m, re]) => m === c.req.method && re.test(c.req.path))) {
      return c.json({ error: "That isn't part of your department." }, 403);
    }
    return next();
  });
  const managersOnly = (c: { get: (k: "access") => Access }) => canManage(c.get("access"));

  // Creating a hotel is the one call that has no hotel yet, so it does its own sign-in.
  app.post("/api/hotels", async (c) => {
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const principal = deps.demo ? { userId: "00000000-0000-0000-0000-000000000000", email: null } : token && deps.verify ? await deps.verify(token) : null;
    if (!principal) return c.json({ error: "Please sign in." }, 401);
    const b = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().default("America/Toronto"), tone: z.string().max(300).optional(), signature: z.string().max(80).optional() }).parse(await c.req.json());
    try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); } catch { return c.json({ error: "Unknown time zone." }, 400); }
    const base = b.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hotel";
    let slug = base;
    for (let i = 2; await store.hotelBySlug(slug); i++) slug = `${base}-${i}`;
    const hotel = await store.createHotel({ name: b.name, slug, timezone: b.timezone, tone: b.tone, signature: b.signature });
    await store.addStaff(principal.userId, hotel.id, principal.email, "owner");
    for (const k of defaultCampaigns(hotel.id)) await store.createCampaign(k);
    return c.json({ hotel }, 201);
  });

  app.get("/api/me", async (c) => {
    const principal = c.get("principal");
    const hotels = principal ? await store.hotelsForUser(principal.userId) : await store.allHotels();
    return c.json({ hotel: c.get("hotel"), hotels, user: principal, demo: deps.demo, now: david.clock().toISOString(), access: c.get("access"), actualAccess: c.get("actual") });
  });

  app.patch("/api/hotel", async (c) => {
    const b = z.object({
      name: z.string().trim().min(1).max(120).optional(), timezone: z.string().optional(), tone: z.string().max(300).optional(), signature: z.string().max(80).optional(),
      smsNumber: z.string().nullable().optional(), quietStart: z.number().int().min(0).max(23).optional(), quietEnd: z.number().int().min(0).max(23).optional(),
      checkinTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), checkoutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      reviewUrl: z.string().trim().max(500).nullable().optional(), briefingHour: z.number().int().min(0).max(23).optional(),
      whatsappNumber: z.string().nullable().optional(),
      // Twilio Content SIDs look like HX followed by 32 hex characters. A blank clears one.
      whatsappTemplates: z.record(z.enum(CAMPAIGN_KINDS), z.string().trim().regex(/^(HX[0-9a-fA-F]{32})?$/, "A WhatsApp template ID looks like HX followed by 32 letters and numbers.")).optional(),
    }).parse(await c.req.json());
    if (b.reviewUrl) { try { if (new URL(b.reviewUrl).protocol !== "https:") throw new Error(); } catch { return c.json({ error: "The review link should start with https://" }, 400); } }
    if (b.reviewUrl === "") b.reviewUrl = null;
    if (b.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); } catch { return c.json({ error: "Unknown time zone." }, 400); } }
    const smsNumber = b.smsNumber === undefined ? undefined : b.smsNumber === null || b.smsNumber === "" ? null : normalizePhone(b.smsNumber);
    if (b.smsNumber && !smsNumber) return c.json({ error: "That doesn't look like a phone number." }, 400);
    const whatsappNumber = b.whatsappNumber === undefined ? undefined : b.whatsappNumber === null || b.whatsappNumber === "" ? null : parseAddress(b.whatsappNumber).phone;
    if (b.whatsappNumber && !whatsappNumber) return c.json({ error: "That doesn't look like a WhatsApp number." }, 400);
    const whatsappTemplates = b.whatsappTemplates
      ? Object.fromEntries(Object.entries({ ...c.get("hotel").whatsappTemplates, ...b.whatsappTemplates }).filter(([, v]) => v))
      : undefined;
    return c.json({ hotel: await store.updateHotel(c.get("hotel").id, { ...b, smsNumber, whatsappNumber, whatsappTemplates }) });
  });

  const arrivalsToday = (hotelId: string, today: string) => arrivalsOn(store, david.clock(), hotelId, today);

  app.get("/api/dashboard", async (c) => {
    const hotel = c.get("hotel");
    const today = localParts(david.clock(), hotel.timezone).date;
    const access = c.get("access");
    const scope = isScoped(access) ? kindsOf(access.department) : undefined;
    if (scope) {
      // Their own numbers and their own queue. The front desk also greets the day's arrivals, so it sees those;
      // nobody else gets guest history.
      const board = (await store.departmentBoard(hotel.id, today, david.clock())).find((d) => d.department === access.department)!;
      const desk = access.department === "front_desk";
      const house = desk ? await store.dashboard(hotel.id, today) : null;
      // A department only counts and sees what the front desk has sent it.
      const waiting = board.open - board.held;
      return c.json({
        today, scope: access, board: { ...board, open: waiting, oldestMinutes: board.oldestSentMinutes },
        stats: { arrivalsToday: house?.arrivalsToday ?? 0, inHouse: house?.inHouse ?? 0, departuresToday: house?.departuresToday ?? 0, openRequests: waiting, urgentRequests: board.urgent, requestsToday: board.doneToday, repeatGuestsInHouse: 0, guestsTotal: 0, memoriesTotal: 0, optedOut: 0 },
        arrivals: desk ? await arrivalsToday(hotel.id, today) : [], departments: [],
        urgent: await store.listRequests(hotel.id, { status: ["new", "in_progress"], kinds: scope, limit: 8, dispatchedOnly: true }),
        toSend: desk ? await store.heldRequests(hotel.id) : [],
      });
    }
    const [stats, arrivals, urgent, departments, toSend] = await Promise.all([
      store.dashboard(hotel.id, today),
      arrivalsToday(hotel.id, today),
      // What is waiting to be sent has its own section, so it isn't listed twice.
      store.listRequests(hotel.id, { status: ["new", "in_progress"], limit: 5, dispatchedOnly: true }),
      store.departmentBoard(hotel.id, today, david.clock()),
      store.heldRequests(hotel.id),
    ]);
    return c.json({ today, scope: access, stats, arrivals, urgent, departments, toSend });
  });

  // Requests
  app.get("/api/requests", async (c) => {
    const status = c.req.query("status")?.split(",").filter((s) => ["new", "in_progress", "done", "cancelled"].includes(s)) as ("new" | "in_progress" | "done" | "cancelled")[] | undefined;
    const kind = REQUEST_KINDS.find((k) => k === c.req.query("kind"));
    const access = c.get("access");
    const asked = c.req.query("department");
    // A department only ever gets its own kinds, whatever they ask for.
    const kinds = isScoped(access) ? kindsOf(access.department) : isDepartment(asked) ? kindsOf(asked) : undefined;
    return c.json({ requests: await store.listRequests(c.get("hotel").id, { status: status?.length ? status : undefined, kind, kinds, dispatchedOnly: isScoped(access) && access.department !== "front_desk", alsoHeld: isScoped(access) && access.department === "front_desk" }) });
  });
  app.patch("/api/requests/:id", async (c) => {
    const b = z.object({ status: z.enum(["new", "in_progress", "done", "cancelled"]).optional(), priority: z.enum(["normal", "urgent"]).optional(), notify: z.boolean().default(false) }).parse(await c.req.json());
    const hotel = c.get("hotel");
    const existing = await store.request(c.req.param("id"));
    if (!existing || existing.hotelId !== hotel.id) return c.json({ error: "No such request." }, 404);
    const me = c.get("access");
    if (isScoped(me) && departmentOf(existing.kind) !== me.department) return c.json({ error: "That request belongs to another department." }, 403);
    if (isScoped(me) && b.priority) return c.json({ error: "Only a manager can change priority." }, 403);
    if (b.priority) await store.updateRequest(existing.id, { priority: b.priority });
    const updated = b.status ? await david.setRequestStatus(hotel, existing.id, b.status, b.notify) : await store.request(existing.id);
    return c.json({ request: updated });
  });
  // The front desk (and managers) send requests on to their department, with a briefing about the guest.
  const canDispatch = (a: Access) => !isScoped(a) || a.department === "front_desk";
  const actor = (c: { get: (k: "principal" | "access") => any }) => (c.get("principal") as Principal | null)?.email ?? ((c.get("access") as Access).department ? `${DEPARTMENT_LABEL[(c.get("access") as Access).department!]} (demo)` : "Front desk");
  app.post("/api/requests/dispatch-all", async (c) => {
    if (!canDispatch(c.get("access"))) return c.json({ error: "Only the front desk can send requests on." }, 403);
    return c.json(await david.dispatchAll(c.get("hotel"), actor(c)));
  });
  app.post("/api/requests/:id/dispatch", async (c) => {
    if (!canDispatch(c.get("access"))) return c.json({ error: "Only the front desk can send requests on." }, 403);
    const b = z.object({ note: z.string().trim().max(300).nullable().optional() }).parse(await c.req.json().catch(() => ({})));
    const res = await david.dispatchRequest(c.get("hotel"), c.req.param("id"), actor(c), b.note || null);
    if (!res) return c.json({ error: "No such request." }, 404);
    if (res.error) return c.json({ error: res.error }, 502);
    return c.json(res);
  });
  app.get("/api/requests/:id/handoff", async (c) => {
    const hotel = c.get("hotel");
    const request = await store.request(c.req.param("id"));
    if (!request || request.hotelId !== hotel.id) return c.json({ error: "No such request." }, 404);
    const me = c.get("access");
    // A department reads the briefing for its own requests, once the front desk has sent them.
    if (isScoped(me) && me.department !== "front_desk" && (departmentOf(request.kind) !== me.department || !request.dispatchedAt)) return c.json({ error: "That request belongs to another department." }, 403);
    const handoff = await david.handoffFor(hotel, request, request.dispatchNote ?? null);
    return handoff ? c.json({ handoff, request }) : c.json({ error: "No such guest." }, 404);
  });
  app.post("/api/requests", async (c) => {
    const b = z.object({ guestId: z.string().uuid(), kind: z.enum(REQUEST_KINDS), summary: z.string().trim().min(1).max(300), priority: z.enum(["normal", "urgent"]).default("normal") }).parse(await c.req.json());
    const hotel = c.get("hotel");
    const guest = await store.guest(b.guestId);
    if (!guest || guest.hotelId !== hotel.id) return c.json({ error: "No such guest." }, 404);
    const today = localParts(david.clock(), hotel.timezone).date;
    const stay = await store.currentStay(guest.id, today);
    const made = await store.createRequest({ hotelId: hotel.id, guestId: guest.id, stayId: stay?.id ?? null, kind: b.kind, summary: b.summary, priority: b.priority, createdBy: "staff", at: david.clock() });
    await david.alerts.newRequest(hotel, made, [guest.firstName, guest.lastName].filter(Boolean).join(" ") || guest.phone, stay?.room ?? null);
    return c.json({ request: made }, 201);
  });

  // Alerts: where each department hears about things. Owners and managers only.
  const alertKeys = [...DEPARTMENTS, "manager"] as const;
  const alertView = async (hotelId: string) => {
    const have = new Map((await store.contacts(hotelId)).map((c) => [c.department, c]));
    const view = (d: (typeof alertKeys)[number]) => {
      const c = have.get(d);
      return { department: d, smsNumber: c?.smsNumber ?? null, webhookUrl: c?.webhookUrl ?? null, dispatch: c?.dispatch ?? "direct", integrationUrl: c?.integrationUrl ?? null, hasSecret: !!c?.integrationSecret, secretTail: c?.integrationSecret ? c.integrationSecret.slice(-4) : null };
    };
    return { contacts: alertKeys.map(view), briefingHour: (await store.hotel(hotelId))?.briefingHour ?? 7 };
  };
  const newSecret = () => `whsec_${randomBytes(24).toString("hex")}`;
  app.get("/api/alerts", async (c) => c.json(await alertView(c.get("hotel").id)));
  app.put("/api/alerts/:department", async (c) => {
    const department = alertKeys.find((d) => d === c.req.param("department"));
    if (!department) return c.json({ error: "No such department." }, 404);
    const b = z.object({
      smsNumber: z.string().trim().max(40).nullable().default(null), webhookUrl: z.string().trim().max(500).nullable().default(null),
      dispatch: z.enum(["direct", "review"]).optional(), integrationUrl: z.string().trim().max(500).nullable().optional(),
    }).parse(await c.req.json());
    const smsNumber = b.smsNumber ? normalizePhone(b.smsNumber) : null;
    if (b.smsNumber && !smsNumber) return c.json({ error: "That doesn't look like a phone number." }, 400);
    const webhookUrl = b.webhookUrl || null;
    if (webhookUrl && !safeWebhookUrl(webhookUrl)) return c.json({ error: "The webhook needs to be a public https:// address, like a Slack incoming webhook." }, 400);
    const integrationUrl = b.integrationUrl === undefined ? undefined : b.integrationUrl || null;
    if (integrationUrl && !safeWebhookUrl(integrationUrl)) return c.json({ error: "The system's address needs to be a public https:// URL." }, 400);
    if ((integrationUrl || b.dispatch === "review") && (department === "manager" || department === "front_desk")) return c.json({ error: department === "manager" ? "The manager just gets alerts." : "The front desk is where requests are sent from, so it can't hold its own." }, 400);
    const hotelId = c.get("hotel").id;
    const had = (await store.contacts(hotelId)).find((x) => x.department === department);
    await store.setContact(hotelId, { department, smsNumber, webhookUrl, dispatch: b.dispatch, integrationUrl, integrationSecret: integrationUrl && !had?.integrationSecret ? newSecret() : undefined });
    // The secret is shown once, when a system is first connected.
    const fresh = integrationUrl && !had?.integrationSecret ? (await store.contacts(hotelId)).find((x) => x.department === department)?.integrationSecret : null;
    return c.json({ ...(await alertView(hotelId)), ...(fresh ? { secret: fresh } : {}) });
  });
  app.post("/api/alerts/:department/secret", async (c) => {
    const department = alertKeys.find((d) => d === c.req.param("department"));
    const hotelId = c.get("hotel").id;
    const had = (await store.contacts(hotelId)).find((x) => x.department === department);
    if (!department || !had?.integrationUrl) return c.json({ error: "Connect a system first." }, 400);
    const secret = newSecret();
    await store.setContact(hotelId, { ...had, integrationSecret: secret });
    return c.json({ secret });
  });
  app.post("/api/alerts/:department/test", async (c) => {
    const department = alertKeys.find((d) => d === c.req.param("department"));
    if (!department) return c.json({ error: "No such department." }, 404);
    const hotel = c.get("hotel");
    const sent = await david.alerts.tell(hotel, department, `Test from David at ${hotel.name}: this is where ${department === "manager" ? "escalations and the morning briefing" : "new requests for this department"} will arrive.`);
    const contact = (await store.contacts(hotel.id)).find((x) => x.department === department);
    const system = contact?.integrationUrl ? await david.alerts.integrate(contact, { schema: "david.test.v1", test: true, department, hotel: hotel.name }, `david-test-${Date.now()}`) : null;
    return c.json({ sent, system: system ? { ok: system.ok, error: system.error ?? null } : null });
  });

  // Team: who can see what. Managers and owners only.
  const teamBody = z.object({ role: z.enum(["manager", "staff"]), department: z.enum(DEPARTMENTS).nullable().default(null) })
    .refine((b) => b.role === "manager" || b.department !== null, { message: "Choose which department they work in." });
  app.get("/api/team", async (c) => {
    if (!managersOnly(c)) return c.json({ error: "Only a manager can see the team." }, 403);
    return c.json(await store.team(c.get("hotel").id));
  });
  app.post("/api/team/invites", async (c) => {
    if (!managersOnly(c)) return c.json({ error: "Only a manager can invite people." }, 403);
    const b = z.object({ email: z.string().trim().toLowerCase().email("Enter their email address.").max(200) }).and(teamBody).parse(await c.req.json());
    const hotel = c.get("hotel");
    if ((await store.team(hotel.id)).members.some((m) => m.email?.toLowerCase() === b.email)) return c.json({ error: "They're already on the team." }, 400);
    await store.invite(hotel.id, b.email, b.role, b.role === "manager" ? null : b.department);
    return c.json(await store.team(hotel.id), 201);
  });
  app.delete("/api/team/invites/:id", async (c) => {
    if (!managersOnly(c)) return c.json({ error: "Only a manager can change the team." }, 403);
    await store.deleteInvite(c.get("hotel").id, c.req.param("id"));
    return c.json(await store.team(c.get("hotel").id));
  });
  app.patch("/api/team/:userId", async (c) => {
    if (!managersOnly(c)) return c.json({ error: "Only a manager can change the team." }, 403);
    const b = teamBody.parse(await c.req.json());
    const hotel = c.get("hotel");
    const member = (await store.team(hotel.id)).members.find((m) => m.userId === c.req.param("userId"));
    if (!member) return c.json({ error: "No such person." }, 404);
    if (member.role === "owner") return c.json({ error: "The owner's access can't be changed here." }, 400);
    await store.updateMember(hotel.id, member.userId, { role: b.role, department: b.role === "manager" ? null : b.department });
    return c.json(await store.team(hotel.id));
  });
  app.delete("/api/team/:userId", async (c) => {
    if (!managersOnly(c)) return c.json({ error: "Only a manager can change the team." }, 403);
    const hotel = c.get("hotel");
    const member = (await store.team(hotel.id)).members.find((m) => m.userId === c.req.param("userId"));
    if (!member) return c.json({ error: "No such person." }, 404);
    if (member.role === "owner") return c.json({ error: "The owner can't be removed." }, 400);
    await store.removeMember(hotel.id, member.userId);
    return c.json(await store.team(hotel.id));
  });

  // Square
  const squareView = (h: Hotel) => h.square ?? { connected: false, locationId: null, environment: "production" as const, syncedAt: null };
  const syncSquare = async (hotel: Hotel) => {
    const creds = await store.squareCredentials(hotel.id);
    if (!creds) throw new Error("No such Square connection.");
    const result = await store.syncSquareMenu(hotel.id, await david.square(creds).menu(), david.clock());
    return { ...result, square: squareView((await store.hotel(hotel.id))!) };
  };
  app.get("/api/square", async (c) => c.json({ square: squareView(c.get("hotel")) }));
  app.put("/api/square", async (c) => {
    const b = z.object({
      accessToken: z.string().trim().max(500).optional(), locationId: z.string().trim().min(1, "Enter the Square location ID.").max(100),
      environment: z.enum(["production", "sandbox"]).default("production"),
    }).parse(await c.req.json());
    const hotel = c.get("hotel");
    const stored = await store.squareCredentials(hotel.id);
    const accessToken = b.accessToken || stored?.accessToken;
    if (!accessToken) return c.json({ error: "Paste your Square access token." }, 400);
    // Prove the credentials work before keeping them.
    try { await david.square({ accessToken, locationId: b.locationId, environment: b.environment }).menu(); }
    catch (e) { return c.json({ error: `Square said no: ${e instanceof Error ? e.message.replace(/^Square \d+: /, "") : "could not connect"}` }, 400); }
    await store.setSquare(hotel.id, { accessToken: b.accessToken, locationId: b.locationId, environment: b.environment });
    return c.json(await syncSquare(hotel));
  });
  app.post("/api/square/sync", async (c) => {
    const hotel = c.get("hotel");
    if (!(await store.squareCredentials(hotel.id))) return c.json({ error: "Connect Square first." }, 400);
    try { return c.json(await syncSquare(hotel)); }
    catch (e) { return c.json({ error: `Square said no: ${e instanceof Error ? e.message.replace(/^Square \d+: /, "") : "could not sync"}` }, 502); }
  });
  app.delete("/api/square", async (c) => { await store.clearSquare(c.get("hotel").id); return c.json({ square: squareView((await store.hotel(c.get("hotel").id))!) }); });
  app.post("/api/requests/:id/square", async (c) => {
    const hotel = c.get("hotel");
    const existing = await store.request(c.req.param("id"));
    if (!existing || existing.hotelId !== hotel.id) return c.json({ error: "No such request." }, 404);
    const me = c.get("access");
    if (isScoped(me) && departmentOf(existing.kind) !== me.department) return c.json({ error: "That request belongs to another department." }, 403);
    return c.json({ request: await david.sendToSquare(hotel, existing) });
  });

  // Guests
  app.get("/api/guests", async (c) => {
    const guests = await store.listGuests(c.get("hotel").id, { q: c.req.query("q") });
    const memories = await store.memoriesForGuests(guests.map((g) => g.id));
    return c.json({ guests: guests.map((g) => ({ ...g, interests: interestsOf(memories.get(g.id) ?? []) })) });
  });
  app.post("/api/guests", async (c) => {
    const b = z.object({
      phone: phoneSchema, firstName: z.string().trim().max(60).optional(), lastName: z.string().trim().max(60).optional(), vip: z.boolean().optional(),
      consent: z.boolean().default(false),
      stay: z.object({ arrival: date, departure: date, room: z.string().max(20).optional(), partySize: z.number().int().min(1).max(20).optional() }).optional(),
    }).parse(await c.req.json());
    const hotel = c.get("hotel");
    if (b.stay && b.stay.departure <= b.stay.arrival) return c.json({ error: "Departure must be after arrival." }, 400);
    let guest = await store.guestByPhone(hotel.id, b.phone);
    if (!guest) guest = await store.createGuest({ hotelId: hotel.id, phone: b.phone, firstName: b.firstName, lastName: b.lastName, vip: b.vip, consent: b.consent ? "opted_in" : "unknown", consentSource: b.consent ? "staff_entered" : null });
    else {
      guest = (await store.updateGuest(guest.id, { firstName: b.firstName ?? guest.firstName, lastName: b.lastName ?? guest.lastName, vip: b.vip }))!;
      if (b.consent && guest.consent === "unknown") await store.setConsent(guest.id, "opted_in", "staff_entered");
    }
    const stay = b.stay ? await store.createStay({ hotelId: hotel.id, guestId: guest.id, ...b.stay }) : null;
    return c.json({ guest: await store.guest(guest.id), stay }, 201);
  });
  app.get("/api/guests/:id", async (c) => {
    const hotel = c.get("hotel");
    const guest = await store.guest(c.req.param("id"));
    if (!guest || guest.hotelId !== hotel.id) return c.json({ error: "No such guest." }, 404);
    const [stays, memories, requests, thread, history] = await Promise.all([store.staysOf(guest.id), store.memories(guest.id, true), store.recentRequests(guest.id, 40), store.thread(guest.id, 100), store.recentRequests(guest.id, 300)]);
    const today = localParts(david.clock(), hotel.timezone).date;
    return c.json({ guest, stays, memories, requests, thread, catalogue: buildCatalogue({ guest, memories, requests: history, stays, today, now: david.clock() }) });
  });
  app.patch("/api/guests/:id", async (c) => {
    const b = z.object({ firstName: z.string().trim().max(60).nullable().optional(), lastName: z.string().trim().max(60).nullable().optional(), vip: z.boolean().optional(), notes: z.string().max(1000).nullable().optional() }).parse(await c.req.json());
    const guest = await store.guest(c.req.param("id"));
    if (!guest || guest.hotelId !== c.get("hotel").id) return c.json({ error: "No such guest." }, 404);
    return c.json({ guest: await store.updateGuest(guest.id, b) });
  });
  app.post("/api/guests/:id/stays", async (c) => {
    const b = z.object({ arrival: date, departure: date, room: z.string().max(20).optional(), partySize: z.number().int().min(1).max(20).optional() }).parse(await c.req.json());
    const guest = await store.guest(c.req.param("id"));
    if (!guest || guest.hotelId !== c.get("hotel").id) return c.json({ error: "No such guest." }, 404);
    if (b.departure <= b.arrival) return c.json({ error: "Departure must be after arrival." }, 400);
    return c.json({ stay: await store.createStay({ hotelId: guest.hotelId, guestId: guest.id, ...b }) }, 201);
  });
  app.patch("/api/stays/:id", async (c) => {
    const b = z.object({ room: z.string().max(20).nullable().optional(), arrival: date.optional(), departure: date.optional(), status: z.enum(["booked", "in_house", "departed", "cancelled"]).optional(), notes: z.string().max(500).nullable().optional() }).parse(await c.req.json());
    const stays = await store.db.query("select hotel_id from stays where id = $1", [c.req.param("id")]);
    if (stays.rows[0]?.hotel_id !== c.get("hotel").id) return c.json({ error: "No such stay." }, 404);
    return c.json({ stay: await store.updateStay(c.req.param("id"), b) });
  });
  app.post("/api/guests/:id/memories", async (c) => {
    const b = z.object({ kind: z.enum(MEMORY_KINDS), key: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) }).parse(await c.req.json());
    const guest = await store.guest(c.req.param("id"));
    if (!guest || guest.hotelId !== c.get("hotel").id) return c.json({ error: "No such guest." }, 404);
    return c.json({ memory: await store.learn(guest.hotelId, guest.id, { ...b, key: b.key.toLowerCase(), source: "staff" }, david.clock()) }, 201);
  });
  app.patch("/api/memories/:id", async (c) => {
    const b = z.object({ hidden: z.boolean() }).parse(await c.req.json());
    const m = await store.memory(c.req.param("id"));
    if (!m || m.hotelId !== c.get("hotel").id) return c.json({ error: "No such memory." }, 404);
    await store.setMemoryHidden(m.id, b.hidden);
    return c.json({ ok: true });
  });

  // Conversations
  app.get("/api/conversations", async (c) => c.json({ conversations: await store.conversations(c.get("hotel").id) }));
  app.post("/api/guests/:id/messages", async (c) => {
    const b = z.object({ body: z.string().trim().min(1).max(1000) }).parse(await c.req.json());
    const r = await david.staffReply(c.get("hotel"), c.req.param("id"), b.body);
    return c.json(r, 201);
  });

  // Campaigns
  const campaignBody = z.object({
    name: z.string().trim().min(1).max(80), kind: z.enum(CAMPAIGN_KINDS), enabled: z.boolean().default(true), offsetDays: z.number().int().min(-60).max(365),
    sendHour: z.number().int().min(0).max(23), messageMode: z.enum(["generated", "custom"]).default("generated"), template: z.string().max(1000).default(""),
    guidance: z.string().max(500).default(""), audience: z.object({ repeatOnly: z.boolean().optional(), vipOnly: z.boolean().optional(), minNights: z.number().int().min(1).max(60).optional() }).default({}),
  });
  app.get("/api/campaigns", async (c) => {
    const hotel = c.get("hotel");
    const [list, stats] = await Promise.all([store.campaigns(hotel.id), store.campaignStats(hotel.id)]);
    return c.json({ campaigns: list.map((k) => ({ ...k, sent: stats.get(k.id)?.sent ?? 0, skipped: stats.get(k.id)?.skipped ?? 0 })) });
  });
  app.post("/api/campaigns", async (c) => {
    const b = campaignBody.parse(await c.req.json());
    return c.json({ campaign: await store.createCampaign({ ...b, hotelId: c.get("hotel").id }) }, 201);
  });
  app.patch("/api/campaigns/:id", async (c) => {
    const b = campaignBody.omit({ kind: true }).partial().parse(await c.req.json());
    const existing = await store.campaign(c.req.param("id"));
    if (!existing || existing.hotelId !== c.get("hotel").id) return c.json({ error: "No such campaign." }, 404);
    return c.json({ campaign: await store.updateCampaign(existing.id, b) });
  });
  app.delete("/api/campaigns/:id", async (c) => {
    const existing = await store.campaign(c.req.param("id"));
    if (!existing || existing.hotelId !== c.get("hotel").id) return c.json({ error: "No such campaign." }, 404);
    await store.deleteCampaign(existing.id);
    return c.json({ ok: true });
  });
  app.post("/api/campaigns/:id/preview", async (c) => {
    const b = z.object({ guestId: z.string().uuid().nullable().optional() }).parse(await c.req.json().catch(() => ({})));
    return c.json({ text: await david.preview(c.get("hotel"), c.req.param("id"), b.guestId ?? null) });
  });

  // Services
  const serviceBody = z.object({
    category: z.enum(["room_service", "housekeeping", "laundry", "amenity", "transport", "other"]), name: z.string().trim().min(1).max(80), description: z.string().max(300).default(""),
    priceCents: z.number().int().min(0).nullable().default(null), availableFrom: z.string().nullable().default(null), availableUntil: z.string().nullable().default(null), active: z.boolean().default(true),
  });
  app.get("/api/services", async (c) => c.json({ services: await store.services(c.get("hotel").id) }));
  app.post("/api/services", async (c) => c.json({ service: await store.createService({ ...serviceBody.parse(await c.req.json()), hotelId: c.get("hotel").id }) }, 201));
  app.patch("/api/services/:id", async (c) => {
    const b = serviceBody.partial().parse(await c.req.json());
    const all = await store.services(c.get("hotel").id);
    if (!all.some((s) => s.id === c.req.param("id"))) return c.json({ error: "No such service." }, 404);
    return c.json({ service: await store.updateService(c.req.param("id"), b) });
  });
  app.delete("/api/services/:id", async (c) => {
    const all = await store.services(c.get("hotel").id);
    if (!all.some((s) => s.id === c.req.param("id"))) return c.json({ error: "No such service." }, 404);
    await store.deleteService(c.req.param("id"));
    return c.json({ ok: true });
  });

  // ── Demo only ─────────────────────────────────────────────
  if (deps.demo) {
    app.post("/api/demo/inbound", async (c) => {
      const b = z.object({ phone: phoneSchema, body: z.string().trim().min(1).max(1000), channel: z.enum(["sms", "whatsapp"]).default("sms") }).parse(await c.req.json());
      const r = await david.handleInbound(c.get("hotel"), { from: b.phone, body: b.body, channel: b.channel, sid: `SMsim${Date.now()}${Math.random().toString(36).slice(2, 6)}` });
      return c.json({ guestId: r.guestId, reply: r.reply, requests: r.requests, escalated: r.escalated, source: r.source });
    });
    app.get("/api/demo/pos", (c) => c.json({ tables: deps.pos?.tables ?? [], bookings: deps.pos?.bookings ?? [] }));
    app.post("/api/demo/tick", async (c) => c.json(await david.runTick(c.get("hotel").id)));
    app.post("/api/demo/clock", async (c) => {
      const b = z.object({ advanceHours: z.number().min(-24 * 400).max(24 * 400).optional(), reset: z.boolean().optional() }).parse(await c.req.json());
      if (deps.clock) {
        if (b.reset) deps.clock.offsetMs = 0;
        if (b.advanceHours) deps.clock.offsetMs += b.advanceHours * 3_600_000;
      }
      return c.json({ now: david.clock().toISOString() });
    });
  }

  return app;
}
