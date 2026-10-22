import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { ClaudeAgent, RulesAgent, type AgentContext, type ComposeContext } from "../src/agent.js";
import type { Campaign, Guest, Hotel, Stay } from "../src/types.js";

const hotel: Hotel = { id: "h", name: "Test Hotel", slug: "t", timezone: "America/Toronto", smsNumber: null, tone: "warm", signature: "- David", quietStart: 21, quietEnd: 8, checkinTime: "15:00", checkoutTime: "11:00" };
const guest: Guest = { id: "g", hotelId: "h", phone: "+14165550111", firstName: "Sam", lastName: null, language: "en", consent: "opted_in", consentAt: null, vip: false, notes: null, createdAt: "" };
const stay: Stay = { id: "s", hotelId: "h", guestId: "g", room: "804", arrival: "2026-03-13", departure: "2026-03-16", partySize: 2, status: "booked", notes: null };
const now = new Date("2026-03-10T15:00:00Z");
const ctx = (inbound: string): AgentContext => ({
  hotel, guest, stay, memories: [], catalog: [], openRequests: [], inbound, now, pastStays: 1,
  thread: [{ id: "m", hotelId: "h", guestId: "g", direction: "in", author: "guest", body: inbound, status: "received", campaignId: null, createdAt: now.toISOString() }],
});

type Reply = { content: Anthropic.ContentBlock[]; stop_reason: "tool_use" | "end_turn" };
const text = (t: string): Anthropic.ContentBlock => ({ type: "text", text: t, citations: null } as Anthropic.ContentBlock);
const use = (id: string, name: string, input: unknown): Anthropic.ContentBlock => ({ type: "tool_use", id, name, input } as Anthropic.ContentBlock);

/** A fake Claude that answers from a script and records what it was sent. */
function fake(script: Reply[] | Error) {
  const calls: any[] = [];
  const client = {
    messages: {
      create: async (params: any) => {
        calls.push(JSON.parse(JSON.stringify(params)));
        if (script instanceof Error) throw script;
        const next = script[calls.length - 1] ?? script[script.length - 1]!;
        return next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

test("the model's tool calls become requests and memories, and its words become the reply", async () => {
  const f = fake([
    { stop_reason: "tool_use", content: [text("Let me arrange that."), use("t1", "record_request", { kind: "housekeeping", summary: "Two extra pillows, firm", items: ["pillows"], urgent: false, when: "tonight" }), use("t2", "remember", { kind: "preference", key: "Pillows", value: "firm pillows" })] },
    { stop_reason: "end_turn", content: [text("Of course Sam, firm pillows are on their way tonight.")] },
  ]);
  const r = await new ClaudeAgent("key", "claude-sonnet-5-5", new RulesAgent(), f.client).respond(ctx("Two extra firm pillows tonight please"));
  assert.equal(r.source, "claude");
  assert.equal(r.reply, "Of course Sam, firm pillows are on their way tonight.");
  assert.deepEqual(r.requests.map((x) => [x.kind, x.summary, x.when]), [["housekeeping", "Two extra pillows, firm", "tonight"]]);
  assert.deepEqual(r.facts.map((x) => [x.kind, x.key, x.value, x.source]), [["preference", "pillows", "firm pillows", "guest"]]);
  assert.equal(f.calls.length, 2);
  const second = f.calls[1].messages.at(-1);
  assert.equal(second.role, "user");
  assert.deepEqual(second.content.map((b: any) => [b.type, b.tool_use_id]), [["tool_result", "t1"], ["tool_result", "t2"]]);
});

test("what the model is told: the hotel, the voice, the guest's memory and the rules", async () => {
  const f = fake([{ stop_reason: "end_turn", content: [text("Hello Sam")] }]);
  const memories = [{ id: "1", guestId: "g", kind: "dietary" as const, key: "allergy", value: "shellfish", confidence: 0.95, evidence: 1, source: "guest" as const, hidden: false, firstSeen: "", lastSeen: now.toISOString() }];
  await new ClaudeAgent("key", "claude-sonnet-5-5", new RulesAgent(), f.client).respond({ ...ctx("hi"), memories });
  const call = f.calls[0];
  assert.equal(call.model, "claude-sonnet-5-5");
  assert(call.max_tokens <= 1000);
  assert.deepEqual(call.tools.map((t: any) => t.name), ["record_request", "remember", "escalate"]);
  assert.match(call.system, /Test Hotel/);
  assert.match(call.system, /Voice: warm/);
  assert.match(call.system, /DIETARY: allergy: shellfish/);
  assert.match(call.system, /Previous stays at this hotel: 1/);
  assert.match(call.system, /Never invent hotel facts/);
  assert.deepEqual(call.messages, [{ role: "user", content: "hi" }]);
});

test("invalid tool input is ignored rather than trusted", async () => {
  const f = fake([
    { stop_reason: "tool_use", content: [use("t1", "record_request", { kind: "teleport", summary: "x" }), use("t2", "remember", { kind: "preference", key: "", value: "x" }), use("t3", "delete_everything", {})] },
    { stop_reason: "end_turn", content: [text("Done.")] },
  ]);
  const r = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).respond(ctx("hello"));
  assert.deepEqual([r.requests.length, r.facts.length, r.escalate], [0, 0, false]);
  assert.equal(r.reply, "Done.");
});

test("an escalation from the model is passed on", async () => {
  const f = fake([
    { stop_reason: "tool_use", content: [use("t1", "escalate", { reason: "guest is upset" })] },
    { stop_reason: "end_turn", content: [text("I'm sorry, a manager will text you shortly.")] },
  ]);
  const r = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).respond(ctx("this is awful"));
  assert.equal(r.escalate, true);
});

test("if the model fails, the rules agent answers, so the guest is never left on read", async () => {
  const f = fake(new Error("overloaded"));
  const r = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).respond(ctx("extra towels please"));
  assert.equal(r.source, "rules");
  assert.equal(r.requests[0]!.kind, "housekeeping");
  assert(r.reply.length > 0);
});

test("a model that says nothing falls back too", async () => {
  const f = fake([{ stop_reason: "end_turn", content: [] }]);
  const r = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).respond(ctx("extra towels please"));
  assert.equal(r.source, "rules");
});

