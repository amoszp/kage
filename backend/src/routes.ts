import { Router, type Request, type Response } from "express";
import { createReminder, deleteReminder, listReminders, updateReminder } from "./db";
import type { ReminderInput } from "./types";

export const router = Router();

function parseReminderInput(body: any): ReminderInput | null {
  if (typeof body?.title !== "string" || body.title.trim() === "") return null;
  if (typeof body?.date !== "string" || typeof body?.time !== "string") return null;
  if (!Array.isArray(body?.alerts)) return null;

  for (const alert of body.alerts) {
    if (typeof alert?.label !== "string" || typeof alert?.fireAt !== "string") return null;
  }

  return {
    title: body.title.trim(),
    date: body.date,
    time: body.time,
    alerts: body.alerts.map((a: any) => ({ label: a.label, fireAt: a.fireAt })),
  };
}

router.get("/reminders", (_req: Request, res: Response) => {
  res.json(listReminders());
});

router.post("/reminders", (req: Request, res: Response) => {
  const input = parseReminderInput(req.body);
  if (!input) {
    res.status(400).json({ error: "invalid reminder payload" });
    return;
  }
  res.status(201).json(createReminder(input));
});

router.put("/reminders/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const input = parseReminderInput(req.body);
  if (!input) {
    res.status(400).json({ error: "invalid reminder payload" });
    return;
  }
  const updated = updateReminder(id, input);
  if (!updated) {
    res.status(404).json({ error: "reminder not found" });
    return;
  }
  res.json(updated);
});

router.delete("/reminders/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteReminder(id);
  if (!deleted) {
    res.status(404).json({ error: "reminder not found" });
    return;
  }
  res.status(204).send();
});
