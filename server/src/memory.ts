import type { GuestRequest, Memory, MemoryKind, MemorySource } from "./types.js";

/**
 * What David remembers about a guest, and how it learns.
 *
 * ── The idea ──────────────────────────────────────────────────────────────
 *
 * A concierge who remembers is worth returning to. David keeps a small list of
 * facts per guest, each with a kind, a key, a value and how sure it is. Facts
 * come from three places:
 *
 *   · the guest said so ("I'm allergic to nuts", "we're here for our
 *     anniversary") — trusted straight away;
 *   · David noticed ("third stay, ordered an oat flat white at 7am each time")
 *     — trusted more every time it is seen again;
 *   · a staff member wrote it down.
 *
 * ── Rules this file holds ─────────────────────────────────────────────────
 *
 *   1. Repetition raises confidence; a single sighting never makes a habit.
 *   2. What a guest said outranks what David inferred. An inference never
 *      overwrites a guest's own words, a guest's words overwrite an inference.
 *   3. Dietary needs and allergies never fade. Everything else slowly does, so
 *      a taste from three years ago is offered gently, not assumed.
 *   4. Nothing is deleted by learning. Staff can hide a fact; it stays hidden.
 *
 * Pure functions only: the store reads and writes, this decides.
 */

export interface Fact {
  kind: MemoryKind;
  key: string;
  value: string;
  source: MemorySource;
  /** Starting confidence for a first sighting. */
  confidence?: number;
}

const CLAMP = (n: number) => Math.max(0, Math.min(1, n));

/** Starting confidence by where the fact came from. */
export function baseConfidence(source: MemorySource, kind: MemoryKind): number {
  if (kind === "dietary") return source === "guest" ? 0.95 : 0.6;
  if (source === "staff") return 0.9;
  if (source === "guest") return 0.8;
  return 0.35;
}

/**
 * Fold a new sighting of a fact into what is already known.
 * Returns the fact to store, or null when there is nothing to change.
 */
export function merge(existing: Memory | null, incoming: Fact, now: Date): Omit<Memory, "id" | "guestId"> | null {
  const iso = now.toISOString();
  const start = incoming.confidence ?? baseConfidence(incoming.source, incoming.kind);

  if (!existing) {
    return {
      kind: incoming.kind,
      key: incoming.key,
      value: incoming.value,
      confidence: CLAMP(start),
      evidence: 1,
      source: incoming.source,
      hidden: false,
      firstSeen: iso,
      lastSeen: iso,
    };
  }
  // Staff hid it. Learning does not bring it back.
  if (existing.hidden) return null;

  const sameValue = existing.value.trim().toLowerCase() === incoming.value.trim().toLowerCase();
  const rank = { observed: 0, guest: 1, staff: 2 } as const;

  if (sameValue) {
    // Seen again: each repeat closes part of the gap to certain.
    const confidence = CLAMP(existing.confidence + (1 - existing.confidence) * 0.35);
    return {
      kind: existing.kind,
      key: existing.key,
      value: existing.value,
      confidence,
      evidence: existing.evidence + 1,
      source: rank[incoming.source] > rank[existing.source] ? incoming.source : existing.source,
      hidden: false,
      firstSeen: existing.firstSeen,
      lastSeen: iso,
    };
  }

  // A different value. Something weaker than what we hold does not replace it.
  if (rank[incoming.source] < rank[existing.source]) {
    return {
      ...existing,
      confidence: CLAMP(existing.confidence - 0.1),
      lastSeen: existing.lastSeen,
      hidden: false,
    };
  }
  return {
    kind: incoming.kind,
    key: incoming.key,
    value: incoming.value,
    confidence: CLAMP(start),
    evidence: 1,
    source: incoming.source,
    hidden: false,
    firstSeen: existing.firstSeen,
    lastSeen: iso,
  };
}

/** How sure we still are, once time has passed. */
export function currentConfidence(m: Pick<Memory, "kind" | "confidence" | "lastSeen">, now: Date): number {
  if (m.kind === "dietary" || m.kind === "contact") return m.confidence;
  const months = Math.max(0, (now.getTime() - new Date(m.lastSeen).getTime()) / (30 * 86_400_000));
  // Loses a little each month, never below a third of what it was.
  return m.confidence * Math.max(0.33, 1 - months * 0.04);
}

