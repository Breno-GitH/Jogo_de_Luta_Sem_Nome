"""Pack the approved bases and the new motion and attack drawings."""
import json
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_ben_stage6_models import MODELS, SOURCE, source_poses
from pack_ben_stage5_models import BOLD, FONT
from pack_ben_aliens import NEAREST, OUTPUT, PREVIEW, ROOT
from pack_ben_stage5_animations import cuts, largest_alpha

WIDTH, HEIGHT, PIVOT_X, FLOOR = 352, 264, 176, 240
NORMALS = ("stand_light", "stand_medium", "crouch_light", "crouch_medium", "air_light", "air_medium")
SPECIALS = {
    "bigChill": ("frostBreath", "iceDive", "ghostFlight"),
    "ghostfreak": ("ghostCross", "spectralArms", "ghostPhase"),
    "nrg": ("thermal", "nuclear", "nrgUnseal"),
    "nrgReleased": ("radiantShot", "radiantWave", "nrgSeal"),
}


def plate(file, columns, rows):
    image = Image.open(file).convert("RGBA")
    opaque = np.asarray(image.getchannel("A")) >= 226
    output = []
    for y0, y1 in cuts(rows, opaque.sum(axis=1)):
        for x0, x1 in cuts(columns, opaque[y0:y1].sum(axis=0)):
            cell = image.crop((x0, y0, x1, y1))
            mask = cell.getchannel("A").point(lambda alpha: 255 if alpha >= 226 else 0)
            cell.putalpha(mask)
            bounds = mask.getbbox()
            if not bounds:
                raise ValueError(f"{file.name}: empty cell {len(output)}")
            cel = largest_alpha(cell, bounds)
            if cel.width < 25 or cel.height < 35:
                raise ValueError(f"{file.name}: invalid cell {len(output)} ({cel.size})")
            output.append(cel)
    return output


def plant(cel, ratio, key):
    art = cel.resize((round(cel.width * ratio), round(cel.height * ratio)), NEAREST)
    ys, xs = np.where(np.asarray(art.getchannel("A")) > 0)
    if key == "ghostfreak" and art.height > art.width * .55:
        root = np.median(xs[(ys > art.height * .3) & (ys < art.height * .65)])
    elif art.width > art.height * 1.5:
        root = np.median(xs)
    else:
        feet = xs[ys >= np.quantile(ys, .83)]
        root = (feet.min() + feet.max()) / 2
    lift = 9 if key == "ghostfreak" and art.height > art.width * .65 else 0
    frame = Image.new("RGBA", (WIDTH, HEIGHT))
    x, y = PIVOT_X - round(root), FLOOR - art.height - lift
    if x < 0 or x + art.width > WIDTH or y < 0:
        raise ValueError(f"{key}: pivot outside atlas {(x, y)} {art.size}")
    frame.alpha_composite(art, (x, y))
    return frame


