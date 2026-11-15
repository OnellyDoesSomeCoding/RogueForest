import { describe, expect, it } from "vitest";
import { config, critters, getMove, moves } from "../../gameData";
import { Rng } from "../rng";
import { createRun } from "../run/newRun";
import { applyAction, currentUnit, moveBlockedReason, turnOrder } from "./combat";
import { computeDamage, typeMultiplier } from "./damage";
import { createEncounter, createUnit, enemyLevel, gridSize } from "./encounter";
import { getUnit, isOptimalTile, posKey, reachableTiles } from "./grid";
import { affectedUnits, isMoveSupported, targetOptions, validOptions } from "./targeting";
import { CombatError, type CombatEvent, type CombatState, type CombatUnit, type Pos } from "./types";

type UnitSpec = { id: string; line: string; at: Pos; level?: number; hp?: number };

/** A 5×3 battle with hand-placed units. */
function battle(players: UnitSpec[], enemies: UnitSpec[], extra: Partial<CombatState> = {}): CombatState {
  const make = (side: "player" | "enemy") => (spec: UnitSpec, slot: number): CombatUnit =>
    createUnit({ id: spec.id, side, slot, line: spec.line, level: spec.level ?? 5, hp: spec.hp, pos: spec.at });
  const state: CombatState = {
    width: 5,
    height: 3,
    obstacles: [],
    units: [...players.map(make("player")), ...enemies.map(make("enemy"))],
    phase: "placement",
    round: 0,
    mana: 3,
    maxMana: 3,
    order: [],
    turnIndex: 0,
    hasMoved: false,
    rngState: 12345,
    ...extra,
  };
  return applyAction(state, { type: "start" }).state;
}

const types = (events: CombatEvent[]) => events.map((e) => e.type);

describe("type chart", () => {
  it("applies strong, resisted and neutral matchups", () => {
    expect(typeMultiplier("Ember", ["Flora"])).toBe(1.5);
    expect(typeMultiplier("Ember", ["Dew"])).toBe(0.75);
    expect(typeMultiplier("Ember", ["Zephyr"])).toBe(1);
    expect(typeMultiplier("Neutral", ["Flora"])).toBe(1);
  });

  it("multiplies both types of a dual-type defender", () => {
    expect(typeMultiplier("Ember", ["Flora", "Iron"])).toBe(2.25);
    expect(typeMultiplier("Ember", ["Dew", "Gloom"])).toBe(0.5625);
    expect(typeMultiplier("Ember", ["Flora", "Dew"])).toBe(1.125);
  });

  it("makes Gloom and Lume strong against each other", () => {
    expect(typeMultiplier("Gloom", ["Lume"])).toBe(1.5);
    expect(typeMultiplier("Lume", ["Gloom"])).toBe(1.5);
  });
});

describe("damage", () => {
  const attacker = createUnit({ id: "a", side: "player", slot: 0, line: "emberkit", level: 5 }); // ATK 16
  const sprout = createUnit({ id: "d", side: "enemy", slot: 0, line: "sproutle", level: 5 }); // DEF 15, Flora
  const dew = createUnit({ id: "w", side: "enemy", slot: 1, line: "dewdle", level: 5 }); // DEF 10, Dew

  it("follows the formula with type and same-type bonuses", () => {
    // 45 × 16 / (15 × 4) = 12, × 1.5 (Ember vs Flora) × 1.2 (same type) = 21.6
    expect(computeDamage(attacker, getMove("E1"), sprout, 1)).toEqual({ amount: 22, typeMult: 1.5 });
    // 45 × 16 / (10 × 4) = 18, × 0.75 × 1.2 = 16.2
    expect(computeDamage(attacker, getMove("E1"), dew, 1)).toEqual({ amount: 16, typeMult: 0.75 });
  });

  it("adds 10% on an optimal tile and scales with variance", () => {
    const boosted = { ...attacker, onOptimalTile: true };
    expect(computeDamage(boosted, getMove("E1"), sprout, 1).amount).toBe(24); // 21.6 × 1.1 = 23.76
    expect(computeDamage(attacker, getMove("E1"), sprout, 0.9).amount).toBe(19); // 19.44
    expect(computeDamage(attacker, getMove("E1"), sprout, 1.1).amount).toBe(24); // 23.76
  });

  it("never deals less than 1", () => {
    const weak = { ...attacker, stats: { ...attacker.stats, atk: 0 } };
    expect(computeDamage(weak, getMove("E1"), sprout, 1).amount).toBe(1);
  });
});

