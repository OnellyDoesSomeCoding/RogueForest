// Database access (Turso / libSQL). Local dev uses a SQLite file, production uses Turso.
// All queries are parameterized.
import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../shared/gameData";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function connect(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL is not set. Vercel has no persistent disk for a local database file.");
  }
  // Local fallback: a SQLite file next to the server code.
  const file = process.env.LOCAL_DB_FILE ?? path.resolve(__dirname, "../data/dev.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return createClient({ url: "file:" + path.relative(process.cwd(), file).replace(/\\/g, "/") });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS unlocks (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    critter_line TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, critter_line)
  )`,
  `CREATE TABLE IF NOT EXISTS badges (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, badge_id)
  )`,
  `CREATE TABLE IF NOT EXISTS run_saves (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    save_version INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    key TEXT NOT NULL,
    attempted_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS auth_attempts_key ON auth_attempts (key, attempted_at)`,
];

/** Connects and creates missing tables. Runs once per server instance. */
export function initDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      client = connect();
      await client.batch(SCHEMA, "write");
    })().catch((err) => {
      ready = null;
      client = null;
      throw err;
    });
  }
  return ready;
}

/** For tests: drop the connection so the next call reconnects. */
export function closeDb(): void {
  client?.close();
  client = null;
  ready = null;
}

async function run(sql: string, args: InValue[] = []) {
  await initDb();
  return (client as Client).execute({ sql, args });
}

// ---- users ----

export interface UserRow {
  id: number;
  username: string;
  passwordHash: string;
}

export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

/** Creates the user and their default unlocks together. Throws a unique violation if the name is taken. */
export async function createUser(username: string, passwordHash: string): Promise<UserRow> {
  await initDb();
  const now = Date.now();
  const tx = await (client as Client).transaction("write");
  try {
    const inserted = await tx.execute({
      sql: "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
      args: [username, passwordHash, now],
    });
    const id = Number(inserted.lastInsertRowid);
    for (const line of config.starter.defaultUnlocks) {
      await tx.execute({
        sql: "INSERT INTO unlocks (user_id, critter_line, unlocked_at) VALUES (?, ?, ?)",
        args: [id, line, now],
      });
    }
    await tx.commit();
    return { id, username, passwordHash };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  } finally {
    tx.close();
  }
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const res = await run("SELECT id, username, password_hash FROM users WHERE username = ?", [username]);
  const row = res.rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: String(row.username), passwordHash: String(row.password_hash) };
}

// ---- sessions ----

export async function createSession(tokenHash: string, userId: number, expiresAt: number): Promise<void> {
  await run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [tokenHash, userId, expiresAt]);
}

export async function findSessionUser(tokenHash: string): Promise<{ id: number; username: string } | null> {
  const res = await run(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash, Date.now()],
  );
  const row = res.rows[0];
  return row ? { id: Number(row.id), username: String(row.username) } : null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await run("DELETE FROM sessions WHERE expires_at <= ?", [Date.now()]);
}

// ---- unlocks and badges ----

export async function getUnlocks(userId: number): Promise<string[]> {
  const res = await run("SELECT critter_line FROM unlocks WHERE user_id = ? ORDER BY unlocked_at, critter_line", [userId]);
  return res.rows.map((r) => String(r.critter_line));
}

export async function addUnlock(userId: number, critterLine: string): Promise<void> {
  await run("INSERT OR IGNORE INTO unlocks (user_id, critter_line, unlocked_at) VALUES (?, ?, ?)", [
    userId,
    critterLine,
    Date.now(),
  ]);
}

export async function getBadges(userId: number): Promise<string[]> {
  const res = await run("SELECT badge_id FROM badges WHERE user_id = ? ORDER BY earned_at, badge_id", [userId]);
  return res.rows.map((r) => String(r.badge_id));
}

export async function addBadge(userId: number, badgeId: string): Promise<void> {
  await run("INSERT OR IGNORE INTO badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)", [userId, badgeId, Date.now()]);
}

// ---- run saves ----

export async function getRun(userId: number): Promise<{ saveVersion: number; stateJson: string; updatedAt: number } | null> {
  const res = await run("SELECT save_version, state_json, updated_at FROM run_saves WHERE user_id = ?", [userId]);
  const row = res.rows[0];
  if (!row) return null;
  return { saveVersion: Number(row.save_version), stateJson: String(row.state_json), updatedAt: Number(row.updated_at) };
}

export async function hasRun(userId: number): Promise<boolean> {
  const res = await run("SELECT 1 FROM run_saves WHERE user_id = ?", [userId]);
  return res.rows.length > 0;
}

export async function putRun(userId: number, saveVersion: number, stateJson: string): Promise<void> {
  await run(
    `INSERT INTO run_saves (user_id, save_version, state_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       save_version = excluded.save_version, state_json = excluded.state_json, updated_at = excluded.updated_at`,
    [userId, saveVersion, stateJson, Date.now()],
  );
}

export async function deleteRun(userId: number): Promise<void> {
  await run("DELETE FROM run_saves WHERE user_id = ?", [userId]);
}

// ---- auth rate limiting ----

export async function countAttempts(key: string, since: number): Promise<number> {
  const res = await run("SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND attempted_at > ?", [key, since]);
  return Number(res.rows[0]?.n ?? 0);
}

export async function recordAttempt(key: string): Promise<void> {
  await run("INSERT INTO auth_attempts (key, attempted_at) VALUES (?, ?)", [key, Date.now()]);
}

export async function deleteAttemptsBefore(time: number): Promise<void> {
  await run("DELETE FROM auth_attempts WHERE attempted_at <= ?", [time]);
}
