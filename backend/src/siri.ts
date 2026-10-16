import type { AlertInput, ReminderInput } from "./types";

/**
 * Reminders from an iPhone Shortcut. The shortcut sends the title, the date
 * and time it understood, and an alert preset name; the alerts themselves
 * are worked out here. Times are local to the server's TZ.
 */

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

type Preset = "normal" | "hora" | "1h" | "1d";

// Spoken names, as Siri may write them, for each preset.
const PRESET_NAMES: Record<string, Preset> = {
  normal: "normal",
  "": "normal",
  hora: "hora",
  "a la hora": "hora",
  "solo a la hora": "hora",
  "1h": "1h",
  "1 hora antes": "1h",
  "una hora antes": "1h",
  "1d": "1d",
  "1 dia antes": "1d",
  "un dia antes": "1d",
};

function presetFrom(value: unknown): Preset | null {
  const key = (typeof value === "string" ? value : "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return PRESET_NAMES[key] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A local date at a local time, e.g. 3 days before at 10:00. */
function daysBeforeAt(event: Date, days: number, hours: number, minutes: number): Date {
  return new Date(event.getFullYear(), event.getMonth(), event.getDate() - days, hours, minutes);
}

/** Same wording as the app's alert labels. */
function labelFor(event: Date, fire: Date): string {
  const dayOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dayOf(event) - dayOf(fire)) / DAY_MS);
  if (diffDays === 0) return fire.getTime() === event.getTime() ? "Mismo momento" : "Mismo día";
  if (diffDays === 1) return "1 día antes";
  if (diffDays > 1) return `${diffDays} días antes`;
  return diffDays === -1 ? "1 día después" : `${-diffDays} días después`;
}

export function alertsFor(event: Date, preset: Preset, now: Date): AlertInput[] {
  const times: Date[] = {
    normal: [daysBeforeAt(event, 3, 10, 0), daysBeforeAt(event, 1, 10, 0), new Date(event.getTime() - 5 * HOUR_MS)],
    hora: [event],
    "1h": [new Date(event.getTime() - HOUR_MS)],
    "1d": [new Date(event.getFullYear(), event.getMonth(), event.getDate() - 1, event.getHours(), event.getMinutes())],
  }[preset];

  // Alerts already in the past are dropped; if none is left, one at the event itself.
  const unique = [...new Map(times.filter((t) => t > now).map((t) => [t.getTime(), t])).values()].sort(
    (a, b) => a.getTime() - b.getTime()
  );
  const fires = unique.length ? unique : event > now ? [event] : [];
  return fires.map((fire) => ({ label: labelFor(event, fire), fireAt: fire.toISOString() }));
}

function describe(d: Date): string {
  return `el ${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} a las ${localTime(d)}`;
}

export type SiriResult =
  | { ok: false; error: string; speak: string }
  | { ok: true; input: ReminderInput; speak: string };

/** Validates the shortcut's request and works out the reminder and its alerts. */
export function plan(body: any, now = new Date()): SiriResult {
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return { ok: false, error: "title is required", speak: "No he entendido qué tengo que recordarte." };
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const time = typeof body?.time === "string" ? body.time.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) {
    return { ok: false, error: "date must be YYYY-MM-DD and time HH:mm", speak: "No he entendido la fecha o la hora." };
  }
  const preset = presetFrom(body?.alerts);
  if (!preset) return { ok: false, error: "unknown alerts preset", speak: "No conozco ese tipo de aviso." };

  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const event = new Date(y, m - 1, d, hh, mm);
  if (Number.isNaN(event.getTime()) || localDate(event) !== date) return { ok: false, error: "invalid date", speak: "Esa fecha no existe." };
  if (event <= now) return { ok: false, error: "that time has already passed", speak: "Esa fecha y hora ya han pasado." };

  const alerts = alertsFor(event, preset, now);
  const input: ReminderInput = { title, date: localDate(event), time: localTime(event), alerts };
  const alertText = alerts.length
    ? alerts.map((a) => `${a.label.toLowerCase()} a las ${localTime(new Date(a.fireAt))}`).join(", ")
    : "sin avisos";
  return { ok: true, input, speak: `"${title}", ${describe(event)}. Avisos: ${alertText}.` };
}
