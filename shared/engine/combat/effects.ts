// Resolving a move: damage, statuses, heals, push/pull and rocks (TECH_DESIGN §7.6–7.8, §8.1).
import { config } from "../../gameData";
import type { Move } from "../../types";
import type { Rng } from "../rng";
import { computeDamage } from "./damage";
import { isAlive, isFree, manhattan, samePos, stepToward } from "./grid";
import { applyStatus, cleanse, hasStatus, removeStatus } from "./statuses";
import { affectedUnits, isHostile, type TargetOption } from "./targeting";
import type { CombatEvent, CombatState, CombatUnit, Pos } from "./types";

/** Takes HP away, and removes the unit from the grid if it reaches 0. Returns the HP actually lost. */
export function loseHp(
  unit: CombatUnit,
  amount: number,
  events: CombatEvent[],
  extra: { sourceId: string | null; typeMult?: number; cause?: "Burn" | "collision" },
): number {
  const lost = Math.min(amount, unit.hp);
  unit.hp -= lost;
  events.push({ type: "damaged", unitId: unit.id, sourceId: extra.sourceId, amount, hp: unit.hp, typeMult: extra.typeMult ?? 1, ...(extra.cause ? { cause: extra.cause } : {}) });
  if (unit.hp === 0) {
    unit.fainted = true;
    unit.pos = null;
    unit.statuses = [];
    events.push({ type: "fainted", unitId: unit.id });
  }
  return lost;
}

export function gainHp(unit: CombatUnit, amount: number, events: CombatEvent[], cause?: "Regen"): void {
  if (unit.fainted) return;
  const gained = Math.min(amount, unit.stats.hp - unit.hp);
  if (gained <= 0) return;
  unit.hp += gained;
  events.push({ type: "healed", unitId: unit.id, amount: gained, hp: unit.hp, ...(cause ? { cause } : {}) });
}

/** Ends the battle if one side has nobody left on the grid. Returns true if it ended. */
export function checkBattleEnd(state: CombatState, events: CombatEvent[]): boolean {
  if (state.phase !== "battle") return state.phase === "won" || state.phase === "lost";
  const alive = (side: CombatUnit["side"]) => state.units.some((u) => u.side === side && isAlive(u));
  if (!alive("enemy")) {
    state.phase = "won";
    events.push({ type: "battleEnded", result: "won" });
    return true;
  }
  if (!alive("player")) {
    state.phase = "lost";
    events.push({ type: "battleEnded", result: "lost" });
    return true;
  }
  return false;
}

/**
 * Moves a unit up to `distance` tiles in direction `dir`, one tile at a time. If a unit, a rock
 * or the grid edge blocks it, it stops and takes collision damage (5% max HP). Being pulled up
 * against the unit that pulls it is not a collision (`stopAt`).
 */
function forceMove(state: CombatState, unit: CombatUnit, dir: Pos, distance: number, kind: "push" | "pull", sourceId: string, events: CombatEvent[], stopAt?: Pos): void {
  if (!unit.pos) return;
  const path: Pos[] = [];
  let pos = unit.pos;
  let collided = false;
  for (let i = 0; i < distance; i++) {
    const next = { x: pos.x + dir.x, y: pos.y + dir.y };
    if (!isFree(state, next)) {
      collided = !(stopAt && samePos(next, stopAt));
      break;
    }
    pos = next;
    path.push(pos);
  }
  if (path.length > 0) {
    unit.pos = { ...pos };
    events.push({ type: "forcedMove", unitId: unit.id, path, kind });
  }
  if (collided) {
    const amount = Math.max(1, Math.round((unit.stats.hp * config.combat.collisionDamagePercent) / 100));
    loseHp(unit, amount, events, { sourceId, cause: "collision" });
  }
}

/**
 * Applies a move aimed with `option`. The caller has already checked that the move is allowed.
 * Order: damage to every target, then statuses/heals/cleanse, then push/pull, then lifesteal.
 */
export function resolveMove(state: CombatState, unit: CombatUnit, move: Move, option: TargetOption, rng: Rng, events: CombatEvent[]): void {
  const origin = unit.pos as Pos;
  // Cooldown counts own turns before reuse. +1 because the round-start tick also runs before the next turn.
  unit.cooldowns[move.id] = move.cooldown + 1;
  events.push({ type: "moveUsed", unitId: unit.id, moveId: move.id, tiles: option.tiles, mana: state.mana });

  // Earth Wall: a temporary rock on an empty tile.
  for (const effect of move.effects) {
    if (effect.type === "obstacle" && isFree(state, option.target)) {
      state.obstacles.push({ x: option.target.x, y: option.target.y, rounds: effect.rounds });
      events.push({ type: "obstaclePlaced", pos: { ...option.target }, rounds: effect.rounds });
    }
  }

  const hostile = isHostile(move);
  const targets = affectedUnits(state, unit, move, option);
  const landed: CombatUnit[] = [];
  let dealt = 0;

  for (const target of targets) {
    // Evade: the next hostile move that hits this unit does nothing to it.
    if (hostile && hasStatus(target, "Evade")) {
      removeStatus(target, "Evade", "used", events);
      events.push({ type: "evaded", unitId: target.id, sourceId: unit.id });
      continue;
    }
    if (move.power > 0) {
      const variance = rng.range(config.combat.varianceMin, config.combat.varianceMax);
      const { amount, typeMult } = computeDamage(unit, move, target, variance);
      dealt += loseHp(target, amount, events, { sourceId: unit.id, typeMult });
    }
    if (!target.fainted) landed.push(target);
  }

  for (const target of landed) {
    for (const effect of move.effects) {
      if (effect.type === "status") applyStatus(state, target, effect.status as Parameters<typeof applyStatus>[2], events);
      else if (effect.type === "heal") gainHp(target, Math.round((target.stats.hp * effect.percent) / 100), events);
      else if (effect.type === "cleanse") cleanse(target, events);
    }
  }

  // Push/pull. Units farthest along the push go first, so a line of units does not block itself.
  for (const effect of move.effects) {
    if (effect.type === "push" || effect.type === "pull") {
      const sorted = [...landed].sort((a, b) => {
        const da = manhattan(origin, a.pos as Pos);
        const db = manhattan(origin, b.pos as Pos);
        return effect.type === "push" ? db - da : da - db;
      });
      for (const target of sorted) {
        if (!target.pos) continue;
        const away = stepToward(origin, target.pos);
        if (!away) continue;
        const dir = effect.type === "push" ? away : { x: -away.x, y: -away.y };
        forceMove(state, target, dir, effect.distance, effect.type, unit.id, events, effect.type === "pull" ? origin : undefined);
      }
    } else if (effect.type === "pullToCenter") {
      const center = option.target;
      const sorted = [...landed].sort((a, b) => manhattan(center, a.pos as Pos) - manhattan(center, b.pos as Pos));
      for (const target of sorted) {
        if (!target.pos) continue;
        const dir = stepToward(target.pos, center);
        if (dir) forceMove(state, target, dir, effect.distance, "pull", unit.id, events);
      }
    }
  }

  for (const effect of move.effects) {
    if (effect.type === "lifesteal") gainHp(unit, Math.round((dealt * effect.percent) / 100), events);
  }

  checkBattleEnd(state, events);
}
