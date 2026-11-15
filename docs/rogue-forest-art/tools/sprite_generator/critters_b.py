"""Critter drawings, part B (lines 8-20). Units = pixels, y up from the ground."""


def firefly(p, st, stage):
    ph = st["ph"]
    glow = ("s",) if ph in ("idleB", "strike") else ("U", "s")
    if stage == 1:  # glimmet: chubby larva, curled, glowing bulb tail up
        p.ell(-7, 15, 4.5, 5, glow, line="u")                       # bulb tail
        p.ell(-7, 15, 2, 2.5, ("s",))
        p.ell(-6, 7, 4, 5, ("u", "U"), line="u")                    # curl segment
        p.ell(0, 5, 6, 5, ("u", "U", "s"), line="u")
        p.ell(-1, 4, 4, 2, ("3", "4"), line="3")                    # belly
        for x in (-4, 0, 4):
            p.ln(x, 0, x, 1, "u", foot=True)
        p.ell(6, 10, 6, 6, ("u", "U", "s"), line="u")               # head
        p.ln(7, 15, 6, 20, "u"); p.ln(9, 15, 11, 19, "u")
        p.eye(8.5, 11, 3)
        p.eye(4, 11, 2, side="far")
        p.px(10, 8.5, "e")
        p.mouth(8, 7.5, 2)
    else:  # radiantis: adult firefly, crystal wings, glowing body, halo, hovering upright
        p.poly([(-2, 24), (-16, 32), (-17, 22), (-6, 17)], ("3", "w", "5"), line="3")
        p.poly([(2, 24), (16, 34), (18, 23), (6, 17)], ("3", "w", "5"), line="3")
        p.ln(-12, 28, -4, 21, "3"); p.ln(13, 29, 5, 21, "3")
        p.ell(0, 9, 5, 8.5, glow, line="u")                         # glowing abdomen
        p.ell(-0.5, 9, 2.5, 5, ("s",))
        p.ln(-3, 0, -3, 2, "u", foot=True); p.ln(3, 0, 3, 2, "u", foot=True)
        p.ell(0, 19, 4.5, 4.5, ("u", "U"), line="u")                # thorax
        p.ln(-3, 18, 1, 15, "u", 2); p.ln(3, 18, 1, 15, "U", 2)      # arms together
        p.ell(1, 27, 5.5, 5, ("u", "U", "s"), line="u")             # head
        p.ln(0, 31, -2, 35, "u"); p.ln(3, 31, 5, 35, "u")
        p.ell(1, 37.5, 6, 1.6, ("U",)); p.ell(1, 37.5, 4, 0.6, ("w",))  # halo ring
        p.eye(4, 28, 3)
        p.eye(-1, 28, 2, side="far")
        p.mouth(3, 24.6, 2, "u")


def beetle(p, st, stage):
    if stage == 1:  # rivetle: small round beetle, riveted shell, 6 short legs, low
        for x in (-7, -2, 3):
            p.ln(x, 0, x + 1, 4, "i", foot=True)
        p.ell(-1, 8, 10, 7, ("i", "I", "k"), line="i")              # shell
        p.ln(-1, 15, -1, 3, "i")                                    # shell split
        for (x, y) in ((-6, 9), (-4, 12), (2, 12), (4, 9), (-7, 5), (5, 5)):
            p.px(x, y, "k")                                          # rivets
        for x in (-5, 0, 5):
            p.ln(x, 0, x + 1, 3, "I", foot=True)
        p.ell(9, 7, 4.5, 4.5, ("i", "I"), line="i")                  # head
        p.ln(11, 11, 13, 15, "i"); p.px(13.5, 15.5, "o")
        p.eye(11, 8, 2, iris="o")
        p.mouth(11.5, 4.5, 2)
    else:  # bastionbeetle: big rhino beetle, shield horn, plated armor, braced
        for x in (-12, -5, 2):
            p.ln(x, 0, x + 2, 7, "i", foot=True, line=None)
        p.ell(-3, 13, 13, 11, ("i", "I", "k"), line="i")
        p.ln(-3, 24, -3, 4, "i")
        for y in (8, 14, 19):
            p.ln(-14, y, 9, y, "i")
        for (x, y) in ((-9, 11), (-9, 17), (2, 11), (2, 17), (-6, 21), (0, 21)):
            p.px(x, y, "k")
        for x in (-9, -2, 5):
            p.rect(x, 0, x + 2, 6, ("i", "I"), foot=True, line="i")
        p.ell(11, 11, 6, 6, ("i", "I", "k"), line="i")              # head
        p.poly([(13, 14), (17, 30), (22, 32), (20, 26), (17, 12)], ("I", "k"), line="i")  # shield horn
        p.poly([(16, 22), (22, 25), (21, 20), (17, 18)], ("o",))
        p.eye(14, 11, 3, iris="o")
        p.eye(9.5, 11, 2, side="far", iris="o")
        p.mouth(14, 7, 3)


