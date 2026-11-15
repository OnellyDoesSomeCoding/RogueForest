"""Convert a Rogue Forest text pixel sprite (see ART_SPRITES.md §4) into a PNG sprite sheet.

Usage:
    python3 pixel_to_png.py <input.txt> <output.png> [--size 48]

Requires Pillow:  pip install pillow
"""
import argparse
import sys

from PIL import Image

PALETTE = {
    ".": None,
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
EXPECTED_FRAMES = 6


def hex_to_rgba(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def parse_frames(text):
    frames, current = [], []
    for raw in text.splitlines():
        line = raw.rstrip("\r\n").rstrip()
        if line == "---":
            frames.append(current)
            current = []
        elif line:
            current.append(line)
    if current:
        frames.append(current)
    return frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--size", type=int, default=48, help="frame width/height in px (48 critters, 64 bosses)")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        frames = parse_frames(f.read())

    errors = []
    if len(frames) != EXPECTED_FRAMES:
        errors.append(f"expected {EXPECTED_FRAMES} frames, found {len(frames)}")
    for fi, frame in enumerate(frames):
        if len(frame) != args.size:
            errors.append(f"frame {fi}: {len(frame)} rows, expected {args.size}")
        for ri, row in enumerate(frame):
            if len(row) != args.size:
                errors.append(f"frame {fi} row {ri}: {len(row)} chars, expected {args.size}")
            bad = sorted({ch for ch in row if ch not in PALETTE})
            if bad:
                errors.append(f"frame {fi} row {ri}: unknown keys {bad}")
    if errors:
        print("Errors:\n  " + "\n  ".join(errors[:30]), file=sys.stderr)
        sys.exit(1)

    sheet = Image.new("RGBA", (args.size * len(frames), args.size), (0, 0, 0, 0))
    px = sheet.load()
    for fi, frame in enumerate(frames):
        for y, row in enumerate(frame):
            for x, ch in enumerate(row):
                color = PALETTE[ch]
                if color:
                    px[fi * args.size + x, y] = hex_to_rgba(color)
    sheet.save(args.output)
    print(f"Wrote {args.output} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
