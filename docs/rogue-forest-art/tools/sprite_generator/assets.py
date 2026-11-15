"""Icons (16x16), tiles (32x32), backgrounds (480x270), Druid portrait, logo."""
import math
import random

from engine import Grid, Pen, outline, ellipse_pix, poly_pix, line_pix, rgba, PALETTE
from PIL import Image

# ---------------------------------------------------------------- ids
BIOMES = ["meadow", "marsh", "scorched", "canyon", "rustwood", "glowcap", "frostpine", "heartwood"]
NODES = ["normal", "elite", "boss", "shop", "rest", "event"]
TYPES = ["ember", "dew", "clay", "zephyr", "gloom", "lume", "iron", "flora"]
# Placeholder ids: rename to match TECH_DESIGN.md §7.7 / potion + relic lists.
STATUSES = ["burn", "poison", "stun", "sleep", "weak", "shield", "regen", "haste"]
POTIONS = ["heal", "mana", "strength", "guard", "swift", "cleanse"]
RELICS = ["acorn_pouch", "mossy_stone", "old_compass", "owl_feather", "silver_bell", "glow_lantern",
          "seed_of_life", "hunting_horn", "root_ring", "mushroom_charm", "druid_totem"]
CHARMS = [f"charm_{t}" for t in TYPES]


def icon_grid():
    g = Grid(16)
    return g, Pen(g, 1.0)


def finish(g):
    for e in g.eyes:
        from engine import paint_eye
        paint_eye(g, e, "open")
    outline(g)
    return g


# ---------------------------------------------------------------- type symbols (reused by charms)
def sym_ember(p, sc=1.0, cx=0, cy=0):
    p.flame(cx, cy + 1 * sc, 12 * sc, 4.5 * sc, ("R", "o", "y"))


def sym_dew(p, sc=1.0, cx=0, cy=0):
    p.ell(cx, cy + 5 * sc, 5 * sc, 5 * sc, ("b", "B", "c"))
    p.poly([(cx - 4.3 * sc, cy + 7 * sc), (cx + 4.3 * sc, cy + 7 * sc), (cx, cy + 13.5 * sc)], ("B", "c"))
    p.ell(cx - 1.8 * sc, cy + 6.5 * sc, 1.2 * sc, 1.6 * sc, ("C",))


def sym_clay(p, sc=1.0, cx=0, cy=0):
    p.poly([(cx - 7 * sc, cy + 1), (cx - 2 * sc, cy + 11 * sc), (cx + 1 * sc, cy + 7 * sc),
            (cx + 3 * sc, cy + 9 * sc), (cx + 7 * sc, cy + 1)], ("n", "N", "t"), line="n")
    p.poly([(cx - 3.5 * sc, cy + 8 * sc), (cx - 2 * sc, cy + 11 * sc), (cx - 0.5 * sc, cy + 8.5 * sc)], ("T",))


def sym_zephyr(p, sc=1.0, cx=0, cy=0):
    pts = []
    for i in range(30):
        a = i / 29 * 4.2
        r = (1 + i * 0.2) * sc
        pts.append((cx + r * math.cos(a), cy + 6.5 * sc + r * math.sin(a)))
    for a, b in zip(pts, pts[1:]):
        p.ln(a[0], a[1], b[0], b[1], "Z", 2 if sc >= 1 else 1)
    p.ln(cx - 6 * sc, cy + 2 * sc, cx + 3 * sc, cy + 2 * sc, "w")


def sym_gloom(p, sc=1.0, cx=0, cy=0):
    p.ell(cx, cy + 6.5 * sc, 6 * sc, 6 * sc, ("p", "P", "v"))
    pix = ellipse_pix(*p.P(cx + 2.8 * sc, cy + 8.2 * sc), 4.6 * sc, 4.6 * sc)
    for (x, y) in pix:
        p.g.set(x, y, None)
    p.px(cx - 2 * sc, cy + 9 * sc, "v")


