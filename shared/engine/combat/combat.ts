// The combat reducer: applyAction(state, action) -> { state, events } (TECH_DESIGN §7).
// Pure. The input state is never changed. All randomness comes from state.rngState.
import { config, getMove } from "../../gameData";
import type { Move } from "../../types";
import { Rng } from "../rng";
import { computeDamage } from "./damage";
import { planEnemyTurn } from "./enemy";
import { getUnit, inBounds, isAlive, isFree, isOptimalTile, posKey, reachableTiles, samePos } from "./grid";
import { affectedUnits, isMoveSupported, validOptions, type TargetOption } from "./targeting";
import { CombatError, type CombatAction, type CombatEvent, type CombatResult, type CombatState, type CombatUnit } from "./types";

/** The unit whose turn it is, or null outside a battle. */
export function currentUnit(state: CombatState): CombatUnit | null {
  if (state.phase !== "battle") return null;
  const id = state.order[state.turnIndex];
  return id ? getUnit(state, id) : null;
}

/** Turn order: SPD high to low. Ties: player units first, then the lower slot index. */
export function turnOrder(state: CombatState): string[] {
  return state.units
    .filter(isAlive)
    .sort((a, b) => b.stats.spd - a.stats.spd || (a.side === b.side ? a.slot - b.slot : a.side === "player" ? -1 : 1))
    .map((u) => u.id);
}

/** Why the current player unit cannot use a move right now, or null if it can. */
export function moveBlockedReason(state: CombatState, unit: CombatUnit, move: Move): string | null {
  if (!isMoveSupported(move)) return "Not available yet";
  const cooldown = unit.cooldowns[move.id] ?? 0;
  if (cooldown > 0) return `Ready in ${cooldown} turn${cooldown === 1 ? "" : "s"}`;
  if (unit.side === "player" && state.mana < move.mana) return "Not enough mana";
  if (validOptions(state, unit, move).length === 0) return "No target in range";
  return null;
}

export function applyAction(prev: CombatState, action: CombatAction): CombatResult {
  const state = structuredClone(prev);
  const events: CombatEvent[] = [];
  const rng = new Rng(state.rngState);

  switch (action.type) {
    case "place": {
      requirePhase(state, "placement");
      const unit = getUnit(state, action.unitId);
      if (unit.side !== "player" || unit.fainted) throw new CombatError("That critter cannot be placed.");
      if (!inBounds(state, action.pos)) throw new CombatError("That tile is outside the grid.");
      if (config.combat.placementZone === "half" && action.pos.x >= Math.ceil(state.width / 2)) {
        throw new CombatError("Place critters on your half of the grid.");
      }
      if (!(unit.pos && samePos(unit.pos, action.pos)) && !isFree(state, action.pos)) throw new CombatError("That tile is taken.");
      unit.pos = { ...action.pos };
      events.push({ type: "placed", unitId: unit.id, pos: unit.pos });
      break;
    }

    case "unplace": {
      requirePhase(state, "placement");
      const unit = getUnit(state, action.unitId);
      if (unit.side !== "player") throw new CombatError("Only your critters can be picked up.");
      unit.pos = null;
      events.push({ type: "placed", unitId: unit.id, pos: null });
      break;
    }

    case "start": {
      requirePhase(state, "placement");
      const mine = state.units.filter((u) => u.side === "player" && !u.fainted);
      if (mine.length === 0 || mine.some((u) => u.pos === null)) throw new CombatError("Place all your critters first.");
      state.phase = "battle";
      state.round = 0;
      events.push({ type: "battleStarted" });
      startRound(state, events);
      advance(state, events, rng);
      break;
    }

    case "move": {
      const unit = requirePlayerTurn(state);
      if (state.hasMoved) throw new CombatError("This critter has already moved this turn.");
      const path = reachableTiles(state, unit).get(posKey(action.to));
      if (!path) throw new CombatError("That tile is out of reach.");
      unit.pos = { ...action.to };
      state.hasMoved = true;
      events.push({ type: "moved", unitId: unit.id, path });
      break;
    }

    case "useMove": {
      const unit = requirePlayerTurn(state);
      if (!unit.moves.includes(action.moveId)) throw new CombatError("This critter does not know that move.");
      const move = getMove(action.moveId);
      const blocked = moveBlockedReason(state, unit, move);
      if (blocked) throw new CombatError(blocked);
      const option = validOptions(state, unit, move).find((o) => samePos(o.target, action.target));
      if (!option) throw new CombatError("That is not a valid target.");
      state.mana -= move.mana;
      resolveMove(state, unit, move, option, rng, events);
      // Using a move ends the turn: moving after attacking is not allowed.
      events.push({ type: "turnEnded", unitId: unit.id });
      advance(state, events, rng);
      break;
    }

    case "endTurn": {
      const unit = requirePlayerTurn(state);
      events.push({ type: "turnEnded", unitId: unit.id });
      advance(state, events, rng);
      break;
    }
  }

  state.rngState = rng.state;
  return { state, events };
}