test("a model stuck in tool calls is cut off after a few rounds", async () => {
  const f = fake([{ stop_reason: "tool_use", content: [text("working"), use("t", "remember", { kind: "preference", key: "a", value: "b" })] }]);
  const r = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).respond(ctx("hi"));
  assert.equal(f.calls.length, 4);
  assert.equal(r.reply, "working");
});

const campaign: Campaign = { id: "c", hotelId: "h", name: "Before you arrive", kind: "pre_arrival", enabled: true, offsetDays: -3, sendHour: 10, messageMode: "generated", template: "", guidance: "mention the rooftop bar", audience: {} };
const composeCtx = (p: Partial<ComposeContext> = {}): ComposeContext => ({ hotel, guest, stay, memories: [], campaign, now, pastStays: 1, firstOutbound: true, ...p });

test("a generated campaign message comes from the model, with the opt-out added on a first text", async () => {
  const f = fake([{ stop_reason: "end_turn", content: [text('"Hi Sam, we are looking forward to Friday. Anything to prepare?"')] }]);
  const out = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).compose(composeCtx());
  assert.equal(out, "Hi Sam, we are looking forward to Friday. Anything to prepare? - David Reply STOP to opt out.");
  assert.match(f.calls[0].messages[0].content, /mention the rooftop bar/);
  assert.match(f.calls[0].system, /at most 300 characters/);
});

test("the hotel's own words are never rewritten by the model", async () => {
  const f = fake([{ stop_reason: "end_turn", content: [text("should not be used")] }]);
  const custom = { ...campaign, messageMode: "custom" as const, template: "Hi {first_name}, welcome to {hotel}." };
  const out = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).compose(composeCtx({ campaign: custom, firstOutbound: false }));
  assert.equal(out, "Hi Sam, welcome to Test Hotel. - David");
  assert.equal(f.calls.length, 0);
});

test("a failed campaign draft falls back to the rules version", async () => {
  const f = fake(new Error("timeout"));
  const out = await new ClaudeAgent("key", "m", new RulesAgent(), f.client).compose(composeCtx());
  assert.match(out, /Welcome back/);
});
