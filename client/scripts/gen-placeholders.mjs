// Generates placeholder pixel art for the home page (PNG files, no dependencies).
// Run with: npm run placeholders
// Replace the output files in client/public/assets/ with real art when it exists.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/assets");

// ---------- tiny toolkit ----------

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
const darken = (c, t) => mix(c, [0, 0, 0], t);
const lighten = (c, t) => mix(c, [255, 255, 255], t);

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  set(x, y, c, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a0 = this.data[i + 3] / 255;
    if (alpha >= 1 || a0 === 0) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = Math.max(this.data[i + 3], Math.round(alpha * 255));
      if (alpha < 1 && a0 === 0) this.data[i + 3] = Math.round(alpha * 255);
      return;
    }
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.round(this.data[i + k] * (1 - alpha) + c[k] * alpha);
  }
  rect(x, y, w, h, c, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, c, alpha);
  }
  ellipse(cx, cy, rx, ry, c, alpha = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, alpha);
      }
  }
  circle(cx, cy, r, c, alpha = 1) {
    this.ellipse(cx, cy, r, r, c, alpha);
  }
  line(x0, y0, x1, y1, c, { dash = 0, width = 1 } = {}) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      if (dash && Math.floor(i / dash) % 2 === 1) continue;
      const x = x0 + ((x1 - x0) * i) / (steps || 1);
      const y = y0 + ((y1 - y0) * i) / (steps || 1);
      this.rect(x - (width - 1) / 2, y - (width - 1) / 2, width, width, c);
    }
  }
  /** Triangle with a flat base: apex at (cx, top), base half-width hw at y = bottom. */
  tri(cx, top, bottom, hw, c) {
    const h = bottom - top;
    for (let y = 0; y <= h; y++) {
      const half = Math.round((y / h) * hw);
      this.rect(cx - half, top + y, half * 2 + 1, 1, c);
    }
  }
  save(file) {
    const { w, h, data } = this;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
    const chunk = (type, body) => {
      const head = Buffer.from(type, "ascii");
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(zlib.crc32(Buffer.concat([head, body])) >>> 0);
      return Buffer.concat([len, head, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr.set([8, 6, 0, 0, 0], 8);
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const target = path.join(OUT, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, png);
    console.log(`${file}  ${w}x${h}  ${(png.length / 1024).toFixed(1)} KB`);
  }
}

/** Vertical gradient in flat bands, with a checker dither between bands. */
function bandedSky(c, stops, bands, yEnd = c.h) {
  for (let y = 0; y < yEnd; y++) {
    const pos = (y / yEnd) * bands;
    const band = Math.floor(pos);
    const frac = pos - band;
    const colorAt = (b) => {
      const t = Math.min(1, b / (bands - 1)) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t));
      return mix(stops[i], stops[i + 1], t - i);
    };
    for (let x = 0; x < c.w; x++) {
      const next = frac > 0.7 && (x + y) % 2 === 0;
      c.set(x, y, colorAt(next ? band + 1 : band));
    }
  }
}

function pine(c, cx, baseY, h, color) {
  const trunkH = Math.max(2, Math.round(h * 0.12));
  const trunkW = Math.max(1, Math.round(h * 0.05));
  c.rect(cx - trunkW / 2, baseY - trunkH, trunkW, trunkH, darken(color, 0.3));
  const tiers = 4;
  const crown = h - trunkH;
  for (let t = 0; t < tiers; t++) {
    const top = baseY - trunkH - crown + (t * crown) / tiers * 0.82;
    const bottom = top + (crown / tiers) * 1.45;
    c.tri(cx, top, Math.min(bottom, baseY - trunkH + 1), ((t + 1.4) / (tiers + 0.4)) * h * 0.3, color);
  }
}

