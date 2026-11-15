// Enemy turn logic. Simple for now (TECH_DESIGN §7.9): score every reachable tile + usable move
// by expected damage and pick the best. Declared intents and support behavior arrive with M3.
import { getMove } from "../../gameData";
import type { Rng } from "../rng";
import { computeDamage } from "./damage";
import { isAlive, isOptimalTile, manhattan, posKey, reachableTiles } from "./grid";
import { affectedUnits, isMoveSupported, targetOptions, type TargetOption } from "./targeting";
import type { CombatState, CombatUnit, Pos } from "./types";

export interface EnemyPlan {
  /** Steps to walk before acting. Empty = stay. */
  path: Pos[];
  attack: { moveId: string; option: TargetOption } | null;
}

const FAINT_BONUS = 15;
const OPTIMAL_BONUS = 1;
const NOISE = 0.1;

export function planEnemyTurn(state: CombatState, unit: CombatUnit, rng: Rng): EnemyPlan {
  if (!unit.pos) return { path: [], attack: null };

  const spots: { pos: Pos; path: Pos[] }[] = [{ pos: unit.pos, path: [] }];
  for (const path of reachableTiles(state, unit).values()) spots.push({ pos: path[path.length - 1] as Pos, path });

  const usable = unit.moves
    .map(getMove)
    .filter((m) => m.power > 0 && isMoveSupported(m) && (unit.cooldowns[m.id] ?? 0) === 0);

  let best: { score: number; plan: EnemyPlan } | null = null;
  for (const spot of spots) {
    for (const move of usable) {
      for (const option of targetOptions(state, unit, move, spot.pos)) {
        const targets = affectedUnits(state, unit, move, option, spot.pos);
        if (targets.length === 0) continue;
        let score = 0;
        for (const target of targets) {
          const expected = computeDamage(unit, move, target, 1).amount;
          score += Math.min(expected, target.hp) + (expected >= target.hp ? FAINT_BONUS : 0);
        }
        if (isOptimalTile(unit.optimalTile, spot.pos, state.width, state.height)) score += OPTIMAL_BONUS;
        // A little seeded noise, so enemies are not perfectly predictable.
        score *= 1 + rng.float() * NOISE;
        if (!best || score > best.score) best = { score, plan: { path: spot.path, attack: { moveId: move.id, option } } };
      }
    }
  }
  if (best) return best.plan;

  // Nothing in reach: walk toward the nearest player critter.
  const foes = state.units.filter((u) => u.side !== unit.side && isAlive(u));
  const distance = (p: Pos) => Math.min(...foes.map((f) => manhattan(p, f.pos as Pos)));
  let closest = spots[0] as (typeof spots)[number];
  for (const spot of spots) {
    if (foes.length > 0 && distance(spot.pos) < distance(closest.pos)) closest = spot;
  }
  return { path: posKey(closest.pos) === posKey(unit.pos) ? [] : closest.path, attack: null };
}
