import crypto from "node:crypto";

/**
 * Texting: the rules that keep David on the right side of guests, and the
 * thin wrapper around Twilio.
 *
 * David never texts first without a yes on file, never texts in the hotel's
 * quiet hours, and always honours STOP. These are product rules as much as
 * legal ones; a concierge that texts a guest at 2am is not a concierge.
 * (Rules differ by country and carrier. Have the hotel's counsel confirm the
 * consent wording they use at booking.)
 */

const STOP = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt-out"]);
const START = new Set(["start", "unstop", "yes", "subscribe"]);
const HELP = new Set(["help", "info"]);

export type Command = "stop" | "start" | "help" | null;

/** Whether a message is one of the words every texting service must honour. */
export function commandOf(body: string): Command {
  const word = body.trim().toLowerCase().replace(/[.!]+$/g, "");
  if (STOP.has(word)) return "stop";
  // "yes" alone is only an opt-in for someone who had opted out.
  if (word === "start" || word === "unstop" || word === "subscribe") return "start";
  if (HELP.has(word)) return "help";
  return null;
}

/** "Yes" and friends are START only for a guest who is currently opted out. */
export function isRestart(body: string): boolean {
  return START.has(body.trim().toLowerCase().replace(/[.!]+$/g, ""));
}

export function stopReply(hotel: string): string {
  return `You're unsubscribed from ${hotel}. You won't get more texts. Reply START to turn them back on.`;
}
export function startReply(hotel: string): string {
  return `Welcome back. ${hotel} texts are on again. Reply STOP any time to opt out.`;
}
export function helpReply(hotel: string): string {
  return `${hotel}: text us anything you need during your stay, like room service, housekeeping or laundry. Reply STOP to opt out.`;
}

/** E.164 from what people and Twilio actually send. Null when it isn't a phone number. */
export function normalizePhone(raw: string, defaultCountry = "1"): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    const d = digits.slice(1);
    return /^[1-9]\d{6,14}$/.test(d) ? `+${d}` : null;
  }
  const d = digits.replace(/^0+/, "");
  if (d.length === 10 && defaultCountry === "1") return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return /^[1-9]\d{6,14}$/.test(d) ? `+${d}` : null;
}

/** Twilio's request signature: HMAC-SHA1 of the URL plus the sorted form fields. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, header: string | undefined): boolean {
  if (!header) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(header);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Everything that can send a text. Production uses Twilio; tests and the demo record. */
export interface SmsProvider {
  send(input: { from: string; to: string; body: string }): Promise<{ sid: string }>;
}

export class TwilioSms implements SmsProvider {
  constructor(private accountSid: string, private authToken: string) {}
  async send({ from, to, body }: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !data.sid) throw new Error(`Twilio refused the message: ${data.message ?? res.status}`);
    return { sid: data.sid };
  }
}

/** Remembers what it was asked to send. For tests and the local demo. */
export class RecordingSms implements SmsProvider {
  sent: { from: string; to: string; body: string; sid: string }[] = [];
  async send(input: { from: string; to: string; body: string }): Promise<{ sid: string }> {
    const sid = `SMdemo${this.sent.length + 1}${Math.random().toString(36).slice(2, 8)}`;
    this.sent.push({ ...input, sid });
    return { sid };
  }
}

/** An empty TwiML reply: acknowledge the webhook, send the real reply separately. */
export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/** Texts over 160 characters are split and cost more; keep David brief. */
export function trimForSms(body: string, max = 480): string {
  const clean = body.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "")) + (stop > max * 0.5 ? "" : "…");
}
