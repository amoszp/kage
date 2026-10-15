import { Router, type NextFunction, type Request, type Response } from "express";
import {
  AccountsUnavailable,
  clearSessionCookie,
  clientInfo,
  forgetToken,
  listUsers,
  login,
  logout,
  readToken,
  requireUser,
  setSessionCookie,
  signup,
  type User,
} from "./auth";
import {
  claimUnownedReminders,
  createReminder,
  deleteReminder,
  getReminder,
  listReminders,
  setReminderCompleted,
  updateReminder,
} from "./db";
import type { ReminderInput } from "./types";

export const router = Router();

// Reminders created before accounts existed belong to this user; they are
// handed over the first time that user signs in.
const LEGACY_OWNER = (process.env.LEGACY_OWNER_USERNAME ?? "").trim().toLowerCase();
let legacyClaimed = !LEGACY_OWNER;

function claimLegacy(user: User): void {
  // Admin only: sign-up never creates admins, so nobody can grab these
  // reminders by registering the expected username first.
  if (legacyClaimed || user.username !== LEGACY_OWNER || !user.isAdmin) return;
  const count = claimUnownedReminders(user.id);
  legacyClaimed = true;
  if (count > 0) console.log(`[auth] ${count} existing reminder(s) assigned to ${user.username}`);
}

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

const wrap =
  (fn: (req: Request, res: Response) => Promise<void> | void) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      if (err instanceof AccountsUnavailable) {
        res.status(503).json({ error: "accounts service unavailable" });
        return;
      }
      next(err);
    });

// ---------- session ----------

router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length > 64 || password.length > 256) {
      res.status(401).json({ error: "wrong username or password" });
      return;
    }
    const { status, data } = await login(username, password, clientInfo(req));
    if (status !== 200) {
      res.status(status === 429 ? 429 : 401).json({ error: status === 429 ? "too many attempts" : "wrong username or password" });
      return;
    }
    claimLegacy(data.user);
    setSessionCookie(res, data.token);
    res.json({ user: data.user });
  })
);

router.post(
  "/auth/signup",
  wrap(async (req, res) => {
    const { username, password, displayName } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length > 64 || password.length > 256 || (typeof displayName === "string" && displayName.length > 80)) {
      res.status(400).json({ error: "too long" });
      return;
    }
    const { status, data } = await signup(username, password, typeof displayName === "string" ? displayName : "", clientInfo(req));
    if (status === 201) {
      // New accounts work at once: sign the user straight in.
      setSessionCookie(res, data.token);
      res.status(201).json({ user: data.user });
      return;
    }
    const code = status === 429 ? 429 : status === 409 ? 409 : 400;
    res.status(code).json({ error: code === 429 ? "too many sign-ups" : code === 409 ? "username taken" : data?.message ?? "invalid" });
  })
);

router.post(
  "/auth/logout",
  wrap(async (req, res) => {
    const token = readToken(req);
    if (token) {
      forgetToken(token);
      await logout(token);
    }
    clearSessionCookie(res);
    res.status(204).send();
  })
);

router.use(requireUser(claimLegacy));

router.get(
  "/auth/me",
  wrap(async (req, res) => {
    const user = req.user!;
    // Admins can browse other users' reminders, so they get the user list.
    res.json({ user, users: user.isAdmin ? await listUsers() : [] });
  })
);

// ---------- reminders ----------

function canTouch(user: User, reminderUserId: number | null): boolean {
  return reminderUserId === user.id || user.isAdmin;
}

router.get("/reminders", (req: Request, res: Response) => {
  const user = req.user!;
  const requested = Number(req.query.userId);
  const target = user.isAdmin && Number.isInteger(requested) && requested > 0 ? requested : user.id;
  res.json(listReminders(target));
});

router.post("/reminders", (req: Request, res: Response) => {
  const input = parseReminderInput(req.body);
  if (!input) {
    res.status(400).json({ error: "invalid reminder payload" });
    return;
  }
  res.status(201).json(createReminder(input, req.user!.id));
});

// Every route below acts on one reminder: 404 unless it exists and the
// caller owns it (or is an admin), so ids of other users' reminders leak nothing.
router.param("id", (req: Request, res: Response, next: NextFunction, value: string) => {
  const reminder = getReminder(Number(value));
  if (!reminder || !canTouch(req.user!, reminder.userId)) {
    res.status(404).json({ error: "reminder not found" });
    return;
  }
  next();
});

router.put("/reminders/:id", (req: Request, res: Response) => {
  const input = parseReminderInput(req.body);
  if (!input) {
    res.status(400).json({ error: "invalid reminder payload" });
    return;
  }
  res.json(updateReminder(Number(req.params.id), input));
});

for (const [action, completed] of [["complete", true], ["reopen", false]] as const) {
  router.post(`/reminders/:id/${action}`, (req: Request, res: Response) => {
    res.json(setReminderCompleted(Number(req.params.id), completed));
  });
}

router.delete("/reminders/:id", (req: Request, res: Response) => {
  deleteReminder(Number(req.params.id));
  res.status(204).send();
});
