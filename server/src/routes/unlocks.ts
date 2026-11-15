import { Router } from "express";
import { isCritterLine } from "../../../shared/gameData";
import { unlockSchema } from "../../../shared/schemas";
import { requireAuth, type AuthedRequest } from "../auth";
import * as db from "../db";

export const unlocksRouter = Router();

unlocksRouter.post("/", requireAuth, async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body);
  if (!parsed.success || !isCritterLine(parsed.data.critterLine)) {
    res.status(400).json({ error: "Unknown critter line." });
    return;
  }
  const userId = (req as AuthedRequest).user.id;
  await db.addUnlock(userId, parsed.data.critterLine);
  res.json({ unlocks: await db.getUnlocks(userId) });
});
