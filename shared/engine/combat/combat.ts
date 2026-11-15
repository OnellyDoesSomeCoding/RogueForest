// The combat reducer: applyAction(state, action) -> { state, events } (TECH_DESIGN §7).
// Pure. The input state is never changed. All randomness comes from state.rngState.
import { config, getMove, getStatus } from "../../gameData";
import type { Move } from "../../types";
import { Rng } from "../rng";
import { checkBattleEnd, gainHp, loseHp, resolveMove } from "./effects";
import { executeEnemyTurn, planIntents } from "./enemy";
import { getUnit, inBounds, isAlive, isFree, isOptimalTile, posKey, reachableTiles, samePos } from "./grid";
import { armStatuses, effectiveSpd, hasStatus, tickStatuses } from "./statuses";
import { validOptions } from "./targeting";
import { CombatError, type CombatAction, type CombatEvent, type CombatResult, type CombatState, type CombatUnit } from "./types";

/** The unit whose turn it is, or null outside a battle. */
export function currentUnit(state: CombatState): CombatUnit | null {
  if (state.phase !== "battle") return null;
  const id = state.order[state.turnIndex];
  return id ? getUnit(state, id) : null;
}

/** Turn order: SPD (after Slow/Haste) high to low. Ties: player units first, then the lower slot index. */
export function turnOrder(state: CombatState): string[] {
  return state.units
    .filter(isAlive)
    .sort((a, b) => effectiveSpd(b) - effectiveSpd(a) || (a.side === b.side ? a.slot - b.slot : a.side === "player" ? -1 : 1))
    .map((u) => u.id);
}

/** Why the current player unit cannot use a move right now, or null if it can. */
export function moveBlockedReason(state: CombatState, unit: CombatUnit, move: Move): string | null {
  const cooldown = unit.cooldowns[move.id] ?? 0;
  if (cooldown > 0) return `Ready in ${cooldown} turn${cooldown === 1 ? "" : "s"}`;
  if (unit.side === "player" && state.mana < move.mana) return "Not enough mana";
  if (validOptions(state, unit, move).length === 0) return move.target === "tile" ? "No empty tile in range" : "No target in range";
  return null;
}

export function applyAction(prev: CombatState, action: CombatAction): CombatResult {
  const state = structuredClone(prev);
  state.intents ??= [];
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
      startRound(state, events, rng);
      advance(state, events, rng);
      break;
    }

    case "move": {
      const unit = requirePlayerTurn(state);
      if (state.hasMoved) throw new CombatError("This critter has already moved this turn.");
      if (hasStatus(unit, "Root")) throw new CombatError("This critter is rooted and cannot move.");
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
      endTurn(unit, events);
      advance(state, events, rng);
      break;
    }

    case "endTurn": {
      const unit = requirePlayerTurn(state);
      endTurn(unit, events);
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

/** Round start: refill mana, tick cooldowns and rocks, work out the turn order, enemies declare intents. */
function startRound(state: CombatState, events: CombatEvent[], rng: Rng): void {
  state.round += 1;
  state.mana = state.maxMana;
  for (const unit of state.units) {
    for (const id of Object.keys(unit.cooldowns)) unit.cooldowns[id] = Math.max(0, (unit.cooldowns[id] ?? 0) - 1);
  }
  for (const rock of [...state.obstacles]) {
    if (rock.rounds == null) continue;
    rock.rounds -= 1;
    if (rock.rounds <= 0) {
      state.obstacles = state.obstacles.filter((o) => o !== rock);
      events.push({ type: "obstacleRemoved", pos: { x: rock.x, y: rock.y } });
    }
  }
  state.order = turnOrder(state);
  state.turnIndex = -1;
  events.push({ type: "roundStarted", round: state.round, mana: state.mana, order: [...state.order] });
  planIntents(state, rng, events);
}

/** End of a unit's turn: its statuses tick down. */
function endTurn(unit: CombatUnit, events: CombatEvent[]): void {
  if (!unit.fainted) tickStatuses(unit, events);
  events.push({ type: "turnEnded", unitId: unit.id });
}

/**
 * Moves on to the next living unit. Start-of-turn statuses apply here (Burn, Regen, Stun).
 * Enemy turns play out here, until a player unit is up or the fight ends.
 */
function advance(state: CombatState, events: CombatEvent[], rng: Rng): void {
  while (state.phase === "battle") {
    let next = state.turnIndex + 1;
    while (next < state.order.length && !isAlive(getUnit(state, state.order[next] as string))) next++;
    if (next >= state.order.length) {
      startRound(state, events, rng);
      if (state.order.length === 0) return; // Nobody left to act. Cannot happen in a live battle.
      continue;
    }
    state.turnIndex = next;
    state.hasMoved = false;

    const unit = getUnit(state, state.order[next] as string);
    unit.onOptimalTile = unit.pos !== null && isOptimalTile(unit.optimalTile, unit.pos, state.width, state.height);
    events.push({ type: "turnStarted", unitId: unit.id, onOptimalTile: unit.onOptimalTile });
    armStatuses(unit);

    // Burn and Regen happen at the start of the holder's turn.
    for (const s of [...unit.statuses]) {
      const percent = getStatus(s.id).percent ?? 0;
      if (s.id === "Burn") loseHp(unit, Math.max(1, Math.round((unit.stats.hp * percent) / 100)), events, { sourceId: null, cause: "Burn" });
      else if (s.id === "Regen") gainHp(unit, Math.max(1, Math.round((unit.stats.hp * percent) / 100)), events, "Regen");
    }
    if (unit.fainted) {
      // Burned out at the start of its turn. Its plan goes with it.
      state.intents = state.intents.filter((i) => i.unitId !== unit.id);
      if (checkBattleEnd(state, events)) return;
      continue;
    }

    if (hasStatus(unit, "Stun")) {
      state.intents = state.intents.filter((i) => i.unitId !== unit.id);
      events.push({ type: "turnSkipped", unitId: unit.id, reason: "Stun" });
      endTurn(unit, events);
      continue;
    }

    if (unit.side === "player") return;

    executeEnemyTurn(state, unit, rng, events);
    if (state.phase !== "battle") return;
    endTurn(unit, events);
  }
}
