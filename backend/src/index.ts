import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { router } from "./routes";
import { startScheduler } from "./scheduler";

const app = express();
const PORT = Number(process.env.PORT ?? 4477);
const FRONTEND_DIR = join(__dirname, "../../frontend");

app.use(express.json());
app.use("/api", router);
app.use(express.static(FRONTEND_DIR));

app.listen(PORT, () => {
  console.log(`[kage] listening on port ${PORT}`);
  startScheduler();
});
