// M3: statuses, push/pull, rocks and enemy intents.
import { describe, expect, it } from "vitest";
import { getMove } from "../../gameData";
import type { StatusId } from "../../types";
import { applyAction, currentUnit, turnOrder } from "./combat";
import { computeDamage } from "./damage";
import { createUnit } from "./encounter";
import { getUnit, posKey, reachableTiles, samePos } from "./grid";
import { applyStatus, effectiveMov, effectiveSpd } from "./statuses";
import { validOptions } from "./targeting";
import { CombatError, type CombatEvent, type CombatState, type CombatUnit, type Pos } from "./types";

type Spec = { id: string; line: string; at: Pos; level?: number; hp?: number; moves?: string[]; statuses?: StatusId[] };

/** A battle with hand-placed units, already started. `moves` overrides a unit's move list. */
function battle(players: Spec[], enemies: Spec[], extra: Partial<CombatState> = {}): CombatState {
  const make = (side: "player" | "enemy") => (spec: Spec, slot: number): CombatUnit => {
    const unit = createUnit({ id: spec.id, side, slot, line: spec.line, level: spec.level ?? 5, hp: spec.hp, pos: spec.at });
    if (spec.moves) unit.moves = spec.moves;
    unit.statuses = (spec.statuses ?? []).map((id) => ({ id, turns: 2, armed: false }));
    return unit;
  };
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
    intents: [],
    rngState: 777,
    ...extra,
  };
  return applyAction(state, { type: "start" }).state;
}

/** An enemy that only knows Iron Claw (range 1), far away and weak: it just walks. */
const idleFoe = (at: Pos = { x: 4, y: 2 }): Spec => ({ id: "e1", line: "rivetle", at, level: 1, moves: ["I1"] });

const ofType = <T extends CombatEvent["type"]>(events: CombatEvent[], type: T) => events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);
const statusIds = (unit: CombatUnit) => unit.statuses.map((s) => s.id);

