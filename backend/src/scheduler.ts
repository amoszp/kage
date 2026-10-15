import { AccountsUnavailable, getUserDetails } from "./auth";
import { listDueAlerts, markAlertSent, nextPendingAlert } from "./db";
import { sendTelegramMessage } from "./telegram";

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

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} de ${MONTHS_ES[month - 1]}`;
}

function formatIsoDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = `${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function buildMessage(
  title: string,
  date: string,
  time: string,
  next: { date: string; time: string } | null
): string {
  const lines = [
    "💥Chacho espabila:",
    "",
    `✨${title}`,
    `📅${formatDate(date)}`,
    `🕰️${time}`,
  ];
  if (next) {
    lines.push("", "🟩Siguiente Aviso:", `📅${next.date}`, `🕰️${next.time}`);
  }
  return lines.join("\n");
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
    const next = nextPendingAlert(alert.reminderId, alert.id);
    const nextWhen = next ? formatIsoDateTime(next.fireAt) : null;
    const message = buildMessage(alert.reminderTitle, alert.reminderDate, alert.reminderTime, nextWhen);
    if (chatId) await sendTelegramMessage(message, chatId);
    else console.warn(`[scheduler] no Telegram chat for user ${alert.reminderUserId}, alert ${alert.id} skipped`);
    markAlertSent(alert.id, new Date().toISOString());
  }
}
