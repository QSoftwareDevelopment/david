import type { Db } from "./db.js";
import type { Fact } from "./memory.js";
import { merge } from "./memory.js";
import { DEPARTMENTS, DEPARTMENT_LABEL, departmentOf, kindsOf, type Access, type Department, type Role } from "./departments.js";
import type { SquareCredentials, SquareMenuItem } from "./square.js";
import type {
  Campaign, CampaignAudience, CampaignKind, Consent, Guest, GuestRequest, Hotel, Memory, Message, MessageAuthor,
  RequestKind, RequestStatus, Service, ServiceCategory, Stay, StayStatus,
} from "./types.js";

type Row = Record<string, any>;
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

const hotelOf = (r: Row): Hotel => ({
  id: r.id, name: r.name, slug: r.slug, timezone: r.timezone, smsNumber: r.sms_number, tone: r.tone, signature: r.signature,
  quietStart: r.quiet_start, quietEnd: r.quiet_end, checkinTime: r.checkin_time, checkoutTime: r.checkout_time,
  reviewUrl: r.review_url ?? null, briefingHour: r.briefing_hour ?? 7,
  square: { connected: !!(r.square_access_token && r.square_location_id), locationId: r.square_location_id ?? null, environment: r.square_environment ?? "production", syncedAt: r.square_synced_at ? iso(r.square_synced_at) : null },
});
const guestOf = (r: Row): Guest => ({
  id: r.id, hotelId: r.hotel_id, phone: r.phone, firstName: r.first_name, lastName: r.last_name, language: r.language,
  consent: r.consent, consentAt: r.consent_at ? iso(r.consent_at) : null, vip: r.vip, notes: r.notes, createdAt: iso(r.created_at),
});
const stayOf = (r: Row): Stay => ({
  id: r.id, hotelId: r.hotel_id, guestId: r.guest_id, room: r.room, arrival: day(r.arrival), departure: day(r.departure),
  partySize: r.party_size, status: r.status, notes: r.notes, eta: r.eta ?? null,
});
const memoryOf = (r: Row): Memory => ({
  id: r.id, guestId: r.guest_id, kind: r.kind, key: r.key, value: r.value, confidence: Number(r.confidence), evidence: r.evidence,
  source: r.source, hidden: r.hidden, firstSeen: iso(r.first_seen), lastSeen: iso(r.last_seen),
});
const requestOf = (r: Row): GuestRequest => ({
  id: r.id, hotelId: r.hotel_id, guestId: r.guest_id, stayId: r.stay_id, kind: r.kind, summary: r.summary,
  details: (r.details ?? {}) as Record<string, unknown>, status: r.status, priority: r.priority, createdBy: r.created_by,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), completedAt: r.completed_at ? iso(r.completed_at) : null,
  squareOrderId: r.square_order_id ?? null, squareError: r.square_error ?? null,
  notifiedAt: r.notified_at ? iso(r.notified_at) : null, remindedAt: r.reminded_at ? iso(r.reminded_at) : null, escalatedAt: r.escalated_at ? iso(r.escalated_at) : null,
});
const messageOf = (r: Row): Message => ({
  id: r.id, hotelId: r.hotel_id, guestId: r.guest_id, direction: r.direction, author: r.author, body: r.body, status: r.status,
  campaignId: r.campaign_id, createdAt: iso(r.created_at),
});
const campaignOf = (r: Row): Campaign => ({
  id: r.id, hotelId: r.hotel_id, name: r.name, kind: r.kind, enabled: r.enabled, offsetDays: r.offset_days, sendHour: r.send_hour,
  messageMode: r.message_mode, template: r.template, guidance: r.guidance, audience: (r.audience ?? {}) as CampaignAudience,
});
const serviceOf = (r: Row): Service => ({
  id: r.id, hotelId: r.hotel_id, category: r.category, name: r.name, description: r.description,
  priceCents: r.price_cents, availableFrom: r.available_from, availableUntil: r.available_until, active: r.active,
  squareVariationId: r.square_variation_id ?? null,
});

export interface Contact {
  department: Department | "manager";
  smsNumber: string | null;
  webhookUrl: string | null;
}

export class Store {
  constructor(readonly db: Db) {}

