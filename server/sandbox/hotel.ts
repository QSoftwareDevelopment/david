import type { OperaPreference, OperaProfile, OperaReservation, OperaRoom } from "../src/opera.js";
import { addDays } from "../src/time.js";

/**
 * Lotus House Saigon: a fictional 20-room boutique hotel, as its Opera would see it.
 *
 * Every person, number and booking here is made up. Phone numbers use ranges set aside for fiction or
 * testing where a country has one (+1 416 555 01xx), and otherwise clearly fake 555 blocks. Dates are
 * relative to `today`, so the hotel always has someone arriving, someone in house and someone who just left.
 *
 * Each guest is here to exercise something in David; the note on each line says what.
 */

export const HOTEL = {
  code: "LOTUSSGN",
  name: "Lotus House Saigon",
  timezone: "Asia/Ho_Chi_Minh",
  currency: "USD",
  smsNumber: "+842835550100",
  whatsappNumber: "+842835550101",
  reviewUrl: "https://example.com/review/lotus-house",
};

export interface SandboxHotel {
  rooms: OperaRoom[];
  profiles: OperaProfile[];
  reservations: OperaReservation[];
}

const ROOM_TYPES: Record<number, string> = { 1: "SUP", 2: "DLX", 3: "DLX", 4: "STE" };

