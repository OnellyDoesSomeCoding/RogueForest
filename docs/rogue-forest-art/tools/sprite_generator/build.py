"""Build the whole Rogue Forest art bundle.

    python3 build.py <out_dir>

Critters + bosses are written as text sprites (ART_SPRITES.md §4) and turned
into PNG sheets with tools/pixel_to_png.py, so every sheet passes its checks.
"""
import os
import shutil
import subprocess
import sys

from PIL import Image

import assets as S
from bosses import BOSSES
from engine import build_frames, check_sheet, frames_to_text, grid_to_image, idle_height
from preview import sheet_image, stack
from registry import CRITTERS, SIZE_RANGE, drawer, entry
from try_bosses import boss_frames

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "rogue-forest-art")
A = os.path.join(OUT, "assets")
SRC = os.path.join(OUT, "source")
PREV = os.path.join(OUT, "previews")
CONVERT = os.path.join(HERE, "pixel_to_png.py")
for d in ("critters", "bosses", "tiles", "backgrounds", "icons", "ui"):
    os.makedirs(os.path.join(A, d), exist_ok=True)
for d in ("critters", "bosses"):
    os.makedirs(os.path.join(SRC, d), exist_ok=True)
os.makedirs(PREV, exist_ok=True)

problems = []


def convert(txt, png, size):
    r = subprocess.run([sys.executable, CONVERT, txt, png, "--size", str(size)], capture_output=True, text=True)
    if r.returncode != 0:
        problems.append(f"{os.path.basename(txt)}: {r.stderr.strip()}")


# ---- critters (spec order)
ORDER = ["emberkit", "cindervix", "pyrovulp", "dewdle", "brookle", "torrentail", "sproutle", "thornhog",
         "briarback", "pebbun", "boulderbun", "gustling", "galefinch", "tempestrel", "lumoth", "lanternmoth",
         "shadewick", "duskowl", "glimmet", "radiantis", "rivetle", "bastionbeetle", "claypaw", "mireotter",
         "sporeling", "mycelord", "ashmole", "magmole", "pollenbee", "bloomqueen", "frostfawn", "rimestag",
         "rustrat", "scrapking", "wisplet", "cinderbat", "blazewing", "shellcrag", "fortortoise", "sunpetal",
         "solbloom", "murkling", "bogmaw"]
assert set(ORDER) == set(CRITTERS) and len(ORDER) == 43
prev_imgs, prev_labels = [], []
for cid in ORDER:
    fn, stage, faint, s, sx = entry(cid)
    fr = build_frames(drawer(fn, stage, s, sx=sx), 48, faint)
    for p in check_sheet(fr, 48):
        problems.append(f"{cid}: {p}")
    lo, hi = SIZE_RANGE[stage]
    h = idle_height(fr)
    if not (lo - 1 <= h <= hi + 1):
        problems.append(f"{cid}: height {h} outside {lo}-{hi}")
    txt = os.path.join(SRC, "critters", f"{cid}.txt")
    with open(txt, "w") as f:
        f.write(frames_to_text(fr))
    convert(txt, os.path.join(A, "critters", f"{cid}.png"), 48)
    prev_imgs.append(sheet_image(fr, 3))
    prev_labels.append(f"{cid}  (stage {stage}, {h}px tall)")
for i in range(0, 43, 15):
    stack(prev_imgs[i:i + 15], prev_labels[i:i + 15]).save(os.path.join(PREV, f"critters_{i // 15 + 1}.png"))

# ---- bosses
bimgs, blabels = [], []
for bid in BOSSES:
    fr = boss_frames(bid)
    for p in check_sheet(fr, 64):
        problems.append(f"{bid}: {p}")
    txt = os.path.join(SRC, "bosses", f"{bid}.txt")
    with open(txt, "w") as f:
        f.write(frames_to_text(fr))
    convert(txt, os.path.join(A, "bosses", f"{bid}.png"), 64)
    bimgs.append(sheet_image(fr, 2))
    blabels.append(bid)
stack(bimgs, blabels).save(os.path.join(PREV, "bosses.png"))

# ---- icons
icon_imgs = []
for name, rel in S.icon_list().items():
    g = S.icon(name)
    if len(g.keys()) > 12:
        problems.append(f"{rel}: {len(g.keys())} colours")
    S.save(g, os.path.join(A, rel))
    icon_imgs.append((rel, grid_to_image(g)))
cols = 10
sheet = Image.new("RGBA", (cols * 68, ((len(icon_imgs) + cols - 1) // cols) * 68), (236, 240, 228, 255))
for i, (_, im) in enumerate(icon_imgs):
    sheet.alpha_composite(im.resize((64, 64), Image.NEAREST), ((i % cols) * 68 + 2, (i // cols) * 68 + 2))
sheet.save(os.path.join(PREV, "icons.png"))

# ---- tiles + backgrounds
tile_prev = Image.new("RGBA", (9 * 68, 2 * 68), (236, 240, 228, 255))
for i, b in enumerate(S.BIOMES):
    for j, v in enumerate("ab"):
        im = S.save(S.tile(b, v), os.path.join(A, "tiles", f"{b}_ground_{v}.png"))
        tile_prev.alpha_composite(im.resize((64, 64), Image.NEAREST), (i * 68 + 2, j * 68 + 2))
im = S.save(S.rock(), os.path.join(A, "tiles", "rock.png"))
tile_prev.alpha_composite(im.resize((64, 64), Image.NEAREST), (8 * 68 + 2, 2))
tile_prev.save(os.path.join(PREV, "tiles.png"))

bg_prev = Image.new("RGBA", (960, 1080), (0, 0, 0, 255))
for i, b in enumerate(S.BIOMES):
    im = S.save(S.background(b), os.path.join(A, "backgrounds", f"{b}.png"), scale=2)
    bg_prev.alpha_composite(im, ((i % 2) * 480, (i // 2) * 270))
bg_prev.save(os.path.join(PREV, "backgrounds.png"))

# ---- ui
S.save(S.druid(), os.path.join(A, "ui", "druid.png"))
S.save(S.logo(), os.path.join(A, "ui", "logo.png"))

# ---- tools
tools = os.path.join(OUT, "tools")
gen = os.path.join(tools, "sprite_generator")
os.makedirs(gen, exist_ok=True)
shutil.copy(CONVERT, os.path.join(tools, "pixel_to_png.py"))
for f in ("engine.py", "critters_a.py", "critters_b.py", "registry.py", "bosses.py", "assets.py",
          "preview.py", "try_bosses.py", "try_critters.py", "build.py"):
    shutil.copy(os.path.join(HERE, f), os.path.join(gen, f))
shutil.copy(CONVERT, os.path.join(gen, "pixel_to_png.py"))

print("PROBLEMS:" if problems else "All checks passed.")
for p in problems:
    print("  " + p)