def sym_lume(p, sc=1.0, cx=0, cy=0):
    for i in range(8):
        a = i * math.pi / 4
        p.ln(cx + 3.5 * sc * math.cos(a), cy + 6.5 * sc + 3.5 * sc * math.sin(a),
             cx + 6.5 * sc * math.cos(a), cy + 6.5 * sc + 6.5 * sc * math.sin(a), "U")
    p.ell(cx, cy + 6.5 * sc, 3.8 * sc, 3.8 * sc, ("u", "U", "s"))


def sym_iron(p, sc=1.0, cx=0, cy=0):
    for i in range(6):
        a = i * math.pi / 3
        p.ell(cx + 5 * sc * math.cos(a), cy + 6.5 * sc + 5 * sc * math.sin(a), 1.6 * sc, 1.6 * sc, ("i", "I"))
    p.ell(cx, cy + 6.5 * sc, 5 * sc, 5 * sc, ("i", "I", "k"))
    p.ell(cx, cy + 6.5 * sc, 1.6 * sc, 1.6 * sc, ("i",))


def sym_flora(p, sc=1.0, cx=0, cy=0):
    p.poly([(cx - 6 * sc, cy + 1 * sc), (cx - 5 * sc, cy + 8 * sc), (cx + 1 * sc, cy + 13 * sc),
            (cx + 6 * sc, cy + 12 * sc), (cx + 4 * sc, cy + 5 * sc)], ("g", "G", "l"), line="g")
    p.ln(cx - 5 * sc, cy + 2 * sc, cx + 4 * sc, cy + 11 * sc, "g")


SYMBOLS = dict(ember=sym_ember, dew=sym_dew, clay=sym_clay, zephyr=sym_zephyr, gloom=sym_gloom,
               lume=sym_lume, iron=sym_iron, flora=sym_flora)
GEM = dict(ember=("r", "R", "y"), dew=("b", "B", "C"), clay=("n", "N", "T"), zephyr=("z", "Z", "w"),
           gloom=("p", "P", "v"), lume=("u", "U", "s"), iron=("i", "I", "k"), flora=("g", "G", "L"))


# ---------------------------------------------------------------- icons
def potion(p, liquid):
    p.ell(0, 5, 5.5, 5, ("2", "3", "4"))
    p.ell(0, 4.5, 4.5, 3.8, liquid)
    p.rect(-2, 9, 2, 12, ("3", "4"))
    p.rect(-2.5, 12, 2.5, 14, ("n", "N"))
    p.px(-2, 7, "5"); p.px(-3, 6, "5")