def otter(p, st, stage):
    ph = st["ph"]
    swing = 1 if ph in ("idleB",) else 0
    if stage == 1:  # claypaw: little otter, clay fur, wet blue paws & tail, holding a pebble
        p.poly([(-4, 4), (-12, 1 + swing), (-14, 4 + swing), (-5, 8)], ("B", "c"), line="B")
        p.ell(0, 9, 6, 9, ("n", "N", "t"), line="n")
        p.ell(1.5, 8, 3.5, 6, ("t", "T"), line="t")
        p.ell(-3, 1.3, 2.5, 1.5, ("B", "c"), foot=True, line="B")
        p.ell(3, 1.3, 2.5, 1.5, ("B", "c"), foot=True, line="B")
        p.ell(5, 12, 2.6, 2.6, ("2", "3"), line="2")                 # pebble
        p.ell(3, 10.5, 1.8, 1.6, ("B", "c"))                          # paws holding
        p.ell(6.5, 10.5, 1.6, 1.6, ("B", "c"))
        p.ell(1, 21, 6.5, 5.5, ("n", "N", "t"), line="n")
        p.ell(-3, 25, 1.6, 1.6, ("N",)); p.ell(4, 25.5, 1.6, 1.6, ("N", "t"))
        p.ell(4, 19.5, 3, 2.2, ("t", "T"))
        p.px(6.5, 20, "0")
        p.eye(4, 22, 2)
        p.eye(-1, 22, 2, side="far")
        p.mouth(3.5, 18, 2, "n")
    else:  # mireotter: larger otter, mud armor crust, dripping tail, upright
        p.poly([(-5, 6), (-15, 4 + swing * 2), (-19, 9 + swing * 2), (-16, 12), (-6, 11)], ("B", "c"), line="B")
        for (x, y) in ((-17, 2), (-12, 1)):
            p.ell(x, y + swing, 0.8, 1.2, ("c",), foot=True)           # drips
        p.ell(0, 13, 8, 12, ("n", "N", "t"), line="n")
        p.ell(1, 13, 6.5, 9, ("n", "N"), line="n")                    # mud crust
        for (x, y) in ((-2, 16), (3, 11), (0, 8), (4, 17)):
            p.ell(x, y, 1.5, 1.2, ("n",))
        p.ell(-3, 1.6, 3, 1.7, ("B", "c"), foot=True, line="B")
        p.ell(4, 1.6, 3, 1.7, ("B", "c"), foot=True, line="B")
        p.ln(6, 18, 10, 13, "N", 3, line="n")
        p.ell(10.5, 12, 1.8, 1.8, ("B", "c"))
        p.ell(1, 29, 7.5, 6.5, ("n", "N", "t"), line="n")
        p.ell(-4, 34, 2, 2, ("N",)); p.ell(4, 34.5, 2, 2, ("N", "t"))
        p.ell(5, 27, 3.4, 2.5, ("t", "T"))
        p.px(8, 28, "0")
        p.eye(4.5, 30, 3)
        p.eye(-1, 30, 2, side="far")
        p.mouth(4, 25, 2, "n")


