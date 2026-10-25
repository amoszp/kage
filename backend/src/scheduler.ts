import { AccountsUnavailable, getUserDetails } from "./auth";
import { addAlert, getReminder, listDueAlerts, markAlertSent, setReminderCompleted } from "./db";
import { answerCallback, editTelegramMessage, sendTelegramMessage, startTelegramPolling, type CallbackQuery } from "./telegram";

const LEGACY_OWNER = (process.env.LEGACY_OWNER_USERNAME ?? "").trim().toLowerCase();
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

// Each reminder goes to its owner's Telegram chat. The chat in the env file is
// kept for the original user (and for reminders not yet claimed by anyone).
async function chatFor(userId: number | null): Promise<string | null> {
  if (userId === null) return DEFAULT_CHAT_ID;
  const user = await getUserDetails(userId);
  if (!user || user.disabled) return null;
  if (user.telegramChatId) return user.telegramChatId;
  return user.username === LEGACY_OWNER ? DEFAULT_CHAT_ID : null;
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS_EN[month - 1]}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function buildMessage(title: string, date: string, time: string): string {
  return [`✨${title}`, `📅${formatDate(date)}`, `🕰️${time}`].join("\n");
}

export const BUTTONS = (reminderId: number) => [
  { text: "✅ Completed", callback_data: `done:${reminderId}` },
  { text: "🔁 Remind me tomorrow", callback_data: `tomorrow:${reminderId}` },
];

// A tap on one of the alert's buttons. Only the reminder owner's own chat can act on it.
export async function handleTap(q: CallbackQuery): Promise<void> {
  const match = /^(done|tomorrow):(\d+)$/.exec(q.data ?? "");
  const msg = q.message;
  if (!match || !msg) return answerCallback(q.id);
  const reminder = getReminder(Number(match[2]));
  if (!reminder || String(msg.chat.id) !== (await chatFor(reminder.userId))) {
    return answerCallback(q.id, "This reminder no longer exists.");
  }
  const original = msg.text ?? buildMessage(reminder.title, reminder.date, reminder.time);
  if (match[1] === "done") {
    setReminderCompleted(reminder.id, true);
    await editTelegramMessage(msg.chat.id, msg.message_id, `${original}\n\n✅ Completed`);
    return answerCallback(q.id, "Completed");
  }
  // Same clock time as this alert went out, one day later.
  const fireAt = new Date(msg.date * 1000);
  fireAt.setSeconds(0, 0);
  fireAt.setDate(fireAt.getDate() + 1);
  addAlert(reminder.id, { label: "Recordar mañana", fireAt: fireAt.toISOString() });
  await editTelegramMessage(msg.chat.id, msg.message_id, `${original}\n\n🔁 I'll remind you tomorrow at ${hhmm(fireAt)}`);
  return answerCallback(q.id, `Tomorrow at ${hhmm(fireAt)}`);
}

export function startScheduler(): void {
  const intervalSeconds = Number(process.env.SCHEDULER_INTERVAL_SECONDS ?? 30);

  // One round at a time: a slow Telegram or accounts call must not let the
  // next tick pick up (and send) the same alerts again.
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runRound();
    } catch (err) {
      console.error("[scheduler] round failed:", err);
    } finally {
      running = false;
    }
  }, intervalSeconds * 1000);

  console.log(`[scheduler] checking for due alerts every ${intervalSeconds}s`);
  startTelegramPolling((q) => handleTap(q));
}

async function runRound(): Promise<void> {
  const now = new Date().toISOString();
  const due = listDueAlerts(now);

  for (const alert of due) {
    let chatId: string | null;
    try {
      chatId = await chatFor(alert.reminderUserId);
    } catch (err) {
      // Leave the alert unsent; the next round tries again.
      if (err instanceof AccountsUnavailable) {
        console.error("[scheduler] accounts service unavailable, retrying later");
        return;
      }
      throw err;
    }
    const message = buildMessage(alert.reminderTitle, alert.reminderDate, alert.reminderTime);
    if (chatId) await sendTelegramMessage(message, chatId, BUTTONS(alert.reminderId));
    else console.warn(`[scheduler] no Telegram chat for user ${alert.reminderUserId}, alert ${alert.id} skipped`);
    markAlertSent(alert.id, new Date().toISOString());
  }
}
