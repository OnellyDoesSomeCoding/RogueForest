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

export type MoveShape = "single" | "line" | "plus" | "square3" | "around" | "row" | "self";
export type MoveTarget = "enemy" | "ally" | "tile" | "self";

export type Effect =
  | { type: "status"; status: string }
  | { type: "push"; distance: number }
  | { type: "pull"; distance: number }
  | { type: "pullToCenter"; distance: number }
  | { type: "heal"; percent: number }
  | { type: "lifesteal"; percent: number }
  | { type: "obstacle"; rounds: number }
  | { type: "pierce" }
  | { type: "ignoreGuard" }
  | { type: "cleanse" }
  | { type: "includeSelf" };

export interface Move {
  id: string;
  name: string;
  type: TypeId | "Neutral";
  /** 0–3 */
  mana: number;
  /** Own turns before reuse. 0 = every turn. */
  cooldown: number;
  /** 0 for non-damage moves. */
  power: number;
  /** Manhattan distance from the user to the target tile: [min, max]. */
  range: [number, number];
  shape: MoveShape;
  target: MoveTarget;
  effects: Effect[];
}

export type StatusId = "Burn" | "Root" | "Slow" | "Stun" | "Weak" | "Guard" | "Regen" | "Evade" | "Empower" | "Haste";

export interface StatusDef {
  id: StatusId;
  kind: "good" | "bad";
  /** Default duration, in the holder's own turns. */
  turns: number;
  /** Icon file name: assets/icons/status_<icon>.png */
  icon: string;
  /** Burn and Regen: % of max HP per turn. */
  percent?: number;
  /** Multiplier on damage this unit deals (Weak, Empower). */
  damageDealt?: number;
  /** Multiplier on damage this unit takes (Guard). */
  damageTaken?: number;
  mov?: number;
  spd?: number;
  text: string;
}

export interface BiomeDef {
  id: string;
  name: string;
  types: TypeId[];
  /** Critter line IDs that appear as enemies and shop stock. */
  pool: string[];
  acts: number[];
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
