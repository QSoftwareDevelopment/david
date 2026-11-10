import { Hono } from "hono";
import type { OhipProfile, OhipReservation, OperaPreferenceType, OperaProfile, OperaReservation } from "../src/opera.js";
import type { SandboxHotel } from "./hotel.js";

/**
 * A stand-in for Opera Cloud's OHIP APIs, holding one fictional hotel in memory.
 *
 * It behaves like the parts of OHIP David uses: an OAuth token, paged reservation search, guest profiles,
 * housekeeping rooms, service requests (work orders), folio charges and preference proposals. It checks
 * the app key, the token and the hotel header the way OHIP does, and refuses what Opera would refuse
 * (a charge on a guest who isn't in house). It is a test double, not Oracle's API: shapes are close to OHIP
 * but not guaranteed identical.
 *
 * `/_sandbox/*` routes are for people testing: see everything that was written, or start over.
 */

export const SANDBOX_CREDENTIALS = { appKey: "sandbox-app-key", clientId: "david-sandbox", clientSecret: "sandbox-secret" };

export interface WorkOrder { serviceRequestId: string; roomId: string | null; code: string; description: string; priority: string; profileId: string | null; externalReference: string; createdAt: string }
export interface FolioCharge { transactionId: string; reservationId: string; transactionCode: string; amount: number; currency: string; description: string; externalReference: string; postedAt: string }
export interface PreferenceProposal { proposalId: string; profileId: string; preferenceType: OperaPreferenceType; preferenceValue: string; status: "PendingApproval"; externalReference: string; createdAt: string }

export interface OperaMockState {
  hotelCode: string;
  data: SandboxHotel;
  workOrders: WorkOrder[];
  charges: FolioCharge[];
  proposals: PreferenceProposal[];
  tokens: Set<string>;
  calls: { method: string; path: string; status: number }[];
}

export function createOperaMock(hotelCode: string, build: () => SandboxHotel) {
  const state: OperaMockState = { hotelCode, data: build(), workOrders: [], charges: [], proposals: [], tokens: new Set(), calls: [] };
  const app = new Hono();
  const problem = (status: number, title: string) => new Response(JSON.stringify({ type: "about:blank", title, status }), { status, headers: { "content-type": "application/json" } });

  app.use("*", async (c, next) => {
    await next();
    if (!c.req.path.startsWith("/_sandbox")) state.calls.push({ method: c.req.method, path: c.req.path, status: c.res.status });
  });

  app.post("/oauth/v1/tokens", async (c) => {
    if (c.req.header("x-app-key") !== SANDBOX_CREDENTIALS.appKey) return problem(401, "Invalid application key");
    const basic = Buffer.from((c.req.header("authorization") ?? "").replace(/^Basic\s+/i, ""), "base64").toString();
    if (basic !== `${SANDBOX_CREDENTIALS.clientId}:${SANDBOX_CREDENTIALS.clientSecret}`) return problem(401, "Invalid client credentials");
    const form = await c.req.parseBody();
    if (form.grant_type !== "client_credentials") return problem(400, "Unsupported grant type");
    const token = `sbx_${crypto.randomUUID()}`;
    state.tokens.add(token);
    return c.json({ access_token: token, token_type: "Bearer", expires_in: 3600 });
  });

  // Everything else needs a token, the app key and the right hotel.
  app.use("/:api{rsv|crm|hsk|fof|csh}/*", async (c, next) => {
    const token = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!state.tokens.has(token)) return problem(401, "Invalid or expired token");
    if (c.req.header("x-app-key") !== SANDBOX_CREDENTIALS.appKey) return problem(401, "Invalid application key");
    const hotel = c.req.path.match(/\/hotels\/([^/]+)/)?.[1];
    if (c.req.header("x-hotelid") !== state.hotelCode || (hotel && hotel !== state.hotelCode)) return problem(403, "Not authorised for this hotel");
    return next();
  });

  app.get("/rsv/v1/hotels/:hotelId/reservations", (c) => {
    const from = c.req.query("arrivalStartDate"), to = c.req.query("arrivalEndDate");
    if (!from || !to) return problem(400, "arrivalStartDate and arrivalEndDate are required");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 200), offset = Number(c.req.query("offset") ?? 0);
    const all = state.data.reservations.filter((r) => r.arrivalDate >= from && r.arrivalDate <= to).sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
    const page = all.slice(offset, offset + limit);
    return c.json({ reservations: { reservationInfo: page.map((r) => ohipReservation(r, state.data.profiles)), totalResults: all.length, hasMore: offset + page.length < all.length } });
  });

  app.get("/crm/v1/profiles/:profileId", (c) => {
    const p = state.data.profiles.find((x) => x.profileId === c.req.param("profileId"));
    return p ? c.json(ohipProfile(p)) : problem(404, "Profile not found");
  });

  app.post("/crm/v1/profiles/:profileId/preferences", async (c) => {
    const profileId = c.req.param("profileId");
    if (!state.data.profiles.some((p) => p.profileId === profileId)) return problem(404, "Profile not found");
    const { preference: p } = (await c.req.json()) as { preference: { preferenceType: OperaPreferenceType; preferenceValue: string; externalReference: string } };
    const seen = state.proposals.find((x) => x.externalReference === p.externalReference);
    if (seen) return c.json({ proposalId: seen.proposalId });
    const proposal: PreferenceProposal = { proposalId: `PP${1000 + state.proposals.length}`, profileId, preferenceType: p.preferenceType, preferenceValue: p.preferenceValue, status: "PendingApproval", externalReference: p.externalReference, createdAt: new Date().toISOString() };
    state.proposals.push(proposal);
    return c.json({ proposalId: proposal.proposalId }, 201);
  });

  app.get("/hsk/v1/hotels/:hotelId/rooms", (c) => c.json({ rooms: state.data.rooms }));

  app.post("/fof/v1/hotels/:hotelId/serviceRequests", async (c) => {
    const { serviceRequest: s } = (await c.req.json()) as { serviceRequest: Omit<WorkOrder, "serviceRequestId" | "createdAt"> };
    if (!s?.code || !s.description || !s.externalReference) return problem(400, "code, description and externalReference are required");
    if (s.roomId && !state.data.rooms.some((r) => r.roomId === s.roomId)) return problem(400, `Unknown room ${s.roomId}`);
    const seen = state.workOrders.find((w) => w.externalReference === s.externalReference);
    if (seen) return c.json({ serviceRequestId: seen.serviceRequestId });
    const order: WorkOrder = { ...s, serviceRequestId: `WO${44800 + state.workOrders.length}`, createdAt: new Date().toISOString() };
    state.workOrders.push(order);
    return c.json({ serviceRequestId: order.serviceRequestId }, 201);
  });

  app.post("/csh/v1/hotels/:hotelId/reservations/:reservationId/charges", async (c) => {
    const r = state.data.reservations.find((x) => x.reservationId === c.req.param("reservationId"));
    if (!r) return problem(404, "Reservation not found");
    if (r.status !== "InHouse") return problem(409, `Reservation is ${r.status}; charges need an in-house guest`);
    const { charges } = (await c.req.json()) as { charges: { transactionCode: string; amount: { amount: number; currencyCode: string }; description: string; externalReference: string }[] };
    const charge = charges?.[0];
    if (!charge || !(charge.amount?.amount > 0)) return problem(400, "A positive amount is required");
    const seen = state.charges.find((x) => x.externalReference === charge.externalReference);
    if (seen) return c.json({ transactionId: seen.transactionId });
    const posted: FolioCharge = { transactionId: `TX${90000 + state.charges.length}`, reservationId: r.reservationId, transactionCode: charge.transactionCode, amount: charge.amount.amount, currency: charge.amount.currencyCode, description: charge.description, externalReference: charge.externalReference, postedAt: new Date().toISOString() };
    state.charges.push(posted);
    return c.json({ transactionId: posted.transactionId }, 201);
  });

  app.get("/_sandbox/state", (c) => c.json({ hotelCode: state.hotelCode, rooms: state.data.rooms, profiles: state.data.profiles, reservations: state.data.reservations, workOrders: state.workOrders, charges: state.charges, proposals: state.proposals, calls: state.calls.length }));
  app.post("/_sandbox/reset", (c) => {
    state.data = build();
    state.workOrders = []; state.charges = []; state.proposals = []; state.calls = [];
    return c.json({ ok: true });
  });

  /** A fetch that goes straight to this mock, for running without a port. */
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => app.fetch(new Request(input, init))) as typeof fetch;
  return { app, state, fetch: fetchImpl };
}

