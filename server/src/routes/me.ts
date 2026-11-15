import { Router } from "express";
import type { MeResponse } from "../../../shared/types";
import { requireAuth, type AuthedRequest } from "../auth";
import * as db from "../db";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const { id, username } = (req as AuthedRequest).user;
  const [unlocks, badges, hasSave] = await Promise.all([db.getUnlocks(id), db.getBadges(id), db.hasRun(id)]);
  const body: MeResponse = { username, unlocks, badges, hasSave };
  res.json(body);
});