def mushroom(p, st, stage):
    ph = st["ph"]
    puff = ph in ("idleB", "strike")
    if stage == 1:  # sporeling: tiny walking mushroom, purple cap, pale spots, sleepy eyes
        p.ell(-3, 1.5, 2.5, 1.6, ("G", "l"), foot=True, line="G")
        p.ell(3, 1.5, 2.5, 1.6, ("G", "l", "L"), foot=True, line="G")
        p.ell(0, 8, 5.5, 6.5, ("G", "L"), line="G")                  # stem body
        p.ell(1, 7, 3.5, 4, ("l", "L"))
        p.ell(0, 17, 11, 6.5, ("p", "P", "v"), line="p")             # cap
        p.rect(-10, 13, 10, 15, ("P",))
        p.poly([(-11, 14), (11, 14), (9, 11.5), (-9, 11.5)], ("p", "P"), line="p")
        for (x, y) in ((-5, 19), (2, 21), (6, 17), (-1, 17)):
            p.ell(x, y, 1.4, 1.2, ("L",))
        if puff:
            for (x, y) in ((-10, 24), (9, 25), (12, 21)):
                p.ell(x, y, 1, 1, ("v",))
        p.eye(3, 8.5, 2)
        p.eye(-1.5, 8.5, 2, side="far")
        p.ln(2, 9.5, 4, 9.5, "G"); p.ln(-2.5, 9.5, -0.5, 9.5, "G")   # sleepy lids
        p.mouth(1, 5.5, 2, "G")
    else:  # mycelord: tall mushroom sage, wide cap, root beard & arms raised, spore cloud
        if puff:
            for (x, y) in ((-16, 36), (15, 37), (-12, 40), (10, 41), (0, 42), (17, 31)):
                p.ell(x, y, 1.4, 1.4, ("v", "L"))
        p.poly([(-5, 0), (-7, 2), (-4, 4)], ("G",), foot=True)
        p.poly([(5, 0), (7, 2), (4, 4)], ("G",), foot=True)
        p.ell(0, 10, 7, 10, ("G", "l", "L"), line="G")               # stem body
        p.ln(-6, 15, -12, 27, "G", 2, line="G")                       # root arms raised
        p.ln(6, 15, 12, 27, "G", 2, line="G")
        p.ln(-12, 27, -14, 30, "G"); p.ln(-12, 27, -10, 30, "G")
        p.ln(12, 27, 14, 30, "G"); p.ln(12, 27, 10, 30, "G")
        p.poly([(-4, 12), (4, 12), (3, 4), (1, 6), (0, 2), (-1, 6), (-3, 4)], ("L", "4"), line="l")  # root beard
        p.ell(0, 27, 16, 7, ("p", "P", "v"), line="p")               # wide cap
        p.poly([(-16, 24), (16, 24), (13, 21), (-13, 21)], ("p", "P"), line="p")
        for (x, y) in ((-9, 28), (-2, 31), (5, 29), (11, 26), (-12, 25)):
            p.ell(x, y, 1.6, 1.3, ("L",))
        p.ell(1, 16, 5, 3, ("l", "L"))
        p.eye(3.5, 16, 3)
        p.eye(-1.5, 16, 3, side="far")


def mole(p, st, stage):
    if stage == 1:  # ashmole: round sooty mole, glowing orange claws forward, digging
        p.ell(-1, 9, 10, 9, ("n", "N"), line="n")
        p.ell(-6, 1.5, 3, 1.8, ("n", "N"), foot=True, line="n")
        p.ell(1, 1.5, 3, 1.8, ("n", "N"), foot=True, line="n")
        p.ell(6, 11, 5.5, 5, ("n", "N", "t"), line="n")
        p.ell(11, 10, 2, 1.6, ("e",))                                 # nose
        for i, y in enumerate((3, 5.5, 8)):                            # glowing claws
            p.ln(8, y + 2, 13, y, "o", 1)
            p.px(13, y, "y")
        p.ell(8, 5, 3, 2.5, ("n", "N"), line="n")
        p.eye(7.5, 13, 2)
        p.eye(3.5, 13, 1, side="far")
        p.mouth(8, 8.2, 2)
        for (x, y) in ((-6, 13), (-3, 6)):
            p.px(x, y, "o")
    else:  # magmole: big mole, cracked lava-rock back, claws dripping magma, rearing up
        p.ell(-3, 3, 4, 3, ("n", "N"), foot=True, line="n")
        p.ell(4, 2, 4, 2, ("n", "N"), foot=True, line="n")
        p.ell(-2, 15, 10, 14, ("n", "N"), line="n")
        p.poly([(-11, 8), (-12, 18), (-8, 27), (-2, 29), (-4, 20), (-7, 12)], ("r", "n"), line="n")  # rock back
        p.ln(-10, 12, -7, 17, "R"); p.ln(-7, 17, -9, 22, "o"); p.ln(-6, 24, -4, 27, "R")
        p.ell(2, 14, 5, 8, ("N", "n"), line="n")
        p.ell(5, 29, 6.5, 6, ("n", "N"), line="n")
        p.ell(11, 28, 2.2, 1.8, ("e",))
        for side, x0 in ((0, 4), (1, 9)):                              # raised claws
            p.ln(x0, 20, x0 + 4, 26, "n", 3)
            for d in range(3):
                p.ln(x0 + 3 + d * 1.5, 27, x0 + 4 + d * 1.5, 31, "o")
                p.px(x0 + 4 + d * 1.5, 31, "y")
            p.ell(x0 + 4, 24.5, 0.8, 1.6, ("R",))                      # magma drip
        p.eye(7, 31, 2)
        p.eye(3, 31, 1, side="far")
        p.mouth(7, 25.5, 2)


