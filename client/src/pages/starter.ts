// Starter Select (#/starter): pick a team within the point budget and start a run.
import { createRun, teamCost, validateStarterTeam, type StarterTeam } from "@shared/engine/run/newRun";
import { config, critters, getCritterLine } from "@shared/gameData";
import type { CritterLine, MeResponse } from "@shared/types";
import { api, getMe } from "../api";
import { navigate, type Page } from "../router";
import { critterIcon, typeChips } from "../ui/critterIcon";
import { h } from "../ui/dom";

const { activeSlots, benchSlots, pointBudget } = config.starter;
const SLOT_COUNT = activeSlots + benchSlots;

export const starterPage: Page = (root, ctx) => {
  root.append(h("main", { class: "loading" }, "Loading…"));
  getMe(true)
    .then((me) => {
      if (!ctx.isCurrent()) return;
      if (!me) navigate("/login");
      else render(root, me, ctx.query);
    })
    .catch((err) => {
      if (!ctx.isCurrent()) return;
      root.replaceChildren(
        h("main", { class: "loading" }, h("p", {}, err instanceof Error ? err.message : "Could not load your account."), h("button", { class: "btn", type: "button", onclick: () => navigate("/starter") }, "Try again")),
      );
    });
};

function render(root: HTMLElement, me: MeResponse, query: URLSearchParams) {
  const unlocked = new Set(me.unlocks);
  const devMode = query.get("dev") === "1" || new URLSearchParams(location.search).get("dev") === "1";

  /** Slots 0..activeSlots-1 are Active, the rest are Bench. Each holds a critter line ID or null. */
  const slots: (string | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
  let starting = false;

  const team = (): StarterTeam => {
    const active = slots.slice(0, activeSlots).filter((s): s is string => s !== null);
    const bench = slots.slice(activeSlots).filter((s): s is string => s !== null);
    // A run needs at least one active critter, so promote from the bench if Active is empty.
    if (active.length === 0 && bench.length > 0) active.push(bench.shift() as string);
    return { active, bench };
  };
  const used = () => teamCost(team());

  function toggle(line: CritterLine) {
    const at = slots.indexOf(line.line);
    if (at >= 0) slots[at] = null;
    else {
      const free = slots.indexOf(null);
      if (free < 0 || used() + line.cost > pointBudget) return;
      slots[free] = line.line;
    }
    update();
  }

  // ---- header ----
  const logout = h("button", { class: "btn btn--small", type: "button" }, "Logout");
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      await api.logout();
    } catch {
      // Even if the request failed, leave the page. The session cookie expires on its own.
    }
    navigate("/login");
  });
  const header = h(
    "header",
    { class: "starter__header" },
    h("button", { class: "nav__brand", type: "button", onclick: () => navigate("/") }, h("img", { src: "/assets/logo-acorn.png", alt: "", width: 32, height: 32, class: "pixel" }), h("span", {}, "Rogue Forest")),
    h(
      "div",
      { class: "starter__account" },
      h("span", { class: "nav__user" }, me.username),
      h("span", { class: "badge-count", title: "Badges earned" }, `★ ${me.badges.length}`),
      logout,
    ),
  );

  // ---- critter grid ----
  const cards = new Map<string, HTMLButtonElement>();
  const grid = h("div", { class: "critter-grid" });
  for (const line of critters) {
    const isUnlocked = unlocked.has(line.line);
    const name = isUnlocked ? (line.stages[0]?.name ?? line.line) : "???";
    const card = h(
      "button",
      { class: "critter-card" + (isUnlocked ? "" : " critter-card--locked"), type: "button", "aria-pressed": "false" },
      critterIcon(line, { locked: !isUnlocked }),
      h("strong", { class: "critter-card__name" }, name),
      isUnlocked ? typeChips(line) : h("span", { class: "critter-card__hint" }, line.unlockHint),
      isUnlocked ? h("span", { class: "cost", title: "Point cost" }, line.cost) : null,
    );
    if (isUnlocked) {
      card.addEventListener("click", () => toggle(line));
      cards.set(line.line, card);
    } else {
      card.setAttribute("aria-disabled", "true");
      card.title = line.unlockHint;
      card.setAttribute("aria-label", `Locked critter. ${line.unlockHint}`);
    }
    grid.append(card);
  }

  // ---- points bar ----
  const pointsText = h("strong", {});
  const pips = h("div", { class: "points__pips", "aria-hidden": "true" });
  for (let i = 0; i < pointBudget; i++) pips.append(h("span", {}));
  const points = h("div", { class: "points" }, h("span", {}, "Points"), pips, pointsText);

  // ---- team panel ----
  const slotEls: HTMLButtonElement[] = [];
  let dragFrom: number | null = null;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = h("button", { class: "slot", type: "button", draggable: "true" });
    slot.addEventListener("click", () => {
      if (slots[i] === null) return;
      slots[i] = null;
      update();
    });
    slot.addEventListener("dragstart", (e) => {
      if (slots[i] === null) return e.preventDefault();
      dragFrom = i;
      e.dataTransfer?.setData("text/plain", String(i));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    slot.addEventListener("dragover", (e) => {
      if (dragFrom === null || dragFrom === i) return;
      e.preventDefault();
      slot.classList.add("slot--over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("slot--over"));
    slot.addEventListener("dragend", () => {
      dragFrom = null;
      slotEls.forEach((s) => s.classList.remove("slot--over"));
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("slot--over");
      if (dragFrom === null || dragFrom === i) return;
      const moved = slots[dragFrom] ?? null;
      slots[dragFrom] = slots[i] ?? null;
      slots[i] = moved;
      dragFrom = null;
      update();
    });
    slotEls.push(slot);
  }

  const seedInput = h("input", { id: "seed", type: "text", maxlength: 64, placeholder: "random", spellcheck: "false" });
  const startError = h("p", { class: "notice notice--error", role: "alert", hidden: true });
  const start = h("button", { class: "btn btn--gold btn--block", type: "button" }, "Start Run");
  start.addEventListener("click", async () => {
    if (starting || validateStarterTeam(team(), me.unlocks) !== null) return;
    starting = true;
    start.disabled = true;
    startError.hidden = true;
    try {
      const seed = (devMode && seedInput.value.trim()) || randomSeed();
      await api.saveRun(createRun(seed, team()));
      navigate("/game");
    } catch (err) {
      startError.textContent = err instanceof Error ? err.message : "Could not start the run.";
      startError.hidden = false;
      starting = false;
      update();
    }
  });

  const panel = h(
    "aside",
    { class: "panel team" },
    h("h2", {}, "Your team"),
    points,
    h("h3", {}, "Active"),
    h("div", { class: "slots slots--active" }, ...slotEls.slice(0, activeSlots)),
    h("h3", {}, "Bench"),
    h("div", { class: "slots" }, ...slotEls.slice(activeSlots)),
    h("p", { class: "team__help" }, "Click a critter to add it. Click a slot to remove it. Drag slots to reorder."),
    devMode ? h("div", { class: "field" }, h("label", { for: "seed" }, "Seed (dev)"), seedInput) : null,
    startError,
    start,
  );

  function update() {
    const cost = used();
    pointsText.textContent = `${cost} / ${pointBudget}`;
    [...pips.children].forEach((pip, i) => pip.classList.toggle("on", i < cost));
    const full = !slots.includes(null);

    for (const [lineId, card] of cards) {
      const line = getCritterLine(lineId) as CritterLine;
      const picked = slots.includes(lineId);
      const blocked = !picked && (full || cost + line.cost > pointBudget);
      card.classList.toggle("critter-card--picked", picked);
      card.classList.toggle("critter-card--blocked", blocked);
      card.setAttribute("aria-pressed", String(picked));
      card.setAttribute("aria-disabled", String(blocked));
      card.title = blocked ? (full ? "Your team is full." : "Not enough points left.") : "";
    }

    slotEls.forEach((slot, i) => {
      const line = slots[i] ? getCritterLine(slots[i] as string) : undefined;
      slot.classList.toggle("slot--filled", Boolean(line));
      if (line) {
        const name = line.stages[0]?.name ?? line.line;
        slot.replaceChildren(critterIcon(line), h("span", { class: "slot__name" }, name), h("span", { class: "cost" }, line.cost));
        slot.setAttribute("aria-label", `${name}. Click to remove.`);
      } else {
        slot.replaceChildren(h("span", { class: "slot__empty" }, i < activeSlots ? "Active" : "Bench"));
        slot.setAttribute("aria-label", "Empty slot");
      }
    });

    start.disabled = starting || validateStarterTeam(team(), me.unlocks) !== null;
  }

  root.replaceChildren(
    header,
    h(
      "main",
      { class: "starter" },
      h("section", { class: "starter__main" }, h("h1", {}, "Choose your starters"), h("p", { class: "section__lead" }, `Build a team of up to ${SLOT_COUNT} critters with ${pointBudget} points.`), grid),
      panel,
    ),
  );
  update();

  if (me.hasSave) showContinueModal(root);
}

function showContinueModal(root: HTMLElement) {
  const error = h("p", { class: "notice notice--error", role: "alert", hidden: true });
  const abandon = h("button", { class: "btn btn--danger", type: "button" }, "Abandon");
  let armed = false;
  abandon.addEventListener("click", async () => {
    if (!armed) {
      armed = true;
      abandon.textContent = "Delete this run?";
      return;
    }
    abandon.disabled = true;
    try {
      await api.deleteRun();
      overlay.remove();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Could not delete the run.";
      error.hidden = false;
      abandon.disabled = false;
    }
  });
  const proceed = h("button", { class: "btn btn--gold", type: "button", onclick: () => navigate("/game") }, "Continue");
  const overlay = h(
    "div",
    { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "continue-title" },
    h(
      "div",
      { class: "panel modal__box" },
      h("h2", { id: "continue-title" }, "Continue your run?"),
      h("p", {}, "You have a run in progress. Abandoning it deletes the save for good."),
      error,
      h("div", { class: "modal__actions" }, abandon, proceed),
    ),
  );
  root.append(overlay);
  proceed.focus();
}

function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}
