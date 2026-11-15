// Enemy intents and turns (TECH_DESIGN §7.4, §7.9).
// At round start every enemy declares a plan: where it will walk, which move, which tiles.
// On its turn it carries the plan out. Attacks only ever hit tiles that were declared (shown red),
// so stepping off them dodges.
import { getMove, getStatus } from "../../gameData";
import type { Move, StatusId } from "../../types";
import type { Rng } from "../rng";
import { computeDamage } from "./damage";
import { resolveMove } from "./effects";
import { isAlive, isOptimalTile, manhattan, posKey, reachableTiles, samePos } from "./grid";
import { effectiveMov, hasStatus } from "./statuses";
import { affectedUnits, isHostile, targetOptions, type TargetOption } from "./targeting";
import type { CombatEvent, CombatState, CombatUnit, Intent, Pos } from "./types";

const FAINT_BONUS = 15;
const OPTIMAL_BONUS = 1;
/** Per tile closer to the nearest player critter. Makes enemies advance while they buff or heal. */
const APPROACH_BONUS = 0.3;
const NOISE = 0.1;
const LOW_HP = 0.5;
/** Support-role enemies value healing and protecting allies this much more. */
const SUPPORT_ROLE_BONUS = 1.5;

/** How much an enemy wants to put a bad status on one of your critters. */
const HOSTILE_STATUS_VALUE: Partial<Record<StatusId, number>> = { Stun: 18, Root: 6, Slow: 5, Weak: 8, Burn: 8 };

/** How much an enemy wants to give a good status to itself or an ally. */
function supportStatusValue(id: StatusId, low: boolean): number {
  switch (id) {
    case "Guard":
      return low ? 12 : 3;
    case "Evade":
      return low ? 10 : 3;
    case "Regen":
      return low ? 8 : 2;
    case "Empower":
      return 6;
    case "Haste":
      return 3;
    default:
      return 0;
  }
}

/** How good it is for `unit` to use `move` aimed with `option` while standing on `origin`. */
function scoreMove(state: CombatState, unit: CombatUnit, move: Move, option: TargetOption, origin: Pos): number {
  if (move.target === "tile") return 0; // Enemies do not place rocks yet.
  const targets = affectedUnits(state, unit, move, option, origin);
  const supportBonus = unit.side === "enemy" && isSupportRole(unit) ? SUPPORT_ROLE_BONUS : 1;
  let score = 0;
  for (const t of targets) {
    if (t.side !== unit.side) {
      let value = 0;
      if (move.power > 0) {
        const expected = computeDamage(unit, move, t, 1).amount;
        value += Math.min(expected, t.hp) + (expected >= t.hp ? FAINT_BONUS : 0);
      }
      for (const e of move.effects) {
        if (e.type === "status") value += (HOSTILE_STATUS_VALUE[e.status as StatusId] ?? 0) * (hasStatus(t, e.status as StatusId) ? 0.3 : 1);
        if (e.type === "push" || e.type === "pull" || e.type === "pullToCenter") value += 2;
      }
      // An Evade would waste the whole move.
      score += hasStatus(t, "Evade") ? value * 0.2 : value;
    } else {
      const low = t.hp / t.stats.hp < LOW_HP;
      let value = 0;
      for (const e of move.effects) {
        if (e.type === "heal") {
          const amount = Math.min(Math.round((t.stats.hp * e.percent) / 100), t.stats.hp - t.hp);
          value += amount * (low ? 1.5 : 0.4);
        } else if (e.type === "status") {
          value += supportStatusValue(e.status as StatusId, low) * (hasStatus(t, e.status as StatusId) ? 0.3 : 1);
        } else if (e.type === "cleanse") {
          value += t.statuses.filter((s) => getStatus(s.id).kind === "bad").length * 5;
        }
      }
      score += value * supportBonus;
    }
  }
  return score;
}

function isSupportRole(unit: CombatUnit): boolean {
  // Role is not stored on the unit. Support critters are the ones with a heal or a guard for others.
  return unit.moves.some((id) => {
    const m = getMove(id);
    return m.target === "ally" && m.effects.some((e) => e.type === "heal" || (e.type === "status" && e.status === "Guard"));
  });
}