def bee(p, st, stage):
    ph = st["ph"]
    buzz = 1 if ph in ("idleB", "windup") else 0
    if stage == 1:  # pollenbee: fluffy round bee, daisy on head, hovering
        p.ell(-5, 18 + buzz, 4, 5, ("w", "5"), line="w")             # wings
        p.ell(2, 19 + buzz, 4, 5, ("w", "5"), line="w")
        p.ell(-1, 9, 9, 8.5, ("u", "U", "s"), line="u")              # fluffy body
        for x in (-5, -1):
            p.ln(x, 3, x + 1, 15, "0")                                 # stripes
        p.ell(-9.5, 8, 1.5, 1.5, ("0",))                               # stinger
        p.ln(-2, 0, -2, 1, "0", foot=True); p.ln(2, 0, 2, 1, "0", foot=True)
        p.ell(5, 11, 5.5, 5.5, ("u", "U", "s"), line="u")             # face
        p.ln(4, 16, 3, 19, "0")
        for (x, y) in ((3, 23), (6, 21), (3, 18.5), (0, 21)):         # daisy
            p.ell(x, y, 1.8, 1.8, ("4", "5"))
        p.ell(3, 21, 1.3, 1.3, ("l", "U"))
        p.eye(7, 12, 3)
        p.eye(3, 12, 2, side="far")
        p.px(9.5, 9.5, "e")
        p.mouth(7, 8.5, 2)
    else:  # bloomqueen: regal bee, petal skirt, flower crown, glittery wings, arms open
        p.poly([(-2, 22), (-17, 33 + buzz), (-16, 23 + buzz), (-5, 18)], ("w", "5"), line="w")
        p.poly([(2, 22), (17, 34 + buzz), (17, 24 + buzz), (5, 18)], ("w", "5"), line="w")
        for (x, y) in ((-13, 29), (13, 30), (-10, 24), (12, 25)):
            p.px(x, y + buzz, "U")                                     # glitter
        p.poly([(-9, 2), (9, 2), (6, 11), (-6, 11)], ("G", "l"), line="G")  # petal skirt
        for x in (-6, -2, 2, 6):
            p.ln(x, 2, x * 0.7, 10, "G")
        p.ln(-2, 0, -2, 2, "0", foot=True); p.ln(2, 0, 2, 2, "0", foot=True)
        p.ell(0, 15, 6, 6, ("u", "U", "s"), line="u")                 # body
        p.ln(-5, 13, 5, 13, "0"); p.ln(-5, 17, 5, 17, "0")
        p.ln(-5, 18, -11, 22, "u", 2); p.ln(5, 18, 11, 22, "U", 2)    # arms open
        p.ell(1, 26, 6, 5.5, ("u", "U", "s"), line="u")
        p.ln(-1, 31, -3, 35, "0"); p.ln(3, 31, 5, 35, "0")
        for (x, y) in ((-4, 31), (0, 33), (4, 33), (7, 31)):           # flower crown
            p.ell(x, y, 1.8, 1.8, ("l", "L"))
            p.px(x, y, "U")
        p.eye(4, 27, 3)
        p.eye(-1, 27, 2, side="far")
        p.mouth(3, 23.6, 2)


def deer(p, st, stage):
    if stage == 1:  # frostfawn: pale blue fawn, snowflake spots, antler nubs, thin legs
        p.ln(-6, 0, -6, 9, "c", foot=True); p.ln(4, 0, 4, 9, "c", foot=True)
        p.ell(-9, 14, 2, 2, ("4", "5"))                               # tail
        p.ell(-2, 13, 8, 5, ("c", "C", "4"), line="c")
        for (x, y) in ((-5, 15), (-1, 16), (-3, 12), (2, 14)):
            p.px(x, y, "5")
        p.ln(-4, 0, -4, 10, "C", foot=True, line="c"); p.ln(6, 0, 6, 10, "C", foot=True, line="c")
        p.px(-4, 0, "k"); p.px(6, 0, "k")
        p.ln(5, 15, 7, 21, "C", 3, line="c")                          # neck
        p.ell(8, 22, 4.5, 4, ("c", "C", "4"), line="c")
        p.poly([(10, 21), (14, 20), (13, 18.5), (10, 19)], ("C", "4"))
        p.px(14, 20, "0")
        p.ell(4, 25, 2.5, 1.3, ("c", "C"))                            # ear
        p.ln(6, 25, 6, 28, "k"); p.ln(9, 25, 10, 28, "k")              # antler nubs
        p.eye(9, 23, 2)
        p.eye(5.5, 23, 1, side="far")
    else:  # rimestag: huge stag, frozen steel antlers, frost chest, head high
        p.rect(-11, 0, -8.5, 13, ("c", "C"), foot=True, line="c")
        p.rect(5, 0, 7.5, 13, ("c", "C"), foot=True, line="c")
        p.ell(-2, 17, 12, 7, ("c", "C", "4"), line="c")
        p.ell(5, 16, 6, 6, ("i", "k", "4"), line="i")                 # frost-armored chest
        p.ln(2, 20, 8, 12, "i")
        p.rect(-8, 0, -5.5, 13, ("c", "C", "4"), foot=True, line="c")
        p.rect(8, 0, 10.5, 13, ("c", "C", "4"), foot=True, line="c")
        p.rect(-8, 0, -5.5, 1.5, ("i",), foot=True); p.rect(8, 0, 10.5, 1.5, ("i",), foot=True)
        p.poly([(6, 18), (11, 18), (14, 27), (9, 28)], ("c", "C", "4"), line="c")
        p.ell(12, 28, 5, 4, ("c", "C", "4"), line="c")
        p.poly([(14, 28), (19, 26), (18, 24), (14, 25)], ("C", "4"))
        p.px(19, 26, "0")
        p.ell(7, 31, 2.6, 1.3, ("c", "C"))
        for (bx, by, sgn) in ((10, 31, -1), (13, 31, 1)):             # steel antlers
            p.ln(bx, by, bx + sgn * 3, by + 7, "k", 1)
            p.ln(bx + sgn * 3, by + 7, bx + sgn * 2, by + 13, "k")
            p.ln(bx + sgn * 3, by + 7, bx + sgn * 8, by + 10, "k")
            p.ln(bx + sgn * 2, by + 4, bx - sgn * 1, by + 9, "I")
            p.px(bx + sgn * 2, by + 13, "C"); p.px(bx + sgn * 8, by + 10, "C")
        p.eye(13, 29, 2)
        p.eye(9.5, 29, 1, side="far")