describe("statuses", () => {
  it("Guard Up lasts through the user's next turn", () => {
    let state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 0 } }], [idleFoe()]);
    expect(currentUnit(state)?.id).toBe("p1");
    state = applyAction(state, { type: "useMove", moveId: "N2", target: { x: 0, y: 0 } }).state;
    // Round 2: Guard is still on (it was applied during p1's own turn, so it did not tick).
    expect(state.round).toBe(2);
    expect(statusIds(getUnit(state, "p1"))).toEqual(["Guard"]);
    const result = applyAction(state, { type: "endTurn" });
    expect(ofType(result.events, "statusRemoved")).toContainEqual({ type: "statusRemoved", unitId: "p1", status: "Guard", reason: "expired" });
    expect(statusIds(getUnit(result.state, "p1"))).toEqual([]);
  });

  it("Burn takes 8% max HP at the start of each of the holder's turns, for 2 turns", () => {
    let state = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 0 } }], [idleFoe()]);
    getUnit(state, "p1").statuses.push({ id: "Burn", turns: 2, armed: false }); // as if an enemy burned it before its turn
    const burns: CombatEvent[] = [];
    for (let i = 0; i < 4 && state.phase === "battle"; i++) {
      const result = applyAction(state, { type: "endTurn" });
      burns.push(...ofType(result.events, "damaged").filter((e) => e.cause === "Burn"));
      state = result.state;
    }
    // Emberkit has 50 max HP: 8% = 4. The burn was added mid-turn, so it ticks on the next two turns.
    expect(burns).toHaveLength(2);
    expect(burns.every((e) => e.type === "damaged" && e.amount === 4)).toBe(true);
  });

  it("Regen heals 8% max HP at the start of the holder's turn", () => {
    const state = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 0 }, hp: 20 }], [idleFoe()]);
    getUnit(state, "p1").statuses.push({ id: "Regen", turns: 3, armed: false });
    const result = applyAction(state, { type: "endTurn" });
    expect(ofType(result.events, "healed")).toContainEqual({ type: "healed", unitId: "p1", amount: 4, hp: 24, cause: "Regen" });
  });

  it("Stun cancels the enemy's plan, skips its turn, then wears off", () => {
    let state = battle(
      [{ id: "p1", line: "rivetle", at: { x: 1, y: 1 } }],
      // Level 15: still a Pebbun (SPD 4, it evolves at 20), so Rivetle acts first on the SPD tie.
      [{ id: "e1", line: "pebbun", at: { x: 3, y: 1 }, level: 15 }],
    );
    expect(state.intents.map((i) => i.unitId)).toEqual(["e1"]);
    const result = applyAction(state, { type: "useMove", moveId: "I4", target: { x: 3, y: 1 } }); // Anvil Drop
    state = result.state;
    expect(result.events).toContainEqual({ type: "intentCancelled", unitId: "e1" });
    expect(result.events).toContainEqual({ type: "turnSkipped", unitId: "e1", reason: "Stun" });
    expect(ofType(result.events, "moveUsed").filter((e) => e.unitId === "e1")).toHaveLength(0);
    // Round 2: the stun is gone and the enemy has a plan again.
    expect(state.round).toBe(2);
    expect(statusIds(getUnit(state, "e1"))).not.toContain("Stun");
    expect(state.intents.map((i) => i.unitId)).toEqual(["e1"]);
  });

  it("a stunned enemy declares no plan at round start", () => {
    // Gustling (SPD 9) acts before Sproutle, then gets stunned before round 2 starts.
    let state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 0 } }], [{ id: "e1", line: "gustling", at: { x: 4, y: 2 }, level: 1, moves: ["Z1"] }]);
    expect(currentUnit(state)?.id).toBe("p1");
    getUnit(state, "e1").statuses.push({ id: "Stun", turns: 1, armed: false });
    const result = applyAction(state, { type: "endTurn" });
    state = result.state;
    const declared = ofType(result.events, "intentsDeclared").at(-1);
    expect(declared?.intents).toEqual([]);
    expect(result.events).toContainEqual({ type: "turnSkipped", unitId: "e1", reason: "Stun" });
  });

  it("Root stops movement", () => {
    const state = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 1 }, statuses: ["Root"] }], [idleFoe()]);
    expect(reachableTiles(state, getUnit(state, "p1")).size).toBe(0);
    expect(() => applyAction(state, { type: "move", to: { x: 1, y: 1 } })).toThrow("rooted");
  });

  it("Slow lowers MOV right away and SPD from the next round; Haste raises them", () => {
    let state = battle(
      [{ id: "p1", line: "emberkit", at: { x: 0, y: 0 } }], // SPD 7, MOV 3
      [{ id: "e1", line: "glimmet", at: { x: 4, y: 2 }, level: 1, moves: ["L1"] }], // SPD 6
    );
    expect(state.order).toEqual(["p1", "e1"]);
    const p1 = getUnit(state, "p1");
    p1.statuses.push({ id: "Slow", turns: 2, armed: false });
    expect(effectiveMov(p1)).toBe(2);
    expect(effectiveSpd(p1)).toBe(5);
    expect(state.order).toEqual(["p1", "e1"]); // this round's order does not change
    state = applyAction(state, { type: "endTurn" }).state;
    expect(state.order).toEqual(["e1", "p1"]);

    const fast = { ...getUnit(state, "p1"), statuses: [{ id: "Haste" as const, turns: 2, armed: false }] };
    expect(effectiveMov(fast)).toBe(4);
    expect(effectiveSpd(fast)).toBe(9);
  });

  it("Weak, Empower and Guard change damage; Spike Shot ignores Guard", () => {
    const attacker = createUnit({ id: "a", side: "player", slot: 0, line: "rivetle", level: 5 });
    const defender = createUnit({ id: "d", side: "enemy", slot: 0, line: "pebbun", level: 5 });
    const claw = getMove("I1");
    const spike = getMove("I3");
    const base = computeDamage(attacker, claw, defender, 1).amount;
    const withStatus = (u: CombatUnit, id: StatusId) => ({ ...u, statuses: [{ id, turns: 1, armed: false }] });
    // The formula rounds once at the end, so compare within 1 point of the scaled base.
    const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    near(computeDamage(withStatus(attacker, "Weak"), claw, defender, 1).amount, base * 0.75);
    near(computeDamage(withStatus(attacker, "Empower"), claw, defender, 1).amount, base * 1.25);
    near(computeDamage(attacker, claw, withStatus(defender, "Guard"), 1).amount, base * 0.6);
    expect(computeDamage(withStatus(attacker, "Weak"), claw, defender, 1).amount).toBeLessThan(base);
    expect(computeDamage(withStatus(attacker, "Empower"), claw, defender, 1).amount).toBeGreaterThan(base);
    const spikeBase = computeDamage(attacker, spike, defender, 1).amount;
    expect(computeDamage(attacker, spike, withStatus(defender, "Guard"), 1).amount).toBe(spikeBase);
  });

  it("Evade cancels the next hostile move and is used up", () => {
    const state = battle([{ id: "p1", line: "emberkit", at: { x: 1, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 2, y: 1 }, statuses: ["Evade"] }]);
    const result = applyAction(state, { type: "useMove", moveId: "E2", target: { x: 2, y: 1 } }); // Flame Line: damage + Burn
    expect(result.events).toContainEqual({ type: "evaded", unitId: "e1", sourceId: "p1" });
    expect(ofType(result.events, "damaged").filter((e) => e.unitId === "e1" && e.sourceId === "p1")).toHaveLength(0);
    expect(statusIds(getUnit(result.state, "e1"))).not.toContain("Burn");
    expect(statusIds(getUnit(result.state, "e1"))).not.toContain("Evade");
  });

  it("reapplying a status refreshes it instead of stacking", () => {
    const state = battle([{ id: "p1", line: "emberkit", at: { x: 0, y: 0 } }], [idleFoe()]);
    const unit = getUnit(state, "p1");
    applyStatus(state, unit, "Weak", []);
    unit.statuses[0]!.turns = 1;
    applyStatus(state, unit, "Weak", []);
    expect(unit.statuses).toEqual([{ id: "Weak", turns: 2, armed: false }]);
  });

  it("Radiance heals and removes only bad statuses", () => {
    const state = battle(
      [
        { id: "p1", line: "glimmet", at: { x: 0, y: 0 } },
        { id: "p2", line: "sproutle", at: { x: 1, y: 0 }, hp: 30, statuses: ["Burn", "Weak", "Guard"] },
      ],
      [idleFoe()],
    );
    const result = applyAction(state, { type: "useMove", moveId: "L3", target: { x: 1, y: 0 } });
    expect(statusIds(getUnit(result.state, "p2"))).toEqual(["Guard"]);
    expect(ofType(result.events, "healed")[0]).toMatchObject({ unitId: "p2", amount: 26 }); // 35% of 74
  });
});

