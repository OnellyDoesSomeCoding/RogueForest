// Status effects (TECH_DESIGN §7.7). Durations count the holder's own turns.
import { getStatus } from "../../gameData";
import type { StatusId } from "../../types";
import type { CombatEvent, CombatState, CombatUnit } from "./types";

export function hasStatus(unit: CombatUnit, id: StatusId): boolean {
  return unit.statuses.some((s) => s.id === id);
}

const sum = (unit: CombatUnit, field: "mov" | "spd") => unit.statuses.reduce((total, s) => total + (getStatus(s.id)[field] ?? 0), 0);
const product = (unit: CombatUnit, field: "damageDealt" | "damageTaken") => unit.statuses.reduce((total, s) => total * (getStatus(s.id)[field] ?? 1), 1);

/** SPD after Slow and Haste. Turn order uses this when a round starts. */
export function effectiveSpd(unit: CombatUnit): number {
  return Math.max(0, unit.stats.spd + sum(unit, "spd"));
}

/** MOV after Slow and Haste. Root means 0. */
export function effectiveMov(unit: CombatUnit): number {
  if (hasStatus(unit, "Root")) return 0;
  return Math.max(0, unit.stats.mov + sum(unit, "mov"));
}

/** Multiplier on damage this unit deals (Weak, Empower). */
export function damageDealtMultiplier(unit: CombatUnit): number {
  return product(unit, "damageDealt");
}

/** Multiplier on damage this unit takes (Guard). */
export function damageTakenMultiplier(unit: CombatUnit, ignoreGuard: boolean): number {
  return ignoreGuard ? 1 : product(unit, "damageTaken");
}

/** Adds a status, or refreshes its duration if the unit already has it. Statuses never stack. */
export function applyStatus(state: CombatState, unit: CombatUnit, id: StatusId, events: CombatEvent[]): void {
  if (unit.fainted) return;
  const turns = getStatus(id).turns;
  const existing = unit.statuses.find((s) => s.id === id);
  if (existing) {
    existing.turns = turns;
    existing.armed = false;
  } else {
    unit.statuses.push({ id, turns, armed: false });
  }
  events.push({ type: "statusApplied", unitId: unit.id, status: id, turns });

  // A stunned enemy loses its turn, so its plan for this round is cancelled right away.
  if (id === "Stun" && state.intents.some((i) => i.unitId === unit.id)) {
    state.intents = state.intents.filter((i) => i.unitId !== unit.id);
    events.push({ type: "intentCancelled", unitId: unit.id });
  }
}

export function removeStatus(unit: CombatUnit, id: StatusId, reason: "expired" | "cleansed" | "used", events: CombatEvent[]): void {
  if (!hasStatus(unit, id)) return;
  unit.statuses = unit.statuses.filter((s) => s.id !== id);
  events.push({ type: "statusRemoved", unitId: unit.id, status: id, reason });
}

/** Removes every bad status (Radiance). */
export function cleanse(unit: CombatUnit, events: CombatEvent[]): void {
  for (const s of [...unit.statuses]) if (getStatus(s.id).kind === "bad") removeStatus(unit, s.id, "cleansed", events);
}

/** Start of the holder's turn: every status it has now will tick down at the end of this turn. */
export function armStatuses(unit: CombatUnit): void {
  for (const s of unit.statuses) s.armed = true;
}

/** End of the holder's turn: armed statuses lose a turn and expire at 0. */
export function tickStatuses(unit: CombatUnit, events: CombatEvent[]): void {
  for (const s of [...unit.statuses]) {
    if (!s.armed) continue;
    s.turns -= 1;
    if (s.turns <= 0) removeStatus(unit, s.id, "expired", events);
  }
}
