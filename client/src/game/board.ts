// Draws the grid, the units, rocks and enemy intents. Used by the placement and combat scenes.
import { isAlive, posKey, samePos } from "@shared/engine/combat/grid";
import type { CombatState, CombatUnit, Intent, Obstacle, Pos } from "@shared/engine/combat/types";
import { getCritterLine, getMove, getStatus, getType } from "@shared/gameData";
import type { StatusId } from "@shared/types";
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

/** Roughly how tall each evolution stage's sprite is (art spec), for placing things above heads. */
const STAGE_HEIGHT = [30, 38, 46];

export class UnitView {
  readonly root: Phaser.GameObjects.Container;
  /** The tile the view stands on. Kept in step with animations. */
  tile: Pos = { x: 0, y: 0 };
  readonly headY: number;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private ring: Phaser.GameObjects.Ellipse;
  private hpFill: Phaser.GameObjects.Rectangle;
  private maxHp: number;
  private readonly stageId: string;
  private statusIcons: Phaser.GameObjects.GameObject[] = [];
  private intentBadge: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private scene: Phaser.Scene,
    unit: CombatUnit,
  ) {
    this.stageId = unit.stageId;
    this.maxHp = unit.stats.hp;
    const stageIndex = Math.max(0, getCritterLine(unit.line)?.stages.findIndex((s) => s.id === unit.stageId) ?? 0);
    this.headY = -(STAGE_HEIGHT[stageIndex] ?? 30);
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
    this.setStatuses(unit.statuses.map((s) => s.id));
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

  /** Small status icons in a row just above the HP bar. Shows up to 3. */
  setStatuses(ids: StatusId[]): void {
    for (const icon of this.statusIcons) icon.destroy();
    this.statusIcons = [];
    ids.slice(0, 3).forEach((id, i) => {
      const key = statusIconKey(id);
      if (!this.scene.textures.exists(key)) return;
      const x = -11 + i * 9;
      const back = this.scene.add.rectangle(x, -6, 9, 9, COLOR.black, 0.75);
      const icon = this.scene.add.image(x, -6, key).setScale(0.5);
      this.statusIcons.push(back, icon);
      this.root.add([back, icon]);
    });
    if (ids.length > 3) {
      const more = this.scene.add.rectangle(16, -6, 3, 3, COLOR.goldHi);
      this.statusIcons.push(more);
      this.root.add(more);
    }
  }

  /**
   * A badge in the top-right corner of the unit's tile with the planned move's type icon.
   * Red for attacks, green for support, grey for "only moves". Kept inside the tile so it never
   * covers the unit above.
   */
  setIntent(intent: Intent | null): void {
    for (const part of this.intentBadge) part.destroy();
    this.intentBadge = [];
    if (!intent) return;
    const x = 9;
    const y = -20;
    const border = intent.moveId === null ? 0x8a9a92 : intent.hostile ? COLOR.intent : COLOR.optimal;
    const parts: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(x, y, 14, 14, COLOR.black), this.scene.add.rectangle(x, y, 12, 12, border)];
    parts.push(this.scene.add.rectangle(x, y, 10, 10, 0x14261f));
    const key = intent.moveId ? textureKey.typeIcon(getMove(intent.moveId).type) : null;
    if (key && this.scene.textures.exists(key)) parts.push(this.scene.add.image(x, y, key).setScale(0.5));
    else parts.push(this.scene.add.triangle(x, y, -3, 2, 3, 2, 0, -3, border)); // "moves only": a small arrow
    this.intentBadge = parts;
    this.root.add(parts);
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

export const statusIconKey = (id: StatusId): string => `icon:status_${getStatus(id).icon}`;

export class BoardView {
  readonly x: number;
  readonly y: number;
  readonly units = new Map<string, UnitView>();
  private highlights: Phaser.GameObjects.Graphics;
  private intentTiles: Phaser.GameObjects.Graphics;
  private intentObjects: Phaser.GameObjects.GameObject[] = [];
  private rocks = new Map<string, Phaser.GameObjects.GameObject[]>();

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

    // Enemy intents sit under the player's own highlights.
    this.intentTiles = scene.add.graphics().setDepth(4);
    this.highlights = scene.add.graphics().setDepth(5);
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
    drawLayers(this.highlights, this.x, this.y, layers);
  }

  /** Moves a unit's view to a tile without animation. */
  placeUnit(view: UnitView, tile: Pos): void {
    const f = this.feet(tile);
    view.tile = { ...tile };
    view.place(f.x, f.y);
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
      this.placeUnit(view, unit.pos as Pos);
      view.setHp(unit.hp);
      view.setStatuses(unit.statuses.map((s) => s.id));
    }
    this.syncRocks(state.obstacles);
  }

  syncRocks(obstacles: Obstacle[]): void {
    const wanted = new Set(obstacles.map(posKey));
    for (const [key, parts] of this.rocks) {
      if (wanted.has(key)) continue;
      for (const p of parts) p.destroy();
      this.rocks.delete(key);
    }
    for (const rock of obstacles) if (!this.rocks.has(posKey(rock))) this.addRock(rock, false);
  }

  addRock(pos: Pos, animate: boolean): void {
    const key = posKey(pos);
    if (this.rocks.has(key)) return;
    const c = this.center(pos);
    const depth = 100 + c.y;
    const parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse)[] = [];
    if (this.scene.textures.exists("rock")) parts.push(this.scene.add.image(c.x, c.y, "rock").setDepth(depth));
    else parts.push(this.scene.add.ellipse(c.x, c.y + 3, 26, 20, 0x4c5560).setDepth(depth), this.scene.add.ellipse(c.x - 3, c.y - 1, 16, 10, 0x7c8794).setDepth(depth));
    this.rocks.set(key, parts);
    if (!animate) return;
    // Drop in from a little above.
    for (const p of parts) {
      p.y -= 12;
      p.alpha = 0;
    }
    this.scene.tweens.add({ targets: parts, y: "+=12", alpha: 1, duration: 260, ease: "Bounce.easeOut" });
  }

  removeRock(pos: Pos): void {
    const key = posKey(pos);
    const parts = this.rocks.get(key);
    if (!parts) return;
    this.rocks.delete(key);
    this.scene.tweens.add({ targets: parts, alpha: 0, duration: 250, onComplete: () => parts.forEach((p) => p.destroy()) });
  }

  /**
   * Shows enemy plans: red tiles for attacks, a ghost of the enemy on the tile it will walk to,
   * and a badge with the move's type icon above its head.
   */
  showIntents(intents: Intent[]): void {
    for (const obj of this.intentObjects) obj.destroy();
    this.intentObjects = [];
    const red = intents.filter((i) => i.hostile && i.moveId).flatMap((i) => i.tiles);
    drawLayers(this.intentTiles, this.x, this.y, [{ tiles: red, color: COLOR.intent, alpha: 0.32, outline: true }]);

    for (const [id, view] of this.units) view.setIntent(intents.find((i) => i.unitId === id) ?? null);

    for (const intent of intents) {
      const view = this.units.get(intent.unitId);
      const unit = this.state.units.find((u) => u.id === intent.unitId);
      if (!view || !unit || samePos(view.tile, intent.dest)) continue;
      // Ghost: the enemy's sprite, faded, on its destination tile, with a dashed outline.
      const f = this.feet(intent.dest);
      const key = textureKey.critter(unit.stageId);
      if (this.scene.textures.exists(key)) {
        this.intentObjects.push(this.scene.add.image(f.x, f.y, key, FRAME.idleA).setOrigin(0.5, 1).setFlipX(true).setAlpha(0.35).setTint(0xffc7c0).setDepth(99 + f.y));
      } else {
        this.intentObjects.push(this.scene.add.circle(f.x, f.y - 15, 11, COLOR.enemy, 0.35).setDepth(99 + f.y));
      }
      const g = this.scene.add.graphics().setDepth(6);
      const px = this.x + intent.dest.x * TILE;
      const py = this.y + intent.dest.y * TILE;
      g.fillStyle(0xffffff, 0.8);
      for (let i = 2; i < TILE - 2; i += 4) {
        g.fillRect(px + i, py + 1, 2, 1);
        g.fillRect(px + i, py + TILE - 2, 2, 1);
        g.fillRect(px + 1, py + i, 1, 2);
        g.fillRect(px + TILE - 2, py + i, 1, 2);
      }
      this.intentObjects.push(g);
    }
  }

  /** A short text that floats up from a tile and fades (damage numbers, "Strong!"). */
  floatText(pos: { x: number; y: number }, text: string, color: string = TEXT.main, size = 10): void {
    const t = label(this.scene, pos.x, pos.y, text, { size, bold: true, color, originX: 0.5, originY: 1, depth: 900 }).setStroke("#050a08", 3);
    this.scene.tweens.add({ targets: t, y: pos.y - 16, alpha: { from: 1, to: 0 }, duration: 900, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
}

function drawLayers(g: Phaser.GameObjects.Graphics, x0: number, y0: number, layers: HighlightLayer[]): void {
  g.clear();
  for (const layer of layers) {
    for (const t of layer.tiles) {
      const px = x0 + t.x * TILE;
      const py = y0 + t.y * TILE;
      g.fillStyle(layer.color, layer.alpha).fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      if (layer.outline) g.lineStyle(1, layer.color, 0.95).strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
    }
  }
}
