import type { Fact } from "./memory.js";
import { normalizePhone } from "./sms.js";
import { addDays } from "./time.js";
import type { Store } from "./store.js";
import type { Consent, GuestRequest, Hotel, MemoryKind, RequestKind, StayStatus } from "./types.js";

/**
 * Opera: the hotel's system of record.
 *
 * David reads reservations and guest profiles from Opera and writes three things back: work orders for
 * maintenance and housekeeping, room charges for what a guest orders, and preferences David learned, which
 * wait in Opera for a person to approve. Opera stays the record; David never overwrites a profile.
 *
 * The client talks to OHIP (Oracle Hospitality Integration Platform). Paths and field names follow OHIP's
 * shape but were written without access to Oracle's sandbox: check them against Oracle's API reference for
 * the property's Opera version before going live. Everything Opera-specific is parsed in this file, so a
 * correction lands here and nowhere else.
 */

export interface OperaConfig {
  baseUrl: string;
  /** OHIP's application key, sent as `x-app-key` on every call. */
  appKey: string;
  clientId: string;
  clientSecret: string;
  /** The property's code, sent as `x-hotelid`. */
  hotelCode: string;
}

export type OperaReservationStatus = "Reserved" | "InHouse" | "CheckedOut" | "Cancelled" | "NoShow";

export interface OperaReservation {
  reservationId: string;
  confirmationNo: string;
  profileId: string;
  status: OperaReservationStatus;
  arrivalDate: string;
  departureDate: string;
  roomType: string;
  roomId: string | null;
  adults: number;
  children: number;
  ratePlan: string;
  /** Where the booking came from: Direct, Booking.com, Agoda, Expedia… */
  source: string;
  /** Expected arrival, local time as HH:MM. */
  eta: string | null;
  comments: string[];
}

export type OperaPreferenceType = "ALLERGY" | "DIET" | "PILLOW" | "ROOM" | "OCCASION" | "BEVERAGE" | "TEMPERATURE" | "DISLIKE";

export interface OperaPreference {
  type: OperaPreferenceType;
  value: string;
}

export interface OperaProfile {
  profileId: string;
  givenName: string;
  surname: string;
  /** ISO 639-1, e.g. "vi", "en", "ko". */
  language: string;
  nationality: string;
  mobile: string | null;
  email: string | null;
  vipCode: string | null;
  preferences: OperaPreference[];
  /** Whether the guest agreed to messages from the hotel. Null when the profile doesn't say. */
  smsOptIn: boolean | null;
}

export interface OperaRoom {
  roomId: string;
  roomType: string;
  floor: number;
  housekeeping: "Clean" | "Dirty" | "Inspected" | "OutOfOrder";
  occupied: boolean;
}

/** Departments as Opera service request codes. */
const SERVICE_CODE: Partial<Record<RequestKind, string>> = {
  maintenance: "ENG",
  housekeeping: "HSK",
  laundry: "LND",
  amenities: "HSK",
};

export class OperaError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export class OperaClient {
  private token: { value: string; expires: number } | null = null;
  private profiles = new Map<string, OperaProfile>();