export function buildHotel(today: string): SandboxHotel {
  const rooms: OperaRoom[] = [];
  for (const floor of [1, 2, 3, 4]) {
    for (let n = 1; n <= 5; n++) rooms.push({ roomId: `${floor}0${n}`, roomType: ROOM_TYPES[floor]!, floor, housekeeping: "Inspected", occupied: false });
  }

  const profiles: OperaProfile[] = [];
  const reservations: OperaReservation[] = [];
  let seq = 0;
  const pref = (type: OperaPreference["type"], value: string): OperaPreference => ({ type, value });

  const guest = (
    p: Omit<OperaProfile, "profileId" | "email" | "vipCode" | "preferences" | "smsOptIn"> & Partial<Pick<OperaProfile, "vipCode" | "preferences" | "smsOptIn" | "email">>,
    stays: { arrive: number; nights: number; room?: string | null; status: OperaReservation["status"]; adults?: number; children?: number; source?: string; eta?: string | null; comments?: string[]; rate?: string }[],
  ) => {
    const profileId = String(880100 + profiles.length);
    profiles.push({ profileId, email: null, vipCode: null, preferences: [], smsOptIn: true, ...p });
    for (const s of stays) {
      seq++;
      const arrivalDate = addDays(today, s.arrive);
      reservations.push({
        reservationId: String(554000 + seq), confirmationNo: `LH${String(70000 + seq)}`, profileId, status: s.status,
        arrivalDate, departureDate: addDays(arrivalDate, s.nights), roomType: s.room ? ROOM_TYPES[Number(s.room[0])]! : "DLX",
        roomId: s.room ?? null, adults: s.adults ?? 2, children: s.children ?? 0, ratePlan: s.rate ?? "BAR",
        source: s.source ?? "Direct", eta: s.eta ?? null, comments: s.comments ?? [],
      });
      if (s.status === "InHouse" && s.room) {
        const room = rooms.find((r) => r.roomId === s.room)!;
        room.occupied = true;
        room.housekeeping = "Dirty";
      }
    }
  };

  // VIP regular arriving today for an anniversary, with an allergy: arrival-day message, allergy on food orders, Vietnamese complaints.
  guest({ givenName: "Linh", surname: "Tran", language: "vi", nationality: "VN", mobile: "+84 90 555 0201", vipCode: "VIP1",
    preferences: [pref("ALLERGY", "peanuts"), pref("ROOM", "a high floor, away from the lift"), pref("OCCASION", "wedding anniversary, 12 Nov")] },
  [{ arrive: -380, nights: 2, room: "402", status: "CheckedOut" }, { arrive: -150, nights: 3, room: "402", status: "CheckedOut" }, { arrive: 0, nights: 3, room: "402", status: "Reserved", eta: "15:00", comments: ["Anniversary: flowers in room on arrival"] }]);

  // Business traveller in house, likes to leave late: late check-out request.
  guest({ givenName: "Minh", surname: "Pham", language: "vi", nationality: "VN", mobile: "+84 91 555 0202", preferences: [pref("PILLOW", "firm pillows")] },
  [{ arrive: -2, nights: 3, room: "205", status: "InHouse", adults: 1, rate: "CORP" }]);

  // Honeymoon couple in house, vegetarian: housekeeping request, a new diet fact to write back to Opera.
  guest({ givenName: "Sophie", surname: "Martin", language: "fr", nationality: "FR", mobile: "+33 6 55 55 02 03" },
  [{ arrive: -1, nights: 4, room: "401", status: "InHouse", source: "Booking.com", comments: ["Honeymoon"] }]);

  // Arriving in three days from Korea, landing late: the pre-arrival message and an arrival time.
  guest({ givenName: "Ji-woo", surname: "Kim", language: "ko", nationality: "KR", mobile: "+82 10 5555 0204" },
  [{ arrive: 3, nights: 4, status: "Reserved", source: "Agoda" }]);

  // In house with a shellfish allergy, air conditioning about to fail: a maintenance work order.
  guest({ givenName: "Daniel", surname: "Wright", language: "en", nationality: "AU", mobile: "+61 4 5555 0205", preferences: [pref("ALLERGY", "shellfish")] },
  [{ arrive: -1, nights: 2, room: "302", status: "InHouse" }]);

  // A family arriving tomorrow with a toddler.
  guest({ givenName: "Mei", surname: "Chen", language: "zh", nationality: "CN", mobile: "+86 139 5555 0206" },
  [{ arrive: 1, nights: 3, status: "Reserved", adults: 2, children: 1, comments: ["Crib requested"] }]);

  // Left yesterday: the thank-you message and a rating.
  guest({ givenName: "Olivia", surname: "Brown", language: "en", nationality: "CA", mobile: "+1 416 555 0107", preferences: [pref("BEVERAGE", "oat flat white")] },
  [{ arrive: -4, nights: 3, room: "203", status: "CheckedOut" }]);

  // Hasn't been back since early in the year: the win-back message.
  guest({ givenName: "Hiroshi", surname: "Sato", language: "ja", nationality: "JP", mobile: "+81 90 5555 0208" },
  [{ arrive: -79, nights: 4, room: "304", status: "CheckedOut" }]);

  // In house but said no to messages in Opera: David must never text him first.
  guest({ givenName: "An", surname: "Nguyen", language: "vi", nationality: "VN", mobile: "+84 93 555 0209", smsOptIn: false },
  [{ arrive: -1, nights: 3, room: "103", status: "InHouse", adults: 1 }]);

  // No mobile number in Opera: the sync has to skip him and say so.
  guest({ givenName: "Lars", surname: "Eriksson", language: "sv", nationality: "SE", mobile: null, email: "lars@example.com" },
  [{ arrive: 2, nights: 2, status: "Reserved" }]);

  // Cancelled: must not count as a stay.
  guest({ givenName: "Giulia", surname: "Rossi", language: "it", nationality: "IT", mobile: "+39 333 555 0211" },
  [{ arrive: 5, nights: 2, status: "Cancelled" }]);

  // In house, birthday tomorrow, orders room service: a charge on the folio.
  guest({ givenName: "Emma", surname: "Wilson", language: "en", nationality: "GB", mobile: "+44 7700 900212", preferences: [pref("OCCASION", "birthday tomorrow")] },
  [{ arrive: -2, nights: 4, room: "304", status: "InHouse" }]);

  // VIP in house, gluten-free, about to be very unhappy: escalation in English.
  guest({ givenName: "Thu Ha", surname: "Le", language: "en", nationality: "VN", mobile: "+84 90 555 0213", vipCode: "VIP2", preferences: [pref("DIET", "gluten-free")] },
  [{ arrive: -1, nights: 2, room: "403", status: "InHouse", adults: 1 }]);

  // Opera hasn't recorded a messaging choice: David may answer, but not text first.
  guest({ givenName: "Carlos", surname: "Mendes", language: "pt", nationality: "BR", mobile: "+55 11 95555 0214", smsOptIn: null },
  [{ arrive: 0, nights: 2, status: "Reserved", source: "Expedia" }]);

  // In house, opted in, never writes: the mid-stay check-in should reach him.
  guest({ givenName: "Rahul", surname: "Mehta", language: "en", nationality: "IN", mobile: "+91 98 5555 0215" },
  [{ arrive: -1, nights: 3, room: "201", status: "InHouse", adults: 1 }]);

  return { rooms, profiles, reservations };
}
