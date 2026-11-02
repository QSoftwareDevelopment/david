# Bryan's worklog

A running log of the changes Bryan (with Claude) makes to David, so whoever works on the repo next can see
what was done, why, and what still needs checking. Newest entries first.

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

### Not done / not verified
- **The server tests and typecheck have not been run.** The sandbox blocked `npm ci` for this repo. Before
  merging, run `cd server && npm ci && npm run typecheck && npm test`. The two new tests are untested.
- The Vietnamese keywords were written without a native speaker's review. Check them with a Vietnamese hotelier
  (`web/i18n.js` says the same about the console's wording).
- In the demo, David's apology is always in English, even when the guest writes in Vietnamese. The real Claude
  agent replies in the guest's language.
- Nothing is pushed and there's no PR. The branch exists only on Bryan's machine.

### Ideas for next time
- Connect the web console to the real server, so the demo uses the actual agent instead of scripted replies.
- Opera and Zalo appear only in the web mockup. Neither exists in `server/` yet.
- Merge `feat/web-console` into `main` through a PR so CI finally runs on it.
