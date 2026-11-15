"""Rogue Forest sprite engine.

Draws sprites on a grid of palette keys (ART_SPRITES.md §2), then builds the
6-frame animation (idle A, idle B, windup, strike, hurt, faint), adds the 1 px
outline and checks the style rules.
"""
import math
from PIL import Image

PALETTE = {
    "0": "#1a1423", "1": "#3b2f45", "2": "#6b5d73", "3": "#a89bb0", "4": "#e8e1ea", "5": "#ffffff",
    "e": "#e87aa0",
    "r": "#7a1f1f", "R": "#c4352b", "o": "#f07b2e", "y": "#ffc94a",
    "b": "#1d3a6b", "B": "#2f6fbf", "c": "#5fb7e8", "C": "#b8ecff",
    "n": "#4a2e1f", "N": "#8a5a3a", "t": "#c48e5a", "T": "#e8c9a0",
    "z": "#4d8a8a", "Z": "#8fd1c4", "w": "#dff5ee",
    "g": "#1f4d2b", "G": "#3c8a3c", "l": "#7cc44a", "L": "#c8eb7a",
    "p": "#241838", "P": "#4a2f6b", "v": "#7d55a8",
    "u": "#b8902e", "U": "#f5d75a", "s": "#fff3b0",
    "i": "#3d4650", "I": "#6f7d8a", "k": "#a9b6c2",
}


def rgba(key):
    h = PALETTE[key].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


# ---------------------------------------------------------------- grid
class Grid:
    def __init__(self, w, h=None):
        self.w, self.h = w, (h if h is not None else w)
        self.a = [[None] * self.w for _ in range(self.h)]
        self.eyes = []      # recorded eyes: dict(x, y, size, iris, side)
        self.mouths = []    # recorded mouths: dict(x, y, w, k)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.a[y][x]
        return None

    def set(self, x, y, k):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y][x] = k

    def filled(self, x, y):
        return self.get(x, y) is not None

    def copy(self):
        g = Grid(self.w, self.h)
        g.a = [row[:] for row in self.a]
        g.eyes = [dict(e) for e in self.eyes]
        g.mouths = [dict(m) for m in self.mouths]
        return g

    def bbox(self):
        xs, ys = [], []
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x] is not None:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return None
        return min(xs), min(ys), max(xs), max(ys)

    def keys(self):
        return {k for row in self.a for k in row if k is not None}

    # ---- painting a set of pixels with shading + interior line
    def stamp(self, pix, ramp, box=None, line=None, hl=True):
        """pix: set of (x, y). ramp: key or (dark, mid[, light]).
        box: (cx, cy, rx, ry) used for shading direction.
        line: key for the edge where this part overlaps already-filled pixels."""
        if not pix:
            return
        if isinstance(ramp, str):
            ramp = (ramp,)
        if box is None:
            xs = [p[0] for p in pix]
            ys = [p[1] for p in pix]
            box = ((min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2,
                   max(1, (max(xs) - min(xs) + 1) / 2), max(1, (max(ys) - min(ys) + 1) / 2))
        cx, cy, rx, ry = box
        before = {(x, y) for (x, y) in pix if self.filled(x, y)}
        neighbor_filled = {}
        for (x, y) in pix:
            nf = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in pix and self.filled(*q):
                    nf = True
            neighbor_filled[(x, y)] = nf
        for (x, y) in pix:
            if line and neighbor_filled[(x, y)]:
                self.set(x, y, line)
                continue
            if len(ramp) == 1:
                k = ramp[0]
            else:
                nx = (x + 0.5 - cx) / rx
                ny = (y + 0.5 - cy) / ry
                t = 0.55 * nx + 0.85 * ny
                if t > 0.42:
                    k = ramp[0]
                elif len(ramp) >= 3 and hl and t < -0.55:
                    k = ramp[2]
                else:
                    k = ramp[1]
            self.set(x, y, k)
        _ = before


# ---------------------------------------------------------------- shapes (pixel space)
def ellipse_pix(cx, cy, rx, ry):
    out = set()
    rx = max(rx, 0.5)
    ry = max(ry, 0.5)
    for y in range(int(math.floor(cy - ry)) - 1, int(math.ceil(cy + ry)) + 1):
        for x in range(int(math.floor(cx - rx)) - 1, int(math.ceil(cx + rx)) + 1):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                out.add((x, y))
    return out


def poly_pix(pts):
    out = set()
    ys = [p[1] for p in pts]
    xs = [p[0] for p in pts]
    for y in range(int(math.floor(min(ys))) - 1, int(math.ceil(max(ys))) + 1):
        for x in range(int(math.floor(min(xs))) - 1, int(math.ceil(max(xs))) + 1):
            if _inside(x + 0.5, y + 0.5, pts):
                out.add((x, y))
    return out


def _inside(px, py, pts):
    c = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > py) != (yj > py):
            xc = (xj - xi) * (py - yi) / (yj - yi) + xi
            if px < xc:
                c = not c
        j = i
    return c