def rat(p, st, stage):
    ph = st["ph"]
    if stage == 1:  # rustrat: scrappy rat, bolt tail tip, dented helmet, crouched to dash
        p.poly([(-7, 4), (-14, 6), (-16, 10), (-15, 11), (-13, 7.5), (-6, 7)], ("t",))
        p.rect(-18, 10, -14, 13, ("i", "I"), line="i")                # bolt tip
        p.ln(-16, 13, -16, 15, "I", 2)
        p.ell(-1, 7, 8, 6, ("i", "I", "k"), line="i")
        p.ell(1, 5.5, 4.5, 3, ("k", "4"), line="k")
        p.ell(-5, 1.4, 3, 1.5, ("t",), foot=True, line="i")
        p.ell(4, 1.4, 2.5, 1.5, ("t",), foot=True, line="i")
        p.ell(7, 10, 5, 4.5, ("i", "I", "k"), line="i")
        p.poly([(9, 10), (15, 8), (14, 6), (9, 7)], ("I", "k"), line="i")
        p.px(15, 8, "e")
        p.ell(4, 13, 2.5, 2.5, ("t", "e"))                             # ear
        p.ell(7, 13.5, 5, 2.6, ("P", "v"), line="P")                  # dented helmet
        p.rect(2, 12, 12, 13, ("P",))
        p.px(8, 15, "P"); p.px(6, 14.5, "p" if False else "P")
        p.eye(9, 10, 2)
        p.eye(5.5, 10, 1, side="far")
        p.mouth(10, 6.5, 2)
    else:  # scrapking: big rat in junk armor, bottlecap crown, chain tail, holding bent nail
        for i in range(5):                                             # chain tail
            p.ell(-8 - i * 2.5, 5 + i * 1.6, 1.4, 1.1, ("i", "k"))
        p.ell(0, 12, 8, 11, ("i", "I", "k"), line="i")
        p.poly([(-7, 18), (7, 18), (8, 6), (-7, 6)], ("P", "v"), line="P")  # junk armor
        for (x, y) in ((-4, 14), (3, 14), (-4, 9), (3, 9)):
            p.px(x, y, "k")
        p.ell(-4, 2, 3.5, 2, ("t",), foot=True, line="i")
        p.ell(4, 2, 3.5, 2, ("t",), foot=True, line="i")
        p.ln(5, 15, 10, 12, "I", 3, line="i")                          # arm
        p.ln(10, 9, 14, 30, "k", 2, line="i")                          # bent nail sword
        p.ln(14, 30, 12, 33, "k")
        p.rect(8, 11, 12, 13, ("i",))
        p.ell(9.5, 12, 1.7, 1.7, ("t",))
        p.ell(2, 26, 6.5, 5.5, ("i", "I", "k"), line="i")
        p.poly([(5, 26), (12, 24), (11, 22), (5, 23)], ("I", "k"), line="i")
        p.px(12, 24, "e")
        p.ell(-2, 30, 2.5, 2.8, ("t", "e"))
        p.poly([(-2, 30), (6, 30), (7, 34), (5, 32.5), (4, 35), (2, 32.5), (0, 35), (-1, 32.5), (-3, 34)], ("u", "o"), line="u")  # bottlecap crown
        p.eye(5, 27, 2)
        p.eye(1, 27, 2, side="far")
        p.mouth(6, 22.5, 2)


