import * as D from "./data.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  tray: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  users: '<path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 20v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  plug: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  arrows: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
  brain: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18 17l.8 2.2L21 20l-2.2.8L18 23l-.8-2.2L15 20l2.2-.8z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24">${ICON[n]}</svg>`;

const PAGES = [
  ["today", "Today", "home"], ["inbox", "Inbox", "chat"], ["requests", "Requests", "tray"], ["guests", "Guests", "users"], ["campaigns", "Campaigns", "megaphone"],
  "Connected", ["opera", "Opera sync", "plug"], ["channels", "Channels", "arrows"], ["brain", "David’s brain", "brain"],
];
const SUB = {
  today: () => `${D.hotel.date} · ${D.hotel.name}`, inbox: () => "Every channel in one place", requests: () => `${openCount()} open · routed by David to each department`,
  guests: () => "Suite 701 · arriving 13:30 · 3rd stay · linked to OPERA profile #00481726", campaigns: () => "Texts David sends first, by moment in the stay",
  opera: () => "OPERA Cloud property link · two-way, with a person approving what goes back", channels: () => "Where guests already write, and the numbers David answers from",
  brain: () => `What David knows about ${D.hotel.name}, and how he behaves`,
};
const TITLE = { guests: "Elena Vasquez" };

const S = {
  range: "week", assignee: "All people", reqFilter: "All", autoReply: true, notesTab: "opera",
  convo: "c1", extra: {}, takeover: {},
  requests: D.requests.map((r) => ({ ...r })), fields: D.guestFields.map((f) => ({ ...f })),
  conflict: "open", events: D.events.map((e) => [...e]), campaigns: D.campaigns.map((c) => ({ ...c })), chans: D.channels.map((c) => ({ ...c, on: true })),
  qa: [["What time is check-out on Sunday?", D.answers[0][1], "Hotel policies"], ["Can I bring my dog?", "I don’t have a pet policy on file, so I won’t guess. I’ve asked the front desk and I’ll come back to you.", null]],
};
const openCount = () => S.requests.filter((r) => r.st !== "done").length;

const ST = { review: ["review", "Needs review"], pending: ["pend", "Pending"], progress: ["ok", "In progress"], done: ["ok", "Done"] };
const pill = (cls, label, extra = "") => `<span class="pill ${cls}" ${extra}>${esc(label)}</span>`;
const chip = (c) => `<span class="chip ${c === "Messenger" ? "ig" : c === "SMS" ? "sm" : c === "iMessage" ? "im" : ""}">${esc(c)}</span>`;
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); };
const now = () => new Date().toTimeString().slice(0, 8);