def line_pix(x0, y0, x1, y1, w=1):
    out = set()
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        if w <= 1:
            out.add((int(math.floor(x)), int(math.floor(y))))
        else:
            out |= ellipse_pix(x, y, w / 2, w / 2)
    return out


# ---------------------------------------------------------------- pen (unit space)
class Pen:
    """Draws in 'unit' coordinates: origin at ground centre, x right, y UP.
    s = pixels per unit. bob lowers every non-foot part (breathing / crouch)."""

    def __init__(self, g, s=1.0, bob=0, st=None, sx=1.0):
        self.g = g
        self.s = s
        self.sx = sx
        self.bob = bob
        self.st = st or {}
        self.gx = g.w / 2
        self.gy = g.h - 1  # continuous y of the ground line

    def P(self, x, y, foot=False):
        return (self.gx + x * self.s * self.sx, self.gy - y * self.s + (0 if foot else self.bob))

    def ell(self, x, y, rx, ry, ramp, line=None, foot=False, hl=True, minr=0.5):
        cx, cy = self.P(x, y, foot)
        rxp, ryp = max(rx * self.s * self.sx, minr), max(ry * self.s, minr)
        pix = ellipse_pix(cx, cy, rxp, ryp)
        self.g.stamp(pix, ramp, (cx, cy, rxp, ryp), line, hl)
        return pix

    def poly(self, pts, ramp, line=None, foot=False, hl=True, box=None):
        pp = [self.P(x, y, foot) for x, y in pts]
        pix = poly_pix(pp)
        b = None
        if box:
            bx, by = self.P(box[0], box[1], foot)
            b = (bx, by, box[2] * self.s * self.sx, box[3] * self.s)
        self.g.stamp(pix, ramp, b, line, hl)
        return pix

    def rect(self, x0, y0, x1, y1, ramp, line=None, foot=False, hl=True):
        return self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], ramp, line, foot, hl)

    def ln(self, x0, y0, x1, y1, k, w=1, foot=False, line=None):
        a = self.P(x0, y0, foot)
        b = self.P(x1, y1, foot)
        pix = line_pix(a[0], a[1], b[0], b[1], w * self.s if w > 1 else 1)
        self.g.stamp(pix, k, None, line)
        return pix

    def px(self, x, y, k, foot=False):
        X, Y = self.P(x, y, foot)
        self.g.set(int(math.floor(X)), int(math.floor(Y)), k)

    def eye(self, x, y, size=2, iris="0", side="near", glow=None):
        """Record an eye; drawn after the frame transform. (x, y) = eye centre."""
        X, Y = self.P(x, y)
        self.g.eyes.append(dict(x=X, y=Y, size=size, iris=iris, side=side, glow=glow))

    def mouth(self, x, y, w=2, k="0"):
        X, Y = self.P(x, y)
        self.g.mouths.append(dict(x=X, y=Y, w=w, k=k))

    def flame(self, x, y, h, w, keys=("R", "o", "y"), lean=0.0, line=None, foot=False):
        """Teardrop flame pointing up from (x, y)."""
        flick = 1 if self.st.get("ph") in ("idleB", "strike") else 0
        out = keys[0]
        pts = lambda sc: [
            (x - w * sc, y + h * 0.18 * sc),
            (x - w * 0.55 * sc, y + h * 0.55 * sc),
            (x + lean * sc - (0.4 * w * flick), y + h * sc),
            (x + w * 0.55 * sc, y + h * 0.5 * sc),
            (x + w * sc, y + h * 0.15 * sc),
            (x + w * 0.5 * sc, y - h * 0.05 * sc),
            (x - w * 0.5 * sc, y - h * 0.05 * sc),
        ]
        self.poly(pts(1.0), out, line=line, foot=foot)
        if len(keys) > 1:
            self.poly([(px_, py_ - h * 0.06) for px_, py_ in pts(0.62)], keys[1], foot=foot)
        if len(keys) > 2:
            self.poly([(px_, py_ - h * 0.08) for px_, py_ in pts(0.32)], keys[2], foot=foot)


