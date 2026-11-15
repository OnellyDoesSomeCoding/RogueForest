// Stat formulas from TECH_DESIGN §6.3 and §6.4.
import { config, stageIndex } from "../gameData";
import type { CritterLine, Stats } from "../types";

/** Stage-1, level-1 stats: role template plus any per-line override. */
export function baseStats(line: CritterLine): Stats {
  const template = config.stats.roles[line.role];
  return { ...template, ...line.statsOverride };
}

/**
 * Final stats for a critter.
 * - Evolution multiplies HP/ATK/DEF and adds SPD per stage. MOV never changes.
 * - Level scales HP/ATK/DEF only.
 */
export function computeStats(line: CritterLine, stageId: string, level: number): Stats {
  const index = stageIndex(line, stageId);
  if (index < 0) throw new Error(`Stage ${stageId} is not part of line ${line.line}`);
  const base = baseStats(line);
  const stageMult = config.stats.stageMultipliers[index] ?? 1;
  const levelMult = 1 + config.stats.levelScale * (level - 1);
  const scale = (value: number) => Math.round(value * stageMult * levelMult);
  return {
    hp: scale(base.hp),
    atk: scale(base.atk),
    def: scale(base.def),
    spd: base.spd + config.stats.spdPerStage * index,
    mov: base.mov,
  };
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return config.xp.toNextLevelPerLevel * level;
}

/** The highest stage a critter of this line can be at this level. */
export function stageForLevel(line: CritterLine, level: number): string {
  let current = 0;
  for (let i = 0; i < line.stages.length - 1; i++) {
    const evolveAt = line.stages[i]?.evolveAt;
    if (evolveAt != null && level >= evolveAt) current = i + 1;
    else break;
  }
  return (line.stages[current] as { id: string }).id;
}
