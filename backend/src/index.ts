import express from "express";
import cors from "cors";
import { migrateAndSeed, waitForDb } from "./db/pool";
import { tasksRouter } from "./routes/tasks";
import { developersRouter } from "./routes/developers";
import { skillsRouter } from "./routes/skills";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/tasks", tasksRouter);
app.use("/api/developers", developersRouter);
app.use("/api/skills", skillsRouter);

async function start() {
  await waitForDb();
  await migrateAndSeed();
  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
