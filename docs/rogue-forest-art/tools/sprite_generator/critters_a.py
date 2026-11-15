"""Critter drawings, part A (lines 1-7). Units = pixels, y up from the ground."""


def fox(p, st, stage):
    ph = st["ph"]
    flick = 1 if ph == "idleB" else 0
    if stage == 1:  # emberkit: sitting kit, big ears, tiny flame tail tip
        p.ell(-8, 8, 3, 6, ("r", "R", "o"))                       # tail curled up
        p.ell(-9.5, 13, 2.2, 2.4, ("4",))                          # pale tip
        p.flame(-9.5 - flick, 14, 7, 2.6, ("R", "o", "y"))
        p.ell(-1, 8, 7, 8, ("r", "R", "o"), line="r")              # body
        p.ell(2.5, 7, 3.2, 5, ("3", "4"), line="3")                # belly
        p.ell(-4, 4, 4, 4, ("r", "R", "o"), line="r")              # haunch
        p.ell(-3, 0.8, 3, 1.4, ("3", "4"), foot=True, line="r")    # back paw
        p.rect(2, 0, 4.6, 7, ("r", "R"), foot=True, line="r")       # front legs
        p.rect(5, 0, 7.6, 7, ("r", "R", "o"), foot=True, line="r")
        p.rect(2, 0, 4.6, 1.6, ("3", "4"), foot=True)
        p.rect(5, 0, 7.6, 1.6, ("3", "4"), foot=True)
        p.poly([(-3, 20), (-3, 30), (3, 23)], ("r", "R", "o"))     # far ear
        p.poly([(-2, 22), (-2, 27), (1, 23)], ("e",))
        p.ell(3, 18, 7.5, 6.5, ("r", "R", "o"), line="r")          # head
        p.poly([(2, 22), (7, 31), (9, 21)], ("r", "R", "o"), line="r")  # near ear
        p.poly([(4, 22.5), (7, 28), (8, 22)], ("e",))
        p.ell(8, 15.5, 3.4, 2.6, ("3", "4"), line="3")             # muzzle
        p.px(11, 17, "0")                                           # nose
        p.px(5, 15, "e"); p.px(6, 15, "e")                          # cheek
        p.eye(6, 19, 3)
        p.eye(0.5, 19, 2, side="far")
        p.mouth(8.5, 14.2, 2)
    elif stage == 2:  # cindervix: lean young fox, tail on fire, front paw lifted
        # burning tail raised behind
        p.ell(-11, 14, 3.5, 6, ("r", "R", "o"))
        p.flame(-12 - flick, 17, 15, 5, ("R", "o", "y"), lean=-2)
        p.rect(-8, 0, -5.5, 9, ("r", "R"), foot=True, line="r")    # far hind leg
        p.rect(4, 0, 6.5, 9, ("r", "R"), foot=True, line="r")      # far front leg
        p.ell(-1, 13, 10, 6, ("r", "R", "o"), line="r")            # body
        p.ell(1, 11, 6, 3, ("3", "4"), line="3")                   # chest/belly
        p.ell(-6, 11, 4.5, 5, ("r", "R", "o"), line="r")           # haunch
        p.rect(-6, 0, -3.4, 9, ("r", "R", "o"), foot=True, line="r")  # near hind
        p.ell(-4.4, 0.8, 2, 1.2, ("3", "4"), foot=True)
        lift = 3 if ph in ("idleA", "idleB", "hurt") else 1
        p.rect(7, lift, 9.6, 10, ("r", "R", "o"), foot=True, line="r")  # near front (lifted)
        p.rect(7, lift, 10, lift + 1.6, ("3", "4"), foot=True)
        p.ell(5, 0.8, 2, 1.2, ("3", "4"), foot=True)
        p.poly([(5, 24), (5, 33), (10, 26)], ("r", "R", "o"))      # far ear
        p.ell(9, 22, 7, 5.5, ("r", "R", "o"), line="r")            # head
        p.poly([(9, 25), (13, 34), (15, 24)], ("r", "R", "o"), line="r")
        p.poly([(11, 25.5), (13, 31), (14, 25)], ("e",))
        p.poly([(12, 21), (20, 19.5), (20, 18), (12, 17)], ("3", "4"), line="3")  # snout
        p.px(20, 19.5, "0")
        for (x, y) in ((10, 19), (12, 20), (9, 20.5)):               # ember speckles
            p.px(x, y, "y")
        p.eye(13, 23, 3)
        p.eye(8, 23, 2, side="far")
        p.mouth(15, 17.2, 3)
    else:  # pyrovulp: big fox, flame mane, two fire tails fanned
        p.flame(-15 - flick, 18, 22, 6, ("R", "o", "y"), lean=-5)  # back tail
        p.ell(-13, 16, 4, 7, ("r", "R"))
        p.flame(-9, 22, 22, 6, ("R", "o", "y"), lean=-1)           # front tail
        p.ell(-9, 18, 4, 7, ("r", "R", "o"))
        p.rect(-9, 0, -6, 12, ("r", "R"), foot=True, line="r")
        p.rect(6, 0, 9, 12, ("r", "R"), foot=True, line="r")
        p.ell(-1, 17, 12, 7.5, ("r", "R", "o"), line="r")
        p.ell(1, 14, 7, 3.5, ("o", "y"), line="o")
        p.ell(-7, 15, 5.5, 6, ("r", "R", "o"), line="r")
        p.rect(-7, 0, -3.5, 12, ("r", "R", "o"), foot=True, line="r")
        p.rect(9, 0, 12.5, 13, ("r", "R", "o"), foot=True, line="r")
        p.rect(-7.5, 0, -3, 1.8, ("o", "y"), foot=True)
        p.rect(9, 0, 13, 1.8, ("o", "y"), foot=True)
        # flame mane behind head
        p.flame(4, 21, 18, 7, ("R", "o", "y"), lean=-3)
        p.flame(9, 26, 14, 5, ("R", "o", "y"), lean=-2)
        p.poly([(9, 34), (10, 43), (14, 36)], ("r", "R", "o"))
        p.ell(13, 31, 7.5, 6, ("r", "R", "o"), line="r")
        p.poly([(13, 34), (18, 44), (20, 33)], ("r", "R", "o"), line="r")
        p.poly([(15, 35), (18, 41), (19, 34)], ("o",))
        p.poly([(16, 30), (24, 28.5), (24, 27), (16, 25)], ("R", "o"), line="r")
        p.px(24, 28.5, "0")
        p.eye(17, 32, 3, iris="0")
        p.eye(12, 32, 2, side="far")
        p.mouth(19, 26.2, 3)