/** Plans one enemy's turn. `reserved` holds tiles other enemies already plan to walk to. */
function planIntent(state: CombatState, unit: CombatUnit, rng: Rng, reserved: Set<string>): Intent {
  const here = unit.pos as Pos;
  const spots: { pos: Pos; path: Pos[] }[] = [{ pos: here, path: [] }];
  for (const path of reachableTiles(state, unit).values()) {
    const end = path[path.length - 1] as Pos;
    if (!reserved.has(posKey(end))) spots.push({ pos: end, path });
  }

  const foes = state.units.filter((u) => u.side !== unit.side && isAlive(u));
  const distance = (p: Pos) => (foes.length ? Math.min(...foes.map((f) => manhattan(p, f.pos as Pos))) : 0);
  const startDistance = distance(here);

  const usable = unit.moves.map(getMove).filter((m) => (unit.cooldowns[m.id] ?? 0) === 0);
  let best: { score: number; intent: Intent } | null = null;
  for (const spot of spots) {
    for (const move of usable) {
      for (const option of targetOptions(state, unit, move, spot.pos)) {
        let score = scoreMove(state, unit, move, option, spot.pos);
        if (score <= 0) continue;
        if (isOptimalTile(unit.optimalTile, spot.pos, state.width, state.height)) score += OPTIMAL_BONUS;
        score += APPROACH_BONUS * (startDistance - distance(spot.pos));
        // A little seeded noise, so enemies are not perfectly predictable.
        score *= 1 + rng.float() * NOISE;
        if (!best || score > best.score) {
          best = {
            score,
            intent: { unitId: unit.id, dest: spot.pos, moveId: move.id, target: option.target, tiles: option.tiles, hostile: isHostile(move) },
          };
        }
      }
    }
  }
  if (best) return best.intent;

  // Nothing worth doing in reach: walk toward the nearest player critter.
  let closest = spots[0] as (typeof spots)[number];
  for (const spot of spots) if (distance(spot.pos) < distance(closest.pos)) closest = spot;
  return { unitId: unit.id, dest: closest.pos, moveId: null, target: null, tiles: [], hostile: false };
}

/** Round start: every enemy that can act this round declares its plan. Stunned enemies do not. */
export function planIntents(state: CombatState, rng: Rng, events: CombatEvent[]): void {
  state.intents = [];
  const reserved = new Set<string>();
  for (const id of state.order) {
    const unit = state.units.find((u) => u.id === id);
    if (!unit || unit.side !== "enemy" || !isAlive(unit) || hasStatus(unit, "Stun")) continue;
    const intent = planIntent(state, unit, rng, reserved);
    reserved.add(posKey(intent.dest));
    state.intents.push(intent);
  }
  events.push({ type: "intentsDeclared", intents: structuredClone(state.intents) });
}

/**
 * Re-aims a declared move from where the enemy actually stands.
 * - Attacks hit only declared tiles that it can still reach. None left = it fizzles.
 * - Heals and buffs use the same aim if it still works. Self-centered ones follow the enemy.
 */
function reaim(state: CombatState, unit: CombatUnit, move: Move, intent: Intent): TargetOption | null {
  const target = intent.target;
  if (!target) return null;
  const options = targetOptions(state, unit, move);
  const sameAim = options.find((o) => samePos(o.target, target));

  if (!intent.hostile) {
    if (sameAim) return sameAim;
    return move.shape === "self" || move.shape === "around" ? (options[0] ?? null) : null;
  }

  const declared = new Set(intent.tiles.map(posKey));
  const overlap = (o: TargetOption): TargetOption => ({ target: o.target, tiles: o.tiles.filter((t) => declared.has(posKey(t))) });
  if (move.shape === "single" || move.shape === "plus" || move.shape === "square3") {
    const aimed = sameAim ? overlap(sameAim) : null;
    return aimed && aimed.tiles.length > 0 ? aimed : null;
  }
  let best: TargetOption | null = null;
  for (const o of options) {
    const kept = overlap(o);
    if (kept.tiles.length > 0 && (!best || kept.tiles.length > best.tiles.length)) best = kept;
  }
  return best;
}

/** Carries out an enemy's declared plan: walk to its tile (or as close as it can), then use its move. */
export function executeEnemyTurn(state: CombatState, unit: CombatUnit, rng: Rng, events: CombatEvent[]): void {
  const intent = state.intents.find((i) => i.unitId === unit.id);
  state.intents = state.intents.filter((i) => i.unitId !== unit.id);
  if (!intent || !unit.pos) return;

  if (!samePos(unit.pos, intent.dest) && effectiveMov(unit) > 0) {
    const reach = reachableTiles(state, unit);
    let path = reach.get(posKey(intent.dest));
    if (!path) {
      // Its tile is blocked: walk to the reachable tile nearest to it, if that is closer than staying.
      let bestDist = manhattan(unit.pos, intent.dest);
      for (const candidate of reach.values()) {
        const d = manhattan(candidate[candidate.length - 1] as Pos, intent.dest);
        if (d < bestDist || (d === bestDist && path && candidate.length < path.length)) {
          bestDist = d;
          path = candidate;
        }
      }
    }
    const end = path?.[path.length - 1];
    if (path && end) {
      unit.pos = { ...end };
      events.push({ type: "moved", unitId: unit.id, path });
    }
  }

  if (!intent.moveId) return;
  const move = getMove(intent.moveId);
  const option = reaim(state, unit, move, intent);
  if (!option) {
    events.push({ type: "attackFizzled", unitId: unit.id, moveId: move.id });
    return;
  }
  resolveMove(state, unit, move, option, rng, events);
}
