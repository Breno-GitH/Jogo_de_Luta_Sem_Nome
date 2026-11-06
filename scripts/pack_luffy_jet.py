"""Pack transparent body poses and independently drawn Gear Third fists."""
import json
from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw

from pack_luffy_normals import anchor_in_body, body_boxes

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/luffy-jet-source"
DEST = ROOT / "public/sprites/luffy/jet"
PIVOT = (128, 224)
SECOND = [
    ("pump", 185), ("ignite", 180), ("rise", 177), ("ready", 166),
    ("dash", 160), ("windup", 172), ("pistol", 177), ("cross", 176),
    ("bazookaWindup", 176), ("bazooka", 164),
    ("gatlingLeft", 160), ("gatlingRight", 157),
]
THIRD = [
    ("launcher", 190), ("watch", 182), ("inflate", 166), ("inflation", 177),
    ("brace", 168), ("giantWindup", 169), ("giantStrike", 168), ("giantFollow", 162),
    ("descent", 153), ("landing", 185), ("small", 172), ("growing", 160),
]
# Local plate coordinates. Replace the distal part of each extended arm with
# the runtime shaft, while preserving its proximal contour and the other hand.
CUT = {
    "pistol": ([(253, 140), (361, 137), (361, 195), (253, 195)], [(241, 152)]),
    "cross": ([(254, 130), (361, 130), (361, 189), (254, 189)], [(246, 147)]),
    "bazooka": ([(204, 84), (361, 79), (361, 153), (204, 147)], [(194, 124), (197, 106)]),
    "gatlingLeft": ([(245, 116), (361, 114), (361, 173), (245, 166)], [(236, 134)]),
    "gatlingRight": ([(247, 116), (361, 114), (361, 171), (247, 166)], [(238, 134)]),
    "launcher": ([(241, 80), (300, 78), (300, 139), (241, 139)], [(247, 146)]),
    "inflation": ([(0, 163), (112, 163), (112, 218), (0, 218)], [(113, 169)]),
    "brace": ([(0, 116), (137, 117), (137, 169), (0, 176)], [(141, 133)]),
    "giantWindup": ([(0, 122), (135, 114), (137, 168), (0, 184)], [(142, 126)]),
    "giantStrike": ([(250, 96), (361, 89), (361, 151), (250, 151)], [(243, 128)]),
    "giantFollow": ([(203, 68), (361, 66), (361, 116), (203, 114)], [(196, 100)]),
}


def cut_alpha(im):
    return im.getchannel("A").point(lambda a: 255 if a >= 225 else 0)


def write_json(name, data):
    (ROOT / f"src/data/luffy-jet-{name}.json").write_text(
        json.dumps(data, indent=2) + "\n", encoding="utf-8",
    )


