import type { Memory, Stay } from "./types.js";

/**
 * Small things to do before a guest walks in, taken from what David remembers.
 *
 * Pure: memories in, a short list for the front desk out. Each one says where it
 * came from, so staff can tell what a guest asked for from what David guessed.
 * Offers go out as cards or questions, never as surprises on the bill.
 */

export interface Touch {
  text: string;
  /** Where it comes from, in the words staff see. */
  because: string;
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const because = (m: Memory) => (m.source === "observed" ? "David noticed" : m.source === "staff" ? "Staff note" : "They told us");

export function roomTouches(input: { memories: Memory[]; pastStays: number; stay: Pick<Stay, "notes">; firstName: string | null; vip: boolean }, limit = 6): Touch[] {
  const out: Touch[] = [];
  const { memories, pastStays } = input;

  if (pastStays > 0) {
    const who = input.firstName ? `Welcome back, ${input.firstName}` : "Welcome back";
    out.push({ text: `Handwritten welcome-back note: "${who}. Your ${ordinal(pastStays + 1)} stay with us."`, because: `${pastStays} past ${pastStays === 1 ? "stay" : "stays"}` });
  }
  if (input.vip) out.push({ text: "VIP: have the duty manager greet them at the desk.", because: "Marked VIP" });

  for (const m of memories) {
    if (m.hidden) continue;
    const b = because(m);
    const v = m.value.trim();
    if (m.kind === "dietary") {
      out.push({ text: m.key === "allergy" ? `Allergy: ${v}. Keep it out of any welcome treat.` : `${sentence(v)}: check any welcome treat.`, because: b });
    } else if (m.kind === "occasion") {
      out.push({ text: `Handwritten note for their ${m.key}.`, because: b });
    } else if (m.kind === "dislike") {
      out.push({ text: `Avoid: ${v}.`, because: b });
    } else if (m.key === "pillows") {
      out.push({ text: `${sentence(v)} on the bed.`, because: b });
    } else if (m.key === "temperature") {
      out.push({ text: "Cool the room before they arrive.", because: b });
    } else if (m.key === "room") {
      out.push({ text: `Room: ${v}.`, because: b });
    } else if (m.key === "mornings") {
      out.push({ text: "No early knocks: hold housekeeping until they ring.", because: b });
    } else if (m.key === "housekeeping") {
      out.push({ text: `Housekeeping: ${v}.`, because: b });
    } else if (m.key === "coffee") {
      out.push({ text: `Leave a card offering their ${v}.`, because: b });
    } else if (m.kind === "habit" && m.key === "usual room service") {
      out.push({ text: `Leave a card offering their usual: ${v.replace(/,?\s*usually in the .*$/i, "")}.`, because: b });
    }
  }

  // The same thing never twice (a coffee preference and a coffee habit).
  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.text.toLowerCase()) ? false : (seen.add(t.text.toLowerCase()), true))).slice(0, limit);
}