describe("move data", () => {
  it("gives every critter a cheap move with no cooldown that works today", () => {
    for (const critter of critters) {
      const basics = critter.moves.map(getMove).filter((m) => m.mana <= 1 && m.cooldown === 0);
      expect(basics.length, critter.line).toBeGreaterThan(0);
      expect(basics.some(isMoveSupported), critter.line).toBe(true);
    }
  });

  it("only references known moves, with sane numbers", () => {
    expect(moves).toHaveLength(33);
    for (const critter of critters) for (const id of critter.moves) expect(() => getMove(id)).not.toThrow();
    for (const m of moves) {
      expect(m.mana).toBeGreaterThanOrEqual(0);
      expect(m.mana).toBeLessThanOrEqual(3);
      expect(m.range[0]).toBeLessThanOrEqual(m.range[1]);
    }
  });
});

describe("grid", () => {
  it("picks grid size and enemy level by floor", () => {
    expect(gridSize(1, "normal")).toEqual([5, 3]);
    expect(gridSize(25, "boss")).toEqual([8, 6]);
    expect(gridSize(50, "elite")).toEqual([9, 7]);
    expect(enemyLevel(1, "normal")).toBe(2);
    expect(enemyLevel(10, "boss")).toBe(14);
    expect(enemyLevel(20, "elite")).toBe(21);
  });

  it("defines optimal tiles, sharing the middle column on odd widths", () => {
    const cols = (kind: "front" | "back", width: number) =>
      Array.from({ length: width }, (_, x) => x).filter((x) => isOptimalTile(kind, { x, y: 1 }, width, 3));
    expect(cols("front", 5)).toEqual([1, 2, 3]);
    expect(cols("back", 5)).toEqual([0, 1, 3, 4]);
    expect(cols("front", 8)).toEqual([2, 3, 4, 5]);
    expect(cols("back", 8)).toEqual([0, 1, 6, 7]);
    expect(cols("front", 7)).toEqual([2, 3, 4]);
    expect(isOptimalTile("flank", { x: 2, y: 0 }, 5, 3)).toBe(true);
    expect(isOptimalTile("flank", { x: 2, y: 1 }, 5, 3)).toBe(false);
    expect(isOptimalTile("flank", { x: 2, y: 2 }, 5, 3)).toBe(true);
  });

  it("limits movement to MOV steps and blocks units and obstacles", () => {
    // Sproutle (Tank, MOV 2) in the corner, with a rock to the right.
    const state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 0 } }], [{ id: "e1", line: "pebbun", at: { x: 0, y: 2 } }], {
      obstacles: [{ x: 1, y: 0 }],
    });
    const reach = reachableTiles(state, getUnit(state, "p1"));
    expect([...reach.keys()].sort()).toEqual(["0,1", "1,1"]);
    expect(reach.get("1,1")).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
  });
});

