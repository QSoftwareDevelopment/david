import { DEPARTMENT_LABEL, type Department } from "./departments.js";
import { isReliable } from "./memory.js";
import type { Guest, GuestRequest, Memory, RequestKind, Stay } from "./types.js";

/**
 * Everything David knows about a guest, organised the way staff think about
 * them: food and drink, the room, housekeeping, laundry, occasions. Built
 * from what the guest told us, what David noticed, and what they actually
 * order. Pure: the same inputs always give the same card.
 */

export type SectionKey = "food" | "room" | "housekeeping" | "laundry" | "occasions" | "dislikes" | "getting_around" | "other";

export interface CatalogueLine {
  text: string;
  source: "guest" | "observed" | "staff";
  /** False when David only half-knows it: offer it, don't assume it. */
  sure: boolean;
  memoryId: string;
}
export interface CatalogueSection {
  key: SectionKey;
  title: string;
  /** Who in the hotel cares about this section. */
  department: Department | null;
  lines: CatalogueLine[];
  /** What they actually order here, most often first. */
  orders: { item: string; count: number }[];
  /** Plain facts counted from their history ("Asked for transport 2 times"). */
  facts: string[];
}
export interface Catalogue {
  highlights: string[];
  stats: { stays: number; pastStays: number; nights: number; firstArrival: string | null; lastArrival: string | null; requests: number; memories: number };
  sections: CatalogueSection[];
  /** Things worth asking next. */
  gaps: string[];
}

const META: Record<SectionKey, { title: string; department: Department | null }> = {
  food: { title: "Food & drink", department: "room_service" },
  room: { title: "Room & comfort", department: "housekeeping" },
  housekeeping: { title: "Housekeeping", department: "housekeeping" },
  laundry: { title: "Laundry", department: "laundry" },
  occasions: { title: "Occasions", department: "front_desk" },
  dislikes: { title: "Dislikes", department: null },
  getting_around: { title: "Getting around", department: "front_desk" },
  other: { title: "Other things we know", department: null },
};
const ORDER: SectionKey[] = ["food", "room", "housekeeping", "laundry", "occasions", "dislikes", "getting_around", "other"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function sectionOf(m: Pick<Memory, "kind" | "key">): SectionKey {
  if (m.kind === "dietary") return "food";
  if (m.kind === "dislike") return "dislikes";
  if (m.kind === "occasion") return "occasions";
  if (m.key === "coffee" || /^usual (room service|restaurant)/.test(m.key)) return "food";
  if (["pillows", "room", "temperature", "mornings"].includes(m.key)) return "room";
  if (m.key === "housekeeping" || /^(usual )?housekeeping/.test(m.key) || m.key === "usual amenities") return "housekeeping";
  if (/laundry/.test(m.key)) return "laundry";
  return "other";
}

/** One readable line for a memory. */
export function lineText(m: Pick<Memory, "kind" | "key" | "value">): string {
  const v = m.value.trim();
  if (m.kind === "dietary") return m.key === "allergy" ? `Allergic to ${v}` : cap(v);
  if (m.key === "coffee") return `Likes an ${v}`.replace(/^Likes an ([^aeiou])/i, "Likes a $1");
  if (m.kind === "habit") return /^usual /.test(m.key) ? `Usually: ${v}` : cap(v);
  if (m.key === "pillows" || m.key === "room") return `Prefers ${v}`;
  if (m.kind === "dislike") return `Dislikes ${v}`;
  return cap(v);
}

const FOOD_KINDS: RequestKind[] = ["room_service", "restaurant"];
const HOUSE_KINDS: RequestKind[] = ["housekeeping", "amenities"];

function topItems(requests: GuestRequest[], kinds: RequestKind[], limit = 5): { item: string; count: number }[] {
  const counts = new Map<string, { item: string; count: number }>();
  for (const r of requests) {
    if (!kinds.includes(r.kind) || r.status === "cancelled") continue;
    const items = Array.isArray(r.details.items) ? (r.details.items as unknown[]).map(String) : [];
    for (const raw of items) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const cur = counts.get(key) ?? { item: cap(raw.trim()), count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.item.localeCompare(b.item)).slice(0, limit);
}

const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));

