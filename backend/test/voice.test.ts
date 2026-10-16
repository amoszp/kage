import { test } from "node:test";
import assert from "node:assert/strict";
import { answer, parseSpoken, queryText, say } from "../src/voice";
import type { ReminderInput } from "../src/types";

process.env.TZ = "Atlantic/Canary";
const NOW = new Date(2026, 9, 16, 15, 0); // Fri 16 Oct 2026, 15:00

const p = (text: string) => {
  const { title, date, time, alerts } = parseSpoken(text, NOW);
  return { title, date, time, alerts };
};

test("whole sentences as Siri writes them", () => {
  assert.deepEqual(p("Dentista el viernes a las cinco de la tarde"), { title: "Dentista", date: "2026-10-23", time: "17:00", alerts: { normal: true } });
  assert.deepEqual(p("recuérdame llamar a mamá mañana a las 10"), { title: "Llamar a mamá", date: "2026-10-17", time: "10:00", alerts: { normal: true } });
  assert.deepEqual(p("Peluquería el martes 27 a las 17:30, una hora antes"), { title: "Peluquería", date: "2026-10-27", time: "17:30", alerts: { normal: false, before: [60] } });
  assert.deepEqual(p("ITV el 3 de noviembre a las 9 y media un día antes"), { title: "ITV", date: "2026-11-03", time: "09:30", alerts: { normal: false, before: [1440] } });
  assert.deepEqual(p("Pádel pasado mañana a las 8 de la noche solo a la hora"), { title: "Pádel", date: "2026-10-18", time: "20:00", alerts: { normal: false, before: [0] } });
  assert.deepEqual(p("cena con Gianca esta noche"), { title: "Cena con Gianca", date: "2026-10-16", time: "21:00", alerts: { normal: true } });
  assert.deepEqual(p("Reunión el 20/11 a las 12"), { title: "Reunión", date: "2026-11-20", time: "12:00", alerts: { normal: true } });
});

test("several alerts in one sentence", () => {
  assert.deepEqual(p("Dentista el viernes a las 5, un día antes y una hora antes"), {
    title: "Dentista", date: "2026-10-23", time: "17:00", alerts: { normal: false, before: [1440, 60] },
  });
  assert.deepEqual(p("Vuelo el 3 de noviembre a las 9 y media con avisos normales y 30 minutos antes").alerts, { normal: true, before: [30] });
  assert.deepEqual(p("Cita mañana a las 10 dos días antes, media hora antes y a la hora").alerts, { normal: false, before: [2880, 30, 0] });
  assert.equal(p("Vuelo el 3 de noviembre a las 9 y media con avisos normales y 30 minutos antes").time, "09:30");
});

test("several alerts are read back and saved", () => {
  const saved: ReminderInput[] = [];
  const q = say(5, "Dentista el viernes a las 5, un día antes y una hora antes", NOW);
  assert.match(q, /Avisos: 1 día antes a las 17:00, mismo día a las 16:00\. ¿Lo guardo\?$/);
  answer(5, "sí", (i) => saved.push(i), NOW);
  assert.equal(saved[0].alerts.length, 2);
});

test("bare hours 1-6 are the afternoon; a past time alone means tomorrow", () => {
  assert.equal(p("café a las 4").time, "16:00");
  assert.equal(p("café a las 4").date, "2026-10-16");
  assert.equal(p("gimnasio a las 7").time, "07:00");
  assert.equal(p("gimnasio a las 7").date, "2026-10-17");
  assert.equal(p("medicina a las 10 de la mañana").time, "10:00");
});

test("weekday said on that same day means next week; a past day of the month means next month", () => {
  assert.equal(p("algo el viernes a las 10").date, "2026-10-23");
  assert.equal(p("algo el día 2 a las 10").date, "2026-11-02");
});

test("conversation: preview, then yes saves", () => {
  const saved: ReminderInput[] = [];
  const q = say(1, "Dentista el viernes a las cinco de la tarde", NOW);
  assert.match(q, /"Dentista", el viernes 23 de octubre a las 17:00\. Avisos: .*¿Lo guardo\?$/);
  assert.equal(answer(1, "Sí", (i) => saved.push(i), NOW), "Guardado.");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].time, "17:00");
  // Nothing left open afterwards.
  assert.match(answer(1, "sí", (i) => saved.push(i), NOW), /nada pendiente/);
  assert.equal(saved.length, 1);
});

test("conversation: no saves nothing", () => {
  const saved: ReminderInput[] = [];
  say(2, "Dentista mañana a las 10", NOW);
  assert.equal(answer(2, "no", (i) => saved.push(i), NOW), "Vale, no lo guardo.");
  assert.equal(saved.length, 0);
});

test("conversation: missing time is asked for, then saved", () => {
  const saved: ReminderInput[] = [];
  assert.equal(say(3, "Dentista el viernes", NOW), '"Dentista". ¿A qué hora?');
  assert.match(answer(3, "a las 5", (i) => saved.push(i), NOW), /^Guardado: "Dentista", el viernes 23 de octubre a las 17:00/);
  assert.equal(saved[0].date, "2026-10-23");
});

test("conversation: missing day and time", () => {
  const saved: ReminderInput[] = [];
  assert.equal(say(4, "Llamar al banco", NOW), '"Llamar al banco". ¿Para qué día y hora?');
  assert.match(answer(4, "el lunes a las 9", (i) => saved.push(i), NOW), /el lunes 19 de octubre a las 09:00/);
});

test("query text tolerates double encoding", () => {
  assert.equal(queryText("Dentista%20el%20viernes"), "Dentista el viernes");
  assert.equal(queryText("Dentista el viernes"), "Dentista el viernes");
  assert.equal(queryText(undefined), "");
});
