// Sample data for The Harbour House, a fictional hotel. Everything here is made up.

export const hotel = { name: "The Harbour House", date: "Friday 30 October" };

export const ranges = {
  today: { label: "Today", bars: [["8am", 14, 4], ["10am", 31, 8], ["12pm", 28, 6], ["2pm", 22, 7], ["4pm", 25, 5], ["6pm", 38, 9], ["8pm", 28, 4]], occ: [["8am", 74], ["10am", 76], ["12pm", 78], ["2pm", 78], ["4pm", 81], ["6pm", 84], ["8pm", 84]], note: "Messages today, by two-hour block" },
  week: { label: "7 days", bars: [["Mon", 142, 38], ["Tue", 168, 41], ["Wed", 155, 52], ["Thu", 190, 44], ["Fri", 231, 63], ["Sat", 204, 47], ["Sun", 176, 35]], occ: [["Mon", 71], ["Tue", 74], ["Wed", 78], ["Thu", 81], ["Fri", 92], ["Sat", 96], ["Sun", 84]], note: "Handled by David and by staff, Mon to Sun" },
  month: { label: "30 days", bars: [["Wk 1", 910, 240], ["Wk 2", 1040, 262], ["Wk 3", 985, 301], ["Wk 4", 1130, 288]], occ: [["Wk 1", 72], ["Wk 2", 77], ["Wk 3", 79], ["Wk 4", 84]], note: "Handled by David and by staff, by week" },
};

export const mix = [["WhatsApp", 94], ["SMS", 54], ["Messenger", 21], ["iMessage", 17]];
export const progress = [["Room service", 97], ["Front desk", 99], ["Housekeeping", 94], ["Maintenance", 81], ["Laundry", 90]];
export const sales = [["Oat flat white", 41, 246, 13], ["Club sandwich", 12, 468, 9], ["Fish and chips", 9, 801, 23], ["Caesar salad", 7, 189, -4], ["Sparkling water", 2, 138, -75]];
export const staff = [["Maya Reyes", "Duty manager"], ["Luis Pereira", "Maintenance"], ["Dana Kowalski", "Housekeeping"], ["Omar Haddad", "Front desk"], ["Sofia Lindqvist", "Concierge"], ["Ben Okafor", "Room service"]];
export const people = ["All people", "Luis P.", "Dana K.", "Kitchen", "Front desk", "Concierge", "Laundry desk", "Restaurant"];

export const requests = [
  { id: "r1", dept: "Maintenance", room: "608", ask: "Air conditioning not cooling", guest: "Marcus Bell", ch: "WhatsApp", opened: "10:42", who: "Luis P.", st: "review" },
  { id: "r2", dept: "Front desk", room: "412", ask: "Late check-out to 2 pm", guest: "Priya Nair", ch: "SMS", opened: "10:36", who: "Front desk", st: "pending" },
  { id: "r3", dept: "Room service", room: "305", ask: "Oat flat white, 7:30 am", guest: "Tom Hadley", ch: "iMessage", opened: "10:39", who: "Kitchen", st: "pending" },
  { id: "r4", dept: "Housekeeping", room: "221", ask: "Two extra pillows, hypoallergenic", guest: "Ana Souza", ch: "WhatsApp", opened: "10:40", who: "Dana K.", st: "pending" },
  { id: "r5", dept: "Laundry", room: "517", ask: "Pickup for four shirts", guest: "Wei Chen", ch: "Messenger", opened: "10:41", who: "Laundry desk", st: "progress" },
  { id: "r6", dept: "Restaurant", room: "701", ask: "Table for two, Tuesday 7:30 pm", guest: "James Okafor", ch: "WhatsApp", opened: "10:20", who: "Restaurant", st: "pending" },
  { id: "r7", dept: "Maintenance", room: "226", ask: "Shower drain running slowly", guest: "Hannah Cole", ch: "Messenger", opened: "09:47", who: "Luis P.", st: "progress" },
  { id: "r8", dept: "Front desk", room: "118", ask: "Airport taxi at 6 am", guest: "Sofia Lindqvist", ch: "SMS", opened: "10:12", who: "Concierge", st: "done" },
  { id: "r9", dept: "Housekeeping", room: "403", ask: "Do not disturb until 11", guest: "Noah Adler", ch: "SMS", opened: "09:58", who: "Dana K.", st: "done" },
];

