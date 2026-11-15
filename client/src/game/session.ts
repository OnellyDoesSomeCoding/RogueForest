// Creates the Phaser game for a run and keeps the state that must survive a canvas rebuild.
import type { CombatState } from "@shared/engine/combat/types";
import type { RunSave } from "@shared/types";
import * as Phaser from "phaser";
import type { TextHost } from "./domText";
import { BootScene } from "./scenes/BootScene";
import { CombatScene } from "./scenes/CombatScene";
import { PlacementScene } from "./scenes/PlacementScene";
import { H, W } from "./ui";

export interface GameSession {
  run: RunSave;
  /** Integer scale of the 480×270 world, in device pixels. The canvas is W×zoom by H×zoom device pixels. */
  zoom: number;
  /** Where HTML text goes, and how world units map to CSS pixels. */
  text: TextHost;
  /** The fight in progress, if any. Scenes store the latest state here after every action. */
  combat: CombatState | null;
  /** RNG state to build the next fight from. */
  rngState: number;
  /** Status icon names that have an art file. The rest are drawn in code. */
  statusIcons: Set<string>;
  leave(): void;
}

/**
 * Sizes are worked out in device pixels, not CSS pixels. On a screen with 125% or 150%
 * Windows scaling, a canvas sized in CSS pixels gets stretched by the browser and looks soft.
 * Sizing it in device pixels keeps every game pixel on whole screen pixels.
 */
function measure(parent: HTMLElement) {
  const dpr = window.devicePixelRatio || 1;
  const zoom = Math.max(1, Math.floor(Math.min((parent.clientWidth * dpr) / W, (parent.clientHeight * dpr) / H)));
  return { dpr, zoom };
}

/** Starts the game inside `parent`. Returns a function that shuts it down. */
export function startGame(parent: HTMLElement, run: RunSave, leave: () => void, statusIcons: Set<string> = new Set()): () => void {
  // The frame holds the canvas and the HTML text layer on top of it, at the same size.
  const frame = document.createElement("div");
  frame.className = "game-frame";
  const layer = document.createElement("div");
  layer.className = "game-text-layer";
  parent.append(frame);

  const first = measure(parent);
  const gameSession: GameSession = {
    run,
    zoom: first.zoom,
    text: { layer, scale: first.zoom / first.dpr, dpr: first.dpr },
    combat: null,
    rngState: run.rngState,
    statusIcons,
    leave,
  };
  let game: Phaser.Game | null = null;
  let dpr = first.dpr;

  /** Centers the frame, on whole device pixels so the canvas is never resampled. */
  const position = () => {
    const width = (W * gameSession.zoom) / dpr;
    const height = (H * gameSession.zoom) / dpr;
    const snap = (v: number) => Math.max(0, Math.round(v * dpr) / dpr);
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.left = `${snap((parent.clientWidth - width) / 2)}px`;
    frame.style.top = `${snap((parent.clientHeight - height) / 2)}px`;
  };

  const create = () => {
    layer.replaceChildren();
    gameSession.text = { layer, scale: gameSession.zoom / dpr, dpr };
    position();
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: frame,
      width: W * gameSession.zoom,
      height: H * gameSession.zoom,
      backgroundColor: "#0b1512",
      pixelArt: true,
      // The canvas has W×zoom device pixels. Shown at 1/dpr, each one covers one screen pixel.
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      banner: false,
      scene: [BootScene, PlacementScene, CombatScene],
      // Scenes read the session from the registry, so it must be there before any scene starts.
      callbacks: {
        preBoot: (g) => g.registry.set("session", gameSession),
        // The text layer goes after the canvas, so it is drawn on top.
        postBoot: () => frame.append(layer),
      },
    });
    // Dev only: lets browser tests read the live game state.
    if (import.meta.env.DEV) (window as unknown as { __rogueForest?: unknown }).__rogueForest = { session: gameSession, game };
  };

  // When the window crosses a zoom step, or the screen scaling changes (browser zoom, another
  // monitor), rebuild at the new size. The fight continues from gameSession.combat.
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const next = measure(parent);
      if (next.zoom === gameSession.zoom && next.dpr === dpr) return position();
      gameSession.zoom = next.zoom;
      dpr = next.dpr;
      game?.destroy(true);
      create();
    }, 150);
  };
  window.addEventListener("resize", onResize);
  create();

  return () => {
    window.removeEventListener("resize", onResize);
    window.clearTimeout(timer);
    game?.destroy(true);
    game = null;
    frame.remove();
  };
}
