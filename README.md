# David

**David is an SMS concierge for hotels.** Guests text the hotel's number. David answers, logs what they
want (room service, housekeeping, laundry, a late check-out), tells the right staff, and **remembers**
every preference and habit so the next stay feels curated. He also texts first, with campaigns you
control: before arrival, on the day, mid-stay, after they leave, and to bring them back.

David is built from [Catch](https://github.com/QSoftwareDevelopment/catch-app), Q Software's missed-call
text-back product, and keeps its shape: a phone number customers text, an inbox, campaigns, and a
mobile app for the business. Everything hotel-specific is new.

## What it does

| | |
|---|---|
| **Answers guests by text** | Understands room service, housekeeping, laundry, amenities, maintenance, transport, late check-out and early check-in. Replies in the hotel's voice, one to three sentences. |
| **Logs requests for staff** | Every ask becomes a request with a status (new, in progress, done). Marking one done can text the guest. Urgent and sensitive things are flagged. |
| **Square for room service** | Connect the hotel's Square: the room service menu and prices come from its catalog, and each confirmed order is sent to Square as an open order with the room, the guest's first name and any allergy on every line. If Square is down, the request and the guest's reply still happen and staff can resend. |
| **Departments and roles** | One app, several views. The owner or concierge sees the main window: every department's open count, longest wait and urgent items, plus arrivals, guests and messages. Room service, restaurant, laundry, housekeeping, maintenance and front desk staff see only their own queue and can mark requests started or done, with no guest profiles or messages. Owners and managers can switch to any department's view. |
| **Tells your team where they already look** | Each request goes to its department's phone (a text) and/or a Slack or Teams webhook. If nobody picks it up in time, David nudges the department once, then tells the manager once. The manager also gets a short morning briefing: who is arriving, what they asked for, who is late. Staff never have to open the app. |
| **Asks how it's going** | Pre-arrival text collects dietary needs and arrival time (a late arrival warns the night desk). A 1 to 10 check-in mid-stay and after: 9 or 10 gets your review link, 7 or 8 gets "what could we do better", 6 or lower goes straight to the duty manager. |
| **Guest catalogue** | Tap any guest for a personal card: an at-a-glance line, then Food & drink, Room & comfort, Housekeeping, Laundry, Occasions and Dislikes, each noting who told us (they did, David noticed, staff) and what they actually order ("Oat flat white ×6"). It also lists what is still worth asking. |
| **SMS and WhatsApp** | One Twilio webhook serves both. David answers on whichever app the guest wrote from, from the hotel's matching number. Guests are one person across both. WhatsApp's own rules are handled: free text only within 24 hours of the guest's last message, an approved template to start a conversation, and an SMS fallback when there isn't one. |
| **Remembers each guest** | Allergies and diets, pillows, room, coffee, occasions, and habits David notices ("oat flat white, mornings, third stay"). Memories last across stays, say where they came from, and can be hidden by staff. |
| **Offers, never assumes** | A remembered habit is offered as a question ("your usual oat flat white?"). Allergies travel with every food order to the kitchen. |
| **Texts first, carefully** | Campaigns by moment in the stay. Only to guests who agreed to texts, never in quiet hours, at most one a day, STOP always honoured. David writes each message from what he remembers, or sends the hotel's exact words. |
| **Brings in a person** | Complaints, emergencies and anything David can't answer become an urgent request for the duty manager. After two misses in a row he hands over. |

## How it fits together

```
 guest's phone ──SMS──> Twilio ──webhook──> server/  ──> Postgres (Supabase)
                                              │  ▲
                              Claude (optional)│  │ REST (Supabase JWT)
                                              ▼  │
                                         app/ (Expo: iOS, Android, web) for hotel staff
```

- **`server/`** is David's brain: the agent, the memory engine, campaigns, Twilio webhooks and the staff API
  (Node, TypeScript, Hono). It talks to Postgres directly.
- **`app/`** is the staff app (Expo / React Native, with a web build): Today, Requests, Guests (with what David
  remembers), Messages, Campaigns, Menu & services, Settings. It signs in with Supabase Auth.
- **`supabase/migrations/`** is the schema. Nothing is read through the Supabase API; every table is locked
  and the server checks who is asking and which hotel they belong to.

Two agents sit behind one interface. **Without an Anthropic key David still works**: a deterministic
agent handles the common asks and is what the tests pin down. With `ANTHROPIC_API_KEY` set, Claude writes
the replies and calls tools to log requests and memories. If Claude fails or is slow, the deterministic
agent answers, so a guest is never left on read.

## Try it in two minutes (no accounts, no keys)

```bash
cd server && npm install && npm run demo        # David on :8787 with a seeded hotel, in-memory Postgres
cd ../app && npm install
EXPO_PUBLIC_DEMO=1 npx expo start --web         # open http://localhost:8081/?demo=1
```

The demo hotel ("The Harbour House") has a menu, five campaigns and five guests at different points in a
stay, including a regular David already knows. Open **More → Guest phone (demo)** to text David as a guest and
watch the staff app react. **Skip ahead one day** moves the clock and runs the day's campaigns.

## The studio (every stakeholder, on one screen)

With the demo running, open `http://localhost:8090/studio?demo=1` in a desktop browser. Sign in (any email and password for now),
then use the sidebar to flip between the owner, concierge, front desk, kitchen, restaurant, housekeeping, laundry and
maintenance. Each is the real app in a phone-sized frame, opened as that person. "Guest catalogue" shows everyone David knows,
"Guest phone" lets you text David as a guest (SMS or WhatsApp), and "Show guest phone" puts it beside any other view.

## Tests

```bash
cd server && npm test        # 159 tests: memory, understanding, campaigns, texting rules, the Claude agent
                             # (scripted), the HTTP API and Twilio signatures, all on in-memory Postgres
cd app && npm test && npm run typecheck
```

## Going live

See [`docs/production.md`](docs/production.md): Supabase project, Twilio number and registration, environment
variables, deploying the server, the cron that sends campaigns, and the app build.

## Rules David holds, whatever the model says

1. No text to anyone who hasn't said yes. Texting David counts as yes to being answered.
2. STOP, UNSUBSCRIBE, CANCEL, END and QUIT opt out immediately and permanently. START opts back in.
3. No first-contact texts in the hotel's quiet hours (default 9pm to 8am, hotel local time).
4. At most one campaign text a day per guest, and a campaign reaches a stay once.
5. Nothing invented: David only offers what is on the hotel's menu and never states prices, hours or
   policies he doesn't have.
6. What a guest said outranks what David inferred. Dietary needs never fade. Staff can hide any memory.

These live in code (`server/src/sms.ts`, `campaigns.ts`, `service.ts`) and are tested; they do not depend on a prompt.
Texting rules differ by country and carrier. Have the hotel's counsel confirm the consent wording used at booking.