def wisp(p, st, stage):
    ph = st["ph"]
    alt = ph in ("idleB", "strike")
    # floating will-o'-wisp; tail wisp curls down to the ground line
    p.poly([(-4, 6), (-9, 2), (-6, 0), (-1, 2), (2, 6)], ("o", "y"))
    tip = (-1, 31) if alt else (3, 30)
    body = [(-8, 10), (-9, 17), (-6, 24), tip, (5, 24), (8, 17), (7, 10), (3, 6), (-4, 6)]
    p.poly(body, ("o", "U", "s"), box=(0, 16, 9, 12))
    inner = [(-5, 11), (-5, 17), (-3, 21), (tip[0] * 0.6, 26), (3, 21), (5, 16), (4, 11), (0, 9)]
    p.poly(inner, ("U", "s"))
    p.ell(-1, 13, 3, 3.5, ("s",))
    p.eye(2, 15, 3)
    p.eye(-3, 15, 2, side="far")
    p.px(4.5, 12.5, "y"); p.px(-4.5, 12.5, "y")
    p.mouth(0, 11, 2, "o")


def bat(p, st, stage):
    ph = st["ph"]
    flap = 2 if ph in ("idleB", "windup") else 0
    if stage == 1:  # cinderbat: tiny round bat, ember wing veins, wings out, fangs
        lw = [(-4, 14), (-15, 18 + flap), (-14, 12 + flap), (-12, 8 + flap), (-9, 10), (-7, 6), (-4, 8)]
        rw = [(4, 14), (15, 19 + flap), (15, 13 + flap), (13, 9 + flap), (10, 11), (8, 7), (4, 8)]
        p.poly(lw, ("1", "R"), line="1")
        p.poly(rw, ("1", "R", "o"), line="1")
        p.ln(-5, 12, -13, 16 + flap, "o"); p.ln(-6, 10, -11, 10 + flap, "o")
        p.ln(5, 12, 14, 17 + flap, "y"); p.ln(6, 10, 12, 11 + flap, "o")
        p.ell(0, 10, 6, 6.5, ("1", "2", "3"), line="1")
        p.ln(-2, 0, -2, 4, "1", foot=True); p.ln(2, 0, 2, 4, "1", foot=True)
        p.poly([(-5, 14), (-6, 21), (-2, 16)], ("1", "R"))           # ears
        p.poly([(2, 16), (5, 22), (6, 14)], ("1", "R"))
        p.eye(2.5, 12, 2, iris="y")
        p.eye(-2.5, 12, 2, side="far", iris="y")
        p.px(-1, 8, "4"); p.px(2, 8, "4")                              # fangs
        p.mouth(-1, 9, 4, "1")
    else:  # blazewing: large bat, burning wing edges, smoky trails, mid-swoop
        lw = [(-4, 22), (-21, 34 + flap), (-21, 24 + flap), (-18, 18 + flap), (-14, 20), (-11, 14), (-7, 16), (-4, 12)]
        rw = [(4, 22), (21, 36 + flap), (22, 26 + flap), (19, 20 + flap), (15, 22), (12, 16), (8, 18), (4, 12)]
        p.poly(lw, ("1", "r", "R"), line="1")
        p.poly(rw, ("1", "r", "R"), line="1")
        for (x0, y0, x1, y1) in ((-21, 34, -21, 24), (-21, 24, -18, 18), (21, 36, 22, 26), (22, 26, 19, 20)):
            p.ln(x0, y0 + flap, x1, y1 + flap, "y")
        p.flame(-20, 33 + flap, 5, 1.5, ("R", "y"))
        p.flame(21, 35 + flap, 5, 1.5, ("R", "y"))
        p.ell(-6, 26, 2, 1.5, ("2", "3")); p.ell(-8, 29, 1.5, 1.2, ("3",))  # smoke wisps
        p.ell(0, 16, 7, 9, ("1", "2", "3"), line="1")
        p.ln(-3, 0, -2, 7, "1", foot=True); p.ln(3, 0, 2, 7, "1", foot=True)
        p.ell(1, 27, 6, 5.5, ("1", "2", "3"), line="1")
        p.poly([(-4, 30), (-6, 38), (-1, 32)], ("1", "r"))
        p.poly([(3, 32), (6, 39), (7, 30)], ("1", "r"))
        p.eye(3.5, 28, 3, iris="y")
        p.eye(-1.5, 28, 2, side="far", iris="y")
        p.px(1, 24, "4"); p.px(4, 24, "4")
        p.mouth(0, 25, 5, "1")


