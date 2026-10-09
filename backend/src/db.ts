import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AlertInput, AlertRecord, ReminderInput, ReminderRecord } from "./types";

const DB_PATH = process.env.DB_PATH ?? "./data/kage.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    fire_at TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT
  );
`);

function rowToAlert(row: any): AlertRecord {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    label: row.label,
    fireAt: row.fire_at,
    sent: row.sent === 1,
    sentAt: row.sent_at ?? null,
  };
}

function alertsForReminder(reminderId: number): AlertRecord[] {
  const rows = db
    .prepare("SELECT * FROM alerts WHERE reminder_id = ? ORDER BY fire_at ASC")
    .all(reminderId);
  return rows.map(rowToAlert);
}

function rowToReminder(row: any): ReminderRecord {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    createdAt: row.created_at,
    alerts: alertsForReminder(row.id),
  };
}

export function listReminders(): ReminderRecord[] {
  const rows = db.prepare("SELECT * FROM reminders ORDER BY date ASC, time ASC").all();
  return rows.map(rowToReminder);
}

export function getReminder(id: number): ReminderRecord | null {
  const row = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  return row ? rowToReminder(row) : null;
}

function insertAlerts(reminderId: number, alerts: AlertInput[]): void {
  const stmt = db.prepare(
    "INSERT INTO alerts (reminder_id, label, fire_at, sent, sent_at) VALUES (?, ?, ?, 0, NULL)"
  );
  for (const alert of alerts) {
    stmt.run(reminderId, alert.label, alert.fireAt);
  }
}

export function createReminder(input: ReminderInput): ReminderRecord {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO reminders (title, date, time, created_at) VALUES (?, ?, ?, ?)")
    .run(input.title, input.date, input.time, createdAt);
  const reminderId = Number(result.lastInsertRowid);
  insertAlerts(reminderId, input.alerts);
  return getReminder(reminderId)!;
}

export function updateReminder(id: number, input: ReminderInput): ReminderRecord | null {
  const existing = getReminder(id);
  if (!existing) return null;
  db.prepare("UPDATE reminders SET title = ?, date = ?, time = ? WHERE id = ?").run(
    input.title,
    input.date,
    input.time,
    id
  );
  db.prepare("DELETE FROM alerts WHERE reminder_id = ?").run(id);
  insertAlerts(id, input.alerts);
  return getReminder(id);
}

export function deleteReminder(id: number): boolean {
  const result = db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listDueAlerts(
  nowIso: string
): (AlertRecord & { reminderTitle: string; reminderDate: string; reminderTime: string })[] {
  const rows = db
    .prepare(
      `SELECT alerts.*, reminders.title AS reminder_title, reminders.date AS reminder_date, reminders.time AS reminder_time
       FROM alerts
       JOIN reminders ON reminders.id = alerts.reminder_id
       WHERE alerts.sent = 0 AND alerts.fire_at <= ?`
    )
    .all(nowIso);
  return rows.map((row: any) => ({
    ...rowToAlert(row),
    reminderTitle: row.reminder_title,
    reminderDate: row.reminder_date,
    reminderTime: row.reminder_time,
  }));
}

export function markAlertSent(id: number, sentAt: string): void {
  db.prepare("UPDATE alerts SET sent = 1, sent_at = ? WHERE id = ?").run(sentAt, id);
}

export function nextPendingAlert(reminderId: number, excludeAlertId: number): AlertRecord | null {
  const row = db
    .prepare(
      "SELECT * FROM alerts WHERE reminder_id = ? AND sent = 0 AND id != ? ORDER BY fire_at ASC LIMIT 1"
    )
    .get(reminderId, excludeAlertId);
  return row ? rowToAlert(row) : null;
}
