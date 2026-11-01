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
  { id: "r1", dept: "Maintenance", room: "608", ask: "Air conditioning not cooling", guest: "Marcus Bell", ch: "WhatsApp", opened: "10:42", to: "t2", st: "review" },
  { id: "r2", dept: "Front desk", room: "412", ask: "Late check-out to 2 pm", guest: "Priya Nair", ch: "SMS", opened: "10:36", to: "t4", st: "pending" },
  { id: "r3", dept: "Room service", room: "305", ask: "Oat flat white, 7:30 am", guest: "Tom Hadley", ch: "iMessage", opened: "10:39", to: "t7", st: "pending" },
  { id: "r4", dept: "Housekeeping", room: "221", ask: "Two extra pillows, hypoallergenic", guest: "Ana Souza", ch: "WhatsApp", opened: "10:40", to: "t3", st: "pending" },
  { id: "r5", dept: "Laundry", room: "517", ask: "Pickup for four shirts", guest: "Wei Chen", ch: "Messenger", opened: "10:41", to: "t8", st: "progress" },
  { id: "r6", dept: "Restaurant", room: "701", ask: "Table for two, Tuesday 7:30 pm", guest: "James Okafor", ch: "WhatsApp", opened: "10:20", to: "t9", st: "pending" },
  { id: "r7", dept: "Maintenance", room: "226", ask: "Shower drain running slowly", guest: "Hannah Cole", ch: "Messenger", opened: "09:47", to: "t2", st: "progress" },
  { id: "r8", dept: "Front desk", room: "118", ask: "Airport taxi at 6 am", guest: "Sofia Lindqvist", ch: "SMS", opened: "10:12", to: "t5", st: "done" },
  { id: "r9", dept: "Housekeeping", room: "403", ask: "Do not disturb until 11", guest: "Noah Adler", ch: "SMS", opened: "09:58", to: "t3", st: "done" },
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

export const triggers = {
  before_arrival: { label: "Before arrival", unit: "days before arrival" },
  arrival_day: { label: "Arrival day", unit: "" },
  during_stay: { label: "During the stay", unit: "day of the stay" },
  after_checkout: { label: "After check-out", unit: "days after check-out" },
  after_booking: { label: "After booking", unit: "days after booking" },
  occasion: { label: "Guest occasion", unit: "days before the occasion in Opera" },
};
export const audiences = { all: ["All guests", 6], members: ["Gold and Silver members", 3], first: ["First-time guests", 2], returning: ["Returning guests", 4], occasion: ["Guests with an occasion in Opera", 1], allergy: ["Guests with an allergy on file", 2] };
export const channelChoices = { best: "Guest’s preferred channel", whatsapp: "WhatsApp", sms: "SMS", messenger: "Messenger", imessage: "iMessage" };
export const mergeFields = ["first_name", "arrival_date", "checkout_date", "room", "hotel", "allergy"];
export const sampleGuest = { first_name: "Elena", arrival_date: "Saturday", checkout_date: "Tuesday", room: "Suite 701", hotel: "The Harbour House", allergy: "no shellfish" };