  constructor(readonly config: OperaConfig, private fetchImpl: typeof fetch = fetch, private now: () => number = Date.now) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > this.now() + 60_000) return this.token.value;
    const res = await this.fetchImpl(`${this.config.baseUrl}/oauth/v1/tokens`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-app-key": this.config.appKey,
        authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!res.ok) throw new OperaError(res.status, `Opera sign-in failed (${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expires: this.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "x-app-key": this.config.appKey,
        "x-hotelid": this.config.hotelCode,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null) as { title?: string } | null;
      throw new OperaError(res.status, detail?.title ?? `Opera ${method} ${path} failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  /** Every reservation arriving between two dates, inclusive, across all pages. */
  async reservations(from: string, to: string): Promise<OperaReservation[]> {
    const out: OperaReservation[] = [];
    for (let offset = 0; ; ) {
      const q = new URLSearchParams({ arrivalStartDate: from, arrivalEndDate: to, limit: "50", offset: String(offset) });
      const page = await this.call<OhipReservationPage>("GET", `/rsv/v1/hotels/${this.config.hotelCode}/reservations?${q}`);
      const info = page.reservations?.reservationInfo ?? [];
      out.push(...info.map(reservationFrom));
      if (!page.reservations?.hasMore || info.length === 0) break;
      offset += info.length;
    }
    return out;
  }

  async profile(profileId: string): Promise<OperaProfile> {
    const cached = this.profiles.get(profileId);
    if (cached) return cached;
    const body = await this.call<OhipProfile>("GET", `/crm/v1/profiles/${encodeURIComponent(profileId)}`);
    const p = profileFrom(profileId, body);
    this.profiles.set(profileId, p);
    return p;
  }

  async rooms(): Promise<OperaRoom[]> {
    const body = await this.call<{ rooms: OperaRoom[] }>("GET", `/hsk/v1/hotels/${this.config.hotelCode}/rooms`);
    return body.rooms;
  }

  /** A work order. Sending the same reference twice returns the first one. */
  async createServiceRequest(input: { roomId: string | null; code: string; description: string; priority: "Normal" | "High"; profileId: string | null; externalReference: string }): Promise<{ serviceRequestId: string }> {
    return this.call("POST", `/fof/v1/hotels/${this.config.hotelCode}/serviceRequests`, { serviceRequest: input });
  }

  /** A charge on the guest's folio. Opera refuses it unless the guest is in house. */
  async postCharge(reservationId: string, input: { transactionCode: string; amount: number; currency: string; description: string; externalReference: string }): Promise<{ transactionId: string }> {
    return this.call("POST", `/csh/v1/hotels/${this.config.hotelCode}/reservations/${encodeURIComponent(reservationId)}/charges`, {
      charges: [{ transactionCode: input.transactionCode, amount: { amount: input.amount, currencyCode: input.currency }, description: input.description, externalReference: input.externalReference }],
    });
  }

  /** A preference David learned, waiting in Opera for a person to approve. */
  async proposePreference(profileId: string, input: { type: OperaPreferenceType; value: string; externalReference: string }): Promise<{ proposalId: string }> {
    return this.call("POST", `/crm/v1/profiles/${encodeURIComponent(profileId)}/preferences`, {
      preference: { preferenceType: input.type, preferenceValue: input.value, source: "David", status: "PendingApproval", externalReference: input.externalReference },
    });
  }
}

// ── OHIP shapes ─────────────────────────────────────────────

export interface OhipReservation {
  reservationIdList: { id: string; type: "Reservation" | "Confirmation" }[];
  reservationStatus: OperaReservationStatus;
  roomStay: { arrivalDate: string; departureDate: string; roomType: string; roomId?: string | null; adultCount: number; childCount: number; ratePlanCode: string; expectedTimes?: { reservationExpectedArrivalTime?: string | null } };
  reservationGuest: { id: string; givenName: string; surname: string };
  sourceOfBusiness: string;
  comments?: { comment: { text: string } }[];
}
export interface OhipReservationPage {
  reservations: { reservationInfo: OhipReservation[]; totalResults: number; hasMore: boolean };
}
export interface OhipProfile {
  profileDetails: {
    customer: { personName: { givenName: string; surname: string; nameType: "Primary" }[]; language: string; nationality: string };
    telephones?: { telephoneInfo: { telephone: { phoneNumber: string; phoneUseType: "MOBILE" | "HOME" | "BUSINESS" } }[] };
    emails?: { emailInfo: { email: { emailAddress: string } }[] };
    preferenceCollection?: { preferenceType: OperaPreferenceType; preference: { preferenceValue: string }[] }[];
    vipStatus?: { code: string } | null;
    privacyInfo?: { optInSms?: boolean | null };
  };
}

function reservationFrom(r: OhipReservation): OperaReservation {
  const id = (type: string) => r.reservationIdList.find((x) => x.type === type)?.id ?? "";
  return {
    reservationId: id("Reservation"),
    confirmationNo: id("Confirmation"),
    profileId: r.reservationGuest.id,
    status: r.reservationStatus,
    arrivalDate: r.roomStay.arrivalDate,
    departureDate: r.roomStay.departureDate,
    roomType: r.roomStay.roomType,
    roomId: r.roomStay.roomId ?? null,
    adults: r.roomStay.adultCount,
    children: r.roomStay.childCount,
    ratePlan: r.roomStay.ratePlanCode,
    source: r.sourceOfBusiness,
    eta: r.roomStay.expectedTimes?.reservationExpectedArrivalTime ?? null,
    comments: (r.comments ?? []).map((c) => c.comment.text),
  };
}

function profileFrom(profileId: string, p: OhipProfile): OperaProfile {
  const d = p.profileDetails;
  const name = d.customer.personName.find((n) => n.nameType === "Primary") ?? d.customer.personName[0];
  const phones = d.telephones?.telephoneInfo ?? [];
  return {
    profileId,
    givenName: name?.givenName ?? "",
    surname: name?.surname ?? "",
    language: d.customer.language,
    nationality: d.customer.nationality,
    mobile: (phones.find((t) => t.telephone.phoneUseType === "MOBILE") ?? phones[0])?.telephone.phoneNumber ?? null,
    email: d.emails?.emailInfo[0]?.email.emailAddress ?? null,
    vipCode: d.vipStatus?.code ?? null,
    preferences: (d.preferenceCollection ?? []).flatMap((c) => c.preference.map((x) => ({ type: c.preferenceType, value: x.preferenceValue }))),
    smsOptIn: d.privacyInfo?.optInSms ?? null,
  };
}

