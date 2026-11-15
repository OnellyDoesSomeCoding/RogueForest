// Finds which optional art files exist before Phaser loads them, so a missing file is skipped
// quietly (and drawn in code) instead of logging a load error.
import { statuses } from "@shared/gameData";

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    // The dev server answers missing files with index.html, so check the type too.
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/** Status icon names (statuses.json "icon") that have a file in assets/icons/. */
export async function findStatusIcons(): Promise<Set<string>> {
  const names = [...new Set(statuses.map((s) => s.icon))];
  const found = await Promise.all(names.map(async (name) => ((await exists(`/assets/icons/status_${name}.png`)) ? name : null)));
  return new Set(found.filter((n): n is string => n !== null));
}