// Revenue campaigns. Results are sample numbers for the last 30 days, not real sales.
// Revenue = booked x price. Cost = booked x cost to deliver (messages are treated as free). Both are worked out in the app so editing a price changes the results.
export const campaigns = [
  { id: "k1", name: "Pre-arrival upsell", trigger: "before_arrival", days: 3, time: "10:00", audience: "all", channel: "best", mode: "david", on: true,
    offer: "Ocean-view room upgrade", price: 85, unitCost: 20, stats: { sent: 412, replied: 96, booked: 31 },
    text: "Hi {first_name}, we’re looking forward to {arrival_date}. An ocean-view room is available for your stay for $85 a night more. Would you like me to book it?" },
  { id: "k2", name: "In-stay offer", trigger: "during_stay", days: 2, time: "16:00", audience: "all", channel: "best", mode: "david", on: true,
    offer: "Spa treatment or dinner for two", price: 120, unitCost: 45, stats: { sent: 388, replied: 74, booked: 29 },
    text: "Hi {first_name}, hope the stay is going well. Tonight we can offer a spa treatment or dinner for two at $120. Shall I book one for you?" },
  { id: "k3", name: "Post-stay rebooking", trigger: "after_checkout", days: 14, time: "10:00", audience: "returning", channel: "best", mode: "david", on: true,
    offer: "Direct return stay (first night)", price: 240, unitCost: 30, stats: { sent: 255, replied: 41, booked: 12 },
    text: "Hi {first_name}, it’s been a couple of weeks since {hotel}. If you’re planning another trip, I can hold a room for you at our direct rate." },
];
// What guests like, in plain tags, and the offers David can pick from. David picks the offer that matches the guest, never an advert for everyone.
export const tagWhy = {
  "ocean-view": "booked an ocean-view room before", spa: "enjoys spa treatments", vegetarian: "prefers vegetarian food", coffee: "has an oat flat white most mornings", seafood: "orders seafood",
  dining: "likes dining out", anniversary: "has an anniversary on file in Opera", transfer: "has used airport transfers", business: "travels for work", "late-checkout": "asks for late check-outs", halal: "eats halal", tea: "likes jasmine tea",
};
export const tagLead = {
  "ocean-view": "you enjoyed an ocean-view room last time", spa: "you enjoy spa treatments", vegetarian: "you prefer vegetarian food", coffee: "you like your oat flat white", seafood: "you enjoy seafood", dining: "you enjoy dining out",
  anniversary: "you’re celebrating an anniversary", transfer: "you’ve used airport transfers", business: "you’re travelling for work", "late-checkout": "you like a late check-out", halal: "you eat halal", tea: "you like jasmine tea",
};
export const offers = [
  { id: "o1", name: "Ocean-view room upgrade", price: 85, stages: ["pre"], tags: ["ocean-view"], pitch: "an ocean-view room is available for your stay for $85 a night more. Shall I book it?" },
  { id: "o2", name: "Spa treatment", price: 120, stages: ["stay", "pre"], tags: ["spa"], pitch: "I can book a spa treatment for you at $120. Which evening suits you?" },
  { id: "o3", name: "Vegetarian dinner for two", price: 95, stages: ["stay", "pre"], tags: ["vegetarian"], pitch: "the chef has a vegetarian tasting dinner for two at $95. Shall I reserve a table?" },
  { id: "o4", name: "Seafood dinner for two", price: 110, stages: ["stay", "pre"], tags: ["seafood"], soft: ["dining"], avoids: ["shellfish"], pitch: "tonight’s seafood dinner for two is $110. Shall I reserve a table?" },
  { id: "o5", name: "Halal tasting dinner for two", price: 95, stages: ["stay"], tags: ["halal"], pitch: "the chef has a halal tasting dinner for two at $95. Shall I reserve a table?" },
  { id: "o6", name: "Anniversary dinner with champagne", price: 140, stages: ["pre", "stay"], tags: ["anniversary"], weight: 2, pitch: "we can set up an anniversary dinner with champagne for $140. Shall I reserve it?" },
  { id: "o7", name: "Daily oat flat white and breakfast", price: 18, stages: ["stay"], tags: ["coffee"], pitch: "I can add your oat flat white and breakfast to each morning for $18. Shall I set that up?" },
  { id: "o8", name: "Late check-out to 2 pm", price: 40, stages: ["stay"], tags: ["late-checkout"], pitch: "late check-out to 2 pm is available for $40. Shall I add it?" },
  { id: "o9", name: "Airport transfer", price: 55, stages: ["pre", "post"], tags: ["transfer", "business"], pitch: "I can book an airport transfer for $55. What time do you need it?" },
  { id: "o10", name: "Jasmine tea set in the room", price: 22, stages: ["pre", "stay"], tags: ["tea"], pitch: "I can have a jasmine tea set waiting in your room for $22. Shall I arrange it?" },
  { id: "o11", name: "Direct return stay (first night)", price: 240, stages: ["post"], tags: [], pitch: "if you’re planning another trip, I can hold a room for you at our direct rate." },
  { id: "o0", name: "Ocean-view room upgrade", price: 85, stages: ["pre"], tags: [], generic: true, pitch: "an ocean-view room is available for your stay for $85 a night more. Shall I book it?" },
];
export const stageOf = { arriving: ["pre"], inhouse: ["stay"], departing: ["stay", "post"] };

