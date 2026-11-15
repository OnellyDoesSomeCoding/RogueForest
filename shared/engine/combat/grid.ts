// Grid helpers: positions, occupancy, movement and optimal tiles (TECH_DESIGN §7.1, §7.2).
import type { OptimalTile } from "../../types";
import type { CombatState, CombatUnit, Pos } from "./types";

export const DIRS: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const posKey = (p: Pos): string => `${p.x},${p.y}`;
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;
export const manhattan = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function inBounds(state: CombatState, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < state.width && p.y < state.height;
}

export function isObstacle(state: CombatState, p: Pos): boolean {
  return state.obstacles.some((o) => samePos(o, p));
}

/** The unit standing on a tile, if any. Fainted units are off the grid. */
export function unitAt(state: CombatState, p: Pos): CombatUnit | undefined {
  return state.units.find((u) => u.pos !== null && !u.fainted && samePos(u.pos, p));
}

export function isFree(state: CombatState, p: Pos): boolean {
  return inBounds(state, p) && !isObstacle(state, p) && !unitAt(state, p);
}

export function getUnit(state: CombatState, id: string): CombatUnit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown unit: ${id}`);
  return unit;
}

export function isAlive(unit: CombatUnit): boolean {
  return !unit.fainted && unit.pos !== null;
}

/**
 * Tiles a unit can walk to this turn: up to MOV steps, 4-directional,
 * never through units or obstacles. Maps tile key -> path (start tile excluded).
 */
export function reachableTiles(state: CombatState, unit: CombatUnit): Map<string, Pos[]> {
  const out = new Map<string, Pos[]>();
  if (!unit.pos) return out;
  let frontier: { pos: Pos; path: Pos[] }[] = [{ pos: unit.pos, path: [] }];
  const seen = new Set([posKey(unit.pos)]);
  for (let step = 0; step < unit.stats.mov; step++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const d of DIRS) {
        const pos = { x: node.pos.x + d.x, y: node.pos.y + d.y };
        const k = posKey(pos);
        if (seen.has(k) || !isFree(state, pos)) continue;
        seen.add(k);
        const path = [...node.path, pos];
        out.set(k, path);
        next.push({ pos, path });
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Optimal tiles (bonus zones). Each side's half is ceil(width / 2) columns, so on odd
 * widths the middle column belongs to both halves. Zones are the same for both sides.
 * - front: the 2 columns of either half nearest the grid center
 * - back: the 2 columns at the far left or far right edge
 * - flank: top or bottom row
 */
export function isOptimalTile(kind: OptimalTile, pos: Pos, width: number, height: number): boolean {
  if (kind === "flank") return pos.y === 0 || pos.y === height - 1;
  if (kind === "back") return pos.x <= 1 || pos.x >= width - 2;
  const half = Math.ceil(width / 2);
  const leftFront = pos.x >= half - 2 && pos.x <= half - 1;
  const rightFront = pos.x >= width - half && pos.x <= width - half + 1;
  return leftFront || rightFront;
}
