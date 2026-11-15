// Shared constants and small UI helpers for the Phaser scenes.
// The world is always 480×270. The canvas is that size times an integer zoom (in device
// pixels), and each scene's camera zooms by the same factor. Text is HTML on top of the
// canvas (see domText.ts), so the browser draws it at full screen resolution.
import * as Phaser from "phaser";
import { createDomText, type DomText } from "./domText";
import type { GameSession } from "./session";

export const W = 480;
export const H = 270;
export const TILE = 32;
export const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';

export const COLOR = {
  bg: 0x0b1512,
  panel: 0x14261f,
  panelHi: 0x1c3529,
  line: 0x2c4a3a,
  black: 0x050a08,
  gold: 0xe8b84a,
  goldHi: 0xfbe08a,
  goldLo: 0xa8741f,
  moveRange: 0x3f8fe0, // blue
  attackRange: 0xf0cf45, // yellow
  intent: 0xe0483f, // red
  optimal: 0x6cc24f, // soft green
  player: 0x6fc0ff,
  enemy: 0xff7466,
  hp: 0x6cc24f,
  hpLow: 0xe0483f,
} as const;

export const TEXT = {
  main: "#efe9d2",
  muted: "#a9b8a4",
  gold: "#fbe08a",
  dark: "#2a1a05",
  good: "#8be07b",
  bad: "#ff8a7d",
} as const;

export const session = (scene: Phaser.Scene): GameSession => scene.registry.get("session") as GameSession;

export function setupCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(session(scene).zoom).centerOn(W / 2, H / 2);
}

export interface LabelOptions {
  size?: number;
  color?: string;
  bold?: boolean;
  originX?: number;
  originY?: number;
  wrap?: number;
  depth?: number;
}

/** Anything a scene creates and later removes: game objects and HTML text alike. */
export interface Disposable {
  destroy(): void;
}

/** Disposable things that can also be shown, hidden and layered. */
export interface Layered extends Disposable {
  setVisible(visible: boolean): unknown;
  setDepth(depth: number): unknown;
}

/** HTML text over the canvas. Use this for all UI text. */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, o: LabelOptions = {}): DomText {
  const t = createDomText(scene, session(scene).text, x, y, text, {
    size: o.size ?? 8,
    color: o.color ?? TEXT.main,
    bold: Boolean(o.bold),
    wrap: o.wrap,
  });
  t.setOrigin(o.originX ?? 0, o.originY ?? 0);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

/**
 * Canvas text, for the few labels that must move with sprites inside a Phaser container
 * (HTML text cannot be put in a container). Stays sharp at any integer zoom.
 * - The text texture is drawn at the camera zoom, so one texel covers exactly one screen pixel.
 * - `vertexRoundMode = "full"` snaps the quad to whole screen pixels. Without it, centered text
 *   with an odd width sits half a pixel off the grid and letter edges come out uneven.
 * - Text uses smooth (linear) filtering. The game's pixel-art mode forces nearest filtering on
 *   every texture, and Phaser re-applies that each time the text changes, so it is set again
 *   after every update.
 */
class PixelText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    super(scene, x, y, text, style);
    this.setVertexRoundMode("full");
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  override updateText(): this {
    super.updateText();
    // The base constructor calls updateText() before the texture exists.
    this.texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return this;
  }
}

export function canvasLabel(scene: Phaser.Scene, x: number, y: number, text: string, o: LabelOptions = {}): Phaser.GameObjects.Text {
  const t = new PixelText(scene, x, y, text, {
    fontFamily: FONT,
    fontSize: `${o.size ?? 8}px`,
    fontStyle: o.bold ? "bold" : "normal",
    color: o.color ?? TEXT.main,
    resolution: session(scene).zoom,
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
    lineSpacing: 1,
  });
  scene.add.existing(t);
  t.setOrigin(o.originX ?? 0, o.originY ?? 0);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

/** A dark panel with the stepped pixel border used on the HTML pages. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(COLOR.black, 1).fillRect(x, y, w, h);
  g.fillStyle(COLOR.line, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(COLOR.panel, 0.96).fillRect(x + 2, y + 2, w - 4, h - 4);
  return g;
}

export interface Button {
  setEnabled(enabled: boolean): void;
  setSelected(selected: boolean): void;
  setVisible(visible: boolean): void;
  readonly enabled: boolean;
  /** Extra objects drawn on top of the button (icons, extra lines). Hidden and destroyed with it. */
  readonly extras: Layered[];
  destroy(): void;
}

export interface ButtonOptions {
  gold?: boolean;
  size?: number;
  depth?: number;
  onHover?: (over: boolean) => void;
}

export function makeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, o: ButtonOptions = {}): Button {
  const depth = o.depth ?? 10;
  const g = scene.add.graphics().setDepth(depth);
  const t = label(scene, x + w / 2, y + h / 2, text, { size: o.size ?? 9, bold: true, originX: 0.5, originY: 0.5, depth: depth + 1 });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
  const extras: Layered[] = [];
  let enabled = true;
  let selected = false;
  let over = false;

  const draw = () => {
    const fill = !enabled ? 0x121c18 : o.gold ? (over ? COLOR.goldHi : COLOR.gold) : over ? 0x26473a : COLOR.panelHi;
    g.clear();
    g.fillStyle(COLOR.black, 1).fillRect(x, y, w, h);
    g.fillStyle(selected ? COLOR.goldHi : enabled && o.gold ? COLOR.goldLo : COLOR.line, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(fill, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
    t.setColor(!enabled ? "#56685f" : o.gold ? TEXT.dark : TEXT.main);
  };
  zone.on("pointerover", () => {
    over = true;
    draw();
    o.onHover?.(true);
  });
  zone.on("pointerout", () => {
    over = false;
    draw();
    o.onHover?.(false);
  });
  zone.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    if (enabled) onClick();
  });
  draw();

  return {
    extras,
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      draw();
    },
    setSelected(value) {
      selected = value;
      draw();
    },
    setVisible(value) {
      for (const obj of [g, t, ...extras]) obj.setVisible(value);
      if (value) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
    },
    destroy() {
      for (const obj of [g, t, zone, ...extras]) obj.destroy();
    },
  };
}

export const wait = (scene: Phaser.Scene, ms: number): Promise<void> => new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));

export const tween = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> =>
  new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));

export const textureKey = {
  critter: (stageId: string) => `critter:${stageId}`,
  typeIcon: (type: string) => `icon:type_${type.toLowerCase()}`,
};