export const rulesDefault = { quietStart: "21:00", quietEnd: "08:00", perDay: 1 };

export const channels = [
  { id: "wa", name: "WhatsApp Business", handle: "+1 416 555 0142", n: 94, rule: "Free replies for 24 hours after a guest writes. After that, only an approved template." },
  { id: "ms", name: "Messenger", handle: "The Harbour House page", n: 21, rule: "Replies within 24 hours of the guest’s last message." },
  { id: "im", name: "iMessage", handle: "Apple Messages for Business", n: 17, rule: "Goes through an approved messaging provider. Guests start the chat." },
  { id: "sm", name: "SMS", handle: "+1 416 555 0142 (shared)", n: 54, rule: "Consent and STOP are handled for every text." },
];
export const numbers = [["+1 416 555 0142", "Guest concierge", "WhatsApp, SMS"], ["+1 416 555 0177", "Staff alerts", "SMS"]];

export const knowledge = [
  { id: "n1", name: "Room types and rates", detail: "12 room types, rate codes, inclusions", src: "From Opera", st: "ok", when: "Synced 03:00", keywords: "room type, rate, suite, upgrade", answer: "I can check room types and rates in Opera. Tell me your dates and I’ll find the options." },
  { id: "n2", name: "Hotel policies", detail: "Check-in 3 pm, check-out 11 am, accessibility", src: "Written by staff", st: "pend", when: "Edited 2 days ago", keywords: "check-out, checkout, check out, check-in, checkin, check in, late", answer: "Check-in opens at 3 pm and check-out is 11 am. If you’d like longer, I can ask the front desk about a late check-out for you." },
  { id: "n3", name: "Restaurant and bar hours", detail: "4 outlets, last orders, dress code", src: "Written by staff", st: "pend", when: "Edited last week", keywords: "breakfast, restaurant, bar, dinner, lunch, table", answer: "The restaurant serves breakfast 7 to 10:30 and dinner 6 to 10. I can request a table for you." },
  { id: "n4", name: "Room service menu", detail: "38 items with prices and allergens", src: "From Square", st: "ok", when: "Synced 10:05", keywords: "room service, menu, coffee, food, order, hungry", answer: "Room service runs 6 am to 11 pm. I can read you the menu, and I always pass allergies to the kitchen." },
  { id: "n5", name: "Departments and contacts", detail: "7 departments, who to ask, after-hours cover", src: "Written by staff", st: "pend", when: "Edited 5 days ago", keywords: "front desk, housekeeping, maintenance, contact, manager", answer: "I can pass that to the right team and update you. Tell me what you need." },
  { id: "n6", name: "Local recommendations", detail: "24 places the concierge stands behind", src: "Written by staff", st: "pend", when: "Edited last month", keywords: "nearby, recommend, walk, attraction, museum, sightseeing", answer: "The concierge recommends the harbour walk and Fisher’s Market, both ten minutes away. I can book a table nearby too." },
  { id: "n7", name: "Wi-Fi", detail: "Network name and how to connect", src: "Written by staff", st: "pend", when: "Edited last month", keywords: "wifi, wi-fi, internet, password", answer: "Wi-Fi is free: connect to HarbourHouse-Guest. The password is on your key card sleeve." },
  { id: "n8", name: "Parking", detail: "Underground, $38 a night", src: "Written by staff", st: "pend", when: "Edited last month", keywords: "parking, car, valet, garage", answer: "Parking is underground, $38 a night. Tell me your plate and I’ll add it to your stay." },
];

