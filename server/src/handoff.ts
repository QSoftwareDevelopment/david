import type { Catalogue, SectionKey } from "./catalogue.js";
import { DEPARTMENT_LABEL, departmentOf, type Department } from "./departments.js";
import type { Guest, GuestRequest, Hotel, Stay } from "./types.js";

/**
 * The briefing that travels with a request when the front desk sends it on.
 *
 * A department doesn't need everything about a guest, it needs what it acts
 * on: the restaurant wants allergies, occasions and past bookings; housekeeping
 * wants pillows and quiet floors. The same briefing is rendered as text (for a
 * phone or Slack) and as structured data (for a reservation or POS system).
 */

export const SCHEMA = "david.handoff.v1";

/** Which parts of the guest's catalogue each department cares about. */
const RELEVANT: Record<Department, SectionKey[]> = {
  restaurant: ["food", "occasions", "dislikes"],
  room_service: ["food", "dislikes"],
  housekeeping: ["room", "housekeeping", "dislikes"],
  laundry: ["laundry"],
  maintenance: ["room"],
  front_desk: ["occasions", "getting_around", "other"],
};

const CATEGORY_PREFIX = /^(Room service|Housekeeping|Laundry|Amenities|Maintenance|Transport|Restaurant|Late check-out|Early check-in):\s*/;
const plain = (summary: string) => summary.replace(CATEGORY_PREFIX, "").replace(/\s*\[[^\]]*\]\s*$/, "");
const day = (iso: string) => iso.slice(0, 10);

export interface Handoff {
  department: Department;
  headline: string;
  /** Human-readable lines, in the order a person would want them. */
  lines: string[];
  text: string;
  payload: Record<string, unknown>;
}

export function buildHandoff(input: {
  hotel: Hotel;
  request: GuestRequest;
  guest: Guest;
  stay: Stay | null;
  catalogue: Catalogue;
  /** This guest's earlier requests to the same department, newest first. */
  history: GuestRequest[];
  note: string | null;
  now: Date;
}): Handoff {
  const { hotel, request, guest, stay, catalogue, note } = input;
  const department = departmentOf(request.kind);
  const name = [guest.firstName, guest.lastName].filter(Boolean).join(" ") || guest.phone;
  const original = typeof request.details.original === "string" ? request.details.original : null;
  const when = typeof request.details.when === "string" ? request.details.when : null;
  const items = Array.isArray(request.details.items) ? (request.details.items as unknown[]).map(String) : [];

  const sections = catalogue.sections.filter((s) => RELEVANT[department].includes(s.key as SectionKey));
  // Allergies matter to whoever serves food, and are noise to everyone else.
  const serves = department === "restaurant" || department === "room_service";
  const dietary = !serves ? [] : catalogue.sections.find((s) => s.key === "food")?.lines.filter((l) => /^Allergic to|^Vegetarian|^Vegan|-free|^Halal|^Kosher|^Pescatarian/i.test(l.text)).map((l) => l.text) ?? [];
  const onFile = sections.flatMap((s) => s.lines.filter((l) => !dietary.includes(l.text)).map((l) => ({ section: s.title, text: l.text, source: l.source, sure: l.sure })));
  const usual = sections.flatMap((s) => s.orders).slice(0, 5);
  const previous = input.history.filter((r) => r.id !== request.id && r.status !== "cancelled").slice(0, 5);

  const lines: string[] = [];
  lines.push(`${DEPARTMENT_LABEL[department]} · ${name}${stay?.room ? ` · Room ${stay.room}` : ""}`);
  lines.push(`Asked for: ${plain(request.summary)}${when && !plain(request.summary).includes(when) ? ` (${when})` : ""}`);
  if (original && original.toLowerCase() !== plain(request.summary).toLowerCase()) lines.push(`In their words: "${original.length > 200 ? original.slice(0, 197) + "…" : original}"`);
  if (note) lines.push(`From the front desk: ${note}`);
  const who = [
    guest.vip ? "VIP" : null,
    catalogue.stats.pastStays > 0 ? `stay ${catalogue.stats.pastStays + 1}, welcome back` : "first stay",
    stay ? `${stay.partySize} in the party` : null,
    stay ? `${stay.arrival} to ${stay.departure}` : null,
  ].filter(Boolean);
  lines.push(`Guest: ${who.join(", ")}`);
  if (dietary.length) lines.push(`Dietary: ${dietary.join("; ")}`);
  for (const f of onFile.slice(0, 6)) lines.push(`On file: ${f.text}${f.sure ? "" : " (not certain yet)"}`);
  if (usual.length) lines.push(`Usually orders: ${usual.map((o) => (o.count > 1 ? `${o.item} ×${o.count}` : o.item)).join(", ")}`);
  if (previous.length) lines.push(`Before: ${previous.slice(0, 3).map((r) => `${day(r.createdAt)} ${plain(r.summary)}${r.confirmation?.table ? ` (${r.confirmation.table})` : ""}`).join("; ")}${previous.length > 3 ? ` and ${previous.length - 3} more` : ""}`);

  const payload = {
    schema: SCHEMA,
    sentAt: input.now.toISOString(),
    hotel: { name: hotel.name, timezone: hotel.timezone },
    department,
    requestId: request.id,
    kind: request.kind,
    summary: plain(request.summary),
    items,
    requestedFor: when,
    originalMessage: original,
    frontDeskNote: note,
    guest: { name, firstName: guest.firstName, lastName: guest.lastName, phone: guest.phone, language: guest.language, vip: guest.vip, pastStays: catalogue.stats.pastStays },
    stay: stay ? { room: stay.room, arrival: stay.arrival, departure: stay.departure, partySize: stay.partySize, eta: stay.eta ?? null } : null,
    dietary,
    onFile,
    usualOrders: usual,
    previousRequests: previous.map((r) => ({ date: day(r.createdAt), summary: plain(r.summary), status: r.status, table: r.confirmation?.table ?? null, time: r.confirmation?.time ?? null })),
  };

  return { department, headline: lines[0]!, lines, text: lines.join("\n"), payload };
}
