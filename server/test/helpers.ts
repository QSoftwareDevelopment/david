import { pgliteDb, migrate } from "../src/db.js";
import { RulesAgent } from "../src/agent.js";
import { RecordingSms } from "../src/sms.js";
import { David } from "../src/service.js";
import { Store } from "../src/store.js";
import { defaultCampaigns } from "../src/campaigns.js";
import type { Hotel } from "../src/types.js";

/** A fresh in-memory database with David wired to a recording phone. */
export async function world(opts: { now?: Date; hotelSlug?: string; withCampaigns?: boolean } = {}) {
  const db = await pgliteDb();
  await db.exec("create role anon; create role authenticated;").catch(() => {});
  await migrate(db);
  const store = new Store(db);
  const sms = new RecordingSms();
  const clock = { now: opts.now ?? new Date("2026-03-10T15:00:00Z") };
  const david = new David(store, sms, new RulesAgent(), () => clock.now);
  const hotel: Hotel = await store.createHotel({ name: "Test Hotel", slug: opts.hotelSlug ?? "test-hotel", timezone: "America/Toronto", smsNumber: "+14165550100", signature: "- David" });
  if (opts.withCampaigns) for (const c of defaultCampaigns(hotel.id)) await store.createCampaign(c);
  return { db, store, sms, david, hotel, clock };
}
