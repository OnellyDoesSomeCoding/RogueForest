// Local dev entry. Production (Vercel) uses api/index.ts instead.
import app from "./app";
import { initDb } from "./db";

const port = Number(process.env.PORT ?? 3001);

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`[api] listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("[api] could not open the database:", err);
    process.exit(1);
  });
