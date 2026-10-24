# Going live

## 1. Database (Supabase)

1. Create a Supabase project.
2. SQL editor: paste and run [`supabase/migrations/0001_david.sql`](../supabase/migrations/0001_david.sql). It is safe to run twice.
3. Collect: the project URL, the **JWT secret** (Settings → API) or leave it and rely on the project's published keys,
   and the **database connection string** (Settings → Database → Connection string, URI). Use the pooled one on serverless.

## 2. Twilio

1. Buy a number per hotel (or use a toll-free number).
2. **Register it for messaging.** In the US this means A2P 10DLC brand and campaign registration (or toll-free
   verification); Canada and other countries have their own rules. Unregistered traffic gets filtered. Allow days to weeks.
3. Set the number's **Messaging → "A message comes in"** webhook to `https://YOUR-SERVER/webhooks/twilio/sms` (HTTP POST),
   and the status callback to `https://YOUR-SERVER/webhooks/twilio/status`.
4. In the staff app (More → Hotel settings) enter the same number as the hotel's texting number. David matches inbound texts to the hotel by it.

## 3. Server

Environment (see `server/.env.example`):

| Variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SUPABASE_JWT_SECRET` or `SUPABASE_URL` | how to verify staff sign-ins |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | sending, and checking that webhooks really come from Twilio |
| `PUBLIC_URL` | the server's public https address (used in the signature check) |
| `ANTHROPIC_API_KEY` | optional; without it the deterministic agent answers |
| `DAVID_MODEL` | optional; default `claude-sonnet-5-5` |
| `CRON_SECRET` | protects `/cron/tick` |
| `CORS_ORIGINS` | comma-separated origins of the web build, if you host one |
| `DAVID_MIGRATE=1` | optional; apply migrations at startup |

Run `npm start` in `server/` (or use the `Dockerfile`). It needs to stay running: replies go out through Twilio's API after
the webhook is acknowledged, so a server that sleeps between requests (some serverless setups) can drop them.

**Campaigns need a scheduler.** Something must call the server every ~10 minutes:

```bash
curl -X POST https://YOUR-SERVER/cron/tick -H "Authorization: Bearer $CRON_SECRET"
```

It is idempotent: calling it more often than needed never double-sends. Use any scheduler (cron-job.org, a GitHub Actions schedule, Supabase `pg_cron` with `pg_net`).

## 4. Staff app

Set in `app/.env`:

```
EXPO_PUBLIC_API_URL=https://YOUR-SERVER
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Build with EAS (`eas build`) for iOS/Android, or `npx expo export --platform web` for a web build. A new account signs up, then
creates its hotel; David seeds the five default campaigns. Adding staff to an existing hotel is a row in the `staff` table for now.

## 5. Square (optional)

Run `supabase/migrations/0002_square.sql` after `0001`. In the Square Developer Dashboard create an application, copy its
access token (it needs permission to read items and write orders) and note the location ID. In the staff app go to
More → Square, paste both, and choose Live or Sandbox. David checks the credentials, imports the catalog into
Room service, and from then on sends each room service order to that location as an open order.

- Square owns each imported item's name, note and price; the hotel keeps control of whether it is on or off.
- A hand-made item with the same name as a Square item is linked to it, not duplicated.
- Orders carry a ticket name like "Rm 412 · Priya" and any allergy as a note on every line. Retrying never duplicates an order.
- **Not verified against a real Square account yet.** Test with Sandbox first. Orders are created as open orders; they do not
  take payment, and whether they appear on a kitchen display depends on how the location is set up in Square.

## 6. Team and departments

Run `supabase/migrations/0003_departments.sql` (after 0001 and 0002). It adds the restaurant request kind, manager and
department roles for staff, and invitations.

- **Owner**: whoever creates the hotel. **Manager** (the concierge or GM): sees everything and runs the team.
  **Department staff** (room service, restaurant, housekeeping, laundry, maintenance, front desk): see only that
  department's requests and can start or finish them. The server enforces this on every call, not just the app.