/** Whether to act on a fact, or only to offer it. */
export function isReliable(m: Pick<Memory, "kind" | "confidence" | "lastSeen">, now: Date): boolean {
  return currentConfidence(m, now) >= 0.6;
}

const KIND_ORDER: Record<MemoryKind, number> = { dietary: 0, dislike: 1, occasion: 2, preference: 3, habit: 4, contact: 5 };

/**
 * The facts worth putting in front of the agent or a staff member, most
 * important first. Dietary needs always come first and always make the list.
 */
export function recall(memories: Memory[], now: Date, limit = 12): Memory[] {
  return memories
    .filter((m) => !m.hidden)
    .map((m) => ({ m, c: currentConfidence(m, now) }))
    .filter(({ m, c }) => m.kind === "dietary" || c >= 0.25)
    .sort((a, b) => KIND_ORDER[a.m.kind] - KIND_ORDER[b.m.kind] || b.c - a.c)
    .slice(0, limit)
    .map(({ m }) => m);
}

/** One line per fact, for the agent's prompt. */
export function describe(m: Memory, now: Date): string {
  const sure = isReliable(m, now) ? "" : " (not certain: offer it, don't assume it)";
  const times = m.evidence > 1 ? `, seen ${m.evidence} times` : "";
  return `${labelFor(m.kind)}: ${m.key}: ${m.value}${times}${sure}`;
}

function labelFor(kind: MemoryKind): string {
  return { dietary: "DIETARY", dislike: "DISLIKES", occasion: "OCCASION", preference: "PREFERS", habit: "HABIT", contact: "CONTACT" }[kind];
}

// ── Learning from what guests ask for ──────────────────────────────────────

const hourOf = (iso: string, timeZone: string): number =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

const part = (hour: number): "morning" | "midday" | "evening" | "late night" =>
  hour < 11 ? "morning" : hour < 16 ? "midday" : hour < 22 ? "evening" : "late night";

/**
 * Habits visible in a guest's request history: the same thing, asked for
 * again, at a similar time of day. Needs at least two sightings. Returns
 * facts to be merged; the store decides whether they change anything.
 */
export function habitsFrom(requests: GuestRequest[], timeZone: string): Fact[] {
  const out: Fact[] = [];
  const done = requests.filter((r) => r.status !== "cancelled");

  // The same item, again and again.
  const items = new Map<string, { kind: string; label: string; count: number; hours: number[] }>();
  for (const r of done) {
    const list = Array.isArray(r.details.items) ? (r.details.items as unknown[]).map(String) : [];
    for (const raw of list) {
      const name = raw.toLowerCase().trim();
      if (!name) continue;
      const cur = items.get(`${r.kind}:${name}`) ?? { kind: r.kind, label: raw.trim(), count: 0, hours: [] };
      cur.count += 1;
      cur.hours.push(hourOf(r.createdAt, timeZone));
      items.set(`${r.kind}:${name}`, cur);
    }
  }
  for (const item of items.values()) {
    if (item.count < 2) continue;
    const main = mostCommon(item.hours.map(part));
    out.push({
      kind: "habit",
      key: `usual ${item.kind.replace("_", " ")}`.slice(0, 60),
      value: `${item.label}, usually in the ${main}`,
      source: "observed",
      confidence: Math.min(0.85, 0.3 + item.count * 0.15),
    });
  }

  // How often they want laundry or housekeeping, and when.
  for (const kind of ["laundry", "housekeeping"] as const) {
    const mine = done.filter((r) => r.kind === kind);
    if (mine.length < 2) continue;
    const when = mostCommon(mine.map((r) => part(hourOf(r.createdAt, timeZone))));
    out.push({
      kind: "habit",
      key: `${kind} timing`,
      value: `asks for ${kind} in the ${when}`,
      source: "observed",
      confidence: Math.min(0.8, 0.3 + mine.length * 0.12),
    });
  }
  return out;
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}