def icon(name):
    g, p = icon_grid()
    if name in SYMBOLS:
        SYMBOLS[name](p)
    elif name == "node_normal":            # paw print
        p.ell(0, 3.5, 4, 3, ("n", "N", "t"))
        for (x, y) in ((-5.2, 8.2), (-2, 11.6), (2, 11.6), (5.2, 8.2)):
            p.ell(x, y, 1.5, 1.7, ("N", "t"))
    elif name == "node_elite":             # red horned skull-ish mask
        p.poly([(-6, 12), (-4, 8), (-2, 10)], ("3", "4"))
        p.poly([(6, 12), (4, 8), (2, 10)], ("3", "4"))
        p.ell(0, 6, 5.5, 5, ("r", "R", "o"))
        p.rect(-3.5, 1, 3.5, 3, ("r", "R"))
        p.rect(-3, 5.5, -1, 7.5, ("0",)); p.rect(1, 5.5, 3, 7.5, ("0",))
        p.px(-2, 7, "y"); p.px(2, 7, "y")
    elif name == "node_boss":              # crown
        p.poly([(-7, 2), (7, 2), (7, 11), (3.5, 6), (0, 12), (-3.5, 6), (-7, 11)], ("u", "U", "s"), line="u")
        p.px(0, 4, "R"); p.px(-4, 4, "B"); p.px(4, 4, "l")
    elif name == "node_shop":              # acorn pouch
        p.ell(0, 5, 6, 5, ("n", "N", "t"))
        p.rect(-2.5, 9, 2.5, 11, ("n", "N"))
        p.ell(0, 12, 3.5, 1.5, ("N", "t"))
        p.ln(-3, 10, 3, 10, "U")
        p.ell(0, 5, 1.8, 2, ("u", "U"))
    elif name == "node_rest":              # campfire
        p.ln(-6, 1, 6, 4, "N", 2); p.ln(-6, 4, 6, 1, "n", 2)
        p.flame(0, 3, 11, 4, ("R", "o", "y"))
    elif name == "node_event":             # question mark
        pts = [(-3, 9), (-3, 11), (-1, 13), (2, 13), (4, 11), (4, 8.5), (1, 6.5), (1, 5)]
        for a, b in zip(pts, pts[1:]):
            p.ln(a[0], a[1], b[0], b[1], "U", 2.4)
        p.ell(1, 1.8, 1.5, 1.5, ("U",))
        p.px(-2, 11, "s")
    elif name == "status_burn":
        p.flame(0, 1, 13, 5, ("r", "R", "o"))
    elif name == "status_poison":
        sym_dew(p)
        for y in range(16):
            for x in range(16):
                k = g.a[y][x]
                if k:
                    g.a[y][x] = {"b": "p", "B": "P", "c": "v", "C": "l"}.get(k, k)
        p.px(1, 4, "l")
    elif name == "status_stun":
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            r = 7 if i % 2 == 0 else 3
            pts.append((r * math.cos(a), 7 - r * math.sin(a)))
        p.poly(pts, ("u", "U", "s"), line="u")
    elif name == "status_sleep":
        for (x, y, sc) in ((-3, 1, 1.0), (4, 9, 0.6)):
            w = 5 * sc
            p.ln(x - w / 2, y + w, x + w / 2, y + w, "c", 1.8)
            p.ln(x + w / 2, y + w, x - w / 2, y, "c", 1.8)
            p.ln(x - w / 2, y, x + w / 2, y, "c", 1.8)
    elif name == "status_weak":            # broken claw / down arrow
        p.rect(-2, 6, 2, 13, ("2", "3"))
        p.poly([(-6, 6), (6, 6), (0, 0)], ("2", "3", "4"))
        p.ln(-2, 10, 2, 9, "0")
    elif name == "status_shield":
        p.poly([(-6, 13), (6, 13), (6, 6), (0, 0), (-6, 6)], ("b", "B", "c"), line="b")
        p.poly([(-3, 11), (0, 11), (0, 4), (-3, 7)], ("C",))
    elif name == "status_regen":
        p.rect(-2, 1, 2, 13, ("g", "G", "l"))
        p.rect(-6, 5, 6, 9, ("g", "G", "l"))
        p.px(-1, 12, "L")
    elif name == "status_haste":
        for dy in (0, 6):
            p.poly([(-6, 1 + dy), (-1, 4 + dy), (-6, 7 + dy), (-4, 4 + dy)], ("z", "Z", "w"))
            p.poly([(0, 1 + dy), (5, 4 + dy), (0, 7 + dy), (2, 4 + dy)], ("z", "Z", "w"))
    elif name == "mana":
        p.poly([(0, 0), (5, 6), (0, 14), (-5, 6)], ("b", "B", "c"), line="b")
        p.poly([(0, 2), (2, 6), (0, 12), (-2, 6)], ("c", "C"))
        p.px(-1, 9, "5")
    elif name == "acorn":
        p.ell(0, 4.5, 4.5, 5, ("n", "N", "t"))
        p.ell(0, 9.5, 6, 2.6, ("n", "N", "T"))
        p.ln(0, 12, 1, 14, "n", 1)
        p.px(-2, 6, "T")
    elif name.startswith("potion_"):
        liquid = dict(heal=("r", "R", "e"), mana=("b", "B", "c"), strength=("r", "o", "y"),
                      guard=("i", "I", "k"), swift=("z", "Z", "w"), cleanse=("g", "l", "L"))[name[7:]]
        potion(p, liquid)
    elif name.startswith("relic_charm_"):
        t = name[len("relic_charm_"):]
        p.ln(-4, 13, 0, 9, "3"); p.ln(4, 13, 0, 9, "3")
        p.ell(0, 5, 5.5, 5.5, ("i", "I", "k") if t == "lume" else ("u", "U", "s"))
        p.ell(0, 5, 3.5, 3.5, GEM[t])
        p.px(-1, 6, "5")
    elif name.startswith("relic_"):
        relic(p, name[6:])
    else:
        raise KeyError(name)
    return finish(g)