export const arrivals = [
  ["13:30", "Elena Vasquez", "Suite 701 · shellfish allergy on her Opera profile"],
  ["14:00", "James and Ruth Okafor", "Two nights · anniversary noted in Opera"],
  ["15:15", "Lukas Brandt", "Arrives 22:30 · night desk alerted by David"],
  ["16:00", "Mei Tanaka", "Fourth stay · prefers a high floor, firm pillows"],
];

export const convos = [
  { id: "c1", name: "Marcus Bell", room: "Room 608", tier: "Gold", ch: "WhatsApp", time: "11m", prev: "Okay, someone is on the way up?", unread: true,
    msgs: [["guest", "Hi, the air conditioning in 608 isn’t cooling at all. It’s quite warm in here.", "10:42"], ["david", "I’m sorry about that, Marcus. I’ve asked Maintenance to come to 608 now. Would a fan in the meantime help, or would you rather move rooms?", "10:42"], ["sys", "Request logged for Maintenance · written to Opera as a work order"], ["guest", "A fan would be great. Okay, someone is on the way up?", "10:44"], ["david", "Yes. Luis from Maintenance is on his way with a fan, about five minutes. I’ve also let the duty manager know, in case you’d like a different room.", "10:44"]],
    profile: [["Stay", "28 Oct to 1 Nov · King, harbour view"], ["Rate", "Corporate · breakfast included"], ["Loyalty", "Gold · 11th stay"], ["Allergies", "None on file"], ["Pillows", "Firm (from Opera)"], ["Learned by David", "Oat flat white most mornings"]] },
  { id: "c2", name: "Priya Nair", room: "Room 412", tier: "Silver", ch: "SMS", time: "6m", prev: "Could I keep the room until 2 pm?",
    msgs: [["guest", "Could I keep the room until 2 pm? My flight is late.", "10:36"], ["david", "Of course I can ask. Late check-out to 2 pm depends on the day, so I’ve passed it to the front desk and I’ll text you as soon as they confirm.", "10:36"], ["sys", "Request logged for Front desk"]],
    profile: [["Stay", "29 Oct to 30 Oct · Queen"], ["Rate", "Best flexible"], ["Loyalty", "Silver · 3rd stay"], ["Allergies", "None on file"], ["Pillows", "Soft"], ["Learned by David", "Prefers texts to calls"]] },
  { id: "c3", name: "Tom Hadley", room: "Room 305", tier: "Gold", ch: "iMessage", time: "3m", prev: "The usual, thanks David",
    msgs: [["david", "Good morning Tom. Your usual oat flat white at 7:30?", "10:38"], ["guest", "The usual, thanks David", "10:39"], ["sys", "Request logged for Room service · sent to Square"]],
    profile: [["Stay", "27 Oct to 31 Oct · Deluxe King"], ["Rate", "Corporate"], ["Loyalty", "Gold · 14th stay"], ["Allergies", "None on file"], ["Pillows", "Firm"], ["Learned by David", "Oat flat white, mornings, six times"]] },
  { id: "c4", name: "Ana Souza", room: "Room 221", tier: "Member", ch: "WhatsApp", time: "2m", prev: "Two extra pillows please",
    msgs: [["guest", "Two extra pillows please, the hypoallergenic ones if you have them", "10:40"], ["david", "Yes, we do. Housekeeping will bring two hypoallergenic pillows to 221 within 15 minutes.", "10:40"], ["sys", "Request logged for Housekeeping"]],
    profile: [["Stay", "29 Oct to 2 Nov · Queen"], ["Rate", "Leisure"], ["Loyalty", "Member · 1st stay"], ["Allergies", "Feather and down"], ["Pillows", "Hypoallergenic"], ["Learned by David", "Asked for pillows tonight"]] },
  { id: "c5", name: "Elena Vasquez", room: "Suite 701", tier: "Gold", ch: "Messenger", time: "26m", prev: "I’ll be there around 1:30",
    msgs: [["david", "Hi Elena, we’re looking forward to Saturday. Anything we should know before you arrive?", "09:58"], ["guest", "Still no shellfish please, and I’ll be there around 1:30", "10:14"], ["david", "Noted: no shellfish, arriving 1:30. I’ve passed it to the kitchen and the front desk.", "10:14"]],
    profile: [["Stay", "30 Oct to 2 Nov · Suite"], ["Rate", "Anniversary package"], ["Loyalty", "Gold · 3rd stay"], ["Allergies", "Shellfish (Opera)"], ["Pillows", "Two, firm (told David)"], ["Learned by David", "Vegetarian dinners, noticed"]] },
  { id: "c6", name: "James Okafor", room: "Suite 702", tier: "Silver", ch: "WhatsApp", time: "1h", prev: "Can we get a table for Tuesday?",
    msgs: [["guest", "Can we get a table for Tuesday? It’s our anniversary.", "09:20"], ["david", "Happy anniversary! I’ve asked the restaurant for Tuesday evening. What time suits you best?", "09:20"], ["guest", "7:30 would be perfect", "09:22"], ["sys", "Request sent to the restaurant system"]],
    profile: [["Stay", "30 Oct to 1 Nov · Suite"], ["Rate", "Anniversary package"], ["Loyalty", "Silver · 2nd stay"], ["Allergies", "None on file"], ["Pillows", "Standard"], ["Learned by David", "Celebrating an anniversary"]] },
];

