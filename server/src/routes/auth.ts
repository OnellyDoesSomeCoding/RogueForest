import { Router } from "express";
import { credentialsSchema } from "../../../shared/schemas";
import { endSession, hashPassword, requireAuth, startSession, verifyAgainstDummy, verifyPassword } from "../auth";
import * as db from "../db";
import { allowAuthAttempt } from "../rateLimit";

export const authRouter = Router();

const TOO_MANY = "Too many attempts. Try again in a few minutes.";
const INVALID_LOGIN = "Invalid username or password.";

authRouter.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    return;
  }
  const { username, password } = parsed.data;
  if (!(await allowAuthAttempt(req, username))) {
    res.status(429).json({ error: TOO_MANY });
    return;
  }
  const passwordHash = await hashPassword(password);
  let user: db.UserRow;
  try {
    user = await db.createUser(username, passwordHash);
  } catch (err) {
    if (db.isUniqueViolation(err)) {
      res.status(409).json({ error: "That username is taken." });
      return;
    }
    throw err;
  }
  await startSession(res, user.id);
  res.status(201).json({ username: user.username });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    // Same generic message as a wrong password: do not reveal which part failed.
    res.status(401).json({ error: INVALID_LOGIN });
    return;
  }
  const { username, password } = parsed.data;
  if (!(await allowAuthAttempt(req, username))) {
    res.status(429).json({ error: TOO_MANY });
    return;
  }
  const user = await db.findUserByUsername(username);
  // When the user does not exist, still verify against a dummy hash so timing does not reveal it.
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await verifyAgainstDummy(password), false);
  if (!user || !ok) {
    res.status(401).json({ error: INVALID_LOGIN });
    return;
  }
  await db.deleteExpiredSessions();
  await startSession(res, user.id);
  res.json({ username: user.username });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});