def relic(p, rid):
    if rid == "acorn_pouch":
        p.ell(0, 5, 6, 5, ("n", "N", "t")); p.rect(-2, 9, 2, 11, ("N",)); p.ell(0, 12, 3, 1.5, ("N", "t"))
        p.ell(-4, 2, 2, 2.2, ("N", "t")); p.ell(-4, 4, 2.3, 1, ("n",))
    elif rid == "mossy_stone":
        p.ell(0, 5, 6.5, 5, ("1", "2", "3")); p.ell(-1, 8, 5, 2, ("G", "l")); p.px(3, 3, "l")
    elif rid == "old_compass":
        p.ell(0, 6.5, 6, 6, ("u", "U", "s")); p.ell(0, 6.5, 4.5, 4.5, ("4", "5"))
        p.ln(-2, 4, 2, 9, "R", 1); p.ln(2, 9, 0, 6.5, "R"); p.ln(-2, 4, 0, 6.5, "2")
    elif rid == "owl_feather":
        p.poly([(-5, 1), (-3, 8), (3, 13), (5, 11), (0, 4)], ("p", "P", "v"))
        p.ln(-5, 1, 4, 12, "U")
    elif rid == "silver_bell":
        p.poly([(-6, 3), (6, 3), (4, 11), (-4, 11)], ("i", "I", "k"))
        p.ell(0, 11, 4, 2, ("I", "k")); p.ell(0, 2, 1.6, 1.4, ("i",)); p.px(-2, 9, "5")
    elif rid == "glow_lantern":
        p.rect(-4, 2, 4, 11, ("n", "N")); p.rect(-3, 3, 3, 10, ("u", "U", "s"))
        p.ln(-2, 12, 2, 12, "n"); p.ln(0, 12, 0, 14, "n")
    elif rid == "seed_of_life":
        p.ell(0, 6, 4, 5.5, ("n", "N", "t")); p.ln(0, 11, 0, 14, "G"); p.ell(2, 13, 2, 1.2, ("G", "l"))
        p.px(-1, 8, "T")
    elif rid == "hunting_horn":
        p.poly([(-6, 4), (-3, 9), (6, 13), (5, 10), (-2, 6), (-4, 2)], ("T", "4"))
        p.ln(-6, 4, -4, 2, "N", 2); p.ln(-2, 6, 3, 9, "N")
    elif rid == "root_ring":
        p.ell(0, 6.5, 6, 6, ("n", "N", "t"))
        pix = ellipse_pix(*p.P(0, 6.5), 3.3, 3.3)
        for (x, y) in pix:
            p.g.set(x, y, None)
        p.ell(0, 12, 2, 1.6, ("G", "l"))
    elif rid == "mushroom_charm":
        p.rect(-1.5, 1, 1.5, 6, ("T", "4")); p.ell(0, 8, 6, 4, ("r", "R", "e"))
        p.rect(-6, 6, 6, 7, ("R",)); p.px(-2, 9, "4"); p.px(2, 10, "4")
    elif rid == "druid_totem":
        p.rect(-3, 0, 3, 13, ("n", "N", "t")); p.ln(-3, 9, 3, 9, "n"); p.ln(-3, 4, 3, 4, "n")
        p.px(-1, 11, "l"); p.px(1, 11, "l"); p.poly([(-6, 12), (-3, 10), (-3, 13)], ("G",))
        p.poly([(6, 12), (3, 10), (3, 13)], ("G",))
    else:
        raise KeyError(rid)


def icon_list():
    names = {}
    for n in NODES:
        names[f"node_{n}"] = f"icons/node_{n}.png"
    for t in TYPES:
        names[t] = f"icons/type_{t}.png"
    for s in STATUSES:
        names[f"status_{s}"] = f"icons/status_{s}.png"
    names["mana"] = "icons/mana.png"
    names["acorn"] = "icons/acorn.png"
    for pid in POTIONS:
        names[f"potion_{pid}"] = f"icons/potion_{pid}.png"
    for r in RELICS:
        names[f"relic_{r}"] = f"icons/relic_{r}.png"
    for t in TYPES:
        names[f"relic_charm_{t}"] = f"icons/relic_charm_{t}.png"
    return names


