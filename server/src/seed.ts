import { defaultCampaigns } from "./campaigns.js";
import type { Store } from "./store.js";
import { addDays, localParts, zonedInstant } from "./time.js";
import type { Department } from "./departments.js";
import type { Hotel } from "./types.js";

/**
 * A believable hotel to demo David with: a menu, the default campaigns, and
 * guests at every point in a stay, some of them regulars David already
 * knows. Dates are relative to `now`, so the demo is always current.
 */
export async function seedDemo(store: Store, now: Date = new Date()): Promise<Hotel> {
  const existing = await store.hotelBySlug("harbour-house");
  if (existing) return existing;

  const hotel = await store.createHotel({
    name: "The Harbour House", slug: "harbour-house", timezone: "America/Toronto", smsNumber: "+14165550100",
    tone: "warm, polished and brief, like a great concierge", signature: "- David",
  });
  // Twilio's WhatsApp sandbox number, so the demo can show a guest on WhatsApp.
  await store.updateHotel(hotel.id, { whatsappNumber: "+14155238886" });
  const today = localParts(now, hotel.timezone).date;

  const svc = (category: any, name: string, description = "", priceCents: number | null = null, from: string | null = null, until: string | null = null) =>
    store.createService({ hotelId: hotel.id, category, name, description, priceCents, availableFrom: from, availableUntil: until, active: true });
  await Promise.all([
    svc("room_service", "Oat flat white", "Our barista blend", 550, "06:00", "22:00"),
    svc("room_service", "Eggs Benedict", "", 2200, "06:30", "11:00"),
    svc("room_service", "Club sandwich", "", 2400, "11:00", "23:00"),
    svc("room_service", "Harbour burger", "", 2600, "11:00", "23:00"),
    svc("room_service", "Caesar salad", "", 1900, "11:00", "23:00"),
    svc("room_service", "Bottle of champagne", "", 12000, "12:00", "23:00"),
    svc("housekeeping", "Extra towels"), svc("housekeeping", "Extra pillows"), svc("housekeeping", "Turn-down service"), svc("housekeeping", "Room refresh"),
    svc("laundry", "Same-day laundry", "Picked up by 10am, back by 6pm", 2800), svc("laundry", "Dry cleaning", "Back next day", 1800), svc("laundry", "Shirt pressing", "", 800),
    svc("amenity", "Crib"), svc("amenity", "Phone charger"), svc("amenity", "Feather-free bedding"),
    svc("transport", "Airport car service", "Ask at the desk for rates"),
  ]);
  for (const c of defaultCampaigns(hotel.id)) await store.createCampaign(c);

  const at = (date: string, hour: number, minute = 0) => new Date(zonedInstant(date, hour, hotel.timezone).getTime() + minute * 60_000);
  const guest = (phone: string, firstName: string, lastName: string, extra: { vip?: boolean } = {}) =>
    store.createGuest({ hotelId: hotel.id, phone, firstName, lastName, consent: "opted_in", consentSource: "booking_form", vip: extra.vip });
  const request = async (g: string, stayId: string | null, kind: any, summary: string, items: string[], when: Date, status: "done" | "new" | "in_progress" = "done", details: Record<string, unknown> = {}, held = false) => {
    const r = await store.createRequest({ hotelId: hotel.id, guestId: g, stayId, kind, summary, details: { items, ...details } });
    await store.db.query("update requests set created_at = $2::timestamptz, updated_at = $2::timestamptz, status = $3::text, completed_at = case when $3::text = 'done' then $2::timestamptz else null end, dispatched_at = case when $4::boolean then null else $2::timestamptz end where id = $1", [r.id, when.toISOString(), status, held]);
    return r;
  };
  const learn = (g: string, kind: any, key: string, value: string, source: any = "guest", times = 1) => (async () => {
    for (let i = 0; i < times; i++) await store.learn(hotel.id, g, { kind, key, value, source }, at(addDays(today, -40 - i * 30), 9));
  })();

  // Sam: a regular. Two past stays, firm habits, arriving in three days.
  const sam = await guest("+14165550111", "Sam", "Rivera", { vip: true });
  const s1 = await store.createStay({ hotelId: hotel.id, guestId: sam.id, arrival: addDays(today, -200), departure: addDays(today, -197), room: "804" });
  const s2 = await store.createStay({ hotelId: hotel.id, guestId: sam.id, arrival: addDays(today, -90), departure: addDays(today, -87), room: "804" });
  await store.createStay({ hotelId: hotel.id, guestId: sam.id, arrival: addDays(today, 3), departure: addDays(today, 6), partySize: 2 });
  for (const [stay, base] of [[s1, -199], [s2, -89]] as const) {
    for (const d of [0, 1, 2]) await request(sam.id, stay.id, "room_service", "Room service: oat flat white", ["oat flat white"], at(addDays(today, base + d), 7, 10));
  }
  await request(sam.id, s2.id, "laundry", "Laundry: shirts", ["shirts"], at(addDays(today, -88), 9));
  await learn(sam.id, "preference", "pillows", "firm pillows", "guest", 2);
  await learn(sam.id, "preference", "room", "a quiet high floor", "guest");
  for (const f of (await import("./memory.js")).habitsFrom(await store.recentRequests(sam.id), hotel.timezone)) await store.learn(hotel.id, sam.id, f, at(addDays(today, -87), 9));

  // Priya: in the house now, with an allergy and something open.
  const priya = await guest("+14165550122", "Priya", "Nair");
  const ps = await store.createStay({ hotelId: hotel.id, guestId: priya.id, arrival: addDays(today, -1), departure: addDays(today, 2), room: "612", partySize: 1 });
  await learn(priya.id, "dietary", "allergy", "shellfish", "guest");
  await request(priya.id, ps.id, "housekeeping", "Housekeeping: extra towels", ["extra towels"], new Date(now.getTime() - 25 * 60_000), "new");

  // Amara: back for a second stay, arriving today. She already asked for two things by text.
  const amara = await guest("+14165550166", "Amara", "Okoye");
  const a1 = await store.createStay({ hotelId: hotel.id, guestId: amara.id, arrival: addDays(today, -120), departure: addDays(today, -117), room: "715" });
  const a2 = await store.createStay({ hotelId: hotel.id, guestId: amara.id, arrival: today, departure: addDays(today, 3), partySize: 2, notes: "Celebrating her partner's birthday" });
  await store.setStayEta(a2.id, "23:15");
  for (const d of [0, 1]) await request(amara.id, a1.id, "room_service", "Room service: oat flat white", ["oat flat white"], at(addDays(today, -120 + d), 8, 5));
  await learn(amara.id, "preference", "pillows", "feather-free pillows", "guest");
  await learn(amara.id, "occasion", "birthday", "here for a birthday", "guest");
  await learn(amara.id, "preference", "temperature", "likes the room cool", "observed");
  for (const f of (await import("./memory.js")).habitsFrom(await store.recentRequests(amara.id), hotel.timezone)) await store.learn(hotel.id, amara.id, f, at(addDays(today, -117), 9));
  await request(amara.id, a2.id, "amenities", "Amenities: extra feather-free pillows", ["feather-free pillows"], new Date(now.getTime() - 20 * 3600_000), "new");
  await request(amara.id, a2.id, "room_service", "Room service: bottle of champagne, on ice at arrival", ["bottle of champagne"], new Date(now.getTime() - 19 * 3600_000), "new");

  // Marcus: first stay, tomorrow.
  const marcus = await guest("+14165550133", "Marcus", "Lee");
  await store.createStay({ hotelId: hotel.id, guestId: marcus.id, arrival: addDays(today, 1), departure: addDays(today, 3), partySize: 2 });

  // Elena: left yesterday, anniversary on file.
  const elena = await guest("+14165550144", "Elena", "Park");
  const es = await store.createStay({ hotelId: hotel.id, guestId: elena.id, arrival: addDays(today, -4), departure: addDays(today, -1), room: "1102", partySize: 2 });
  await learn(elena.id, "occasion", "anniversary", "here for an anniversary", "guest");
  await learn(elena.id, "preference", "coffee", "oat flat white", "guest");
  await request(elena.id, es.id, "room_service", "Room service: bottle of champagne", ["bottle of champagne"], at(addDays(today, -3), 19));

  // Jordan: a past guest who has not been back in a while.
  const jordan = await guest("+14165550155", "Jordan", "Blake");
  const js = await store.createStay({ hotelId: hotel.id, guestId: jordan.id, arrival: addDays(today, -78), departure: addDays(today, -75), room: "505" });
  await store.createStay({ hotelId: hotel.id, guestId: jordan.id, arrival: addDays(today, -300), departure: addDays(today, -297), room: "505" });
  await learn(jordan.id, "preference", "temperature", "likes the room cool", "guest");
  await request(jordan.id, js.id, "late_checkout", "Late check-out", [], at(addDays(today, -76), 12));

  // A few more open items so every department has something in its queue.
  await request(priya.id, ps.id, "laundry", "Laundry: two shirts, pressed", ["shirts"], new Date(now.getTime() - 70 * 60_000), "in_progress");
  await request(amara.id, a2.id, "restaurant", "Restaurant: table for two tonight at 7:30, a birthday", [], new Date(now.getTime() - 55 * 60_000), "new", { when: "tonight at 7:30", original: "Could we book a table for two tonight at 7:30? It's my partner's birthday." }, true);
  // She has eaten here before: the restaurant should know.
  const dined = await request(amara.id, a1.id, "restaurant", "Restaurant: table for two at 8pm", [], at(addDays(today, -119), 17), "done", { when: "8pm" });
  await store.setConfirmation(dined.id, { status: "confirmed", table: "T3, Window 3", time: "8:00 pm", at: at(addDays(today, -119), 17).toISOString(), source: "demo POS" });
  await request(sam.id, null, "maintenance", "Maintenance: the desk lamp in 804 flickers", [], new Date(now.getTime() - 3 * 3600_000), "new");

  // The team, so the Team screen has people on it.
  const team: [string, string, "owner" | "manager" | "staff", Department | null][] = [
    ["00000000-0000-4000-8000-000000000001", "owner@harbourhouse.ca", "owner", null],
    ["00000000-0000-4000-8000-000000000002", "concierge@harbourhouse.ca", "manager", null],
    ["00000000-0000-4000-8000-000000000003", "kitchen@harbourhouse.ca", "staff", "room_service"],
    ["00000000-0000-4000-8000-000000000004", "host@harbourhouse.ca", "staff", "restaurant"],
    ["00000000-0000-4000-8000-000000000005", "laundry@harbourhouse.ca", "staff", "laundry"],
    ["00000000-0000-4000-8000-000000000006", "housekeeping@harbourhouse.ca", "staff", "housekeeping"],
  ];
  for (const [id, email, role, department] of team) await store.addStaff(id, hotel.id, email, role, department);

  // Restaurant requests wait at the front desk, which sends them on to the restaurant's booking system.
  await store.setContact(hotel.id, { department: "restaurant", smsNumber: null, webhookUrl: null, dispatch: "review", integrationUrl: "https://pos.demo.invalid/reservations", integrationSecret: "whsec_demo" });

  await store.refreshStayStatuses(hotel.id, today);
  return hotel;
}