/* ---------- charts, one palette ---------- */
const GREENS = ["#1D4A3F", "#5E8C7E", "#B8CDC5", "#3F5B75"];
function barChart(rows) {
  const W = 560, H = 210, pad = 8, top = 12, base = H - 26, max = Math.max(...rows.map((r) => r[1])) * 1.12, gw = (W - pad * 2) / rows.length, bw = Math.min(24, gw / 3.2);
  let g = [0.25, 0.5, 0.75, 1].map((t) => `<line x1="${pad}" x2="${W - pad}" y1="${base - (base - top) * t}" y2="${base - (base - top) * t}" stroke="#E2DCCD" stroke-dasharray="3 4"/>`).join("");
  rows.forEach(([l, a, b], i) => {
    const cx = pad + gw * i + gw / 2, ha = (base - top) * a / max, hb = (base - top) * b / max;
    g += `<rect x="${cx - bw - 2}" y="${base - ha}" width="${bw}" height="${ha}" rx="4" fill="#1D4A3F"><title>${l}: ${a} handled by David</title></rect><rect x="${cx + 2}" y="${base - hb}" width="${bw}" height="${hb}" rx="4" fill="#B8CDC5"><title>${l}: ${b} by staff</title></rect><text x="${cx}" y="${H - 8}" text-anchor="middle">${l}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Messages handled by David and by staff">${g}</svg>`;
}
function lineChart(rows) {
  const W = 560, H = 210, pad = 24, top = 22, base = H - 26, min = 60, max = 100, step = (W - pad * 2) / (rows.length - 1);
  const pts = rows.map(([l, v], i) => [pad + step * i, base - (base - top) * (v - min) / (max - min), l, v]);
  let g = [60, 70, 80, 90, 100].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${base - (base - top) * (v - min) / (max - min)}" y2="${base - (base - top) * (v - min) / (max - min)}" stroke="#E2DCCD" stroke-dasharray="3 4"/>`).join("");
  g += `<polyline fill="none" stroke="#1D4A3F" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p) => p[0] + "," + p[1]).join(" ")}"/>`;
  pts.forEach(([x, y, l, v]) => (g += `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#1D4A3F" stroke-width="2"><title>${l}: ${v}%</title></circle><text x="${x}" y="${y - 10}" text-anchor="middle" style="fill:#17201C">${v}</text><text x="${x}" y="${H - 8}" text-anchor="middle">${l}</text>`));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Occupancy">${g}</svg>`;
}
function donut(rows) {
  const total = rows.reduce((s, r) => s + r[1], 0), R = 42, C = 2 * Math.PI * R; let off = 0;
  const arcs = rows.map(([n, v], i) => { const len = C * v / total, el = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${GREENS[i]}" stroke-width="18" stroke-dasharray="${len - 2} ${C - len + 2}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${n}: ${Math.round(v / total * 100)}%</title></circle>`; off += len; return el; }).join("");
  const legend = rows.map(([n, v], i) => `<div style="display:flex;justify-content:space-between;gap:16px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GREENS[i]};margin-right:8px"></i>${n}</span><b>${Math.round(v / total * 100)}%</b></div>`).join("");
  return `<div class="donut-wrap"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="Messages by channel">${arcs}<text x="60" y="58" text-anchor="middle" style="font:700 18px var(--font);fill:#17201C">${total}</text><text x="60" y="73" text-anchor="middle" style="font:11px var(--font);fill:#666B63">messages</text></svg><div style="display:grid;gap:8px;flex:1">${legend}</div></div>`;
}
const progress = (rows) => `<div class="prog">${rows.map(([n, v]) => `<div><div class="l"><span>${esc(n)}</span><b>${v}%</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`).join("")}</div>`;

/* ---------- views ---------- */
function requestRows(list, compact) {
  return list.map((r) => `<tr><td>${esc(r.dept)}</td><td class="num">${esc(r.room)}</td><td class="ask"><b>${esc(r.ask)}</b><span class="small">${esc(r.guest)}</span></td><td>${chip(r.ch)}</td>${compact ? "" : `<td class="mono">${r.opened}</td><td class="small" style="color:var(--ink)">${esc(r.who)}</td>`}<td><button class="pill ${ST[r.st][0]}" data-a="cycle" data-id="${r.id}" title="Click to move this request along">${ST[r.st][1]}</button></td></tr>`).join("");
}
const reqTable = (list, compact = false) => `<table class="t"><thead><tr><th>Department</th><th>Room</th><th>Request</th><th>Channel</th>${compact ? "" : "<th>Opened</th><th>Assigned</th>"}<th>Status</th></tr></thead><tbody>${requestRows(list, compact)}</tbody></table>`;

function today() {
  const R = D.ranges[S.range], open = openCount(), list = S.requests.filter((r) => S.assignee === "All people" || r.who === S.assignee).filter((r) => r.st !== "done").slice(0, 6);
  const kpi = ([l, v, d, bad, n]) => `<div class="card kpi"><span class="label">${l}</span><b>${v}</b><span class="delta ${bad ? "bad" : ""}">${d}</span><span class="small">${n}</span></div>`;
  const notes = { opera: [["Allergy", "Shellfish"], ["Room", "High floor"], ["Occasion", "Anniversary, 3 Nov"]], david: [["Pillows", "Two firm, told David in March"], ["Dinner", "Vegetarian, noticed from three orders"], ["Contact", "Prefers WhatsApp"]], staff: [["Front desk", "Upgrade offered on arrival"], ["Concierge", "Booked Tuesday dinner, 7:30 pm"]] }[S.notesTab];
  return `
  <div class="toolbar">
    <div class="seg" role="group" aria-label="Range">${Object.entries(D.ranges).map(([k, r]) => `<button class="${S.range === k ? "on" : ""}" data-a="range" data-v="${k}">${r.label}</button>`).join("")}</div>
    <select class="sel" data-a="assignee" aria-label="Assigned to">${D.people.map((p) => `<option ${p === S.assignee ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
    <span class="sp"></span><span class="small" style="color:var(--ink)">David replies automatically</span>
    <button class="switch" role="switch" aria-checked="${S.autoReply}" data-a="auto" aria-label="David replies automatically"></button>
  </div>
  <div class="row kpis">${[["Arriving today", "24", "▲ 8%", 0, "9 answered pre-arrival"], ["In house", "112", "▲ 3%", 0, "78% occupancy"], ["Open requests", String(open), "▼ 12%", 0, "Longest wait 11 min"], ["Messages", "186", "▲ 21%", 0, "92% handled by David"], ["Guest rating", "9.1", "▲ 4%", 0, "From 63 check-ins"]].map(kpi).join("")}</div>
  <div class="row cols3">
    <div class="card"><div class="hd"><div><h2>Messages</h2><div class="small sub">${R.note}</div></div><div class="legend"><span><i style="background:#1D4A3F"></i>David</span><span><i style="background:#B8CDC5"></i>Staff</span></div></div><div class="bd">${barChart(R.bars)}</div></div>
    <div class="card"><div class="hd"><div><h2>Occupancy</h2><div class="small sub">Rooms sold, percent</div></div></div><div class="bd">${lineChart(R.occ)}</div></div>
    <div class="card"><div class="hd"><div><h2>Where guests write</h2><div class="small sub">Share of messages by channel</div></div></div><div class="bd" style="padding-top:18px">${donut(D.mix)}</div></div>
  </div>
  <div class="row" style="grid-template-columns:2fr 1fr">
    <div class="card"><div class="hd"><div><h2>Open requests</h2><div class="small sub">Routed by David to each department · click a status to move it along</div></div><a class="btn sm" href="#/requests">View all ${open}</a></div>${list.length ? reqTable(list, true) : '<div class="empty">Nothing open for this person.</div>'}</div>
    <div style="display:grid;gap:20px">
      <div class="card"><div class="hd"><div><h2>Arriving today</h2><div class="small sub">Read live from OPERA reservations and profiles</div></div></div><div class="list">${D.arrivals.map(([t, n, d]) => `<div><span class="mono" style="width:44px">${t}</span><div class="grow"><div>${esc(n)}</div><div class="small">${esc(d)}</div></div></div>`).join("")}</div></div>
      <div class="card tint"><div class="pad"><span class="label" style="color:var(--green)">David’s morning note</span><p>Three arrivals have allergies in Opera. I’ve asked Elena and the Okafors to confirm them before dinner, and nothing goes to the kitchen until they answer. Room 608 has waited the longest, so I’ve flagged it to you.</p></div></div>
    </div>
  </div>
  <div class="row cols3">
    <div class="card"><div class="hd"><div><h2>Answered on time</h2><div class="small sub">Requests started within the target wait</div></div></div><div class="bd">${progress(D.progress)}</div></div>
    <div class="card"><div class="hd"><div><h2>Room service sales</h2><div class="small sub">Today, by item</div></div></div><table class="t"><thead><tr><th>Item</th><th>Sold</th><th>Sales</th><th>vs avg</th></tr></thead><tbody>${D.sales.map(([n, s, r, d]) => `<tr><td>${n}</td><td class="num">${s}</td><td class="num">$${r}</td><td class="num delta ${d < 0 ? "bad" : ""}">${d > 0 ? "+" : ""}${d}%</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><div class="hd"><div><h2>Guest notes</h2><div class="small sub">Elena Vasquez, Suite 701</div></div></div><div class="bd"><div class="tabs">${[["opera", "Opera"], ["david", "David learned"], ["staff", "Staff"]].map(([k, l]) => `<button class="${S.notesTab === k ? "on" : ""}" data-a="notes" data-v="${k}">${l}</button>`).join("")}</div><div class="list tight">${notes.map(([k, v]) => `<div><span class="small" style="width:80px">${k}</span><span class="grow">${esc(v)}</span></div>`).join("")}</div></div></div>
  </div>
  <div class="card"><div class="hd"><div><h2>Staff on shift</h2><div class="small sub">Who is on the floor now</div></div></div><div class="bd"><div class="avs">${D.staff.map(([n, r]) => `<div><span class="avatar">${initials(n)}</span><span style="font-size:13px">${n.split(" ")[0]}</span><span class="small">${r}</span></div>`).join("")}</div></div></div>`;
}

function inbox() {
  const c = D.convos.find((x) => x.id === S.convo), extra = S.extra[c.id] || [], tk = !!S.takeover[c.id];
  const msgs = [...c.msgs, ...extra].map((m) => m[0] === "sys" ? `<div class="sys">${esc(m[1])}</div>` : `<div class="msg ${m[0]}"><div class="b">${esc(m[1])}</div><div class="m">${m[0] === "guest" ? "Guest" : m[0] === "david" ? "David" : "Maya"} · ${m[2]}</div></div>`).join("");
  return `<div class="inbox">
  <section class="convos"><div style="padding:20px 20px 12px"><h2 style="font-size:20px">Inbox</h2><div class="small">${D.convos.length} conversations · ${D.convos.filter((x) => x.unread).length} need you</div></div>
  ${D.convos.map((x) => `<button class="convo ${x.id === S.convo ? "on" : ""}" data-a="convo" data-id="${x.id}"><span class="avatar" style="${x.unread ? "background:var(--clay-soft);color:var(--clay)" : ""}">${initials(x.name)}</span><div class="grow" style="min-width:0;flex:1"><div class="top2"><span>${esc(x.name)} · ${esc(x.room.replace("Room ", ""))}</span><span class="small">${x.time}</span></div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.prev)}</div><div style="margin-top:6px">${chip(x.ch)}</div></div></button>`).join("")}</section>
  <section class="thread"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:var(--surface);border-bottom:1px solid var(--rule)"><div><h2>${esc(c.name)}</h2><div class="small">${c.room} · ${c.tier} · linked to Opera</div></div><div style="display:flex;gap:10px;align-items:center">${chip(c.ch)}<button class="btn sm ${tk ? "primary" : ""}" data-a="takeover">${tk ? "Hand back to David" : "Take over from David"}</button></div></div>
  <div class="msgs" id="msgs">${msgs}</div>
  <form class="compose" data-a="send"><input id="reply" placeholder="${tk ? "Reply as staff…" : "David is handling this. Take over to reply as staff"}" ${tk ? "" : "disabled"} autocomplete="off"><button class="btn primary" ${tk ? "" : "disabled"}>Send as staff</button></form></section>
  <section class="profile"><div style="display:flex;justify-content:space-between"><span class="label">Guest profile</span>${pill("ok", "Opera")}</div>${c.profile.map(([k, v]) => `<div class="field"><span class="label">${k}</span><span>${esc(v)}</span></div>`).join("")}<div class="note"><span class="label" style="color:var(--green)">Written back to Opera</span><span class="small" style="color:var(--ink)">Work order #44821 · Preference note awaiting your approval.</span></div></section></div>`;
}

function requests() {
  const depts = ["All", ...new Set(D.requests.map((r) => r.dept))];
  let list = S.requests.filter((r) => (S.reqFilter === "All" || r.dept === S.reqFilter) && (S.assignee === "All people" || r.who === S.assignee));
  return `<div class="toolbar"><div style="display:flex;gap:8px;flex-wrap:wrap">${depts.map((d) => `<button class="btn sm ${S.reqFilter === d ? "primary" : ""}" style="border-radius:999px" data-a="dept" data-v="${d}">${d} ${d === "All" ? S.requests.length : S.requests.filter((r) => r.dept === d).length}</button>`).join("")}</div><span class="sp"></span><select class="sel" data-a="assignee" aria-label="Assigned to">${D.people.map((p) => `<option ${p === S.assignee ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
  <div class="card">${list.length ? reqTable(list) : '<div class="empty">No requests match.</div>'}</div>`;
}

function guests() {
  const pending = S.fields.filter((f) => f.st !== "ok").length;
  return `<div class="card"><div class="hd"><div><h2>Opera and David, field by field</h2><div class="small sub">Opera stays the record. David adds what guests tell him and proposes it back for your approval.</div></div><div style="display:flex;gap:10px"><button class="btn" data-a="review">Review ${pending} write-back${pending === 1 ? "" : "s"}</button><button class="btn primary" data-a="approveAll" ${pending ? "" : "disabled"}>Approve all</button></div></div>
  <table class="t"><thead><tr><th>Field</th><th>In Opera</th><th>What David knows</th><th>Direction</th><th>Status</th></tr></thead><tbody>${S.fields.map((f) => `<tr><td>${f.field}${f.tip ? ` <span class="small" title="${esc(f.tip)}" style="cursor:help;border:1px solid var(--rule);border-radius:50%;padding:0 5px;font-size:11px">i</span>` : ""}</td><td style="${f.opera ? "" : "color:var(--mute)"}">${esc(f.opera || "Not recorded")}</td><td>${esc(f.david)}</td><td class="mono">${f.dir}</td><td style="display:flex;gap:8px;align-items:center">${pill(f.st, f.label)}${f.st !== "ok" ? `<button class="btn sm" data-a="approve" data-id="${f.id}">Approve</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
  <div class="card"><div class="pad" style="grid-auto-flow:column;justify-content:start;gap:12px"><span style="color:var(--green)" class="nav" aria-hidden="true">${icon("brain")}</span><p>David will only write something into Opera after a person approves it. Allergies and the guest’s own words outrank anything David inferred, and a conflict like Dinner stays flagged until staff decide.</p></div></div>`;
}

function campaigns() {
  const active = S.campaigns.filter((c) => c.on).length;
  return `<div class="row cards5">${S.campaigns.map((c) => `<div class="card pad"><span class="label">${c.kicker}</span><h2>${c.name}</h2><span class="mono" style="color:var(--green)">${c.when}</span><p class="small" style="color:var(--ink);min-height:58px">${c.what}</p><div style="display:flex;justify-content:space-between;align-items:center">${pill(c.on ? "ok" : "pend", c.on ? "Active" : "Paused")}<button class="switch" role="switch" aria-checked="${c.on}" data-a="camp" data-id="${c.id}" aria-label="${c.name} active"></button></div></div>`).join("")}</div>
  <div class="row" style="grid-template-columns:1fr 400px">
    <div class="card pad"><h2>Before arrival · what Elena will receive</h2><p class="small">David writes each message from what he already knows, or sends the hotel’s exact words. Sent three days before arrival.</p><div class="bubble">Hi Elena, we’re looking forward to Saturday. Is there anything we should know before you arrive, like dietary needs, or a late arrival time? I can pass it to the team so it’s ready.</div><span class="small" style="justify-self:end">David · WhatsApp · uses arrival date and allergy from Opera</span><div class="note"><span class="label" style="color:var(--green)">Read from Opera</span><span class="small" style="color:var(--ink)">Arrival date, room type, shellfish allergy, number of stays</span></div><span class="small">${active} of ${S.campaigns.length} campaigns active</span></div>
    <div class="card pad"><h2>Rules David holds, whatever the model says</h2>${D.rules.map((r) => `<div class="check"><svg viewBox="0 0 24 24">${ICON.check}</svg><span>${r}</span></div>`).join("")}</div></div>`;
}

function opera() {
  const review = S.conflict === "open", pend = S.events.filter((e) => e[4] === "pend").length + S.fields.filter((f) => f.st === "pend").length;
  const k = ([l, v, n]) => `<div class="card kpi"><span class="label">${l}</span><b>${v}</b><span class="small">${n}</span></div>`;
  return `<div class="row cards4">${[["Profiles linked", "3,284", "98.6% matched to a phone number"], ["Events today", (1942 + S.events.length - 6).toLocaleString(), "From Opera’s event stream"], ["Write-backs this week", String(126 + (S.fields.filter((f) => f.st === "ok").length - 4)), `${pend} awaiting approval`], ["Conflicts", review ? "2" : "1", "Staff decide, nothing auto-overwrites"]].map(k).join("")}</div>
  <div class="row" style="grid-template-columns:1fr 400px">
    <div class="card"><div class="hd"><div><h2>Live activity</h2><div class="small sub">Opera to David on the left of each line, David to Opera on the right</div></div></div><table class="t"><tbody>${S.events.slice(0, 12).map((e) => `<tr><td class="mono">${e[0]}</td><td class="mono" style="color:var(--ink)">${e[1]} ${e[2]}</td><td>${esc(e[3])}</td><td>${pill(e[4], e[5])}</td></tr>`).join("")}</tbody></table></div>
    <div style="display:grid;gap:20px">
      <div class="card pad"><h2>Connection</h2>${[["Property", "HARBOUR · chain HH"], ["Access", "OAuth with app key"], ["Stream", "Connected · 7-day replay"], ["Last full resync", "Today, 03:00"]].map(([a, b]) => `<div class="check" style="justify-content:space-between"><span class="small">${a}</span><span>${b}</span></div>`).join("")}</div>
      ${review ? `<div class="card pad" style="background:var(--clay-soft);border-color:transparent"><span class="label" style="color:var(--clay)">Needs a decision</span><p>Marcus Bell’s mobile in Opera is +44 7700 900118. The number he messages from on WhatsApp is +44 7700 900611.</p><div style="display:flex;gap:8px"><button class="btn" data-a="resolve" data-v="Kept the Opera number">Keep Opera</button><button class="btn primary" data-a="resolve" data-v="Switched to the WhatsApp number">Use WhatsApp</button></div></div>` : `<div class="card pad tint"><span class="label" style="color:var(--green)">Resolved</span><p>${esc(S.conflict)}. The change is queued to Opera.</p></div>`}
      <div class="card pad"><h2>Sync health</h2>${progress([["Profiles matched to a phone number", 98.6], ["Write-backs approved", 96], ["Events applied without review", 99]])}</div></div></div>`;
}

function channels() {
  return `<div class="row cards4">${S.chans.map((c) => `<div class="card pad"><div><h2>${c.name}</h2><div class="mono">${c.handle}</div></div><div style="display:flex;justify-content:space-between;align-items:center">${pill(c.on ? "ok" : "pend", c.on ? "Connected" : "David paused")}<div style="text-align:right"><b style="font-size:20px">${c.on ? c.n : 0}</b><div class="small">messages today</div></div></div><p class="small" style="min-height:52px;color:var(--ink)">${c.rule}</p><div class="check" style="justify-content:space-between;align-items:center"><span>David answers here</span><button class="switch" role="switch" aria-checked="${c.on}" data-a="chan" data-id="${c.id}" aria-label="David answers on ${c.name}"></button></div></div>`).join("")}</div>
  <div class="row" style="grid-template-columns:1fr 480px"><div class="card pad"><h2>One guest, every channel</h2><p class="small">David matches a message to the Opera profile by mobile number, so the same person is one conversation wherever they write.</p><div class="note" style="grid-auto-flow:column;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--rule)"><div style="display:flex;gap:12px;align-items:center"><span class="avatar">EV</span><div><div>Elena Vasquez</div><div class="mono">OPERA #00481726 · +44 7700 900418</div></div></div><div style="display:flex;gap:6px">${chip("WhatsApp")}${chip("Messenger")}${chip("SMS")}</div></div></div>
  <div class="card"><div class="hd"><div><h2>Numbers</h2><div class="small sub">Each hotel number is verified before David answers on it</div></div></div><table class="t"><tbody>${D.numbers.map(([n, u, c]) => `<tr><td class="mono" style="color:var(--ink)">${n}</td><td>${u}<div class="small">${c}</div></td><td>${pill("ok", "Verified")}</td></tr>`).join("")}</tbody></table></div></div>`;
}

function brain() {
  return `<div class="row" style="grid-template-columns:1fr 460px">
  <div class="card"><div class="hd"><div><h2>What David knows</h2><div class="small sub">He answers only from these. If it isn’t here, he says so and asks a person.</div></div></div><div class="list">${D.knowledge.map((k) => `<div style="align-items:center"><span class="avatar" style="border-radius:8px">${icon("check").replace("<svg", '<svg width="18" height="18" fill="none" stroke="#1D4A3F" stroke-width="1.8" stroke-linecap="round"')}</span><div class="grow"><div>${k.name}</div><div class="small">${k.detail}</div></div><div style="text-align:right">${pill(k.st, k.src)}<div class="small" style="margin-top:3px">${k.when}</div></div></div>`).join("")}</div></div>
  <div style="display:grid;gap:20px"><div class="card pad"><h2>Try David</h2>${S.qa.map(([q, a, s]) => `<div class="q">${esc(q)}</div><div class="a">${esc(a)}</div><div>${s ? pill("ok", "Answered from " + s) : pill("review", "No source · handed to a person")}</div>`).join("")}<form class="try" data-a="ask"><input id="ask" placeholder="Ask David something a guest might ask" autocomplete="off"><button class="btn primary">Ask</button></form><div class="small">Try: breakfast, parking, wifi, “can I bring my cat”</div></div>
  <div class="card pad"><h2>How he behaves</h2>${["Complaints and emergencies go straight to the duty manager", "Remembered habits are offered as a question, never assumed", "Allergies travel with every food order to the kitchen"].map((t) => `<div class="check"><svg viewBox="0 0 24 24">${ICON.check}</svg><span>${t}</span></div>`).join("")}</div></div></div>`;
}

const V = { today, inbox, requests, guests, campaigns, opera, channels, brain };

/* ---------- shell ---------- */
function route() { const p = location.hash.replace(/^#\//, "") || "today"; return V[p] ? p : "today"; }
function renderNav(p) {
  $("#nav").innerHTML = PAGES.map((x) => typeof x === "string" ? `<div class="label nav-sec">${x}</div>` : `<a href="#/${x[0]}" class="${x[0] === p ? "on" : ""}" ${x[0] === p ? 'aria-current="page"' : ""}>${icon(x[2])}${x[1]}${x[0] === "inbox" ? `<span class="count">${D.convos.filter((c) => c.unread).length + 11}</span>` : x[0] === "requests" ? `<span class="count">${openCount()}</span>` : ""}</a>`).join("");
}
function render() {
  const p = route(), view = $("#view");
  renderNav(p); $("#title").textContent = TITLE[p] || PAGES.find((x) => x[0] === p)[1]; $("#sub").textContent = SUB[p](); document.title = `${$("#title").textContent} · David`;
  view.className = "view" + (p === "inbox" ? " flush" : ""); view.innerHTML = V[p]();
  const m = $("#msgs"); if (m) m.scrollTop = m.scrollHeight;
}
$("#hotel").textContent = D.hotel.name;

/* ---------- actions ---------- */
const next = { review: "progress", pending: "progress", progress: "done", done: "pending" };
const A = {
  range: (t) => (S.range = t.dataset.v), assignee: (t) => (S.assignee = t.value), auto: () => { S.autoReply = !S.autoReply; toast(S.autoReply ? "David is replying automatically" : "David paused: replies wait for staff"); },
  notes: (t) => (S.notesTab = t.dataset.v), dept: (t) => (S.reqFilter = t.dataset.v),
  cycle: (t) => { const r = S.requests.find((x) => x.id === t.dataset.id); r.st = next[r.st]; toast(`${r.dept} · room ${r.room}: ${ST[r.st][1].toLowerCase()}`); },
  convo: (t) => { S.convo = t.dataset.id; D.convos.find((c) => c.id === t.dataset.id).unread = false; },
  takeover: () => { const id = S.convo; S.takeover[id] = !S.takeover[id]; (S.extra[id] ||= []).push(["sys", S.takeover[id] ? "Maya took over from David" : "Handed back to David"]); },
  approve: (t) => { const f = S.fields.find((x) => x.id === t.dataset.id); f.st = "ok"; f.label = "Synced"; toast(`${f.field} approved and written to Opera`); },
  approveAll: () => { S.fields.forEach((f) => { f.st = "ok"; f.label = "Synced"; }); toast("All write-backs approved and sent to Opera"); },
  review: () => toast("Pillows and Dinner are waiting for you"),
  camp: (t) => { const c = S.campaigns.find((x) => x.id === t.dataset.id); c.on = !c.on; toast(`${c.name}: ${c.on ? "active" : "paused"}`); },
  chan: (t) => { const c = S.chans.find((x) => x.id === t.dataset.id); c.on = !c.on; toast(`David ${c.on ? "answers" : "stopped answering"} on ${c.name}`); },
  resolve: (t) => { S.conflict = t.dataset.v; S.events.unshift([now(), "→", "PROFILE UPDATE", "Bell · mobile resolved", "ok", "Queued"]); toast(t.dataset.v); },
};
document.addEventListener("click", (e) => { const t = e.target.closest("[data-a]"); if (!t || t.tagName === "FORM" || t.tagName === "SELECT") return; A[t.dataset.a]?.(t, e); render(); });
document.addEventListener("change", (e) => { const t = e.target.closest("select[data-a]"); if (t) { A[t.dataset.a](t); render(); } });
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-a]"); if (!f) return; e.preventDefault();
  if (f.dataset.a === "send") { const i = $("#reply"), v = i.value.trim(); if (!v) return; (S.extra[S.convo] ||= []).push(["staff", v, now().slice(0, 5)]); render(); $("#reply").focus(); }
  if (f.dataset.a === "ask") { const i = $("#ask"), v = i.value.trim(); if (!v) return; const hit = D.answers.find(([re]) => re.test(v)); S.qa.push([v, hit ? hit[1] : "I don’t have that on file, so I won’t guess. I’ve asked the front desk and I’ll come back to you.", hit ? hit[2] : null]); render(); $("#view").scrollTo?.(0, 0); $("#ask").focus(); }
});
window.addEventListener("hashchange", render);
$("#bell").addEventListener("click", () => toast("2 conflicts and 2 write-backs need you"));

/* live events on the Opera screen */
let ev = 0;
setInterval(() => { const e = D.eventPool[ev++ % D.eventPool.length]; S.events.unshift([now(), e[0], e[1], e[2], "ok", e[0] === "→" ? "Created" : "Applied"]); if (route() === "opera") render(); }, 7000);

/* search palette */
const pal = $("#palette"), pq = $("#pq"), pl = $("#pl"); let items = [], sel = 0;
function items_() { return [...PAGES.filter((x) => typeof x !== "string").map((x) => ({ k: "Page", t: x[1], go: () => (location.hash = `#/${x[0]}`) })), ...D.convos.map((c) => ({ k: "Guest", t: `${c.name} · ${c.room}`, go: () => { S.convo = c.id; location.hash = "#/inbox"; render(); } })), ...S.requests.map((r) => ({ k: "Request", t: `${r.ask} · room ${r.room}`, go: () => { S.reqFilter = "All"; location.hash = "#/requests"; render(); } }))]; }
function drawPal() { const q = pq.value.toLowerCase(); items = items_().filter((i) => i.t.toLowerCase().includes(q)).slice(0, 9); sel = Math.min(sel, Math.max(0, items.length - 1)); pl.innerHTML = items.map((i, n) => `<li><button class="${n === sel ? "on" : ""}" data-n="${n}"><span class="label" style="width:56px">${i.k}</span>${esc(i.t)}</button></li>`).join("") || '<li class="empty">No matches</li>'; }
const openPal = () => { pal.hidden = false; pq.value = ""; sel = 0; drawPal(); pq.focus(); }, closePal = () => (pal.hidden = true);
$("#openSearch").addEventListener("click", openPal);
pq.addEventListener("input", () => { sel = 0; drawPal(); });
pl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { items[+b.dataset.n].go(); closePal(); } });
pal.addEventListener("click", (e) => { if (e.target === pal) closePal(); });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? openPal() : closePal(); return; }
  if (pal.hidden) return;
  if (e.key === "Escape") closePal();
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); drawPal(); e.preventDefault(); }
  if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); drawPal(); e.preventDefault(); }
  if (e.key === "Enter" && items[sel]) { items[sel].go(); closePal(); }
});

render();
