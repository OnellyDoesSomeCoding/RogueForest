// Which tiles a move can be aimed at, and which units it hits (TECH_DESIGN §8.1).
import type { Move } from "../../types";
import { DIRS, inBounds, isObstacle, manhattan, samePos, unitAt } from "./grid";
import type { CombatState, CombatUnit, Pos } from "./types";

export interface TargetOption {
  /** The tile to aim at. For lines and rows this is the first tile in that direction. */
  target: Pos;
  /** Every tile the move covers when aimed there. */
  tiles: Pos[];
}

/** Effects the engine applies today. Statuses, push/pull and obstacles arrive with M3. */
const SUPPORTED_EFFECTS = new Set(["heal", "lifesteal", "pierce"]);

/** False for moves that would do nothing yet (their only purpose is an effect from a later milestone). */
export function isMoveSupported(move: Move): boolean {
  return move.power > 0 || move.effects.some((e) => SUPPORTED_EFFECTS.has(e.type));
}

const hasEffect = (move: Move, type: string) => move.effects.some((e) => e.type === type);

/**
 * The unit on a tile, pretending `mover` stands on `origin` instead of its real tile.
 * Lets the enemy AI ask "what would I hit from over there?" without changing state.
 */
function occupant(state: CombatState, p: Pos, mover: CombatUnit, origin: Pos): CombatUnit | undefined {
  if (samePos(p, origin)) return mover;
  const unit = unitAt(state, p);
  return unit && unit.id !== mover.id ? unit : undefined;
}

function shapeTiles(state: CombatState, center: Pos, offsets: readonly Pos[]): Pos[] {
  return offsets.map((o) => ({ x: center.x + o.x, y: center.y + o.y })).filter((p) => inBounds(state, p));
}

const PLUS: Pos[] = [{ x: 0, y: 0 }, ...DIRS];
const SQUARE3: Pos[] = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y })));
const AROUND: Pos[] = SQUARE3.filter((p) => p.x !== 0 || p.y !== 0);

/** All the ways `unit` could aim `move` from `origin`. Does not check whether anything would be hit. */
export function targetOptions(state: CombatState, unit: CombatUnit, move: Move, origin: Pos | null = unit.pos): TargetOption[] {
  if (!origin) return [];
  const [min, max] = move.range;

  switch (move.shape) {
    case "self":
      return [{ target: origin, tiles: [origin] }];

    case "around":
      return [{ target: origin, tiles: shapeTiles(state, origin, AROUND) }];

    case "line":
    case "row": {
      // A straight line in one of 4 directions. Stops at obstacles. A line also stops at the
      // first unit it meets, unless it pierces. A row always covers every tile to the grid edge.
      const pierces = move.shape === "row" || hasEffect(move, "pierce");
      const length = move.shape === "row" ? Math.max(state.width, state.height) : max;
      const options: TargetOption[] = [];
      for (const d of DIRS) {
        const tiles: Pos[] = [];
        for (let dist = 1; dist <= length; dist++) {
          const p = { x: origin.x + d.x * dist, y: origin.y + d.y * dist };
          if (!inBounds(state, p) || isObstacle(state, p)) break;
          if (dist >= min) tiles.push(p);
          if (!pierces && occupant(state, p, unit, origin)) break;
        }
        const first = tiles[0];
        if (first) options.push({ target: first, tiles });
      }
      return options;
    }

    case "single":
    case "plus":
    case "square3": {
      const offsets = move.shape === "plus" ? PLUS : move.shape === "square3" ? SQUARE3 : [{ x: 0, y: 0 }];
      const options: TargetOption[] = [];
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const target = { x, y };
          const dist = manhattan(origin, target);
          if (dist < min || dist > max || isObstacle(state, target)) continue;
          options.push({ target, tiles: shapeTiles(state, target, offsets) });
        }
      }
      return options;
    }
  }
}

/** Units a move would affect when aimed with `option`: enemies for attacks, allies (and the user) for support. */
export function affectedUnits(
  state: CombatState,
  unit: CombatUnit,
  move: Move,
  option: TargetOption,
  origin: Pos | null = unit.pos,
): CombatUnit[] {
  if (!origin) return [];
  const hit: CombatUnit[] = [];
  for (const tile of option.tiles) {
    const other = occupant(state, tile, unit, origin);
    if (!other || hit.includes(other)) continue;
    const wanted =
      move.target === "enemy" ? other.side !== unit.side : move.target === "ally" ? other.side === unit.side : move.target === "self" ? other.id === unit.id : false;
    if (wanted) hit.push(other);
  }
  return hit;
}

/** Aiming options that would affect at least one unit. These are the ones a player may pick. */
export function validOptions(state: CombatState, unit: CombatUnit, move: Move): TargetOption[] {
  return targetOptions(state, unit, move).filter((o) => affectedUnits(state, unit, move, o).length > 0);
}
