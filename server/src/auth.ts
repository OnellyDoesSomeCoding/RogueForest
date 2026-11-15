// Password hashing, session tokens and the auth middleware.
import { hash, verify } from "@node-rs/argon2";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../shared/gameData";
import * as db from "./db";

export const SESSION_COOKIE = "rf_session";
const SESSION_MS = config.auth.sessionDays * 24 * 60 * 60 * 1000;

// argon2id is the default algorithm of @node-rs/argon2. Cost settings follow the OWASP minimum.
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when the username does not exist, so both failure cases take the same time.
let dummyHash: Promise<string> | null = null;
export function verifyAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  return dummyHash.then((h) => verifyPassword(h, password));
}

const isProduction = () => process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: isProduction(), path: "/" };
}

/** Creates a session row and sets the cookie. Only the SHA-256 hash of the token is stored. */
export async function startSession(res: Response, userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.createSession(hashToken(token), userId, Date.now() + SESSION_MS);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS });
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readSessionToken(req);
  if (token) await db.deleteSession(hashToken(token));
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = part.slice(eq + 1).trim();
      // Tokens are 32 random bytes in base64url (43 chars). Reject anything else early.
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
  }
  return null;
}

export interface AuthedUser {
  id: number;
  username: string;
}

export type AuthedRequest = Request & { user: AuthedUser };

/** 401 unless the request carries a valid, unexpired session cookie. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readSessionToken(req);
  const user = token ? await db.findSessionUser(hashToken(token)) : null;
  if (!user) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}
