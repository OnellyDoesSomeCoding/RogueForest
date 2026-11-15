// Combat state, actions and events. The engine is pure: state + action -> new state + events.
import type { OptimalTile, Stats, TypeId } from "../../types";

export interface Pos {
  x: number;
  y: number;
}

export type Side = "player" | "enemy";

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
  /** Full stats at this stage and level. `stats.hp` is max HP. */
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
}

export type CombatPhase = "placement" | "battle" | "won" | "lost";

export interface CombatState {
  width: number;
  height: number;
  obstacles: Pos[];
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
  | { type: "turnStarted"; unitId: string; onOptimalTile: boolean }
  | { type: "moved"; unitId: string; path: Pos[] }
  | { type: "moveUsed"; unitId: string; moveId: string; tiles: Pos[]; mana: number }
  | { type: "damaged"; unitId: string; sourceId: string; amount: number; hp: number; typeMult: number }
  | { type: "healed"; unitId: string; amount: number; hp: number }
  | { type: "fainted"; unitId: string }
  | { type: "turnEnded"; unitId: string }
  | { type: "battleEnded"; result: "won" | "lost" };

export interface CombatResult {
  state: CombatState;
  events: CombatEvent[];
}

/** Thrown when an action breaks the rules (wrong phase, out of range, not enough mana, ...). */
export class CombatError extends Error {}
