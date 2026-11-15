"""Make zoomed contact sheets for checking sprites by eye."""
from PIL import Image, ImageDraw

from engine import grid_to_image


def sheet_image(frames, zoom=4, bg=(236, 240, 228)):
    size = frames[0].w
    pad = 4
    im = Image.new("RGBA", ((size * zoom + pad) * len(frames) + pad, size * zoom + 2 * pad), bg + (255,))
    for i, f in enumerate(frames):
        fi = grid_to_image(f).resize((size * zoom, size * zoom), Image.NEAREST)
        x = pad + i * (size * zoom + pad)
        d = ImageDraw.Draw(im)
        d.rectangle([x - 1, pad - 1, x + size * zoom, pad + size * zoom], outline=(200, 205, 195))
        im.alpha_composite(fi, (x, pad))
    return im


def stack(images, label_list=None, bg=(236, 240, 228)):
    w = max(i.width for i in images)
    lh = 12 if label_list else 0
    h = sum(i.height + lh for i in images)
    out = Image.new("RGBA", (w, h), bg + (255,))
    d = ImageDraw.Draw(out)
    y = 0
    for n, i in enumerate(images):
        if label_list:
            d.text((4, y), label_list[n], fill=(40, 30, 50))
            y += lh
        out.alpha_composite(i, (0, y))
        y += i.height
    return out
