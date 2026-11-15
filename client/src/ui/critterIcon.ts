// Critter portrait for the HTML pages.
// Uses assets/critters/<stageId>.png when it exists. Otherwise draws the placeholder from
// TECH_DESIGN §14: a circle in the critter's type color with its initial letter.
import { firstStage, getType } from "@shared/gameData";
import type { CritterLine } from "@shared/types";
import { h } from "./dom";

export function critterIcon(line: CritterLine, options: { locked?: boolean; stageId?: string } = {}): HTMLElement {
  const stage = line.stages.find((s) => s.id === options.stageId) ?? firstStage(line);
  const colors = line.types.map((t) => getType(t).color);
  const [first = "#888888", second = first] = colors;

  const placeholder = h(
    "span",
    { class: "critter-icon__placeholder", "aria-hidden": "true" },
    options.locked ? "?" : stage.name.charAt(0),
  );
  placeholder.style.background = `linear-gradient(135deg, ${first} 0 50%, ${second} 50% 100%)`;

  const icon = h("span", { class: "critter-icon" + (options.locked ? " critter-icon--locked" : "") }, placeholder);

  const img = new Image();
  img.className = "critter-icon__sprite";
  img.alt = "";
  img.draggable = false;
  img.addEventListener("load", () => {
    // Vite's dev server answers missing files with index.html, which never fires "load" for an image.
    placeholder.remove();
    icon.append(img);
  });
  img.src = `/assets/critters/${stage.id}.png`;

  return icon;
}

export function typeChips(line: CritterLine): HTMLElement {
  const wrap = h("span", { class: "type-chips" });
  for (const typeId of line.types) {
    const def = getType(typeId);
    const chip = h("span", { class: "type-chip", title: `${def.id} (${def.label})` }, def.id);
    chip.style.setProperty("--chip", def.color);
    wrap.append(chip);
  }
  return wrap;
}
