import { recall } from "./memory.js";
import type { Store } from "./store.js";
import { roomTouches } from "./touches.js";

/** Who is arriving today, what they asked for ahead of time, and what would make the stay theirs. */
export async function arrivalsOn(store: Store, now: Date, hotelId: string, today: string) {
  const stays = await store.staysBetween(hotelId, today, today);
  const guests = new Map((await store.guestsByIds(stays.map((s) => s.guestId))).map((g) => [g.id, g]));
  const out = [];
  for (const s of stays.filter((x) => x.arrival === today)) {
    const g = guests.get(s.guestId);
    if (!g) continue;
    const [pastStays, all, asked] = await Promise.all([store.pastStayCount(g.id, today), store.memories(g.id), store.openRequestsOf(g.id)]);
    const memories = recall(all, now, 12);
    out.push({ stay: s, guest: g, pastStays, memories: memories.slice(0, 3), asked, touches: roomTouches({ memories, pastStays, stay: s, firstName: g.firstName, vip: g.vip }) });
  }
  return out;
}

/** A guest who says they land after 10pm or before 5am is a late arrival the night desk should expect. */
export const isLateEta = (eta: string | null | undefined): boolean => {
  if (!eta) return false;
  const h = Number(eta.slice(0, 2));
  return h >= 22 || h < 5;
};

export const etaWords = (eta: string): string => {
  const [h, m] = eta.split(":").map(Number) as [number, number];
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
