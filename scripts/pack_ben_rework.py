"""Pack the new Ben special poses without replacing approved locomotion atlases."""
import json

import numpy as np
from PIL import Image

from pack_ben_stage6_combat import atlas, plant, plate
from pack_ben_aliens import NEAREST, OUTPUT, ROOT

SOURCE = ROOT / "art" / "ben-rework-source"
DATA = ROOT / "src" / "data" / "ben-reform-art.json"
art = {}
props = {}


def actor(key, poses, scale, columns, rows, reference, name="reform"):
    cels = plate(SOURCE / f"{poses}.png", columns, rows)
    assert len(cels) == columns * rows
    ratio = scale / np.median([cels[i].height for i in reference])
    directory = OUTPUT / key
    packed = atlas(directory, name, [plant(c, ratio, key) for c in cels])
    art.setdefault(key, {})

    def add(id, frames, durations, loop=False):
        art[key][id] = dict(**packed, frames=frames, durations=durations, loop=loop, ticks=1)

    return add


def prop(name, dims, cols, rows):
    cels = plate(SOURCE / f"{name}.png", cols, rows)
    w, h = dims
    sheet = Image.new("RGBA", (w * len(cels), h))
    for i, cel in enumerate(cels):
        ratio = min(w / cel.width, h / cel.height)
        cel = cel.resize((round(cel.width * ratio), round(cel.height * ratio)), NEAREST)
        y = (h - cel.height) // 2 if name == "hands" and i >= 2 else h - cel.height
        sheet.alpha_composite(cel, (i * w + (w - cel.width) // 2, y))
    asset = "ghostfreak-hands" if name == "hands" else name
    path = f"ben/{asset}-reform.png"
    sheet.save(OUTPUT.parent / path, optimize=True)
    props[name] = {"sheet": path, "w": w, "h": h}


add = actor("humungousaur", "humungousaur", 162, 6, 2, (1, 8, 10, 11))
add("colossal_light", [0, 1, 2, 3, 4, 5], [7, 6, 9, 20, 9, 20])
add("colossal_medium", [0, 1, 2, 3, 4, 5], [14, 11, 19, 22, 12, 24])
add("car_light", [6, 7, 8, 9, 4, 5], [5, 6, 8, 2, 9, 21])
add("car_medium", [6, 7, 8, 10, 11, 5], [6, 7, 11, 6, 11, 24])

add = actor("feedback", "feedback", 166, 6, 2, (0, 1, 5, 6))
add("storm_light", [0, 1, 2, 3, 4, 5], [3, 3, 6, 8, 10, 13])
add("storm_medium", [0, 1, 2, 3, 4, 5], [6, 7, 8, 12, 13, 13])
add("conductorHold", [7, 9, 6], [8, 6, 7])
add("conductorHoldK", [8, 9, 11, 5], [8, 12, 8, 5])
add("discharge_light", [10, 7, 9, 6], [7, 4, 5, 10])
add("discharge_medium", [8, 10, 11, 9, 6], [7, 9, 9, 8, 16])

add = actor("ghostfreak", "ghostfreak", 153, 6, 2, (1, 4, 7, 11))
add("ghostCross_light", [0, 1, 2, 3, 11], [6, 7, 4, 7, 21])
add("ghostCross_medium", [0, 1, 2, 3, 5, 11], [8, 14, 5, 6, 9, 23])
add("huntJ", [4, 5, 6, 7, 10, 11], [4, 5, 5, 5, 10, 5])
add("huntK", [4, 5, 6, 7, 8, 9, 10, 11], [4, 5, 4, 5, 8, 7, 8, 4])
add("ghostPhase_light", [0, 4, 1, 2, 11], [6, 7, 16, 7, 27])
add("ghostPhase_medium", [0, 4, 1, 2, 11], [8, 12, 22, 10, 34])
add = actor("ghostfreak", "zs", 173, 2, 2, (0, 1, 3), "zs-skayr")
add("nightmareJ", [0, 1, 2, 1, 3], [8, 8, 9, 6, 6])
add("nightmareK", [0, 1, 2, 3, 2, 1], [9, 9, 9, 7, 10, 6])

add = actor("nrgReleased", "nrgReleased", 146, 6, 2, (0, 1, 4, 5, 7))
for i, name in enumerate(("flyIdle", "flyUp", "flyDown", "flyForward", "flyBack", "flyLand")):
    add(name, [i], [1])
add("radiantShot_light", [0, 6, 7, 4], [7, 4, 5, 10])
add("radiantShot_medium", [11, 7, 6, 7, 4], [8, 9, 7, 9, 21])
add("radiantShot_lightAir", [0, 8, 4], [7, 8, 11])
add("radiantShot_mediumAir", [0, 2, 9, 8, 4], [8, 9, 7, 9, 21])
add("radiantWave_light", [2, 10, 8, 4], [8, 6, 6, 9])
add("radiantWave_medium", [0, 2, 11, 7, 4], [7, 8, 10, 9, 19])
add("nrgSeal_light", [2, 3, 1, 0], [4, 8, 5, 17])
add("nrgSeal_medium", [2, 5, 0], [7, 6, 11])
prop("car", (125, 52), 2, 2)
prop("hands", (65, 98), 4, 1)
DATA.write_text(json.dumps({"clips": art, "props": props}, indent=2) + "\n", encoding="utf-8")