export function buildCatalogue(input: { guest: Guest; memories: Memory[]; requests: GuestRequest[]; stays: Stay[]; today: string; now: Date }): Catalogue {
  const { memories, requests, stays, now } = input;
  const live = memories.filter((m) => !m.hidden);
  const sections = new Map<SectionKey, CatalogueSection>();
  const get = (key: SectionKey) => {
    let s = sections.get(key);
    if (!s) sections.set(key, (s = { key, ...META[key], lines: [], orders: [], facts: [] }));
    return s;
  };

  // Allergies first, then what they told us, then what David noticed.
  const rank = (m: Memory) => (m.kind === "dietary" ? 0 : m.source === "guest" ? 1 : m.source === "staff" ? 2 : 3);
  for (const m of [...live].sort((a, b) => rank(a) - rank(b) || b.confidence - a.confidence)) {
    get(sectionOf(m)).lines.push({ text: lineText(m), source: m.source, sure: m.kind === "dietary" || isReliable(m, now), memoryId: m.id });
  }

  const food = topItems(requests, FOOD_KINDS);
  if (food.length) get("food").orders = food;
  const house = topItems(requests, HOUSE_KINDS);
  if (house.length) get("housekeeping").orders = house;
  const laundry = topItems(requests, ["laundry"]);
  if (laundry.length) get("laundry").orders = laundry;

  const count = (kinds: RequestKind[]) => requests.filter((r) => kinds.includes(r.kind) && r.status !== "cancelled").length;
  const laundryCount = count(["laundry"]);
  if (laundryCount) get("laundry").facts.push(`Has asked for laundry ${laundryCount} time${laundryCount === 1 ? "" : "s"}`);
  const rides = count(["transport"]);
  if (rides) get("getting_around").facts.push(`Has asked for transport ${rides} time${rides === 1 ? "" : "s"}`);
  const late = count(["late_checkout"]);
  if (late) get("getting_around").facts.push(`Has asked for a late check-out ${late} time${late === 1 ? "" : "s"}`);
  const early = count(["early_checkin"]);
  if (early) get("getting_around").facts.push(`Has asked for an early check-in ${early} time${early === 1 ? "" : "s"}`);
  const tables = count(["restaurant"]);
  if (tables) get("food").facts.push(`Has booked the restaurant ${tables} time${tables === 1 ? "" : "s"}`);

  const real = stays.filter((s) => s.status !== "cancelled");
  const past = real.filter((s) => s.status === "departed");
  const arrivals = real.map((s) => s.arrival).sort();
  const stats = {
    stays: real.length,
    pastStays: past.length,
    nights: real.filter((s) => s.status !== "booked").reduce((n, s) => n + nightsBetween(s.arrival, s.departure), 0),
    firstArrival: arrivals[0] ?? null,
    lastArrival: arrivals.at(-1) ?? null,
    requests: requests.filter((r) => r.status !== "cancelled").length,
    memories: live.length,
  };

  const ordered = ORDER.map((k) => sections.get(k)).filter((s): s is CatalogueSection => !!s && (s.lines.length > 0 || s.orders.length > 0 || s.facts.length > 0));

  // What would make the next stay better: the obvious blanks.
  const has = (k: SectionKey, test: (m: Memory) => boolean = () => true) => live.some((m) => sectionOf(m) === k && test(m));
  const gaps: string[] = [];
  if (!live.some((m) => m.kind === "dietary")) gaps.push("Dietary needs or allergies");
  if (!has("room")) gaps.push("Pillow, room or temperature preference");
  if (!has("food") && food.length === 0) gaps.push("Favourite food or drink");
  if (!has("occasions")) gaps.push("An occasion to mark (birthday, anniversary)");
  if (!live.some((m) => m.kind === "habit") && real.length > 1) gaps.push("Anything they do every stay");

  // The three things worth glancing at before saying hello.
  const highlights = ORDER.flatMap((k) => (["food", "room", "occasions"].includes(k) ? sections.get(k)?.lines.slice(0, 2) ?? [] : [])).map((l) => l.text).slice(0, 3);

  return { highlights, stats, sections: ordered, gaps: gaps.slice(0, 4) };
}

/** Short interests for the guest list. */
export function interestsOf(memories: Memory[], limit = 3): string[] {
  const live = memories.filter((m) => !m.hidden);
  const rank = (m: Memory) => (m.kind === "dietary" ? 0 : m.kind === "occasion" ? 1 : sectionOf(m) === "room" ? 2 : sectionOf(m) === "food" ? 3 : 4);
  return [...live].filter((m) => sectionOf(m) !== "other").sort((a, b) => rank(a) - rank(b) || b.confidence - a.confidence).slice(0, limit).map((m) => lineText(m));
}

export { DEPARTMENT_LABEL };