function ohipReservation(r: OperaReservation, profiles: OperaProfile[]): OhipReservation {
  const p = profiles.find((x) => x.profileId === r.profileId);
  return {
    reservationIdList: [{ id: r.reservationId, type: "Reservation" }, { id: r.confirmationNo, type: "Confirmation" }],
    reservationStatus: r.status,
    roomStay: { arrivalDate: r.arrivalDate, departureDate: r.departureDate, roomType: r.roomType, roomId: r.roomId, adultCount: r.adults, childCount: r.children, ratePlanCode: r.ratePlan, expectedTimes: { reservationExpectedArrivalTime: r.eta } },
    reservationGuest: { id: r.profileId, givenName: p?.givenName ?? "", surname: p?.surname ?? "" },
    sourceOfBusiness: r.source,
    comments: r.comments.map((text) => ({ comment: { text } })),
  };
}

function ohipProfile(p: OperaProfile): OhipProfile {
  const byType = new Map<OperaPreferenceType, string[]>();
  for (const x of p.preferences) byType.set(x.type, [...(byType.get(x.type) ?? []), x.value]);
  return {
    profileDetails: {
      customer: { personName: [{ givenName: p.givenName, surname: p.surname, nameType: "Primary" }], language: p.language, nationality: p.nationality },
      telephones: { telephoneInfo: p.mobile ? [{ telephone: { phoneNumber: p.mobile, phoneUseType: "MOBILE" } }] : [] },
      emails: { emailInfo: p.email ? [{ email: { emailAddress: p.email } }] : [] },
      preferenceCollection: [...byType].map(([preferenceType, values]) => ({ preferenceType, preference: values.map((preferenceValue) => ({ preferenceValue })) })),
      vipStatus: p.vipCode ? { code: p.vipCode } : null,
      privacyInfo: { optInSms: p.smsOptIn },
    },
  };
}
