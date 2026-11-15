// Typed access to the JSON game data in shared/data.
import configJson from "./data/config.json";
import crittersJson from "./data/critters.json";
import typesJson from "./data/types.json";
import badgesJson from "./data/badges.json";
import biomesJson from "./data/biomes.json";
import movesJson from "./data/moves.json";
import statusesJson from "./data/statuses.json";
import type { BadgeDef, BiomeDef, CritterLine, CritterStage, Move, StatusDef, StatusId, TypeDef, TypeId } from "./types";

export const config = configJson;

export const critters = crittersJson.critters as CritterLine[];
export const typeDefs = typesJson.types as TypeDef[];
export const badges = badgesJson.badges as BadgeDef[];
export const moves = movesJson.moves as Move[];
export const biomes = biomesJson.biomes as BiomeDef[];
export const statuses = statusesJson.statuses as StatusDef[];

const critterByLine = new Map(critters.map((c) => [c.line, c]));
const typeById = new Map(typeDefs.map((t) => [t.id, t]));
const badgeById = new Map(badges.map((b) => [b.id, b]));
const moveById = new Map(moves.map((m) => [m.id, m]));
const biomeById = new Map(biomes.map((b) => [b.id, b]));
const statusById = new Map(statuses.map((s) => [s.id, s]));

export function getStatus(id: StatusId): StatusDef {
  const status = statusById.get(id);
  if (!status) throw new Error(`Unknown status: ${id}`);
  return status;
}

export function getMove(id: string): Move {
  const move = moveById.get(id);
  if (!move) throw new Error(`Unknown move: ${id}`);
  return move;
}

export function getBiome(id: string): BiomeDef {
  const biome = biomeById.get(id);
  if (!biome) throw new Error(`Unknown biome: ${id}`);
  return biome;
}

export function getCritterLine(line: string): CritterLine | undefined {
  return critterByLine.get(line);
}

export function isCritterLine(line: string): boolean {
  return critterByLine.has(line);
}

export function isBadgeId(id: string): boolean {
  return badgeById.has(id);
}

export function getType(id: TypeId): TypeDef {
  const def = typeById.get(id);
  if (!def) throw new Error(`Unknown type: ${id}`);
  return def;
}

/** Index of a stage inside its line, or -1 if the stage is not part of the line. */
export function stageIndex(line: CritterLine, stageId: string): number {
  return line.stages.findIndex((s) => s.id === stageId);
}

export function firstStage(line: CritterLine): CritterStage {
  const stage = line.stages[0];
  if (!stage) throw new Error(`Critter line ${line.line} has no stages`);
  return stage;
}
