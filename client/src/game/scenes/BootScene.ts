// Loads art, then starts the right scene. Every asset is optional: a missing file just means
// the placeholder for it is drawn instead (TECH_DESIGN §14).
import { Rng } from "@shared/engine/rng";
import { createEncounter } from "@shared/engine/combat/encounter";
import { critters, typeDefs } from "@shared/gameData";
import * as Phaser from "phaser";
import { H, W, label, session, setupCamera, textureKey } from "../ui";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    setupCamera(this);
    label(this, W / 2, H / 2, "Loading…", { size: 10, originX: 0.5, originY: 0.5 });

    const { run } = session(this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      // Missing art is fine. The scenes check textures.exists() and fall back to placeholders.
    });

    for (const line of critters) {
      for (const stage of line.stages) {
        this.load.spritesheet(textureKey.critter(stage.id), `/assets/critters/${stage.id}.png`, { frameWidth: 48, frameHeight: 48 });
      }
    }
    for (const type of typeDefs) this.load.image(textureKey.typeIcon(type.id), `/assets/icons/type_${type.id.toLowerCase()}.png`);
    this.load.image("icon:mana", "/assets/icons/mana.png");
    this.load.image("bg", `/assets/backgrounds/${run.biomeId}.png`);
    this.load.image("tile:a", `/assets/tiles/${run.biomeId}_ground_a.png`);
    this.load.image("tile:b", `/assets/tiles/${run.biomeId}_ground_b.png`);
    this.load.image("rock", "/assets/tiles/rock.png");
  }

  create(): void {
    // Idle animation: frames 0 and 1 of each sheet (idle A, idle B).
    for (const line of critters) {
      for (const stage of line.stages) {
        const key = textureKey.critter(stage.id);
        if (!this.textures.exists(key) || this.anims.exists(`idle:${stage.id}`)) continue;
        this.anims.create({ key: `idle:${stage.id}`, frames: this.anims.generateFrameNumbers(key, { frames: [0, 1] }), frameRate: 2, repeat: -1 });
      }
    }

    const s = session(this);
    if (!s.combat) {
      const rng = new Rng(s.rngState);
      s.combat = createEncounter(s.run, rng);
    }
    // After a canvas rebuild, pick up the fight where it was.
    this.scene.start(s.combat.phase === "placement" ? "Placement" : "Combat");
  }
}
