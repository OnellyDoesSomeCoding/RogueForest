import sys
from engine import build_frames, check_sheet, idle_height
from registry import CRITTERS, SIZE_RANGE, drawer, entry
from preview import sheet_image, stack

ids = sys.argv[2:] or list(CRITTERS)
imgs, labels = [], []
for cid in ids:
    fn, stage, faint, sc, sx = entry(cid)
    fr = build_frames(drawer(fn, stage, sc, sx=sx), 48, faint)
    h = idle_height(fr)
    lo, hi = SIZE_RANGE[stage]
    probs = check_sheet(fr, 48)
    if not (lo - 1 <= h <= hi + 1):
        probs.append(f"height {h} (want {lo}-{hi})")
    labels.append(f"{cid} h={h} colours={len(set().union(*[f.keys() for f in fr]))} {'; '.join(probs)}")
    print(labels[-1])
    imgs.append(sheet_image(fr, 3))
stack(imgs, labels).save(sys.argv[1])
