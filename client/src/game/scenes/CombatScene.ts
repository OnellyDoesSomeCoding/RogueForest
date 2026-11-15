// The fight (TECH_DESIGN §7.3): timeline, shared mana, move-then-act turns.
// The engine decides everything. This scene sends actions and animates the events it gets back.
import { applyAction, currentUnit, moveBlockedReason } from "@shared/engine/combat/combat";
import { computeDamage } from "@shared/engine/combat/damage";
import { createEncounter } from "@shared/engine/combat/encounter";
import { posKey, reachableTiles, samePos, unitAt } from "@shared/engine/combat/grid";
import { affectedUnits, validOptions, type TargetOption } from "@shared/engine/combat/targeting";
import { CombatError, type CombatAction, type CombatEvent, type CombatState, type CombatUnit, type Pos } from "@shared/engine/combat/types";
import { Rng } from "@shared/engine/rng";
import { getMove } from "@shared/gameData";
import type { Move } from "@shared/types";
import * as Phaser from "phaser";
import { BoardView, FRAME } from "../board";
import { hideTextBelow, type DomText } from "../domText";
import { UnitCard, describeMove } from "../cards";
import { COLOR, H, TEXT, W, label, makeButton, panel, session, setupCamera, textureKey, tween, wait, type Button, type Disposable } from "../ui";

const DEFAULT_HINT = "Click a blue tile to move. Then pick a move and a target. Keys: 1–4 moves, E end turn, Esc cancel.";

export class CombatScene extends Phaser.Scene {
  private state!: CombatState;
  private board!: BoardView;
  private currentCard!: UnitCard;
  private hoverCard!: UnitCard;
  private busy = false;
  private closed = false;
  private resultShown = false;

  private selected: Move | null = null;
  private options: TargetOption[] = [];
  private hoverTile: Pos | null = null;
  private previews: Disposable[] = [];

  private moveButtons: Button[] = [];
  private endTurnButton!: Button;
  private hint!: DomText;
  private roundText!: DomText;
  private manaPips!: Phaser.GameObjects.Graphics;
  private timelineItems: Disposable[] = [];

  // What the HUD currently shows. During playback it lags behind `state` and follows the events.
  private shown = { round: 0, mana: 0, order: [] as string[], current: null as string | null, fainted: new Set<string>() };

  constructor() {
    super("Combat");
  }