def axolotl(p, st, stage):
    ph = st["ph"]
    flick = 1 if ph == "idleB" else 0
    if stage == 1:  # dewdle: round baby, sitting, stubby arms out
        p.ell(-9, 4, 5, 3, ("b", "B", "c"))                       # tail
        p.ell(0, 9, 9, 9, ("b", "B", "c"), line="b")              # body
        p.ell(1.5, 7, 5, 5.5, ("c", "C"), line="c")               # belly
        p.ell(-4, 1.5, 3, 1.8, ("b", "B"), foot=True, line="b")
        p.ell(4, 1.5, 3, 1.8, ("b", "B", "c"), foot=True, line="b")
        p.ell(8.5, 9, 3, 1.8, ("b", "B", "c"), line="b")          # arm out
        p.ell(-8.5, 10, 2.5, 1.8, ("b", "B"), line="b")
        # gill frills (3 per side)
        for i, (x, y) in enumerate(((-9, 20), (-10, 17), (-9, 14))):
            p.ell(x - flick * (i == 0), y, 2.6, 1.3, ("e",))
        for (x, y) in ((8, 22), (10, 19), (10, 16)):
            p.ell(x, y, 2.6, 1.3, ("e",))
        p.ell(0, 17, 9, 6.5, ("b", "B", "c"), line="b")           # head
        p.eye(4, 18, 3)
        p.eye(-2, 18, 3, side="far")
        p.poly([(-1, 14.5), (5, 14.5), (2, 13)], ("0",))           # big smile
        p.px(0, 14.2, "0")
        p.px(6.5, 15.5, "e"); p.px(-3.5, 15.5, "e")
    elif stage == 2:  # brookle: standing on hind legs, tail curving
        p.poly([(-4, 4), (-12, 2), (-17, 7), (-15, 12), (-12, 7), (-5, 9)], ("b", "B", "c"))
        p.ell(-2, 3, 3, 3, ("b", "B"), foot=True)
        p.ell(0, 13, 7, 11, ("b", "B", "c"), line="b")
        p.ell(2, 11, 4, 7.5, ("c", "C"), line="c")
        p.ell(3, 2, 3.5, 2, ("b", "B", "c"), foot=True, line="b")
        p.ell(-3, 1.6, 3, 1.6, ("b", "B"), foot=True, line="b")
        p.ln(5, 16, 9, 13, "B", 3, line="b")
        p.ln(-5, 16, -8, 13, "b", 2)
        for i, (x, y) in enumerate(((-9, 32), (-11, 28), (-11, 24), (-9, 21))):
            p.ell(x - flick * (i == 0), y, 3.4, 1.5, ("C", "e") if i % 2 == 0 else ("e",))
        for (x, y) in ((8, 33), (11, 29), (11, 25), (9, 22)):
            p.ell(x, y, 3.4, 1.5, ("e",))
        p.ell(0, 26, 9, 7, ("b", "B", "c"), line="b")
        p.ell(0, 33, 2, 2.5, ("c", "C"))                           # droplet
        p.poly([(-1.5, 34), (1.5, 34), (0, 37)], ("c",))
        p.px(-0.5, 33.5, "5")
        p.eye(4, 27, 3)
        p.eye(-2.5, 27, 3, side="far")
        p.poly([(-1, 23), (6, 23), (2.5, 21.5)], ("0",))
        p.px(6.5, 24.5, "e")
    else:  # torrentail: coiled salamander, water ribbon tail swirling overhead
        # ribbon tail made of water
        tail = [(-6, 6), (-14, 10), (-17, 20), (-14, 30), (-6, 36), (4, 37), (11, 34),
                (13, 30), (8, 31), (0, 32), (-7, 29), (-11, 21), (-9, 13), (-3, 10)]
        p.poly(tail, ("B", "c", "C"), box=(-3, 22, 14, 14))
        p.poly([(-10, 22), (-8, 28), (-3, 31), (-2, 29), (-6, 25), (-8, 19)], ("C",))
        # coiled body
        p.ell(0, 7, 13, 6.5, ("b", "B", "c"), line="b")
        p.ell(3, 5, 8, 3, ("c", "C"), line="c")
        p.ell(-8, 2, 3, 2, ("b", "B"), foot=True, line="b")
        p.ell(9, 2, 3, 2, ("b", "B", "c"), foot=True, line="b")
        # neck + head raised
        p.poly([(4, 8), (13, 9), (15, 20), (9, 22)], ("b", "B", "c"), line="b")
        for (x, y) in ((6, 29), (5, 25), (7, 21)):
            p.ell(x, y, 3.6, 1.4, ("e",))
        for (x, y) in ((19, 30), (21, 26), (20, 22)):
            p.ell(x, y, 3.6, 1.4, ("C", "e"))
        p.ell(14, 24, 7, 5.5, ("b", "B", "c"), line="b")
        p.eye(17, 25, 3)
        p.eye(12, 25, 2, side="far")
        p.poly([(15, 21.5), (21, 21.5), (18, 20.4)], ("0",))
        p.px(19.5, 23, "e")