function bareTree(c, cx, baseY, h, color, rand) {
  const w = Math.max(2, Math.round(h * 0.07));
  c.rect(cx - w / 2, baseY - h, w, h, color);
  const branches = 5;
  for (let i = 0; i < branches; i++) {
    const y = baseY - h * (0.45 + (i / branches) * 0.5);
    const dir = i % 2 === 0 ? 1 : -1;
    const len = h * (0.18 + rand() * 0.2) * (1 - i / (branches * 1.6));
    c.line(cx, y, cx + dir * len, y - len * 0.8, color, { width: Math.max(1, w - 2) });
    c.line(cx + dir * len * 0.6, y - len * 0.48, cx + dir * len * 0.7, y - len * 1.1, color);
  }
}

function treeLine(c, { seed, baseY, minH, maxH, gap, color, kind = "pine", skip }) {
  const rand = rng(seed);
  for (let x = -10; x < c.w + 10; x += gap * (0.6 + rand() * 0.8)) {
    const h = minH + rand() * (maxH - minH);
    if (skip && skip(x)) continue;
    const y = baseY + rand() * 4;
    if (kind === "pine") pine(c, Math.round(x), Math.round(y), Math.round(h), color);
    else bareTree(c, Math.round(x), Math.round(y), Math.round(h), color, rand);
  }
}

function hills(c, baseY, amp, color, seed) {
  const rand = rng(seed);
  const p1 = rand() * 6;
  const p2 = rand() * 6;
  for (let x = 0; x < c.w; x++) {
    const y = baseY - amp * (0.5 + 0.35 * Math.sin(x / 47 + p1) + 0.15 * Math.sin(x / 13 + p2));
    c.rect(x, y, 1, c.h - y, color);
  }
}

/** A round placeholder critter. `look` adds ears, a leaf or a drop tip. */
function blob(c, cx, cy, r, color, { look = "plain", facing = 1, shadow = true } = {}) {
  const outline = darken(color, 0.55);
  if (shadow) c.ellipse(cx, cy + r, r * 0.9, r * 0.25, [0, 0, 0], 0.3);
  if (look === "fox" || look === "bat") {
    for (const side of [-1, 1]) {
      c.tri(cx + side * r * 0.55, cy - r * 1.55, cy - r * 0.5, r * 0.42, outline);
      c.tri(cx + side * r * 0.55, cy - r * 1.3, cy - r * 0.5, r * 0.26, look === "fox" ? lighten(color, 0.25) : color);
    }
  }
  if (look === "drop") {
    c.tri(cx, cy - r * 1.7, cy - r * 0.6, r * 0.6, outline);
    c.tri(cx, cy - r * 1.45, cy - r * 0.6, r * 0.42, color);
  }
  if (look === "leaf") {
    c.line(cx, cy - r, cx, cy - r * 1.5, outline, { width: 2 });
    c.ellipse(cx + r * 0.45, cy - r * 1.55, r * 0.5, r * 0.26, hex("#2f7d32"));
    c.ellipse(cx - r * 0.45, cy - r * 1.45, r * 0.42, r * 0.22, hex("#3f9c3f"));
  }
  if (look === "horn") {
    c.tri(cx, cy - r * 1.6, cy - r * 0.7, r * 0.3, lighten(color, 0.5));
  }
  c.circle(cx, cy, r + 1, outline);
  c.circle(cx, cy, r, color);
  c.ellipse(cx, cy + r * 0.35, r * 0.7, r * 0.5, lighten(color, 0.22));
  c.ellipse(cx - r * 0.35, cy - r * 0.5, r * 0.3, r * 0.18, lighten(color, 0.4));
  const eyeW = Math.max(2, Math.round(r * 0.2));
  const eyeH = Math.max(2, Math.round(r * 0.32));
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.36 + facing * r * 0.14 - eyeW / 2;
    const ey = cy - r * 0.15;
    c.rect(ex, ey, eyeW, eyeH, [20, 16, 24]);
    c.set(ex + (facing > 0 ? eyeW - 1 : 0), ey, [255, 255, 255]);
  }
}

function fireflies(c, seed, count, yMin, yMax, color) {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * c.w);
    const y = Math.round(yMin + rand() * (yMax - yMin));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.set(x + dx, y + dy, color, 0.3);
    c.set(x, y, lighten(color, 0.4));
  }
}

