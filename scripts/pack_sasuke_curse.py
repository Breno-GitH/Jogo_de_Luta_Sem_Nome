"""Pack the reference-corrected whole-body cels with stable hip/sole pivots."""
from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/sasuke-curse-v2-source"
OUT = ROOT / "public/sprites/sasuke"
CELL = (384, 288)
PIVOT = (192, 248)
COLS = 8

# Set per sheet after checking the head-to-sole scale. Hip locations are absolute
# source-pixel x coordinates. Optional x/y cuts are transparent gutters.
PLATES = {
    "motion": (.467, [246, 677, 1114, 262, 688, 1122, 252, 677, 1111]),
    "aerial": (.480, [261, 703, 1097, 235, 658, 1104, 258, 662, 1128]),
    "ground": (.495, [250, 728, 1200, 248, 719, 1195, 228, 646, 1186]),
    "low": (.491, [244, 723, 1205, 219, 697, 1186, 216, 715, 1188]),
    "air": (.458, [216, 650, 1065, 212, 611, 1071, 195, 603, 1059]),
    "raiton": (.460, [241, 678, 1116, 241, 670, 1115, 238, 691, 1116]),
    "katon": (.454, [247, 685, 1122, 247, 681, 1119, 243, 678, 1121]),
    "utility": (.476, [250, 735, 1220, 249, 739, 1214, 269, 695, 1205]),
    "awakening": (.421, [211, 612, 1029, 210, 616, 1076, 209, 610, 1045]),
}
ACTIVE = {
    ("ground", 1): ((788, 159), (867, 155), 10),
    ("ground", 4): ((802, 552), (877, 546), 12),
    ("ground", 7): ((711, 908), (902, 851), 13),
    ("low", 1): ((798, 196), (849, 199), 10),
    ("low", 4): ((808, 655), (855, 670), 10),
    ("low", 7): ((752, 880), (824, 830), 15),
    ("air", 1): ((709, 177), (771, 169), 11),
    ("air", 4): ((710, 619), (779, 607), 13),
    ("air", 7): ((704, 1126), (757, 1162), 15),
}
EMISSION = {
    ("raiton", 0): (279, 155), ("raiton", 1): (783, 151),
    ("raiton", 3): (229, 557), ("raiton", 4): (810, 573),
    ("raiton", 6): (229, 1103), ("raiton", 7): (849, 1004),
    ("katon", 1): (724, 155), ("katon", 4): (725, 550), ("katon", 7): (714, 916),
    ("utility", 0): (315, 150), ("utility", 1): (862, 189),
    ("utility", 3): (228, 612), ("utility", 4): (737, 524),
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def nearest_gutters(mask, count, horizontal):
    profile = mask.transpose(Image.Transpose.TRANSPOSE) if horizontal else mask
    w, h = profile.size
    gutters = [0]
    for k in range(1, count):
        goal = round(w * k / count)
        start, end = round(goal - w * .055), round(goal + w * .055)
        options = range(start + 2, end - 2)
        def score(x):
            ink = profile.crop((x-2, 0, x+3, h)).histogram()[255]
            return ink * 14 + abs(goal - x)
        gutters.append(min(options, key=score))
    return gutters + [w]


def slice_plate(name):
    image = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    mask = image.getchannel("A").point(lambda a: 255 if a >= 236 else 0)
    image.putalpha(mask)
    ys = nearest_gutters(mask, 3, True)
    cels = []
    for row in range(3):
        y0, y1 = ys[row:row+2]
        xs = nearest_gutters(mask.crop((0, y0, image.width, y1)), 3, False)
        for i in range(3):
            x0, x1 = xs[i:i+2]
            cel = image.crop((x0, y0, x1, y1))
            bounds = cel.getbbox()
            assert bounds, (name, row, i)
            cels.append((cel, (x0, y0)))
    return image, cels


def inspect(name):
    image, cels = slice_plate(name)
    art = Image.new("RGB", image.size, "#1f2632")
    art.paste(image, (0, 0), image)
    d = ImageDraw.Draw(art)
    for x in range(0, image.width, 50):
        d.line((x, 0, x, image.height), fill="#687481")
    for y in range(0, image.height, 50):
        d.line((0, y, image.width, y), fill="#687481")
    font = ImageFont.load_default(size=15)
    for n, (cel, (x, y)) in enumerate(cels):
        print(name, n, (x, y), cel.getbbox(), image.size)
        d.rectangle((x, y, x+cel.width-1, y+cel.height-1), outline="#f1ba72", width=2)
        for py in range(y + 50, y + cel.height, 50):
            d.text((x + 4, py), str(py), font=font, fill="#ffeecc")
        for px in range(x + 50, x + cel.width, 50):
            d.text((px, y + 6), str(px), font=font, fill="#ffeecc")
    return art


def comparison(winged_idle):
    base = Image.open(OUT / "base.png").convert("RGBA")
    draft = Image.open(ROOT / "art/sasuke-curse-source/motion.png").convert("RGBA")
    draft = draft.crop((0, 0, draft.width//3, draft.height//3))
    draft.putalpha(draft.getchannel("A").point(lambda a: 255 if a >= 236 else 0))
    draft = draft.crop(draft.getbbox())
    draft = draft.resize(tuple(round(v * .35) for v in draft.size), Image.Resampling.NEAREST)
    image = Image.new("RGB", (1140, 487), "#161c28")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=19)
    small = ImageFont.load_default(size=14)
    draw.text((25, 18), "SASUKE HEBI   /   MARCA DA MALDICAO II", fill="#f2e6d9", font=font)
    for n, (title, caption, cel) in enumerate([
        ("FORMA BASE", "Sprite existente", base),
        ("RASCUNHO ANTERIOR", "Asas de morcego e camisa", draft),
        ("MARCA II CORRIGIDA", "Palmas macicas e torso descoberto", winged_idle),
    ]):
        x = 23 + n * 373
        draw.rectangle((x, 52, x+350, 431), fill="#222a37")
        draw.text((x+12, 67), title, fill="#e5d0e9", font=font)
        cel = cel.crop(cel.getbbox())
        cel = cel.resize((cel.width * 2, cel.height * 2), Image.Resampling.NEAREST)
        draw.line((x+10, 425, x+340, 425), fill="#54606e")
        image.paste(cel, (x + (350-cel.width)//2, 424-cel.height), cel)
        draw.text((x+12, 447), caption, fill="#c8d1dc", font=small)
    image.save(OUT / "curse-comparison.png")


def main():
    cfg = read_json(ROOT / "src/data/sasuke-curse.json")
    names = ["motion", "aerial", "ground", "low", "air", "raiton", "katon", "utility", "awakening"]
    cels, meta = [], []
    for name in names:
        _, plate = slice_plate(name)
        scale, roots = PLATES[name]
        for i, (source, (left, top)) in enumerate(plate):
            bounds = source.getbbox()
            if min(bounds[0], bounds[1], source.width-bounds[2], source.height-bounds[3]) < 1:
                print("Review source seam:", name, i, bounds, source.size)
            source = source.resize(tuple(round(v * scale) for v in source.size), Image.Resampling.NEAREST)
            dx = PIVOT[0] - round((roots[i] - left) * scale)
            dy = PIVOT[1] - source.getbbox()[3]
            cell = Image.new("RGBA", CELL)
            cell.alpha_composite(source, (dx, dy))
            l, t, r, b = cell.getbbox()
            assert min(l, t, CELL[0] - r, CELL[1] - b) >= 8 and b == PIVOT[1], (name, i, (l, t, r, b))
            cels.append(cell)

            def point(xy):
                x, y = xy
                return {"x": dx + round((x-left) * scale) - PIVOT[0],
                        "y": dy + round((y-top) * scale) - PIVOT[1]}

            # Core hurtboxes deliberately exclude the large wing silhouette.
            height = 97 if name == "low" or (name == "aerial" and i == 2) else 125
            if name == "utility" and i == 7:
                boxes = [{"x": -35, "y": -31, "w": 87, "h": 31}]
            else:
                boxes = [{"x": -14, "y": -height, "w": 38, "h": 26},
                         {"x": -25, "y": -height+25, "w": 54, "h": 53},
                         {"x": -32, "y": -height+78, "w": 70, "h": height-78}]
            record = {"hurtboxes": boxes}
            if (name, i) in ACTIVE:
                a, b, radius = ACTIVE[name, i]
                record["hitboxes"] = [{"a": point(a), "b": point(b), "r": radius}]
            if (name, i) in EMISSION:
                record["release"] = point(EMISSION[name, i])
            meta.append(record)

    clips = {}
    def add(clip, plate, indices, holds):
        assert len(indices) == len(holds)
        clips[clip] = {"frames": [names.index(plate) * 9 + i for i in indices], "holds": holds}

    add("idle", "motion", [0, 1, 2, 1], [8, 8, 8, 8])
    add("walkForward", "motion", [3, 4, 5, 4], [4, 4, 4, 4])
    add("walkBack", "motion", [6, 7, 8, 7], [5, 4, 5, 4])
    add("dashForward", "aerial", [0, 6, 3], [4, 4, 4])
    add("backdash", "aerial", [1, 5, 7], [5, 4, 3])
    add("airBurst", "aerial", [6], [len(cfg["airBurst"]["speeds"])])
    add("crouchStart", "aerial", [2], [6])
    add("crouchIdle", "aerial", [2], [7])
    add("crouchEnd", "aerial", [2, 7], [3, 3])
    add("jumpStart", "aerial", [2, 3], [2, 3])
    add("jumpRise", "aerial", [3, 4], [5, 6])
    add("jumpApex", "aerial", [4], [5])
    add("jumpFall", "aerial", [4, 5], [6, 5])
    add("landing", "aerial", [5, 2, 7], [2, 2, 3])
    add("guardStand", "aerial", [7], [6])
    add("guardImpactStand", "aerial", [7, 8, 7], [3, 4, 4])
    add("guardCrouch", "aerial", [2], [6])
    add("guardImpactCrouch", "aerial", [2, 7, 2], [3, 4, 4])
    for key in ["damageLight", "damageMedium", "damageHeavy", "grabbed"]:
        add(key, "aerial", [8, 7], [8, 9])
    add("damageCrouch", "aerial", [8, 2], [8, 9])
    for key in ["damageAir", "launched", "falling"]:
        add(key, "utility", [6], [10])
    add("downed", "utility", [7], [15])
    add("getup", "utility", [7, 8], [7, 12])
    add("taunt", "motion", [1, 2], [15, 15])

    for stance, plate in [("stand", "ground"), ("crouch", "low"), ("air", "air")]:
        for n, rank in enumerate(["light", "medium", "heavy"]):
            key = f"{stance}_{rank}"
            add(key, plate, list(range(n*3, n*3+3)), cfg["normalTimings"][key])
    for plate, keys in [
        ("raiton", ["senbon", "eiso", "chidori"]),
        ("katon", ["gokakyu", "hosenka", "goryuka"]),
        ("utility", ["serpents", "nagashi"]),
    ]:
        for n, key in enumerate(keys):
            add(key, plate, list(range(n*3, n*3+3)), cfg["specials"][key]["holds"])
    add("curse_awaken", "awakening", list(range(6)), cfg["activationHolds"])
    add("curse_revert", "awakening", [6, 7, 8], cfg["reversionHolds"])

    sheet = Image.new("RGBA", (CELL[0]*COLS, CELL[1]*((len(cels)+COLS-1)//COLS)))
    for i, cell in enumerate(cels):
        sheet.paste(cell, ((i%COLS)*CELL[0], (i//COLS)*CELL[1]))
    sheet.save(OUT / "curse.png")
    comparison(cels[0])
    (ROOT / "src/data/sasuke-curse-frames.json").write_text(
        json.dumps({"clips": clips, "cels": meta}, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for name in sys.argv[1:]:
            inspect(name).save(ROOT / "deployment/audit" / f"curse-grid-{name}.png")
    else:
        main()