def hedgehog(p, st, stage):
    ph = st["ph"]
    flick = 1 if ph == "idleB" else 0
    if stage == 1:  # sproutle: round sitting ball, sprout on head
        # leaf quills on back
        for (x, y, a) in ((-8, 18, -1), (-11, 12, -1), (-10, 6, 0), (-4, 21, 0)):
            p.poly([(x, y), (x - 4 + a, y + 3), (x - 1, y + 5)], ("g", "G", "l"))
        p.ell(-1, 10, 10, 10, ("g", "G", "l"), line="g")            # quill coat
        p.ell(3, 9, 7, 8, ("n", "T"), line="t", hl=False)            # face/belly
        p.ell(3.5, 9, 6, 7, ("t", "T"), line="t")
        p.ell(-3, 1.5, 3, 1.8, ("n", "t"), foot=True, line="n")
        p.ell(5, 1.5, 3, 1.8, ("t", "T"), foot=True, line="n")
        # sprout
        b = flick
        p.ln(0, 20, 0, 24 - b, "G")
        p.ell(-2.5, 25 - b, 2.6, 1.4, ("G", "l"))
        p.ell(2.5, 25.5 - b, 2.6, 1.4, ("G", "l", "L"))
        p.eye(6, 12, 3)
        p.eye(1, 12, 2, side="far")
        p.px(10.5, 9.5, "n")
        p.px(8, 9, "e")
        p.mouth(7, 7.6, 2, "n")
    elif stage == 2:  # thornhog: four legs, low and solid, thorny vine quills
        p.rect(-9, 0, -6, 6, ("n", "t"), foot=True, line="n")
        p.rect(5, 0, 8, 6, ("n", "t"), foot=True, line="n")
        p.ell(-2, 10, 13, 8, ("g", "G", "l"), line="g")
        for (x, y) in ((-12, 13), (-9, 17), (-4, 19), (1, 19), (6, 17), (-14, 8)):
            p.poly([(x - 2, y), (x - 4, y + 5), (x + 1, y + 1)], ("g", "G"))
        for (x, y) in ((-7, 14), (0, 15), (-3, 10)):
            p.px(x, y, "L")
        p.ell(8, 9, 6, 5.5, ("t", "T"), line="t")
        p.rect(-6, 0, -3, 6, ("n", "t", "T"), foot=True, line="n")
        p.rect(8, 0, 11, 6, ("n", "t", "T"), foot=True, line="n")
        p.poly([(10, 11), (17, 8), (17, 6.5), (10, 6)], ("t", "T"), line="t")
        p.px(17, 8, "0")
        p.eye(11, 11, 3)
        p.eye(6.5, 11, 2, side="far")
        p.mouth(12, 5.4, 2, "n")
    else:  # briarback: armored boar-hedgehog, thicket of thorns, flowers, charging
        p.rect(-14, 0, -10, 9, ("n", "t"), foot=True, line="n")
        p.rect(7, 0, 11, 9, ("n", "t"), foot=True, line="n")
        p.ell(-3, 17, 16, 11, ("g", "G", "l"), line="g")
        for (x, y) in ((-17, 18), (-15, 24), (-10, 28), (-4, 30), (2, 29), (8, 26), (-18, 12), (12, 22)):
            p.poly([(x - 3, y - 1), (x - 6, y + 6), (x + 2, y + 1)], ("g", "G", "l"))
        for (x, y) in ((-10, 22), (2, 23), (-4, 15)):              # flowers
            p.ell(x, y, 1.6, 1.6, ("e",))
            p.px(x, y, "4")
        p.ell(-6, 8, 11, 4, ("n", "t"), line="n")                    # belly armor
        p.ell(9, 13, 7.5, 7, ("n", "t", "T"), line="n")              # head lowered
        p.rect(-10, 0, -6, 9, ("n", "t", "T"), foot=True, line="n")
        p.rect(11, 0, 15, 9, ("n", "t", "T"), foot=True, line="n")
        p.poly([(13, 13), (21, 9), (21, 6), (13, 7)], ("t", "T"), line="n")
        p.px(21, 8, "0")
        p.poly([(16, 7), (19, 3), (17, 8)], ("4",))                   # tusk
        p.eye(13, 15, 3)
        p.eye(8, 15, 2, side="far")
        p.mouth(16, 5.6, 2, "n")