def tortoise(p, st, stage):
    ph = st["ph"]
    peek = 0 if ph in ("idleB",) else 1
    if stage == 1:  # shellcrag: small tortoise peeking out of a rocky shell with iron ridges
        p.ell(-6, 1.5, 3, 2, ("N", "t"), foot=True, line="n")
        p.ell(5, 1.5, 3, 2, ("N", "t"), foot=True, line="n")
        p.ell(-1, 9, 11, 9, ("n", "N", "t"), line="n")               # rock shell
        p.ln(-11, 4, 10, 4, "n")
        for (x0, y0, x1, y1) in ((-8, 8, -4, 16), (-1, 18, -1, 6), (3, 15, 7, 7)):  # iron ridges
            p.ln(x0, y0, x1, y1, "I", 2, line="i" if False else None)
            p.ln(x0, y0, x1, y1, "k")
        p.ell(-6, 11, 1.5, 1.2, ("t",)); p.ell(5, 13, 1.2, 1, ("t",))
        p.ell(10 + peek, 7 + peek, 4.5, 4, ("N", "t", "T"), line="n")  # head peeking
        p.eye(11.5 + peek, 8 + peek, 2)
        p.eye(8 + peek, 8 + peek, 1, side="far")
        p.mouth(11 + peek, 5 + peek, 2, "n")
    else:  # fortortoise: massive tortoise, fortress shell with iron towers, stomping
        stomp = 2 if ph in ("windup",) else 0
        p.rect(-14, 0, -9, 8, ("n", "N"), foot=True, line="n")
        p.rect(6, stomp, 11, 8, ("n", "N"), foot=True, line="n")
        p.ell(-2, 14, 15, 11, ("n", "N", "t"), line="n")
        p.rect(-15, 6, 13, 9, ("n", "N"), line="n")
        for (x, w, h) in ((-11, 4, 30), (-3, 5, 34), (6, 4, 29)):     # iron towers
            p.rect(x, 20, x + w, h, ("i", "I", "k"), line="i")
            for d in range(0, w + 1, 2):
                p.rect(x + d - 0.5, h, x + d + 0.8, h + 2, ("I", "k"))
            p.rect(x + 1, h - 5, x + w - 1, h - 3, ("0",))           # window
        p.ln(-14, 16, 12, 18, "I")
        p.rect(-9, 0, -4, 8, ("n", "N", "t"), foot=True, line="n")
        p.rect(10, stomp, 15, 8, ("n", "N", "t"), foot=True, line="n")
        p.ell(16, 14, 5.5, 5, ("N", "t", "T"), line="n")
        p.eye(18, 15, 2)
        p.eye(14, 15, 1, side="far")
        p.mouth(17, 11.6, 3, "n")


def flower(p, st, stage):
    ph = st["ph"]
    wave = 2 if ph in ("idleB",) else 0
    if stage == 1:  # sunpetal: round face in yellow petals, leaf arms, on a stem, waving
        p.ell(0, 1.5, 4, 1.6, ("g", "G"), foot=True)
        p.ln(0, 2, 0, 11, "G", 2, line="g")                           # stem
        p.ell(-5, 7, 3.5, 1.6, ("G", "l"))                             # leaf arms
        p.poly([(1, 9), (7, 13 + wave), (9, 16 + wave), (5, 11)], ("G", "l"))
        for i in range(10):                                            # petal ring
            import math
            a = i * math.pi / 5
            p.ell(0 + 7 * math.cos(a), 18 + 7 * math.sin(a), 2.8, 2.8, ("u", "U", "s"))
        p.ell(0, 18, 6, 6, ("t", "T"), line="u")                       # face
        p.eye(2.5, 19, 2)
        p.eye(-2, 19, 2, side="far")
        p.px(4.5, 17, "e"); p.px(-4, 17, "e")
        p.mouth(0, 15.5, 2, "0")
    else:  # solbloom: tall sunflower spirit, glowing petal halo, long leaf arms raised
        import math
        p.ell(0, 1.5, 5, 1.8, ("g", "G"), foot=True)
        p.ln(0, 2, 0, 20, "G", 3, line="g")
        p.poly([(-1, 14), (-9, 22 + wave), (-12, 30 + wave), (-6, 23)], ("g", "G", "l"))
        p.poly([(1, 14), (9, 22 + wave), (12, 30 + wave), (6, 23)], ("g", "G", "l"))
        p.poly([(-1, 6), (-8, 10), (-3, 9)], ("g", "G"))
        for i in range(12):
            a = i * math.pi / 6
            p.ell(10 * math.cos(a), 29 + 10 * math.sin(a), 3, 3, ("u", "U", "s"))
        for i in range(12):                                            # glowing halo
            a = (i + 0.5) * math.pi / 6
            p.px(13.5 * math.cos(a), 29 + 13.5 * math.sin(a), "s")
        p.ell(0, 29, 7.5, 7.5, ("N", "t", "T"), line="u")
        p.eye(3, 30, 3)
        p.eye(-2.5, 30, 2, side="far")
        p.px(5, 27, "U")
        p.mouth(0, 25.5, 3, "N")