// ---------- images ----------

function hero() {
  const c = new Canvas(480, 270);
  bandedSky(c, [hex("#07131a"), hex("#0c2630"), hex("#14433f"), hex("#2f7355"), hex("#8fb86a")], 12, 215);
  const rand = rng(11);
  for (let i = 0; i < 90; i++) {
    const y = rand() * 120;
    c.set(rand() * 480, y, hex("#dfeedd"), 0.25 + rand() * 0.6 * (1 - y / 130));
  }
  // Moon with a soft glow.
  for (let r = 44; r > 26; r -= 6) c.circle(366, 62, r, hex("#f6f0c8"), 0.05);
  c.circle(366, 62, 24, hex("#f6f0c8"));
  c.circle(358, 54, 5, hex("#e2d9a8"));
  c.circle(374, 70, 4, hex("#e2d9a8"));
  c.circle(371, 51, 2, hex("#e2d9a8"));

  hills(c, 200, 46, hex("#1b4a45"), 3);
  treeLine(c, { seed: 21, baseY: 204, minH: 28, maxH: 46, gap: 16, color: hex("#17403b") });
  hills(c, 226, 22, hex("#12332f"), 5);
  treeLine(c, { seed: 22, baseY: 230, minH: 48, maxH: 84, gap: 30, color: hex("#0f2b28") });
  c.rect(0, 232, 480, 38, hex("#0b211f"));
  // Near trees frame the edges and leave the middle open for the title.
  treeLine(c, {
    seed: 23,
    baseY: 262,
    minH: 120,
    maxH: 190,
    gap: 44,
    color: hex("#071615"),
    skip: (x) => x > 120 && x < 360,
  });
  c.rect(0, 256, 480, 14, hex("#071615"));
  const tuft = rng(31);
  for (let x = 0; x < 480; x += 3) if (tuft() > 0.45) c.rect(x, 254 - Math.round(tuft() * 3), 1, 4, hex("#071615"));

  // Critters watching from the clearing.
  blob(c, 196, 240, 9, hex("#e2582b"), { look: "fox", facing: 1 });
  blob(c, 240, 243, 10, hex("#57b34a"), { look: "leaf", facing: 1 });
  blob(c, 284, 240, 9, hex("#3f8fe0"), { look: "drop", facing: -1 });

  fireflies(c, 41, 46, 120, 250, hex("#e6f27a"));
  c.save("home/hero.png");
}

function cta() {
  const c = new Canvas(480, 180);
  bandedSky(c, [hex("#12081c"), hex("#2a1033"), hex("#5a1a3c"), hex("#a8402f")], 9, 140);
  for (let r = 40; r > 22; r -= 6) c.circle(396, 40, r, hex("#ff9b6b"), 0.06);
  c.circle(396, 40, 20, hex("#f2c9a0"));
  hills(c, 132, 30, hex("#2a1230"), 9);
  treeLine(c, { seed: 51, baseY: 138, minH: 26, maxH: 50, gap: 20, color: hex("#1d0c24"), kind: "bare" });
  c.rect(0, 140, 480, 40, hex("#150919"));
  treeLine(c, {
    seed: 52,
    baseY: 176,
    minH: 80,
    maxH: 140,
    gap: 52,
    color: hex("#0b040e"),
    kind: "bare",
    skip: (x) => x > 130 && x < 440,
  });
  c.rect(0, 170, 480, 10, hex("#0b040e"));
  // The Hollow Druid: a hooded shape with glowing eyes.
  c.tri(396, 92, 172, 32, hex("#0b040e"));
  c.circle(396, 104, 14, hex("#0b040e"));
  c.rect(389, 102, 4, 4, hex("#ff5a4f"));
  c.rect(399, 102, 4, 4, hex("#ff5a4f"));
  fireflies(c, 53, 30, 60, 170, hex("#ff8a5c"));
  c.save("home/cta.png");
}