def bunny(p, st, stage):
    ph = st["ph"]
    if stage == 1:  # pebbun: round, pebble ears up, stone-patch belly
        p.ell(-8, 6, 3, 3, ("t", "T"))                              # tail puff
        p.ell(0, 8, 9, 8, ("n", "N", "t"), line="n")
        p.ell(2.5, 7, 5, 5, ("2", "3"), line="2")                   # stone belly
        p.px(1, 8, "N"); p.px(3, 5, "N")
        p.ell(-4, 1.5, 3.5, 1.8, ("n", "N"), foot=True, line="n")
        p.ell(5, 1.5, 3.5, 1.8, ("N", "t"), foot=True, line="n")
        tilt = 1 if ph == "idleB" else 0
        p.ell(-3 - tilt, 25, 2.6, 6, ("2", "3"))                    # far pebble ear
        p.ell(3.5, 26, 3, 6.5, ("2", "3", "4"), line="2")
        p.ell(3.5, 26, 1.2, 4, ("N",))
        p.ell(1, 16, 7.5, 6.5, ("n", "N", "t"), line="n")
        p.eye(5, 17, 3)
        p.eye(-1, 17, 2, side="far")
        p.px(8, 14.5, "e")
        p.px(7.5, 15.5, "0")
        p.mouth(6, 13.4, 2, "n")
    else:  # boulderbun: heavy, boulder shoulders, cracked rock ears, feet planted
        p.ell(-12, 8, 3.5, 3.5, ("t", "T"))
        p.ell(-1, 13, 13, 12, ("n", "N", "t"), line="n")
        p.ell(1, 10, 7, 7, ("2", "3"), line="2")
        p.ell(-9, 18, 6, 5.5, ("2", "3", "4"), line="2")            # boulder shoulders
        p.ell(9, 18, 6, 5.5, ("2", "3", "4"), line="2")
        p.ln(-11, 21, -8, 17, "2"); p.ln(8, 21, 10, 16, "2")
        p.ell(-7, 2, 5.5, 2.5, ("n", "N"), foot=True, line="n")
        p.ell(7, 2, 5.5, 2.5, ("N", "t"), foot=True, line="n")
        p.ell(-4, 33, 3.5, 7, ("2", "3"))
        p.ell(4.5, 34, 4, 7.5, ("2", "3", "4"), line="2")
        p.ln(4, 39, 5, 34, "2"); p.ln(5, 34, 3.5, 30, "2")
        p.ell(1, 24, 8.5, 7, ("n", "N", "t"), line="n")
        p.eye(5, 25, 3)
        p.eye(-1.5, 25, 2, side="far")
        p.px(8.5, 22.5, "0")
        p.mouth(6, 21, 2, "n")


