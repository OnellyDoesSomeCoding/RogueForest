import { Router } from "express";
import { isBadgeId } from "../../../shared/gameData";
import { badgeSchema } from "../../../shared/schemas";
import { requireAuth, type AuthedRequest } from "../auth";
import * as db from "../db";

export const badgesRouter = Router();

badgesRouter.post("/", requireAuth, async (req, res) => {
  const parsed = badgeSchema.safeParse(req.body);
  if (!parsed.success || !isBadgeId(parsed.data.badgeId)) {
    res.status(400).json({ error: "Unknown badge." });
    return;
  }
  const userId = (req as AuthedRequest).user.id;
  await db.addBadge(userId, parsed.data.badgeId);
  res.json({ badges: await db.getBadges(userId) });
});
