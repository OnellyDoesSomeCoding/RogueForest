import { Router } from "express";
import { putRunSchema } from "../../../shared/schemas";
import { requireAuth, type AuthedRequest } from "../auth";
import * as db from "../db";

export const runRouter = Router();
runRouter.use(requireAuth);

runRouter.get("/", async (req, res) => {
  const saved = await db.getRun((req as AuthedRequest).user.id);
  if (!saved) {
    res.status(404).json({ error: "No saved run." });
    return;
  }
  res.json({ saveVersion: saved.saveVersion, state: JSON.parse(saved.stateJson), updatedAt: saved.updatedAt });
});

runRouter.put("/", async (req, res) => {
  const parsed = putRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid save data." });
    return;
  }
  await db.putRun((req as AuthedRequest).user.id, parsed.data.saveVersion, JSON.stringify(parsed.data.state));
  res.status(204).end();
});

runRouter.delete("/", async (req, res) => {
  await db.deleteRun((req as AuthedRequest).user.id);
  res.status(204).end();
});