// ---- Guest directory: each guest has their own Opera / David fields ----
const LABEL = { ok: "Synced", pend: "Awaiting approval", review: "Needs review" };
let _f = 0;
const f = (field, opera, david, dir, st, tip = "") => ({ id: "f" + ++_f, field, opera, david, dir, st, label: LABEL[st], tip });
export const guests = [
  { id: "g-elena", name: "Elena Vasquez", room: "Suite 701", status: "arriving", when: "Arriving 13:30", tier: "Gold", stays: 3, ch: ["WhatsApp", "Messenger", "SMS"], phone: "+44 7700 900418", opera: "#00481726", likes: ["ocean-view", "spa", "vegetarian", "dining"], allergies: ["shellfish"], conv: "c5", fields: guestFields.map((x) => ({ ...x })) },
  { id: "g-marcus", name: "Marcus Bell", room: "Room 608", status: "inhouse", when: "In house · to 1 Nov", tier: "Gold", stays: 11, ch: ["WhatsApp"], phone: "+44 7700 900611", opera: "#00392214", likes: ["coffee", "business"], allergies: [], conv: "c1", fields: [
    f("Phone", "+44 7700 900118", "+44 7700 900611 · messages from WhatsApp", "Opera ⇄ David", "review", "The number he writes from differs from Opera. Staff decide which to keep."),
    f("Breakfast", "", "Oat flat white most mornings", "David → Opera", "pend", "Noticed from six room-service orders."),
    f("Pillows", "Firm", "Firm", "Opera ⇄ David", "ok"), f("Room", "Quiet floor", "Quiet floor, away from the lift", "Opera ⇄ David", "ok")] },
  { id: "g-priya", name: "Priya Nair", room: "Room 412", status: "departing", when: "Departing today", tier: "Silver", stays: 3, ch: ["SMS"], phone: "+44 7700 900233", opera: "#00455781", likes: ["late-checkout", "spa"], allergies: [], conv: "c2", fields: [
    f("Late check-out", "", "Asked for 2 pm today", "David → Opera", "pend", "Waiting on the front desk to confirm."),
    f("Contact", "", "Prefers texts to calls", "David → Opera", "pend"), f("Pillows", "Soft", "Soft", "Opera ⇄ David", "ok"), f("Allergy", "None on file", "None mentioned", "Opera ⇄ David", "ok")] },
  { id: "g-tom", name: "Tom Hadley", room: "Room 305", status: "inhouse", when: "In house · to 31 Oct", tier: "Gold", stays: 14, ch: ["iMessage"], phone: "+44 7700 900812", opera: "#00311902", likes: ["coffee", "seafood"], allergies: [], conv: "c3", fields: [
    f("Coffee", "", "Oat flat white, mornings, six times", "David → Opera", "pend", "Offered as a question, never assumed."),
    f("Pillows", "Firm", "Firm", "Opera ⇄ David", "ok"), f("Room", "High floor", "High floor", "Opera ⇄ David", "ok"), f("Allergy", "None on file", "None mentioned", "Opera ⇄ David", "ok")] },
  { id: "g-ana", name: "Ana Souza", room: "Room 221", status: "inhouse", when: "In house · to 2 Nov", tier: "Member", stays: 1, ch: ["WhatsApp"], phone: "+55 11 91234 5678", opera: "#00502933", likes: ["spa"], allergies: ["feather"], conv: "c4", fields: [
    f("Allergy", "", "Feather and down, told David tonight", "David → Opera", "review", "Allergies are never written without a person checking."),
    f("Pillows", "", "Hypoallergenic", "David → Opera", "pend"), f("Language", "Portuguese", "Portuguese", "Opera ⇄ David", "ok")] },
  { id: "g-james", name: "James Okafor", room: "Suite 702", status: "arriving", when: "Arriving 14:00", tier: "Silver", stays: 2, ch: ["WhatsApp"], phone: "+234 802 555 0191", opera: "#00478845", likes: ["anniversary", "dining", "ocean-view"], allergies: [], conv: "c6", fields: [
    f("Dinner", "", "Table for two, Tuesday 7:30 pm", "David → Opera", "pend"), f("Occasion", "Anniversary, 3 Nov", "Anniversary, 3 Nov", "Opera ⇄ David", "ok"), f("Allergy", "None on file", "None mentioned", "Opera ⇄ David", "ok")] },
  { id: "g-lukas", name: "Lukas Brandt", room: "Room 514", status: "arriving", when: "Arriving 22:30", tier: "Member", stays: 1, ch: ["SMS"], phone: "+49 151 5550 144", opera: "#00511208", likes: ["transfer", "business"], allergies: [], conv: null, fields: [
    f("Arrival time", "15:15", "22:30 · night desk alerted", "David → Opera", "pend", "He told David his flight is late."), f("Language", "German", "German, speaks English", "Opera ⇄ David", "ok"), f("Allergy", "None on file", "None mentioned", "Opera ⇄ David", "ok")] },
  { id: "g-mei", name: "Mei Tanaka", room: "Room 612", status: "arriving", when: "Arriving 16:00", tier: "Gold", stays: 4, ch: ["WhatsApp", "iMessage"], phone: "+81 90 5550 7712", opera: "#00288401", likes: ["spa", "tea", "ocean-view"], allergies: [], conv: null, fields: [
    f("Tea", "", "Jasmine tea on arrival", "David → Opera", "pend"), f("Room", "High floor", "High floor, firm pillows", "Opera ⇄ David", "ok"), f("Stays", "4", "4th stay", "Opera → David", "ok")] },
  { id: "g-wei", name: "Wei Chen", room: "Room 517", status: "inhouse", when: "In house · to 3 Nov", tier: "Silver", stays: 2, ch: ["Messenger"], phone: "+86 138 5550 2231", opera: "#00493377", likes: ["halal", "dining"], allergies: [], conv: null, fields: [
    f("Laundry", "", "Shirts, back by Sunday", "David → Opera", "pend"), f("Diet", "Halal", "Halal", "Opera ⇄ David", "ok"), f("Room", "Low floor", "Low floor", "Opera ⇄ David", "ok")] },
  { id: "g-hannah", name: "Hannah Cole", room: "Room 226", status: "inhouse", when: "In house · to 1 Nov", tier: "Member", stays: 1, ch: ["Messenger"], phone: "+44 7700 900764", opera: "#00518890", likes: [], allergies: [], conv: null, fields: [
    f("Accessibility", "Step-free access", "Step-free access", "Opera ⇄ David", "ok"), f("Maintenance", "", "Shower drain slow, work order raised", "David → Opera", "pend"), f("Room", "Away from the lift", "Away from the lift", "Opera ⇄ David", "ok")] },
  { id: "g-noah", name: "Noah Adler", room: "Room 403", status: "departing", when: "Departing 1 Nov", tier: "Silver", stays: 6, ch: ["SMS"], phone: "+1 647 555 0178", opera: "#00352240", likes: ["business", "late-checkout"], allergies: [], conv: null, fields: [
    f("Do not disturb", "", "Until 11 am every day", "David → Opera", "pend"), f("Pillows", "Standard", "Standard", "Opera ⇄ David", "ok"), f("Allergy", "None on file", "None mentioned", "Opera ⇄ David", "ok")] },
];