# ---------------------------------------------------------------- tiles
TILE = dict(
    meadow=dict(base="l", dots=[("G", 34), ("L", 26)], tuft="G", extra_b=[("U", 5), ("4", 5)]),
    marsh=dict(base="G", dots=[("g", 40), ("z", 20)], tuft="g", extra_b=[("B", 0)], puddle=("b", "B", "c")),
    scorched=dict(base="n", dots=[("r", 30), ("N", 30)], tuft=None, extra_b=[("o", 6)], crack=("R", "o")),
    canyon=dict(base="t", dots=[("N", 30), ("T", 30)], tuft=None, extra_b=[("n", 8)], crack=("N", "N")),
    rustwood=dict(base="N", dots=[("n", 34), ("t", 18), ("I", 8)], tuft=None, extra_b=[("o", 8), ("k", 4)]),
    glowcap=dict(base="P", dots=[("p", 36), ("v", 20)], tuft=None, extra_b=[("L", 7), ("s", 3)]),
    frostpine=dict(base="4", dots=[("C", 30), ("5", 26), ("3", 8)], tuft=None, extra_b=[("c", 8)]),
    heartwood=dict(base="g", dots=[("p", 30), ("n", 26)], tuft=None, extra_b=[("l", 5)], root=("n", "N")),
)


def tile(biome, variant):
    cfg = TILE[biome]
    rnd = random.Random(f"{biome}-{variant}")
    g = Grid(32)
    for y in range(32):
        for x in range(32):
            g.a[y][x] = cfg["base"]

    def put(x, y, k):
        g.a[y % 32][x % 32] = k
    for k, n in cfg["dots"]:
        for _ in range(n):
            x, y = rnd.randrange(32), rnd.randrange(32)
            put(x, y, k)
            if rnd.random() < 0.4:
                put(x + 1, y, k)
    if cfg.get("tuft"):
        for _ in range(7 if variant == "a" else 10):
            x, y = rnd.randrange(32), rnd.randrange(32)
            put(x, y, cfg["tuft"]); put(x - 1, y - 1, cfg["tuft"]); put(x + 1, y - 1, cfg["tuft"])
    if variant == "b":
        for k, n in cfg["extra_b"]:
            for _ in range(n):
                x, y = rnd.randrange(32), rnd.randrange(32)
                put(x, y, k)
                if k in ("U", "4", "L"):
                    put(x + 1, y, k); put(x, y + 1, k); put(x - 1, y, k); put(x, y - 1, k)
        if cfg.get("puddle"):
            cx, cy = rnd.randrange(8, 24), rnd.randrange(8, 24)
            for (x, y) in ellipse_pix(cx, cy, 6, 3.5):
                put(x, y, cfg["puddle"][1])
            for (x, y) in ellipse_pix(cx - 1, cy - 0.5, 4, 2):
                put(x, y, cfg["puddle"][2] if (x + y) % 5 == 0 else cfg["puddle"][1])
            for (x, y) in ellipse_pix(cx, cy + 1.5, 5, 1.6):
                if g.a[y % 32][x % 32] == cfg["puddle"][1]:
                    put(x, y, cfg["puddle"][0])
    if cfg.get("crack"):
        for _ in range(2 if variant == "a" else 4):
            x, y = rnd.randrange(32), rnd.randrange(32)
            for _ in range(8):
                put(x, y, cfg["crack"][0])
                if variant == "b" and rnd.random() < 0.3:
                    put(x, y - 1, cfg["crack"][1])
                x += rnd.choice((1, 1, 0)); y += rnd.choice((-1, 0, 1))
    if cfg.get("root"):
        for _ in range(2 if variant == "a" else 3):
            y = rnd.randrange(32)
            for x in range(32):
                put(x, y, cfg["root"][1]); put(x, y + 1, cfg["root"][0])
                if rnd.random() < 0.25:
                    y += rnd.choice((-1, 1))
    return g


