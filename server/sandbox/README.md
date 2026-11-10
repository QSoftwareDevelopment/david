# Opera sandbox

A fictional 20-room boutique hotel, **Lotus House Saigon**, inside a fake Opera Cloud, with David connected to it.
It lets you test David's Opera features end to end without Oracle access. All people, phone numbers and bookings
are made up.

```bash
npm run sandbox              # run every scenario, print a pass/fail report (exit 1 on any failure)
npm run sandbox -- --verbose # also print what David said
npm run sandbox -- --serve   # then keep running: fake Opera on :8790, David's demo API on :8787
```

With `ANTHROPIC_API_KEY` set, Claude writes David's replies, which is a real API call. Without it, the rules
agent does. `npm test` always uses the rules agent.

## What's in it

| File | What it is |
|---|---|
| `hotel.ts` | The hotel: 20 rooms, 15 guest profiles, 17 reservations. Dates are relative to today, so there is always someone arriving, in house and just gone. Each guest is there to test one thing. |
| `opera-mock.ts` | The fake Opera: OAuth token, paged reservation search, profiles, housekeeping rooms, work orders, folio charges and preference proposals. It refuses what Opera would refuse (bad token, wrong hotel, a charge on a guest who isn't in house). `GET /_sandbox/state` shows everything David wrote; `POST /_sandbox/reset` starts over. |
| `run.ts` | The scenarios: sync from Opera, the day's campaigns, guest conversations, the evening campaigns, then writing back to Opera. |
| `../src/opera.ts` | The real part: David's Opera client, `syncFromOpera` and `pushToOpera`. |

## What it checks (40 checks)

- **Sync:** guests and stays from Opera, a year of history so regulars are known, allergies and preferences,
  VIPs, opt-outs, cancellations, a profile with no mobile skipped with a reason, and running it twice changes nothing.
- **Campaigns:** pre-arrival, arrival day, thank-you, win-back and mid-stay go to the right guests. Nothing goes to
  guests who opted out, have unknown consent or cancelled. At most one message a day per guest.
- **Conversations:** maintenance, housekeeping, late check-out and room service requests; a diet remembered;
  English and Vietnamese refund demands escalated; an arrival time saved; a 9 rating gets the review link; STOP works.
- **Write-back:** work orders for the right rooms, room service charged to the folio, a new preference proposed
  for approval (never written straight to the profile), and pushing twice doesn't duplicate anything.

## Limits

The fake Opera follows the shape of Oracle's OHIP APIs but was built without access to Oracle's sandbox. Paths and
field names need checking against Oracle's API reference, and against the modules the real property has enabled,
before David connects to a real Opera. All Opera parsing lives in `src/opera.ts`, so that's the only place to change.
