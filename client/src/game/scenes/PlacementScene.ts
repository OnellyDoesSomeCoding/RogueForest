// Pre-fight placement (TECH_DESIGN §7.2): enemies are visible, the player places the active critters.
import { applyAction } from "@shared/engine/combat/combat";
import { isFree, isOptimalTile, unitAt } from "@shared/engine/combat/grid";
import { CombatError, type CombatAction, type CombatState, type CombatUnit, type Pos } from "@shared/engine/combat/types";
import * as Phaser from "phaser";
import { BoardView } from "../board";
import type { DomText } from "../domText";
import { UnitCard } from "../cards";
import { COLOR, TEXT, W, label, makeButton, panel, session, setupCamera, type Button } from "../ui";

const TILE_NAME = { front: "Front", back: "Back", flank: "Flank" } as const;

export class PlacementScene extends Phaser.Scene {
  private state!: CombatState;
  private board!: BoardView;
  private card!: UnitCard;
  private selectedId: string | null = null;
  private rows: { unit: CombatUnit; bg: Phaser.GameObjects.Graphics; status: DomText; y: number }[] = [];
  private startButton!: Button;
  private hint!: DomText;

  constructor() {
    super("Placement");
  }

  create(): void {
    setupCamera(this);
    this.rows = [];
    this.state = session(this).combat as CombatState;
    if (this.textures.exists("bg")) this.add.image(0, 0, "bg").setOrigin(0);
    this.add.rectangle(0, 0, W, 34, COLOR.black, 0.6).setOrigin(0);

    label(this, W / 2, 5, "Place your team", { size: 14, bold: true, color: TEXT.gold, originX: 0.5 }).setStroke("#050a08", 3);
    label(this, W / 2, 22, "The enemies are already in position.", { color: TEXT.main, originX: 0.5 });

    this.board = new BoardView(this, this.state, { x: 150, y: 38, w: 180, h: 140 });
    this.card = new UnitCard(this, 334, 38, 142, 138);

    // ---- roster ----
    panel(this, 4, 38, 142, 138, 20);
    label(this, 11, 43, "Your team", { size: 10, bold: true, color: TEXT.gold, depth: 21 });
    const mine = this.state.units.filter((u) => u.side === "player");
    mine.forEach((unit, i) => {
      const y = 58 + i * 38;
      const bg = this.add.graphics().setDepth(21);
      label(this, 14, y + 4, unit.name, { size: 9, bold: true, depth: 22, color: unit.fainted ? TEXT.muted : TEXT.main });
      label(this, 136, y + 5, `Lv ${unit.level}`, { originX: 1, color: TEXT.muted, depth: 22 });
      label(this, 14, y + 15, `HP ${unit.hp}/${unit.stats.hp}   Best: ${TILE_NAME[unit.optimalTile]}`, { color: TEXT.muted, depth: 22 });
      const status = label(this, 14, y + 25, "", { depth: 22 });
      this.rows.push({ unit, bg, status, y });
      if (!unit.fainted) {
        this.add
          .zone(8, y, 134, 36)
          .setOrigin(0)
          .setDepth(23)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.select(unit.id));
      }
    });

    // ---- bottom bar ----
    panel(this, 4, 182, 472, 84, 20);
    this.hint = label(this, 12, 190, "", { wrap: 300, depth: 21 });
    label(this, 12, 240, "Green tiles give the selected critter +10% damage. The bonus is checked at the start of each of its turns.", {
      color: TEXT.muted,
      wrap: 300,
      depth: 21,
    });
    this.startButton = makeButton(this, 330, 192, 138, 30, "Start Battle", () => this.start(), { gold: true, size: 12, depth: 22 });
    makeButton(this, 330, 230, 138, 22, "Leave", () => session(this).leave(), { depth: 22 });

    // ---- input ----
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const tile = this.board.tileAt(p.worldX, p.worldY);
      const unit = tile ? unitAt(this.state, tile) : undefined;
      this.card.show(unit ?? null, "Hover a critter to see its stats and moves.");
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const tile = this.board.tileAt(p.worldX, p.worldY);
      if (tile) this.clickTile(tile);
    });

    this.card.show(null, "Hover a critter to see its stats and moves.");
    this.select(mine.find((u) => !u.fainted && u.pos === null)?.id ?? mine.find((u) => !u.fainted)?.id ?? null);
  }

  private apply(action: CombatAction): boolean {
    try {
      this.state = applyAction(this.state, action).state;
    } catch (err) {
      if (!(err instanceof CombatError)) throw err;
      this.hint.setText(err.message);
      return false;
    }
    session(this).combat = this.state;
    this.board.sync(this.state);
    return true;
  }

  private clickTile(tile: Pos): void {
    const occupant = unitAt(this.state, tile);
    if (occupant?.side === "player") return this.select(occupant.id);
    if (!this.selectedId || !isFree(this.state, tile)) return;
    if (!this.apply({ type: "place", unitId: this.selectedId, pos: tile })) return;
    // Move on to the next critter that still needs a tile.
    const next = this.state.units.find((u) => u.side === "player" && !u.fainted && u.pos === null);
    this.select(next?.id ?? this.selectedId);
  }

  private select(id: string | null): void {
    this.selectedId = id;
    const unit = this.state.units.find((u) => u.id === id);

    for (const row of this.rows) {
      const current = this.state.units.find((u) => u.id === row.unit.id) as CombatUnit;
      const active = current.id === id;
      row.bg.clear();
      row.bg.fillStyle(active ? COLOR.goldHi : COLOR.line, 1).fillRect(8, row.y, 134, 36);
      row.bg.fillStyle(active ? COLOR.panelHi : COLOR.black, 1).fillRect(9, row.y + 1, 132, 34);
      row.status.setText(current.fainted ? "Fainted" : current.pos ? "Placed" : "Not placed").setColor(current.fainted ? TEXT.bad : current.pos ? TEXT.good : TEXT.gold);
    }

    // Soft green tint on the selected critter's optimal tiles.
    const tiles: Pos[] = [];
    if (unit) {
      for (let y = 0; y < this.state.height; y++)
        for (let x = 0; x < this.state.width; x++) {
          const pos = { x, y };
          if (isOptimalTile(unit.optimalTile, pos, this.state.width, this.state.height) && (isFree(this.state, pos) || unitAt(this.state, pos)?.id === unit.id)) tiles.push(pos);
        }
    }
    this.board.highlight([{ tiles, color: COLOR.optimal, alpha: 0.4, outline: true }]);
    for (const [unitId, view] of this.board.units) view.setCurrent(unitId === id);

    const waiting = this.state.units.filter((u) => u.side === "player" && !u.fainted && u.pos === null).length;
    this.startButton.setEnabled(waiting === 0);
    this.hint.setText(
      waiting === 0
        ? "Everyone is placed. Start the battle, or click a critter and then a tile to move it."
        : unit
          ? `Click any empty tile to place ${unit.name}.`
          : "Pick a critter from your team.",
    );
  }

  private start(): void {
    const before = this.state;
    let result;
    try {
      result = applyAction(before, { type: "start" });
    } catch (err) {
      if (!(err instanceof CombatError)) throw err;
      this.hint.setText(err.message);
      return;
    }
    const s = session(this);
    s.combat = result.state;
    s.rngState = result.state.rngState;
    // The combat scene builds the board from `before` and then plays the opening events.
    this.scene.start("Combat", { from: before, events: result.events });
  }
}