def rock():
    g = Grid(32)
    p = Pen(g, 1.0)
    p.ell(-3, 9, 11, 9, ("1", "2", "3"), line="1")
    p.ell(7, 6, 7, 6, ("1", "2", "3"), line="1")
    p.ell(-8, 4, 5, 4, ("1", "2"), line="1")
    p.ln(-5, 15, -1, 9, "1"); p.ln(4, 9, 7, 4, "1")
    p.px(-7, 14, "4"); p.px(-6, 15, "4")
    p.ell(-2, 17, 3, 1, ("G", "l"))
    outline(g)
    return g


# ---------------------------------------------------------------- backgrounds (drawn 240x135, scaled 2x)
BG = dict(
    meadow=dict(sky=["c", "C", "w"], far="G", far2="l", near="l", ground=("G", "l"), sun="s"),
    marsh=dict(sky=["z", "Z", "w"], far="g", far2="z", near="G", ground=("g", "G"), water=("b", "B")),
    scorched=dict(sky=["r", "R", "o"], far="n", far2="r", near="N", ground=("n", "N"), volcano=True),
    canyon=dict(sky=["o", "y", "T"], far="N", far2="t", near="t", ground=("N", "t"), mesa=True),
    rustwood=dict(sky=["2", "3", "4"], far="1", far2="i", near="N", ground=("n", "N"), dead=True),
    glowcap=dict(sky=["p", "P", "v"], far="p", far2="P", near="P", ground=("p", "P"), shrooms=True),
    frostpine=dict(sky=["c", "C", "4"], far="z", far2="Z", near="4", ground=("C", "4"), pines=True),
    heartwood=dict(sky=["p", "p", "g"], far="p", far2="g", near="n", ground=("p", "n"), roots=True),
)


