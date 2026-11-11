"""Pack the original Omniverse drawings at the game's native scale."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_kaneki_combat import ROOT

SOURCE = ROOT / "art/ben-aliens-source"
OUTPUT = ROOT / "public/sprites/ben"
PREVIEW = ROOT / "public/previews/ben"
SIZE = 256
PIVOT = (128, 224)
NEAREST = Image.Resampling.NEAREST
FORMS = {"xlr8": 135, "fourArms": 165, "heatblast": 145}
WALK = {
    "xlr8": (4, 4, [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13]),
    "fourArms": (4, 3, list(range(12))),
    "heatblast": (6, 3, [0, 1, 2, 3, 4, 8, 10, 11, 12, 13, 14, 15]),
}
TIMINGS = {
    "xlr8": dict(dash=[2, 2, 3, 3, 2], takeoff=[2, 2, 1], land=[2, 3, 2],
                 stride=[4, 4, 4, 4, 4, 4], light=[4, 3, 10], medium=[8, 4, 17], grab=8),
    "fourArms": dict(dash=[3, 3, 4, 2, 2], takeoff=[3, 3, 2], land=[3, 5, 4],
                     stride=[5, 4, 5, 5, 4, 5], light=[6, 4, 13], medium=[11, 5, 21], grab=10),
    "heatblast": dict(dash=[2, 3, 4, 2, 2], takeoff=[2, 2, 2], land=[2, 3, 3],
                      stride=[4, 4, 3, 4, 4, 3], light=[5, 3, 11], medium=[9, 4, 18], grab=9),
}


def read_cells(id, action, cols, rows, indices, source=SOURCE, threshold=218):
    plate = Image.open(source / f"{id}-{action}.png").convert("RGBA")
    # The illustrated rows are not perfectly centered in nominal tiles.
    # Recover full silhouettes before assigning any column or row.
    mask = plate.getchannel("A").point(lambda a: 255 if a >= threshold else 0)
    pixels = mask.load()
    isolated = []
    lut = [255 if v == 128 else 0 for v in range(256)]
    for y, x in np.argwhere(np.asarray(mask) == 255):
        if pixels[x, y] != 255:
            continue
        ImageDraw.floodfill(mask, (int(x), int(y)), 128)
        selection = mask.point(lut)
        bbox = selection.getbbox()
        l, t, r, b = bbox
        if r - l < 55 or b - t < 80:
            # Ignore detached glow and stray pixels outside a pose.
            mask.paste(0, bbox, selection.crop(bbox))
            pixels = mask.load()
            continue
        cel = plate.crop(bbox)
        cel.putalpha(selection.crop(bbox))
        isolated.append(((l + r) / 2, (t + b) / 2, cel))
        mask.paste(0, bbox, selection.crop(bbox))
        pixels = mask.load()
    row_sizes = [5, 5, 6] if id == "heatblast" and action == "walk" else [cols] * rows
    assert len(isolated) == sum(row_sizes), (id, action, len(isolated), row_sizes)
    ordered = sorted(isolated, key=lambda item: item[1])
    row_major = []
    start = 0
    for count in row_sizes:
        row_major.extend(sorted(ordered[start:start+count], key=lambda item: item[0]))
        start += count
    return [row_major[i][2] for i in indices]


def pack_frame(art, scale):
    art = art.resize((round(art.width * scale), round(art.height * scale)), NEAREST)
    # Ground reference follows the feet; a tail or an extended arm does not move it.
    ys, xs = np.where(np.asarray(art.getchannel("A")) > 0)
    feet = xs[ys >= np.quantile(ys, .77)]
    root = int(round((feet.min() + feet.max()) / 2))
    dx, dy = PIVOT[0] - root, PIVOT[1] - art.height
    assert dx >= 0 and dy >= 0 and dx + art.width <= SIZE, (art.size, dx, dy)
    frame = Image.new("RGBA", (SIZE, SIZE))
    frame.alpha_composite(art, (dx, dy))
    crown = xs[ys <= ys.min() + 9]
    return frame, dict(x=int(np.median(crown)) + dx - PIVOT[0], y=dy - PIVOT[1])


def save_form(id, height):
    target = OUTPUT / id
    target.mkdir(parents=True, exist_ok=True)
    base = Image.open(SOURCE / f"{id}-reference.png").convert("RGBA")
    base_frame, _ = pack_frame(base, height / base.height)
    base_frame.save(target / "base.png")
    def selection(n):
        return list(range(n))
    walk = WALK[id]
    sets = {
        "idle": ((3, 2, selection(6)), 1),
        "walk": (walk, .95),
        "dash": ((4, 3, selection(10)), .87),
        "air": ((5, 4, selection(17)), .96),
        "normals": ((3, 3, selection(9)), .96),
    }
    result = dict(sheet=f"ben/{id}/idle.png", frameWidth=SIZE, frameHeight=SIZE,
                  pivot=dict(x=PIVOT[0], y=PIVOT[1]), scale=1, columns=4, clips={}, anchors={})
    packed = {}
    for action, ((cols, rows, indices), ratio) in sets.items():
        cells = read_cells(id, action, cols, rows, indices)
        heights = [cel.height for cel in cells]
        reference = np.quantile(heights, .8) if action == "air" else np.median(heights)
        frames = [pack_frame(cel, height * ratio / reference) for cel in cells]
        assert len({frame.tobytes() for frame, _ in frames}) == len(cells), (id, action)
        packed[action] = frames

    timing = TIMINGS[id]

    def clip(name, file, frames, durations, loop=False):
        assert len(frames) == len(durations), name
        poses = [packed[file][i] for i in frames]
        columns = min(4, len(poses))
        atlas = Image.new("RGBA", (SIZE * columns, SIZE * ((len(poses) + columns - 1) // columns)))
        for i, (frame, _) in enumerate(poses):
            atlas.paste(frame, (i % columns * SIZE, i // columns * SIZE))
        sheet = f"ben/{id}/{name}.png"
        atlas.save(ROOT / "public/sprites" / sheet, optimize=True)
        result["clips"][name] = dict(sheet=sheet, frames=selection(len(frames)), columns=columns,
                                      durations=durations, ticks=1, loop=loop)
        if id == "heatblast":
            result["anchors"][sheet] = [anchor for _, anchor in poses]

    clip("idle", "idle", selection(6), [10, 11, 10, 12, 10, 11], True)
    clip("walkForward", "walk", selection(6), timing["stride"], True)
    clip("walkBack", "walk", list(range(6, 12)), timing["stride"], True)
    clip("dashForward", "dash", selection(5), timing["dash"])
    clip("backdash", "dash", list(range(5, 10)), timing["dash"])
    clip("stand_light", "normals", [0, 1, 2], timing["light"])
    clip("stand_medium", "normals", [3, 4, 5], timing["medium"])
    clip("throw", "normals", [6, 8], [timing["grab"] + 3, 21])
    clip("grabHold", "normals", [6, 7, 8], [8, 10, 9])
    clip("throwRecover", "normals", [8], [12])
    clip("crouchStart", "air", [0, 1], [3, 3])
    clip("crouchIdle", "air", [2, 3], [11, 11], True)
    clip("crouchEnd", "air", [4, 5], [2, 3])
    clip("jumpStart", "air", [6, 7, 8], timing["takeoff"])
    clip("jumpRise", "air", [9, 10], [1, 1])
    clip("jumpApex", "air", [11], [1])
    clip("jumpFall", "air", [12, 13], [1, 1])
    clip("landing", "air", [14, 15, 16], timing["land"])
    return result


def preview():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    proof = Image.new("RGB", (1100, 325), "#121b24")
    draw = ImageDraw.Draw(proof)
    heading = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 23)
    label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
    draw.text((24, 16), "OMNITRIX / ESCALA NATIVA", fill="#b7f86e", font=heading)
    draw.line((24, 269, 1076, 269), fill="#486561")
    for i, (id, name) in enumerate([("", "BEN HUMANO"), ("xlr8", "XLR8"), ("fourArms", "QUATRO BRAÇOS"), ("heatblast", "CHAMA")]):
        image = Image.open(OUTPUT / id / "base.png").convert("RGBA")
        x = 140 + i * 273
        proof.paste(image, (x - PIVOT[0], 269 - PIVOT[1]), image)
        l, t, r, b = image.getbbox()
        draw.text((x, 290), f"{name}   {b-t} px", anchor="mt", fill="#e8f3ec", font=label)
    proof.save(PREVIEW / "formas-etapa-3.png")


if __name__ == "__main__":
    manifests = {id: save_form(id, height) for id, height in FORMS.items()}
    (ROOT / "src/data/ben-alien-art.json").write_text(
        json.dumps(manifests, indent=2) + "\n", encoding="utf-8")
    preview()

