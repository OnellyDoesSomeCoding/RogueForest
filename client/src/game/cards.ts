// Info panels: a unit's stats, and plain-language move descriptions.
import { effectiveMov, effectiveSpd } from "@shared/engine/combat/statuses";
import type { CombatUnit } from "@shared/engine/combat/types";
import { getMove, getStatus } from "@shared/gameData";
import type { Effect, Move, StatusId } from "@shared/types";
import * as Phaser from "phaser";
import { statusIconKey } from "./board";
import { COLOR, TEXT, label, panel, textureKey, type Layered } from "./ui";

const SHAPE_TEXT: Record<Move["shape"], string> = {
  single: "one tile",
  line: "a line that stops at the first unit",
  plus: "a plus of 5 tiles",
  square3: "a 3×3 area",
  around: "the 8 tiles around the user",
  row: "a whole row or column",
  self: "the user",
};

function effectText(e: Effect): string | null {
  switch (e.type) {
    case "status":
      return `${e.status} (${getStatus(e.status as StatusId).text.replace(/.$/, "").toLowerCase()})`;
    case "push":
      return `Push ${e.distance}`;
    case "pull":
      return `Pull ${e.distance}`;
    case "pullToCenter":
      return `Pull ${e.distance} toward the center`;
    case "heal":
      return `Heal ${e.percent}%`;
    case "lifesteal":
      return `Heal the user for ${e.percent}% of the damage`;
    case "obstacle":
      return `Place a rock for ${e.rounds} rounds`;
    case "ignoreGuard":
      return "Ignores Guard";
    case "cleanse":
      return "Remove bad statuses";
    default:
      return null;
  }
}

export function describeMove(move: Move): string {
  const pierces = move.effects.some((e) => e.type === "pierce");
  const withSelf = move.effects.some((e) => e.type === "includeSelf");
  const shape = move.shape === "line" && pierces ? "a line through every unit" : move.target === "tile" ? "an empty tile" : SHAPE_TEXT[move.shape];
  const who = move.target === "ally" ? (withSelf ? " (the user and allies)" : " (allies)") : "";
  const range = move.range[1] === 0 || move.shape === "row" ? "" : ` Range ${move.range[0]}–${move.range[1]}.`;
  const head = `${move.name}: ${move.type}, ${move.mana} mana${move.power > 0 ? `, power ${move.power}` : ""}. Hits ${shape}${who}.${range}`;
  const effects = move.effects.map(effectText).filter(Boolean);
  const cooldown = move.cooldown > 0 ? ` Cooldown ${move.cooldown}.` : "";
  return head + cooldown + (effects.length ? ` ${effects.join(". ")}.` : "");
}

/** A short label for a move button: what it does besides damage. */
export function moveTag(move: Move): string {
  if (move.power > 0) return `Pow ${move.power}`;
  if (move.target === "tile") return "Rock";
  const status = move.effects.find((e) => e.type === "status");
  if (move.effects.some((e) => e.type === "heal")) return "Heal";
  return status && status.type === "status" ? status.status : "Support";
}

const TILE_NAME = { front: "Front", back: "Back", flank: "Flank" } as const;

/** A panel that shows one unit's stats, or a hint when there is no unit. */
export class UnitCard {
  private items: Layered[] = [];

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    h: number,
  ) {
    panel(scene, x, y, w, h, 20);
  }

  show(unit: CombatUnit | null, hint = "", options: { showBonus?: boolean } = {}): void {
    for (const item of this.items) item.destroy();
    this.items = [];
    const add = <T extends Layered>(obj: T): T => {
      obj.setDepth(21);
      this.items.push(obj);
      return obj;
    };
    const { scene, x, y, w } = this;
    const left = x + 7;

    if (!unit) {
      add(label(scene, left, y + 7, hint, { color: TEXT.muted, wrap: w - 14 }));
      return;
    }

    add(label(scene, left, y + 6, unit.name, { size: 10, bold: true, color: unit.side === "player" ? TEXT.gold : TEXT.bad }));
    add(label(scene, x + w - 7, y + 7, `Lv ${unit.level}`, { originX: 1, color: TEXT.muted }));

    let tx = left;
    for (const type of unit.types) {
      const key = textureKey.typeIcon(type);
      if (scene.textures.exists(key)) {
        add(scene.add.image(tx, y + 20, key).setOrigin(0));
        tx += 18;
      }
      const name = add(label(scene, tx, y + 24, type));
      tx += name.width + 6;
    }

    const barW = w - 14;
    add(label(scene, left, y + 39, "HP"));
    add(label(scene, x + w - 7, y + 39, `${unit.hp} / ${unit.stats.hp}`, { originX: 1 }));
    add(scene.add.rectangle(left, y + 50, barW, 5, COLOR.black).setOrigin(0));
    const ratio = unit.hp / unit.stats.hp;
    add(scene.add.rectangle(left + 1, y + 51, Math.max(0, Math.round((barW - 2) * ratio)), 3, ratio > 0.3 ? COLOR.hp : COLOR.hpLow).setOrigin(0));

    add(label(scene, left, y + 59, `ATK ${unit.stats.atk}`));
    add(label(scene, left + 62, y + 59, `DEF ${unit.stats.def}`));
    // SPD and MOV after statuses: green when raised, red when lowered.
    const shade = (now: number, base: number) => (now > base ? TEXT.good : now < base ? TEXT.bad : TEXT.main);
    const spd = effectiveSpd(unit);
    const mov = effectiveMov(unit);
    add(label(scene, left, y + 69, `SPD ${spd}`, { color: shade(spd, unit.stats.spd) }));
    add(label(scene, left + 62, y + 69, `MOV ${mov}`, { color: shade(mov, unit.stats.mov) }));

    const bonus = options.showBonus ? (unit.onOptimalTile ? "  +10% now" : "") : "";
    add(label(scene, left, y + 81, `Best tile: ${TILE_NAME[unit.optimalTile]}${bonus}`, { color: bonus ? TEXT.good : TEXT.muted }));

    add(label(scene, left, y + 93, unit.moves.map((id) => getMove(id).name).join(", "), { color: TEXT.muted, wrap: w - 14 }));

    // Statuses with turns left.
    let sx = left;
    for (const s of unit.statuses) {
      const def = getStatus(s.id);
      const key = statusIconKey(s.id);
      if (scene.textures.exists(key)) {
        add(scene.add.image(sx, y + 118, key).setOrigin(0).setScale(0.75));
        sx += 13;
      }
      const text = add(label(scene, sx, y + 120, `${s.id} ${s.turns}`, { color: def.kind === "bad" ? TEXT.bad : TEXT.good }));
      sx += text.width + 6;
    }
  }
}
