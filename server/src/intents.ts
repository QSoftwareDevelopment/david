import type { Fact } from "./memory.js";
import type { RequestKind, Service } from "./types.js";

/**
 * Reading a guest's text without a model.
 *
 * This is David's floor: it works with no API key, no network and no cost, and
 * it is what the tests pin down. The model-backed agent sits on top and is
 * trusted to do better, but when it fails or is switched off, this is what
 * keeps a guest from getting silence.
 */

export interface ProposedRequest {
  kind: RequestKind;
  summary: string;
  items: string[];
  urgent: boolean;
  /** What the guest said about timing, as they said it. */
  when: string | null;
}

export interface Understanding {
  requests: ProposedRequest[];
  facts: Fact[];
  /** The guest is unhappy or something needs a person. */
  escalate: boolean;
  /** A short greeting or thanks with nothing to do. */
  smallTalk: boolean;
}

const RULES: { kind: RequestKind; re: RegExp }[] = [
  { kind: "late_checkout", re: /\blate\s*check[\s-]*out\b|\bcheck[\s-]*out\s+(later|at\s+\d|around\s+\d)|\bstay\s+(a\s+bit\s+)?later\b/i },
  { kind: "early_checkin", re: /\bearly\s*check[\s-]*in\b|\bcheck[\s-]*in\s+(earlier|early)\b|\barriv(e|ing)\s+early\b/i },
  { kind: "laundry", re: /\blaundry\b|\bdry[\s-]*clean|\bpress(ing)?\s+(my|a|the)\b|\biron(ing)?\s+(my|a|the)\b|\bwash\s+(my|a|some)\b/i },
  { kind: "transport", re: /\btaxi\b|\buber\b|\blyft\b|\bcab\b|\bairport\b|\bshuttle\b|\bcar\s+service\b|\bpick\s*up\b/i },
  { kind: "maintenance", re: /\b(broken|not working|doesn'?t work|won'?t (work|turn)|leak(ing)?|no (hot )?water|too (hot|cold|loud|noisy)|noise|wifi|wi-fi|remote|\btv\b|lock(ed)?\s|light (is )?out|smells?|ac\b|a\/c|air\s*con|heating|thermostat)\b/i },
  { kind: "room_service", re: /\broom service\b|\border\b|\bhungry\b|\bbreakfast\b|\blunch\b|\bdinner\b|\bsnack\b|\bcoffee\b|\btea\b|\blatte\b|\bflat white\b|\bcappuccino\b|\bespresso\b|\bmocha\b|\bwine\b|\bchampagne\b|\bbeer\b|\bburger\b|\bpizza\b|\bsandwich\b|\bsalad\b|\bmenu\b|\bfood\b|\bdrinks?\b|\bwater bottle\b/i },
  { kind: "housekeeping", re: /\btowels?\b|\bsheets?\b|\bpillows?\b|\bblankets?\b|\bhousekeep|\bclean(ing)?\b|\bturn[\s-]*down\b|\bmake up (the|my) room\b|\btidy\b|\btoiletries\b|\bshampoo\b|\bsoap\b|\btoilet paper\b|\bhangers?\b/i },
  { kind: "amenities", re: /\bcrib\b|\bcot\b|\badapter\b|\bcharger\b|\btoothbrush\b|\brazor\b|\bslippers\b|\bextra bed\b|\bironing board\b|\bumbrella\b|\bfeather[\s-]*free\b/i },
];

const URGENT = /\b(urgent|asap|emergency|right now|immediately|flood|leak(ing)?|no (hot )?water|locked out|can'?t get in|smoke|fire)\b/i;
const COMPLAINT = /\b(terrible|awful|unacceptable|disgusting|worst|furious|angry|refund|complain|manager|disappointed|filthy|rude)\b/i;
const THANKS = /^\s*(thanks|thank you|thx|ty|great|perfect|ok(ay)?|cool|awesome|hi|hello|hey|good (morning|evening|afternoon))[\s!.,]*$/i;
const WHEN = /\b(tonight|tomorrow( morning| night| evening)?|this (morning|afternoon|evening)|at\s+\d{1,2}(:\d{2})?\s*(am|pm)?|around\s+\d{1,2}(:\d{2})?\s*(am|pm)?|in\s+\d+\s+(minutes?|mins?|hours?)|before\s+\d{1,2}(:\d{2})?\s*(am|pm)?|after\s+\d{1,2}(:\d{2})?\s*(am|pm)?|now|later)\b/i;

/** Pull item names out of a message: menu items first, then a few common asks. */
function itemsIn(text: string, kind: RequestKind, catalog: Service[]): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  const category = kind === "room_service" ? "room_service" : kind === "laundry" ? "laundry" : kind === "housekeeping" ? "housekeeping" : kind === "amenities" ? "amenity" : kind === "transport" ? "transport" : null;
  for (const s of catalog) {
    if (!s.active || (category && s.category !== category)) continue;
    if (lower.includes(s.name.toLowerCase())) found.add(s.name);
  }
  const generic =
    kind === "room_service"
      ? /\b(?:an?|the|some|two|three|2|3)?\s*((?:oat |soy |almond )?(?:flat white|latte|cappuccino|espresso|coffee|tea|burger|club sandwich|sandwich|pizza|salad|pasta|steak|eggs?|omelette|pancakes?|fries|soup|wine|champagne|beer|cocktail|water|juice|breakfast|dessert|cake))\b/gi
      : kind === "housekeeping"
        ? /\b(?:extra |more |fresh |clean )?(towels?|pillows?|sheets?|blankets?|toiletries|shampoo|soap|toilet paper|hangers?)\b/gi
        : kind === "amenities"
          ? /\b(crib|cot|adapter|charger|toothbrush|razor|slippers|umbrella|ironing board|extra bed)\b/gi
          : null;
  if (generic) {
    // A menu item already found wins over the same thing spotted generically.
    const have = new Set([...found].map((f) => f.toLowerCase()));
    for (const m of text.matchAll(generic)) {
      const item = (m[1] ?? m[0]).trim().toLowerCase();
      if (!have.has(item)) { found.add(item); have.add(item); }
    }
  }
  return [...found].slice(0, 8);
}