// ── Sync: Opera → David ─────────────────────────────────────

const STAY_STATUS: Record<OperaReservationStatus, StayStatus> = {
  Reserved: "booked", InHouse: "in_house", CheckedOut: "departed", Cancelled: "cancelled", NoShow: "cancelled",
};

/** How an Opera preference becomes something David remembers. */
const MEMORY_OF: Record<OperaPreferenceType, { kind: MemoryKind; key: string }> = {
  ALLERGY: { kind: "dietary", key: "allergy" },
  DIET: { kind: "dietary", key: "diet" },
  PILLOW: { kind: "preference", key: "pillows" },
  ROOM: { kind: "preference", key: "room" },
  OCCASION: { kind: "occasion", key: "occasion" },
  BEVERAGE: { kind: "preference", key: "coffee" },
  TEMPERATURE: { kind: "preference", key: "temperature" },
  DISLIKE: { kind: "dislike", key: "dislike" },
};

export interface SyncResult {
  reservations: number;
  guestsCreated: number;
  staysCreated: number;
  staysUpdated: number;
  memoriesLearned: number;
  skipped: { reservationId: string; name: string; reason: string }[];
}

function consentOf(p: OperaProfile): Consent {
  return p.smsOptIn === true ? "opted_in" : p.smsOptIn === false ? "opted_out" : "unknown";
}

/**
 * Pull reservations arriving within `daysBack` before and `daysAhead` after today into David: one guest per
 * mobile number, one stay per reservation, and the profile's preferences as memories. Running it again
 * changes nothing that hasn't changed in Opera. A guest's own "stop" in David is never undone by Opera.
 */
export async function syncFromOpera(store: Store, hotel: Hotel, opera: OperaClient, today: string, now: Date, window = { daysBack: 30, daysAhead: 60 }): Promise<SyncResult> {
  const result: SyncResult = { reservations: 0, guestsCreated: 0, staysCreated: 0, staysUpdated: 0, memoriesLearned: 0, skipped: [] };
  const reservations = await opera.reservations(addDays(today, -window.daysBack), addDays(today, window.daysAhead));
  result.reservations = reservations.length;

  for (const r of reservations) {
    const p = await opera.profile(r.profileId);
    const name = `${p.givenName} ${p.surname}`.trim();
    const phone = p.mobile ? normalizePhone(p.mobile) : null;
    if (!phone) {
      result.skipped.push({ reservationId: r.reservationId, name, reason: "no mobile number in Opera" });
      continue;
    }

    let guest = await store.guestByPhone(hotel.id, phone);
    if (!guest) {
      guest = await store.createGuest({ hotelId: hotel.id, phone, firstName: p.givenName || null, lastName: p.surname || null, consent: consentOf(p), consentSource: "opera", vip: !!p.vipCode, language: p.language || "en" });
      result.guestsCreated++;
    } else {
      await store.updateGuest(guest.id, { firstName: guest.firstName ?? p.givenName, lastName: guest.lastName ?? p.surname, vip: !!p.vipCode, language: p.language || guest.language });
      // Opera can record a new opt-in or opt-out, but a guest who texted STOP stays out.
      const consent = consentOf(p);
      if (consent !== "unknown" && consent !== guest.consent && guest.consent !== "opted_out") await store.setConsent(guest.id, consent, "opera");
    }

    const notes = r.comments.length ? r.comments.join(" · ") : null;
    const existing = (await store.staysOf(guest.id)).find((s) => s.arrival === r.arrivalDate && s.departure === r.departureDate);
    const stay = existing ?? (await store.createStay({ hotelId: hotel.id, guestId: guest.id, arrival: r.arrivalDate, departure: r.departureDate, room: r.roomId, partySize: r.adults + r.children, notes }));
    if (existing) {
      const status = STAY_STATUS[r.status];
      if (existing.room !== r.roomId || existing.notes !== notes || (status === "cancelled") !== (existing.status === "cancelled")) {
        await store.updateStay(existing.id, { room: r.roomId, notes, ...(status === "cancelled" || existing.status === "cancelled" ? { status } : {}) });
        result.staysUpdated++;
      }
    } else {
      result.staysCreated++;
      if (STAY_STATUS[r.status] === "cancelled") await store.updateStay(stay.id, { status: "cancelled" });
    }
    if (r.eta && stay.eta !== r.eta) await store.setStayEta(stay.id, r.eta);

    const known = await store.memories(guest.id, true);
    for (const pref of p.preferences) {
      const m = MEMORY_OF[pref.type];
      if (known.some((k) => k.kind === m.kind && k.key === m.key && k.value === pref.value)) continue;
      const fact: Fact = { kind: m.kind, key: m.key, value: pref.value, source: "staff", confidence: 0.9 };
      if (await store.learn(hotel.id, guest.id, fact, now, stay.id)) result.memoriesLearned++;
    }
  }
  await store.refreshStayStatuses(hotel.id, today);
  return result;
}