function requirePhase(state: CombatState, phase: CombatState["phase"]): void {
  if (state.phase !== phase) throw new CombatError(`Not allowed during the ${state.phase} phase.`);
}

function requirePlayerTurn(state: CombatState): CombatUnit {
  const unit = currentUnit(state);
  if (!unit || unit.side !== "player") throw new CombatError("It is not your turn.");
  return unit;
}

/** Round start: refill mana, tick cooldowns, work out the turn order. */
function startRound(state: CombatState, events: CombatEvent[]): void {
  state.round += 1;
  state.mana = state.maxMana;
  for (const unit of state.units) {
    for (const id of Object.keys(unit.cooldowns)) unit.cooldowns[id] = Math.max(0, (unit.cooldowns[id] ?? 0) - 1);
  }
  state.order = turnOrder(state);
  state.turnIndex = -1;
  events.push({ type: "roundStarted", round: state.round, mana: state.mana, order: [...state.order] });
}

/** Moves on to the next living unit. Enemy turns play out here, until a player unit is up or the fight ends. */
function advance(state: CombatState, events: CombatEvent[], rng: Rng): void {
  while (state.phase === "battle") {
    let next = state.turnIndex + 1;
    while (next < state.order.length && !isAlive(getUnit(state, state.order[next] as string))) next++;
    if (next >= state.order.length) {
      startRound(state, events);
      if (state.order.length === 0) return; // Nobody left to act. Cannot happen in a live battle.
      continue;
    }
    state.turnIndex = next;
    state.hasMoved = false;

    const unit = getUnit(state, state.order[next] as string);
    unit.onOptimalTile = unit.pos !== null && isOptimalTile(unit.optimalTile, unit.pos, state.width, state.height);
    events.push({ type: "turnStarted", unitId: unit.id, onOptimalTile: unit.onOptimalTile });
    if (unit.side === "player") return;

    const plan = planEnemyTurn(state, unit, rng);
    const destination = plan.path[plan.path.length - 1];
    if (destination) {
      unit.pos = { ...destination };
      events.push({ type: "moved", unitId: unit.id, path: plan.path });
    }
    if (plan.attack) resolveMove(state, unit, getMove(plan.attack.moveId), plan.attack.option, rng, events);
    events.push({ type: "turnEnded", unitId: unit.id });
  }
}

function resolveMove(state: CombatState, unit: CombatUnit, move: Move, option: TargetOption, rng: Rng, events: CombatEvent[]): void {
  const targets = affectedUnits(state, unit, move, option);
  // Cooldown counts own turns before reuse. +1 because the round-start tick also runs before the next turn.
  unit.cooldowns[move.id] = move.cooldown + 1;
  events.push({ type: "moveUsed", unitId: unit.id, moveId: move.id, tiles: option.tiles, mana: state.mana });

  let dealt = 0;
  if (move.power > 0) {
    for (const target of targets) {
      const variance = rng.range(config.combat.varianceMin, config.combat.varianceMax);
      const { amount, typeMult } = computeDamage(unit, move, target, variance);
      const taken = Math.min(amount, target.hp);
      target.hp -= taken;
      dealt += taken;
      events.push({ type: "damaged", unitId: target.id, sourceId: unit.id, amount, hp: target.hp, typeMult });
      if (target.hp === 0) {
        target.fainted = true;
        target.pos = null;
        events.push({ type: "fainted", unitId: target.id });
      }
    }
  }

  for (const effect of move.effects) {
    if (effect.type === "heal") {
      for (const target of targets) heal(target, Math.round((target.stats.hp * effect.percent) / 100), events);
    } else if (effect.type === "lifesteal") {
      heal(unit, Math.round((dealt * effect.percent) / 100), events);
    }
  }

  // A fight is lost when every active critter on the grid has fainted.
  const alive = (side: CombatUnit["side"]) => state.units.some((u) => u.side === side && isAlive(u));
  if (!alive("enemy")) {
    state.phase = "won";
    events.push({ type: "battleEnded", result: "won" });
  } else if (!alive("player")) {
    state.phase = "lost";
    events.push({ type: "battleEnded", result: "lost" });
  }
}

function heal(unit: CombatUnit, amount: number, events: CombatEvent[]): void {
  if (unit.fainted) return;
  const gained = Math.min(amount, unit.stats.hp - unit.hp);
  if (gained <= 0) return;
  unit.hp += gained;
  events.push({ type: "healed", unitId: unit.id, amount: gained, hp: unit.hp });
}
