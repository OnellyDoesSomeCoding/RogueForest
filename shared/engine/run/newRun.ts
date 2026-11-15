// Creates the save for a brand-new run from a Starter Select team.
import { config, firstStage, getCritterLine } from "../../gameData";
import type { OwnedCritter, RunSave } from "../../types";
import { seedToState } from "../rng";
import { computeStats } from "../stats";

export interface StarterTeam {
  /** Critter line IDs, in slot order. */
  active: string[];
  bench: string[];
}

export type TeamProblem =
  | "empty"
  | "tooManyActive"
  | "tooManyBench"
  | "overBudget"
  | "duplicate"
  | "unknownLine"
  | "locked";

export function teamCost(team: StarterTeam): number {
  return [...team.active, ...team.bench].reduce((sum, line) => sum + (getCritterLine(line)?.cost ?? 0), 0);
}

/** Returns the first rule the team breaks, or null if the team can start a run. */
export function validateStarterTeam(team: StarterTeam, unlocked: readonly string[]): TeamProblem | null {
  const all = [...team.active, ...team.bench];
  if (all.length === 0) return "empty";
  if (team.active.length > config.starter.activeSlots) return "tooManyActive";
  if (team.bench.length > config.starter.benchSlots) return "tooManyBench";
  if (new Set(all).size !== all.length) return "duplicate";
  if (all.some((line) => !getCritterLine(line))) return "unknownLine";
  if (all.some((line) => !unlocked.includes(line))) return "locked";
  if (teamCost(team) > config.starter.pointBudget) return "overBudget";
  return null;
}

export function createRun(seed: string, team: StarterTeam): RunSave {
  let nextUid = 1;
  const own = (lineId: string): OwnedCritter => {
    const line = getCritterLine(lineId);
    if (!line) throw new Error(`Unknown critter line: ${lineId}`);
    const stage = firstStage(line);
    const level = config.starter.startingLevel;
    return {
      uid: `c${nextUid++}`,
      line: line.line,
      stageId: stage.id,
      level,
      xp: 0,
      hp: computeStats(line, stage.id, level).hp,
    };
  };

  return {
    saveVersion: 1,
    seed,
    rngState: seedToState(seed),
    floor: 1,
    act: 1,
    biomeId: config.run.firstBiome,
    biomeHistory: [config.run.firstBiome],
    map: [],
    currentNodeId: null,
    team: { active: team.active.map(own), bench: team.bench.map(own) },
    acorns: 0,
    potions: Array.from({ length: config.run.potionSlots }, () => null),
    relics: [],
    druidPowers: [],
  };
}
