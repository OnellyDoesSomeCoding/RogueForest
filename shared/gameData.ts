// Typed access to the JSON game data in shared/data.
import configJson from "./data/config.json";
import crittersJson from "./data/critters.json";
import typesJson from "./data/types.json";
import badgesJson from "./data/badges.json";
import type { BadgeDef, CritterLine, CritterStage, TypeDef, TypeId } from "./types";

export const config = configJson;

export const critters = crittersJson.critters as CritterLine[];
export const typeDefs = typesJson.types as TypeDef[];
export const badges = badgesJson.badges as BadgeDef[];

const critterByLine = new Map(critters.map((c) => [c.line, c]));
const typeById = new Map(typeDefs.map((t) => [t.id, t]));
const badgeById = new Map(badges.map((b) => [b.id, b]));

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