  // ── Hotels ───────────────────────────────────────────────
  async hotel(id: string): Promise<Hotel | null> {
    const { rows } = await this.db.query("select * from hotels where id = $1", [id]);
    return rows[0] ? hotelOf(rows[0]) : null;
  }
  async hotelBySlug(slug: string): Promise<Hotel | null> {
    const { rows } = await this.db.query("select * from hotels where slug = $1", [slug]);
    return rows[0] ? hotelOf(rows[0]) : null;
  }
  async hotelBySmsNumber(number: string): Promise<Hotel | null> {
    const { rows } = await this.db.query("select * from hotels where sms_number = $1", [number]);
    return rows[0] ? hotelOf(rows[0]) : null;
  }
  async allHotels(): Promise<Hotel[]> {
    const { rows } = await this.db.query("select * from hotels order by name");
    return rows.map(hotelOf);
  }
  async hotelsForUser(userId: string): Promise<Hotel[]> {
    const { rows } = await this.db.query("select h.* from hotels h join staff s on s.hotel_id = h.id where s.user_id = $1 order by h.name", [userId]);
    return rows.map(hotelOf);
  }
  async createHotel(input: { name: string; slug: string; timezone?: string; smsNumber?: string | null; tone?: string; signature?: string }): Promise<Hotel> {
    const { rows } = await this.db.query(
      `insert into hotels (name, slug, timezone, sms_number, tone, signature) values ($1,$2,coalesce($3,'America/Toronto'),$4,coalesce($5,'warm, polished and brief'),coalesce($6,'')) returning *`,
      [input.name, input.slug, input.timezone ?? null, input.smsNumber ?? null, input.tone ?? null, input.signature ?? null],
    );
    return hotelOf(rows[0]!);
  }
  async updateHotel(id: string, p: Partial<Pick<Hotel, "name" | "timezone" | "smsNumber" | "tone" | "signature" | "quietStart" | "quietEnd" | "checkinTime" | "checkoutTime" | "reviewUrl" | "briefingHour">>): Promise<Hotel | null> {
    const { rows } = await this.db.query(
      `update hotels set name = coalesce($2, name), timezone = coalesce($3, timezone), sms_number = case when $4::boolean then $5 else sms_number end,
         tone = coalesce($6, tone), signature = coalesce($7, signature), quiet_start = coalesce($8, quiet_start), quiet_end = coalesce($9, quiet_end),
         checkin_time = coalesce($10, checkin_time), checkout_time = coalesce($11, checkout_time),
         review_url = case when $12::boolean then $13 else review_url end, briefing_hour = coalesce($14, briefing_hour) where id = $1 returning *`,
      [id, p.name ?? null, p.timezone ?? null, p.smsNumber !== undefined, p.smsNumber ?? null, p.tone ?? null, p.signature ?? null, p.quietStart ?? null, p.quietEnd ?? null, p.checkinTime ?? null, p.checkoutTime ?? null, p.reviewUrl !== undefined, p.reviewUrl ?? null, p.briefingHour ?? null],
    );
    return rows[0] ? hotelOf(rows[0]) : null;
  }
  async addStaff(userId: string, hotelId: string, email: string | null, role: Role = "staff", department: Department | null = null): Promise<void> {
    await this.db.query(
      "insert into staff (user_id, hotel_id, role, email, department) values ($1,$2,$3,$4,$5) on conflict (user_id, hotel_id) do update set role = $3, email = $4, department = $5",
      [userId, hotelId, role, email, department]);
  }

