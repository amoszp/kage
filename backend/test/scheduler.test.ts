import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.TZ = "Atlantic/Canary";
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "kage-")), "test.db");
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_CHAT_ID = "111";

// Every Bot API call is recorded instead of sent.
const calls: { method: string; body: any }[] = [];
globalThis.fetch = (async (url: string, init: { body: string }) => {
  calls.push({ method: String(url).split("/").pop()!, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;

const { buildMessage, handleTap } = require("../src/scheduler");
const { createReminder, getReminder } = require("../src/db");

// No owner: its alerts go to the chat in the env file (111).
const newReminder = () =>
  createReminder({ title: "ATOS: enviar dimisión", date: "2026-10-28", time: "09:00", alerts: [] }, null);

const TEXT = "✨ATOS: enviar dimisión\n📅28 October\n🕰️09:00";
const SENT_AT = new Date(2026, 9, 27, 8, 0, 30); // alert went out Tue 27 Oct 08:00:30 local

function tap(data: string, chatId = 111) {
  calls.length = 0;
  return handleTap({ id: "cb1", data, message: { message_id: 7, date: SENT_AT.getTime() / 1000, text: TEXT, chat: { id: chatId } } });
}

test("alert text is the title, date and time only", () => {
  assert.equal(buildMessage("ATOS: enviar dimisión", "2026-10-28", "09:00"), TEXT);
});

test("✅ completes the reminder and edits the message", async () => {
  const r = newReminder();
  await tap(`done:${r.id}`);
  assert.ok(getReminder(r.id).completedAt);
  const edit = calls.find((c) => c.method === "editMessageText")!;
  assert.equal(edit.body.text, `${TEXT}\n\n✅ Completed`);
  assert.equal(edit.body.reply_markup, undefined);
  assert.ok(calls.some((c) => c.method === "answerCallbackQuery"));
});

test("🔁 adds an alert for the same time tomorrow", async () => {
  const r = newReminder();
  await tap(`tomorrow:${r.id}`);
  const alert = getReminder(r.id).alerts.at(-1);
  assert.equal(alert.label, "Recordar mañana");
  assert.equal(new Date(alert.fireAt).getTime(), new Date(2026, 9, 28, 8, 0).getTime());
  const edit = calls.find((c) => c.method === "editMessageText")!;
  assert.equal(edit.body.text, `${TEXT}\n\n🔁 I'll remind you tomorrow at 08:00`);
});

test("a tap from another chat changes nothing", async () => {
  const r = newReminder();
  await tap(`done:${r.id}`, 999);
  assert.equal(getReminder(r.id).completedAt, null);
  assert.ok(!calls.some((c) => c.method === "editMessageText"));
  assert.ok(calls.some((c) => c.method === "answerCallbackQuery"));
});