// ── Write-back: David → Opera ───────────────────────────────

export interface PushResult {
  workOrders: number;
  charges: number;
  preferences: number;
  failed: { what: string; error: string }[];
}

/** Opera preference types David may propose, from what he remembers. */
const PREFERENCE_OF: Record<string, OperaPreferenceType> = {
  "dietary/allergy": "ALLERGY", "dietary/diet": "DIET", "preference/pillows": "PILLOW", "preference/room": "ROOM",
  "preference/coffee": "BEVERAGE", "preference/temperature": "TEMPERATURE",
};

/**
 * Send what David did back to Opera: open maintenance, housekeeping, laundry and amenity requests as work
 * orders, room service with a menu price as charges on the folio, and what guests told David as preferences
 * for approval. Every call carries David's own id as its reference, so pushing again never doubles anything.
 */
export async function pushToOpera(store: Store, hotel: Hotel, opera: OperaClient, today: string, opts: { currency: string; daysBack?: number; daysAhead?: number }): Promise<PushResult> {
  const out: PushResult = { workOrders: 0, charges: 0, preferences: 0, failed: [] };
  const reservations = await opera.reservations(addDays(today, -(opts.daysBack ?? 30)), addDays(today, opts.daysAhead ?? 60));
  // Which Opera reservation and profile each of David's stays and guests belongs to.
  const byStay = new Map<string, OperaReservation>();
  const profileOfGuest = new Map<string, string>();
  for (const r of reservations) {
    const p = await opera.profile(r.profileId);
    const phone = p.mobile ? normalizePhone(p.mobile) : null;
    const guest = phone ? await store.guestByPhone(hotel.id, phone) : null;
    if (!guest) continue;
    profileOfGuest.set(guest.id, p.profileId);
    const stay = (await store.staysOf(guest.id)).find((s) => s.arrival === r.arrivalDate && s.departure === r.departureDate);
    if (stay) byStay.set(stay.id, r);
  }

  const prices = new Map((await store.services(hotel.id)).filter((s) => s.priceCents != null).map((s) => [s.name.toLowerCase(), s.priceCents as number]));
  const attempt = async (what: string, fn: () => Promise<unknown>) => {
    try { await fn(); return true; } catch (e) { out.failed.push({ what, error: e instanceof Error ? e.message : String(e) }); return false; }
  };

  for (const req of await store.listRequests(hotel.id, { status: ["new", "in_progress", "done"] })) {
    const reservation = req.stayId ? byStay.get(req.stayId) : undefined;
    const code = SERVICE_CODE[req.kind];
    if (code && req.status !== "done") {
      if (await attempt(`work order for "${req.summary}"`, () => opera.createServiceRequest({
        roomId: reservation?.roomId ?? req.room ?? null, code, description: req.summary, priority: req.priority === "urgent" ? "High" : "Normal",
        profileId: profileOfGuest.get(req.guestId) ?? null, externalReference: `david:${req.id}`,
      }))) out.workOrders++;
    }
    if (req.kind === "room_service" && reservation) {
      const lines = itemsOf(req).map((item) => [item, prices.get(item.toLowerCase())] as const).filter((x): x is readonly [string, number] => x[1] != null);
      for (const [i, [item, cents]] of lines.entries()) {
        if (await attempt(`charge for ${item}`, () => opera.postCharge(reservation.reservationId, {
          transactionCode: "RS", amount: cents / 100, currency: opts.currency, description: `Room service: ${item}`, externalReference: `david:${req.id}:${i}`,
        }))) out.charges++;
      }
    }
  }

  for (const [guestId, profileId] of profileOfGuest) {
    for (const m of await store.memories(guestId)) {
      const type = PREFERENCE_OF[`${m.kind}/${m.key}`];
      if (!type || m.source === "staff") continue; // Staff facts came from Opera in the first place.
      if (await attempt(`preference "${m.value}"`, () => opera.proposePreference(profileId, { type, value: m.value, externalReference: `david:${m.id}` }))) out.preferences++;
    }
  }
  return out;
}

function itemsOf(r: GuestRequest): string[] {
  const items = r.details.items;
  return Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [];
}