function meadow(c, horizon) {
  bandedSky(c, [hex("#6ec3e8"), hex("#a5dcee"), hex("#dff3e4")], 6, horizon);
  c.ellipse(40, 26, 22, 7, hex("#ffffff"), 0.85);
  c.ellipse(58, 22, 16, 7, hex("#ffffff"), 0.85);
  c.ellipse(178, 38, 24, 6, hex("#ffffff"), 0.8);
  hills(c, horizon + 6, 26, hex("#5fae4e"), 2);
  treeLine(c, { seed: 61, baseY: horizon - 2, minH: 16, maxH: 30, gap: 22, color: hex("#3c8a45") });
  c.rect(0, horizon, c.w, c.h - horizon, hex("#6cc24f"));
  const rand = rng(62);
  for (let i = 0; i < 160; i++) {
    const x = rand() * c.w;
    const y = horizon + 2 + rand() * (c.h - horizon - 2);
    c.rect(x, y, 1, 2, rand() > 0.5 ? hex("#4fa63f") : hex("#8ad866"));
  }
  for (let i = 0; i < 14; i++) c.rect(rand() * c.w, horizon + 6 + rand() * (c.h - horizon - 10), 2, 2, rand() > 0.5 ? hex("#fff3a8") : hex("#f7a8c8"));
}

function featureCollect() {
  const c = new Canvas(240, 150);
  meadow(c, 88);
  blob(c, 62, 108, 20, hex("#e2582b"), { look: "fox", facing: 1 });
  blob(c, 122, 114, 22, hex("#57b34a"), { look: "leaf", facing: 1 });
  blob(c, 184, 108, 19, hex("#3f8fe0"), { look: "drop", facing: -1 });
  blob(c, 214, 78, 8, hex("#f0cf45"), { look: "horn", facing: -1 });
  c.save("home/feature-collect.png");
}

function featurePosition() {
  const c = new Canvas(240, 150);
  c.rect(0, 0, 240, 150, hex("#1b3a2b"));
  const tile = 40;
  const ox = 20;
  const oy = 15;
  const tint = { "1,0": "#3f8fe0", "2,0": "#3f8fe0", "1,1": "#3f8fe0", "2,2": "#3f8fe0", "3,1": "#e0483f", "3,2": "#e0483f", "2,1": "#e0483f" };
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      const x = ox + col * tile;
      const y = oy + row * tile;
      const base = (row + col) % 2 === 0 ? hex("#6cc24f") : hex("#5fb245");
      c.rect(x, y, tile, tile, darken(base, 0.35));
      c.rect(x + 1, y + 1, tile - 2, tile - 2, base);
      const t = tint[`${col},${row}`];
      if (t) {
        c.rect(x + 1, y + 1, tile - 2, tile - 2, hex(t), 0.45);
        c.rect(x + 1, y + 1, tile - 2, 1, hex(t));
        c.rect(x + 1, y + tile - 2, tile - 2, 1, hex(t));
        c.rect(x + 1, y + 1, 1, tile - 2, hex(t));
        c.rect(x + tile - 2, y + 1, 1, tile - 2, hex(t));
      }
    }
  // A rock obstacle.
  c.ellipse(ox + 2.5 * tile, oy + 0.6 * tile, 13, 10, hex("#4c5560"));
  c.ellipse(ox + 2.5 * tile - 3, oy + 0.6 * tile - 3, 8, 5, hex("#7c8794"));
  blob(c, ox + 0.5 * tile, oy + 0.5 * tile, 12, hex("#3f8fe0"), { look: "drop", facing: 1 });
  blob(c, ox + 1.5 * tile, oy + 1.5 * tile, 12, hex("#e2582b"), { look: "fox", facing: 1 });
  blob(c, ox + 0.5 * tile, oy + 2.5 * tile, 12, hex("#57b34a"), { look: "leaf", facing: 1 });
  blob(c, ox + 4.5 * tile, oy + 0.5 * tile, 12, hex("#7a52b3"), { look: "bat", facing: -1 });
  blob(c, ox + 3.5 * tile, oy + 1.5 * tile, 13, hex("#8d98a8"), { look: "horn", facing: -1 });
  blob(c, ox + 4.5 * tile, oy + 2.5 * tile, 12, hex("#b47a45"), { look: "plain", facing: -1 });
  c.save("home/feature-position.png");
}

