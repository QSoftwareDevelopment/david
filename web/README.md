# David console (website)

A working web version of the laptop staff console, built from the Framer design in `docs/design`. Plain HTML, CSS and JavaScript, no build step, so it deploys anywhere that serves static files.

```bash
cd web && python3 -m http.server 8130   # open http://localhost:8130
```

## What works

- **Today:** range and assignee filters, KPI cards, charts drawn as SVG, request queue (click a status to move it along), arrivals, notes tabs.
- **Inbox:** pick a conversation, take over from David, reply as staff.
- **Requests:** filter by department and person, move requests along.
- **Guests:** approve Opera write-backs one at a time or all at once.
- **Campaigns:** pause and resume each message stage.
- **Opera sync:** live event log (a new event arrives every few seconds), resolve the phone-number conflict.
- **Channels:** turn David on or off per channel.
- **David's brain:** ask a question; he answers from what he knows, or says he has no source and hands it to a person.
- **Search:** Cmd or Ctrl K finds pages, guests and requests.

## Not wired up yet

Everything runs on made-up data in `data.js` for a fictional hotel, and changes live only in the browser tab. Nothing talks to Opera, WhatsApp, Messenger, iMessage, SMS or Claude yet. The next step is replacing `data.js` and the `S` state in `app.js` with calls to the David server in `server/`.

## Look

One palette, set as CSS variables at the top of `styles.css`: linen background, white surfaces, harbour green, with clay for needs-attention and slate for pending. Nothing else is used, so the whole site changes from one place.