  // ── Alerts: where each department hears about things ─────
  async contacts(hotelId: string): Promise<Contact[]> {
    const { rows } = await this.db.query("select department, sms_number, webhook_url from department_contacts where hotel_id = $1", [hotelId]);
    return rows.map((r) => ({ department: r.department as Contact["department"], smsNumber: (r.sms_number as string | null) ?? null, webhookUrl: (r.webhook_url as string | null) ?? null }));
  }
  async setContact(hotelId: string, c: Contact): Promise<void> {
    if (!c.smsNumber && !c.webhookUrl) {
      await this.db.query("delete from department_contacts where hotel_id = $1 and department = $2", [hotelId, c.department]);
      return;
    }
    await this.db.query(
      "insert into department_contacts (hotel_id, department, sms_number, webhook_url) values ($1,$2,$3,$4) on conflict (hotel_id, department) do update set sms_number = $3, webhook_url = $4",
      [hotelId, c.department, c.smsNumber, c.webhookUrl]);
  }
  async markRequest(id: string, field: "notified_at" | "reminded_at" | "escalated_at", at: Date): Promise<void> {
    await this.db.query(`update requests set ${field} = $2::timestamptz where id = $1`, [id, at.toISOString()]);
  }
  /** Requests nobody has picked up yet, with who and where, for reminders. */
  async untouchedRequests(hotelId: string) {
    const { rows } = await this.db.query(
      `select r.*, g.first_name, g.last_name, g.phone, s.room from requests r join guests g on g.id = r.guest_id left join stays s on s.id = r.stay_id
        where r.hotel_id = $1 and r.status = 'new' order by r.created_at`, [hotelId]);
    return rows.map((r) => ({ ...requestOf(r), guestName: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.phone as string), room: (r.room as string | null) ?? null }));
  }
  async setStayEta(stayId: string, eta: string | null): Promise<void> {
    await this.db.query("update stays set eta = $2 where id = $1", [stayId, eta]);
  }
  async addFeedback(input: { hotelId: string; guestId: string; stayId: string | null; moment: "mid_stay" | "post_stay"; score: number; at: Date }): Promise<void> {
    await this.db.query("insert into feedback (hotel_id, guest_id, stay_id, moment, score, created_at) values ($1,$2,$3,$4,$5,$6::timestamptz)", [input.hotelId, input.guestId, input.stayId, input.moment, input.score, input.at.toISOString()]);
  }
  /** The last campaign text David sent this guest, if there is one, so a bare "9" can be read as an answer to it. */
  async lastCampaignText(guestId: string): Promise<{ kind: string; at: Date } | null> {
    const { rows } = await this.db.query(
      `select c.kind, m.created_at from messages m join campaigns c on c.id = m.campaign_id
        where m.guest_id = $1 and m.direction = 'out' order by m.created_at desc limit 1`, [guestId]);
    return rows[0] ? { kind: rows[0].kind as string, at: new Date(rows[0].created_at as string) } : null;
  }
  async feedbackSince(hotelId: string, since: Date) {
    const { rows } = await this.db.query("select score, moment from feedback where hotel_id = $1 and created_at >= $2::timestamptz", [hotelId, since.toISOString()]);
    return rows.map((r) => ({ score: r.score as number, moment: r.moment as string }));
  }
  async setLastBriefing(hotelId: string, date: string): Promise<void> {
    await this.db.query("update hotels set last_briefing_date = $2::date where id = $1", [hotelId, date]);
  }
  async lastBriefing(hotelId: string): Promise<string | null> {
    const { rows } = await this.db.query("select last_briefing_date from hotels where id = $1", [hotelId]);
    return rows[0]?.last_briefing_date ? day(rows[0].last_briefing_date) : null;
  }

  // ── Team ─────────────────────────────────────────────────
  async staffAccess(userId: string, hotelId: string): Promise<Access | null> {
    const { rows } = await this.db.query("select role, department from staff where user_id = $1 and hotel_id = $2", [userId, hotelId]);
    return rows[0] ? { role: rows[0].role as Role, department: (rows[0].department as Department | null) ?? null } : null;
  }
  async team(hotelId: string) {
    const [members, invites] = await Promise.all([
      this.db.query("select user_id, email, role, department from staff where hotel_id = $1 order by case role when 'owner' then 0 when 'manager' then 1 else 2 end, department nulls first, email", [hotelId]),
      this.db.query("select id, email, role, department, created_at from staff_invites where hotel_id = $1 order by created_at", [hotelId]),
    ]);
    return {
      members: members.rows.map((r) => ({ userId: r.user_id as string, email: (r.email as string | null) ?? null, role: r.role as Role, department: (r.department as Department | null) ?? null })),
      invites: invites.rows.map((r) => ({ id: r.id as string, email: r.email as string, role: r.role as Role, department: (r.department as Department | null) ?? null, createdAt: iso(r.created_at) })),
    };
  }
  async invite(hotelId: string, email: string, role: "manager" | "staff", department: Department | null) {
    await this.db.query(
      "insert into staff_invites (hotel_id, email, role, department) values ($1,$2,$3,$4) on conflict (hotel_id, email) do update set role = $3, department = $4",
      [hotelId, email.trim().toLowerCase(), role, department]);
  }
  async deleteInvite(hotelId: string, id: string): Promise<void> {
    await this.db.query("delete from staff_invites where hotel_id = $1 and id = $2", [hotelId, id]);
  }
  /** Turn invitations for this address into staff rows. Run when someone signs in. */
  async claimInvites(userId: string, email: string): Promise<void> {
    const { rows } = await this.db.query("delete from staff_invites where email = $1 returning hotel_id, role, department", [email.trim().toLowerCase()]);
    for (const r of rows) {
      await this.db.query("insert into staff (user_id, hotel_id, role, email, department) values ($1,$2,$3,$4,$5) on conflict (user_id, hotel_id) do nothing", [userId, r.hotel_id, r.role, email.trim().toLowerCase(), r.department ?? null]);
    }
  }
  async updateMember(hotelId: string, userId: string, p: { role: Role; department: Department | null }): Promise<void> {
    await this.db.query("update staff set role = $3, department = $4 where hotel_id = $1 and user_id = $2", [hotelId, userId, p.role, p.department]);
  }
  async removeMember(hotelId: string, userId: string): Promise<void> {
    await this.db.query("delete from staff where hotel_id = $1 and user_id = $2", [hotelId, userId]);
  }
  async ownerCount(hotelId: string): Promise<number> {
    return ((await this.db.query("select count(*)::int as n from staff where hotel_id = $1 and role = 'owner'", [hotelId])).rows[0]?.n as number) ?? 0;
  }

  /** The main window: for each department, what is waiting and for how long. */
  async departmentBoard(hotelId: string, today: string, now: Date) {
    const { rows } = await this.db.query(
      `select kind, status, priority, created_at, completed_at from requests
        where hotel_id = $1 and (status in ('new','in_progress') or (status = 'done' and completed_at >= $2::date))`, [hotelId, today]);
    return DEPARTMENTS.map((d) => {
      const mine = rows.filter((r) => departmentOf(r.kind as RequestKind) === d);
      const open = mine.filter((r) => r.status === "new" || r.status === "in_progress");
      const oldest = open.reduce<number | null>((o, r) => { const t = new Date(r.created_at as string).getTime(); return o === null || t < o ? t : o; }, null);
      return {
        department: d, label: DEPARTMENT_LABEL[d], open: open.length, urgent: open.filter((r) => r.priority === "urgent").length,
        doneToday: mine.filter((r) => r.status === "done").length, oldestMinutes: oldest === null ? null : Math.max(0, Math.round((now.getTime() - oldest) / 60_000)),
      };
    });
  }

  // ── Guests ───────────────────────────────────────────────
  async guest(id: string): Promise<Guest | null> {
    const { rows } = await this.db.query("select * from guests where id = $1", [id]);
    return rows[0] ? guestOf(rows[0]) : null;
  }
  async guestByPhone(hotelId: string, phone: string): Promise<Guest | null> {
    const { rows } = await this.db.query("select * from guests where hotel_id = $1 and phone = $2", [hotelId, phone]);
    return rows[0] ? guestOf(rows[0]) : null;
  }
  async guestsByIds(ids: string[]): Promise<Guest[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.db.query("select * from guests where id = any($1::uuid[])", [ids]);
    return rows.map(guestOf);
  }
  async createGuest(input: { hotelId: string; phone: string; firstName?: string | null; lastName?: string | null; consent?: Consent; consentSource?: string | null; vip?: boolean; language?: string }): Promise<Guest> {
    const consent = input.consent ?? "unknown";
    const { rows } = await this.db.query(
      `insert into guests (hotel_id, phone, first_name, last_name, consent, consent_at, consent_source, vip, language)
       values ($1,$2,$3,$4,$5, case when $5 = 'unknown' then null else now() end, $6, $7, coalesce($8,'en')) returning *`,
      [input.hotelId, input.phone, input.firstName ?? null, input.lastName ?? null, consent, input.consentSource ?? null, input.vip ?? false, input.language ?? null],
    );
    return guestOf(rows[0]!);
  }
  async updateGuest(id: string, p: { firstName?: string | null; lastName?: string | null; vip?: boolean; notes?: string | null; language?: string }): Promise<Guest | null> {
    const { rows } = await this.db.query(
      `update guests set first_name = case when $2::boolean then $3 else first_name end, last_name = case when $4::boolean then $5 else last_name end,
         vip = coalesce($6, vip), notes = case when $7::boolean then $8 else notes end, language = coalesce($9, language) where id = $1 returning *`,
      [id, p.firstName !== undefined, p.firstName ?? null, p.lastName !== undefined, p.lastName ?? null, p.vip ?? null, p.notes !== undefined, p.notes ?? null, p.language ?? null],
    );
    return rows[0] ? guestOf(rows[0]) : null;
  }
  async setConsent(id: string, consent: Consent, source: string): Promise<void> {
    await this.db.query("update guests set consent = $2, consent_at = now(), consent_source = $3 where id = $1", [id, consent, source]);
  }
  /** Guests for the staff list, with what staff scan for: when, how many stays, what is open. */
  async listGuests(hotelId: string, opts: { q?: string; limit?: number } = {}) {
    const q = opts.q?.trim();
    const { rows } = await this.db.query(
      `select g.*, (select count(*) from stays s where s.guest_id = g.id and s.status <> 'cancelled')::int as stay_count,
              (select s.arrival from stays s where s.guest_id = g.id and s.status <> 'cancelled' order by s.arrival desc limit 1) as last_arrival,
              (select count(*) from requests r where r.guest_id = g.id and r.status in ('new','in_progress'))::int as open_requests,
              (select count(*) from memories m where m.guest_id = g.id and not m.hidden)::int as memory_count
         from guests g where g.hotel_id = $1 and ($2::text is null or lower(coalesce(g.first_name,'') || ' ' || coalesce(g.last_name,'') || ' ' || g.phone) like '%' || lower($2) || '%')
         order by last_arrival desc nulls last, g.created_at desc limit $3`,
      [hotelId, q || null, opts.limit ?? 200],
    );
    return rows.map((r) => ({ ...guestOf(r), stayCount: r.stay_count as number, lastArrival: r.last_arrival ? day(r.last_arrival) : null, openRequests: r.open_requests as number, memoryCount: r.memory_count as number }));
  }

  // ── Stays ────────────────────────────────────────────────
  async createStay(input: { hotelId: string; guestId: string; arrival: string; departure: string; room?: string | null; partySize?: number; notes?: string | null }): Promise<Stay> {
    const { rows } = await this.db.query(
      "insert into stays (hotel_id, guest_id, arrival, departure, room, party_size, notes) values ($1,$2,$3,$4,$5,coalesce($6,1),$7) returning *",
      [input.hotelId, input.guestId, input.arrival, input.departure, input.room ?? null, input.partySize ?? null, input.notes ?? null],
    );
    return stayOf(rows[0]!);
  }
  async staysOf(guestId: string): Promise<Stay[]> {
    const { rows } = await this.db.query("select * from stays where guest_id = $1 order by arrival desc", [guestId]);
    return rows.map(stayOf);
  }
  async updateStay(id: string, p: { room?: string | null; arrival?: string; departure?: string; status?: StayStatus; notes?: string | null }): Promise<Stay | null> {
    const { rows } = await this.db.query(
      `update stays set room = case when $2::boolean then $3 else room end, arrival = coalesce($4, arrival), departure = coalesce($5, departure),
         status = coalesce($6, status), notes = case when $7::boolean then $8 else notes end where id = $1 returning *`,
      [id, p.room !== undefined, p.room ?? null, p.arrival ?? null, p.departure ?? null, p.status ?? null, p.notes !== undefined, p.notes ?? null],
    );
    return rows[0] ? stayOf(rows[0]) : null;
  }
  /** Stays that touch a date range, for campaigns and the arrivals board. */
  async staysBetween(hotelId: string, from: string, to: string): Promise<Stay[]> {
    const { rows } = await this.db.query(
      "select * from stays where hotel_id = $1 and status <> 'cancelled' and arrival <= $3 and departure >= $2 order by arrival", [hotelId, from, to]);
    return rows.map(stayOf);
  }
  /** The stay this guest is in, or about to be in, or has just left. */
  async currentStay(guestId: string, today: string): Promise<Stay | null> {
    const { rows } = await this.db.query(
      `select * from stays where guest_id = $1 and status <> 'cancelled' and arrival <= ($2::date + 3) and departure >= ($2::date - 1)
        order by abs(arrival - $2::date) limit 1`, [guestId, today]);
    return rows[0] ? stayOf(rows[0]) : null;
  }
  /** Keep `status` true to the dates. Cheap; run on every campaign tick. */
  async refreshStayStatuses(hotelId: string, today: string): Promise<void> {
    await this.db.query(
      `update stays set status = case when departure <= $2::date then 'departed' when arrival <= $2::date then 'in_house' else 'booked' end
        where hotel_id = $1 and status <> 'cancelled'`, [hotelId, today]);
  }
  async pastStayCount(guestId: string, today: string): Promise<number> {
    const { rows } = await this.db.query("select count(*)::int as n from stays where guest_id = $1 and status <> 'cancelled' and departure <= $2::date", [guestId, today]);
    return (rows[0]?.n as number) ?? 0;
  }

  // ── Memories ─────────────────────────────────────────────
  async memories(guestId: string, includeHidden = false): Promise<Memory[]> {
    const { rows } = await this.db.query(`select * from memories where guest_id = $1 ${includeHidden ? "" : "and not hidden"} order by kind, key`, [guestId]);
    return rows.map(memoryOf);
  }
  /** Learn: fold a fact into what is known. Returns the stored memory, or null if nothing changed. */
  async learn(hotelId: string, guestId: string, fact: Fact, now: Date, stayId: string | null = null): Promise<Memory | null> {
    const { rows } = await this.db.query("select * from memories where guest_id = $1 and kind = $2 and key = $3", [guestId, fact.kind, fact.key]);
    const next = merge(rows[0] ? memoryOf(rows[0]) : null, fact, now);
    if (!next) return null;
    const { rows: saved } = await this.db.query(
      `insert into memories (hotel_id, guest_id, kind, key, value, confidence, evidence, source, stay_id, hidden, first_seen, last_seen)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11)
       on conflict (guest_id, kind, key) do update set value = $5, confidence = $6, evidence = $7, source = $8, last_seen = $11
       returning *`,
      [hotelId, guestId, next.kind, next.key, next.value, next.confidence, next.evidence, next.source, stayId, next.firstSeen, next.lastSeen],
    );
    return memoryOf(saved[0]!);
  }
  async setMemoryHidden(id: string, hidden: boolean): Promise<void> {
    await this.db.query("update memories set hidden = $2 where id = $1", [id, hidden]);
  }
  async memory(id: string): Promise<(Memory & { hotelId: string }) | null> {
    const { rows } = await this.db.query("select * from memories where id = $1", [id]);
    return rows[0] ? { ...memoryOf(rows[0]), hotelId: rows[0].hotel_id as string } : null;
  }

  // ── Requests ─────────────────────────────────────────────
  async createRequest(input: { hotelId: string; guestId: string; stayId: string | null; kind: RequestKind; summary: string; details?: Record<string, unknown>; priority?: "normal" | "urgent"; createdBy?: "david" | "staff"; at?: Date }): Promise<GuestRequest> {
    const { rows } = await this.db.query(
      "insert into requests (hotel_id, guest_id, stay_id, kind, summary, details, priority, created_by, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,coalesce($7,'normal'),coalesce($8,'david'),coalesce($9, now()),coalesce($9, now())) returning *",
      [input.hotelId, input.guestId, input.stayId, input.kind, input.summary.slice(0, 300), JSON.stringify(input.details ?? {}), input.priority ?? null, input.createdBy ?? null, input.at?.toISOString() ?? null]);
    return requestOf(rows[0]!);
  }
  async request(id: string): Promise<GuestRequest | null> {
    const { rows } = await this.db.query("select * from requests where id = $1", [id]);
    return rows[0] ? requestOf(rows[0]) : null;
  }
  async listRequests(hotelId: string, opts: { status?: RequestStatus[]; kind?: RequestKind; kinds?: RequestKind[]; guestId?: string; limit?: number } = {}) {
    const { rows } = await this.db.query(
      `select r.*, g.first_name, g.last_name, g.phone, s.room from requests r join guests g on g.id = r.guest_id left join stays s on s.id = r.stay_id
        where r.hotel_id = $1 and ($2::text[] is null or r.status = any($2)) and ($3::text is null or r.kind = $3) and ($4::uuid is null or r.guest_id = $4) and ($6::text[] is null or r.kind = any($6))
        order by case r.status when 'new' then 0 when 'in_progress' then 1 else 2 end, (r.priority = 'urgent') desc, r.created_at desc limit $5`,
      [hotelId, opts.status ?? null, opts.kind ?? null, opts.guestId ?? null, opts.limit ?? 200, opts.kinds ?? null]);
    return rows.map((r) => ({ ...requestOf(r), department: departmentOf(r.kind as RequestKind), guestName: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.phone as string, room: (r.room as string | null) ?? null }));
  }
  async updateRequest(id: string, p: { status?: RequestStatus; priority?: "normal" | "urgent"; summary?: string }): Promise<GuestRequest | null> {
    const { rows } = await this.db.query(
      `update requests set status = coalesce($2, status), priority = coalesce($3, priority), summary = coalesce($4, summary), updated_at = now(),
         completed_at = case when coalesce($2, status) in ('done','cancelled') then coalesce(completed_at, now()) else null end where id = $1 returning *`,
      [id, p.status ?? null, p.priority ?? null, p.summary ?? null]);
    return rows[0] ? requestOf(rows[0]) : null;
  }
  async recentRequests(guestId: string, limit = 60): Promise<GuestRequest[]> {
    const { rows } = await this.db.query("select * from requests where guest_id = $1 order by created_at desc limit $2", [guestId, limit]);
    return rows.map(requestOf);
  }
  async openRequestsOf(guestId: string): Promise<GuestRequest[]> {
    const { rows } = await this.db.query("select * from requests where guest_id = $1 and status in ('new','in_progress') order by created_at", [guestId]);
    return rows.map(requestOf);
  }

  // ── Messages ─────────────────────────────────────────────
  async addMessage(input: { hotelId: string; guestId: string; direction: "in" | "out"; author: MessageAuthor; body: string; twilioSid?: string | null; status?: string; campaignId?: string | null; at?: Date }): Promise<Message> {
    const { rows } = await this.db.query(
      "insert into messages (hotel_id, guest_id, direction, author, body, twilio_sid, status, campaign_id, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9, now())) returning *",
      [input.hotelId, input.guestId, input.direction, input.author, input.body.slice(0, 1600), input.twilioSid ?? null, input.status ?? (input.direction === "in" ? "received" : "sent"), input.campaignId ?? null, input.at?.toISOString() ?? null]);
    return messageOf(rows[0]!);
  }
  async messageBySid(sid: string): Promise<Message | null> {
    const { rows } = await this.db.query("select * from messages where twilio_sid = $1", [sid]);
    return rows[0] ? messageOf(rows[0]) : null;
  }
  async thread(guestId: string, limit = 100): Promise<Message[]> {
    const { rows } = await this.db.query("select * from (select * from messages where guest_id = $1 order by created_at desc limit $2) t order by created_at", [guestId, limit]);
    return rows.map(messageOf);
  }
  async lastOutboundAt(guestId: string, author?: MessageAuthor): Promise<Date | null> {
    const { rows } = await this.db.query("select max(created_at) as at from messages where guest_id = $1 and direction = 'out' and ($2::text is null or author = $2)", [guestId, author ?? null]);
    return rows[0]?.at ? new Date(iso(rows[0].at)) : null;
  }
  /** When each guest last got any text from us, for the one-a-day limit. */
  async lastOutboundMap(hotelId: string): Promise<Map<string, Date>> {
    const { rows } = await this.db.query("select guest_id, max(created_at) as at from messages where hotel_id = $1 and direction = 'out' group by guest_id", [hotelId]);
    return new Map(rows.map((r) => [r.guest_id as string, new Date(iso(r.at))]));
  }
  async setMessageStatus(sid: string, status: string): Promise<void> {
    await this.db.query("update messages set status = $2 where twilio_sid = $1", [sid, status]);
  }
  /** One row per guest with the latest message, newest first: the staff inbox. */
  async conversations(hotelId: string, limit = 100) {
    const { rows } = await this.db.query(
      `select distinct on (m.guest_id) m.*, g.first_name, g.last_name, g.phone, g.consent,
              (select count(*) from requests r where r.guest_id = g.id and r.status in ('new','in_progress'))::int as open_requests
         from messages m join guests g on g.id = m.guest_id where m.hotel_id = $1 order by m.guest_id, m.created_at desc`, [hotelId]);
    return rows.map((r) => ({ guestId: r.guest_id as string, guestName: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.phone as string), phone: r.phone as string, consent: r.consent as Consent,
      last: messageOf(r), openRequests: r.open_requests as number })).sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt)).slice(0, limit);
  }

  // ── Campaigns ────────────────────────────────────────────
  async campaigns(hotelId: string): Promise<Campaign[]> {
    const { rows } = await this.db.query("select * from campaigns where hotel_id = $1 order by case kind when 'pre_arrival' then 0 when 'arrival_day' then 1 when 'mid_stay' then 2 when 'post_stay' then 3 when 'win_back' then 4 else 5 end, created_at", [hotelId]);
    return rows.map(campaignOf);
  }
  async campaign(id: string): Promise<Campaign | null> {
    const { rows } = await this.db.query("select * from campaigns where id = $1", [id]);
    return rows[0] ? campaignOf(rows[0]) : null;
  }
  async createCampaign(c: Omit<Campaign, "id">): Promise<Campaign> {
    const { rows } = await this.db.query(
      "insert into campaigns (hotel_id, name, kind, enabled, offset_days, send_hour, message_mode, template, guidance, audience) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *",
      [c.hotelId, c.name, c.kind, c.enabled, c.offsetDays, c.sendHour, c.messageMode, c.template, c.guidance, JSON.stringify(c.audience)]);
    return campaignOf(rows[0]!);
  }
  async updateCampaign(id: string, p: Partial<Omit<Campaign, "id" | "hotelId" | "kind">>): Promise<Campaign | null> {
    const { rows } = await this.db.query(
      `update campaigns set name = coalesce($2, name), enabled = coalesce($3, enabled), offset_days = coalesce($4, offset_days), send_hour = coalesce($5, send_hour),
         message_mode = coalesce($6, message_mode), template = coalesce($7, template), guidance = coalesce($8, guidance), audience = coalesce($9, audience), updated_at = now()
       where id = $1 returning *`,
      [id, p.name ?? null, p.enabled ?? null, p.offsetDays ?? null, p.sendHour ?? null, p.messageMode ?? null, p.template ?? null, p.guidance ?? null, p.audience ? JSON.stringify(p.audience) : null]);
    return rows[0] ? campaignOf(rows[0]) : null;
  }
  async deleteCampaign(id: string): Promise<void> {
    await this.db.query("delete from campaigns where id = $1", [id]);
  }
  /** Keys of sends already made, so nothing is sent twice. */
  async sendKeys(hotelId: string): Promise<Set<string>> {
    const { rows } = await this.db.query("select campaign_id, stay_id, guest_id from campaign_sends where hotel_id = $1", [hotelId]);
    return new Set(rows.map((r) => `${r.campaign_id}:${r.stay_id ?? "guest:" + r.guest_id}`));
  }
  async recordSend(input: { campaignId: string; hotelId: string; guestId: string; stayId: string | null; scheduledFor: Date; status: "sent" | "skipped" | "failed"; reason?: string | null; messageId?: string | null }): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `insert into campaign_sends (campaign_id, hotel_id, guest_id, stay_id, scheduled_for, sent_at, message_id, status, reason)
       values ($1,$2,$3,$4,$5, case when $8::text = 'sent' then now() else null end, $6, $8::text, $7) on conflict do nothing`,
      [input.campaignId, input.hotelId, input.guestId, input.stayId, input.scheduledFor.toISOString(), input.messageId ?? null, input.reason ?? null, input.status]);
    return rowCount > 0;
  }
  async campaignStats(hotelId: string) {
    const { rows } = await this.db.query("select campaign_id, count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'skipped')::int as skipped from campaign_sends where hotel_id = $1 group by campaign_id", [hotelId]);
    return new Map(rows.map((r) => [r.campaign_id as string, { sent: r.sent as number, skipped: r.skipped as number }]));
  }

  // ── Services ─────────────────────────────────────────────
  async services(hotelId: string, onlyActive = false): Promise<Service[]> {
    const { rows } = await this.db.query(`select * from services where hotel_id = $1 ${onlyActive ? "and active" : ""} order by category, sort, name`, [hotelId]);
    return rows.map(serviceOf);
  }
  async createService(s: Omit<Service, "id" | "squareVariationId">): Promise<Service> {
    const { rows } = await this.db.query(
      "insert into services (hotel_id, category, name, description, price_cents, available_from, available_until, active) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [s.hotelId, s.category, s.name, s.description, s.priceCents, s.availableFrom, s.availableUntil, s.active]);
    return serviceOf(rows[0]!);
  }
  async updateService(id: string, p: Partial<Omit<Service, "id" | "hotelId" | "squareVariationId">>): Promise<Service | null> {
    const { rows } = await this.db.query(
      `update services set category = coalesce($2, category), name = coalesce($3, name), description = coalesce($4, description),
         price_cents = case when $5::boolean then $6 else price_cents end, active = coalesce($7, active) where id = $1 returning *`,
      [id, p.category ?? null, p.name ?? null, p.description ?? null, p.priceCents !== undefined, p.priceCents ?? null, p.active ?? null]);
    return rows[0] ? serviceOf(rows[0]) : null;
  }
  async stay(id: string): Promise<Stay | null> {
    const { rows } = await this.db.query("select * from stays where id = $1", [id]);
    return rows[0] ? stayOf(rows[0]) : null;
  }

  // ── Square ───────────────────────────────────────────────
  async squareCredentials(hotelId: string): Promise<SquareCredentials | null> {
    const { rows } = await this.db.query("select square_access_token, square_location_id, square_environment from hotels where id = $1", [hotelId]);
    const r = rows[0];
    return r?.square_access_token && r.square_location_id ? { accessToken: String(r.square_access_token), locationId: String(r.square_location_id), environment: r.square_environment === "sandbox" ? "sandbox" : "production" } : null;
  }
  /** Save credentials. A blank token keeps the one already stored. */
  async setSquare(hotelId: string, p: { accessToken?: string; locationId: string; environment: "production" | "sandbox" }): Promise<void> {
    await this.db.query(
      "update hotels set square_access_token = coalesce($2, square_access_token), square_location_id = $3, square_environment = $4 where id = $1",
      [hotelId, p.accessToken || null, p.locationId, p.environment]);
  }
  async clearSquare(hotelId: string): Promise<void> {
    await this.db.query("update hotels set square_access_token = null, square_location_id = null, square_synced_at = null where id = $1", [hotelId]);
    await this.db.query("update services set square_item_id = null, square_variation_id = null where hotel_id = $1", [hotelId]);
  }
  /** Make room service match Square: add, update and hide. Items added by hand are left alone. */
  async syncSquareMenu(hotelId: string, items: SquareMenuItem[], at: Date): Promise<{ added: number; updated: number; hidden: number }> {
    const all = await this.services(hotelId);
    const existing = new Map(all.filter((s) => s.squareVariationId).map((s) => [s.squareVariationId!, s]));
    // A hand-made item with the same name is the same dish: link it instead of listing it twice.
    const byName = new Map(all.filter((s) => !s.squareVariationId && s.category === "room_service").map((s) => [s.name.trim().toLowerCase(), s]));
    const seen = new Set<string>();
    let added = 0, updated = 0, hidden = 0;
    for (const it of items) {
      if (seen.has(it.variationId)) continue;
      seen.add(it.variationId);
      const adopt = byName.get(it.name.trim().toLowerCase());
      const have = existing.get(it.variationId) ?? adopt;
      if (have) {
        if (adopt && have === adopt) byName.delete(it.name.trim().toLowerCase());
        // Square owns the name, note and price. Whether the item is switched on is the hotel's call.
        await this.db.query("update services set name = $2, description = coalesce(nullif($3, ''), description), price_cents = $4, square_item_id = $5, square_variation_id = $6 where id = $1", [have.id, it.name, it.description, it.priceCents, it.itemId, it.variationId]);
        updated++;
      } else {
        await this.db.query(
          "insert into services (hotel_id, category, name, description, price_cents, active, square_item_id, square_variation_id) values ($1,'room_service',$2,$3,$4,true,$5,$6)",
          [hotelId, it.name, it.description, it.priceCents, it.itemId, it.variationId]);
        added++;
      }
    }
    for (const [vid, s] of existing) {
      if (!seen.has(vid) && s.active) {
        await this.db.query("update services set active = false where id = $1", [s.id]);
        hidden++;
      }
    }
    await this.db.query("update hotels set square_synced_at = $2::timestamptz where id = $1", [hotelId, at.toISOString()]);
    return { added, updated, hidden };
  }
  async setRequestSquare(id: string, p: { orderId: string | null; error: string | null }): Promise<GuestRequest | null> {
    const { rows } = await this.db.query("update requests set square_order_id = coalesce($2, square_order_id), square_error = $3 where id = $1 returning *", [id, p.orderId, p.error]);
    return rows[0] ? requestOf(rows[0]) : null;
  }

  async deleteService(id: string): Promise<void> {
    await this.db.query("delete from services where id = $1", [id]);
  }

  // ── Dashboard ────────────────────────────────────────────
  async dashboard(hotelId: string, today: string) {
    const one = async (sql: string, params: unknown[]) => ((await this.db.query(sql, params)).rows[0]?.n as number) ?? 0;
    return {
      arrivalsToday: await one("select count(*)::int as n from stays where hotel_id = $1 and arrival = $2::date and status <> 'cancelled'", [hotelId, today]),
      inHouse: await one("select count(*)::int as n from stays where hotel_id = $1 and arrival <= $2::date and departure > $2::date and status <> 'cancelled'", [hotelId, today]),
      departuresToday: await one("select count(*)::int as n from stays where hotel_id = $1 and departure = $2::date and status <> 'cancelled'", [hotelId, today]),
      openRequests: await one("select count(*)::int as n from requests where hotel_id = $1 and status in ('new','in_progress')", [hotelId]),
      urgentRequests: await one("select count(*)::int as n from requests where hotel_id = $1 and status in ('new','in_progress') and priority = 'urgent'", [hotelId]),
      requestsToday: await one("select count(*)::int as n from requests where hotel_id = $1 and created_at >= $2::date", [hotelId, today]),
      repeatGuestsInHouse: await one(
        `select count(distinct s.guest_id)::int as n from stays s where s.hotel_id = $1 and s.arrival <= $2::date and s.departure > $2::date and s.status <> 'cancelled'
           and exists (select 1 from stays p where p.guest_id = s.guest_id and p.id <> s.id and p.departure <= s.arrival and p.status <> 'cancelled')`, [hotelId, today]),
      guestsTotal: await one("select count(*)::int as n from guests where hotel_id = $1", [hotelId]),
      memoriesTotal: await one("select count(*)::int as n from memories where hotel_id = $1 and not hidden", [hotelId]),
      optedOut: await one("select count(*)::int as n from guests where hotel_id = $1 and consent = 'opted_out'", [hotelId]),
    };
  }
}

export { kindsOf };
export const categoryFor = (kind: RequestKind): ServiceCategory | null =>
  kind === "room_service" ? "room_service" : kind === "housekeeping" ? "housekeeping" : kind === "laundry" ? "laundry" : kind === "amenities" ? "amenity" : kind === "transport" ? "transport" : null;
export type { CampaignKind };
