import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, daysBetween, inQuietHours, localParts, zonedInstant } from "../src/time.js";

test("local parts follow the hotel's zone, not the server's", () => {
  const at = new Date("2026-03-10T03:30:00Z");
  assert.deepEqual(localParts(at, "America/Toronto"), { date: "2026-03-09", hour: 23, minute: 30, weekday: 1 });
  assert.equal(localParts(at, "Asia/Kolkata").date, "2026-03-10");
});

test("quiet hours can wrap midnight", () => {
  assert(inQuietHours({ hour: 22 }, 21, 8));
  assert(inQuietHours({ hour: 3 }, 21, 8));
  assert(!inQuietHours({ hour: 8 }, 21, 8));
  assert(!inQuietHours({ hour: 14 }, 21, 8));
  assert(inQuietHours({ hour: 2 }, 1, 5));
  assert(!inQuietHours({ hour: 5 }, 1, 5));
});

test("date arithmetic crosses months and leap days", () => {
  assert.equal(addDays("2026-02-27", 3), "2026-03-02");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(daysBetween("2026-03-01", "2026-03-10"), 9);
});

test("a local hour becomes the right instant either side of daylight saving", () => {
  assert.equal(zonedInstant("2026-01-15", 10, "America/Toronto").toISOString(), "2026-01-15T15:00:00.000Z");
  assert.equal(zonedInstant("2026-07-15", 10, "America/Toronto").toISOString(), "2026-07-15T14:00:00.000Z");
});