- Add people in More → Team by email and department. They get that access the first time they sign in with that
  address (Supabase email confirmation should be on, so nobody can claim an address they don't own).
- Owners and managers can look at the hotel as any department from the View as chips on Today and More. It only narrows what
  they see.
- Requests are routed by kind: room service, restaurant, housekeeping (also amenities), laundry, maintenance, and front desk
  (transport, late check-out, early check-in, anything else David escalates).
- Not built yet: push notifications to a department when a request arrives, and per-department opening hours.

## 7. Alerts, briefing and ratings

Run `supabase/migrations/0004_alerts_and_feedback.sql`. Then in the app: More, Alerts.

- For each department (and "Manager") enter the phone that should get a text and/or a webhook URL. Slack: create an
  Incoming Webhook and paste its URL. Teams and anything else that accepts a JSON `{"text": ...}` post also work.
  Webhooks must be public https addresses; the server refuses internal ones. Use "Send a test" to check.
- The manager number also receives escalations and the morning briefing. Set the hour in Hotel settings (default 7am, hotel time).
- Reminders: a request nobody has started is nudged once to its department after half the time promised to the guest
  (10 minutes at least), and once to the manager when the promise is up. These ride on the same `/cron/tick`, so keep it
  running every 10 minutes or so. Staff who handle things by phone should still tap Start or Done in the app, otherwise the
  request will keep looking untouched. That is the one habit this asks of them.
- Texts to department phones go out from the hotel's Twilio number as ordinary messages. They are not guest campaigns,
  so quiet hours don't apply; use a number that expects them.
- Ratings: the mid-stay and thank-you campaigns ask for a 1 to 10. Existing hotels keep the wording they already have;
  edit those two campaigns (or reset to the new defaults) so they ask. Add your review link under Hotel settings.

## 8. WhatsApp

WhatsApp runs through the same Twilio account and the same webhook as SMS. Three things differ, and they come from WhatsApp, not David:

1. **A WhatsApp sender.** In Twilio, register a WhatsApp sender for the hotel (this goes through Meta's business verification, and takes
   days to weeks). To try it today, use Twilio's WhatsApp sandbox: join it from a phone, and point its "when a message comes in"
   webhook at `https://YOUR-SERVER/webhooks/twilio/sms`, the same URL as SMS. Then enter the sender number under Hotel settings, WhatsApp.
2. **Starting a conversation needs a template.** WhatsApp lets a business send free text only within 24 hours of the guest's last message.
   Before that, it must be an approved template. Create one per moment in Twilio's Content Template Builder (two variables: `{{1}}` is the
   guest's first name, `{{2}}` the hotel name), get it approved, and paste its ID (starts with HX) next to that campaign in Hotel
   settings. David uses the template when the window is closed; with no template he sends an SMS instead.
3. **Consent and cost.** Guests must have agreed to hear from the hotel on WhatsApp (the same booking consent as SMS is the usual route;
   have counsel confirm the wording). Meta charges per delivered message for business-started templates, by category and country,
   and replies inside the 24-hour window are free. Check Meta's current rate card.

A guest is one person across both apps: David replies on whichever they used last, and everything lands in one thread.
Facebook Messenger and Instagram are separate Meta products and are not built.

## 9. Before the first real guest

- Add guests with **Guest agreed to receive texts** ticked only when they genuinely agreed at booking.
- Fill in **Menu & services**: it is the only thing David will offer.
- Read the campaign previews. Edit the guidance, or switch a campaign to the hotel's own words.
- Text the hotel number yourself and walk through room service, housekeeping, laundry, STOP and START.

## Not built yet

Staff roles beyond owner/staff, inviting teammates from the app, a PMS integration (guests and stays are entered by hand or
by API), payments for room-service orders, multi-language replies tuned per guest, and a push notification when a request arrives.
