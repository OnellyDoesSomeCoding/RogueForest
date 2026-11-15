// Game text drawn as HTML on top of the canvas, so the browser renders it at the screen's
// real resolution. It is always as sharp as text on the rest of the site.
//
// Positions are in world units (the 480×270 game world) and are converted to CSS pixels with
// the session's scale. Each text is snapped to whole device pixels. Text objects have x, y and
// alpha properties, so Phaser tweens can animate them like game objects.
//
// Layering: all HTML text sits above the canvas. Depth only orders texts among themselves.
// Use hideTextBelow() when a canvas overlay (like a modal's backdrop) must cover text.
import * as Phaser from "phaser";

export interface DomTextStyle {
  size: number;
  color: string;
  bold: boolean;
  /** Wrap width in world units. No wrap when missing. */
  wrap?: number;
}

export interface TextHost {
  /** The element that holds the text, absolutely positioned over the canvas. */
  layer: HTMLElement;
  /** CSS pixels per world unit. */
  scale: number;
  /** Device pixels per CSS pixel. */
  dpr: number;
}

const byScene = new WeakMap<Phaser.Scene, Set<DomText>>();

export class DomText {
  readonly el: HTMLDivElement;
  private _x: number;
  private _y: number;
  private _alpha = 1;
  private ox = 0;
  private oy = 0;
  /** Measured size in CSS pixels. */
  private w = 0;
  private h = 0;
  private depth = 0;
  private visible = true;
  private dirty = true;
  private text: string;

  constructor(
    private host: TextHost,
    private owner: Set<DomText>,
    x: number,
    y: number,
    text: string,
    style: DomTextStyle,
  ) {
    const s = host.scale;
    this._x = x;
    this._y = y;
    this.text = text;
    const el = document.createElement("div");
    el.className = "game-text";
    el.style.fontSize = `${style.size * s}px`;
    el.style.lineHeight = `${(Math.round(style.size * 1.25) + 1) * s}px`;
    el.style.fontWeight = style.bold ? "700" : "400";
    el.style.color = style.color;
    if (style.wrap) {
      el.style.width = `${style.wrap * s}px`;
      el.style.whiteSpace = "pre-wrap";
    }
    el.textContent = text;
    this.el = el;
    host.layer.append(el);
    owner.add(this);
    this.place();
  }

  get x(): number {
    return this._x;
  }
  set x(value: number) {
    this._x = value;
    this.place();
  }
  get y(): number {
    return this._y;
  }
  set y(value: number) {
    this._y = value;
    this.place();
  }
  get alpha(): number {
    return this._alpha;
  }
  set alpha(value: number) {
    this._alpha = value;
    this.el.style.opacity = String(value);
  }

  /** Width in world units. */
  get width(): number {
    this.measure();
    return this.w / this.host.scale;
  }
  /** Height in world units. */
  get height(): number {
    this.measure();
    return this.h / this.host.scale;
  }

  setText(text: string): this {
    if (text === this.text) return this;
    this.text = text;
    this.el.textContent = text;
    this.dirty = true;
    this.place();
    return this;
  }

  setColor(color: string): this {
    this.el.style.color = color;
    return this;
  }

  /** An outline around the letters, like Phaser's stroke. `thickness` is in world units. */
  setStroke(color: string, thickness: number): this {
    const r = Math.max(1, Math.round((thickness / 2) * this.host.scale * this.host.dpr)) / this.host.dpr;
    const shadows: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) shadows.push(`${dx * r}px ${dy * r}px 0 ${color}`);
    this.el.style.textShadow = shadows.join(", ");
    return this;
  }

  setAlign(align: "left" | "center" | "right"): this {
    this.el.style.textAlign = align;
    return this;
  }

  setOrigin(x: number, y: number = x): this {
    this.ox = x;
    this.oy = y;
    this.place();
    return this;
  }

  setPosition(x: number, y: number): this {
    this._x = x;
    this._y = y;
    this.place();
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    this.el.style.zIndex = String(depth);
    return this;
  }

  getDepth(): number {
    return this.depth;
  }

  setVisible(visible: boolean): this {
    this.visible = visible;
    this.el.style.display = visible ? "" : "none";
    if (visible) this.place();
    return this;
  }

  destroy(): void {
    this.el.remove();
    this.owner.delete(this);
  }

  private measure(): void {
    if (!this.dirty || !this.visible) return;
    const rect = this.el.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.dirty = false;
  }

  /** Places the box so its origin sits on (x, y), snapped to whole device pixels. */
  private place(): void {
    if (!this.visible) return;
    if (this.ox !== 0 || this.oy !== 0) this.measure();
    const { scale: s, dpr } = this.host;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    this.el.style.left = `${snap(this._x * s - this.ox * this.w)}px`;
    this.el.style.top = `${snap(this._y * s - this.oy * this.h)}px`;
  }
}

/** Creates HTML text owned by a scene. It is removed when the scene shuts down. */
export function createDomText(scene: Phaser.Scene, host: TextHost, x: number, y: number, text: string, style: DomTextStyle): DomText {
  let owned = byScene.get(scene);
  if (!owned) {
    const set = new Set<DomText>();
    owned = set;
    byScene.set(scene, set);
    const clear = () => {
      for (const t of [...set]) t.destroy();
      byScene.delete(scene);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, clear);
    scene.events.once(Phaser.Scenes.Events.DESTROY, clear);
  }
  return new DomText(host, owned, x, y, text, style);
}

/**
 * Hides every text of a scene that is below `depth`, as if a canvas backdrop drawn at that
 * depth covered it. (Dimming instead would let text show through the edges of a popup.)
 */
export function hideTextBelow(scene: Phaser.Scene, depth: number): void {
  for (const t of byScene.get(scene) ?? []) if (t.getDepth() < depth) t.setVisible(false);
}