export const guestFields = [
  { id: "g1", field: "Allergy", tip: "Read from the guest’s Opera profile. David never changes allergies.", opera: "Shellfish", david: "Shellfish · she confirmed on Messenger, 28 Oct", dir: "Opera ⇄ David", st: "ok", label: "Synced" },
  { id: "g2", field: "Pillows", tip: "She told David on WhatsApp in March. It waits for staff approval before going to Opera.", opera: "", david: "Two firm pillows, told David in March", dir: "David → Opera", st: "pend", label: "Awaiting approval" },
  { id: "g3", field: "Room", tip: "", opera: "High floor", david: "High floor, away from the lift", dir: "Opera ⇄ David", st: "ok", label: "Synced" },
  { id: "g4", field: "Dinner", tip: "Inferred from three room-service orders. It stays flagged until staff decide.", opera: "", david: "Vegetarian, noticed from three orders", dir: "David → Opera", st: "review", label: "Needs review" },
  { id: "g5", field: "Occasion", tip: "", opera: "Anniversary, 3 Nov", david: "Anniversary, 3 Nov", dir: "Opera → David", st: "ok", label: "Synced" },
  { id: "g6", field: "Mobile", tip: "", opera: "+44 7700 900418", david: "+44 7700 900418 · WhatsApp, SMS", dir: "Opera → David", st: "ok", label: "Synced" },
];

export const events = [
  ["10:42:07", "←", "UPDATE RESERVATION", "Okafor · 2 nights · arrival moved to 14:00", "ok", "Applied"],
  ["10:41:52", "←", "UPDATE PROFILE", "Vasquez · shellfish allergy added at front desk", "ok", "Applied"],
  ["10:40:15", "→", "WORK ORDER", "608 · air conditioning · WO-44821", "ok", "Created"],
  ["10:38:03", "←", "CHECK-IN", "Room 412 · Nair · key issued", "ok", "Applied"],
  ["10:35:48", "←", "UPDATE PROFILE", "Bell · mobile differs from WhatsApp number", "review", "Needs review"],
  ["10:31:20", "→", "PREFERENCE NOTE", "Hadley · oat flat white · proposed by David", "pend", "Awaiting approval"],
];
export const eventPool = [
  ["←", "UPDATE RESERVATION", "Kowalczyk · room moved 330 to 332"], ["←", "CHECK-OUT", "Room 118 · Lindqvist · folio closed"], ["→", "WORK ORDER", "226 · shower drain · WO-44830"],
  ["←", "UPDATE PROFILE", "Tanaka · pillow preference confirmed"], ["←", "CHECK-IN", "Room 701 · Vasquez · key issued"], ["→", "HOUSEKEEPING NOTE", "221 · hypoallergenic pillows delivered"],
];

