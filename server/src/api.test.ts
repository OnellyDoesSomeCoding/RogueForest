// End-to-end API tests against a throwaway SQLite file.
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRun } from "../../shared/engine/run/newRun";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rogue-forest-test-"));
process.env.LOCAL_DB_FILE = path.join(tmpDir, "test.db");
delete process.env.TURSO_DATABASE_URL;

let server: Server;
let base = "";
let closeDb: () => void;
let findUser: (name: string) => Promise<{ passwordHash: string } | null>;

beforeAll(async () => {
  const { default: app } = await import("./app");
  const db = await import("./db");
  closeDb = db.closeDb;
  findUser = db.findUserByUsername;
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Windows can keep the database file locked for a moment. The OS temp folder gets cleaned anyway.
  }
});

async function call(method: string, url: string, body?: unknown, cookie?: string) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, setCookie: res.headers.getSetCookie() };
}

const cookieOf = (setCookie: string[]) => (setCookie[0] ?? "").split(";")[0] ?? "";

describe("auth", () => {
  let cookie = "";

  it("rejects requests without a session", async () => {
    for (const [method, url] of [
      ["GET", "/api/me"],
      ["GET", "/api/run"],
      ["DELETE", "/api/run"],
      ["POST", "/api/auth/logout"],
    ] as const) {
      expect((await call(method, url)).status).toBe(401);
    }
    expect((await call("PUT", "/api/run", {})).status).toBe(401);
    expect((await call("POST", "/api/unlocks", { critterLine: "pebbun" })).status).toBe(401);
    expect((await call("POST", "/api/badges", { badgeId: "run_clear" })).status).toBe(401);
  });

  it("validates signup input", async () => {
    expect((await call("POST", "/api/auth/signup", { username: "ab", password: "longenough" })).status).toBe(400);
    expect((await call("POST", "/api/auth/signup", { username: "bad name", password: "longenough" })).status).toBe(400);
    expect((await call("POST", "/api/auth/signup", { username: "Druid", password: "short" })).status).toBe(400);
    expect((await call("POST", "/api/auth/signup", {})).status).toBe(400);
  });

  it("signs up, sets a safe cookie and unlocks the three starters", async () => {
    const res = await call("POST", "/api/auth/signup", { username: "Druid", password: "correct horse" });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ username: "Druid" });
    const raw = res.setCookie[0] ?? "";
    expect(raw).toMatch(/^rf_session=[A-Za-z0-9_-]{43};/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    cookie = cookieOf(res.setCookie);

    const me = await call("GET", "/api/me", undefined, cookie);
    expect(me.status).toBe(200);
    expect(me.json).toEqual({
      username: "Druid",
      unlocks: ["dewdle", "emberkit", "sproutle"],
      badges: [],
      hasSave: false,
    });
  });

  it("stores an argon2id hash, never the password", async () => {
    const user = await findUser("druid");
    expect(user?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(user?.passwordHash).not.toContain("correct horse");
  });

  it("treats usernames as case-insensitive", async () => {
    const dup = await call("POST", "/api/auth/signup", { username: "DRUID", password: "another pass" });
    expect(dup.status).toBe(409);
    const login = await call("POST", "/api/auth/login", { username: "druid", password: "correct horse" });
    expect(login.status).toBe(200);
    expect(login.json).toEqual({ username: "Druid" });
  });

  it("gives the same error for a wrong password and an unknown user", async () => {
    const wrong = await call("POST", "/api/auth/login", { username: "Druid", password: "wrong password" });
    const unknown = await call("POST", "/api/auth/login", { username: "Nobody", password: "wrong password" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json).toEqual({ error: "Invalid username or password." });
    expect(unknown.json).toEqual(wrong.json);
    expect(wrong.setCookie).toEqual([]);
  });

  it("saves, loads and deletes a run", async () => {
    expect((await call("GET", "/api/run", undefined, cookie)).status).toBe(404);
    const state = createRun("seed-1", { active: ["emberkit", "dewdle"], bench: ["sproutle"] });

    expect((await call("PUT", "/api/run", { saveVersion: 1, state: { nope: true } }, cookie)).status).toBe(400);
    expect((await call("PUT", "/api/run", { saveVersion: 1, state }, cookie)).status).toBe(204);

    const loaded = await call("GET", "/api/run", undefined, cookie);
    expect(loaded.status).toBe(200);
    expect(loaded.json.state).toEqual(state);
    expect((await call("GET", "/api/me", undefined, cookie)).json.hasSave).toBe(true);

    // Saving again replaces the old save.
    expect((await call("PUT", "/api/run", { saveVersion: 1, state: { ...state, acorns: 42 } }, cookie)).status).toBe(204);
    expect((await call("GET", "/api/run", undefined, cookie)).json.state.acorns).toBe(42);

    expect((await call("DELETE", "/api/run", undefined, cookie)).status).toBe(204);
    expect((await call("GET", "/api/run", undefined, cookie)).status).toBe(404);
  });

  it("adds unlocks and badges only for IDs in the game data", async () => {
    expect((await call("POST", "/api/unlocks", { critterLine: "dragon" }, cookie)).status).toBe(400);
    const unlock = await call("POST", "/api/unlocks", { critterLine: "pebbun" }, cookie);
    expect(unlock.status).toBe(200);
    expect(unlock.json.unlocks).toContain("pebbun");
    expect((await call("POST", "/api/unlocks", { critterLine: "pebbun" }, cookie)).json.unlocks).toHaveLength(4);

    expect((await call("POST", "/api/badges", { badgeId: "fake" }, cookie)).status).toBe(400);
    expect((await call("POST", "/api/badges", { badgeId: "run_clear" }, cookie)).json).toEqual({ badges: ["run_clear"] });
  });

  it("returns 400 for a malformed JSON body and 404 for unknown API routes", async () => {
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect((await call("GET", "/api/nope")).status).toBe(404);
  });

  it("logs out and invalidates the session", async () => {
    expect((await call("POST", "/api/auth/logout", undefined, cookie)).status).toBe(204);
    expect((await call("GET", "/api/me", undefined, cookie)).status).toBe(401);
  });

  it("rate-limits repeated attempts on one username", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await call("POST", "/api/auth/login", { username: "Victim", password: "guess number" + i })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