def bird(p, st, stage):
    ph = st["ph"]
    flap = 2 if ph in ("idleB", "windup") else 0
    if stage == 1:  # gustling: tiny round sparrow, curly crest, hopping
        p.ln(-1, 0, 0, 4, "o", foot=True); p.ln(2, 0, 2, 4, "o", foot=True)
        p.ell(-8, 9, 4, 2, ("z", "Z"))                              # tail
        p.ell(0, 11, 9, 8.5, ("z", "Z", "w"), line="z")
        p.ell(2.5, 9, 5, 5, ("Z", "w"), line="Z")
        p.poly([(-6, 14 + flap), (-12, 10 + flap), (-3, 7)], ("z", "Z"), line="z")  # wing out
        p.poly([(5, 14), (11, 12 + flap), (6, 9)], ("z", "Z", "w"), line="z")
        # swirl crest
        p.ln(0, 19, -1, 23, "z")
        p.ell(1.5, 24, 2.2, 2, ("Z", "w"))
        p.px(1.5, 24, "z")
        p.poly([(8, 14), (12, 12.5), (8, 11.5)], ("o", "y"))
        p.eye(5, 14, 3)
        p.eye(0, 14, 2, side="far")
        p.px(5, 11, "e")
    elif stage == 2:  # galefinch: sleek finch, long wing tips, mid-hop
        p.ln(-1, 0, 0, 5, "o", foot=True); p.ln(2, 0, 3, 5, "o", foot=True)
        p.poly([(-6, 10), (-17, 6), (-16, 9), (-5, 13)], ("z", "Z"))
        p.ell(0, 13, 8, 8, ("z", "Z", "w"), line="z")
        p.ell(2, 11, 5, 5, ("Z", "w"), line="Z")
        p.poly([(-5, 18 + flap), (-20, 24 + flap * 2), (-15, 15 + flap), (-4, 11)], ("z", "Z", "w"), line="z")
        p.poly([(2, 17), (14, 23 + flap * 2), (9, 13)], ("z", "Z", "w"), line="z")
        p.ell(4, 23, 6, 5.5, ("z", "Z", "w"), line="z")
        p.ln(2, 28, 0, 33, "z", 2)
        p.ell(2, 34.5, 2.8, 2.4, ("Z", "w"))
        p.px(2, 34, "z"); p.px(3, 34, "z")
        p.poly([(9, 24), (14, 22), (9, 21)], ("o", "y"))
        p.eye(7, 24, 3)
        p.eye(2, 24, 2, side="far")
    else:  # tempestrel: stormy raptor, wings spread wide, wind streaks
        p.ln(-2, 0, -1, 6, "1", foot=True, line=None); p.ln(3, 0, 3, 6, "1", foot=True)
        p.poly([(-4, 9), (-12, 3), (-6, 3), (0, 9)], ("z", "Z"))
        # wings spread, hovering
        up = flap
        lw = [(-3, 22), (-22, 36 + up), (-22, 30 + up), (-19, 26 + up), (-21, 22 + up), (-16, 20 + up), (-17, 16 + up), (-5, 14)]
        rw = [(4, 22), (22, 38 + up), (22, 32 + up), (19, 28 + up), (21, 24 + up), (16, 21 + up), (16, 17 + up), (6, 14)]
        p.poly(lw, ("z", "Z", "w"), line="z")
        p.poly(rw, ("z", "Z", "w"), line="z")
        for (x0, y0) in ((-21, 32), (-19, 25), (20, 34), (19, 27)):  # wind streaks
            p.ln(x0, y0 + up, x0 - 2 if x0 < 0 else x0 + 2, y0 + up - 1, "w")
        p.ell(0, 15, 7, 9, ("z", "Z", "w"), line="z")
        p.ell(2, 13, 4, 6, ("w", "Z"), hl=False)
        p.ell(2, 27, 6, 5, ("z", "Z", "w"), line="z")
        p.ln(1, 31, -2, 37, "z", 2)
        p.ell(-1, 38, 3, 2.5, ("Z", "w"))
        p.px(-1, 38, "z")
        p.poly([(6, 28), (12, 26), (10, 23), (6, 24)], ("1", "3"))
        p.eye(5, 28, 3)
        p.eye(0, 28, 2, side="far")


