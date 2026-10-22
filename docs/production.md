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

## 6. Before the first real guest

- Add guests with **Guest agreed to receive texts** ticked only when they genuinely agreed at booking.
- Fill in **Menu & services**: it is the only thing David will offer.
- Read the campaign previews. Edit the guidance, or switch a campaign to the hotel's own words.
- Text the hotel number yourself and walk through room service, housekeeping, laundry, STOP and START.

## Not built yet

Staff roles beyond owner/staff, inviting teammates from the app, a PMS integration (guests and stays are entered by hand or
by API), payments for room-service orders, multi-language replies tuned per guest, and a push notification when a request arrives.
