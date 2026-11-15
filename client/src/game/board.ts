// Draws the grid and the units on it. Used by the placement and combat scenes.
import { isAlive } from "@shared/engine/combat/grid";
import type { CombatState, CombatUnit, Pos } from "@shared/engine/combat/types";
import { getType } from "@shared/gameData";
import * as Phaser from "phaser";
import { COLOR, TEXT, TILE, canvasLabel, label, textureKey } from "./ui";

/** Sprite sheet frames (see the art README). */
export const FRAME = { idleA: 0, idleB: 1, windup: 2, strike: 3, hurt: 4, faint: 5 } as const;

export interface HighlightLayer {
  tiles: Pos[];
  color: number;
  /** Fill opacity. */
  alpha: number;
  /** Draw a border around each tile. */
  outline?: boolean;
}

export class UnitView {
  readonly root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private ring: Phaser.GameObjects.Ellipse;
  private hpFill: Phaser.GameObjects.Rectangle;
  private maxHp: number;
  private readonly stageId: string;

  constructor(
    private scene: Phaser.Scene,
    unit: CombatUnit,
  ) {
    this.stageId = unit.stageId;
    this.maxHp = unit.stats.hp;
    const sideColor = unit.side === "player" ? COLOR.player : COLOR.enemy;

    this.ring = scene.add.ellipse(0, -3, 26, 9, COLOR.gold, 0.9).setVisible(false);
    const shadow = scene.add.ellipse(0, -3, 20, 6, 0x000000, 0.35);
    const parts: Phaser.GameObjects.GameObject[] = [this.ring, shadow];

    const key = textureKey.critter(unit.stageId);
    if (scene.textures.exists(key)) {
      // Sprites face right. Enemies use the same sprite, flipped.
      this.sprite = scene.add.sprite(0, 0, key, FRAME.idleA).setOrigin(0.5, 1).setFlipX(unit.side === "enemy");
      parts.push(this.sprite);
    } else {
      // Placeholder: a circle in the first type's color with the critter's initial.
      const color = Phaser.Display.Color.HexStringToColor(getType(unit.types[0] ?? "Flora").color).color;
      parts.push(scene.add.circle(0, -15, 12, COLOR.black), scene.add.circle(0, -15, 11, color));
      // Canvas text: it has to move with the unit's container.
      parts.push(canvasLabel(scene, 0, -15, unit.name.charAt(0), { size: 12, bold: true, originX: 0.5, originY: 0.5 }).setStroke("#050a08", 3));
    }

    // HP bar, tinted by side so the teams are easy to tell apart.
    parts.push(scene.add.rectangle(0, 1, 24, 5, COLOR.black), scene.add.rectangle(0, 1, 22, 3, 0x26302b));
    this.hpFill = scene.add.rectangle(-11, 1, 22, 3, sideColor).setOrigin(0, 0.5);
    parts.push(this.hpFill);

    this.root = scene.add.container(0, 0, parts);
    this.setHp(unit.hp);
    this.idle();
  }

  place(x: number, y: number): void {
    this.root.setPosition(x, y).setDepth(100 + y);
  }

  setHp(hp: number): void {
    this.hpFill.width = Math.max(0, Math.round((22 * hp) / this.maxHp));
  }

  setCurrent(current: boolean): void {
    this.ring.setVisible(current);
  }

  idle(): void {
    if (this.sprite && this.scene.anims.exists(`idle:${this.stageId}`)) this.sprite.play(`idle:${this.stageId}`);
  }

  /** Shows one sheet frame (windup, strike, hurt, faint) and stops the idle loop. */
  frame(index: number): void {
    if (!this.sprite) return;
    this.sprite.stop();
    this.sprite.setFrame(index);
  }

  destroy(): void {
    this.root.destroy();
  }
}

export class BoardView {
  readonly x: number;
  readonly y: number;
  readonly units = new Map<string, UnitView>();
  private highlights: Phaser.GameObjects.Graphics;

