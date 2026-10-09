import { listDueAlerts, markAlertSent, nextPendingAlert } from "./db";
import { sendTelegramMessage } from "./telegram";

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

  setInterval(async () => {
    const now = new Date().toISOString();
    const due = listDueAlerts(now);

    for (const alert of due) {
      const next = nextPendingAlert(alert.reminderId, alert.id);
      const nextWhen = next ? formatIsoDateTime(next.fireAt) : null;
      const message = buildMessage(alert.reminderTitle, alert.reminderDate, alert.reminderTime, nextWhen);
      await sendTelegramMessage(message);
      markAlertSent(alert.id, new Date().toISOString());
    }
  }, intervalSeconds * 1000);

  console.log(`[scheduler] checking for due alerts every ${intervalSeconds}s`);
}
