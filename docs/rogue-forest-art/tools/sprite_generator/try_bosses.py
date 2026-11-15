import sys
from engine import build_frames, check_sheet, idle_height
from registry import drawer
from bosses import BOSSES
from preview import sheet_image, stack

TARGET = 56


def boss_frames(bid):
    fn, stage, extra = BOSSES[bid]
    s, sx = 1.0, 1.0
    for _ in range(3):
        fr = build_frames(drawer(fn, stage, s, extra, sx), 64, "slump")
        h = idle_height(fr)
        s *= TARGET / h
        bb = fr[0].bbox()
        w = bb[2] - bb[0] + 1
        if w > 56:
            sx *= 56 / w
    fr = build_frames(drawer(fn, stage, s, extra, sx), 64, "slump")
    return fr


if __name__ == "__main__":
    imgs, labels = [], []
    for bid in (sys.argv[2:] or BOSSES):
        fr = boss_frames(bid)
        probs = check_sheet(fr, 64)
        labels.append(f"{bid} h={idle_height(fr)} {'; '.join(probs)}")
        print(labels[-1])
        imgs.append(sheet_image(fr, 2))
    stack(imgs, labels).save(sys.argv[1])
