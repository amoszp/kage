import { plan } from "./siri";
import type { ReminderInput } from "./types";

/**
 * Two-step voice conversation for a minimal iPhone Shortcut:
 *   1. `say(text)` with everything the user said, e.g.
 *      "dentista el viernes a las cinco de la tarde, una hora antes",
 *      answers with the sentence to read back and a question;
 *   2. `answer(text)` with the user's reply ("sí", "no", or the missing time)
 *      finishes it.
 * The open question is kept per user for a few minutes.
 */

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const HOUR_WORDS: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
const HOUR = `(\\d{1,2}|${Object.keys(HOUR_WORDS).join("|")})`;
const PERIOD = "(de la manana|de la madrugada|de la tarde|de la noche|del mediodia|p ?m|a ?m)";

type Preset = "normal" | "hora" | "1h" | "1d";

export interface Spoken {
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  preset: Preset;
  /** The date wasn't said: it was worked out from the time alone. */
  dateGuessed: boolean;
}

/** Lowercase, no accents, punctuation as spaces. Same length as the input. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9:/ ]/g, " ");
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function hourValue(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : HOUR_WORDS[word];
}

/** 24-hour clock from what was said; bare 1–6 is taken as the afternoon. */
function toClock(h: number, m: number, period: string | undefined): [number, number] {
  const p = (period ?? "").replace(/\s/g, "");
  if (["delatarde", "delanoche", "pm"].includes(p) && h < 12) h += 12;
  else if (["delamanana", "delamadrugada", "am"].includes(p) && h === 12) h = 0;
  else if (!p && h >= 1 && h <= 6) h += 12;
  return [h, m];
}

/** A day of the month; with no year (or month) said and already past, the next one. Null if it doesn't exist. */
function dayOfMonth(today: Date, day: number, monthPart: string, yearPart: string): Date | null {
  const month = monthPart ? (/^\d+$/.test(monthPart) ? Number(monthPart) - 1 : MONTHS.indexOf(monthPart)) : today.getMonth();
  const year = yearPart ? Number(yearPart.length === 2 ? `20${yearPart}` : yearPart) : today.getFullYear();
  let d = new Date(year, month, day);
  if (d < today && !yearPart) d = monthPart ? new Date(year + 1, month, day) : new Date(year, month + 1, day);
  return d.getDate() === day ? d : null;
}

/**
 * Pulls the date, time and alert preset out of a spoken sentence; what is
 * left is the title. Missing date or time come back as null.
 */
export function parseSpoken(text: string, now: Date): Spoken {
  const original = text.normalize("NFC");
  let f = fold(original);
  // Folding should keep the length; if some character didn't, work on the folded text alone.
  let source = f.length === original.length ? original : f;
  const cut = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(f);
    if (!m) return null;
    const blank = " ".repeat(m[0].length);
    f = f.slice(0, m.index) + blank + f.slice(m.index + m[0].length);
    source = source.slice(0, m.index) + blank + source.slice(m.index + m[0].length);
    return m;
  };

  // ---- alerts ----
  let preset: Preset = "normal";
  if (cut(/\b(?:con (?:un )?aviso )?(?:una|1) hora antes\b/)) preset = "1h";
  else if (cut(/\b(?:con (?:un )?aviso )?(?:un|1) dia antes\b/)) preset = "1d";
  else if (cut(/\b(?:solo |solamente )?(?:con aviso )?a la hora(?: exacta| justa| del evento)?\b/)) preset = "hora";
  cut(/\b(?:con )?avisos? normal(?:es)?\b/);

  // ---- time ----
  let time: [number, number] | null = null;
  let m: RegExpExecArray | null;
  if ((m = cut(new RegExp(`\\b(?:a las|a la|sobre las|sobre la|para las|para la|hacia las)\\s+${HOUR}(?:[:h](\\d{2}))?(?:\\s*(?:h|horas))?(?:\\s+(y media|y cuarto|menos cuarto|en punto))?(?:\\s+${PERIOD})?\\b`)))) {
    let h = hourValue(m[1]);
    let min = m[2] ? Number(m[2]) : 0;
    if (m[3] === "y media") min = 30;
    else if (m[3] === "y cuarto") min = 15;
    else if (m[3] === "menos cuarto") { h -= 1; min = 45; }
    time = toClock(h, min, m[4]);
  } else if ((m = cut(new RegExp(`\\b(\\d{1,2}):(\\d{2})(?:\\s+${PERIOD})?\\b`)))) {
    time = toClock(Number(m[1]), Number(m[2]), m[3]);
  } else if (cut(/\b(?:a|al) mediodia\b/)) {
    time = [12, 0];
  }

  // ---- date ----
  let date: Date | null = null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const part = cut(/\b(?:esta|por la|de la) (manana|tarde|noche)\b/);
  if (part) {
    const isThis = part[0].startsWith("esta");
    if (isThis) date = today;
    if (time && part[1] !== "manana" && time[0] < 12) time = [time[0] + 12, time[1]];
    if (!time) time = part[1] === "manana" ? [9, 0] : part[1] === "tarde" ? [17, 0] : [21, 0];
  }
  if (cut(/\bpasado manana\b/)) date = addDays(today, 2);
  else if (cut(/\bmanana\b/)) date = addDays(today, 1);
  else if (cut(/\bhoy\b/)) date = today;
  else if ((m = cut(new RegExp(`\\b(?:el |este |el proximo |el que viene )?(${WEEKDAYS.join("|")})(?: que viene| proximo)?(?: (?:dia )?(\\d{1,2})(?! ?:))?\\b`)))) {
    // "el viernes 23": the day of the month is what counts.
    if (m[2]) date = dayOfMonth(today, Number(m[2]), "", "");
    else {
      let diff = (WEEKDAYS.indexOf(m[1]) - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      date = addDays(today, diff);
    }
  }
  if ((m = cut(/\b(?:el dia |el |dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)) ||
      (m = cut(new RegExp(`\\b(?:el dia |el |dia )?(\\d{1,2}) de (${MONTHS.join("|")})(?: de (\\d{4}))?\\b`))) ||
      (m = cut(/\b(?:el dia |el |dia )(\d{1,2})()()\b(?! ?:)/))) {
    date = dayOfMonth(today, Number(m[1]), m[2], m[3]);
  }
  const dateGuessed = !date;

  // Only a time: today if it's still ahead, otherwise tomorrow.
  if (time && !date) {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), time[0], time[1]);
    date = at > now ? today : addDays(today, 1);
  }

  // ---- title: what's left ----
  let title = source
    .replace(/[.,;:!?¿¡]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  title = title.replace(/^(?:recu[eé]rdame|recordatorio|recordar|av[ií]same)\s+(?:que\s+|de\s+|para\s+)?/i, "");
  const dangling = /^(?:el|la|los|las|a|para|de|y|con|que)$/i;
  const words = title.split(" ").filter(Boolean);
  while (words.length && dangling.test(words[words.length - 1])) words.pop();
  while (words.length && dangling.test(words[0]) && words.length > 1) words.shift();
  title = words.join(" ");
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    title,
    date: date ? ymd(date) : null,
    time: time && time[0] < 24 && time[1] < 60 ? `${pad(time[0])}:${pad(time[1])}` : null,
    preset,
    dateGuessed,
  };
}