  /** Centers the grid inside `area`. */
  constructor(
    private scene: Phaser.Scene,
    private state: CombatState,
    area: { x: number; y: number; w: number; h: number },
  ) {
    const { width, height } = state;
    this.x = Math.round(area.x + (area.w - width * TILE) / 2);
    this.y = Math.round(area.y + (area.h - height * TILE) / 2);

    const frame = scene.add.graphics().setDepth(1);
    frame.fillStyle(COLOR.black, 0.85).fillRect(this.x - 3, this.y - 3, width * TILE + 6, height * TILE + 6);

    const hasTiles = scene.textures.exists("tile:a") && scene.textures.exists("tile:b");
    const flat = scene.add.graphics().setDepth(2);
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const px = this.x + tx * TILE;
        const py = this.y + ty * TILE;
        const even = (tx + ty) % 2 === 0;
        if (hasTiles) scene.add.image(px, py, even ? "tile:a" : "tile:b").setOrigin(0).setDepth(2);
        else flat.fillStyle(even ? 0x5fb245 : 0x57a53f, 1).fillRect(px, py, TILE, TILE);
      }
    }
    // Thin grid lines, so tiles stay readable on top of the art.
    const lines = scene.add.graphics().setDepth(3);
    lines.lineStyle(1, 0x000000, 0.18);
    for (let tx = 1; tx < width; tx++) lines.lineBetween(this.x + tx * TILE, this.y, this.x + tx * TILE, this.y + height * TILE);
    for (let ty = 1; ty < height; ty++) lines.lineBetween(this.x, this.y + ty * TILE, this.x + width * TILE, this.y + ty * TILE);

    this.highlights = scene.add.graphics().setDepth(5);

    for (const rock of state.obstacles) {
      const c = this.center(rock);
      if (scene.textures.exists("rock")) scene.add.image(c.x, c.y, "rock").setDepth(100 + c.y);
      else {
        scene.add.ellipse(c.x, c.y + 3, 26, 20, 0x4c5560).setDepth(100 + c.y);
        scene.add.ellipse(c.x - 3, c.y - 1, 16, 10, 0x7c8794).setDepth(100 + c.y);
      }
    }
    this.sync(state);
  }

  center(pos: Pos): { x: number; y: number } {
    return { x: this.x + pos.x * TILE + TILE / 2, y: this.y + pos.y * TILE + TILE / 2 };
  }

  /** Where a unit's feet go: bottom-center of the tile, so the sprite overlaps upward. */
  feet(pos: Pos): { x: number; y: number } {
    return { x: this.x + pos.x * TILE + TILE / 2, y: this.y + pos.y * TILE + TILE - 5 };
  }

  tileAt(worldX: number, worldY: number): Pos | null {
    const tx = Math.floor((worldX - this.x) / TILE);
    const ty = Math.floor((worldY - this.y) / TILE);
    return tx >= 0 && ty >= 0 && tx < this.state.width && ty < this.state.height ? { x: tx, y: ty } : null;
  }

  highlight(layers: HighlightLayer[]): void {
    const g = this.highlights;
    g.clear();
    for (const layer of layers) {
      for (const t of layer.tiles) {
        const px = this.x + t.x * TILE;
        const py = this.y + t.y * TILE;
        g.fillStyle(layer.color, layer.alpha).fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        if (layer.outline) g.lineStyle(1, layer.color, 0.95).strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
      }
    }
  }

  /** Makes the views match a state, without animation. */
  sync(state: CombatState): void {
    this.state = state;
    for (const unit of state.units) {
      let view = this.units.get(unit.id);
      if (!isAlive(unit)) {
        view?.destroy();
        this.units.delete(unit.id);
        continue;
      }
      if (!view) {
        view = new UnitView(this.scene, unit);
        this.units.set(unit.id, view);
      }
      const f = this.feet(unit.pos as Pos);
      view.place(f.x, f.y);
      view.setHp(unit.hp);
    }
  }

  /** A short text that floats up from a tile and fades (damage numbers, "Strong!"). */
  floatText(pos: { x: number; y: number }, text: string, color: string = TEXT.main, size = 10): void {
    const t = label(this.scene, pos.x, pos.y, text, { size, bold: true, color, originX: 0.5, originY: 1, depth: 900 }).setStroke("#050a08", 3);
    this.scene.tweens.add({ targets: t, y: pos.y - 16, alpha: { from: 1, to: 0 }, duration: 800, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
}
