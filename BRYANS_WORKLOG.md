# Bryan's worklog

A running log of the changes Bryan (with Claude) makes to David, so whoever works on the repo next can see
what was done, why, and what still needs checking. Newest entries first.

---

## 2026-11-10 · Branch `bryan/opera-sandbox`

Built on `bryan/hardening-and-demo-escalation` (PR #1), so it includes those changes too.

### What changed

**1. David can talk to Opera (server, new `server/src/opera.ts`)**
- `OperaClient`: signs in once with OHIP's token flow and reuses the token. It also reads paged reservations,
  guest profiles and housekeeping rooms, and writes work orders, folio charges and preference proposals.
- `syncFromOpera()`: Opera → David. One guest per mobile number, one stay per reservation, and profile
  preferences become memories (source "staff"). It carries over VIPs, opt-outs and cancellations. Profiles with
  no mobile are skipped, with a reason. Running it again changes nothing. A guest who texted STOP is never opted
  back in by Opera.
- `pushToOpera()`: David → Opera. Open maintenance, housekeeping, laundry and amenity requests become work
  orders. Room service with a menu price becomes folio charges. Preferences guests told David are *proposed* for
  approval, never written straight to the profile. Each call carries David's own id, so pushing twice never
  duplicates anything.
- Not wired into the live server or the cron tick yet. For now only the sandbox and the tests call it.

**2. An Opera sandbox with a fake hotel (new `server/sandbox/`)**
- `hotel.ts`: *Lotus House Saigon*, a fictional 20-room boutique hotel with 15 guest profiles and 17
  reservations, each guest set up to test one feature (see `server/sandbox/README.md`).
- `opera-mock.ts`: a fake Opera that checks tokens, app key and hotel the way OHIP does, and refuses charges on
  guests who aren't in house.
- `run.ts`: `npm run sandbox` runs 40 checks across sync, campaigns, conversations and write-back.
  `--verbose` shows the conversations; `--serve` keeps the fake Opera (:8790) and David's demo API (:8787) running.

**3. Bug fix found by the sandbox: arrival messages after the guest has arrived (`server/src/campaigns.ts`)**
- Before: a guest who checked in yesterday got "Your room will be ready from 15:00…" at 11:30 the next day.
  The 30-hour catch-up window let the arrival-day message go out a day late.
- Now: a pre-arrival message never goes out on or after arrival day, and an arrival-day message never goes
  out after it. Test added in `server/test/campaigns.test.ts`.

**4. Tests (`server/test/opera.test.ts`)**
- The whole sandbox runs as a test (all 40 checks must pass), plus tests for OHIP parsing, the fake Opera's
  refusals, idempotent work orders and token reuse.

### How it was checked
- `npm run typecheck`: no errors. `npm test`: **183 of 183 pass** (the 179 from before plus 4 new).
- `npm run sandbox`: **40 of 40 checks pass** with the rules agent.
- `--serve` mode started and checked: the fake Opera's state showed work orders WO44800 (engineering, room
  302) and WO44801 (housekeeping, room 401), a $12 club sandwich charge and a pending "vegetarian" preference.
  David's `/health` answered.

### Not done / not verified
- **The Opera API shapes are a best guess.** They follow OHIP's style but were written without Oracle sandbox
  access. Check paths and field names against Oracle's API reference before connecting a real property.
- Not run with Claude as the agent (no API key in the sandbox run). Claude may word things differently, and
  some checks look for exact behaviour.
- Sync and write-back aren't scheduled anywhere yet. Next step: run them on the server's tick, and store which
  Opera reservation each stay came from instead of matching by dates.
- The client handles paged reservation results, but the test hotel fits in one page, so paging hasn't really
  been exercised.
- Pushed as **draft PR #2**: https://github.com/QSoftwareDevelopment/david/pull/2. It's stacked on PR #1
  (base `bryan/hardening-and-demo-escalation`). Merge #1 first, then point #2 at `feat/web-console`. Its
  Vercel checks will fail the same way as #1's until Bryan has Vercel access.

---

## 2026-11-02 · Branch `bryan/hardening-and-demo-escalation`

Based on `feat/web-console` (4f2ddb7), because that's where the current server and web console live. `main`
still only has the first commit.

### What changed

