// Game page (#/game): hosts the Phaser game. For now that is one practice fight (milestone M2).
import { api, getMe } from "../api";
import { navigate, type Page } from "../router";
import { h } from "../ui/dom";

export const gamePage: Page = (root, ctx) => {
  let stopGame: (() => void) | null = null;
  root.append(h("main", { class: "loading" }, "Loading your run…"));

  (async () => {
    const me = await getMe();
    if (!ctx.isCurrent()) return;
    if (!me) return navigate("/login");
    const saved = await api.getRun();
    if (!ctx.isCurrent()) return;
    if (!saved) return navigate("/starter");

    // Phaser is large, so it loads only when the game page opens. The pixel font must be
    // ready before Phaser draws any text.
    const [{ startGame }] = await Promise.all([
      import("../game/session"),
      document.fonts.load('400 16px "Pixelify Sans"').catch(() => undefined),
      document.fonts.load('700 16px "Pixelify Sans"').catch(() => undefined),
    ]);
    if (!ctx.isCurrent()) return;

    const stage = h("main", { class: "game-stage" });
    root.replaceChildren(stage);
    stopGame = startGame(stage, saved.state, () => navigate("/starter"));
  })().catch((err) => {
    if (!ctx.isCurrent()) return;
    root.replaceChildren(
      h("main", { class: "loading" }, h("p", {}, err instanceof Error ? err.message : "Could not load your run."), h("button", { class: "btn", type: "button", onclick: () => navigate("/game") }, "Try again")),
    );
  });

  return () => stopGame?.();
};
