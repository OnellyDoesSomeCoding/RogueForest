// Type chart and the damage formula (TECH_DESIGN §6.2, §7.6).
import { config, getType } from "../../gameData";
import type { Move, TypeId } from "../../types";
import type { CombatUnit } from "./types";

/** Type multiplier for a move against a defender. Dual types multiply (×0.5625 to ×2.25). */
export function typeMultiplier(moveType: TypeId | "Neutral", defenderTypes: readonly TypeId[]): number {
  if (moveType === "Neutral") return 1;
  const attacker = getType(moveType);
  let mult = 1;
  for (const t of defenderTypes) {
    if (attacker.strongAgainst.includes(t)) mult *= config.types.strongMultiplier;
    else if (attacker.resistedBy.includes(t)) mult *= config.types.resistMultiplier;
  }
  return mult;
}

export interface DamageRoll {
  amount: number;
  typeMult: number;
}

/**
 * damage = max(1, round(power × ATK / (DEF × K) × typeMult × sameTypeBonus × optimalBonus × variance))
 * `variance` is a seeded roll in [varianceMin, varianceMax]. Pass 1 for an expected value.
 */
export function computeDamage(attacker: CombatUnit, move: Move, defender: CombatUnit, variance: number): DamageRoll {
  const typeMult = typeMultiplier(move.type, defender.types);
  const sameType = move.type !== "Neutral" && attacker.types.includes(move.type) ? config.types.sameTypeBonus : 1;
  const optimal = attacker.onOptimalTile ? 1 + config.combat.optimalTileBonus : 1;
  const raw = ((move.power * attacker.stats.atk) / (defender.stats.def * config.combat.damageK)) * typeMult * sameType * optimal * variance;
  return { amount: Math.max(1, Math.round(raw)), typeMult };
}