def moth(p, st, stage):
    ph = st["ph"]
    flap = 2 if ph in ("idleB", "windup") else 0
    if stage == 1:  # lumoth: fuzzy, round wings with two glowing dots
        p.ell(-6, 17 + flap, 7, 7, ("z", "Z", "w"), line="z")      # back wing
        p.ell(-7, 8 + flap // 2, 5, 4, ("z", "Z"), line="z")
        p.ell(-5, 18 + flap, 2, 2, ("U", "s")); p.px(-5.5, 18.5 + flap, "s")
        p.ell(5, 18 + flap, 6.5, 7, ("z", "Z", "w"), line="z")     # front wing
        p.ell(5, 18 + flap, 2.2, 2.2, ("U", "s")); p.px(4.5, 19 + flap, "s")
        p.ell(0, 7, 4, 7, ("Z", "w"), line="Z")                     # fuzzy body
        p.ln(-1, 0, -1, 2, "z", foot=True); p.ln(2, 0, 2, 2, "z", foot=True)
        p.ell(1, 14, 5, 4.5, ("w", "4"), line="Z")                  # fluffy head
        p.ln(1, 18, -2, 23, "z"); p.ln(3, 18, 5, 23, "z")
        p.px(-2, 23, "U"); p.px(5, 23, "U")
        p.eye(3, 14, 2)
        p.eye(-0.5, 14, 2, side="far")
    else:  # lanternmoth: wings like paper lanterns, glowing abdomen
        lw = [(-2, 20), (-16, 34 + flap), (-21, 27 + flap), (-19, 16), (-10, 12)]
        rw = [(2, 20), (16, 36 + flap), (21, 28 + flap), (19, 16), (10, 12)]
        p.poly(lw, ("z", "Z", "w"), line="z")
        p.poly(rw, ("z", "Z", "w"), line="z")
        p.ell(-13, 26 + flap / 2, 3, 3.4, ("U", "s"))
        p.ell(13, 27 + flap / 2, 3, 3.4, ("U", "s"))
        for x in (-16, -10, 10, 16):
            p.ln(x, 16, x, 22, "Z")
        p.poly([(-4, 12), (-14, 2), (-9, 1), (-2, 8)], ("z", "Z"), line="z")
        p.poly([(4, 12), (14, 2), (9, 1), (2, 8)], ("z", "Z", "w"), line="z")
        p.ell(0, 9, 4, 8, ("u", "U", "s"), line="u")                # glowing abdomen
        for y in (6, 10, 14):
            p.ln(-3, y, 3, y, "u")
        p.ln(-1, 0, -1, 2, "z", foot=True); p.ln(1, 0, 1, 2, "z", foot=True)
        p.ell(0, 21, 4.5, 4.5, ("Z", "w"), line="z")
        p.ell(1, 26, 4.5, 4, ("w", "4"), line="Z")
        p.ln(0, 30, -5, 37, "z"); p.ln(2, 30, 7, 37, "z")
        p.ell(-5.5, 37.5, 1.2, 1, ("U",)); p.ell(7.5, 37.5, 1.2, 1, ("U",))
        p.eye(3, 26, 3)
        p.eye(-1, 26, 2, side="far")


def owl(p, st, stage):
    ph = st["ph"]
    tilt = 1 if ph in ("idleA", "idleB") else 0
    if stage == 1:  # shadewick: round owlet, dusk feathers, big glowing eyes, head tilted
        p.ln(-2, 0, -2, 3, "U", foot=True); p.ln(2, 0, 2, 3, "U", foot=True)
        p.ell(0, 10, 9, 8.5, ("p", "P", "v"), line="p")
        p.ell(1.5, 9, 5, 5.5, ("P", "v"), line="P")
        for y in (7, 10):
            p.px(0, y, "p"); p.px(3, y, "p")
        p.poly([(-8, 13), (-11, 6), (-6, 4)], ("p", "P"), line="p")
        p.ell(0.5, 20 + tilt * 0.5, 8, 6.5, ("p", "P", "v"), line="p")
        p.poly([(-6, 24), (-8, 28), (-3, 25.5)], ("p", "P"))       # ear tufts
        p.poly([(5, 25.5 + tilt), (8, 29 + tilt), (8, 24)], ("p", "P", "v"))
        p.ell(-2.5, 20, 3, 3, ("p",))                               # eye discs
        p.ell(4, 20.5, 3.2, 3.2, ("p",))
        p.poly([(0.5, 18), (2.5, 18), (1.5, 15.5)], ("U",))         # beak
        p.eye(4, 20.5, 3, iris="U", glow="s")
        p.eye(-2.5, 20, 3, iris="U", side="far", glow="s")
    else:  # duskowl: tall, cloak wings wrapped like a cape, candle eyes
        p.ln(-2, 0, -2, 3, "U", foot=True); p.ln(2, 0, 2, 3, "U", foot=True)
        p.ell(0, 15, 9, 13, ("p", "P", "v"), line="p")
        cape = [(-10, 26), (-12, 12), (-9, 2), (-1, 3), (1, 16), (0, 27)]
        p.poly(cape, ("p", "P", "v"), line="p")
        cape2 = [(10, 26), (12, 12), (9, 2), (2, 3), (1, 16), (2, 27)]
        p.poly(cape2, ("p", "P", "v"), line="p")
        for y in (8, 13, 18):
            p.ln(-8, y, -3, y + 1, "p"); p.ln(8, y, 4, y + 1, "p")
        p.ell(1, 31, 8.5, 7, ("p", "P", "v"), line="p")
        p.poly([(-5, 35), (-8, 41), (-2, 37)], ("p", "P"))
        p.poly([(6, 37 + tilt), (9, 42 + tilt), (9, 35)], ("p", "P", "v"))
        p.ell(-2, 31, 3, 3.3, ("p",)); p.ell(4.5, 31.5, 3.2, 3.4, ("p",))
        p.flame(-2, 33.5, 4, 1.3, ("U", "s"))                      # candle flames over eyes
        p.flame(4.5, 34, 4, 1.3, ("U", "s"))
        p.poly([(0.5, 29), (2.5, 29), (1.5, 26)], ("U",))
        p.eye(4.5, 31.5, 3, iris="U", glow="s")
        p.eye(-2, 31, 3, iris="U", side="far", glow="s")
