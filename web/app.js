import * as D from "./data.js";
import { translate } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
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
};
const icon = (n) => `<svg viewBox="0 0 24 24">${ICON[n]}</svg>`;

const PAGES = [
  ["today", "Today", "home"], ["inbox", "Inbox", "chat"], ["requests", "Requests", "tray"], ["guests", "Guests", "users"], ["campaigns", "Campaigns", "megaphone"],
  "Connected", ["opera", "Opera sync", "plug"], ["channels", "Channels", "arrows"], ["brain", "David’s brain", "brain"],
];

/* ---------- state, saved in the browser ---------- */
const KEY = "david-console-v4";
const S = {
  range: "week", assignee: "All", reqFilter: "All", autoReply: true, notesTab: "opera",
  convo: "c1", extra: {}, takeover: {},
  requests: D.requests.map((r) => ({ ...r, log: [{ t: r.opened, kind: "created", text: `Logged by David from ${r.ch}` }, ...(r.to ? [{ t: r.opened, kind: "assigned", text: `Assigned to ${(D.team.find((x) => x.id === r.to) || {}).name}` }] : [])] })), conflict: "open", events: D.events.map((e) => [...e]),
  campaigns: D.campaigns.map((c) => ({ ...c })), rules: { ...D.rulesDefault },
  chans: D.channels.map((c) => ({ ...c, on: true })), knowledge: D.knowledge.map((k) => ({ ...k })),
  conns: D.connections.map((c) => ({ id: c.id, status: c.status, last: c.last })),
  guests: D.guests.map((g) => ({ id: g.id, fields: g.fields.map((x) => ({ ...x })) })),
  guest: "g-elena", fieldsOpen: false, guestQ: "", guestF: "all", connCat: "All", showOpt: false, qa: [], edit: null,
  team: D.team.map((t) => ({ ...t })), autoAssign: { ...D.autoAssignDefault }, zaloOn: true, zaloLog: D.zaloLogSeed.map((z) => ({ ...z })), apiKeys: D.apiKeysSeed.map((k) => ({ ...k })), zaloTab: "people", newKey: null, tellGuest: true,
  guestTpl: { assign: "Hi {guest}, {staff} from {dept} is on this now. I’ll let you know as soon as it’s done.", done: "Hi {guest}, {staff} has taken care of it: {request}. If anything is not right, just tell me." },
  api: { preset: 0, method: "POST", path: "/v1/requests", key: D.apiKeysSeed[0].secret, body: "", res: null },
};
const PERSIST = ["requests", "conflict", "campaigns", "rules", "chans", "knowledge", "conns", "guests", "guest", "qa", "extra", "takeover", "team", "autoAssign", "zaloOn", "zaloLog", "apiKeys", "tellGuest", "guestTpl"];
try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(S, JSON.parse(raw)); } catch { /* private mode: run unsaved */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(PERSIST.map((k) => [k, S[k]])))); } catch { /* ignore */ } };

const G = (id) => D.guests.find((g) => g.id === id) || D.guests[0];
const gFields = (id) => (S.guests.find((x) => x.id === id) || S.guests[0]).fields;
const allFields = () => S.guests.flatMap((g) => g.fields);
const openCount = () => S.requests.filter((r) => r.st !== "done").length;
const needsCount = (id) => gFields(id).filter((f) => f.st !== "ok").length;

function answerFor(q) {
  const s = q.toLowerCase();
  const k = S.knowledge.find((x) => x.answer && (x.keywords || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean).some((w) => s.includes(w)));
  return k ? [k.answer, k.name] : null;
}
if (!S.qa.length) S.qa = ["What time is check-out on Sunday?", "Can I bring my dog?"].map((q) => { const a = answerFor(q); return [q, a ? a[0] : "I don’t have a pet policy on file, so I won’t guess. I’ve asked the front desk and I’ll come back to you.", a ? a[1] : null]; });

const SUB = {
  today: () => `${D.hotel.date} · ${D.hotel.name}`, inbox: () => "Every channel in one place", requests: () => `${openCount()} open · routed by David to each department`,
  guests: () => { const g = G(S.guest); return `${g.room} · ${g.when} · ${g.stays === 1 ? "first stay" : g.stays + " stays"} · OPERA profile ${g.opera}`; },
  campaigns: () => `${S.campaigns.filter((c) => c.on).length} of ${S.campaigns.length} campaigns active · you choose what goes out and when`,
  opera: () => "OPERA Cloud property link · two-way, with a person approving what goes back", channels: () => "Where guests already write, and the numbers David answers from",
  brain: () => `What David is connected to, what he knows about ${D.hotel.name}, and how he behaves`,
};
const TITLE = { guests: () => G(S.guest).name };

const ST = { review: ["review", "Needs review"], pending: ["pend", "Pending"], progress: ["ok", "In progress"], done: ["ok", "Done"] };
const pill = (cls, label, extra = "") => `<span class="pill ${cls}" ${extra}>${esc(label)}</span>`;
const chip = (c) => `<span class="chip ${c === "Messenger" ? "ig" : c === "SMS" ? "sm" : c === "iMessage" ? "im" : ""}">${esc(c)}</span>`;
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
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

