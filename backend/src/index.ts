import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { router } from "./routes";
import { startScheduler } from "./scheduler";

const app = express();
const PORT = Number(process.env.PORT ?? 4477);
const FRONTEND_DIR = join(__dirname, "../../frontend");

app.disable("x-powered-by");
// The PWA only loads its own files: no inline scripts, no third-party
// content, and it can't be framed by another site.
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
      "manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "64kb" }));
app.use("/api", router);
app.use(express.static(FRONTEND_DIR));

app.listen(PORT, () => {
  console.log(`[kage] listening on port ${PORT}`);
  startScheduler();
});
