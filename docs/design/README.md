# David laptop console: design

Staff console for David, designed for laptops only (1440×900) and built to sit on top of the Opera property management system.

- **Live design:** [David — Laptop Console in Framer](https://framer.com/projects/H047xDmCsAQDYfoXrWBV), page *Console — Laptop*
- **Snapshots:** `screens/*.jpg`, viewable in `index.html`

```bash
cd docs/design && python3 -m http.server 8123   # then open http://localhost:8123
```

## Screens

| File | Screen |
|---|---|
| `01-today` | Today: stats, request queue, arrivals read from Opera |
| `02-inbox` | Inbox: all channels in one thread, Opera guest profile beside it |
| `03-guest-opera` | Guest: field-by-field Opera and David, with approval state |
| `04-opera-sync` | Opera sync: connection, live event log, conflicts |
| `05-how-it-fits` | Architecture: Opera, David, guest channels |
| `06-requests` | Requests |
| `07-campaigns` | Campaigns |
| `08-channels` | Channels |
| `09-davids-brain` | What David knows, and how he behaves |
| `10-marketplace-1`, `11-marketplace-2` | Free Framer Marketplace components trialled |

## Principles the design is built around

1. **Opera is the record.** David reads profiles and stays live and never overwrites them. Conflicts go to a person.
2. **A person approves write-backs.** What guests tell David is proposed to Opera as a note, and written only after staff approve.
3. **Consent first, on every channel.** David follows each platform's messaging window and templates, and never texts a guest who has not agreed.

## Notes

- All guests, rooms and phone numbers are placeholders for a fictional hotel, The Harbour House.
- These are images, not code. Framer canvases cannot be exported as components from this workflow; the Expo staff app in `app/` is unchanged and still phone-first.
- Typeface is Arimo, standing in for Helvetica (Framer has no loadable Helvetica). Swap in a licensed Helvetica Neue by uploading it as a custom font in Framer.
- Opera integration details, such as OAuth and app key, property codes and the event stream, come from Oracle's public integration docs. Access is enabled per hotel by Oracle and needs confirming before any delivery date is promised.
