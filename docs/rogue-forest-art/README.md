# Rogue Forest — Art Bundle (spec v0.3)

These are placeholder sprites made to the rules in `ART_SPRITES.md`. Every critter and boss sheet was written in the text pixel format (§4) and turned into a PNG with `pixel_to_png.py`, so each one passes its frame-size and palette-key checks.

## Folder map
```
assets/                 ← copy this into your project's asset folder
  critters/<stageId>.png    43 sheets, 288×48 (6 frames of 48×48)
  bosses/<bossId>.png       8 sheets, 384×64 (6 frames of 64×64)
  tiles/<biome>_ground_a|b.png, rock.png     32×32
  backgrounds/<biome>.png   480×270
  icons/                    16×16: node_*, type_*, status_*, potion_*, relic_*, mana, acorn
  ui/druid.png (48×48), ui/logo.png (240×64)
source/                 text-pixel sprites (§4) for every critter + boss; edit and re-convert
previews/               zoomed contact sheets for quick review (not needed in-game)
tools/pixel_to_png.py   your converter
tools/sprite_generator/ the Python that draws everything (run build.py to regenerate)
```

## Frame order (all critters + bosses)
idle A · idle B (breath bob / blink) · windup (lean back + crouch) · strike (lunge 3 px) · hurt (>< eyes, recoil 2 px) · faint (slumped, x eyes)

## Rules checked automatically
- Palette keys only, ≤ 12 colours per sprite, 1 px `0` outline, no semi-transparent pixels
- Feet on the bottom 2 rows, centred, nothing clipped at the canvas edge
- Stage heights: stage 1 = 24–30 px, stage 2 = 32–38 px, stage 3 = 40–46 px; bosses ≈ 56 px
- Everything faces right and is lit from the top-left

## ⚠ Names to check against TECH_DESIGN.md
I didn't have TECH_DESIGN.md, so these IDs are guesses. Rename the files if yours are different:
- **Biomes** (taken from the boss IDs): meadow, marsh, scorched, canyon, rustwood, glowcap, frostpine, heartwood
- **Statuses**: burn, poison, stun, sleep, weak, shield, regen, haste
- **Potions**: heal, mana, strength, guard, swift, cleanse
- **Relics**: acorn_pouch, mossy_stone, old_compass, owl_feather, silver_bell, glow_lantern, seed_of_life, hunting_horn, root_ring, mushroom_charm, druid_totem, plus `relic_charm_<type>` ×8

## Notes
- Flying critters have no feet to plant, so in idle B they flap their wings instead of bobbing down 1 px.
- Backgrounds are drawn at 240×135 and scaled 2× so their pixels match the sprites.
- To tweak a single sprite, either edit `source/critters/<id>.txt` and run
  `python3 tools/pixel_to_png.py source/critters/<id>.txt assets/critters/<id>.png`,
  or change its drawing in `tools/sprite_generator/critters_*.py` and run `python3 build.py <out_dir>` (needs Pillow).