describe("targeting", () => {
  it("stops a line at the first unit, and at obstacles", () => {
    const state = battle(
      [{ id: "p1", line: "emberkit", at: { x: 0, y: 1 } }],
      [
        { id: "e1", line: "pebbun", at: { x: 2, y: 1 } },
        { id: "e2", line: "pebbun", at: { x: 3, y: 1 } },
      ],
      { obstacles: [{ x: 0, y: 0 }] },
    );
    const unit = getUnit(state, "p1");
    const options = targetOptions(state, unit, getMove("E2")); // Flame Line, range 1–3
    const right = options.find((o) => o.target.x === 1 && o.target.y === 1);
    expect(right?.tiles).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(options.some((o) => o.target.y === 0)).toBe(false); // rock above
    expect(affectedUnits(state, unit, getMove("E2"), right!).map((u) => u.id)).toEqual(["e1"]);
  });

  it("lets piercing lines and rows pass through units", () => {
    const state = battle(
      [{ id: "p1", line: "gustling", at: { x: 0, y: 1 } }],
      [
        { id: "e1", line: "pebbun", at: { x: 2, y: 1 } },
        { id: "e2", line: "pebbun", at: { x: 4, y: 1 } },
      ],
    );
    const unit = getUnit(state, "p1");
    const razor = validOptions(state, unit, getMove("Z4"))[0]!; // Razor Wind, line 1–4, pierces
    expect(affectedUnits(state, unit, getMove("Z4"), razor).map((u) => u.id)).toEqual(["e1", "e2"]);
    const row = validOptions(state, unit, getMove("C4"))[0]!; // Landslide, row
    expect(row.tiles).toHaveLength(4);
  });

  it("respects min and max range for single-target moves", () => {
    const state = battle(
      [{ id: "p1", line: "pebbun", at: { x: 0, y: 1 } }],
      [
        { id: "e1", line: "gustling", at: { x: 1, y: 1 } },
        { id: "e2", line: "gustling", at: { x: 4, y: 1 } },
      ],
    );
    const unit = getUnit(state, "p1");
    // Pebble Toss has range 2–4: the adjacent enemy is too close.
    expect(validOptions(state, unit, getMove("C1")).map((o) => posKey(o.target))).toEqual(["4,1"]);
  });

  it("only offers options that affect someone, and heals pick allies", () => {
    const state = battle(
      [
        { id: "p1", line: "dewdle", at: { x: 0, y: 0 } },
        { id: "p2", line: "emberkit", at: { x: 1, y: 0 } },
      ],
      [{ id: "e1", line: "pebbun", at: { x: 4, y: 2 } }],
    );
    const unit = getUnit(state, "p1");
    const rain = getMove("D3"); // Mending Rain: plus, allies
    const onSelf = validOptions(state, unit, rain).find((o) => posKey(o.target) === "0,0")!;
    expect(affectedUnits(state, unit, rain, onSelf).map((u) => u.id).sort()).toEqual(["p1", "p2"]);
    expect(validOptions(state, unit, getMove("D1"))).toEqual([]); // enemy is 6 tiles away
  });

  it("covers the 8 surrounding tiles with 'around'", () => {
    const state = battle([{ id: "p1", line: "pebbun", at: { x: 1, y: 1 } }], [{ id: "e1", line: "gustling", at: { x: 2, y: 2 } }]);
    const [option] = targetOptions(state, getUnit(state, "p1"), getMove("C2"));
    expect(option?.tiles).toHaveLength(8);
    expect(affectedUnits(state, getUnit(state, "p1"), getMove("C2"), option!).map((u) => u.id)).toEqual(["e1"]);
  });
});

describe("turn order", () => {
  it("sorts by SPD, then player first, then slot", () => {
    const state = battle(
      [
        { id: "p1", line: "sproutle", at: { x: 0, y: 0 } }, // SPD 4
        { id: "p2", line: "emberkit", at: { x: 0, y: 1 } }, // SPD 7
        { id: "p3", line: "dewdle", at: { x: 0, y: 2 } }, // SPD 6
      ],
      [
        { id: "e1", line: "glimmet", at: { x: 4, y: 0 } }, // SPD 6
        { id: "e2", line: "gustling", at: { x: 4, y: 1 } }, // SPD 9
        { id: "e3", line: "claypaw", at: { x: 4, y: 2 } }, // SPD 6
      ],
    );
    expect(turnOrder(state)).toEqual(["e2", "p2", "p3", "e1", "e3", "p1"]);
  });
});