/* ---------- campaigns: when, who, what ---------- */
const mins = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const quiet = (t) => { const a = mins(S.rules.quietStart), b = mins(S.rules.quietEnd), x = mins(t); return a > b ? x >= a || x < b : x >= a && x < b; };
function whenText(c) {
  const t = c.time, n = Number(c.days) || 0;
  return { before_arrival: `${plural(n, "day")} before arrival, ${t}`, arrival_day: `Day of arrival, ${t}`, during_stay: `Day ${n} of the stay, ${t}`,
    after_checkout: n === 0 ? `Day of check-out, ${t}` : `${plural(n, "day")} after check-out, ${t}`, after_booking: n === 0 ? `Straight after booking, ${t}` : `${plural(n, "day")} after booking, ${t}`,
    occasion: `${plural(n, "day")} before the occasion, ${t}` }[c.trigger] || t;
}
const jday = (c) => { const n = Number(c.days) || 0; return { before_arrival: -n, arrival_day: 0, during_stay: n, after_checkout: 3 + n, after_booking: -14 + n, occasion: -n }[c.trigger] ?? 0; };
const fill = (txt) => String(txt || "").replace(/\{(\w+)\}/g, (m, k) => D.sampleGuest[k] ?? m);
function campWarnings(d) {
  const w = [];
  if (quiet(d.time)) w.push(`${d.time} is inside quiet hours (${S.rules.quietStart} to ${S.rules.quietEnd}). David will hold it until ${S.rules.quietEnd}.`);
  const unk = [...new Set([...String(d.text || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !D.mergeFields.includes(k)))];
  if (unk.length) w.push(`Unknown field${unk.length > 1 ? "s" : ""}: {${unk.join("}, {")}}. Use the buttons to insert a real one.`);
  if (d.channel === "sms" && fill(d.text).length > 160) w.push("This is over 160 characters, so SMS will send it as more than one text.");
  return w;
}
function journey() {
  const list = S.campaigns.slice().sort((a, b) => jday(a) - jday(b));
  const warp = (d) => (d > 10 ? 10 + (d - 10) * 0.12 : d < -14 ? -14 + (d + 14) * 0.12 : d);
  const ds = list.map((c) => warp(jday(c))), min = Math.min(-4, ...ds) - 0.5, max = Math.max(5, ...ds) + 0.5, pct = (d) => ((warp(d) - min) / (max - min)) * 100;
  return `<div class="jr"><div class="jline"></div><div class="jstay" style="left:${pct(0)}%;width:${pct(3) - pct(0)}%"></div>
  <span class="jmark" style="left:${pct(0)}%">Arrival</span><span class="jmark" style="left:${pct(3)}%">Check-out</span>
  ${list.map((c, i) => `<button class="jd ${c.on ? "" : "off"}" style="left:${pct(jday(c))}%" data-a="editCamp" data-id="${c.id}" title="${esc(c.name)} · ${esc(whenText(c))}"><i></i><span class="${i % 2 ? "dn" : "up"}">${esc(c.name)}</span></button>`).join("")}</div>`;
}

/* ---------- views ---------- */
function requestRows(list, compact) {
  return list.map((r) => `<tr class="click" data-a="openReq" data-id="${r.id}" tabindex="0"><td>${esc(r.dept)}</td><td class="num">${esc(r.room)}</td><td class="ask"><b>${esc(r.ask)}</b><span class="small">${esc(r.guest)}</span></td><td>${chip(r.ch)}</td>${compact ? "" : `<td class="mono">${r.opened}</td><td>${assignCell(r)}</td>`}<td><button class="pill ${ST[r.st][0]}" data-a="cycle" data-id="${r.id}" title="Click to move this request along">${ST[r.st][1]}</button></td></tr>`).join("");
}
const reqTable = (list, compact = false) => `<table class="t"><thead><tr><th>Department</th><th>Room</th><th>Request</th><th>Channel</th>${compact ? "" : "<th>Opened</th><th>Assigned</th>"}<th>Status</th></tr></thead><tbody>${requestRows(list, compact)}</tbody></table>`;

function today() {
  const R = D.ranges[S.range], open = openCount(), list = S.requests.filter((r) => S.assignee === "All" || S.assignee === (r.to || "none")).filter((r) => r.st !== "done").slice(0, 6);
  const kpi = ([l, v, d, bad, n]) => `<div class="card kpi"><span class="label">${l}</span><b>${v}</b><span class="delta ${bad ? "bad" : ""}">${d}</span><span class="small">${n}</span></div>`;
  const notes = { opera: [["Allergy", "Shellfish"], ["Room", "High floor"], ["Occasion", "Anniversary, 3 Nov"]], david: [["Pillows", "Two firm, told David in March"], ["Dinner", "Vegetarian, noticed from three orders"], ["Contact", "Prefers WhatsApp"]], staff: [["Front desk", "Upgrade offered on arrival"], ["Concierge", "Booked Tuesday dinner, 7:30 pm"]] }[S.notesTab];
  return `
  <div class="toolbar">
    <div class="seg" role="group" aria-label="Range">${Object.entries(D.ranges).map(([k, r]) => `<button class="${S.range === k ? "on" : ""}" data-a="range" data-v="${k}">${r.label}</button>`).join("")}</div>
    ${assigneeSelect()}
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
  const list = S.requests.filter((r) => (S.reqFilter === "All" || r.dept === S.reqFilter) && (S.assignee === "All" || S.assignee === (r.to || "none")));
  return `<div class="toolbar"><div style="display:flex;gap:8px;flex-wrap:wrap">${depts.map((d) => `<button class="btn sm ${S.reqFilter === d ? "primary" : ""}" style="border-radius:999px" data-a="dept" data-v="${d}">${d} ${d === "All" ? S.requests.length : S.requests.filter((r) => r.dept === d).length}</button>`).join("")}</div><span class="sp"></span><span class="small" style="color:var(--ink)">Tell guests automatically</span><button class="switch" role="switch" aria-checked="${S.tellGuest}" data-a="tellGuest" aria-label="Tell guests automatically"></button>${assigneeSelect()}</div>
  <div class="card">${list.length ? reqTable(list) : '<div class="empty">No requests match.</div>'}</div>`;
}

/* guests: collapsible fields on top, every guest below */
function dirRows() {
  const q = S.guestQ.trim().toLowerCase();
  const list = D.guests.filter((g) => (S.guestF === "all" || g.status === S.guestF) && (!q || `${g.name} ${g.room}`.toLowerCase().includes(q)));
  if (!list.length) return '<tr><td colspan="7" class="empty">No guests match.</td></tr>';
  const stPill = { arriving: pill("pend", "Arriving"), inhouse: pill("ok", "In house"), departing: '<span class="chip im">Departing</span>' };
  return list.map((g) => { const n = needsCount(g.id); return `<tr class="${g.id === S.guest ? "sel" : ""}" data-a="pickGuest" data-id="${g.id}" tabindex="0"><td><div class="nm"><span class="avatar">${initials(g.name)}</span><div><div>${esc(g.name)}</div><div class="small">${esc(g.room)}</div></div></div></td><td>${stPill[g.status]}<div class="small" style="margin-top:3px">${esc(g.when)}</div></td><td>${g.tier}<div class="small">${g.stays === 1 ? "First stay" : g.stays + " stays"}</div></td><td><div style="display:flex;gap:4px;flex-wrap:wrap">${g.ch.map(chip).join("")}</div></td><td class="mono">${esc(g.phone)}</td><td>${n ? pill("review", n + " need you") : pill("ok", "All synced")}</td><td>${g.conv ? `<button class="btn sm" data-a="openChat" data-id="${g.conv}">Open chat</button>` : ""}</td></tr>`; }).join("");
}
function guests() {
  const g = G(S.guest), order = { review: 0, pend: 1, ok: 2 };
  const sorted = gFields(g.id).map((f, i) => [f, i]).sort((a, b) => order[a[0].st] - order[b[0].st] || a[1] - b[1]).map((x) => x[0]);
  const shown = S.fieldsOpen ? sorted : sorted.slice(0, 2), pending = sorted.filter((f) => f.st !== "ok").length, hidden = sorted.length - shown.length;
  const counts = { all: D.guests.length, arriving: 0, inhouse: 0, departing: 0 }; D.guests.forEach((x) => counts[x.status]++);
  return `<div class="card"><div class="hd"><div><h2>Opera and David, field by field</h2><div class="small sub">${esc(g.name)} · Opera stays the record. David adds what guests tell him and proposes it back for your approval.</div></div><div style="display:flex;gap:10px"><button class="btn" data-a="review">Review ${pending} write-back${pending === 1 ? "" : "s"}</button><button class="btn primary" data-a="approveAll" ${pending ? "" : "disabled"}>Approve all</button></div></div>
  <table class="t"><thead><tr><th>Field</th><th>In Opera</th><th>What David knows</th><th>Direction</th><th>Status</th></tr></thead><tbody>${shown.map((f) => `<tr><td>${esc(f.field)}${f.tip ? ` <span class="small" title="${esc(f.tip)}" style="cursor:help;border:1px solid var(--rule);border-radius:50%;padding:0 5px;font-size:11px">i</span>` : ""}</td><td style="${f.opera ? "" : "color:var(--mute)"}">${esc(f.opera || "Not recorded")}</td><td>${esc(f.david)}</td><td class="mono">${f.dir}</td><td style="display:flex;gap:8px;align-items:center">${pill(f.st, f.label)}${f.st !== "ok" ? `<button class="btn sm" data-a="approve" data-id="${f.id}">Approve</button>` : ""}</td></tr>`).join("")}</tbody></table>
  ${sorted.length > 2 ? `<button class="more" data-a="fields" aria-expanded="${S.fieldsOpen}">${S.fieldsOpen ? "Show fewer fields" : `Show ${hidden} more field${hidden === 1 ? "" : "s"}`}</button>` : ""}</div>
  <div class="card"><div class="pad" style="grid-auto-flow:column;justify-content:start;gap:12px"><span style="color:var(--green)" class="nav" aria-hidden="true">${icon("brain")}</span><p>David will only write something into Opera after a person approves it. Allergies and the guest’s own words outrank anything David inferred, and a conflict stays flagged until staff decide.</p></div></div>
  <div class="card"><div class="hd"><div><h2>All guests</h2><div class="small sub">${D.guests.length} guests · click a row to see their fields above</div></div><input class="search2" id="gq" placeholder="Search name or room" value="${esc(S.guestQ)}" autocomplete="off"></div>
  <div class="cats" style="padding-top:0">${[["all", "All"], ["arriving", "Arriving"], ["inhouse", "In house"], ["departing", "Departing"]].map(([k, l]) => `<button class="btn sm ${S.guestF === k ? "primary" : ""}" style="border-radius:999px" data-a="gfilter" data-v="${k}">${l} ${counts[k]}</button>`).join("")}</div>
  <table class="t dir"><thead><tr><th>Guest</th><th>Status</th><th>Loyalty</th><th>Channels</th><th>Mobile</th><th>Write-backs</th><th></th></tr></thead><tbody id="gdir">${dirRows()}</tbody></table></div>`;
}

function campaigns() {
  const list = S.campaigns.slice().sort((a, b) => jday(a) - jday(b));
  const next = (c) => `Next: tomorrow at ${c.time} · about ${D.audiences[c.audience][1]} guests`;
  return `<div class="toolbar"><span class="small">Every campaign is yours to change. Click one to edit when it launches, who gets it and what it says.</span><span class="sp"></span><button class="btn primary" data-a="newCamp">+ New campaign</button></div>
  <div class="card"><div class="hd"><div><h2>Guest journey</h2><div class="small sub">Where each campaign lands in a stay · click a dot to edit it</div></div></div><div class="bd">${journey()}</div></div>
  <div class="row cards3" style="grid-template-columns:repeat(3,1fr)">${list.map((c) => `<div class="card pad"><div style="display:flex;justify-content:space-between;align-items:start;gap:8px"><span class="label">${D.triggers[c.trigger].label}</span>${quiet(c.time) ? `<span title="Inside quiet hours: David will hold it" class="small" style="color:var(--clay)">quiet hours</span>` : ""}</div><h2>${esc(c.name)}</h2><span class="mono" style="color:var(--green)">${esc(whenText(c))}</span><p class="small clamp" style="color:var(--ink);min-height:62px">${esc(c.text)}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${chip(D.channelChoices[c.channel].replace("Guest’s preferred channel", "Preferred channel"))}<span class="chip im">${esc(D.audiences[c.audience][0])}</span></div><span class="small">${c.on ? next(c) : "Paused: nothing is sent"}</span><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${pill(c.on ? "ok" : "pend", c.on ? "Active" : "Paused")}<div style="display:flex;gap:10px;align-items:center"><button class="btn sm" data-a="editCamp" data-id="${c.id}">Edit</button><button class="switch" role="switch" aria-checked="${c.on}" data-a="camp" data-id="${c.id}" aria-label="${esc(c.name)} active"></button></div></div></div>`).join("")}
  <button class="card pad" data-a="newCamp" style="border-style:dashed;place-items:center;align-content:center;color:var(--green);font-weight:700;cursor:pointer;min-height:260px"><span style="font-size:28px">+</span>New campaign</button></div>
  <div class="card"><div class="hd"><div><h2>Sending rules</h2><div class="small sub">These apply to every campaign. Change them here and the warnings update.</div></div></div><div class="bd"><div class="row" style="grid-template-columns:repeat(3,1fr)"><label class="fld"><span class="label">Quiet hours start</span><input type="time" data-r="quietStart" value="${S.rules.quietStart}"></label><label class="fld"><span class="label">Quiet hours end</span><input type="time" data-r="quietEnd" value="${S.rules.quietEnd}"></label><label class="fld"><span class="label">Most campaign texts per guest per day</span><select data-r="perDay">${[1, 2, 3].map((n) => `<option ${S.rules.perDay === n ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
  <div class="row" style="grid-template-columns:repeat(3,1fr);margin-top:12px">${["Only guests who have said yes to texts", "STOP is honoured immediately and permanently", "Nothing invented: only what is on your menu and policies"].map((r) => `<div class="check" style="border:0;padding:0"><svg viewBox="0 0 24 24">${ICON.check}</svg><span>${r} <span class="small">(always on)</span></span></div>`).join("")}</div></div></div>`;
}

function opera() {
  const review = S.conflict === "open", pend = allFields().filter((f) => f.st !== "ok").length, ok = allFields().filter((f) => f.st === "ok").length;
  const k = ([l, v, n]) => `<div class="card kpi"><span class="label">${l}</span><b>${v}</b><span class="small">${n}</span></div>`;
  return `<div class="row cards4">${[["Profiles linked", "3,284", "98.6% matched to a phone number"], ["Events today", (1942 + S.events.length - 6).toLocaleString(), "From Opera’s event stream"], ["Write-backs this week", String(100 + ok), `${pend} awaiting approval`], ["Conflicts", review ? "2" : "1", "Staff decide, nothing auto-overwrites"]].map(k).join("")}</div>
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

/* brain: connections, what David knows, try him */
function connState(c) {
  if (c.chan) { const ch = S.chans.find((x) => x.id === c.chan); return { status: ch && ch.on ? "connected" : "paused", last: ch && ch.on ? `${ch.n} messages today` : "David paused here" }; }
  return S.conns.find((x) => x.id === c.id);
}
function brain() {
  const pool = D.connections.filter((c) => c.group === "core" || S.showOpt), optN = D.connections.filter((c) => c.group === "optional").length;
  const cats = ["All", ...new Set(pool.map((c) => c.cat))], st = D.connections.map(connState);
  if (!cats.includes(S.connCat)) S.connCat = "All";
  const n = (s) => st.filter((x) => x.status === s).length;
  const list = pool.filter((c) => S.connCat === "All" || c.cat === S.connCat);
  const card = (c) => {
    const s = connState(c), pl = { connected: pill("ok", "Connected"), available: '<span class="pill none">Not connected</span>', attention: pill("review", "Needs attention"), paused: pill("pend", "David paused") }[s.status];
    const btn = c.chan ? `<a class="btn sm" href="#/channels">Open channels</a>` : `<button class="btn sm ${s.status === "available" ? "primary" : ""}" data-a="editConn" data-id="${c.id}">${{ connected: "Manage", available: "Connect", attention: "Fix" }[s.status]}</button>`;
    return `<div class="conn ${s.status === "attention" ? "attention" : ""}"><div><span class="label">${c.cat}</span><h2 style="margin-top:2px">${esc(c.name)}</h2></div><p class="small" style="min-height:54px;color:var(--ink)">${esc(c.desc)}</p><div class="small mono">${esc(s.last || "Not set up")}</div><div class="foot">${pl}${btn}</div></div>`;
  };
  return `<div class="card"><div class="hd"><div><h2>Connections</h2><div class="small sub">Opera is the hotel’s system of record, so most of what David knows comes through it. These are the other things he connects to. Demo only: connecting here changes this page, not a real system.</div></div></div>
  <div class="bd" style="padding-bottom:16px"><div class="note"><span class="label" style="color:var(--green)">Comes through Opera, no separate connection</span><div class="row" style="grid-template-columns:repeat(3,1fr);gap:12px 24px;margin-top:6px">${D.viaOpera.map(([a, dir, d]) => `<div><div style="display:flex;gap:8px;align-items:center"><span>${a}</span><span class="chip im">${dir}</span></div><div class="small" style="color:var(--ink)">${d}</div></div>`).join("")}</div><span class="small">What Opera can share depends on the modules your property uses and what Oracle has enabled for it. Check this with your Opera administrator.</span></div></div>
  <div class="cats">${cats.map((k) => `<button class="btn sm ${S.connCat === k ? "primary" : ""}" style="border-radius:999px" data-a="connCat" data-v="${k}">${k}</button>`).join("")}</div><div class="conns">${list.map(card).join("")}</div>
  <div style="padding:0 20px 20px;display:flex;gap:12px;align-items:center"><button class="btn sm" data-a="showOpt">${S.showOpt ? "Hide" : "Show"} ${optN} optional connections</button><span class="small">Only needed if you want David to read menus, book tables or post reviews outside Opera. ${n("connected") + n("paused")} connected · ${n("attention")} need attention.</span></div></div>
  ${teamCard()}
  <div class="row" style="grid-template-columns:1fr 460px">
  <div class="card"><div class="hd"><div><h2>What David knows</h2><div class="small sub">He answers only from these. If it isn’t here, he says so and asks a person.</div></div><button class="btn primary" data-a="newKnow">+ Add knowledge</button></div><div class="list">${S.knowledge.map((k) => `<div style="align-items:center"><span class="avatar" style="border-radius:8px">${icon("check").replace("<svg", '<svg width="18" height="18" fill="none" stroke="#1D4A3F" stroke-width="1.8" stroke-linecap="round"')}</span><div class="grow"><div>${esc(k.name)}</div><div class="small">${esc(k.detail)}</div></div><div style="text-align:right">${pill(k.st, k.src)}<div class="small" style="margin-top:3px">${esc(k.when)}</div></div><button class="btn sm" data-a="editKnow" data-id="${k.id}">Edit</button></div>`).join("")}</div></div>
  <div style="display:grid;gap:20px"><div class="card pad"><h2>Try David</h2>${S.qa.map(([q, a, s]) => `<div class="q">${esc(q)}</div><div class="a">${esc(a)}</div><div>${s ? pill("ok", "Answered from " + s) : pill("review", "No source · handed to a person")}</div>`).join("")}<form class="try" data-a="ask"><input id="ask" placeholder="Ask David something a guest might ask" autocomplete="off"><button class="btn primary">Ask</button></form><div class="small">Try: breakfast, parking, wifi, “can I bring my cat”</div></div>
  <div class="card pad"><h2>How he behaves</h2>${["Complaints and emergencies go straight to the duty manager", "Remembered habits are offered as a question, never assumed", "Allergies travel with every food order to the kitchen"].map((t) => `<div class="check"><svg viewBox="0 0 24 24">${ICON.check}</svg><span>${t}</span></div>`).join("")}</div></div></div>`;
}

const V = { today, inbox, requests, guests, campaigns, opera, channels, brain };

/* ---------- editor drawer: campaigns, knowledge, connections ---------- */
const fld = (label, inner, hint = "") => `<label class="fld"><span class="label">${label}</span>${inner}${hint ? `<span class="small">${hint}</span>` : ""}</label>`;
const opts = (obj, cur, lab = (v) => v) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(lab(v))}</option>`).join("");

function campaignForm(e) {
  const d = e.data, tr = D.triggers[d.trigger];
  return `<div class="dh"><h2>${e.isNew ? "New campaign" : "Edit campaign"}</h2><button class="icon-btn" data-a="closeEdit" aria-label="Close">✕</button></div>
  <div class="db">
    ${fld("Name", `<input data-f="name" value="${esc(d.name)}" placeholder="e.g. Welcome drink offer" autocomplete="off">`)}
    <div class="grp"><span class="label">When it launches</span>
      <div class="two">${fld("Moment in the stay", `<select data-f="trigger">${opts(D.triggers, d.trigger, (v) => v.label)}</select>`)}${d.trigger === "arrival_day" ? fld("Day", `<input value="Day of arrival" disabled>`) : fld(esc(tr.unit.replace(/^days? /, "Days ") || "Days"), `<input type="number" min="0" max="365" data-f="days" value="${d.days}">`)}</div>
      ${fld("Time of day", `<input type="time" data-f="time" value="${d.time}">`)}
      <div class="okmsg" id="cwhen"></div></div>
    <div class="grp"><span class="label">Who gets it</span><div class="two">${fld("Guests", `<select data-f="audience">${opts(D.audiences, d.audience, (v) => `${v[0]} (about ${v[1]})`)}</select>`)}${fld("Channel", `<select data-f="channel">${opts(D.channelChoices, d.channel)}</select>`)}</div></div>
    <div class="grp"><span class="label">What it says</span>
      <div class="seg" role="group" style="justify-self:start"><button class="${d.mode === "david" ? "on" : ""}" data-a="cmode" data-v="david">David writes it</button><button class="${d.mode === "exact" ? "on" : ""}" data-a="cmode" data-v="exact">My exact words</button></div>
      <p class="small">${d.mode === "david" ? "David rewrites this in his own words for each guest, using what he remembers about them. Treat it as a brief." : "David sends this word for word."}</p>
      <textarea class="input" id="ctext" data-f="text" style="min-height:120px" placeholder="Write the message. Insert guest details with the buttons below.">${esc(d.text)}</textarea>
      <div class="chips" aria-label="Insert a guest detail">${D.mergeFields.map((m) => `<button type="button" data-a="merge" data-v="${m}">{${m}}</button>`).join("")}</div>
      <div><span class="label">Preview for Elena Vasquez</span><div class="bubble" id="cprev" style="max-width:none;margin-top:8px"></div></div>
      <div id="cwarn"></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span>Active</span><button class="switch" type="button" role="switch" aria-checked="${d.on}" data-a="cswitch" aria-label="Active"></button></div>
    <div class="errmsg" id="cerr" role="alert"></div>
  </div>
  <div class="df"><button class="btn primary" data-a="saveCamp">${e.isNew ? "Create campaign" : "Save changes"}</button><button class="btn" data-a="closeEdit">Cancel</button><span class="sp"></span><button class="btn" data-a="testCamp" title="Send a preview to your own phone">Send me a test</button>${e.isNew ? "" : `<button class="btn" data-a="dupCamp">Duplicate</button><button class="btn danger" data-a="delCamp">${e.confirm ? "Click again to delete" : "Delete"}</button>`}</div>`;
}
function updateCampLive() {
  const e = S.edit; if (!e || e.type !== "camp") return; const d = e.data;
  const p = $("#cprev"); if (p) p.textContent = fill(d.text) || "Your message appears here";
  const w = $("#cwhen"); if (w) w.textContent = `Goes out: ${whenText({ ...d, days: Number(d.days) || 0 })}`;
  const x = $("#cwarn"); if (x) x.innerHTML = campWarnings(d).map((m) => `<div class="warn" style="margin-top:8px">${esc(m)}</div>`).join("");
}
function knowForm(e) {
  const d = e.data;
  return `<div class="dh"><h2>${e.isNew ? "Add knowledge" : "Edit knowledge"}</h2><button class="icon-btn" data-a="closeEdit" aria-label="Close">✕</button></div>
  <div class="db">
    ${fld("Title", `<input data-f="name" value="${esc(d.name)}" placeholder="e.g. Pool and spa hours" autocomplete="off">`)}
    ${fld("What it covers", `<input data-f="detail" value="${esc(d.detail)}" placeholder="A short description staff will see" autocomplete="off">`)}
    ${fld("What David says", `<textarea data-f="answer" placeholder="The answer David gives a guest. Only say what is true.">${esc(d.answer)}</textarea>`, "David answers with exactly this, and names this entry as his source.")}
    ${fld("Words that trigger it", `<input data-f="keywords" value="${esc(d.keywords)}" placeholder="pool, spa, swim, sauna" autocomplete="off">`, "Comma separated. If a guest’s message contains any of these, David uses this answer.")}
    <div class="errmsg" id="cerr" role="alert"></div>
  </div>
  <div class="df"><button class="btn primary" data-a="saveKnow">${e.isNew ? "Add" : "Save changes"}</button><button class="btn" data-a="closeEdit">Cancel</button><span class="sp"></span>${e.isNew ? "" : `<button class="btn danger" data-a="delKnow">${e.confirm ? "Click again to delete" : "Delete"}</button>`}</div>`;
}
function connForm(e) {
  const c = D.connections.find((x) => x.id === e.id), st = S.conns.find((x) => x.id === e.id), d = e.data;
  const t = e.test;
  return `<div class="dh"><h2>${st.status === "connected" ? "Manage" : "Connect"} ${esc(c.name)}</h2><button class="icon-btn" data-a="closeEdit" aria-label="Close">✕</button></div>
  <div class="db"><p>${esc(c.desc)}</p>${st.status === "attention" ? `<div class="warn">${esc(st.last)}. Sign in again to restore it.</div>` : ""}
    ${c.fields.map(([label, ph, secret], i) => fld(label, `<input data-f="f${i}" type="${secret ? "password" : "text"}" value="${esc(d["f" + i] ?? "")}" placeholder="${esc(ph || "")}" autocomplete="off">`)).join("")}
    ${t === "running" ? '<div class="okmsg">Testing the connection…</div>' : t === "ok" ? `<div class="okmsg">Connection works. David could reach ${esc(c.name)}.</div>` : t === "fail" ? '<div class="warn">Could not connect. Fill in every field and try again.</div>' : ""}
    <p class="small">Demo only: this page records that it is connected, but nothing is sent anywhere. A real connection stores these keys on the David server, never in the browser.</p></div>
  <div class="df"><button class="btn primary" data-a="saveConn">${st.status === "connected" ? "Save" : "Connect"}</button><button class="btn" data-a="testConn">Test connection</button><span class="sp"></span>${st.status === "available" ? "" : `<button class="btn danger" data-a="discConn">Disconnect</button>`}</div>`;
}
function drawer() {
  const e = S.edit, el = $("#drawer"), sc = $("#scrim");
  if (!e) { el.hidden = true; sc.hidden = true; return; }
  el.hidden = false; sc.hidden = false;
  el.innerHTML = e.type === "camp" ? campaignForm(e) : e.type === "know" ? knowForm(e) : e.type === "staff" ? staffForm(e) : e.type === "req" ? reqForm(e) : connForm(e);
  if (e.type === "camp") updateCampLive(); if (e.type === "staff") updateStaffLive(); if (e.type === "req") updateReqLive();
}
const closeEdit = () => { S.edit = null; drawer(); };

/* ---------- shell ---------- */
function route() { const p = location.hash.replace(/^#\//, "") || "today"; return V[p] ? p : "today"; }
function renderNav(p) {
  $("#nav").innerHTML = PAGES.map((x) => typeof x === "string" ? `<div class="label nav-sec">${x}</div>` : `<a href="#/${x[0]}" class="${x[0] === p ? "on" : ""}" ${x[0] === p ? 'aria-current="page"' : ""}>${icon(x[2])}${x[1]}${x[0] === "inbox" ? `<span class="count">${D.convos.filter((c) => c.unread).length + 11}</span>` : x[0] === "requests" ? `<span class="count">${openCount()}</span>` : ""}</a>`).join("");
}
function render() {
  const p = route(), view = $("#view");
  renderNav(p); const t = TITLE[p] ? TITLE[p]() : PAGES.find((x) => x[0] === p)[1];
  $("#title").textContent = t; $("#sub").textContent = SUB[p](); document.title = `${t} · David`;
  view.className = "view" + (p === "inbox" ? " flush" : ""); view.innerHTML = V[p]();
  const m = $("#msgs"); if (m) m.scrollTop = m.scrollHeight;
  save();
}
$("#hotel").textContent = D.hotel.name;
$("#reset").addEventListener("click", () => { if (confirm(loc("Clear every change you have made and start again?"))) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } location.reload(); } });

/* ---------- actions ---------- */
const next = { review: "progress", pending: "progress", progress: "done", done: "pending" };
const blankCamp = () => ({ id: "k" + Date.now(), name: "", trigger: "before_arrival", days: 1, time: "10:00", audience: "all", channel: "best", mode: "david", on: true, text: "" });
const A = {
  range: (t) => (S.range = t.dataset.v), assignee: (t) => (S.assignee = t.value), auto: () => { S.autoReply = !S.autoReply; toast(S.autoReply ? "David is replying automatically" : "David paused: replies wait for staff"); },
  notes: (t) => (S.notesTab = t.dataset.v), dept: (t) => (S.reqFilter = t.dataset.v),
  cycle: (t) => { const r = S.requests.find((x) => x.id === t.dataset.id), told = setStatus(r, next[r.st], S.tellGuest); toast(`${r.dept} · room ${r.room}: ${ST[r.st][1].toLowerCase()}${told ? ". Guest told" : ""}`); },
  convo: (t) => { S.convo = t.dataset.id; D.convos.find((c) => c.id === t.dataset.id).unread = false; },
  takeover: () => { const id = S.convo; S.takeover[id] = !S.takeover[id]; (S.extra[id] ||= []).push(["sys", S.takeover[id] ? "Maya took over from David" : "Handed back to David"]); },
  /* guests */
  fields: () => (S.fieldsOpen = !S.fieldsOpen),
  pickGuest: (t) => { S.guest = t.dataset.id; S.fieldsOpen = false; window.scrollTo({ top: 0, behavior: "smooth" }); },
  gfilter: (t) => (S.guestF = t.dataset.v),
  openChat: (t, e) => { e.stopPropagation(); S.convo = t.dataset.id; D.convos.find((c) => c.id === t.dataset.id).unread = false; location.hash = "#/inbox"; },
  approve: (t) => { const f = gFields(S.guest).find((x) => x.id === t.dataset.id); f.st = "ok"; f.label = "Synced"; toast(`${f.field} approved and written to Opera`); },
  approveAll: () => { gFields(S.guest).forEach((f) => { f.st = "ok"; f.label = "Synced"; }); toast(`${G(S.guest).name}: all write-backs approved and sent to Opera`); },
  review: () => toast(`${needsCount(S.guest)} field${needsCount(S.guest) === 1 ? " is" : "s are"} waiting for you`),
  /* campaigns */
  camp: (t) => { const c = S.campaigns.find((x) => x.id === t.dataset.id); c.on = !c.on; toast(`${c.name}: ${c.on ? "active" : "paused"}`); },
  newCamp: () => { S.edit = { type: "camp", isNew: true, data: blankCamp() }; },
  editCamp: (t) => { S.edit = { type: "camp", isNew: false, data: { ...S.campaigns.find((x) => x.id === t.dataset.id) } }; },
  cmode: (t) => { S.edit.data.mode = t.dataset.v; },
  cswitch: () => { S.edit.data.on = !S.edit.data.on; },
  merge: (t) => { const ta = $("#ctext"), d = S.edit.data, ins = `{${t.dataset.v}}`, a = ta.selectionStart ?? d.text.length, b = ta.selectionEnd ?? a; d.text = d.text.slice(0, a) + ins + d.text.slice(b); S.edit.caret = a + ins.length; },
  closeEdit: () => (S.edit = null),
  testCamp: () => toast("Sent a test to Maya’s phone (demo)"),
  dupCamp: () => { const d = { ...S.edit.data, id: "k" + Date.now(), name: S.edit.data.name + " (copy)", on: false }; S.edit = { type: "camp", isNew: true, data: d }; toast("Duplicated. Change it and create it."); },
  delCamp: () => { if (!S.edit.confirm) { S.edit.confirm = true; return; } const n = S.edit.data.name; S.campaigns = S.campaigns.filter((x) => x.id !== S.edit.data.id); S.edit = null; toast(`Deleted “${n}”`); },
  saveCamp: () => {
    const d = S.edit.data, err = [];
    if (!d.name.trim()) err.push("Give the campaign a name."); if (!d.text.trim()) err.push("Write the message."); const n = Number(d.days);
    if (d.trigger !== "arrival_day" && (!Number.isInteger(n) || n < 0 || n > 365)) err.push("Days must be a whole number from 0 to 365."); if (!d.time) err.push("Choose a time of day.");
    if (err.length) { S.edit.error = err.join(" "); return; }
    d.name = d.name.trim(); d.text = d.text.trim(); d.days = d.trigger === "arrival_day" ? 0 : n;
    if (S.edit.isNew) S.campaigns.push(d); else S.campaigns = S.campaigns.map((x) => (x.id === d.id ? d : x));
    S.edit = null; toast(`${d.name}: ${S.campaigns.find((x) => x.id === d.id).on ? "will go out " + whenText(d).toLowerCase() : "saved, paused"}`);
  },
  /* channels, opera */
  chan: (t) => { const c = S.chans.find((x) => x.id === t.dataset.id); c.on = !c.on; toast(`David ${c.on ? "answers" : "stopped answering"} on ${c.name}`); },
  resolve: (t) => { S.conflict = t.dataset.v; S.events.unshift([now(), "→", "PROFILE UPDATE", "Bell · mobile resolved", "ok", "Queued"]); toast(t.dataset.v); },
  /* brain */
  connCat: (t) => (S.connCat = t.dataset.v),
  showOpt: () => (S.showOpt = !S.showOpt),
  editConn: (t) => { const c = D.connections.find((x) => x.id === t.dataset.id), data = {}; c.fields.forEach(([l, ph, secret], i) => { if (!secret && ph && S.conns.find((x) => x.id === c.id).status === "connected") data["f" + i] = ph; }); S.edit = { type: "conn", id: c.id, data, test: null }; },
  testConn: () => { const e = S.edit, c = D.connections.find((x) => x.id === e.id); e.test = "running"; setTimeout(() => { if (S.edit === e) { const st = S.conns.find((x) => x.id === e.id).status === "connected"; e.test = c.fields.every((_, i) => String(e.data["f" + i] || "").trim()) || st ? "ok" : "fail"; drawer(); } }, 900); },
  saveConn: () => { const e = S.edit, c = D.connections.find((x) => x.id === e.id), st = S.conns.find((x) => x.id === e.id); const filled = c.fields.every((_, i) => String(e.data["f" + i] || "").trim()); if (st.status !== "connected" && !filled) { e.test = "fail"; return; } st.status = "connected"; st.last = "Just connected"; S.edit = null; toast(`${c.name} connected (demo)`); },
  discConn: () => { const e = S.edit, st = S.conns.find((x) => x.id === e.id); st.status = "available"; st.last = ""; S.edit = null; toast(`${D.connections.find((x) => x.id === e.id).name} disconnected`); },
  newKnow: () => { S.edit = { type: "know", isNew: true, data: { id: "n" + Date.now(), name: "", detail: "", answer: "", keywords: "", src: "Written by staff", st: "pend", when: "Just now" } }; },
  editKnow: (t) => { S.edit = { type: "know", isNew: false, data: { ...S.knowledge.find((x) => x.id === t.dataset.id) } }; },
  saveKnow: () => { const d = S.edit.data; if (!d.name.trim()) { S.edit.error = "Give it a title."; return; } d.name = d.name.trim(); d.when = S.edit.isNew ? "Just now" : "Edited just now"; if (S.edit.isNew) S.knowledge.push(d); else S.knowledge = S.knowledge.map((x) => (x.id === d.id ? d : x)); S.edit = null; toast(`David now knows: ${d.name}`); },
  delKnow: () => { if (!S.edit.confirm) { S.edit.confirm = true; return; } const n = S.edit.data.name; S.knowledge = S.knowledge.filter((x) => x.id !== S.edit.data.id); S.edit = null; toast(`Removed “${n}”`); },
};
/* ---------- team, Zalo and the API ---------- */
const T = (id) => S.team.find((x) => x.id === id);
const firstName = (n) => n.split(" ")[0];
const fmtPhone = (p) => { const m = String(p || "").match(/^\+84(\d{2})(\d{3})(\d{4})$/); return m ? `+84 ${m[1]} ${m[2]} ${m[3]}` : p || "No number"; };
function normPhone(raw) { let s = String(raw || "").replace(/[\s().-]/g, ""); if (s.startsWith("00")) s = "+" + s.slice(2); if (s.startsWith("0")) s = "+84" + s.slice(1); else if (/^84\d/.test(s)) s = "+" + s; return /^\+84\d{9}$/.test(s) ? s : null; }
const zchip = (e) => (!e ? "" : e.zalo && e.consent ? `<span class="zchip" title="Zalo ${fmtPhone(e.zalo)}">Zalo</span>` : `<span class="zchip bad" title="${!e.zalo ? "No Zalo number on the profile" : "No consent to Zalo messages"}">No Zalo</span>`);
const assignCell = (r) => `<div style="display:flex;gap:8px;align-items:center"><select class="sel" data-a="assign" data-id="${r.id}" aria-label="Assign this request" style="padding:5px 28px 5px 10px;font-size:13px"><option value="">Unassigned</option>${S.team.map((t) => `<option value="${t.id}" ${t.id === r.to ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>${zchip(T(r.to))}</div>`;
const assigneeSelect = () => `<select class="sel" data-a="assignee" aria-label="Assigned to"><option value="All" ${S.assignee === "All" ? "selected" : ""}>All people</option><option value="none" ${S.assignee === "none" ? "selected" : ""}>Unassigned</option>${S.team.map((t) => `<option value="${t.id}" ${t.id === S.assignee ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>`;
const openTasks = (id) => S.requests.filter((r) => r.to === id && r.st !== "done").length;

const zaloText = (r, e) => `Task for ${firstName(e.name)}: ${r.dept}, room ${r.room}. ${r.ask}${r.guest ? ` (guest: ${r.guest})` : ""}. Reply DONE when finished.`;
function zaloSend(req, emp, kind = "assignment") {
  const text = kind === "test" ? `Test from David for ${firstName(emp.name)}: this is how task alerts will look. No action needed.` : zaloText(req, emp);
  const connected = S.conns.find((c) => c.id === "zalo").status === "connected";
  let status = "queued", reason = "";
  if (!emp.zalo) { status = "failed"; reason = "No Zalo number on this profile"; }
  else if (!emp.consent) { status = "failed"; reason = "Employee has not agreed to Zalo messages"; }
  else if (!connected) { status = "failed"; reason = "Zalo is not connected"; }
  const entry = { id: "z" + Date.now() + Math.floor(Math.random() * 90 + 10), time: now().slice(0, 5), to: emp.name, phone: emp.zalo || "", req: req ? req.id : null, text, status, reason, kind };
  S.zaloLog.unshift(entry);
  if (status === "queued") setTimeout(() => { entry.status = "delivered"; save(); const a = document.activeElement; if (!(a && a.closest && a.closest("#view textarea, #view input"))) render(); }, 1200);
  return entry;
}
const log = (r, kind, text) => (r.log ||= []).push({ t: now().slice(0, 5), kind, text });
const fillGuest = (tpl, r) => { const e = T(r.to); return String(tpl).replace(/\{(\w+)\}/g, (m, k) => ({ guest: r.guest ? firstName(r.guest) : "there", staff: e ? firstName(e.name) : "the team", dept: r.dept, request: r.ask, room: r.room }[k] ?? m)); };
/* Tell the guest: it goes into the guest's own Inbox thread and is logged on the request. */
function guestUpdate(r, kind) {
  if (!r.guest) { log(r, "guest", "No guest on this request, so nobody was messaged"); return null; }
  const text = fillGuest(S.guestTpl[kind], r), c = D.convos.find((x) => x.name === r.guest);
  if (c) (S.extra[c.id] ||= []).push(["sys", `Update sent: ${kind === "done" ? "request done" : "someone is on it"}`], ["david", text, now().slice(0, 5)]);
  log(r, "guest", `Guest told on ${r.ch}: “${text}”`);
  return text;
}
function setStatus(r, st, tell) {
  r.st = st; log(r, "status", st === "done" ? "Marked done" : `Marked ${ST[st][1].toLowerCase()}`);
  return st === "done" && tell ? guestUpdate(r, "done") : null;
}
function doAssign(r, empId, tell = false) {
  const emp = T(empId); r.to = empId || null;
  if (!emp) { log(r, "assigned", "Unassigned"); return { emp: null, z: null, guest: null }; }
  log(r, "assigned", `Assigned to ${emp.name}`);
  const z = S.zaloOn ? zaloSend(r, emp) : null;
  if (z) log(r, "zalo", z.status === "failed" ? `Zalo to ${emp.name} failed: ${z.reason}` : `Zalo message sent to ${emp.name} (${fmtPhone(emp.zalo)})`);
  if (r.st === "pending" || r.st === "review") { r.st = "progress"; log(r, "status", "Marked in progress"); }
  return { emp, z, guest: tell ? guestUpdate(r, "assign") : null };
}

/* A small API that runs inside this page, shaped like the one the David server will expose. */
function apiCall({ method, path, key, body }) {
  const res = (status, b) => ({ status, body: b });
  const err = (status, code, message) => res(status, { error: { code, message } });
  const k = S.apiKeys.find((x) => x.secret === String(key || "").trim());
  if (!k) return err(401, "unauthorized", "Missing or invalid API key.");
  k.last = "Just now";
  let json = {};
  if (method !== "GET" && String(body || "").trim()) { try { json = JSON.parse(body); } catch { return err(400, "invalid_json", "The request body is not valid JSON."); } }
  const pub = (e) => ({ id: e.id, name: e.name, role: e.role, department: e.dept, zalo_phone: e.zalo || null, consent: e.consent, on_shift: e.onShift });
  const out = (r) => ({ id: r.id, department: r.dept, room: r.room, request: r.ask, guest: r.guest || null, status: r.st, assigned_to: r.to ? { id: r.to, name: T(r.to) ? T(r.to).name : null } : null, opened_at: r.opened });
  const zout = (z) => (z ? { message_id: z.id, status: z.status, ...(z.reason ? { reason: z.reason } : {}) } : { status: "skipped", reason: "Zalo messages are switched off" });
  let m;
  if (method === "GET" && path === "/v1/staff") return res(200, { data: S.team.map(pub) });
  if (method === "GET" && path === "/v1/requests") return res(200, { data: S.requests.map(out) });
  if (method === "POST" && path === "/v1/staff") {
    const n = normPhone(json.zalo_phone);
    if (!String(json.name || "").trim() || !D.departments.concat(["Management"]).includes(json.department)) return err(422, "invalid_staff", "name and a valid department are required.");
    if (!n) return err(422, "invalid_zalo_phone", "zalo_phone must be a Vietnamese mobile number, for example 0905550142 or +84905550142.");
    if (json.consent !== true) return err(422, "consent_required", "Set consent to true once the employee has agreed to receive Zalo messages.");
    if (S.team.some((t) => t.zalo === n)) return err(409, "duplicate_zalo_phone", "Another employee already uses that Zalo number.");
    const e = { id: "t" + Date.now(), name: json.name.trim(), role: json.role || "", dept: json.department, zalo: n, lang: json.language || "English", consent: true, onShift: json.on_shift !== false };
    S.team.push(e); return res(201, pub(e));
  }
  if ((m = path.match(/^\/v1\/staff\/([\w-]+)$/)) && method === "PATCH") {
    const e = T(m[1]); if (!e) return err(404, "staff_not_found", `No employee ${m[1]}.`);
    if ("zalo_phone" in json) { const n = normPhone(json.zalo_phone); if (!n) return err(422, "invalid_zalo_phone", "zalo_phone must be a Vietnamese mobile number."); e.zalo = n; }
    if ("consent" in json) e.consent = json.consent === true; if ("role" in json) e.role = json.role; if ("on_shift" in json) e.onShift = !!json.on_shift; if ("department" in json) e.dept = json.department;
    return res(200, pub(e));
  }
  if (method === "POST" && path === "/v1/requests") {
    if (!D.departments.includes(json.department)) return err(422, "invalid_department", `department must be one of: ${D.departments.join(", ")}.`);
    if (!json.room || !json.request) return err(422, "invalid_request", "room and request are required.");
    if (json.assignee_id && !T(json.assignee_id)) return err(404, "staff_not_found", `No employee ${json.assignee_id}.`);
    const r = { id: "r" + (S.requests.length + 1 + Math.floor(Math.random() * 90)), dept: json.department, room: String(json.room), ask: String(json.request), guest: json.guest || "", ch: json.channel || "WhatsApp", opened: now().slice(0, 5), to: null, st: "pending" };
    S.requests.unshift(r);
    const target = json.assignee_id || S.autoAssign[json.department] || null, a = doAssign(r, target, json.notify_guest !== false);
    return res(201, { ...out(r), zalo: a.emp ? zout(a.z) : null, guest_message: a.guest, auto_assigned: !json.assignee_id && !!a.emp });
  }
  if ((m = path.match(/^\/v1\/requests\/([\w-]+)\/assign$/)) && method === "POST") {
    const r = S.requests.find((x) => x.id === m[1]); if (!r) return err(404, "request_not_found", `No request ${m[1]}.`);
    if (json.assignee_id && !T(json.assignee_id)) return err(404, "staff_not_found", `No employee ${json.assignee_id}.`);
    const a = doAssign(r, json.assignee_id || null, json.notify_guest !== false); return res(200, { ...out(r), zalo: a.emp ? zout(a.z) : null, guest_message: a.guest });
  }
  if ((m = path.match(/^\/v1\/requests\/([\w-]+)$/)) && method === "PATCH") {
    const r = S.requests.find((x) => x.id === m[1]); if (!r) return err(404, "request_not_found", `No request ${m[1]}.`);
    if (!["pending", "progress", "done", "review"].includes(json.status)) return err(422, "invalid_status", "status must be pending, progress, review or done.");
    if (json.status === "done" && !r.to) return err(409, "not_allocated", "Send the request to someone before marking it done.");
    const told = setStatus(r, json.status, json.notify_guest !== false); return res(200, { ...out(r), guest_message: told });
  }
  if (method === "POST" && path === "/v1/notifications/zalo/test") { const e = T(json.staff_id); if (!e) return err(404, "staff_not_found", `No employee ${json.staff_id}.`); return res(200, { zalo: zout(zaloSend(null, e, "test")) }); }
  if (method === "POST" && path === "/v1/webhooks/zalo") {
    const e = S.team.find((t) => t.zalo === normPhone(json.sender && json.sender.phone)), text = String((json.message && json.message.text) || "").trim();
    if (!e) return res(200, { handled: false, reason: "No employee has that Zalo number." });
    S.zaloLog.unshift({ id: "z" + Date.now(), time: now().slice(0, 5), to: e.name, phone: e.zalo, req: null, text, status: "delivered", reason: "", kind: "reply" });
    if (/^done\b/i.test(text)) { const r = S.requests.find((x) => x.to === e.id && x.st !== "done"); if (r) { r.st = "done"; return res(200, { handled: true, action: "marked_done", request: out(r) }); } return res(200, { handled: true, action: "nothing_open" }); }
    return res(200, { handled: true, action: "logged" });
  }
  return err(404, "not_found", `No endpoint for ${method} ${path}.`);
}
const PRESETS = [
  ["Create a request and notify", "POST", "/v1/requests", { department: "Maintenance", room: "412", request: "Light flickering in the bathroom", guest: "Priya Nair", channel: "WhatsApp" }],
  ["Assign a request", "POST", "/v1/requests/r2/assign", { assignee_id: "t4" }],
  ["Mark done and tell the guest", "PATCH", "/v1/requests/r1", { status: "done" }],
  ["Zalo reply marks it done", "POST", "/v1/webhooks/zalo", { event_name: "user_send_text", sender: { phone: "+84905550102" }, message: { text: "DONE" } }],
  ["Send a test message", "POST", "/v1/notifications/zalo/test", { staff_id: "t2" }],
  ["Add an employee", "POST", "/v1/staff", { name: "Hoa Le", role: "Housekeeping attendant", department: "Housekeeping", zalo_phone: "0905550110", consent: true }],
  ["Update an employee", "PATCH", "/v1/staff/t6", { zalo_phone: "+84905550106", consent: true }],
  ["List employees", "GET", "/v1/staff", null],
  ["List requests", "GET", "/v1/requests", null],
];
const presetBody = (i) => (PRESETS[i][3] ? JSON.stringify(PRESETS[i][3], null, 2) : "");
if (!S.api.body && S.api.preset === 0) S.api.body = presetBody(0);
const BASE = "https://api.harbourhouse.example";
const curlText = () => { const a = S.api, has = a.method !== "GET" && a.body.trim(); return `curl -X ${a.method} ${BASE}${a.path} \\\n  -H "Authorization: Bearer ${a.key || "YOUR_KEY"}"${has ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${a.body.replace(/\s*\n\s*/g, " ")}'` : ""}`; };

function peopleTab() {
  const rows = S.team.map((t) => `<tr><td><div class="nm"><span class="avatar">${initials(t.name)}</span><div><div>${esc(t.name)}</div><div class="small">${esc(t.role)} · ${esc(t.dept)}</div></div></div></td><td class="mono" style="color:var(--ink)">${esc(fmtPhone(t.zalo))}</td><td>${t.zalo && t.consent ? pill("ok", "Ready on Zalo") : pill("review", !t.zalo ? "No Zalo number" : "No consent")}</td><td>${t.onShift ? "On shift" : '<span class="small">Off shift</span>'}</td><td class="num">${openTasks(t.id)}</td><td style="text-align:right;white-space:nowrap"><button class="btn sm" data-a="testZalo" data-id="${t.id}">Send test</button> <button class="btn sm" data-a="editStaff" data-id="${t.id}">Edit</button></td></tr>`).join("");
  const auto = D.departments.map((d) => `<label class="fld"><span class="label">${d}</span><select class="input" data-a="autoAssign" data-dept="${esc(d)}"><option value="">Nobody (assign by hand)</option>${S.team.map((t) => `<option value="${t.id}" ${S.autoAssign[d] === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>`).join("");
  const sample = zaloText({ dept: "Maintenance", room: "608", ask: "Air conditioning not cooling", guest: "Marcus Bell" }, T("t2") || S.team[0]);
  return `<table class="t"><thead><tr><th>Employee</th><th>Zalo number</th><th>Zalo status</th><th>Shift</th><th>Open tasks</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  <div class="bd" style="padding-top:18px;display:grid;gap:18px"><div><h2>Auto-assign new requests by department</h2><div class="small" style="margin:2px 0 10px">When David or the API creates a request, it goes to this person and they get a Zalo message straight away. You can still reassign it.</div><div class="row" style="grid-template-columns:repeat(3,1fr)">${auto}</div></div>
  <div class="note"><span class="label" style="color:var(--green)">What the employee receives on Zalo</span><span style="font-family:var(--mono);font-size:13px">${esc(sample)}</span><span class="small">${sample.length} of 400 characters. Zalo only delivers task alerts that use a message template it has approved, and the business must be registered with Zalo. Check Zalo’s current rules before launch.</span></div></div>`;
}
function logTab() {
  const pl = { delivered: pill("ok", "Delivered"), queued: pill("pend", "Sending"), failed: pill("review", "Failed") };
  const kind = { assignment: "Assignment", test: "Test", reply: "Reply from employee" };
  return `<table class="t"><thead><tr><th>Time</th><th>To</th><th>Message</th><th>Type</th><th>Status</th></tr></thead><tbody>${S.zaloLog.slice(0, 30).map((z) => `<tr><td class="mono">${z.time}</td><td>${esc(z.to)}<div class="mono">${esc(fmtPhone(z.phone))}</div></td><td style="max-width:420px">${esc(z.text)}${z.reason ? `<div class="small" style="color:var(--clay)">${esc(z.reason)}</div>` : ""}</td><td class="small">${kind[z.kind]}</td><td>${pl[z.status]}</td></tr>`).join("")}</tbody></table>`;
}
function apiTab() {
  const a = S.api, res = a.res;
  const keys = S.apiKeys.map((k) => `<tr><td>${esc(k.name)}</td><td class="mono">${esc(k.secret.slice(0, 9))}…${esc(k.secret.slice(-4))}</td><td class="small">${esc(k.last)}</td><td style="text-align:right"><button class="btn sm danger" data-a="keyRevoke" data-id="${k.id}">Revoke</button></td></tr>`).join("");
  const EP = [["POST", "/v1/requests", "Create a request. It is auto-assigned and the employee gets a Zalo message."], ["POST", "/v1/requests/{id}/assign", "Assign or reassign. Sends a Zalo message to the new person and tells the guest."], ["PATCH", "/v1/requests/{id}", "Change status. Done tells the guest it is finished."], ["POST", "/v1/webhooks/zalo", "Zalo calls this when an employee replies. “DONE” closes their open request."], ["GET/POST/PATCH", "/v1/staff", "Employee profiles, each with a Zalo number and consent."], ["POST", "/v1/notifications/zalo/test", "Send a test message to one employee."], ["GET", "/v1/requests", "List requests and who they are assigned to."]];
  return `<div class="row" style="grid-template-columns:1fr 1fr;padding:0 20px 20px;align-items:start">
  <div style="display:grid;gap:16px;align-content:start">
    <div class="grp"><span class="label">How it works</span><p class="small" style="color:var(--ink)">Anything that can make a web request, such as your booking system, a maintenance app or a script, can create and assign requests. David messages the right person on Zalo, and their reply comes back here. Every call needs an API key in the Authorization header.</p><div class="small">Base URL <span class="mono">${BASE}</span> (placeholder: the live server endpoint is not deployed yet).</div></div>
    <div class="card" style="box-shadow:none"><div class="hd" style="padding-bottom:8px"><h2>API keys</h2><button class="btn sm primary" data-a="keyNew">Create key</button></div>${S.newKey ? `<div class="okmsg" style="margin:0 20px 10px">New key, shown once: <span class="mono" style="word-break:break-all">${esc(S.newKey)}</span> <button class="btn sm" data-a="copy" data-v="key">Copy</button></div>` : ""}<table class="t"><tbody>${keys || '<tr><td class="empty">No keys</td></tr>'}</tbody></table></div>
    <div class="card" style="box-shadow:none"><div class="hd" style="padding-bottom:8px"><h2>Endpoints</h2></div><div class="list tight" style="padding:0 20px 14px">${EP.map(([m, p, d]) => `<div><span class="mono" style="width:104px;color:var(--green)">${m}</span><div class="grow"><div class="mono" style="color:var(--ink)">${p}</div><div class="small">${d}</div></div></div>`).join("")}</div></div>
  </div>
  <div class="grp"><span class="label">Try it</span><div class="small">Runs against a copy of the API inside this page. It changes the requests and messages you can see above.</div>
    ${fld("Example", `<select data-a="apiPreset">${PRESETS.map((p, i) => `<option value="${i}" ${a.preset === i ? "selected" : ""}>${p[0]}</option>`).join("")}</select>`)}
    <div class="two" style="grid-template-columns:110px 1fr"><label class="fld"><span class="label">Method</span><select data-api="method" class="input">${["GET", "POST", "PATCH"].map((m) => `<option ${a.method === m ? "selected" : ""}>${m}</option>`).join("")}</select></label><label class="fld"><span class="label">Path</span><input class="input" data-api="path" value="${esc(a.path)}" autocomplete="off" spellcheck="false" style="font-family:var(--mono)"></label></div>
    <label class="fld"><span class="label">API key</span><input class="input" data-api="key" value="${esc(a.key)}" autocomplete="off" spellcheck="false" style="font-family:var(--mono)"></label>
    <label class="fld"><span class="label">Body (JSON)</span><textarea class="input" data-api="body" spellcheck="false" style="min-height:130px;font-family:var(--mono);font-size:12.5px">${esc(a.body)}</textarea></label>
    <div style="display:flex;gap:10px;align-items:center"><button class="btn primary" data-a="apiSend">Send request</button><button class="btn" data-a="copy" data-v="curl">Copy as curl</button></div>
    <pre class="code" id="curl">${esc(curlText())}</pre>
    ${res ? `<div class="small">Response · <b style="color:${res.status < 300 ? "var(--green)" : "var(--clay)"}">${res.status}</b></div><pre class="code">${esc(JSON.stringify(res.body, null, 2))}</pre>` : ""}
  </div></div>`;
}
function teamCard() {
  const tabs = [["people", "People"], ["log", `Zalo messages (${S.zaloLog.length})`], ["api", "API and automation"]];
  return `<div class="card"><div class="hd"><div><h2>Team on Zalo</h2><div class="small sub">Everyone has a profile with their Zalo number. When a request is assigned, David messages them there.</div></div><div style="display:flex;gap:14px;align-items:center"><span class="small" style="color:var(--ink)">Message on assignment</span><button class="switch" role="switch" aria-checked="${S.zaloOn}" data-a="zaloToggle" aria-label="Send a Zalo message on assignment"></button><button class="btn primary" data-a="newStaff">+ Add employee</button></div></div>
  <div class="cats" style="padding-top:0">${tabs.map(([k, l]) => `<button class="btn sm ${S.zaloTab === k ? "primary" : ""}" style="border-radius:999px" data-a="zaloTab" data-v="${k}">${l}</button>`).join("")}</div>
  ${S.zaloTab === "people" ? peopleTab() : S.zaloTab === "log" ? logTab() : apiTab()}</div>`;
}
function staffForm(e) {
  const d = e.data;
  return `<div class="dh"><h2>${e.isNew ? "Add employee" : "Edit employee"}</h2><button class="icon-btn" data-a="closeEdit" aria-label="Close">✕</button></div>
  <div class="db">
    ${fld("Name", `<input data-f="name" value="${esc(d.name)}" autocomplete="off">`)}
    <div class="two">${fld("Role", `<input data-f="role" value="${esc(d.role)}" placeholder="e.g. Housekeeping supervisor" autocomplete="off">`)}${fld("Department", `<select data-f="dept">${D.departments.concat(["Management"]).map((x) => `<option ${x === d.dept ? "selected" : ""}>${x}</option>`).join("")}</select>`)}</div>
    <div class="grp"><span class="label">Zalo</span>${fld("Zalo number", `<input data-f="zalo" value="${esc(d.zalo)}" placeholder="0905 550 142 or +84 905 550 142" autocomplete="off" inputmode="tel">`, "The mobile number this person uses on Zalo.")}<div id="sphone"></div>
      <label class="check" style="border:0;padding:0;align-items:flex-start"><input type="checkbox" data-f="consent" ${d.consent ? "checked" : ""} style="margin-top:3px"><span>This employee has agreed to receive work messages on Zalo.<br><span class="small">Required before David sends anything.</span></span></label></div>
    ${fld("Language", `<select data-f="lang">${["English", "Vietnamese"].map((x) => `<option ${x === d.lang ? "selected" : ""}>${x}</option>`).join("")}</select>`)}
    <div style="display:flex;justify-content:space-between;align-items:center"><span>On shift</span><button class="switch" type="button" role="switch" aria-checked="${d.onShift}" data-a="sshift" aria-label="On shift"></button></div>
    <div class="errmsg" id="cerr" role="alert"></div>
  </div>
  <div class="df"><button class="btn primary" data-a="saveStaff">${e.isNew ? "Add employee" : "Save changes"}</button><button class="btn" data-a="closeEdit">Cancel</button><span class="sp"></span>${e.isNew ? "" : `<button class="btn danger" data-a="delStaff">${e.confirm ? `Click again to delete${openTasks(d.id) ? ` (${openTasks(d.id)} open)` : ""}` : "Delete"}</button>`}</div>`;
}
function updateStaffLive() {
  const e = S.edit; if (!e || e.type !== "staff") return; const el = $("#sphone"); if (!el) return;
  const raw = String(e.data.zalo || "").trim(); if (!raw) { el.innerHTML = ""; return; }
  const n = normPhone(raw); el.innerHTML = n ? `<div class="okmsg">David will message ${esc(fmtPhone(n))}</div>` : '<div class="warn">That is not a Vietnamese mobile number. Use 0905 550 142 or +84 905 550 142.</div>';
}
Object.assign(A, {
  zaloToggle: () => { S.zaloOn = !S.zaloOn; toast(S.zaloOn ? "David will message people on Zalo when you assign" : "Zalo messages are off: assignments stay silent"); },
  zaloTab: (t) => (S.zaloTab = t.dataset.v),
  assign: (t) => { const r = S.requests.find((x) => x.id === t.dataset.id), { emp, z, guest } = doAssign(r, t.value, S.tellGuest); if (!emp) return toast(`Unassigned: ${r.ask}`); toast(!z ? `Assigned to ${emp.name}. Zalo messages are off.` : z.status === "failed" ? `Assigned to ${emp.name}, but Zalo failed: ${z.reason}` : `Sent to ${emp.name} on Zalo${guest ? " and told the guest" : ""}`); },
  autoAssign: (t) => { S.autoAssign[t.dataset.dept] = t.value || null; toast(`New ${t.dataset.dept} requests go to ${t.value ? T(t.value).name : "nobody by default"}`); },
  testZalo: (t) => { const emp = T(t.dataset.id), z = zaloSend(null, emp, "test"); toast(z.status === "failed" ? `Could not send: ${z.reason}` : `Test sent to ${emp.name} on ${fmtPhone(emp.zalo)}`); },
  newStaff: () => { S.edit = { type: "staff", isNew: true, data: { id: "t" + Date.now(), name: "", role: "", dept: "Housekeeping", zalo: "", lang: "English", consent: false, onShift: true } }; },
  editStaff: (t) => { S.edit = { type: "staff", isNew: false, data: { ...T(t.dataset.id) } }; },
  sshift: () => { S.edit.data.onShift = !S.edit.data.onShift; },
  saveStaff: () => {
    const d = S.edit.data, err = [], n = normPhone(d.zalo);
    if (!String(d.name).trim()) err.push("Enter a name.");
    if (!n) err.push("Enter a valid Vietnamese mobile number for Zalo."); else if (S.team.some((t) => t.zalo === n && t.id !== d.id)) err.push("Another employee already uses that Zalo number.");
    if (!d.consent) err.push("Confirm the employee agreed to Zalo messages.");
    if (err.length) { S.edit.error = err.join(" "); return; }
    d.name = d.name.trim(); d.zalo = n;
    if (S.edit.isNew) S.team.push(d); else S.team = S.team.map((t) => (t.id === d.id ? d : t));
    S.edit = null; toast(`${d.name} will get Zalo messages on ${fmtPhone(n)}`);
  },
  delStaff: () => {
    if (!S.edit.confirm) { S.edit.confirm = true; return; }
    const id = S.edit.data.id, nm = S.edit.data.name; S.requests.forEach((r) => { if (r.to === id) r.to = null; }); Object.keys(S.autoAssign).forEach((k) => { if (S.autoAssign[k] === id) S.autoAssign[k] = null; });
    S.team = S.team.filter((t) => t.id !== id); S.edit = null; toast(`Removed ${nm}. Their open requests are unassigned.`);
  },
  apiPreset: (t) => { const i = Number(t.value), p = PRESETS[i]; S.api.preset = i; S.api.method = p[1]; S.api.path = p[2]; S.api.body = presetBody(i); S.api.res = null; },
  apiSend: () => { const a = S.api; a.res = apiCall(a); toast(`${a.method} ${a.path}: ${a.res.status}`); },
  keyNew: () => { const b = new Uint8Array(10); crypto.getRandomValues(b); const secret = "dvd_live_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); S.apiKeys.push({ id: "key" + Date.now(), name: "New key", secret, created: "Today", last: "Never" }); S.newKey = secret; toast("Key created. Copy it now: it is shown once."); },
  keyRevoke: (t) => { S.apiKeys = S.apiKeys.filter((k) => k.id !== t.dataset.id); toast("Key revoked"); },
  copy: (t) => { const txt = t.dataset.v === "curl" ? curlText() : S.newKey; if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Copied"), () => toast("Copy is not available here")); else toast("Copy is not available here"); },
});

/* ---------- a request: allocate it, then close it and tell the guest ---------- */
const openReqEdit = (id) => { const r = S.requests.find((x) => x.id === id); if (!r) return; S.edit = { type: "req", id, data: { assignee: r.to || S.autoAssign[r.dept] || "", tell: S.tellGuest } }; };
const TL = { created: "var(--slate)", assigned: "var(--green)", zalo: "var(--green)", status: "var(--mute)", guest: "var(--clay)" };
function reqForm(e) {
  const r = S.requests.find((x) => x.id === e.id); if (!r) return "";
  const d = e.data, emp = T(r.to), pick = T(d.assignee), sug = T(S.autoAssign[r.dept]);
  const z = emp && S.zaloLog.find((x) => x.req === r.id && x.to === emp.name && x.kind === "assignment");
  const zp = z ? { delivered: pill("ok", "Delivered on Zalo"), queued: pill("pend", "Sending on Zalo"), failed: pill("review", "Zalo failed") }[z.status] : "";
  const opt = (t) => `<option value="${t.id}" ${t.id === d.assignee ? "selected" : ""}>${esc(t.name)} · ${esc(t.dept)} · ${openTasks(t.id)} open${t.zalo && t.consent ? "" : " · no Zalo"}</option>`;
  const sorted = [...S.team.filter((t) => t.dept === r.dept), ...S.team.filter((t) => t.dept !== r.dept)];
  const assigned = !!emp, done = r.st === "done";
  return `<div class="dh"><div><h2>${esc(r.ask)}</h2><div class="small" style="margin-top:3px">${esc(r.dept)} · room ${esc(r.room)} · ${r.guest ? esc(r.guest) : "no guest named"} · ${esc(r.ch)} · opened ${r.opened}</div></div><button class="icon-btn" data-a="closeEdit" aria-label="Close">✕</button></div>
  <div class="db">
    <div style="display:flex;gap:10px;align-items:center">${pill(ST[r.st][0], ST[r.st][1])}<span class="small">${assigned ? `With ${esc(emp.name)}` : "Not allocated yet"}</span></div>
    <div class="grp"><span class="label">1 · Send it to the right person</span>
      ${assigned ? `<div class="okmsg">${esc(emp.name)} · ${esc(emp.role)} ${zp}<div class="small" style="margin-top:4px;color:var(--ink)">${esc(fmtPhone(emp.zalo))}</div></div>` : ""}
      ${fld(assigned ? "Reassign to" : "Allocate to", `<select data-f="assignee"><option value="">Choose a person</option>${sorted.map(opt).join("")}</select>`, !assigned && sug ? `Suggested for ${esc(r.dept)}: ${esc(sug.name)}` : "")}
      ${pick && !(pick.zalo && pick.consent) ? `<div class="warn">${esc(pick.name)} has no ${pick.zalo ? "consent for" : ""} Zalo ${pick.zalo ? "messages" : "number"}, so David cannot message them. Fix their profile in David’s brain first.</div>` : ""}
      <div><button class="btn primary" data-a="reqAssign" ${pick ? "" : "disabled"}>${pick ? `${assigned && pick.id === r.to ? "Send again to" : "Send to"} ${esc(firstName(pick.name))} on Zalo` : "Choose a person first"}</button></div></div>
    <div class="grp"><span class="label">2 · Close it and tell the guest</span>
      <label class="check" style="border:0;padding:0;align-items:flex-start"><input type="checkbox" data-f="tell" ${d.tell ? "checked" : ""} style="margin-top:3px"><span>Message ${r.guest ? esc(firstName(r.guest)) : "the guest"} on ${esc(r.ch)}<br><span class="small">${r.guest ? "They are told when you send it to someone, and again when it is done." : "No guest is named on this request."}</span></span></label>
      <label class="fld"><span class="label">Sent when it is done</span><textarea class="input" data-tpl="done" style="min-height:76px">${esc(S.guestTpl.done)}</textarea></label>
      <details><summary class="small" style="cursor:pointer">Message sent when you send it to someone</summary><textarea class="input" data-tpl="assign" style="min-height:76px;margin-top:8px">${esc(S.guestTpl.assign)}</textarea></details>
      <div><span class="label">Preview of the done message</span><div class="bubble" id="gprev" style="max-width:none;margin-top:8px"></div></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${done ? `<button class="btn" data-a="reqReopen">Reopen</button>` : `<button class="btn primary" data-a="reqDone" ${assigned ? "" : "disabled"}>Mark done${d.tell && r.guest ? ` and tell ${esc(firstName(r.guest))}` : ""}</button>${assigned ? "" : '<span class="small">Send it to someone first.</span>'}`}</div></div>
    <div><span class="label">Timeline</span><div class="list tight" style="margin-top:6px">${[...(r.log || [])].reverse().map((x) => `<div><span class="mono" style="width:42px">${x.t}</span><span style="width:8px;height:8px;border-radius:50%;background:${TL[x.kind] || "var(--mute)"};margin-top:6px;flex:none"></span><span class="grow">${esc(x.text)}</span></div>`).join("")}</div></div>
  </div>`;
}
function updateReqLive() {
  const e = S.edit; if (!e || e.type !== "req") return; const r = S.requests.find((x) => x.id === e.id), p = $("#gprev"); if (!r || !p) return;
  const keep = r.to; if (e.data.assignee) r.to = e.data.assignee; p.textContent = fillGuest(S.guestTpl.done, r); r.to = keep;
}
Object.assign(A, {
  tellGuest: () => { S.tellGuest = !S.tellGuest; toast(S.tellGuest ? "Guests are told when a request is sent to someone and when it is done" : "Guests will not be messaged automatically"); },
  openReq: (t) => openReqEdit(t.dataset.id),
  reqAssign: () => {
    const e = S.edit, r = S.requests.find((x) => x.id === e.id), { emp, z, guest } = doAssign(r, e.data.assignee, e.data.tell);
    toast(!emp ? "Choose a person" : z && z.status === "failed" ? `Allocated to ${emp.name}, but Zalo failed: ${z.reason}` : `Sent to ${emp.name} on Zalo${guest ? `, and ${firstName(r.guest)} was told` : ""}`);
  },
  reqDone: () => { const e = S.edit, r = S.requests.find((x) => x.id === e.id), told = setStatus(r, "done", e.data.tell); toast(told ? `Done. ${firstName(r.guest)} was told` : "Marked done"); },
  reqReopen: () => { const e = S.edit, r = S.requests.find((x) => x.id === e.id); setStatus(r, "progress", false); toast("Reopened"); },
});
const EDITOR_ACTIONS = new Set(["openReq", "reqAssign", "reqDone", "reqReopen", "newStaff", "editStaff", "saveStaff", "delStaff", "sshift", "cmode", "cswitch", "merge", "testCamp", "dupCamp", "delCamp", "saveCamp", "saveConn", "testConn", "discConn", "saveKnow", "delKnow", "closeEdit", "newCamp", "editCamp", "editConn", "newKnow", "editKnow"]);
function refresh(name) {
  render();
  if (EDITOR_ACTIONS.has(name) || S.edit) {
    const keep = S.edit && S.edit.caret; drawer();
    if (S.edit && S.edit.error) { const el = $("#cerr"); if (el) el.textContent = S.edit.error; S.edit.error = null; }
    if (keep != null) { const ta = $("#ctext"); if (ta) { ta.focus(); ta.setSelectionRange(keep, keep); } S.edit.caret = null; }
  }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-a]"); if (!t || t.tagName === "FORM" || t.tagName === "SELECT" || t.tagName === "INPUT") return;
  const name = t.dataset.a; if (!A[name]) return; A[name](t, e); refresh(name);
});
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-a]")) { e.preventDefault(); e.target.click(); } });
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.api && t.tagName === "SELECT") { S.api[t.dataset.api] = t.value; render(); return; }
  if (t.matches("select[data-a]")) { A[t.dataset.a](t); render(); return; }
  if (t.dataset.r) { S.rules[t.dataset.r] = t.dataset.r === "perDay" ? Number(t.value) : t.value; render(); if (S.edit) updateCampLive(); return; }
  if (t.dataset.f && S.edit && t.tagName === "SELECT") { S.edit.data[t.dataset.f] = t.value; if (t.dataset.f === "trigger" && t.value === "arrival_day") S.edit.data.days = 0; drawer(); }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "gq") { S.guestQ = t.value; $("#gdir").innerHTML = dirRows(); return; }
  if (t.dataset.tpl) { S.guestTpl[t.dataset.tpl] = t.value; updateReqLive(); return; }
  if (t.dataset.api) { S.api[t.dataset.api] = t.value; const c = $("#curl"); if (c) c.textContent = curlText(); return; }
  if (t.dataset.f && S.edit && t.tagName !== "SELECT") { S.edit.data[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; updateCampLive(); updateStaffLive(); updateReqLive(); }
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-a]"); if (!f) return; e.preventDefault();
  if (f.dataset.a === "send") { const i = $("#reply"), v = i.value.trim(); if (!v) return; (S.extra[S.convo] ||= []).push(["staff", v, now().slice(0, 5)]); render(); $("#reply").focus(); }
  if (f.dataset.a === "ask") { const i = $("#ask"), v = i.value.trim(); if (!v) return; const hit = answerFor(v); S.qa.push([v, hit ? hit[0] : "I don’t have that on file, so I won’t guess. I’ve asked the front desk and I’ll come back to you.", hit ? hit[1] : null]); render(); $("#ask").focus(); }
});
$("#scrim").addEventListener("click", closeEdit);
window.addEventListener("hashchange", () => { S.edit = null; drawer(); render(); });
$("#bell").addEventListener("click", () => toast(`${allFields().filter((f) => f.st !== "ok").length} write-backs and 2 conflicts need you`));

/* live events on the Opera screen */
let ev = 0;
setInterval(() => { const e = D.eventPool[ev++ % D.eventPool.length]; S.events.unshift([now(), e[0], e[1], e[2], "ok", e[0] === "→" ? "Created" : "Applied"]); if (route() === "opera" && !S.edit) render(); }, 7000);

/* search palette */
const pal = $("#palette"), pq = $("#pq"), pl = $("#pl"); let items = [], sel = 0;
function items_() { return [...PAGES.filter((x) => typeof x !== "string").map((x) => ({ k: "Page", t: x[1], go: () => (location.hash = `#/${x[0]}`) })), ...D.guests.map((g) => ({ k: "Guest", t: `${g.name} · ${g.room}`, go: () => { S.guest = g.id; S.fieldsOpen = false; location.hash = "#/guests"; render(); } })), ...S.campaigns.map((c) => ({ k: "Campaign", t: c.name, go: () => { location.hash = "#/campaigns"; S.edit = { type: "camp", isNew: false, data: { ...c } }; render(); drawer(); } })), ...S.requests.map((r) => ({ k: "Request", t: `${r.ask} · room ${r.room}`, go: () => { location.hash = "#/requests"; openReqEdit(r.id); render(); drawer(); } }))]; }
function drawPal() { const q = pq.value.toLowerCase(); items = items_().filter((i) => i.t.toLowerCase().includes(q)).slice(0, 9); sel = Math.min(sel, Math.max(0, items.length - 1)); pl.innerHTML = items.map((i, n) => `<li><button class="${n === sel ? "on" : ""}" data-n="${n}"><span class="label" style="width:70px">${i.k}</span>${esc(i.t)}</button></li>`).join("") || '<li class="empty">No matches</li>'; }
const openPal = () => { pal.hidden = false; pq.value = ""; sel = 0; drawPal(); pq.focus(); }, closePal = () => (pal.hidden = true);
$("#openSearch").addEventListener("click", openPal);
pq.addEventListener("input", () => { sel = 0; drawPal(); });
pl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { items[+b.dataset.n].go(); closePal(); } });
pal.addEventListener("click", (e) => { if (e.target === pal) closePal(); });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? openPal() : closePal(); return; }
  if (e.key === "Escape" && pal.hidden && S.edit) { closeEdit(); return; }
  if (pal.hidden) return;
  if (e.key === "Escape") closePal();
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); drawPal(); e.preventDefault(); }
  if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); drawPal(); e.preventDefault(); }
  if (e.key === "Enter" && items[sel]) { items[sel].go(); closePal(); }
});

