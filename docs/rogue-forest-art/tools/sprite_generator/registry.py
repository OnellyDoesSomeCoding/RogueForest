"""Critter registry: stage id -> (draw function, stage, faint style, target height range)."""
from engine import Pen
import critters_a as A

SIZE_RANGE = {1: (24, 30), 2: (32, 38), 3: (40, 46)}

# id: (family fn, stage, faint)
CRITTERS = {
    "emberkit": (A.fox, 1, "slump", 0.88), "cindervix": (A.fox, 2, "slump", 0.92), "pyrovulp": (A.fox, 3, "slump", 0.98, 0.8),
    "dewdle": (A.axolotl, 1, "slump"), "brookle": (A.axolotl, 2, "slump"), "torrentail": (A.axolotl, 3, "slump", 1.0, 0.85),
    "sproutle": (A.hedgehog, 1, "slump"), "thornhog": (A.hedgehog, 2, "slump", 1.3, 0.9), "briarback": (A.hedgehog, 3, "slump", 1.12, 0.82),
    "pebbun": (A.bunny, 1, "slump", 0.82), "boulderbun": (A.bunny, 2, "slump", 0.82),
    "gustling": (A.bird, 1, "slump"), "galefinch": (A.bird, 2, "slump", 0.9), "tempestrel": (A.bird, 3, "slump", 1.0, 0.85),
    "lumoth": (A.moth, 1, "slump"), "lanternmoth": (A.moth, 2, "slump", 0.86, 0.9),
    "shadewick": (A.owl, 1, "slump", 0.9), "duskowl": (A.owl, 2, "slump", 0.8),
}

# 2-stage lines: stage 2 is the final stage; spec sizes are by stage number
try:
    import critters_b as B
    CRITTERS.update(B.CRITTERS)
except ImportError:
    pass


def entry(cid):
    t = CRITTERS[cid]
    fn, stage, faint = t[:3]
    s = t[3] if len(t) > 3 else 1.0
    sx = t[4] if len(t) > 4 else 1.0
    return fn, stage, faint, s, sx


def drawer(fn, stage, s=1.0, extra=None, sx=1.0):
    def draw(g, st):
        p = Pen(g, s, st["bob"], st, sx)
        fn(p, st, stage)
        if extra:
            extra(p, st)
    return draw
