// Shared interfaces used by the client, the server and the engine.

export type TypeId = "Ember" | "Dew" | "Clay" | "Zephyr" | "Gloom" | "Lume" | "Iron" | "Flora";
export type Role = "Tank" | "Striker" | "Support" | "Control" | "Skirmisher";
export type OptimalTile = "front" | "back" | "flank";

export interface TypeDef {
  id: TypeId;
  label: string;
  color: string;
  strongAgainst: TypeId[];
  resistedBy: TypeId[];
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  mov: number;
}

export interface CritterStage {
  id: string;
  name: string;
  /** Level at which this stage evolves into the next one. null = final stage. */
  evolveAt: number | null;
}

export interface CritterLine {
  line: string;
  types: TypeId[];
  role: Role;
  optimalTile: OptimalTile;
  cost: number;
  moves: string[];
  unlockHint: string;
  stages: CritterStage[];
  statsOverride?: Partial<Stats>;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
}

export interface OwnedCritter {
  uid: string;
  line: string;
  stageId: string;
  level: number;
  xp: number;
  /** 0 = fainted. */
  hp: number;
}

/** Filled in by map generation (M4). */
export interface MapNode {
  id: string;
  floor: number;
  column: number;
  room: "normal" | "elite" | "boss" | "shop" | "rest" | "event";
  next: string[];
}

export interface RunSave {
  saveVersion: 1;
  seed: string;
  rngState: number;
  /** 1–50 */
  floor: number;
  /** 1–5 */
  act: number;
  biomeId: string;
  biomeHistory: string[];
  /** Map of the current act. */
  map: MapNode[];
  currentNodeId: string | null;
  team: { active: OwnedCritter[]; bench: OwnedCritter[] };
  acorns: number;
  /** One entry per potion slot. */
  potions: (string | null)[];
  relics: string[];
  druidPowers: string[];
  pendingEggs?: { hatchInRooms: number }[];
}

// ---- API payloads ----

export interface MeResponse {
  username: string;
  unlocks: string[];
  badges: string[];
  hasSave: boolean;
}

export interface RunResponse {
  saveVersion: number;
  state: RunSave;
  updatedAt: number;
}