def atlas(directory, name, cells):
    bounds = [cell.getbbox() for cell in cells]
    x0 = min(box[0] for box in bounds) - 2
    y0 = min(box[1] for box in bounds) - 2
    x1 = max(box[2] for box in bounds) + 2
    y1 = max(FLOOR, max(box[3] for box in bounds)) + 2
    w, h = x1 - x0, y1 - y0
    columns = min(6, len(cells))
    image = Image.new("RGBA", (w * columns, h * ((len(cells) + columns - 1) // columns)))
    for i, cell in enumerate(cells):
        image.paste(cell.crop((x0, y0, x1, y1)), (i % columns * w, i // columns * h))
    image.save(directory / f"{name}.png", optimize=True)
    return dict(sheet=f"ben/{directory.name}/{name}.png", columns=columns,
                frameWidth=w, frameHeight=h, pivot=dict(x=PIVOT_X - x0, y=FLOOR - y0), scale=1)


def form(key, tuning, escape):
    height = MODELS[key][1]
    model = list(source_poses(key))
    motion = plate(SOURCE / f"{key}-motion.png", 6, 4)
    combat = plate(SOURCE / f"{key}-combat.png", 6, 5)
    base = [plant(c, height / model[0].height, key) for c in model]
    moving = [plant(c, height / np.median([pose.height for pose in motion[:3]]), key) for c in motion]
    stand_reference = np.median([combat[i].height for i in (0, 2, 12, 28, 29)])
    poses = [plant(c, height / stand_reference, key) for c in combat]
    idle = base[:3] + moving[:3]
    if key != "ghostfreak":
        fixed = (0, FLOOR - 23, WIDTH, HEIGHT)
        for cell in idle[1:]:
            cell.paste(idle[0].crop(fixed), (0, fixed[1]))
    if len({cell.tobytes() for cell in idle}) < 6:
        raise ValueError(f"{key}: duplicate idle cels")

    directory = OUTPUT / key
    directory.mkdir(parents=True, exist_ok=True)
    main = atlas(directory, "stage6-locomotion", idle + moving[3:] + base[3:])
    battle = atlas(directory, "stage6-combat", poses)
    clips = {}

    def add(name, ids, times, geometry=main, loop=False):
        assert len(ids) == len(times) and min(times) > 0, (key, name)
        clips[name] = dict(**geometry, frames=ids, durations=times, ticks=1, loop=loop)

    def motion_clip(name, ids, times, loop=False):
        add(name, [i + 3 for i in ids], times, loop=loop)

    add("idle", list(range(6)), [10, 10, 9, 10, 10, 11], loop=True)
    motion_clip("walkForward", [3, 4, 5, 4], [5, 4, 5, 4], True)
    motion_clip("walkBack", [6, 7, 8, 7], [5, 4, 5, 4], True)
    motion_clip("dashForward", [9, 10, 5], [3, 6, 5])
    motion_clip("backdash", [11, 6, 8], [4, 5, 5])
    motion_clip("crouchStart", [12, 13], [3, 3])
    motion_clip("crouchIdle", [13, 12], [13, 11], True)
    motion_clip("crouchEnd", [12, 19], [3, 2])
    jump = tuning["movement"]["locomotion"]["jumpStartup"]
    motion_clip("jumpStart", [12, 14, 15], [1, jump - 2, 1])
    motion_clip("jumpRise", [15, 16], [1, 1])
    motion_clip("jumpApex", [16], [1])
    motion_clip("jumpFall", [17, 18], [1, 1])
    motion_clip("landing", [18, 19, 20], [2, 3, 5])
    for i, name in enumerate(("guardStand", "guardCrouch", "damage", "downed"), 20):
        motion_clip(name, [i], [1])

    moves = tuning["moves"]
    pairs = [(i, i + 1) for i in range(0, 26, 2)]
    if key == "bigChill":
        pairs[:4] = [(0, 1), (3, 2), (5, 6), (6, 7)]
    elif key == "ghostfreak":
        # The complete tentacles are generated by the shared collision path
        # during these cels. Use the torso poses without baked appendages.
        pairs[9:11] = [(18, 20), (20, 25)]
    elif key == "nrgReleased":
        pairs = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12),
                 (13, 14), (15, 16), (17, 18), (19, 20), (21, 22), (23, 24), (25, 26)]
    release_index = 27 if key == "nrgReleased" else 26
    for name, (prep, active) in zip(NORMALS, pairs):
        m = moves[name]
        recovery = 29 if name.startswith("stand") else prep
        add(name, [prep, active, recovery], [m["startup"], m["active"], m["recovery"]], battle)
    prep, active = pairs[6]
    m, grab = moves["throw"], tuning["grab"]
    add("throw", [prep, active, release_index], [m["startup"], m["active"], m["recovery"]], battle)
    add("grabHold", [active, release_index, 27], [grab["hitTick"], 4, grab["duration"] - grab["hitTick"] - 4], battle)
    add("throwRecover", [27, 28], [4, 8], battle)

    ids = [f"{family}_{key}" for family in SPECIALS[key] for key in ("light", "medium")]
    for name, (prep, active) in zip(ids, pairs[7:]):
        if name not in moves:
            continue  # Obsolete containment attacks are supplied by pack_nrg_armor instead.
        m = moves[name]
        add(name, [prep, active, prep], [m["startup"], m["active"], m["recovery"]], battle)
    if key == "bigChill":
        wing = moves["stand_medium"]
        add("stand_medium", [27, 28, 27], [wing["startup"], wing["active"], wing["recovery"]])
        dive = moves["iceDive_light"]
        add("iceDive_light", [27, 29, 28], [dive["startup"], dive["active"], dive["recovery"]])
    if key == "ghostfreak":
        add("spectralGrabHold", [20, 13, 26], [7, 7, 7], battle)
    if key == "nrg":
        add("nrgUnseal_light", [0, 1, 2], [5, 6, moves["nrgUnseal_light"]["startup"] - 11], escape)
        add("nrgLock", [1, 0], [4, 7], escape)
    if key == "nrgReleased":
        add("nrgEmergence", [3], [9], escape)
    return dict(**main, clips=clips)


if __name__ == "__main__":
    tuning = json.loads(subprocess.check_output([
        "node", "-e",
        'eval(require("esbuild").buildSync({stdin:{contents:\'import {benForms,nrgReleasedForm} from "./src/engine/ben-forms.ts"; console.log(JSON.stringify({...benForms,nrgReleased:nrgReleasedForm}));\',resolveDir:process.cwd()},bundle:true,platform:"node",write:false}).outputFiles[0].text)',
    ], cwd=ROOT))
    cels = plate(SOURCE / "nrg-release.png", 2, 2)
    ratio = MODELS["nrg"][1] / cels[0].height
    cells = [plant(cel, ratio, "nrg") for cel in cels[:3]]
    cells.append(plant(cels[3], MODELS["nrgReleased"][1] / (cels[3].height * 1.16), "nrgReleased"))
    directory = OUTPUT / "nrg"
    directory.mkdir(parents=True, exist_ok=True)
    escape = atlas(directory, "stage6-release", cells)
    preview = Image.new("RGB", (1088, 329), "#16242d")
    draw = ImageDraw.Draw(preview)
    draw.text((18, 12), "NRG / LIBERAÇÃO PELA CÚPULA", font=ImageFont.truetype(BOLD, 23), fill="#f6c482")
    labels = ["TRAJE FECHADO", "CÚPULA ABERTA", "SAÍDA PELO TOPO", "FORMA LIBERADA"]
    for index, (cell, label) in enumerate(zip(cells, labels)):
        x = 12 + index * 269
        draw.rectangle((x, 52, x + 260, 286), fill="#2c424f")
        crop = cell.crop((PIVOT_X - 130, FLOOR - 230, PIVOT_X + 130, FLOOR + 2))
        preview.paste(crop, (x, 54), crop)
        draw.text((x + 9, 298), label, font=ImageFont.truetype(FONT, 16), fill="#eaf2ed")
    PREVIEW.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW / "nrg-liberacao-etapa-6.png", optimize=True)
    forms = {key: form(key, tuning[key], escape) for key in MODELS}
    (ROOT / "src/data/ben-stage6-combat.json").write_text(json.dumps(forms, indent=2) + "\n", encoding="utf-8")

