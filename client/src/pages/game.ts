// Game page (#/game). Placeholder until the Phaser scenes arrive in M2: shows the saved run.
import { computeStats } from "@shared/engine/stats";
import { getCritterLine } from "@shared/gameData";
import type { OwnedCritter, RunSave } from "@shared/types";
import { api, getMe } from "../api";
import { navigate, type Page } from "../router";
import { critterIcon, typeChips } from "../ui/critterIcon";
import { h } from "../ui/dom";

export const gamePage: Page = (root, ctx) => {
  root.append(h("main", { class: "loading" }, "Loading your run…"));
  (async () => {
    const me = await getMe();
    if (!ctx.isCurrent()) return;
    if (!me) return navigate("/login");
    const saved = await api.getRun();
    if (!ctx.isCurrent()) return;
    if (!saved) return navigate("/starter");
    render(root, saved.state);
  })().catch((err) => {
    if (!ctx.isCurrent()) return;
    root.replaceChildren(
      h("main", { class: "loading" }, h("p", {}, err instanceof Error ? err.message : "Could not load your run."), h("button", { class: "btn", type: "button", onclick: () => navigate("/game") }, "Try again")),
    );
  });
};

function critterRow(owned: OwnedCritter): HTMLElement | null {
  const line = getCritterLine(owned.line);
  if (!line) return null;
  const stage = line.stages.find((s) => s.id === owned.stageId);
  const stats = computeStats(line, owned.stageId, owned.level);
  return h(
    "li",
    { class: "run-critter" },
    critterIcon(line, { stageId: owned.stageId }),
    h("div", {}, h("strong", {}, stage?.name ?? owned.line), h("span", { class: "run-critter__level" }, ` Lv ${owned.level}`), typeChips(line)),
    h("span", { class: "run-critter__hp" }, `HP ${owned.hp} / ${stats.hp}`),
  );
}

function render(root: HTMLElement, run: RunSave) {
  root.replaceChildren(
    h(
      "main",
      { class: "auth" },
      h(
        "div",
        { class: "panel run-summary" },
        h("h1", {}, "Run in progress"),
        h("p", { class: "section__lead" }, `Act ${run.act}, floor ${run.floor}. Acorns: ${run.acorns}.`),
        h("h3", {}, "Active"),
        h("ul", { class: "run-critters" }, ...run.team.active.map(critterRow)),
        run.team.bench.length > 0 ? h("h3", {}, "Bench") : null,
        run.team.bench.length > 0 ? h("ul", { class: "run-critters" }, ...run.team.bench.map(critterRow)) : null,
        h("p", { class: "notice notice--warning" }, "The map and battle screens are not built yet. They arrive with milestone M2."),
        h("p", { class: "run-summary__seed" }, `Seed: ${run.seed}`),
        h("button", { class: "btn btn--block", type: "button", onclick: () => navigate("/starter") }, "Back to Starter Select"),
      ),
    ),
  );
}