# ---------------------------------------------------------------- eyes / mouths
def paint_eye(g, e, state):
    size = e["size"]
    iris = e["iris"]
    near = e["side"] == "near"
    w = 2 if size <= 2 else 3
    h = size if size >= 2 else 2
    if size == 1:
        w, h = 1, 2
    x0 = int(round(e["x"] - w / 2))
    y0 = int(round(e["y"] - h / 2))
    if state == "open":
        for yy in range(h):
            for xx in range(w):
                g.set(x0 + xx, y0 + yy, iris)
        if iris != "0" and size >= 3:
            # pupil
            for yy in range(1, h):
                g.set(x0 + w - 1, y0 + yy, "0")
        if size >= 2:
            g.set(x0, y0, e.get("glow") or "5")
        if size >= 4:
            g.set(x0 + 1, y0, e.get("glow") or "5")
    elif state == "blink":
        yy = y0 + h - 1
        for xx in range(w):
            g.set(x0 + xx, yy, "0")
    elif state == "squint":
        # >< style
        sw = max(w, 2)
        mid = y0 + h // 2
        if near:   # '<'
            g.set(x0 + sw - 1, mid - 1, "0"); g.set(x0, mid, "0"); g.set(x0 + 1, mid, "0")
            g.set(x0 + sw - 1, mid + 1, "0")
        else:      # '>'
            g.set(x0, mid - 1, "0"); g.set(x0 + sw - 1, mid, "0"); g.set(x0 + sw - 2, mid, "0")
            g.set(x0, mid + 1, "0")
    elif state == "x":
        cx = int(round(e["x"])) - 1
        cy = int(round(e["y"])) - 1
        for d in range(3):
            g.set(cx + d, cy + d, "0")
            g.set(cx + 2 - d, cy + d, "0")


def paint_mouth(g, m, state):
    x0 = int(round(m["x"]))
    y0 = int(round(m["y"]))
    if state in ("strike", "hurt"):
        for xx in range(m["w"]):
            g.set(x0 + xx, y0, "0")
        for xx in range(max(1, m["w"] - 1)):
            g.set(x0 + xx, y0 + 1, "e" if state == "strike" else "0")
    else:
        for xx in range(m["w"]):
            g.set(x0 + xx, y0, m["k"])


# ---------------------------------------------------------------- transforms
def shift(g, dx, dy):
    n = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            k = g.a[y][x]
            if k is not None:
                n.set(x + dx, y + dy, k)
    n.eyes = [dict(e, x=e["x"] + dx, y=e["y"] + dy) for e in g.eyes]
    n.mouths = [dict(m, x=m["x"] + dx, y=m["y"] + dy) for m in g.mouths]
    return n


def shear(g, k):
    """Lean: top rows move k px (positive = forward/right), bottom stays."""
    bb = g.bbox()
    if not bb or k == 0:
        return g.copy()
    _, y0, _, y1 = bb
    hgt = max(1, y1 - y0)
    off = lambda y: int(round(k * (y1 - y) / hgt))
    n = Grid(g.w, g.h)
    for y in range(g.h):
        o = off(y)
        for x in range(g.w):
            kk = g.a[y][x]
            if kk is not None:
                n.set(x + o, y, kk)
    n.eyes = [dict(e, x=e["x"] + off(int(e["y"]))) for e in g.eyes]
    n.mouths = [dict(m, x=m["x"] + off(int(m["y"]))) for m in g.mouths]
    return n


def transpose(g):
    n = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            k = g.a[y][x]
            if k is not None:
                n.set(y, x, k)
    n.eyes = [dict(e, x=e["y"], y=e["x"]) for e in g.eyes]
    n.mouths = []
    return n


