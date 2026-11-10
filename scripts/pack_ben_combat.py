"""Keep the approved locomotion sheets and pack separately drawn attack poses."""
import json
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import ROOT, OUTPUT, PREVIEW, FORMS, NEAREST, read_cells

SOURCE = ROOT / "art/ben-combat-source"
WIDTH, HEIGHT = 352, 256
ROOT_X, FLOOR = 176, 224
NORMALS = ["stand_light", "stand_medium", "crouch_light", "crouch_medium", "air_light", "air_medium"]
SPECIALS = {
    "xlr8": ["turbo", "cyclone", "lightning"],
    "fourArms": ["tackle", "quad", "seismic"],
    "heatblast": ["fireball", "pillar", "propulsion"],
}


def frame(art, scale):
    art = art.resize((round(art.width * scale), round(art.height * scale)), NEAREST)
    ys, xs = np.where(np.asarray(art.getchannel("A")) > 0)
    feet = xs[ys >= np.quantile(ys, .78)]
    root = round((int(feet.min()) + int(feet.max())) / 2)
    left = ROOT_X - root
    top = FLOOR - art.height
    assert left > 0 and left + art.width < WIDTH and top > 0
    full = Image.new("RGBA", (WIDTH, HEIGHT))
    full.alpha_composite(art, (left, top))
    crown = xs[ys <= ys.min() + 9]
    return full, {"x": int(np.median(crown)) - root, "y": -art.height}


def profile():
    return json.loads(subprocess.check_output([
        "node", "-e",
        'eval(require("esbuild").buildSync({stdin:{contents:\'import {benForms} from "./src/engine/ben-forms.ts"; console.log(JSON.stringify(benForms));\',resolveDir:process.cwd()},bundle:true,platform:"node",write:false}).outputFiles[0].text)',
    ], cwd=ROOT))


def pack(id, tuning):
    groups = []
    for plate in range(3):
        source = read_cells(id, str(plate), 4, 3, list(range(12)), SOURCE,
                            threshold=244 if id == "xlr8" and plate == 0 else 218)
        heights = [im.height for im in source]
        reference = np.quantile(heights[:8], .75) if plate == 0 else np.quantile(heights, .82)
        packed = [frame(im, FORMS[id] * (1 if plate == 0 else .98) / reference) for im in source]
        for row in range(3):
            row_frames = packed[row*4:(row+1)*4]
            assert len({art.tobytes() for art, _ in row_frames}) == 4
            groups.append(row_frames)

    assets = {"clips": {}, "anchors": {}}

    def atlas(name, poses):
        sheet = f"ben/{id}/combat/{name}.png"
        target = ROOT / "public/sprites" / sheet
        target.parent.mkdir(exist_ok=True, parents=True)
        tile = Image.new("RGBA", (WIDTH * 4, HEIGHT))
        for i, (art, _) in enumerate(poses):
            tile.paste(art, (WIDTH * i, 0))
        tile.save(target, optimize=True)
        assets["anchors"][sheet] = [anchor for _, anchor in poses]
        return sheet

    def clip(name, sheet, indices, duration):
        assert len(indices) == len(duration) and min(duration) >= 1
        assets["clips"][name] = {
            "sheet": sheet, "frameWidth": WIDTH, "frameHeight": HEIGHT,
            "columns": 4, "pivot": {"x": ROOT_X, "y": FLOOR},
            "frames": indices, "durations": duration, "ticks": 1, "loop": False,
        }

    for i, name in enumerate(NORMALS):
        m = tuning["moves"][name]
        sheet = atlas(name, groups[i])
        a = m["active"]
        r = m["recovery"]
        if id == "fourArms" and name == "stand_light":
            clip(name, sheet, [0, 1, 2, 3], [m["startup"], 5, 3, r])
        else:
            # On thrusting cels the third drawing is the fully extended contact.
            clip(name, sheet, [0, 2, 1, 3], [m["startup"], a, max(1, r//3), r - max(1, r//3)])

    for i, family in enumerate(SPECIALS[id]):
        sheet = atlas(family, groups[6+i])
        for strength in ("light", "medium"):
            name = f"{family}_{strength}"
            m = tuning["moves"][name]
            s, a, r = m["startup"], m["active"], m["recovery"]
            if strength == "light":
                contact = 2 if family in ("seismic", "fireball", "pillar") else 1
                clip(name, sheet, [0, contact, 3], [s, a, r])
            else:
                if m["ben"].get("field"):
                    clip(name, sheet, [0, 1, 2, 3], [s//2, s-s//2, a, r])
                else:
                    clip(name, sheet, [0, 1, 2, 3], [s, max(1, a//2), a-max(1, a//2), r])
        if family == "quad":
            clip("quad_light_hold", sheet, [0, 1, 2, 3], [4, 7, 6, 5])
            clip("quad_medium_hold", sheet, [0, 1, 2, 3], [6, 14, 9, 5])
    return assets


if __name__ == "__main__":
    tuning = profile()
    data = {id: pack(id, tuning[id]) for id in FORMS}
    (ROOT / "src/data/ben-attack-art.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