describe("push and pull", () => {
  const gust = (foes: Spec[], from: Pos = { x: 0, y: 1 }) => battle([{ id: "p1", line: "gustling", at: from }], foes);

  it("Gust pushes the target 1 tile away", () => {
    const result = applyAction(gust([{ id: "e1", line: "pebbun", at: { x: 2, y: 1 } }]), { type: "useMove", moveId: "Z1", target: { x: 2, y: 1 } });
    expect(result.events).toContainEqual({ type: "forcedMove", unitId: "e1", path: [{ x: 3, y: 1 }], kind: "push" });
  });

  it("a push into the grid edge stops and deals 5% max HP", () => {
    // One free tile before the edge: it moves 1 and does not bump.
    const state = gust([{ id: "e1", line: "pebbun", at: { x: 3, y: 1 } }], { x: 1, y: 1 });
    const result = applyAction(state, { type: "useMove", moveId: "Z1", target: { x: 3, y: 1 } });
    const moved = ofType(result.events, "forcedMove")[0];
    expect(moved?.path).toEqual([{ x: 4, y: 1 }]);
    expect(ofType(result.events, "damaged").some((e) => e.cause === "collision")).toBe(false);
    // Already at the edge: it cannot move and bumps.
    const again = battle([{ id: "p1", line: "gustling", at: { x: 2, y: 1 } }], [{ id: "e1", line: "pebbun", at: { x: 4, y: 1 } }]);
    const bump = applyAction(again, { type: "useMove", moveId: "Z1", target: { x: 4, y: 1 } });
    expect(ofType(bump.events, "forcedMove")).toHaveLength(0);
    expect(ofType(bump.events, "damaged").find((e) => e.cause === "collision")).toMatchObject({ unitId: "e1", amount: 4 }); // 5% of 74
  });

  it("a push blocked by another unit stops and bumps", () => {
    const state = gust([
      { id: "e1", line: "pebbun", at: { x: 2, y: 1 } },
      { id: "e2", line: "pebbun", at: { x: 3, y: 1 } },
    ]);
    const result = applyAction(state, { type: "useMove", moveId: "Z1", target: { x: 2, y: 1 } });
    expect(ofType(result.events, "forcedMove")).toHaveLength(0);
    expect(ofType(result.events, "damaged").some((e) => e.unitId === "e1" && e.cause === "collision")).toBe(true);
  });

  it("Tidal Push pushes 2 tiles along its line", () => {
    const state = battle([{ id: "p1", line: "dewdle", at: { x: 0, y: 1 } }], [{ id: "e1", line: "sproutle", at: { x: 1, y: 1 } }]);
    const result = applyAction(state, { type: "useMove", moveId: "D2", target: { x: 1, y: 1 } });
    expect(ofType(result.events, "forcedMove")[0]?.path).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  });

  it("a diagonal target moves along the longer axis; ties go horizontal", () => {
    const longer = applyAction(gust([{ id: "e1", line: "pebbun", at: { x: 2, y: 1 } }], { x: 0, y: 0 }), { type: "useMove", moveId: "Z1", target: { x: 2, y: 1 } });
    expect(ofType(longer.events, "forcedMove")[0]?.path).toEqual([{ x: 3, y: 1 }]);
    const tie = applyAction(gust([{ id: "e1", line: "pebbun", at: { x: 1, y: 1 } }], { x: 0, y: 0 }), { type: "useMove", moveId: "Z1", target: { x: 1, y: 1 } });
    expect(ofType(tie.events, "forcedMove")[0]?.path).toEqual([{ x: 2, y: 1 }]);
  });

  it("Vine Lash pulls toward the user, with no bump when it ends next to the user", () => {
    const state = battle([{ id: "p1", line: "sproutle", at: { x: 0, y: 1 } }], [{ id: "e1", line: "pebbun", at: { x: 2, y: 1 } }]);
    const result = applyAction(state, { type: "useMove", moveId: "F1", target: { x: 2, y: 1 } });
    expect(result.events).toContainEqual({ type: "forcedMove", unitId: "e1", path: [{ x: 1, y: 1 }], kind: "pull" });
    expect(ofType(result.events, "damaged").some((e) => e.cause === "collision")).toBe(false);
  });

  it("Cyclone pulls everything in its area toward the center", () => {
    const state = battle(
      [{ id: "p1", line: "gustling", at: { x: 0, y: 1 } }],
      [
        { id: "e1", line: "pebbun", at: { x: 4, y: 0 } },
        { id: "e2", line: "pebbun", at: { x: 4, y: 2 } },
      ],
    );
    const result = applyAction(state, { type: "useMove", moveId: "Z3", target: { x: 3, y: 1 } });
    const moves = ofType(result.events, "forcedMove").map((e) => [e.unitId, e.path.at(-1)]);
    expect(moves).toContainEqual(["e1", { x: 3, y: 0 }]);
    expect(moves).toContainEqual(["e2", { x: 3, y: 2 }]);
  });
});