def squash(g, sx, sy):
    """Scale around bottom-centre of bbox (nearest neighbour)."""
    bb = g.bbox()
    if not bb:
        return g.copy()
    x0, y0, x1, y1 = bb
    ax = (x0 + x1 + 1) / 2
    ay = y1 + 1
    n = Grid(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            srcx = ax + (x + 0.5 - ax) / sx
            srcy = ay + (y + 0.5 - ay) / sy
            k = g.get(int(math.floor(srcx)), int(math.floor(srcy)))
            if k is not None:
                n.set(x, y, k)
    n.eyes = [dict(e, x=ax + (e["x"] - ax) * sx, y=ay + (e["y"] - ay) * sy) for e in g.eyes]
    n.mouths = [dict(m, x=ax + (m["x"] - ax) * sx, y=ay + (m["y"] - ay) * sy) for m in g.mouths]
    return n


def outline(g, k="0"):
    add = []
    for y in range(g.h):
        for x in range(g.w):
            if g.a[y][x] is None:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if g.filled(x + dx, y + dy):
                        add.append((x, y))
                        break
    for x, y in add:
        g.set(x, y, k)
    return g


def anchor(g, ground_row, cx=None):
    """Move so the lowest filled row is ground_row and (optionally) bbox centred on cx."""
    bb = g.bbox()
    x0, _, x1, y1 = bb
    dx = 0 if cx is None else int(round(cx - (x0 + x1 + 1) / 2))
    return shift(g, dx, ground_row - y1)


# ---------------------------------------------------------------- frames
PHASES = [
    dict(ph="idleA", eye="open", bob=0),
    dict(ph="idleB", eye="blink", bob=1),
    dict(ph="windup", eye="open", bob=2),
    dict(ph="strike", eye="open", bob=0),
    dict(ph="hurt", eye="squint", bob=0),
    dict(ph="faint", eye="x", bob=0),
]


def _pad(g, n):
    big = Grid(g.w + 2 * n, g.h + 2 * n)
    for y in range(g.h):
        for x in range(g.w):
            big.a[y + n][x + n] = g.a[y][x]
    big.eyes = [dict(e, x=e["x"] + n, y=e["y"] + n) for e in g.eyes]
    big.mouths = [dict(m, x=m["x"] + n, y=m["y"] + n) for m in g.mouths]
    return big


def _crop(big, size, n, ground, keep_y=False):
    """Crop padded grid back to size, sliding horizontally so nothing is clipped.
    Lowest filled row lands on `ground` (or stays put when keep_y, if it fits)."""
    x0, y0, x1, y1 = big.bbox()
    ox = n
    if x0 - ox < 1:
        ox = x0 - 1
    if x1 - ox > size - 2:
        ox = x1 - (size - 2)
    oy = y1 - ground
    if keep_y and y1 - n <= ground:
        oy = n
    g = Grid(size)
    for y in range(size):
        for x in range(size):
            g.a[y][x] = big.get(x + ox, y + oy)
    g.eyes = [dict(e, x=e["x"] - ox, y=e["y"] - oy) for e in big.eyes]
    g.mouths = [dict(m, x=m["x"] - ox, y=m["y"] - oy) for m in big.mouths]
    return g


def build_frames(draw, size=48, faint="slump", lunge=3, sway=2):
    """draw(g, st) paints the fill (no outline) for phase st.
    Returns list of 6 finished Grids (with outline)."""
    ground = size - 2  # lowest fill row; outline lands on size-1
    n = 12
    raws = []
    for st in PHASES:
        g = Grid(size)
        draw(g, dict(st))
        raws.append(g)
    x0, _, x1, y1 = raws[0].bbox()
    dx = int(round(size / 2 - (x0 + x1 + 1) / 2))
    dy = ground - y1
    width = x1 - x0 + 1
    frames = []
    for st, g in zip(PHASES, raws):
        g = _pad(shift(g, dx, dy), n)
        ph = st["ph"]
        if ph == "windup":
            g = shift(shear(g, -sway), -2, 0)
        elif ph == "strike":
            g = shift(shear(g, sway), lunge, 0)
        elif ph == "hurt":
            g = shift(shear(g, -1), -2, 0)
        elif ph == "faint":
            if faint == "lie":
                g = transpose(g)
            else:
                g = shear(squash(g, min(1.15, (size - 4) / width), 0.62), -2)
        g = _crop(g, size, n, ground, keep_y=(ph == "idleB"))
        for e in g.eyes:
            paint_eye(g, e, st["eye"])
        for m in g.mouths:
            paint_mouth(g, m, ph)
        outline(g)
        frames.append(g)
    return frames


# ---------------------------------------------------------------- output
def frames_to_text(frames):
    blocks = []
    for f in frames:
        blocks.append("\n".join("".join(k if k is not None else "." for k in row) for row in f.a))
    return "\n---\n".join(blocks) + "\n"


def grid_to_image(g):
    im = Image.new("RGBA", (g.w, g.h), (0, 0, 0, 0))
    p = im.load()
    for y in range(g.h):
        for x in range(g.w):
            k = g.a[y][x]
            if k is not None:
                p[x, y] = rgba(k)
    return im


def check_sheet(frames, size, max_colors=12):
    """Return list of rule problems."""
    probs = []
    keys = set()
    for i, f in enumerate(frames):
        keys |= f.keys()
        bb = f.bbox()
        if bb is None:
            probs.append(f"frame {i} empty")
            continue
        x0, y0, x1, y1 = bb
        if y1 < size - 2:
            probs.append(f"frame {i}: not touching bottom 2 rows (lowest row {y1})")
        edge = [f.a[y][0] for y in range(size)] + [f.a[y][size - 1] for y in range(size)] + f.a[0]
        if any(k not in (None, "0") for k in edge):
            probs.append(f"frame {i}: clipped at canvas edge")
    if len(keys) > max_colors:
        probs.append(f"{len(keys)} colours used: {''.join(sorted(keys))}")
    bad = [k for k in keys if k not in PALETTE]
    if bad:
        probs.append(f"unknown keys {bad}")
    return probs


def idle_height(frames):
    bb = frames[0].bbox()
    return bb[3] - bb[1] + 1