// ---------- the conversation ----------

const YES = /^(si|sip|vale|ok|okay|claro|dale|venga|correcto|perfecto|guardalo|guarda|hazlo|de acuerdo|yes|afirmativo|por favor)\b/;
const NO = /^(no|nop|nada|cancela|cancelar|dejalo|olvidalo)\b/;

export const isYes = (text: string) => YES.test(fold(text).trim());
export const isNo = (text: string) => NO.test(fold(text).trim());

type Pending =
  | { kind: "confirm"; input: ReminderInput }
  | { kind: "when"; spoken: Spoken };

const PENDING_MS = 10 * 60_000;
const pending = new Map<number, { value: Pending; until: number }>();

function takePending(userId: number): Pending | null {
  const entry = pending.get(userId);
  pending.delete(userId);
  return entry && entry.until > Date.now() ? entry.value : null;
}

function keep(userId: number, value: Pending): void {
  pending.set(userId, { value, until: Date.now() + PENDING_MS });
}

/** Checks the reminder and, if it's complete, asks to confirm it. */
function preview(userId: number, spoken: Spoken, now: Date): string {
  const result = plan({ title: spoken.title, date: spoken.date, time: spoken.time, alerts: spoken.preset }, now);
  if (!result.ok) return result.speak;
  keep(userId, { kind: "confirm", input: result.input });
  return `${result.speak} ¿Lo guardo?`;
}

export function say(userId: number, text: string, now = new Date()): string {
  pending.delete(userId);
  const spoken = parseSpoken(text, now);
  if (!spoken.title) return "No he entendido qué tengo que recordarte.";
  if (!spoken.date || !spoken.time) {
    keep(userId, { kind: "when", spoken });
    return spoken.date ? `"${spoken.title}". ¿A qué hora?` : `"${spoken.title}". ¿Para qué día y hora?`;
  }
  return preview(userId, spoken, now);
}

export function answer(userId: number, text: string, save: (input: ReminderInput) => void, now = new Date()): string {
  const open = takePending(userId);
  if (!open) return "No tenía nada pendiente. Empieza de nuevo.";

  if (open.kind === "confirm") {
    if (isYes(text)) {
      save(open.input);
      return "Guardado.";
    }
    return "Vale, no lo guardo.";
  }

  // The missing day or time; the reply is short, so it's saved without asking again.
  if (isNo(text)) return "Vale, no lo guardo.";
  const reply = parseSpoken(text, now);
  const date = (!reply.dateGuessed && reply.date) || open.spoken.date || reply.date;
  const time = reply.time ?? open.spoken.time;
  if (!date || !time) return "No he entendido cuándo. No lo he guardado.";
  const result = plan({ title: open.spoken.title, date, time, alerts: open.spoken.preset }, now);
  if (!result.ok) return result.speak;
  save(result.input);
  return `Guardado: ${result.speak}`;
}

/** Query text from a shortcut, which may arrive encoded once more than needed. */
export function queryText(value: unknown): string {
  let text = typeof value === "string" ? value : "";
  for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(text); i++) {
    try {
      text = decodeURIComponent(text);
    } catch {
      break;
    }
  }
  return text.trim().slice(0, 300);
}
