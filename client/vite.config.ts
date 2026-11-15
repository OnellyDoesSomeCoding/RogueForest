import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@shared": path.resolve(here, "../shared") },
  },
  server: {
    port: 5173,
    // The client imports game data and engine code from ../shared.
    fs: { allow: [path.resolve(here, "..")] },
    // Same origin as the API in dev, like on Vercel.
    proxy: { "/api": { target: "http://localhost:3001", xfwd: true } },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
