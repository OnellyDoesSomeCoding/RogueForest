// fetch wrapper for the REST API, plus a small cache of the logged-in user.
import type { MeResponse, RunResponse, RunSave } from "@shared/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (for example a proxy error page). Handled below.
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? "Something went wrong. Please try again.";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

let me: MeResponse | null | undefined; // undefined = not asked yet, null = logged out

/** The logged-in user, or null. Cached until login, logout or `refresh`. */
export async function getMe(refresh = false): Promise<MeResponse | null> {
  if (me !== undefined && !refresh) return me;
  try {
    me = await request<MeResponse>("GET", "/api/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) me = null;
    else throw err;
  }
  return me;
}

export const api = {
  async signup(username: string, password: string): Promise<void> {
    await request("POST", "/api/auth/signup", { username, password });
    me = undefined;
  },
  async login(username: string, password: string): Promise<void> {
    await request("POST", "/api/auth/login", { username, password });
    me = undefined;
  },
  async logout(): Promise<void> {
    try {
      await request("POST", "/api/auth/logout");
    } finally {
      me = null;
    }
  },
  async getRun(): Promise<RunResponse | null> {
    try {
      return await request<RunResponse>("GET", "/api/run");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  async saveRun(state: RunSave): Promise<void> {
    await request("PUT", "/api/run", { saveVersion: state.saveVersion, state });
    if (me) me.hasSave = true;
  },
  async deleteRun(): Promise<void> {
    await request("DELETE", "/api/run");
    if (me) me.hasSave = false;
  },
};