def frog(p, st, stage):
    ph = st["ph"]
    puff = 1 if ph in ("idleA", "strike") else 0
    if stage == 1:  # murkling: small round frog, dark teal, purple spots, big eyes, throat puffed
        p.ell(-6, 3, 5, 3.5, ("b", "B"), line="b")                    # haunch
        p.ell(0, 8, 9, 7, ("b", "B", "c"), line="b")
        for (x, y) in ((-5, 10), (-2, 13), (1, 9), (-6, 6)):
            p.ell(x, y, 1.3, 1.1, ("P", "v"))
        p.ell(5, 5.5, 3.5 + puff, 3 + puff, ("v", "c"), line="P")     # throat
        p.ell(-6, 1.3, 3.5, 1.5, ("b", "B"), foot=True, line="b")
        p.ell(5, 1.3, 2.5, 1.5, ("b", "B", "c"), foot=True, line="b")
        p.ell(-1, 17, 3.5, 3.5, ("b", "B", "c"), line="b")             # eye bumps
        p.ell(5, 17, 3.8, 3.8, ("b", "B", "c"), line="b")
        p.eye(5.5, 17, 3)
        p.eye(-0.5, 17, 3, side="far")
        p.mouth(4, 11, 4, "b")
    else:  # bogmaw: huge swamp toad, enormous mouth, moss & murk dripping, low crouch
        p.ell(-10, 5, 7, 5, ("b", "B"), line="b")
        p.ell(0, 12, 15, 11, ("b", "B", "v"), line="b")
        for (x, y) in ((-9, 15), (-4, 19), (2, 18), (-12, 9), (-6, 11)):
            p.ell(x, y, 1.7, 1.4, ("P", "v"))
        p.ell(-3, 22, 7, 2, ("G",))                                     # moss on back
        for x in (-8, -4, 1):
            p.ln(x, 21, x, 18, "G")
        p.ell(-10, 2, 5, 2, ("b", "B"), foot=True, line="b")
        p.ell(9, 2, 4, 2, ("b", "B", "v"), foot=True, line="b")
        p.ell(1, 25, 4.5, 4, ("b", "B", "v"), line="b")
        p.ell(9, 24, 4.8, 4.5, ("b", "B", "v"), line="b")
        # enormous mouth (open wider on strike)
        o = 2 if ph == "strike" else 0
        p.poly([(-2, 15), (15, 16), (14, 8 - o), (2, 11 - o)], ("p", "P"), line="p")
        p.poly([(4, 11 - o), (13, 9 - o), (13, 11), (5, 13)], ("e",))
        p.ln(15, 8, 15, 4, "G"); p.ln(9, 9 - o, 9, 6, "P")               # drips
        p.eye(9.5, 24, 3)
        p.eye(1.5, 25, 3, side="far")


CRITTERS = {
    "glimmet": (firefly, 1, "slump", 1.15), "radiantis": (firefly, 2, "slump", 0.88),
    "rivetle": (beetle, 1, "slump", 1.3, 0.95), "bastionbeetle": (beetle, 2, "slump"),
    "claypaw": (otter, 1, "slump"), "mireotter": (otter, 2, "slump"),
    "sporeling": (mushroom, 1, "slump"), "mycelord": (mushroom, 2, "slump"),
    "ashmole": (mole, 1, "slump", 1.3, 0.95), "magmole": (mole, 2, "slump"),
    "pollenbee": (bee, 1, "slump"), "bloomqueen": (bee, 2, "slump"),
    "frostfawn": (deer, 1, "slump"), "rimestag": (deer, 2, "slump", 0.8),
    "rustrat": (rat, 1, "slump", 1.4, 0.85), "scrapking": (rat, 2, "slump"),
    "wisplet": (wisp, 1, "slump", 0.88),
    "cinderbat": (bat, 1, "slump"), "blazewing": (bat, 2, "slump", 0.86),
    "shellcrag": (tortoise, 1, "slump", 1.25, 0.9), "fortortoise": (tortoise, 2, "slump"),
    "sunpetal": (flower, 1, "slump"), "solbloom": (flower, 2, "slump", 0.82),
    "murkling": (frog, 1, "slump", 1.12), "bogmaw": (frog, 2, "slump", 1.12, 0.95),
}