describe("battle flow", () => {
  const duel = () =>
    battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 4, y: 1 }, level: 2 }]);

  it("needs every critter placed before starting", () => {
    const state: CombatState = { ...duel(), phase: "placement" };
    state.units[0]!.pos = null;
    expect(() => applyAction(state, { type: "start" })).toThrow(CombatError);
    const placed = applyAction(state, { type: "place", unitId: "p1", pos: { x: 1, y: 1 } }).state;
    expect(() => applyAction(placed, { type: "place", unitId: "p1", pos: { x: 4, y: 1 } })).toThrow("taken");
    expect(applyAction(placed, { type: "start" }).state.phase).toBe("battle");
  });

  it("starts round 1 with full mana and the fastest unit up", () => {
    const state = duel();
    expect(state.round).toBe(1);
    expect(state.mana).toBe(3);
    expect(currentUnit(state)?.id).toBe("p1"); // SPD 7 vs 4
  });

  it("does not change the input state", () => {
    const state = duel();
    const snapshot = structuredClone(state);
    applyAction(state, { type: "move", to: { x: 2, y: 1 } });
    expect(state).toEqual(snapshot);
  });

  it("allows one move per turn, within reach", () => {
    let state = duel();
    expect(() => applyAction(state, { type: "move", to: { x: 4, y: 0 } })).toThrow("out of reach");
    const moved = applyAction(state, { type: "move", to: { x: 2, y: 1 } });
    expect(moved.events).toEqual([{ type: "moved", unitId: "p1", path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }]);
    state = moved.state;
    expect(() => applyAction(state, { type: "move", to: { x: 1, y: 1 } })).toThrow("already moved");
  });

  it("moves, then acts: using a move spends mana and ends the turn", () => {
    let state = applyAction(duel(), { type: "move", to: { x: 2, y: 1 } }).state;
    const result = applyAction(state, { type: "useMove", moveId: "E1", target: { x: 4, y: 1 } });
    state = result.state;
    expect(types(result.events).slice(0, 3)).toEqual(["moveUsed", "damaged", "turnEnded"]);
    expect(result.events[0]).toMatchObject({ mana: 2 });
    // Sproutle then takes its turn, and round 2 starts with Emberkit up again.
    expect(types(result.events)).toContain("roundStarted");
    expect(state.round).toBe(2);
    expect(state.mana).toBe(3);
    expect(currentUnit(state)?.id).toBe("p1");
    expect(getUnit(state, "e1").hp).toBeLessThan(getUnit(state, "e1").stats.hp);
  });

  it("rejects moves without mana, out of range, or on cooldown", () => {
    const state = duel();
    expect(() => applyAction(state, { type: "useMove", moveId: "E1", target: { x: 4, y: 1 } })).toThrow("No target in range");
    expect(() => applyAction({ ...state, mana: 0 }, { type: "useMove", moveId: "E1", target: { x: 4, y: 1 } })).toThrow("Not enough mana");
    expect(() => applyAction(state, { type: "useMove", moveId: "D1", target: { x: 4, y: 1 } })).toThrow("does not know");
    expect(moveBlockedReason(state, getUnit(state, "p1"), getMove("E4"))).toBe("Not available yet");
  });

  it("counts cooldowns in own turns", () => {
    // Flame Line has cooldown 1: usable on turn 1, not on turn 2, usable again on turn 3.
    let state = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 0 } }], [{ id: "e1", line: "sproutle", at: { x: 2, y: 0 }, level: 2 }]);
    const flame = getMove("E2");
    const self = () => getUnit(state, "p1");
    state = applyAction(state, { type: "useMove", moveId: "E2", target: { x: 1, y: 0 } }).state;
    expect(currentUnit(state)?.id).toBe("p1"); // round 2
    expect(self().cooldowns.E2).toBe(1);
    expect(moveBlockedReason(state, self(), flame)).toBe("Ready in 1 turn");
    expect(() => applyAction(state, { type: "useMove", moveId: "E2", target: { x: 1, y: 0 } })).toThrow("Ready in 1 turn");
    expect(self().cooldowns.E1 ?? 0).toBe(0); // cooldown 0 moves are ready every turn
    state = applyAction(state, { type: "endTurn" }).state;
    expect(currentUnit(state)?.id).toBe("p1"); // round 3
    expect(self().cooldowns.E2).toBe(0);
  });

  it("shares mana across the team within a round", () => {
    let state = battle(
      [
        { id: "p1", line: "emberkit", at: { x: 1, y: 0 } },
        { id: "p2", line: "dewdle", at: { x: 1, y: 2 } },
      ],
      [{ id: "e1", line: "shellcrag", at: { x: 3, y: 1 }, level: 12 }],
    );
    state = applyAction(state, { type: "useMove", moveId: "E3", target: { x: 3, y: 0 } }).state; // Fireburst, 3 mana
    expect(currentUnit(state)?.id).toBe("p2");
    expect(state.mana).toBe(0);
    expect(moveBlockedReason(state, getUnit(state, "p2"), getMove("D1"))).toBe("Not enough mana");
  });

  it("heals allies and never above max HP", () => {
    let state = battle(
      [
        { id: "p1", line: "dewdle", at: { x: 0, y: 0 } },
        { id: "p2", line: "sproutle", at: { x: 1, y: 0 }, hp: 10 },
      ],
      [{ id: "e1", line: "pebbun", at: { x: 4, y: 2 }, level: 1 }],
    );
    const result = applyAction(state, { type: "useMove", moveId: "D3", target: { x: 1, y: 0 } });
    state = result.state;
    // 30% of 74 = 22. Dewdle is at full HP, so only Sproutle heals.
    expect(result.events.filter((e) => e.type === "healed")).toEqual([{ type: "healed", unitId: "p2", amount: 22, hp: 32 }]);
  });

  it("wins when the last enemy faints, and removes it from the grid", () => {
    const state = battle([{ id: "p1", line: "emberkit", at: { x: 1, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 2, y: 1 }, hp: 1 }]);
    const result = applyAction(state, { type: "useMove", moveId: "E1", target: { x: 2, y: 1 } });
    expect(types(result.events)).toEqual(["moveUsed", "damaged", "fainted", "battleEnded", "turnEnded"]);
    expect(result.state.phase).toBe("won");
    expect(getUnit(result.state, "e1")).toMatchObject({ hp: 0, fainted: true, pos: null });
    expect(() => applyAction(result.state, { type: "endTurn" })).toThrow(CombatError);
  });

  it("loses when every player critter has fainted", () => {
    const state = battle([{ id: "p1", line: "sproutle", at: { x: 1, y: 1 }, hp: 1 }], [{ id: "e1", line: "emberkit", at: { x: 2, y: 1 } }]);
    // Emberkit is faster, so it acts first and finishes the fight during "start".
    expect(state.phase).toBe("lost");
    expect(getUnit(state, "p1").fainted).toBe(true);
  });

  it("lets enemies walk toward the player when nothing is in range", () => {
    // A 9-wide grid, so Rivetle (MOV 2, longest range 4) cannot reach anything yet.
    const state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 1 } }], [{ id: "e1", line: "rivetle", at: { x: 8, y: 1 }, level: 2 }], { width: 9 });
    // Both have SPD 4, so the player goes first. Skip, then Rivetle closes in.
    const result = applyAction(state, { type: "endTurn" });
    expect(result.events.find((e) => e.type === "moved")).toEqual({ type: "moved", unitId: "e1", path: [{ x: 7, y: 1 }, { x: 6, y: 1 }] });
    expect(result.events.some((e) => e.type === "damaged")).toBe(false);
  });

  it("lets enemies move into range and attack", () => {
    const state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 1 } }], [{ id: "e1", line: "rivetle", at: { x: 4, y: 1 }, level: 2 }]);
    const result = applyAction(state, { type: "endTurn" });
    const hit = result.events.find((e) => e.type === "damaged");
    expect(hit).toMatchObject({ unitId: "p1", sourceId: "e1" });
    expect(getUnit(result.state, "p1").hp).toBeLessThan(74);
  });

  it("gives the optimal-tile bonus from where the turn started", () => {
    // Emberkit likes the front columns (1–3 on a 5-wide grid).
    const back = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 4, y: 1 } }]);
    const front = battle([{ id: "p1", line: "emberkit", at: { x: 1, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 4, y: 1 } }]);
    expect(getUnit(back, "p1").onOptimalTile).toBe(false);
    expect(getUnit(front, "p1").onOptimalTile).toBe(true);
  });

  it("is deterministic: same seed and actions give the same fight", () => {
    const play = () => {
      const run = createRun("replay", { active: ["emberkit", "dewdle", "sproutle"], bench: [] });
      let state = createEncounter(run, new Rng(run.rngState));
      const spots = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
      state.units.filter((u) => u.side === "player").forEach((u, i) => (state = applyAction(state, { type: "place", unitId: u.id, pos: spots[i]! }).state));
      state = applyAction(state, { type: "start" }).state;
      const log: CombatEvent[] = [];
      for (let i = 0; i < 40 && state.phase === "battle"; i++) {
        const unit = currentUnit(state)!;
        const usable = unit.moves.map(getMove).find((m) => moveBlockedReason(state, unit, m) === null);
        const action = usable
          ? ({ type: "useMove", moveId: usable.id, target: validOptions(state, unit, usable)[0]!.target } as const)
          : ({ type: "endTurn" } as const);
        const result = applyAction(state, action);
        state = result.state;
        log.push(...result.events);
      }
      return { state, log };
    };
    const a = play();
    const b = play();
    expect(a.log.length).toBeGreaterThan(10);
    expect(a).toEqual(b);
  });
});