export const campaigns = [
  { id: "k1", kicker: "Before arrival", name: "Pre-arrival questions", when: "3 days before arrival", what: "Asks about dietary needs and arrival time, so the team is ready.", on: true },
  { id: "k2", kicker: "Arrival day", name: "Welcome and directions", when: "Morning of arrival", what: "A welcome, directions, and who to ask for.", on: true },
  { id: "k3", kicker: "Mid-stay", name: "How is it going, 1 to 10", when: "Day two of the stay", what: "Asks how it’s going. Low scores go straight to the duty manager.", on: true },
  { id: "k4", kicker: "After they leave", name: "Thanks and a review link", when: "Day after check-out", what: "Thanks them. Happy guests get a review link.", on: true },
  { id: "k5", kicker: "Win-back", name: "Come back and stay", when: "Six weeks later", what: "Invites past guests back.", on: false },
];
export const rules = ["Only guests who have said yes to texts", "Never in quiet hours: 9 pm to 8 am, hotel time", "At most one campaign text a day per guest", "STOP is honoured immediately and permanently", "Nothing invented: only what is on your menu and policies"];

export const channels = [
  { id: "wa", name: "WhatsApp Business", handle: "+1 416 555 0142", n: 94, rule: "Free replies for 24 hours after a guest writes. After that, only an approved template." },
  { id: "ms", name: "Messenger", handle: "The Harbour House page", n: 21, rule: "Replies within 24 hours of the guest’s last message." },
  { id: "im", name: "iMessage", handle: "Apple Messages for Business", n: 17, rule: "Goes through an approved messaging provider. Guests start the chat." },
  { id: "sm", name: "SMS", handle: "+1 416 555 0142 (shared)", n: 54, rule: "Consent and STOP are handled for every text." },
];
export const numbers = [["+1 416 555 0142", "Guest concierge", "WhatsApp, SMS"], ["+1 416 555 0177", "Staff alerts", "SMS"]];

export const knowledge = [
  { name: "Room types and rates", detail: "12 room types, rate codes, inclusions", src: "From Opera", st: "ok", when: "Synced 03:00" },
  { name: "Hotel policies", detail: "Check-in 3 pm, check-out 11 am, parking, accessibility", src: "Written by staff", st: "pend", when: "Edited 2 days ago" },
  { name: "Restaurant and bar hours", detail: "4 outlets, last orders, dress code", src: "Written by staff", st: "pend", when: "Edited last week" },
  { name: "Room service menu", detail: "38 items with prices and allergens", src: "From Square", st: "ok", when: "Synced 10:05" },
  { name: "Departments and contacts", detail: "7 departments, who to ask, after-hours cover", src: "Written by staff", st: "pend", when: "Edited 5 days ago" },
  { name: "Local recommendations", detail: "24 places the concierge stands behind", src: "Written by staff", st: "pend", when: "Edited last month" },
];
// Keyword answers David can give from what he knows.
export const answers = [
  [/check.?out/i, "Check-out is 11 am. If you’d like longer, I can ask the front desk about a late check-out for you.", "Hotel policies"],
  [/check.?in|arriv/i, "Check-in opens at 3 pm. If you’re earlier, I can ask the front desk to hold your bags.", "Hotel policies"],
  [/breakfast|restaurant|bar|dinner|lunch/i, "The restaurant serves breakfast 7 to 10:30 and dinner 6 to 10. I can request a table for you.", "Restaurant and bar hours"],
  [/room service|menu|coffee|food/i, "Room service runs 6 am to 11 pm. I can read you the menu, and I always pass allergies to the kitchen.", "Room service menu"],
  [/wifi|wi-fi|internet/i, "Wi-Fi is free: connect to HarbourHouse-Guest. The password is on your key card sleeve.", "Hotel policies"],
  [/parking|car/i, "Parking is underground, $38 a night. Tell me your plate and I’ll add it to your stay.", "Hotel policies"],
];