// ---- Connections (demo only: connecting here changes this page, not a real integration) ----
const S_ = true;
export const connections = [
  { id: "opera", group: "core", name: "Opera Cloud", cat: "Property management", desc: "Guest profiles, reservations, rooms and work orders. Opera stays the record.", status: "connected", last: "Streaming now", fields: [["Hostname", "https://harbour.example-opera.com"], ["Chain code", "HH"], ["Property code", "HARBOUR"], ["App key", "", S_], ["Client ID", ""], ["Client secret", "", S_]] },
  { id: "square", group: "optional", name: "Square", cat: "Point of sale", desc: "Room service menu, prices and open orders, with the guest’s allergy on every line.", status: "connected", last: "Synced 10:05", fields: [["Access token", "", S_], ["Location ID", "L8K2…"]] },
  { id: "toast", group: "optional", name: "Toast", cat: "Point of sale", desc: "Restaurant and bar menus, tables and orders, so David can answer and book from live data.", status: "available", last: "", fields: [["Restaurant GUID", ""], ["Client ID", ""], ["Client secret", "", S_]] },
  { id: "lightspeed", group: "optional", name: "Lightspeed", cat: "Point of sale", desc: "Menus and orders for outlets that run on Lightspeed.", status: "available", last: "", fields: [["Account ID", ""], ["API key", "", S_]] },
  { id: "opentable", group: "optional", name: "OpenTable", cat: "Reservations", desc: "Check availability and book restaurant tables for guests.", status: "available", last: "", fields: [["Restaurant ID", ""], ["API key", "", S_]] },
  { id: "sevenrooms", group: "optional", name: "SevenRooms", cat: "Reservations", desc: "Table bookings, waitlists and guest notes for your venues.", status: "available", last: "", fields: [["Venue ID", ""], ["API key", "", S_]] },
  { id: "whatsapp", group: "core", name: "WhatsApp Business", cat: "Messaging", desc: "Guests message you on WhatsApp. David replies within the 24-hour window.", chan: "wa", fields: [] },
  { id: "messenger", group: "core", name: "Messenger", cat: "Messaging", desc: "Guests message your Facebook page. David replies in the same thread.", chan: "ms", fields: [] },
  { id: "apple", group: "core", name: "Apple Messages for Business", cat: "Messaging", desc: "iMessage chats through an approved messaging provider.", chan: "im", fields: [] },
  { id: "twilio", group: "core", name: "SMS (Twilio)", cat: "Messaging", desc: "Texts to and from your hotel number, with consent and STOP handled.", chan: "sm", fields: [] },
  { id: "slack", group: "core", name: "Slack", cat: "Team alerts", desc: "Sends each request to the right department channel, and nudges the manager if it is missed.", status: "connected", last: "Synced 10:42", fields: [["Webhook URL", "https://hooks.slack.example/…", S_], ["Default channel", "#front-desk"]] },
  { id: "zalo", group: "core", name: "Zalo (ZNS)", cat: "Team alerts", desc: "Messages the assigned employee on their own Zalo number the moment a request is assigned, and lets them reply DONE.", status: "connected", last: "Delivered 10:41", fields: [["Official Account ID", "2847…"], ["App ID", "1234…"], ["App secret", "", S_], ["Access token", "", S_], ["Approved template ID", "ZNS-TASK-001"]] },
  { id: "teams", group: "optional", name: "Microsoft Teams", cat: "Team alerts", desc: "Request alerts and the morning briefing in Teams channels.", status: "available", last: "", fields: [["Webhook URL", "", S_]] },
  { id: "google", group: "optional", name: "Google Business Profile", cat: "Reviews", desc: "Sends happy guests to your review link and flags unhappy ones to the duty manager.", status: "attention", last: "Sign-in expired 2 days ago", fields: [["Account email", "frontdesk@harbourhouse.example"], ["Place ID", ""]] },
  { id: "tripadvisor", group: "optional", name: "TripAdvisor", cat: "Reviews", desc: "Review links and listing details.", status: "available", last: "", fields: [["Location ID", ""]] },
  { id: "claude", group: "core", name: "Anthropic Claude", cat: "AI", desc: "Writes David’s replies, grounded in what he knows about your hotel.", status: "connected", last: "Healthy", fields: [["API key", "", S_], ["Model", "Claude"]] },
];