describe("encounter", () => {
  it("builds a 5×3 meadow fight with placed enemies and unplaced player critters", () => {
    const run = createRun("enc", { active: ["emberkit", "dewdle"], bench: ["sproutle"] });
    const state = createEncounter(run, new Rng(run.rngState));
    expect([state.width, state.height]).toEqual([5, 3]);
    expect(state.phase).toBe("placement");
    const mine = state.units.filter((u) => u.side === "player");
    const foes = state.units.filter((u) => u.side === "enemy");
    expect(mine.map((u) => u.id)).toEqual(["p:c1", "p:c2"]); // bench critters do not fight
    expect(mine.every((u) => u.pos === null)).toBe(true);
    expect(foes).toHaveLength(2);
    const pool = ["gustling", "pollenbee", "sproutle", "lumoth", "pebbun"];
    for (const foe of foes) {
      expect(pool).toContain(foe.line);
      expect(foe.level).toBe(2);
      expect(foe.pos!.x).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(foes.map((f) => posKey(f.pos!))).size).toBe(2);
    expect(state.maxMana).toBe(config.combat.maxMana);
  });

  it("keeps fainted critters out of the fight", () => {
    const run = createRun("faint", { active: ["emberkit", "dewdle"], bench: [] });
    run.team.active[1]!.hp = 0;
    const state = createEncounter(run, new Rng(1));
    const fainted = getUnit(state, "p:c2");
    expect(fainted.fainted).toBe(true);
    expect(() => applyAction(state, { type: "place", unitId: "p:c2", pos: { x: 0, y: 0 } })).toThrow(CombatError);
    const placed = applyAction(state, { type: "place", unitId: "p:c1", pos: { x: 0, y: 0 } }).state;
    expect(applyAction(placed, { type: "start" }).state.phase).toBe("battle");
  });
});