/* ---------- language (EN | VI) ---------- */
// Display-time translation: the app always builds English, then this rewrites the text on screen.
// Guest messages and campaign bubbles are left alone, because they are what the guest sees or wrote.
const LANG_KEY = "david-lang", ATTRS = ["placeholder", "title", "aria-label"], SKIP = "script,style,pre,textarea,.msg .b,.bubble";
let lang = "en"; try { lang = localStorage.getItem(LANG_KEY) === "vi" ? "vi" : "en"; } catch { /* ignore */ }
const loc = (en) => (lang === "vi" ? translate(en) : en);
function localize(root = document.body) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const par = n.parentElement; if (!par || par.closest(SKIP)) continue;
    if (n.__vi !== undefined && n.data !== n.__vi) delete n.__en;
    if (n.__en === undefined) n.__en = n.data;
    if (lang === "vi") { n.__vi = translate(n.__en); if (n.data !== n.__vi) n.data = n.__vi; }
    else if (n.data !== n.__en) { n.data = n.__en; n.__vi = undefined; }
  }
  const els = root.nodeType === 1 ? [root, ...root.querySelectorAll("[placeholder],[title],[aria-label]")] : [...root.querySelectorAll("[placeholder],[title],[aria-label]")];
  els.forEach((el) => { if (el.closest(".bubble")) return; ATTRS.forEach((at) => {
    const v = el.getAttribute(at); if (v === null) return; el.__en ||= {}; el.__vi ||= {};
    if (el.__vi[at] !== undefined && v !== el.__vi[at]) delete el.__en[at];
    if (el.__en[at] === undefined) el.__en[at] = v;
    const out = lang === "vi" ? translate(el.__en[at]) : el.__en[at]; el.__vi[at] = out; if (v !== out) el.setAttribute(at, out);
  }); });
  const t = document.title; if (!document.__t || t !== document.__tv) document.__t = t.replace(/ · David$/, "");
  document.__tv = (lang === "vi" ? translate(document.__t) : document.__t) + " · David"; if (document.title !== document.__tv) document.title = document.__tv;
}
let busy = false; const mo = new MutationObserver((ms) => {
  if (busy) return; busy = true;
  for (const m of ms) { if (m.type === "characterData") { if (m.target.parentElement) localize(m.target.parentElement); } else if (m.type === "attributes") localize(m.target); else m.addedNodes.forEach((x) => { if (x.nodeType === 1) localize(x); else if (x.nodeType === 3 && x.parentElement) localize(x.parentElement); }); }
  mo.takeRecords(); busy = false;
});
function setLang(l) {
  lang = l === "vi" ? "vi" : "en"; try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang; busy = true; localize(); busy = false; render(); drawer();
  document.querySelectorAll("#lang button").forEach((b) => { const on = b.dataset.l === lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}
document.querySelectorAll("#lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.l)));
mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

render();
setLang(lang);