  create(data: { from?: CombatState; events?: CombatEvent[] }): void {
    setupCamera(this);
    this.busy = false;
    this.closed = false;
    this.resultShown = false;
    this.selected = null;
    this.moveButtons = [];
    this.timelineItems = [];
    this.previews = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.closed = true));

    this.state = session(this).combat as CombatState;
    const start = data.from ?? this.state;

    if (this.textures.exists("bg")) this.add.image(0, 0, "bg").setOrigin(0);
    this.add.rectangle(0, 0, W, 34, COLOR.black, 0.6).setOrigin(0);

    this.board = new BoardView(this, start, { x: 150, y: 38, w: 180, h: 140 });
    this.currentCard = new UnitCard(this, 4, 38, 142, 138);
    this.hoverCard = new UnitCard(this, 334, 38, 142, 138);

    // ---- top bar ----
    this.roundText = label(this, 8, 4, "", { size: 10, bold: true, color: TEXT.gold });
    label(this, 8, 19, "Mana", {});
    this.manaPips = this.add.graphics();

    // ---- bottom bar ----
    panel(this, 4, 232, 472, 34, 20);
    this.hint = label(this, 11, 237, DEFAULT_HINT, { wrap: 458, depth: 21 });
    this.endTurnButton = makeButton(this, 406, 182, 70, 22, "End Turn", () => this.act({ type: "endTurn" }), { depth: 22 });
    makeButton(this, 406, 207, 70, 22, "Leave", () => session(this).leave(), { depth: 22 });

    // ---- input ----
    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onHover(this.board.tileAt(p.worldX, p.worldY)));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const tile = this.board.tileAt(p.worldX, p.worldY);
      if (p.rightButtonDown()) return this.selectMove(null);
      if (tile) this.onClick(tile);
    });
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "4") this.pickMoveSlot(Number(e.key) - 1);
      else if (e.key === "e" || e.key === "E") this.act({ type: "endTurn" });
      else if (e.key === "Escape") this.selectMove(null);
    });

    if (data.events?.length) {
      this.shown = { round: 0, mana: start.maxMana, order: [], current: null, fainted: new Set() };
      this.drawHud();
      void this.play(data.events);
    } else {
      this.refresh();
    }
  }

  // ---------- actions ----------

  private me(): CombatUnit | null {
    const unit = currentUnit(this.state);
    return unit && unit.side === "player" ? unit : null;
  }

  private async act(action: CombatAction): Promise<void> {
    if (this.busy || !this.me()) return;
    let result;
    try {
      result = applyAction(this.state, action);
    } catch (err) {
      if (!(err instanceof CombatError)) throw err;
      this.hint.setText(err.message);
      return;
    }
    this.state = result.state;
    const s = session(this);
    s.combat = result.state;
    s.rngState = result.state.rngState;
    this.selected = null;
    await this.play(result.events);
  }

  private pickMoveSlot(index: number): void {
    const unit = this.me();
    const id = unit?.moves[index];
    if (!unit || !id || this.busy) return;
    const move = getMove(id);
    const blocked = moveBlockedReason(this.state, unit, move);
    if (blocked) {
      this.hint.setText(`${move.name}: ${blocked}.`);
      return;
    }
    this.selectMove(this.selected?.id === id ? null : move);
  }

  private selectMove(move: Move | null): void {
    if (this.busy) return;
    const unit = this.me();
    this.selected = unit ? move : null;
    this.options = unit && move ? validOptions(this.state, unit, move) : [];
    this.moveButtons.forEach((button, i) => button.setSelected(Boolean(move) && unit?.moves[i] === move?.id));
    this.hint.setText(move ? `${describeMove(move)} Click a yellow tile to use it.` : DEFAULT_HINT);
    this.drawHighlights();
  }

  /** The aiming option under a tile. Lines, rows and "around" accept a click on any covered tile. */
  private optionAt(tile: Pos): TargetOption | undefined {
    const exact = this.options.find((o) => samePos(o.target, tile));
    if (exact || !this.selected) return exact;
    if (this.selected.shape === "single" || this.selected.shape === "plus" || this.selected.shape === "square3") return undefined;
    return this.options.find((o) => o.tiles.some((t) => samePos(t, tile)));
  }

  private onClick(tile: Pos): void {
    const unit = this.me();
    if (this.busy || !unit) return;
    if (this.selected) {
      const option = this.optionAt(tile);
      if (option) void this.act({ type: "useMove", moveId: this.selected.id, target: option.target });
      else this.selectMove(null);
      return;
    }
    if (!this.state.hasMoved && reachableTiles(this.state, unit).has(posKey(tile))) void this.act({ type: "move", to: tile });
  }

  private onHover(tile: Pos | null): void {
    if (this.resultShown) return;
    if (tile && this.hoverTile && samePos(tile, this.hoverTile)) return;
    this.hoverTile = tile;
    const unit = tile ? unitAt(this.state, tile) : undefined;
    this.hoverCard.show(unit ?? null, "Hover a critter to see its stats and moves.", { showBonus: true });
    if (!this.busy) this.drawHighlights();
  }

  // ---------- drawing ----------

  /** Redraws everything from the current state. Called when no animation is running. */
  private refresh(): void {
    const state = this.state;
    this.board.sync(state);
    const active = currentUnit(state);
    this.shown = {
      round: state.round,
      mana: state.mana,
      order: [...state.order],
      current: active?.id ?? null,
      fainted: new Set(state.units.filter((u) => u.fainted).map((u) => u.id)),
    };
    this.drawHud();
    this.buildMoveButtons();
    this.drawHighlights();
    this.hint.setText(DEFAULT_HINT);
    if (state.phase === "won" || state.phase === "lost") this.showResult(state.phase);
  }

  private drawHud(): void {
    const { round, mana, order, current, fainted } = this.shown;
    this.roundText.setText(round > 0 ? `Round ${round}` : "");

    this.manaPips.clear();
    for (let i = 0; i < this.state.maxMana; i++) {
      this.manaPips.fillStyle(COLOR.black, 1).fillRect(34 + i * 11, 19, 9, 9);
      this.manaPips.fillStyle(i < mana ? 0x4fb3ff : 0x23323c, 1).fillRect(35 + i * 11, 20, 7, 7);
    }

    // Timeline: portraits in turn order. The unit whose turn it is gets a gold frame.
    for (const item of this.timelineItems) item.destroy();
    this.timelineItems = [];
    const ids = order.filter((id) => !fainted.has(id));
    const size = 24;
    const gap = 3;
    let x = Math.round(W / 2 - (ids.length * (size + gap) - gap) / 2);
    for (const id of ids) {
      const unit = this.state.units.find((u) => u.id === id);
      if (!unit) continue;
      const isCurrent = id === current;
      const g = this.add.graphics().setDepth(30);
      g.fillStyle(isCurrent ? COLOR.goldHi : COLOR.black, 1).fillRect(x - 1, 4, size + 2, size + 2);
      g.fillStyle(unit.side === "player" ? 0x1f4a6b : 0x6b2a25, 1).fillRect(x + 1, 6, size - 2, size - 2);
      this.timelineItems.push(g);
      const key = textureKey.critter(unit.stageId);
      if (this.textures.exists(key)) {
        this.timelineItems.push(
          this.add
            .image(x + size / 2, 4 + size, key, FRAME.idleA)
            .setOrigin(0.5, 1)
            .setScale(0.5)
            .setFlipX(unit.side === "enemy")
            .setDepth(31),
        );
      } else {
        this.timelineItems.push(label(this, x + size / 2, 4 + size / 2 + 1, unit.name.charAt(0), { size: 12, bold: true, originX: 0.5, originY: 0.5, depth: 31 }));
      }
      x += size + gap;
    }

    for (const [id, view] of this.board.units) view.setCurrent(id === current);
    const active = current ? this.state.units.find((u) => u.id === current) : undefined;
    this.currentCard.show(active ?? null, "", { showBonus: true });
  }

  private buildMoveButtons(): void {
    for (const button of this.moveButtons) button.destroy();
    this.moveButtons = [];
    const unit = this.me();
    this.endTurnButton.setEnabled(Boolean(unit) && !this.busy);
    if (!unit) return;

    unit.moves.forEach((id, i) => {
      const move = getMove(id);
      const blocked = moveBlockedReason(this.state, unit, move);
      const x = 4 + i * 100;
      const y = 182;
      const button = makeButton(this, x, y, 97, 47, "", () => this.pickMoveSlot(i), {
        depth: 22,
        onHover: (over) => {
          if (!this.selected && !this.busy) this.hint.setText(over ? describeMove(move) : DEFAULT_HINT);
        },
      });
      const dim = blocked ? "#56685f" : undefined;
      const icon = textureKey.typeIcon(move.type);
      const hasIcon = this.textures.exists(icon);
      if (hasIcon) button.extras.push(this.add.image(x + 5, y + 5, icon).setOrigin(0).setDepth(24).setAlpha(blocked ? 0.4 : 1));
      button.extras.push(label(this, x + (hasIcon ? 24 : 6), y + 5, move.name, { size: 9, bold: true, depth: 24, color: dim ?? TEXT.main }));
      button.extras.push(label(this, x + 92, y + 6, String(i + 1), { originX: 1, depth: 24, color: "#56685f" }));

      const pips = this.add.graphics().setDepth(24);
      for (let m = 0; m < move.mana; m++) {
        pips.fillStyle(COLOR.black, 1).fillRect(x + 6 + m * 8, y + 22, 7, 7);
        pips.fillStyle(blocked ? 0x35505f : 0x4fb3ff, 1).fillRect(x + 7 + m * 8, y + 23, 5, 5);
      }
      button.extras.push(pips);
      const stats = move.power > 0 ? `Pow ${move.power}` : move.effects.some((e) => e.type === "heal") ? "Heal" : "Support";
      button.extras.push(label(this, x + 92, y + 21, stats, { originX: 1, depth: 24, color: dim ?? TEXT.muted }));
      const range = move.range[1] === 0 ? move.shape : `${move.shape} ${move.range[0]}–${Math.min(move.range[1], 9)}`;
      button.extras.push(label(this, x + 6, y + 34, blocked ?? range, { depth: 24, color: blocked ? TEXT.bad : TEXT.muted }));

      button.setEnabled(!blocked);
      this.moveButtons.push(button);
    });
  }

  private drawHighlights(): void {
    for (const p of this.previews) p.destroy();
    this.previews = [];
    const unit = this.me();
    if (!unit || this.busy) return this.board.highlight([]);

    if (!this.selected) {
      const reach = this.state.hasMoved ? [] : [...reachableTiles(this.state, unit).values()].map((path) => path[path.length - 1] as Pos);
      return this.board.highlight([{ tiles: reach, color: COLOR.moveRange, alpha: 0.35, outline: true }]);
    }

    const all = new Map<string, Pos>();
    for (const option of this.options) for (const tile of option.tiles) all.set(posKey(tile), tile);
    const hovered = this.hoverTile ? this.optionAt(this.hoverTile) : undefined;
    this.board.highlight([
      { tiles: [...all.values()], color: COLOR.attackRange, alpha: 0.25, outline: true },
      { tiles: hovered?.tiles ?? [], color: COLOR.attackRange, alpha: 0.55, outline: true },
    ]);

    // Preview: expected damage or healing on each unit the hovered option would hit.
    if (!hovered) return;
    const move = this.selected;
    for (const target of affectedUnits(this.state, unit, move, hovered)) {
      const feet = this.board.feet(target.pos as Pos);
      let text = "";
      let color: string = TEXT.main;
      if (move.power > 0) {
        const { amount, typeMult } = computeDamage(unit, move, target, 1);
        text = `-${amount}${typeMult > 1 ? " ▲" : typeMult < 1 ? " ▼" : ""}`;
        color = typeMult > 1 ? TEXT.good : typeMult < 1 ? TEXT.bad : TEXT.main;
      } else {
        const heal = move.effects.find((e) => e.type === "heal");
        if (heal && heal.type === "heal") text = `+${Math.min(Math.round((target.stats.hp * heal.percent) / 100), target.stats.hp - target.hp)}`;
        color = TEXT.good;
      }
      if (text) this.previews.push(label(this, feet.x, feet.y - 34, text, { size: 9, bold: true, color, originX: 0.5, originY: 1, depth: 800 }).setStroke("#050a08", 3));
    }
  }

  // ---------- event playback ----------

  private async play(events: CombatEvent[]): Promise<void> {
    this.busy = true;
    this.board.highlight([]);
    for (const p of this.previews) p.destroy();
    this.previews = [];
    for (const button of this.moveButtons) {
      button.setSelected(false);
      button.setEnabled(false);
    }
    this.endTurnButton.setEnabled(false);

    const unitOf = (id: string) => this.state.units.find((u) => u.id === id) as CombatUnit;
    for (const event of events) {
      if (this.closed) return;
      const view = "unitId" in event ? this.board.units.get(event.unitId) : undefined;
      switch (event.type) {
        case "roundStarted": {
          this.shown.round = event.round;
          this.shown.mana = event.mana;
          this.shown.order = event.order;
          this.shown.current = null;
          this.drawHud();
          const banner = label(this, W / 2, 104, `Round ${event.round}`, { size: 20, bold: true, color: TEXT.gold, originX: 0.5, originY: 0.5, depth: 900 }).setStroke("#050a08", 5);
          await tween(this, { targets: banner, alpha: { from: 1, to: 0 }, y: 96, delay: 350, duration: 300 });
          banner.destroy();
          break;
        }
        case "turnStarted":
          this.shown.current = event.unitId;
          this.drawHud();
          this.hint.setText(unitOf(event.unitId).side === "enemy" ? `${unitOf(event.unitId).name} (enemy) is acting…` : DEFAULT_HINT);
          if (unitOf(event.unitId).side === "enemy") await wait(this, 350);
          break;
        case "moved":
          for (const step of event.path) {
            const feet = this.board.feet(step);
            if (view) await tween(this, { targets: view.root, x: feet.x, y: feet.y, duration: 110 });
            view?.place(feet.x, feet.y);
          }
          break;
        case "moveUsed": {
          const user = unitOf(event.unitId);
          this.shown.mana = user.side === "player" ? event.mana : this.shown.mana;
          this.drawHud();
          if (view) this.board.floatText({ x: view.root.x, y: view.root.y - 34 }, getMove(event.moveId).name, TEXT.gold, 9);
          view?.frame(FRAME.windup);
          this.board.highlight([{ tiles: event.tiles, color: user.side === "player" ? COLOR.attackRange : COLOR.intent, alpha: 0.55, outline: true }]);
          await wait(this, 180);
          view?.frame(FRAME.strike);
          await wait(this, 180);
          view?.idle();
          this.board.highlight([]);
          break;
        }
        case "damaged": {
          view?.setHp(event.hp);
          if (view) {
            view.frame(FRAME.hurt);
            const note = event.typeMult > 1 ? "Strong!" : event.typeMult < 1 ? "Resisted" : "";
            this.board.floatText({ x: view.root.x, y: view.root.y - 30 }, `-${event.amount}`, event.typeMult > 1 ? TEXT.gold : TEXT.main, 11);
            if (note) this.board.floatText({ x: view.root.x, y: view.root.y - 42 }, note, event.typeMult > 1 ? TEXT.good : TEXT.bad, 8);
            const x = view.root.x;
            await tween(this, { targets: view.root, x: x + 3, duration: 45, yoyo: true, repeat: 2 });
            view.root.x = x;
            if (event.hp > 0) view.idle();
          }
          this.refreshCards();
          break;
        }
        case "healed":
          view?.setHp(event.hp);
          if (view) this.board.floatText({ x: view.root.x, y: view.root.y - 30 }, `+${event.amount}`, TEXT.good, 11);
          await wait(this, 250);
          break;
        case "fainted":
          this.shown.fainted.add(event.unitId);
          if (view) {
            view.frame(FRAME.faint);
            await tween(this, { targets: view.root, alpha: 0, delay: 250, duration: 300 });
            view.destroy();
            this.board.units.delete(event.unitId);
          }
          this.drawHud();
          break;
        case "turnEnded":
          await wait(this, 120);
          break;
        case "battleEnded":
          await wait(this, 300);
          break;
        default:
          break;
      }
    }
    if (this.closed) return;
    this.busy = false;
    this.refresh();
  }

  /** Keeps the info panels in step with HP changes during playback. */
  private refreshCards(): void {
    const active = this.shown.current ? this.state.units.find((u) => u.id === this.shown.current) : undefined;
    this.currentCard.show(active ?? null, "", { showBonus: true });
  }

  private showResult(result: "won" | "lost"): void {
    for (const button of this.moveButtons) button.setEnabled(false);
    this.endTurnButton.setEnabled(false);
    this.add.rectangle(0, 0, W, H, COLOR.black, 0.7).setOrigin(0).setDepth(950).setInteractive();
    // HTML text is always above the canvas, so hide what the backdrop covers.
    this.resultShown = true;
    hideTextBelow(this, 950);
    panel(this, 130, 70, 220, 122, 951);
    label(this, W / 2, 82, result === "won" ? "Victory!" : "Defeat", { size: 20, bold: true, color: result === "won" ? TEXT.gold : TEXT.bad, originX: 0.5, depth: 952 });
    label(this, W / 2, 110, "This is a practice fight. Your saved run is not changed. The map and rewards come with a later milestone.", {
      color: TEXT.muted,
      originX: 0.5,
      wrap: 196,
      depth: 952,
    }).setAlign("center");
    makeButton(this, 142, 160, 96, 22, "Fight again", () => this.fightAgain(), { gold: true, depth: 953 });
    makeButton(this, 242, 160, 96, 22, "Leave", () => session(this).leave(), { depth: 953 });
  }

  private fightAgain(): void {
    const s = session(this);
    s.rngState = this.state.rngState;
    s.combat = createEncounter(s.run, new Rng(s.rngState));
    this.scene.start("Placement");
  }
}
