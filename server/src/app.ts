// The Express app. No listen() here: index.ts listens locally, Vercel imports the app directly.
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter } from "./routes/auth";
import { badgesRouter } from "./routes/badges";
import { meRouter } from "./routes/me";
import { runRouter } from "./routes/run";
import { unlocksRouter } from "./routes/unlocks";

const app = express();

app.disable("x-powered-by");
// Behind one proxy (Vercel in production, Vite in dev), so req.ip is the real client IP.
app.set("trust proxy", 1);

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "256kb" }));

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/run", runRouter);
app.use("/api/unlocks", unlocksRouter);
app.use("/api/badges", badgesRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Errors: never send details to the client, and never log request bodies (they may hold passwords).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number } | null)?.status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: "Bad request." });
    return;
  }
  console.error(`[api] ${req.method} ${req.path} failed:`, err instanceof Error ? err.message : "unknown error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