// ---- Team: every employee has a profile with a Zalo number (fictional numbers) ----
// Target minutes to get a request done, by department. A task past its due time shows as overdue and the duty manager is told.
export const sla = { Maintenance: 30, Housekeeping: 15, "Room service": 25, "Front desk": 30, Laundry: 120, Restaurant: 60 };
// What a guest might write, and the task David creates from it. First match wins.
export const intents = [
  [/towel|pillow|blanket|sheets|toiletr|housekeep|clean my room/i, "Housekeeping", (m) => (/pillow/i.test(m) ? "Extra pillows" : /blanket/i.test(m) ? "Extra blanket" : "Extra towels")],
  [/table|reservation|reserve|book (a )?(dinner|lunch|restaurant)/i, "Restaurant", () => "Table reservation"],
  [/airport|taxi|transfer|pick ?up|cab\b/i, "Front desk", () => "Airport transfer"],
  [/laundry|iron|dry.?clean|shirts?/i, "Laundry", () => "Laundry pickup"],
  [/broken|not working|air.?con|a\/c|leak|drain|light.*(out|flicker)|tv\b|heating|too (hot|cold)/i, "Maintenance", (m) => m.trim().slice(0, 60)],
  [/room service|order|coffee|breakfast|food|hungry|sandwich/i, "Room service", (m) => m.trim().slice(0, 60)],
];

// Marketing consent per guest, as recorded. A guest without it never receives a campaign.
export const consentSeed = {
  "g-elena": [true, "Booking form", "12 Oct"], "g-marcus": [true, "Opera profile", "2 Mar"], "g-priya": [true, "Booking form", "20 Oct"], "g-tom": [true, "Opera profile", "14 Jan"], "g-ana": [true, "Booking form", "18 Oct"],
  "g-james": [true, "Booking form", "9 Oct"], "g-lukas": [false, "Never asked", ""], "g-mei": [true, "Opera profile", "5 Jun"], "g-wei": [true, "Booking form", "25 Oct"], "g-hannah": [false, "Replied STOP", "28 Oct"], "g-noah": [true, "Opera profile", "11 Feb"],
};

