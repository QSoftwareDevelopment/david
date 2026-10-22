import assert from "node:assert/strict";
import { test } from "node:test";
import { commandOf, isRestart, normalizePhone, trimForSms, twilioSignature, validTwilioSignature } from "../src/sms.js";

test("the opt-out words are recognised, whatever the case or punctuation", () => {
  for (const w of ["STOP", "stop", " Stop. ", "UNSUBSCRIBE", "cancel", "End", "QUIT", "stopall"]) assert.equal(commandOf(w), "stop", w);
  assert.equal(commandOf("START"), "start");
  assert.equal(commandOf("help"), "help");
});

test("a sentence that contains stop is not an opt-out", () => {
  for (const w of ["please stop by with towels", "don't stop the minibar restock", "end of the hall"]) assert.equal(commandOf(w), null, w);
});

test("'yes' only restarts someone who had opted out", () => {
  assert.equal(commandOf("yes"), null);
  assert(isRestart("Yes"));
});

test("phone numbers become E.164, or nothing", () => {
  assert.equal(normalizePhone("(416) 555-0111"), "+14165550111");
  assert.equal(normalizePhone("1-416-555-0111"), "+14165550111");
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  assert.equal(normalizePhone("hello"), null);
  assert.equal(normalizePhone("123"), null);
});

test("Twilio signatures verify, and reject any change", () => {
  const params = { From: "+14165550111", Body: "hi", MessageSid: "SM1" };
  const url = "https://example.com/webhooks/twilio/sms";
  const sig = twilioSignature("token", url, params);
  assert(validTwilioSignature("token", url, params, sig));
  assert(!validTwilioSignature("token", url, { ...params, Body: "hello" }, sig));
  assert(!validTwilioSignature("other", url, params, sig));
  assert(!validTwilioSignature("token", url, params, undefined));
});

test("long replies are cut at a sentence, not mid-word", () => {
  const long = "First sentence here. ".repeat(40);
  const out = trimForSms(long, 100);
  assert(out.length <= 101);
  assert(out.endsWith("."));
  assert.equal(trimForSms("  short   text  "), "short text");
});
