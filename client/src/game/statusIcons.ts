// Placeholder icons for statuses that the art bundle does not have yet (Root, Slow, Evade, Empower).
// Drawn as 16×16 pixel art in the same chunky, outlined style as the bundle's icons.
// When a real file exists at assets/icons/status_<icon>.png, it is used instead.
import { statuses } from "@shared/gameData";
import * as Phaser from "phaser";
import { statusIconKey } from "./board";

const PALETTE: Record<string, number> = {
  "0": 0x1b1420, // outline
  r: 0xe0483f,
  R: 0xff8a7d,
  D: 0x8f1f2a,
  f: 0x7a4f26,
  F: 0xa8743c,
  b: 0x7a4f26,
  B: 0xa8743c,
  s: 0xf0cf45,
  S: 0xc99a2e,
  g: 0x3f9c3f,
  G: 0x8be07b,
  w: 0xffffff,
  c: 0xbfe9ff,
  C: 0x7fc8f0,
  l: 0xcfe8f0,
};

const ART: Record<string, string[]> = {
  // A red arrow pointing up: the opposite of the bundle's grey "weak" arrow.
  empower: [
    "................",
    ".......00.......",
    "......0RR0......",
    ".....0RRrr0.....",
    "....0RRrrrr0....",
    "...0RRrrrrrr0...",
    "..0Rrrrrrrrrr0..",
    "..0000Rrrr0000..",
    ".....0Rrrr0.....",
    ".....0Rrrr0.....",
    ".....0Rrrr0.....",
    ".....0RrrD0.....",
    ".....0rrDD0.....",
    ".....000000.....",
    "................",
    "................",
  ],
  // An hourglass.
  slow: [
    "................",
    "...0000000000...",
    "...0FFFFFFFF0...",
    "...0000000000...",
    "....0lssssl0....",
    ".....0lssl0.....",
    "......0sS0......",
    "......0s0.......",
    "......0ls0......",
    ".....0llsl0.....",
    "....0lssssl0....",
    "....0sssssS0....",
    "...0000000000...",
    "...0FFFFFFFF0...",
    "...0000000000...",
    "................",
  ],
  // A sprout whose roots spread into the ground.
  root: [
    "................",
    "......00........",
    ".....0GG0.00....",
    ".....0Gg00GG0...",
    "......0g0gg0....",
    ".......0bb0.....",
    ".......0Bb0.....",
    ".......0Bb0.....",
    "......0BBbb0....",
    ".....0Bb00bb0...",
    "....0Bb0..0bb0..",
    "...0Bb0.00.0bb0.",
    "..0bb0.0bb0.0bb0",
    "..000..0000..000",
    "................",
    "................",
  ],
  // A curved arrow: dodging out of the way.
  evade: [
    "................",
    "................",
    "....000000......",
    "...0cwwwwc0.....",
    "..0cw0000wc0....",
    "..0w0....0wc0...",
    "..0w0.....0w0...",
    "..0C0.....0w0...",
    "..0C0...000w000.",
    "..0C0....0www0..",
    "...0......0w0...",
    "...........0....",
    "................",
    "................",
    "................",
    "................",
  ],
};

/** Creates a texture for every status icon that did not load from a file. */
export function makeMissingStatusIcons(scene: Phaser.Scene): void {
  for (const def of statuses) {
    const key = statusIconKey(def.id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    const art = ART[def.icon];
    if (art) {
      art.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          const color = PALETTE[ch];
          if (color !== undefined) g.fillStyle(color, 1).fillRect(x, y, 1, 1);
        });
      });
    } else {
      // No art at all: a plain diamond, red for bad statuses and green for good ones.
      const color = def.kind === "bad" ? 0xe0483f : 0x6cc24f;
      g.fillStyle(0x1b1420, 1).fillTriangle(8, 1, 15, 8, 1, 8).fillTriangle(1, 8, 15, 8, 8, 15);
      g.fillStyle(color, 1).fillTriangle(8, 3, 13, 8, 3, 8).fillTriangle(3, 8, 13, 8, 8, 13);
    }
    g.generateTexture(key, 16, 16);
    g.destroy();
  }
}