**1. Twilio webhooks now refuse requests when no auth token is set (server)**
- `server/src/http.ts`: both `/webhooks/twilio/sms` and `/webhooks/twilio/status` go through one
  `fromTwilio()` check. Before, if `TWILIO_AUTH_TOKEN` was unset on a live server, the signature check was
  skipped and anyone could post fake guest messages. Now, outside demo mode, a missing token means `403`.
  Demo mode is unchanged.
- `server/src/main.ts`: logs a warning at startup when a live server has no `TWILIO_AUTH_TOKEN`.
- `server/test/http.test.ts`: new test, "outside the demo, Twilio webhooks are refused when no auth token is
  configured".

**2. Anthropic SDK pinned (server)**
- `server/package.json` and the lock file root: `@anthropic-ai/sdk` went from `"latest"` to `"^1.1.0"`, the
  version already in `package-lock.json`. A new major SDK release can no longer slip in silently.

**3. Wider complaint detection, including Vietnamese (server)**
- `server/src/intents.ts`: the rules agent's `COMPLAINT` list now also catches *ridiculous, horrible, money
  back, compensation, chargeback, lawyer, complaint, unhappy, not happy, bad review*. A new `COMPLAINT_VI` list
  catches Vietnamese phrases (*hoàn tiền, bồi thường, khiếu nại, quản lý, thất vọng, bực mình, không chấp nhận
  được, quá tệ, kinh khủng, bẩn quá*). These are matched as phrases, because `\b` doesn't work around
  Vietnamese letters with diacritics.
- `server/test/intents.test.ts`: new test with English and Vietnamese complaints, plus two ordinary requests
  that must not escalate.
- This only affects the rules agent, which is the fallback when Claude is off or failing. The Claude agent
  already had an `escalate` tool for refunds and complaints.

**4. The web demo now escalates angry guests (web console)**
- Before: typing "This is ridiculous, I want a refund" as a guest got "I don't have that on file, so I won't
  guess", and nobody was told.
- `web/app.js`: `guestSays()` checks for complaints first, using the same word lists as the server. A complaint
  now:
  - creates a Front desk request in **Needs review**, assigned to the duty manager;
  - sends the manager a Zalo alert (if Zalo is on);
  - adds a system line saying David won't promise refunds or credits;
  - has David apologise and say the manager will contact the guest. It never promises money.
- `web/i18n.js`: Vietnamese text for the new system line, toast and request labels.

### How it was checked
- Web console: served locally and tested in the browser. Both an English refund demand and a Vietnamese one
  ("Phòng bẩn quá, tôi muốn hoàn tiền") were escalated. Both requests appear on Requests as
  "Upset guest: …" with no console errors.
- `node --check` passes on `web/app.js` and `web/i18n.js`.
- Server, run later the same day: `npm ci`, then `npm run typecheck` (clean) and `npm test`: **178 of 178
  pass**, which is the previous 176 plus the 2 new tests. Node 22, macOS. `npm ci` warned that the esbuild and
  fsevents install scripts weren't run, and the tests passed anyway.

### Not done / not verified
- The app (`app/`) tests and typecheck weren't run. Nothing in `app/` changed.
- The Vietnamese keywords were written without a native speaker's review. Check them with a Vietnamese hotelier
  (`web/i18n.js` says the same about the console's wording).
- In the demo, David's apology is always in English, even when the guest writes in Vietnamese. The real Claude
  agent replies in the guest's language.
- Pushed and opened as a **draft PR**: https://github.com/QSoftwareDevelopment/david/pull/1 (into
  `feat/web-console`). It needs your friend's review before it's merged.
- Both Vercel checks on the PR (`david-console`, `david-design`) fail with "Git author ba21982 must have access
  to the project on Vercel". That's a Vercel permissions problem, not a code problem: the Vercel team owner has to
  invite Bryan's account or authorise the deployment. No preview deploy exists until then.
- When the PR was opened, the GitHub CI jobs (`server`, `app`) were still running.

### Ideas for next time
- Connect the web console to the real server, so the demo uses the actual agent instead of scripted replies.
- Opera and Zalo appear only in the web mockup. Neither exists in `server/` yet.
- Merge `feat/web-console` into `main` through a PR so CI finally runs on it.
