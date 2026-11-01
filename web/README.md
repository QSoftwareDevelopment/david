# David console (website)

A working web version of the laptop staff console, built from the Framer design in `docs/design`. Plain HTML, CSS and JavaScript, no build step, so it deploys anywhere that serves static files.

```bash
cd web && python3 -m http.server 8130   # open http://localhost:8130
```

## What works

- **Today:** range and assignee filters, KPI cards, charts drawn as SVG, request queue, arrivals, notes tabs.
- **Requests:** click any request. Send it to the right person (David suggests one by department and shows if they can be reached on Zalo), then mark it done once it has been sent. The guest is told "Luis from Maintenance is on this now" and again when it is done, in their own Inbox thread. Each request keeps a timeline. The messages to the guest are editable, and a switch turns guest updates off.
- **Inbox:** pick a conversation, take over from David, reply as staff.
- **Guests:** the fields start collapsed to the top two (the ones needing attention first) and expand on request. Every guest is listed below: search, filter, click one to see their fields.
- **Revenue campaigns:** three campaigns (pre-arrival upsell, in-stay offer, post-stay rebooking), each with an offer, price and cost. Results show guests messaged, replies, bookings, extra revenue, costs and net profit (made-up numbers for the last 30 days, worked out from the price you set). "Who gets which offer" picks an offer per guest from their recorded likes and skips offers that clash with an allergy. Timing, audience and message are editable, with quiet-hours warnings.
- **Tasks:** a guest message in the Inbox (type as the guest at the bottom) about towels, a table, a transfer, laundry, a fault or room service creates a task for the right department, sends it to the person on Zalo, tells the guest, and gives it a due time. Requests show due and overdue, and "+15 min" moves the demo clock so overdue tasks are escalated to the duty manager.
- **Privacy and access:** roles (duty manager, front desk, housekeeping, marketing; switch at the bottom left) control pages and phone masking, a per-guest marketing consent record (guests without it are held back), an access log, export and deletion requests with an answer date, and a retention setting. It is a demo of the controls, not legal compliance.
- **Opera sync:** live event log, a conflict to resolve.
- **Channels:** turn David on or off per channel.
- **David's brain:** connections to Opera, Square, Toast, Zalo, Slack and more (connect, test and disconnect in a setup panel), the team directory with a Zalo number and consent for every employee, a Zalo message log, an API tab with keys and a "try it" console, editable knowledge David answers from, and a Try David box.
- **Search:** Cmd or Ctrl K finds pages, guests, campaigns and requests.
- **Vietnamese:** an EN | VI switch at the top right. It translates the interface and sample records; guest messages, names, numbers and API text stay as they are. The wording in `i18n.js` has not had a native review.
- Everything you change is saved in the browser. "Reset demo data" in the sidebar clears it.

## Not wired up yet

Everything runs on made-up data in `data.js` for a fictional hotel, and changes live only in this browser. Nothing talks to Opera, Zalo, WhatsApp, Messenger, iMessage, SMS, Square, Toast or Claude yet, and connecting in the Connections section only records that on this page. The API in the "API and automation" tab is a mock that runs inside the page. The real one is specified in `docs/api/openapi.yaml` and still has to be built in `server/`. Zalo rules (approved ZNS templates, a Zalo-registered business, employee consent) need checking against developers.zalo.me before launch.

## Look

One palette, set as CSS variables at the top of `styles.css`: linen background, white surfaces, harbour green, with clay for needs-attention and slate for pending. Nothing else is used, so the whole site changes from one place.
