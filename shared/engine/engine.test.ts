import { describe, expect, it } from "vitest";
import { config, critters, getCritterLine, typeDefs } from "../gameData";
import { runSaveSchema, credentialsSchema } from "../schemas";
import type { CritterLine } from "../types";
import { Rng, seedToState } from "./rng";
import { createRun, teamCost, validateStarterTeam } from "./run/newRun";
import { computeStats, stageForLevel, xpToNextLevel } from "./stats";

const line = (id: string): CritterLine => {
  const found = getCritterLine(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe("rng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = Rng.fromSeed("forest");
    const b = Rng.fromSeed("forest");
    expect(Array.from({ length: 20 }, () => a.float())).toEqual(Array.from({ length: 20 }, () => b.float()));
  });

  it("gives different sequences for different seeds", () => {
    expect(seedToState("a")).not.toBe(seedToState("b"));
  });

  it("resumes from a saved state", () => {
    const a = Rng.fromSeed("save-me");
    for (let i = 0; i < 7; i++) a.float();
    const resumed = new Rng(a.state);
    expect(resumed.float()).toBe(a.float());
    expect(resumed.int(1, 100)).toBe(a.int(1, 100));
  });

  it("keeps values in range", () => {
    const rng = Rng.fromSeed("ranges");
    for (let i = 0; i < 2000; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("reaches both ends of an int range", () => {
    const rng = Rng.fromSeed("ends");
    const seen = new Set(Array.from({ length: 500 }, () => rng.int(0, 3)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("shuffles without losing items and never picks zero weights", () => {
    const rng = Rng.fromSeed("shuffle");
    const items = [1, 2, 3, 4, 5, 6];
    expect(rng.shuffle(items).sort()).toEqual(items);
    for (let i = 0; i < 200; i++) {
      expect(rng.weighted([{ item: "no", weight: 0 }, { item: "yes", weight: 3 }])).toBe("yes");
    }
  });
});

describe("game data", () => {
  it("has 20 critter lines with unique line and stage IDs", () => {
    expect(critters).toHaveLength(20);
    expect(new Set(critters.map((c) => c.line)).size).toBe(20);
    const stageIds = critters.flatMap((c) => c.stages.map((s) => s.id));
    expect(new Set(stageIds).size).toBe(stageIds.length);
  });

  it("gives every critter 1–2 known types, 4 moves and a final stage", () => {
    const known = new Set(typeDefs.map((t) => t.id));
    for (const c of critters) {
      expect(c.types.length).toBeGreaterThanOrEqual(1);
      expect(c.types.length).toBeLessThanOrEqual(2);
      for (const t of c.types) expect(known.has(t)).toBe(true);
      expect(c.moves).toHaveLength(4);
      expect(c.stages.at(-1)?.evolveAt).toBeNull();
      expect(c.stages[0]?.id).toBe(c.line);
    }
  });

  it("lets a new account afford all three default starters", () => {
    const cost = teamCost({ active: config.starter.defaultUnlocks, bench: [] });
    expect(cost).toBe(9);
    expect(cost).toBeLessThanOrEqual(config.starter.pointBudget);
  });

  it("has a consistent type chart, with Gloom and Lume strong against each other", () => {
    const strong = (a: string, b: string) => typeDefs.find((t) => t.id === a)?.strongAgainst.includes(b as never);
    const resists = (attacker: string, defender: string) =>
      typeDefs.find((t) => t.id === attacker)?.resistedBy.includes(defender as never);
    expect(strong("Gloom", "Lume")).toBe(true);
    expect(strong("Lume", "Gloom")).toBe(true);
    for (const attacker of typeDefs) {
      for (const defender of typeDefs) {
        // No matchup is both strong and resisted.
        expect(strong(attacker.id, defender.id) && resists(attacker.id, defender.id)).toBeFalsy();
        // "Resisted by X" means X is strong against the attacker.
        if (resists(attacker.id, defender.id)) expect(strong(defender.id, attacker.id)).toBe(true);
      }
    }
  });
});

describe("stats", () => {
  it("uses the role template at stage 1, level 1", () => {
    expect(computeStats(line("emberkit"), "emberkit", 1)).toEqual({ hp: 40, atk: 13, def: 7, spd: 7, mov: 3 });
  });

  it("scales HP/ATK/DEF with level but not SPD/MOV", () => {
    // 1 + 0.06 × 4 = 1.24
    expect(computeStats(line("sproutle"), "sproutle", 5)).toEqual({ hp: 74, atk: 10, def: 15, spd: 4, mov: 2 });
  });

  it("applies evolution multipliers and +1 SPD per stage", () => {
    expect(computeStats(line("emberkit"), "cindervix", 1)).toEqual({ hp: 52, atk: 17, def: 9, spd: 8, mov: 3 });
    expect(computeStats(line("emberkit"), "pyrovulp", 1)).toEqual({ hp: 64, atk: 21, def: 11, spd: 9, mov: 3 });
  });

  it("rejects a stage from another line", () => {
    expect(() => computeStats(line("emberkit"), "brookle", 1)).toThrow();
  });

  it("picks the highest stage a level allows", () => {
    expect(stageForLevel(line("emberkit"), 7)).toBe("emberkit");
    expect(stageForLevel(line("emberkit"), 16)).toBe("cindervix");
    expect(stageForLevel(line("emberkit"), 40)).toBe("pyrovulp");
    expect(stageForLevel(line("wisplet"), 50)).toBe("wisplet");
  });

  it("needs 20 × level XP per level", () => {
    expect(xpToNextLevel(5)).toBe(100);
  });
});

describe("new run", () => {
  const unlocked = ["emberkit", "dewdle", "sproutle"];

  it("validates starter teams", () => {
    expect(validateStarterTeam({ active: [], bench: [] }, unlocked)).toBe("empty");
    expect(validateStarterTeam({ active: ["emberkit"], bench: [] }, unlocked)).toBeNull();
    expect(validateStarterTeam({ active: ["emberkit", "emberkit"], bench: [] }, unlocked)).toBe("duplicate");
    expect(validateStarterTeam({ active: ["wisplet"], bench: [] }, unlocked)).toBe("locked");
    expect(validateStarterTeam({ active: ["nope"], bench: [] }, unlocked)).toBe("unknownLine");
    expect(
      validateStarterTeam({ active: ["emberkit", "dewdle", "sproutle"], bench: ["pebbun"] }, [...unlocked, "pebbun"]),
    ).toBe("overBudget");
    expect(
      validateStarterTeam({ active: ["emberkit", "dewdle", "sproutle", "pebbun"], bench: [] }, [...unlocked, "pebbun"]),
    ).toBe("tooManyActive");
  });

  it("creates a valid save with full-HP level-5 critters", () => {
    const run = createRun("seed-1", { active: ["emberkit", "dewdle"], bench: ["sproutle"] });
    expect(runSaveSchema.safeParse(run).success).toBe(true);
    expect(run.floor).toBe(1);
    expect(run.biomeId).toBe("meadow");
    expect(run.rngState).toBe(seedToState("seed-1"));
    expect(run.potions).toEqual([null, null, null]);
    expect(run.team.active.map((c) => c.uid)).toEqual(["c1", "c2"]);
    expect(run.team.bench[0]).toEqual({ uid: "c3", line: "sproutle", stageId: "sproutle", level: 5, xp: 0, hp: 74 });
  });
});

describe("schemas", () => {
  it("accepts valid credentials and rejects bad ones", () => {
    expect(credentialsSchema.safeParse({ username: "Druid_01", password: "longenough" }).success).toBe(true);
    expect(credentialsSchema.safeParse({ username: "ab", password: "longenough" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ username: "bad name!", password: "longenough" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ username: "Druid_01", password: "short" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ username: "Druid_01", password: "x".repeat(73) }).success).toBe(false);
  });
});