function featureSurvive() {
  const c = new Canvas(240, 150);
  c.rect(0, 0, 240, 150, hex("#14261f"));
  const rand = rng(71);
  for (let i = 0; i < 500; i++) c.set(rand() * 240, rand() * 150, hex("#1d362c"));
  const colors = { normal: "#cfc7a3", elite: "#e0483f", shop: "#e8b84a", rest: "#57b34a", event: "#7fd4c4" };
  const rows = [
    [["normal", 60], ["normal", 120], ["normal", 180]],
    [["event", 40], ["normal", 96], ["shop", 150], ["normal", 204]],
    [["elite", 66], ["rest", 126], ["event", 186]],
    [["rest", 90], ["rest", 160]],
  ];
  const yOf = (row) => 134 - row * 26;
  const links = [
    [0, 0, 1, 0], [0, 0, 1, 1], [0, 1, 1, 1], [0, 1, 1, 2], [0, 2, 1, 2], [0, 2, 1, 3],
    [1, 0, 2, 0], [1, 1, 2, 0], [1, 1, 2, 1], [1, 2, 2, 1], [1, 3, 2, 2],
    [2, 0, 3, 0], [2, 1, 3, 0], [2, 1, 3, 1], [2, 2, 3, 1],
  ];
  const taken = new Set(["0,1,1,2", "1,2,2,1", "2,1,3,0"]);
  for (const [r0, i0, r1, i1] of links) {
    const on = taken.has([r0, i0, r1, i1].join(","));
    c.line(rows[r0][i0][1], yOf(r0), rows[r1][i1][1], yOf(r1), on ? hex("#e8b84a") : hex("#4c6a5b"), { dash: on ? 0 : 3, width: on ? 2 : 1 });
  }
  for (const [, x] of rows[3]) c.line(x, yOf(3), 124, 28, hex("#4c6a5b"), { dash: 3 });
  rows.forEach((row, r) =>
    row.forEach(([kind, x]) => {
      c.circle(x, yOf(r), 7, hex("#0a1512"));
      c.circle(x, yOf(r), 5, hex(colors[kind]));
      c.rect(x - 2, yOf(r) - 3, 2, 2, lighten(hex(colors[kind]), 0.5));
    }),
  );
  // Boss node with horns.
  c.tri(112, 6, 22, 5, hex("#e0483f"));
  c.tri(136, 6, 22, 5, hex("#e0483f"));
  c.circle(124, 26, 15, hex("#0a1512"));
  c.circle(124, 26, 13, hex("#8f1f2a"));
  c.rect(117, 22, 4, 5, hex("#ffd27a"));
  c.rect(128, 22, 4, 5, hex("#ffd27a"));
  c.rect(119, 32, 11, 2, hex("#0a1512"));
  c.save("home/feature-survive.png");
}

function acorn() {
  const art = [
    "................",
    ".......bb.......",
    "......bb........",
    "....cccccccc....",
    "...cCcCcCcCcc...",
    "..cCcCcCcCcCcc..",
    "..cccccccccccc..",
    "...nnnnnnnnnn...",
    "..nNNnnnnnnnnn..",
    "..nNnnnnnnnnnd..",
    "..nNnnnnnnnndd..",
    "..nnnnnnnnnndd..",
    "...nnnnnnnndd...",
    "....nnnnnndd....",
    ".....nnnddd.....",
    ".......dd.......",
  ];
  const palette = { b: "#5a3a1c", c: "#7a4f26", C: "#9a6a36", n: "#e8b84a", N: "#fbe08a", d: "#b9832a" };
  const scale = 4;
  const c = new Canvas(16 * scale, 16 * scale);
  art.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (palette[ch]) c.rect(x * scale, y * scale, scale, scale, hex(palette[ch]));
    }),
  );
  c.save("logo-acorn.png");
}

hero();
cta();
featureCollect();
featurePosition();
featureSurvive();
acorn();
