// Rate limiter for /api/auth/*. Attempts live in the database because serverless
// instances do not share memory.
import type { Request } from "express";
import { config } from "../../shared/gameData";
import * as db from "./db";

const { windowMinutes, maxPerIpUser, maxPerIp } = config.auth.rateLimit;
const WINDOW_MS = windowMinutes * 60 * 1000;

/** Records one attempt. Returns false if this IP, or this IP + username, is over its limit. */
export async function allowAuthAttempt(req: Request, username: string): Promise<boolean> {
  const ip = req.ip ?? "unknown";
  const ipKey = `ip:${ip}`;
  const ipUserKey = `ipuser:${ip}|${username.toLowerCase()}`;
  const since = Date.now() - WINDOW_MS;

  await db.deleteAttemptsBefore(since);
  const [byIp, byIpUser] = await Promise.all([db.countAttempts(ipKey, since), db.countAttempts(ipUserKey, since)]);
  if (byIp >= maxPerIp || byIpUser >= maxPerIpUser) return false;

  await Promise.all([db.recordAttempt(ipKey), db.recordAttempt(ipUserKey)]);
  return true;
}