def build_body():
    atlas = Image.new("RGBA", (2048, 1024))
    metadata = {}
    for name, specs in [("gear-second", SECOND), ("gear-third", THIRD)]:
        source = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        width, height = source.width // 4, source.height // 3
        for i, (cel, support) in enumerate(specs):
            left, top = i % 4 * width, i // 4 * height
            crop = source.crop((left, top, left + width, top + height))
            alpha = cut_alpha(crop)
            assert alpha.getbbox() and all(v > 0 for v in alpha.getbbox()[:2])
            joints = []
            if cel in CUT:
                polygon, joints = CUT[cel]
                ImageDraw.Draw(alpha).polygon(polygon, fill=0)
            crop.putalpha(alpha)
            scale = .435 if cel != "growing" else .39
            crop = crop.resize((round(width * scale), round(height * scale)), Image.Resampling.NEAREST)
            x, y = PIVOT[0] - round(support * scale), PIVOT[1] - crop.getbbox()[3]
            cell = Image.new("RGBA", (256, 256))
            cell.alpha_composite(crop, (x, y))
            assert cell.getbbox()[3] == PIVOT[1]
            frame = len(metadata)
            metadata[cel] = {
                "frame": frame,
                "hurtboxes": body_boxes(cell),
                "joints": [
                    dict(zip(("x", "y"), anchor_in_body(cell, x + round(jx * scale), y + round(jy * scale))))
                    for jx, jy in joints
                ],
            }
            atlas.paste(cell, (frame % 8 * 256, frame // 8 * 256))
    frame = len(metadata)
    base = Image.open(ROOT / "public/sprites/luffy/base-polished.png").convert("RGBA")
    metadata["base"] = {"frame": frame, "hurtboxes": body_boxes(base), "joints": []}
    atlas.paste(base, (frame % 8 * 256, frame // 8 * 256))
    atlas.save(DEST / "body.png")
    write_json("poses", metadata)


def build_fists():
    source = Image.open(SOURCE / "fists.png").convert("RGBA")
    atlas = Image.new("RGBA", (1024, 512))
    specs = [
        (0, 443, 27), (443, 887, 48), (887, 1330, 79), (1330, 1774, 116),
        (0, 495, 174), (495, 953, 163), (953, 1355, 108), (1355, 1774, 42),
    ]
    result = []
    for i, (start, end, width) in enumerate(specs):
        top = 0 if i < 4 else 443
        sprite = source.crop((start, top, end, 443 if i < 4 else source.height))
        sprite.putalpha(cut_alpha(sprite))
        sprite = sprite.crop(sprite.getbbox())
        sprite = sprite.resize((width, round(sprite.height * width / sprite.width)), Image.Resampling.NEAREST)
        # Wrist is the center of the first substantial opaque column.
        alpha = sprite.getchannel("A")
        anchor = next(
            (x, box) for x in range(9)
            if (box := alpha.crop((x, 0, x + 1, sprite.height)).getbbox())
            and box[3] - box[1] >= sprite.height * .23
        )
        pivot = {"x": anchor[0] + 3, "y": (anchor[1][1] + anchor[1][3]) // 2}
        result.append({
            "width": sprite.width, "height": sprite.height, "pivot": pivot,
            "nose": sprite.width - pivot["x"], "wrist": (anchor[1][3] - anchor[1][1]) / 2,
        })
        atlas.paste(sprite, (i % 4 * 256, i // 4 * 256))
    atlas.save(DEST / "fists.png")
    write_json("fists", result)


def build_effects():
    """Native-pixel atlas. Six independent cels per element, no blur."""
    atlas = Image.new("RGBA", (6 * 192, 4 * 160))
    for family in range(4):
        for frame in range(6):
            cel = Image.new("RGBA", (192, 160))
            d = ImageDraw.Draw(cel)
            if family == 0:  # separate shaded steam ribbons
                for n, base in enumerate((30, 73, 135)):
                    for k in range(11):
                        age = (k * 11 + frame * 3 + n * 5) % 121
                        x = base + round(15 * sin(age / 24 + n) + 7 * sin(age / 13 + n))
                        y = 148 - age
                        r = 3 + (k + n) % 4 + age // 25
                        opacity = 197 - age
                        if (k + 2*n) % 7 == 0:
                            continue
                        d.ellipse((x-r, y-r, x+r+3, y+r), fill=(126, 165, 177, opacity // 2))
                        d.ellipse((x-r, y-r-1, x+r, y+r-2), fill=(218, 236, 233, opacity))
                        d.polygon([(x-r+1,y-r+3),(x-2,y-r-1),(x+4,y-r),(x+1,y-r+3)],
                                  fill=(255, 249, 224, opacity + 26))
            elif family == 1:  # air-slicing chevrons
                for n in range(5):
                    x = 30 + (n * 17 + frame * 11) % 52
                    y = 52 + n * 14
                    d.polygon([(x-24,y+3), (x+60,y-3), (x+72,y-2), (x+22,y+1)],
                              fill=(245, 130 + n * 13, 99 + n * 22, 235 - frame * 26))
                    d.line((x+13,y, x+57,y-2), fill=(255, 240, 199, 245 - frame * 26))
            elif family == 2:  # jagged impact
                r = 12 + frame * 8
                points = [(round(96 + cos(i*pi/8) * (r if i%2 == 0 else r*.37)),
                           round(80 + sin(i*pi/8) * (r if i%2 == 0 else r*.37)))
                          for i in range(16)]
                d.polygon(points, fill=(244, 122, 65, 255-frame*32))
                inner = [(round(96 + (x-96)*.69), round(80 + (y-80)*.69)) for x,y in points]
                d.polygon(inner, fill=(255, 220, 132, 255-frame*32))
                d.rectangle((92,76,100,84), fill=(255, 251, 218, 255-frame*40))
                for n in range(6):
                    angle = n*pi/3 + frame*.19
                    x,y = round(96+cos(angle)*(r+8)),round(80+sin(angle)*(r+8))
                    d.rectangle((x,y,x+2,y+1), fill=(255, 209, 124, 230-frame*28))
            else:  # layered dust fans
                for n in range(8):
                    offset = n - 3.5
                    x = round(96 + offset * (11 + frame * 2))
                    y = 145 - (frame + 1) * (5 + n % 3)
                    r = 7 + frame + n % 3
                    d.ellipse((x-r, y-r, x+r, y+r), fill=(129, 102, 91, 230-frame*29))
                    d.ellipse((x-r, y-r-2, x+r-3, y+r-5), fill=(193, 161, 127, 230-frame*30))
                    d.rectangle((x-3, y-r-1, x+3, y-r+1), fill=(227, 204, 160, 225-frame*30))
            atlas.paste(cel, (frame * 192, family * 160))
    atlas.save(DEST / "effects.png")


if __name__ == "__main__":
    build_body()
    build_fists()
    build_effects()