export const departments = ["Maintenance", "Housekeeping", "Room service", "Front desk", "Laundry", "Restaurant"];
export const team = [
  { id: "t1", group: "optional", name: "Maya Reyes", role: "Duty manager", dept: "Front desk", zalo: "+84905550101", lang: "English", consent: true, onShift: true },
  { id: "t2", group: "optional", name: "Luis Pereira", role: "Maintenance engineer", dept: "Maintenance", zalo: "+84905550102", lang: "English", consent: true, onShift: true },
  { id: "t3", group: "optional", name: "Dana Kowalski", role: "Housekeeping supervisor", dept: "Housekeeping", zalo: "+84905550103", lang: "English", consent: true, onShift: true },
  { id: "t4", group: "optional", name: "Omar Haddad", role: "Front desk agent", dept: "Front desk", zalo: "+84905550104", lang: "English", consent: true, onShift: true },
  { id: "t5", group: "optional", name: "Sofia Lindqvist", role: "Concierge", dept: "Front desk", zalo: "+84905550105", lang: "English", consent: true, onShift: true },
  { id: "t6", group: "optional", name: "Ben Okafor", role: "Room service lead", dept: "Room service", zalo: "", lang: "English", consent: false, onShift: true },
  { id: "t7", group: "optional", name: "Minh Tran", role: "Kitchen", dept: "Room service", zalo: "+84905550107", lang: "Vietnamese", consent: true, onShift: true },
  { id: "t8", group: "optional", name: "Linh Nguyen", role: "Laundry attendant", dept: "Laundry", zalo: "+84905550108", lang: "Vietnamese", consent: true, onShift: true },
  { id: "t9", group: "optional", name: "An Pham", role: "Restaurant host", dept: "Restaurant", zalo: "+84905550109", lang: "Vietnamese", consent: true, onShift: false },
];
export const autoAssignDefault = { Maintenance: "t2", Housekeeping: "t3", "Room service": "t7", "Front desk": "t4", Laundry: "t8", Restaurant: "t9" };
export const zaloLogSeed = [
  { id: "z3", group: "optional", time: "10:41", to: "Linh Nguyen", phone: "+84905550108", req: "r5", text: "Task for Linh: Laundry, room 517. Pickup for four shirts (guest: Wei Chen). Reply DONE when finished.", status: "delivered", reason: "", kind: "assignment" },
  { id: "z2", group: "optional", time: "10:40", to: "Dana Kowalski", phone: "+84905550103", req: "r4", text: "Task for Dana: Housekeeping, room 221. Two extra pillows, hypoallergenic (guest: Ana Souza). Reply DONE when finished.", status: "delivered", reason: "", kind: "assignment" },
  { id: "z1", group: "optional", time: "10:42", to: "Luis Pereira", phone: "+84905550102", req: "r1", text: "Task for Luis: Maintenance, room 608. Air conditioning not cooling (guest: Marcus Bell). Reply DONE when finished.", status: "delivered", reason: "", kind: "assignment" },
];
export const apiKeysSeed = [{ id: "key1", group: "optional", name: "Front desk automation", secret: "dvd_live_7f3a91c2e84b5d06a1f9", created: "12 Oct", last: "Today 10:40" }];

// What reaches David through Opera, so it needs no separate connection.
export const viaOpera = [
  ["Guest profiles and preferences", "Two-way", "David reads them and proposes new preferences back for approval"],
  ["Reservations and stays", "Read", "Arrivals, departures, room type, rate and stay dates"],
  ["Rooms and housekeeping status", "Read", "Which rooms are ready, occupied or being cleaned"],
  ["Work orders", "Write", "Maintenance and housekeeping requests David logs"],
  ["Room charges", "Write", "Room service and extras post to the guest’s folio through your POS interface"],
  ["Rates and room types", "Read", "What David quotes when a guest asks about a room"],
];