const summaryFor = (kind: RequestKind, items: string[], when: string | null, text: string): string => {
  const w = when ? ` (${when})` : "";
  const list = items.length ? items.join(", ") : "";
  switch (kind) {
    case "room_service": return `Room service: ${list || shorten(text)}${w}`;
    case "housekeeping": return `Housekeeping: ${list || shorten(text)}${w}`;
    case "laundry": return `Laundry: ${list || shorten(text)}${w}`;
    case "amenities": return `Amenities: ${list || shorten(text)}${w}`;
    case "maintenance": return `Maintenance: ${shorten(text)}`;
    case "transport": return `Transport: ${shorten(text)}${w}`;
    case "late_checkout": return `Late check-out${w || ": " + shorten(text)}`;
    case "early_checkin": return `Early check-in${w || ": " + shorten(text)}`;
    default: return shorten(text);
  }
};

const shorten = (s: string) => (s.length > 120 ? s.slice(0, 117).trimEnd() + "…" : s);

/** Facts a guest states about themselves. Kept narrow on purpose. */
export function factsIn(text: string): Fact[] {
  const facts: Fact[] = [];
  const say = (kind: Fact["kind"], key: string, value: string) => facts.push({ kind, key, value: value.trim().slice(0, 200), source: "guest" });

  const allergy = text.match(/\ballerg(?:ic|y|ies)(?:\s+to)?\s+([a-z][a-z ,&/-]{2,60}?)(?=[.!?]|\s+(?:and i|but|so|please|thanks)\b|$)/i);
  if (allergy) say("dietary", "allergy", allergy[1]!.replace(/\s+and\s+/g, ", "));
  const intolerance = text.match(/\b(gluten|lactose|dairy|nut|peanut|shellfish)[\s-]*(free|intolerant|intolerance)\b/i);
  if (intolerance) say("dietary", "diet", `${intolerance[1]!.toLowerCase()}-free`);
  const diet = text.match(/\b(vegetarian|vegan|pescatarian|halal|kosher)\b/i);
  if (diet) say("dietary", "diet", diet[1]!.toLowerCase());

  const pillow = text.match(/\b(firm|soft|feather[\s-]*free|hypoallergenic|extra)\s+pillows?\b/i);
  if (pillow) say("preference", "pillows", `${pillow[1]!.toLowerCase()} pillows`);
  if (/\bquiet (room|floor)|away from (the )?(elevator|street)|high(er)? floor\b/i.test(text)) say("preference", "room", text.match(/\bquiet (room|floor)|away from (the )?(elevator|street)|high(er)? floor\b/i)![0].toLowerCase());
  if (/\b(room|it)\s+(cold|cool|cooler)\b|\bkeep (the )?(room|ac) (cold|cool)\b/i.test(text)) say("preference", "temperature", "likes the room cool");
  const noHk = text.match(/\b(no|don'?t|do not)\s+(want\s+)?(any\s+)?housekeeping(\s+before\s+(\d{1,2})\s*(am|pm)?)?/i);
  if (noHk) say("preference", "housekeeping", noHk[5] ? `not before ${noHk[5]}${(noHk[6] ?? "am").toLowerCase()}` : "does not want housekeeping unless asked");
  const coffee = text.match(/\b(oat|soy|almond|decaf|black|extra hot|no sugar)\s+(flat white|latte|cappuccino|coffee|tea)/i);
  if (coffee) say("preference", "coffee", `${coffee[1]!.toLowerCase()} ${coffee[2]!.toLowerCase()}`);
  const occasion = text.match(/\b(anniversary|birthday|honeymoon|proposal|engagement|wedding|babymoon|graduation)\b/i);
  if (occasion) say("occasion", occasion[1]!.toLowerCase(), `here for a ${occasion[1]!.toLowerCase()}`);
  if (/\b(late riser|sleep in|sleeping in)\b/i.test(text)) say("preference", "mornings", "sleeps in; avoid early knocks");
  return facts;
}

export function understand(text: string, catalog: Service[]): Understanding {
  const clean = text.trim();
  const when = clean.match(WHEN)?.[0] ?? null;
  const urgentWord = URGENT.test(clean);
  const requests: ProposedRequest[] = [];

  const seen = new Set<RequestKind>();
  for (const rule of RULES) {
    if (!rule.re.test(clean) || seen.has(rule.kind)) continue;
    // A "no housekeeping" preference is not a request for housekeeping.
    if (rule.kind === "housekeeping" && /\b(no|don'?t|do not)\s+(want\s+)?(any\s+)?housekeeping\b/i.test(clean)) continue;
    // "feather-free pillows" is housekeeping, and also matches amenities; keep the first.
    if (rule.kind === "amenities" && seen.has("housekeeping")) continue;
    seen.add(rule.kind);
    const items = itemsIn(clean, rule.kind, catalog);
    requests.push({
      kind: rule.kind,
      summary: summaryFor(rule.kind, items, when, clean),
      items,
      urgent: urgentWord && (rule.kind === "maintenance" || rule.kind === "housekeeping"),
      when,
    });
  }

  const facts = factsIn(clean);
  const escalate = COMPLAINT.test(clean);
  const smallTalk = requests.length === 0 && facts.length === 0 && !escalate && THANKS.test(clean);
  return { requests, facts, escalate, smallTalk };
}