def background(biome):
    cfg = BG[biome]
    W, H = 240, 135
    rnd = random.Random(biome)
    g = Grid(W, H)
    # dithered 3-band sky
    sky = cfg["sky"]
    for y in range(H):
        t = y / 80
        band = min(2, int(t * 3))
        frac = t * 3 - band
        for x in range(W):
            k = sky[band]
            if band < 2 and frac > 0.7 and (x + y) % 2 == 0:
                k = sky[band + 1]
            g.a[y][x] = k

    def hills(base_y, amp, freq, k, seed):
        ph = rnd.random() * 10
        for x in range(W):
            h = base_y - amp * (0.6 * math.sin(x * freq + ph) + 0.4 * math.sin(x * freq * 2.3 + seed))
            for y in range(int(h), H):
                g.a[y][x] = k

    if cfg.get("volcano"):
        for (x, y) in poly_pix([(110, 70), (150, 25), (165, 25), (210, 70)]):
            g.set(x, y, "r")
        for (x, y) in poly_pix([(152, 25), (163, 25), (160, 45), (156, 38)]):
            g.set(x, y, "o")
        for i, (x, y, r) in enumerate(((158, 18, 6), (166, 10, 5), (155, 5, 4))):
            for (px_, py_) in ellipse_pix(x, y, r, r * 0.7):
                g.set(px_, py_, "2" if i % 2 == 0 else "3")
    if cfg.get("sun"):
        for (x, y) in ellipse_pix(40, 22, 9, 9):
            g.set(x, y, "s")
        for (x, y) in ellipse_pix(40, 22, 7, 7):
            g.set(x, y, "5")
    hills(60, 8, 0.03, cfg["far"], 1)
    if cfg.get("mesa"):
        for (x0, x1, top) in ((10, 60, 38), (130, 175, 30), (190, 235, 45)):
            for x in range(x0, x1):
                for y in range(top, 80):
                    g.set(x, y, "N" if x < x0 + 3 or y > top + 12 else "t")
            for x in range(x0, x1):
                g.set(x, top, "T")
            for y in range(top + 6, 80, 7):
                for x in range(x0 + 2, x1):
                    g.set(x, y, "n")
    hills(78, 6, 0.05, cfg["far2"], 2)
    if cfg.get("pines"):
        for _ in range(26):
            x = rnd.randrange(W); base = rnd.randrange(72, 92); h = rnd.randrange(18, 32)
            for (px_, py_) in poly_pix([(x - h / 3, base), (x, base - h), (x + h / 3, base)]):
                g.set(px_, py_, "z")
            for (px_, py_) in poly_pix([(x - h / 6, base - h * 0.55), (x, base - h), (x + h / 6, base - h * 0.55)]):
                g.set(px_, py_, "5")
            for yy in range(base, base + 4):
                g.set(x, yy, "n")
    if cfg.get("dead"):
        for _ in range(9):
            x = rnd.randrange(W); base = rnd.randrange(80, 95); h = rnd.randrange(25, 45)
            for (px_, py_) in line_pix(x, base, x + rnd.randint(-3, 3), base - h, 3):
                g.set(px_, py_, "i")
            for _ in range(4):
                yy = base - rnd.randrange(10, h)
                d = rnd.choice((-1, 1))
                for (px_, py_) in line_pix(x, yy, x + d * rnd.randrange(6, 12), yy - rnd.randrange(4, 9), 1):
                    g.set(px_, py_, "i")
        for _ in range(14):
            x = rnd.randrange(W); y = rnd.randrange(95, 110)
            for (px_, py_) in poly_pix([(x, y), (x + 5, y - 3), (x + 8, y)]):
                g.set(px_, py_, "o" if rnd.random() < 0.5 else "I")
    if cfg.get("shrooms"):
        for _ in range(8):
            x = rnd.randrange(W); base = rnd.randrange(85, 100); h = rnd.randrange(20, 45); r = h * 0.45
            for yy in range(int(base - h), base):
                for xx in range(x - 2, x + 3):
                    g.set(xx, yy, "v" if xx < x + 1 else "P")
            for (px_, py_) in ellipse_pix(x, base - h, r, r * 0.45):
                if py_ <= base - h + 1:
                    g.set(px_, py_, "v")
            for _ in range(5):
                a = rnd.random() * math.pi
                g.set(int(x + r * 0.7 * math.cos(a)), int(base - h - r * 0.3 * math.sin(a)), "L")
        for _ in range(40):
            g.set(rnd.randrange(W), rnd.randrange(0, 90), "s" if rnd.random() < 0.3 else "L")
    if cfg.get("roots"):
        for (x, w) in ((20, 26), (205, 30)):
            for yy in range(0, 110):
                for xx in range(x - w // 2, x + w // 2):
                    g.set(xx, yy, "N" if xx < x - w // 2 + 4 else "n")
        for _ in range(6):
            x0 = rnd.randrange(W)
            pts = [(x0, 95)]
            for _ in range(6):
                pts.append((pts[-1][0] + rnd.randint(-25, 25), pts[-1][1] + rnd.randint(2, 8)))
            for a, b in zip(pts, pts[1:]):
                for (px_, py_) in line_pix(a[0], a[1], b[0], b[1], 4):
                    g.set(px_, py_, "N")
        for _ in range(30):
            g.set(rnd.randrange(W), rnd.randrange(10, 100), "l")
    # ground plane (battle floor)
    gk = cfg["ground"]
    for y in range(95, H):
        for x in range(W):
            if g.a[y][x] in (cfg["far2"], cfg["far"]) or y > 98:
                g.a[y][x] = gk[1]
    for _ in range(600):
        x, y = rnd.randrange(W), rnd.randrange(99, H)
        g.set(x, y, gk[0])
    for x in range(W):
        g.set(x, 98, gk[0])
    if cfg.get("water"):
        for (cx, cy, rx) in ((40, 116, 34), (140, 122, 44), (215, 112, 22)):
            for (x, y) in ellipse_pix(cx, cy, rx, rx * 0.16):
                g.set(x, y, cfg["water"][0])
            for (x, y) in ellipse_pix(cx, cy - 0.5, rx - 2, rx * 0.16 - 1):
                g.set(x, y, cfg["water"][1] if (x * 3 + y) % 11 else "c")
        for _ in range(20):
            x = rnd.randrange(W)
            for yy in range(100, 112):
                g.set(x, yy, "g")
            g.set(x, 99, "N")
    if biome == "meadow":
        for _ in range(60):
            x, y = rnd.randrange(W), rnd.randrange(80, H)
            g.set(x, y, rnd.choice(("U", "4", "e")))
    return g


# ---------------------------------------------------------------- druid + logo
def druid():
    g = Grid(48)
    p = Pen(g, 1.0)
    p.ln(12, 0, 13, 34, "N", 2, foot=True)                        # staff
    p.ln(12, 0, 12.5, 34, "n", 1, foot=True)
    p.poly([(11, 34), (15, 34), (16, 38), (13, 42), (10, 38)], ("2", "3"), line="1")  # dim crystal
    p.px(12, 39, "4")
    cloak = [(-10, 0), (9, 0), (7, 14), (5, 26), (-5, 26), (-8, 14)]
    p.poly(cloak, ("g", "G"), line="g", foot=True)
    for x in range(-9, 9, 3):                                      # leaf hem
        p.poly([(x, 0), (x + 1.5, 3), (x + 3, 0)], ("G", "l" if False else "G"))
        p.px(x + 1.5, 2, "g")
    p.ell(-2, 5, 2.5, 1.5, ("T",)); p.ell(4, 5, 2.5, 1.5, ("T",))   # leaf patterns
    p.ln(4, 20, 11, 22, "G", 3, line="g")                          # arm to staff
    p.ell(12, 22, 2, 2, ("t", "T"))
    p.poly([(-7, 25), (-8, 34), (-3, 42), (4, 42), (8, 35), (7, 25)], ("g", "G"), line="g")  # hood
    p.ell(2, 31, 4.5, 5, ("t", "T"), line="N")                     # face
    p.poly([(-2, 37), (5, 37.5), (7, 34), (2, 38.5)], ("g",))
    p.eye(4, 32, 2)
    p.eye(0.5, 32, 2, side="far")
    p.px(5, 29, "N")
    return finish(g)


FONT = {
    "R": ["1110", "1001", "1001", "1110", "1010", "1001", "1001"],
    "O": ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
    "G": ["0111", "1000", "1000", "1011", "1001", "1001", "0111"],
    "U": ["1001", "1001", "1001", "1001", "1001", "1001", "0110"],
    "E": ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
    "F": ["1111", "1000", "1000", "1110", "1000", "1000", "1000"],
    "S": ["0111", "1000", "1000", "0110", "0001", "0001", "1110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
}


def logo():
    W, H = 240, 64
    g = Grid(W, H)
    text = "ROGUE FOREST"
    sc = 4
    widths = [(len(FONT[c][0]) if c != " " else 2) for c in text]
    total = sum(w * sc + sc for w in widths) - sc
    x = (W - total) // 2
    y0 = 20
    for c, w in zip(text, widths):
        if c != " ":
            for ry, row in enumerate(FONT[c]):
                for rx, bit in enumerate(row):
                    if bit == "1":
                        for yy in range(sc):
                            for xx in range(sc):
                                Y = y0 + ry * sc + yy
                                k = "L" if Y < y0 + 6 else ("l" if Y < y0 + 18 else "G")
                                g.set(x + rx * sc + xx, Y, k)
        x += w * sc + sc
    # leaves sprouting off the letters
    p = Pen(g, 1.0)
    for (lx, ly, d) in ((22, 22, -1), (112, 18, 1), (222, 19, 1)):
        X, Y = lx, ly
        for (px_, py_) in poly_pix([(X, Y), (X + d * 8, Y - 6), (X + d * 12, Y - 3), (X + d * 6, Y + 1)]):
            g.set(px_, py_, "G")
        for (px_, py_) in line_pix(X, Y, X + d * 11, Y - 4):
            g.set(px_, py_, "g")
    _ = p
    outline(g, "g")   # dark-green inner edge
    outline(g, "0")   # outer outline
    return g


def save(g, path, scale=1):
    im = Image.new("RGBA", (g.w, g.h), (0, 0, 0, 0))
    px = im.load()
    for y in range(g.h):
        for x in range(g.w):
            k = g.a[y][x]
            if k is not None:
                px[x, y] = rgba(k)
    if scale != 1:
        im = im.resize((g.w * scale, g.h * scale), Image.NEAREST)
    im.save(path)
    return im
