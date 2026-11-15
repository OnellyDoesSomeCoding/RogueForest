"""Boss sheets (64x64). Alpha bosses = final-stage critter redrawn bigger + gold crown / glowing marks."""
import critters_a as A
import critters_b as B


def glow_eyes(p, key="U"):
    for e in p.g.eyes:
        e["iris"] = key
        e["glow"] = "s"


def gold_crown(p, x, y, w, h=4):
    pts = [(x - w, y), (x + w, y), (x + w, y + h), (x + w * 0.5, y + h * 0.55),
           (x, y + h + 1), (x - w * 0.5, y + h * 0.55), (x - w, y + h)]
    p.poly(pts, ("u", "U", "s"), line="u")
    p.px(x, y + 1.5, "s")


def meadow(p, st):
    buzz = 1 if st["ph"] in ("idleB", "windup") else 0
    for (x, y) in ((-14, 29), (-11, 25), (14, 31), (12, 26), (-15, 32), (16, 34)):
        p.ell(x, y + buzz, 1.1, 1.1, ("s",))
    gold_crown(p, 1.5, 33, 5, 4)
    for (x, y) in ((-3, 35), (6, 35)):
        p.ell(x, y, 1.4, 1.4, ("l", "L"))


def marsh(p, st):
    glow_eyes(p)
    cloak = [(-17, 8), (-15, 20), (-8, 25), (0, 24), (5, 22), (2, 20), (-4, 21), (-10, 17), (-13, 9)]
    p.poly(cloak, ("g", "G", "l"), line="g")
    for (x, y) in ((-14, 6), (-9, 14), (-3, 18)):
        p.ln(x, y + 3, x, y - 2, "G")


def scorched(p, st):
    for (x0, y0, x1, y1) in ((-10, 12, -7, 17), (-7, 17, -9, 22), (-6, 24, -4, 27), (-11, 19, -9, 15)):
        p.ln(x0, y0, x1, y1, "U")
    for (x, y) in ((-4, 9), (-2, 14)):
        p.px(x, y, "U")
    flick = 1 if st["ph"] == "idleB" else 0
    for (x, y, r) in ((-8, 25, 2.4), (-10, 28 + flick, 1.8), (-12, 31 + flick, 1.2)):
        p.ell(x, y, r, r * 0.8, ("2", "3"))


def canyon(p, st):
    for (x, h) in ((-9, 30), (-0.5, 34), (8, 29)):
        p.ln(x, h + 2, x, h + 9, "i")
        wave = 1 if st["ph"] == "idleB" else 0
        p.poly([(x, h + 9), (x + 5, h + 8 - wave), (x + 4, h + 6.5), (x + 5, h + 5 - wave), (x, h + 6)], ("u", "U"))


def rustwood(p, st):
    # junk throne pieces on back
    p.rect(-14, 6, -9, 30, ("i", "I", "k"), line="i")
    p.rect(-15, 28, -8, 31, ("t",), line="i")
    p.ln(-13, 10, -10, 26, "i")
    p.ell(-11, 31.5, 1.5, 1.5, ("U",))
    # giant bottlecap crown
    pts = [(-4, 30), (8, 30), (10, 37), (7, 34), (6, 39), (4, 34.5), (2, 40), (0, 34.5), (-2, 39), (-3, 34), (-6, 37)]
    p.poly(pts, ("u", "U"), line="u")
    p.px(2, 32, "o")


def glowcap(p, st):
    p.ell(0, 27, 13, 5, ("s",))
    p.ell(0, 27, 11.5, 3.8, ("P",))
    p.ell(0, 28, 6, 2, ("U",))
    p.ell(0, 28, 4.5, 1.2, ("P",))
    off = 1 if st["ph"] in ("idleB", "strike") else 0
    for (x, y) in ((-17, 36), (16, 38), (-12, 41), (9, 42), (-1, 44), (18, 31), (-19, 30)):
        p.ell(x, y + off, 1.1, 1.1, ("s",))


def frostpine(p, st):
    for (x, y) in ((8, 41), (11, 44), (14, 44), (17, 41), (5, 38), (20, 38)):
        p.poly([(x - 1, y - 3), (x + 1, y - 3), (x, y + 2)], ("C", "w"))
    p.px(12.5, 39, "s"); p.px(4, 17, "s"); p.px(7, 14, "s")
    if st["ph"] in ("idleA", "strike", "windup"):
        p.ell(22, 25, 2.5, 1.6, ("C", "w"))
        p.ell(25, 26.5, 1.6, 1.2, ("w",))


def hollow_druid(p, st, stage=3):
    ph = st["ph"]
    pulse = ("L", "5") if ph in ("idleB", "strike") else ("l", "L")
    # robes of dead leaves
    robe = [(-12, 0), (12, 0), (9, 18), (6, 30), (-6, 30), (-10, 18)]
    p.poly(robe, ("n", "N", "t"), line="n", foot=True)
    for (x, y) in ((-9, 3), (-4, 6), (2, 4), (7, 7), (-6, 13), (4, 15), (-2, 20), (6, 22), (-8, 24)):
        p.poly([(x, y), (x + 2.5, y + 1.5), (x + 1, y - 1.5)], ("o", "u"))
    p.poly([(-12, 0), (-9, 2), (-6, 0), (-3, 2), (0, 0), (3, 2), (6, 0), (9, 2), (12, 0)], ("n",), foot=True)
    # far arm
    p.ln(-6, 26, -12, 16, "N", 3, line="n")
    p.ell(-12, 14, 1.8, 1.8, ("T", "t"))
    # hood
    p.poly([(-8, 28), (-9, 38), (-4, 46), (3, 46), (8, 40), (8, 28)], ("n", "N"), line="n")
    p.poly([(4, 46), (-2, 50), (-5, 46)], ("n", "N"))
    # cracked wooden mask
    p.ell(2, 37, 5, 6, ("t", "T"), line="N")
    p.ln(3, 43, 1, 38, "N"); p.ln(1, 38, 3, 34, "N")
    p.eye(4.5, 38, 2, iris="l", glow="L")
    p.eye(0, 38, 2, iris="l", glow="L", side="far")
    # near arm with stolen green glow
    p.ln(5, 25, 13, 20, "N", 3, line="n")
    p.ell(14.5, 21, 1.8, 1.8, ("T", "t"))
    p.ell(15, 26, 4.5, 4.5, ("G", "l", "L"))
    p.ell(15, 26, 2.5, 2.5, pulse)
    for (x, y) in ((11, 31), (19, 30), (20, 23), (15, 32)):
        p.px(x, y, "l")


BOSSES = {
    # boss id: (family fn, stage, draw extra, faint)
    "boss_meadow": (B.bee, 2, meadow),
    "boss_marsh": (B.frog, 2, marsh),
    "boss_scorched": (B.mole, 2, scorched),
    "boss_canyon": (B.tortoise, 2, canyon),
    "boss_rustwood": (B.rat, 2, rustwood),
    "boss_glowcap": (B.mushroom, 2, glowcap),
    "boss_frostpine": (B.deer, 2, frostpine),
    "boss_heartwood": (hollow_druid, 3, None),
}