describe("rocks", () => {
  it("Earth Wall puts a rock on an empty tile; it blocks and crumbles after 2 rounds", () => {
    let state = battle([{ id: "p1", line: "pebbun", at: { x: 0, y: 1 } }], [idleFoe({ x: 4, y: 0 })]);
    const wall = getMove("C3");
    const aims = validOptions(state, getUnit(state, "p1"), wall).map((o) => posKey(o.target));
    expect(aims).toContain("1,1");
    expect(aims).not.toContain("4,0"); // occupied
    let result = applyAction(state, { type: "useMove", moveId: "C3", target: { x: 1, y: 1 } });
    state = result.state;
    expect(result.events).toContainEqual({ type: "obstaclePlaced", pos: { x: 1, y: 1 }, rounds: 2 });
    // Round 2 started inside that action: one round left.
    expect(state.obstacles).toEqual([{ x: 1, y: 1, rounds: 1 }]);
    expect(reachableTiles(state, getUnit(state, "p1")).has("1,1")).toBe(false);
    result = applyAction(state, { type: "endTurn" });
    expect(result.events).toContainEqual({ type: "obstacleRemoved", pos: { x: 1, y: 1 } });
    expect(result.state.obstacles).toEqual([]);
  });
});

describe("enemy intents", () => {
  it("every enemy declares a plan at round start, never two on the same tile", () => {
    const state = battle(
      [{ id: "p1", line: "emberkit", at: { x: 0, y: 1 } }],
      [
        { id: "e1", line: "pebbun", at: { x: 4, y: 0 } },
        { id: "e2", line: "pebbun", at: { x: 4, y: 1 } },
        { id: "e3", line: "pebbun", at: { x: 4, y: 2 } },
      ],
    );
    expect(state.intents.map((i) => i.unitId).sort()).toEqual(["e1", "e2", "e3"]);
    const dests = state.intents.map((i) => posKey(i.dest));
    expect(new Set(dests).size).toBe(3);
  });

  /** Emberkit (SPD 7) acts before Pebbun (SPD 4), whose Pebble Toss can reach it. */
  const duel = () => battle([{ id: "p1", line: "emberkit", at: { x: 1, y: 1 } }], [{ id: "e1", line: "pebbun", at: { x: 4, y: 1 }, moves: ["C1"] }]);

  it("staying on a red tile gets you hit", () => {
    const state = duel();
    const intent = state.intents[0]!;
    expect(intent.hostile).toBe(true);
    expect(intent.tiles.some((t) => samePos(t, { x: 1, y: 1 }))).toBe(true);
    const result = applyAction(state, { type: "endTurn" });
    expect(ofType(result.events, "damaged").some((e) => e.unitId === "p1" && e.sourceId === "e1")).toBe(true);
  });

  it("stepping off the red tiles dodges the attack", () => {
    let state = duel();
    const red = new Set(state.intents[0]!.tiles.map(posKey));
    const safe = [...reachableTiles(state, getUnit(state, "p1")).values()].map((p) => p.at(-1)!).find((p) => !red.has(posKey(p)))!;
    state = applyAction(state, { type: "move", to: safe }).state;
    const result = applyAction(state, { type: "endTurn" });
    // The enemy still uses its move on the declared tiles, and hits nobody.
    expect(ofType(result.events, "moveUsed").some((e) => e.unitId === "e1")).toBe(true);
    expect(ofType(result.events, "damaged").some((e) => e.unitId === "p1")).toBe(false);
  });

  it("an enemy pushed out of range of its declared tiles fizzles", () => {
    let state = battle([{ id: "p1", line: "gustling", at: { x: 1, y: 1 } }], [{ id: "e1", line: "rivetle", at: { x: 2, y: 1 }, level: 20, statuses: ["Root"] }]);
    // Replace the AI's plan with a known one: Iron Claw (range 1) on Gustling's tile.
    state.intents = [{ unitId: "e1", dest: { x: 2, y: 1 }, moveId: "I1", target: { x: 1, y: 1 }, tiles: [{ x: 1, y: 1 }], hostile: true }];
    const result = applyAction(state, { type: "useMove", moveId: "Z1", target: { x: 2, y: 1 } }); // push it to (3,1); rooted, it cannot walk back
    expect(result.events).toContainEqual({ type: "attackFizzled", unitId: "e1", moveId: "I1" });
    state = result.state;
    expect(getUnit(state, "p1").hp).toBe(getUnit(state, "p1").stats.hp);
  });

  it("an enemy walks back to its planned tile if it can, then attacks", () => {
    let state = battle([{ id: "p1", line: "gustling", at: { x: 1, y: 1 } }], [{ id: "e1", line: "rivetle", at: { x: 2, y: 1 }, level: 20 }]);
    state.intents = [{ unitId: "e1", dest: { x: 2, y: 1 }, moveId: "I1", target: { x: 1, y: 1 }, tiles: [{ x: 1, y: 1 }], hostile: true }];
    const result = applyAction(state, { type: "useMove", moveId: "Z1", target: { x: 2, y: 1 } });
    expect(result.events).toContainEqual({ type: "moved", unitId: "e1", path: [{ x: 2, y: 1 }] });
    expect(ofType(result.events, "damaged").some((e) => e.unitId === "p1" && e.sourceId === "e1")).toBe(true);
  });

  it("support enemies heal or guard a badly hurt ally", () => {
    const state = battle(
      [{ id: "p1", line: "emberkit", at: { x: 0, y: 0 } }],
      [
        { id: "e1", line: "dewdle", at: { x: 4, y: 1 } },
        { id: "e2", line: "pebbun", at: { x: 4, y: 2 }, hp: 20 },
      ],
    );
    // Dewdle (SPD 6) acts after Emberkit (SPD 7): its plan is still visible.
    const plan = state.intents.find((i) => i.unitId === "e1")!;
    expect(["D3", "D4"]).toContain(plan.moveId);
    expect(plan.hostile).toBe(false);
  });

  it("rejects actions on an enemy's turn and keeps the input state unchanged", () => {
    const state = duel();
    const snapshot = structuredClone(state);
    applyAction(state, { type: "endTurn" });
    expect(state).toEqual(snapshot);
    expect(() => applyAction({ ...state, phase: "won" }, { type: "endTurn" })).toThrow(CombatError);
    expect(turnOrder(state)).toEqual(["p1", "e1"]);
  });
});
