import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "../src/siri";

// Times are local to TZ; these expectations use a zone with summer time (UTC+1 → UTC+0 on 25 Oct).
process.env.TZ = "Atlantic/Canary";
const NOW = new Date(2026, 9, 16, 15, 0); // Fri 16 Oct 2026, 15:00

const local = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ok(body: object) {
  const result = plan(body, NOW);
  assert.ok(result.ok, JSON.stringify(result));
  return result;
}

test("normal: 3 days and 1 day before at 10:00, and 5 hours before", () => {
  const r = ok({ title: "Peluquería", date: "2026-10-27", time: "17:00", alerts: "Normal" });
  assert.deepEqual(r.input.alerts.map((a) => [a.label, local(a.fireAt)]), [
    ["3 días antes", "2026-10-24 10:00"],
    ["1 día antes", "2026-10-26 10:00"],
    ["Mismo día", "2026-10-27 12:00"],
  ]);
  assert.match(r.speak, /el martes 27 de octubre a las 17:00/);
  assert.match(r.speak, /3 días antes a las 10:00, 1 día antes a las 10:00, mismo día a las 12:00/);
});

test("normal drops alerts that already passed", () => {
  // Tomorrow 09:00: 3 days before is gone; 1 day before at 10:00 was today 10:00, gone too.
  const r = ok({ title: "Dentista", date: "2026-10-17", time: "09:00", alerts: "normal" });
  assert.deepEqual(r.input.alerts.map((a) => local(a.fireAt)), ["2026-10-17 04:00"]);
});

test("an event too close for any preset alert still gets one at its time", () => {
  const r = ok({ title: "Llamar", date: "2026-10-16", time: "16:00", alerts: "1 día antes" });
  assert.deepEqual(r.input.alerts.map((a) => [a.label, local(a.fireAt)]), [["Mismo momento", "2026-10-16 16:00"]]);
});

test("other presets, by their spoken names", () => {
  const at = (alerts: string) => ok({ title: "X", date: "2026-11-20", time: "18:30", alerts }).input.alerts.map((a) => local(a.fireAt));
  assert.deepEqual(at("solo a la hora"), ["2026-11-20 18:30"]);
  assert.deepEqual(at("1 hora antes"), ["2026-11-20 17:30"]);
  assert.deepEqual(at("1 día antes"), ["2026-11-19 18:30"]);
  // Winter time (UTC+0) after 25 Oct: still 10:00 local.
  assert.equal(local(ok({ title: "X", date: "2026-11-20", time: "18:30", alerts: "normal" }).input.alerts[0].fireAt), "2026-11-17 10:00");
});

test("bad requests say why, in Spanish", () => {
  const bad = (body: object) => {
    const r = plan(body, NOW);
    assert.equal(r.ok, false);
    return r.ok ? "" : r.speak;
  };
  assert.match(bad({ date: "2026-10-20", time: "10:00" }), /qué tengo que recordarte/);
  assert.match(bad({ title: "X", date: "20/10/2026", time: "10:00" }), /fecha o la hora/);
  assert.match(bad({ title: "X", date: "2026-02-30", time: "10:00" }), /no existe/);
  assert.match(bad({ title: "X", date: "2026-10-16", time: "09:00" }), /ya han pasado/);
  assert.match(bad({ title: "X", date: "2026-10-20", time: "10:00", alerts: "cada minuto" }), /tipo de aviso/);
});
