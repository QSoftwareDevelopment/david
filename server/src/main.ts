import { serve } from "@hono/node-server";
import { chooseAgent } from "./agent.js";
import { makeVerifier } from "./auth.js";
import { migrate, pgDb, pgliteDb } from "./db.js";
import { createApp } from "./http.js";
import { seedDemo } from "./seed.js";
import { David } from "./service.js";
import { RecordingSms, TwilioSms } from "./sms.js";
import { Store } from "./store.js";

const env = process.env;
const demo = env.DAVID_DEMO === "1";
const port = Number(env.PORT ?? 8787);

const db = demo ? await pgliteDb(env.DAVID_DATA_DIR) : await pgDb(env.DATABASE_URL ?? (() => { throw new Error("DATABASE_URL is required (or run with DAVID_DEMO=1)."); })());
if (demo || env.DAVID_MIGRATE === "1") console.log("migrations:", (await migrate(db)).join(", "));
const store = new Store(db);

const clock = { now: new Date(), offsetMs: 0 };
const now = () => new Date(Date.now() + clock.offsetMs);

const recorder = demo || !env.TWILIO_ACCOUNT_SID ? new RecordingSms() : undefined;
const sms = recorder ?? new TwilioSms(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
if (!demo && !env.TWILIO_ACCOUNT_SID) console.warn("No TWILIO_ACCOUNT_SID: texts will be recorded, not sent.");

const david = new David(store, sms, chooseAgent(env), now);
if (demo) {
  const hotel = await seedDemo(store, now());
  console.log(`demo hotel ready: ${hotel.name}`);
}

const app = createApp({
  store, david, demo,
  cronSecret: env.CRON_SECRET,
  twilioAuthToken: env.TWILIO_AUTH_TOKEN,
  publicUrl: env.PUBLIC_URL,
  verify: makeVerifier(env),
  corsOrigins: env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
  recorder, clock,
});

serve({ fetch: app.fetch, port }, () => console.log(`David is listening on :${port} (${demo ? "demo" : "live"}, agent: ${env.ANTHROPIC_API_KEY && env.DAVID_AGENT !== "rules" ? "claude" : "rules"})`));
