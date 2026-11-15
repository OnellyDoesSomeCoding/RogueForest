// Builds the starting state of a fight: grid, player units from the run, enemies from the biome.
import { config, getBiome, getCritterLine } from "../../gameData";
import type { RunSave } from "../../types";
import type { Rng } from "../rng";
import { computeStats, stageForLevel } from "../stats";
import { isOptimalTile, posKey } from "./grid";
import type { CombatState, CombatUnit, Obstacle, Pos, Side } from "./types";

export type RoomKind = "normal" | "elite" | "boss";

export function createUnit(args: { id: string; side: Side; slot: number; line: string; stageId?: string; level: number; hp?: number; pos?: Pos | null }): CombatUnit {
  const line = getCritterLine(args.line);
  if (!line) throw new Error(`Unknown critter line: ${args.line}`);
  const stageId = args.stageId ?? stageForLevel(line, args.level);
  const stage = line.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Stage ${stageId} is not part of line ${line.line}`);
  const stats = computeStats(line, stageId, args.level);
  const hp = Math.min(args.hp ?? stats.hp, stats.hp);
  return {
    id: args.id,
    side: args.side,
    slot: args.slot,
    line: line.line,
    stageId,
    name: stage.name,
    level: args.level,
    types: [...line.types],
    optimalTile: line.optimalTile,
    stats,
    hp,
    pos: hp > 0 ? (args.pos ?? null) : null,
    fainted: hp <= 0,
    moves: [...line.moves],
    cooldowns: {},
    onOptimalTile: false,
    statuses: [],
  };
}

export function gridSize(floor: number, room: RoomKind): [width: number, height: number] {
  const row = config.grid.find((g) => floor >= g.fromFloor && floor <= g.toFloor) ?? config.grid[config.grid.length - 1];
  const size = row?.[room];
  if (!size || size.length !== 2) throw new Error(`No grid size for floor ${floor}`);
  return [size[0] as number, size[1] as number];
}

export function enemyLevel(floor: number, room: RoomKind): number {
  const base = config.enemies.levelBase + Math.floor(floor * config.enemies.levelPerFloor);
  return base + (room === "elite" ? config.enemies.eliteLevelBonus : room === "boss" ? config.enemies.bossLevelBonus : 0);
}

/** A normal fight for the run's current floor and biome. Enemies are already placed; player units are not. */
export function createEncounter(run: RunSave, rng: Rng): CombatState {
  const [width, height] = gridSize(run.floor, "normal");
  const tiles = width * height;
  const pool = getBiome(run.biomeId).pool;
  const level = enemyLevel(run.floor, "normal");

  const units: CombatUnit[] = run.team.active.map((c, slot) =>
    createUnit({ id: `p:${c.uid}`, side: "player", slot, line: c.line, stageId: c.stageId, level: c.level, hp: c.hp }),
  );

  // Enemies start on the right half. They prefer their optimal tiles.
  const rightHalf: Pos[] = [];
  for (let x = width - Math.floor(width / 2); x < width; x++) for (let y = 0; y < height; y++) rightHalf.push({ x, y });
  const taken = new Set<string>();
  const enemyCount = tiles <= 15 ? 2 : tiles <= 28 ? 3 : 4;
  for (let slot = 0; slot < enemyCount; slot++) {
    const lineId = rng.pick(pool);
    const line = getCritterLine(lineId);
    if (!line) throw new Error(`Biome pool has an unknown critter line: ${lineId}`);
    const free = rightHalf.filter((p) => !taken.has(posKey(p)));
    const preferred = free.filter((p) => isOptimalTile(line.optimalTile, p, width, height));
    const pos = rng.pick(preferred.length > 0 ? preferred : free);
    taken.add(posKey(pos));
    units.push(createUnit({ id: `e:${slot + 1}`, side: "enemy", slot, line: lineId, level, pos }));
  }

  // Sometimes one rock in the middle column.
  const obstacles: Obstacle[] = [];
  if (rng.chance(0.5)) {
    const column = Math.floor((width - 1) / 2);
    const spots = Array.from({ length: height }, (_, y) => ({ x: column, y })).filter((p) => !taken.has(posKey(p)));
    if (spots.length > 0) obstacles.push({ ...rng.pick(spots), rounds: null });
  }

  return {
    width,
    height,
    obstacles,
    units,
    phase: "placement",
    round: 0,
    mana: config.combat.maxMana,
    maxMana: config.combat.maxMana,
    order: [],
    turnIndex: 0,
    hasMoved: false,
    intents: [],
    rngState: rng.state,
  };
}
