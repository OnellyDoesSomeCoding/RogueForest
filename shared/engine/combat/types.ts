// Combat state, actions and events. The engine is pure: state + action -> new state + events.
import type { OptimalTile, Stats, StatusId, TypeId } from "../../types";

export interface Pos {
  x: number;
  y: number;
}

export type Side = "player" | "enemy";

export interface StatusInstance {
  id: StatusId;
  /** Own turns left. */
  turns: number;
  /**
   * Set at the start of the holder's turn. Only armed statuses tick down at the end of that turn,
   * so a status applied during the holder's own turn lasts through its next turn.
   */
  armed: boolean;
}

export interface CombatUnit {
  /** "p:<critter uid>" for player critters, "e:<n>" for enemies. */
  id: string;
  side: Side;
  /** Index within its side. Breaks SPD ties. */
  slot: number;
  line: string;
  stageId: string;
  name: string;
  level: number;
  types: TypeId[];
  optimalTile: OptimalTile;
  /** Full stats at this stage and level, before statuses. `stats.hp` is max HP. */
  stats: Stats;
  hp: number;
  /** null = not placed yet, or fainted (removed from the grid). */
  pos: Pos | null;
  fainted: boolean;
  moves: string[];
  /** Move ID -> own turns left before reuse. Missing or 0 = ready. */
  cooldowns: Record<string, number>;
  /** Checked at the start of each of this unit's turns. Gives the optimal-tile damage bonus. */
  onOptimalTile: boolean;
  statuses: StatusInstance[];
}

export interface Obstacle extends Pos {
  /** Rounds left before it crumbles. null (or missing) = permanent. */
  rounds?: number | null;
}

/** What an enemy declared at the start of the round (TECH_DESIGN §7.4). */
export interface Intent {
  unitId: string;
  /** Where it will walk. Its current tile if it stays. */
  dest: Pos;
  /** null = it only moves. */
  moveId: string | null;
  target: Pos | null;
  /** Tiles the move will cover. Hostile moves only ever hit these tiles. */
  tiles: Pos[];
  /** True for attacks on the other side (shown in red). False for heals and buffs. */
  hostile: boolean;
}

export type CombatPhase = "placement" | "battle" | "won" | "lost";

export interface CombatState {
  width: number;
  height: number;
  obstacles: Obstacle[];
  units: CombatUnit[];
  phase: CombatPhase;
  round: number;
  mana: number;
  maxMana: number;
  /** Unit IDs in turn order for the current round. */
  order: string[];
  /** Index into `order` of the unit whose turn it is. */
  turnIndex: number;
  /** Whether the current unit has already moved this turn. */
  hasMoved: boolean;
  /** Enemy plans for this round. An enemy's intent is removed once it acts. */
  intents: Intent[];
  rngState: number;
}

export type CombatAction =
  | { type: "place"; unitId: string; pos: Pos }
  | { type: "unplace"; unitId: string }
  | { type: "start" }
  | { type: "move"; to: Pos }
  | { type: "useMove"; moveId: string; target: Pos }
  | { type: "endTurn" };

export type CombatEvent =
  | { type: "placed"; unitId: string; pos: Pos | null }
  | { type: "battleStarted" }
  | { type: "roundStarted"; round: number; mana: number; order: string[] }
  | { type: "intentsDeclared"; intents: Intent[] }
  | { type: "intentCancelled"; unitId: string }
  | { type: "turnStarted"; unitId: string; onOptimalTile: boolean }
  | { type: "turnSkipped"; unitId: string; reason: StatusId }
  | { type: "moved"; unitId: string; path: Pos[] }
  | { type: "moveUsed"; unitId: string; moveId: string; tiles: Pos[]; mana: number }
  | { type: "attackFizzled"; unitId: string; moveId: string }
  | { type: "damaged"; unitId: string; sourceId: string | null; amount: number; hp: number; typeMult: number; cause?: "Burn" | "collision" }
  | { type: "healed"; unitId: string; amount: number; hp: number; cause?: "Regen" }
  | { type: "evaded"; unitId: string; sourceId: string }
  | { type: "statusApplied"; unitId: string; status: StatusId; turns: number }
  | { type: "statusRemoved"; unitId: string; status: StatusId; reason: "expired" | "cleansed" | "used" }
  | { type: "forcedMove"; unitId: string; path: Pos[]; kind: "push" | "pull" }
  | { type: "obstaclePlaced"; pos: Pos; rounds: number }
  | { type: "obstacleRemoved"; pos: Pos }
  | { type: "fainted"; unitId: string }
  | { type: "turnEnded"; unitId: string }
  | { type: "battleEnded"; result: "won" | "lost" };

export interface CombatResult {
  state: CombatState;
  events: CombatEvent[];
}

/** Thrown when an action breaks the rules (wrong phase, out of range, not enough mana, ...). */
export class CombatError extends Error {}
