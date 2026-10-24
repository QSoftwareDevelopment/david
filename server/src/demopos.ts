/**
 * A stand-in for a restaurant's reservation or POS system, for the demo.
 *
 * It listens where a real one would: David posts a signed reservation to
 * `pos.demo.invalid`, and this "books" a table on a floor plan and calls
 * back with the table and time, the way a connected system would. It lets the
 * whole loop be seen without any real restaurant software.
 */

export const POS_HOST = "pos.demo.invalid";

export interface PosTable { id: string; label: string; seats: number; x: number; y: number }
export interface PosBooking {
  requestId: string; table: string; time: string; party: number; guestName: string; room: string | null;
  dietary: string[]; onFile: string[]; occasion: string | null; frontDeskNote: string | null; previous: { date: string; summary: string; table: string | null }[];
}

/** Twelve tables on a small floor: window seats along the top, a long table at the back. */
export const POS_TABLES: PosTable[] = [
  { id: "T1", label: "Window 1", seats: 2, x: 0, y: 0 }, { id: "T2", label: "Window 2", seats: 2, x: 1, y: 0 }, { id: "T3", label: "Window 3", seats: 2, x: 2, y: 0 }, { id: "T4", label: "Window 4", seats: 4, x: 3, y: 0 },
  { id: "T5", label: "Booth 1", seats: 4, x: 0, y: 1 }, { id: "T6", label: "Booth 2", seats: 4, x: 1, y: 1 }, { id: "T7", label: "Garden 1", seats: 2, x: 2, y: 1 }, { id: "T8", label: "Garden 2", seats: 4, x: 3, y: 1 },
  { id: "T9", label: "Hearth", seats: 6, x: 0, y: 2 }, { id: "T10", label: "Bar", seats: 2, x: 1, y: 2 }, { id: "T11", label: "Back room", seats: 6, x: 2, y: 2 }, { id: "T12", label: "Long table", seats: 8, x: 3, y: 2 },
];

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

export function partyOf(text: string, fallback: number): number {
  const m = text.toLowerCase().match(/\b(?:for|party of|table of)\s+(\d+|one|two|three|four|five|six|seven|eight)\b/);
  if (!m) return fallback;
  return Math.max(1, Math.min(8, WORDS[m[1]!] ?? Number(m[1])));
}

export function timeOf(text: string): string {
  const m = text.toLowerCase().match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/);
  if (!m) return "7:30 pm";
  const h = Number(m[1] ?? m[4]);
  const min = m[2] ?? m[5] ?? "00";
  const suffix = m[3] ?? "pm";
  return `${h > 12 ? h - 12 : h}:${min} ${suffix}`;
}

export class DemoPos {
  readonly tables = POS_TABLES;
  bookings: PosBooking[] = [];

  constructor(
    private readonly onBooked: (requestId: string, c: { table: string; time: string }) => Promise<void>,
    private readonly delayMs = 700,
    private readonly realFetch: typeof fetch = fetch,
  ) {}

  /** Passed to David as its `fetch`: calls to the stand-in are answered here, everything else goes out for real. */
  readonly fetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== POS_HOST) return this.realFetch(input as never, init);
    const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, any>;
    if (payload.test) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    const booking = this.book(payload);
    if (!booking) return new Response(JSON.stringify({ error: "No table free at that time." }), { status: 409 });
    setTimeout(() => void this.onBooked(booking.requestId, { table: `${booking.table}, ${this.tables.find((t) => t.id === booking.table)!.label}`, time: booking.time }).catch((e) => console.error("[demo pos]", e)), this.delayMs);
    return new Response(JSON.stringify({ ok: true, requestId: booking.requestId }), { status: 200 });
  }) as typeof fetch;

  private book(p: Record<string, any>): PosBooking | null {
    const text = `${p.requestedFor ?? ""} ${p.summary ?? ""}`;
    const party = partyOf(text, p.stay?.partySize ?? 2);
    const time = timeOf(text);
    // Replacing a booking for the same request is how a re-send behaves.
    this.bookings = this.bookings.filter((b) => b.requestId !== p.requestId);
    const taken = new Set(this.bookings.filter((b) => b.time === time).map((b) => b.table));
    const table = [...this.tables].sort((a, b) => a.seats - b.seats).find((t) => t.seats >= party && !taken.has(t.id));
    if (!table) return null;
    const onFile: string[] = (p.onFile ?? []).map((f: { text: string }) => f.text);
    const booking: PosBooking = {
      requestId: String(p.requestId), table: table.id, time, party, guestName: String(p.guest?.name ?? "Guest"), room: p.stay?.room ?? null,
      dietary: p.dietary ?? [], onFile, occasion: onFile.find((t) => /birthday|anniversary|honeymoon|proposal|engagement|wedding|graduation/i.test(t)) ?? null,
      frontDeskNote: p.frontDeskNote ?? null, previous: (p.previousRequests ?? []).map((r: any) => ({ date: r.date, summary: r.summary, table: r.table ?? null })),
    };
    this.bookings.push(booking);
    return booking;
  }
}
