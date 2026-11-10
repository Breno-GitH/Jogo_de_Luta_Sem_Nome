"""Pack Stage 5 drawings at native resolution, with a separate raster for each growth scale."""
import argparse
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_ben_stage5_models import MODELS, SOURCE, FONT
from pack_ben_aliens import NEAREST, ROOT, OUTPUT, PREVIEW
from pack_ben_combat import profile

PLATES = {"ground": (6, 3), "drive": (5, 3), "air": (4, 4),
          "combat-0": (4, 3), "combat-1": (4, 3), "combat-2": (4, 4)}
NORMALS = ["stand_light", "stand_medium", "crouch_light", "crouch_medium", "air_light", "air_medium"]
SPECIALS = {"diamondhead": ["spikes", "wall", "shards"],
            "humungousaur": ["colossal", "tailspin", "growth"],
            "feedback": ["discharge", "absorb", "cables"]}


def cuts(count, coverage):
    stride = len(coverage) / count
    edges = [0]
    for step in range(1, count):
        center = round(step * stride)
        radius = round(stride * .25)
        window = range(center - radius, center + radius + 1)
        edge = min(window, key=lambda pos: (sum(coverage[pos - 1:pos + 2]), abs(pos - center)))
        edges.append(edge)
    return list(zip(edges, edges[1:] + [len(coverage)]))


def largest_alpha(image, bounds):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 145 else 0)
    pixels = mask.load()
    biggest = Image.new("L", image.size)
    max_area = 0
    for y, x in np.argwhere(np.asarray(mask) != 0):
        if pixels[x, y] != 255:
            continue
        ImageDraw.floodfill(mask, (int(x), int(y)), 128)
        body = mask.point(lambda value: 255 if value == 128 else 0)
        area = body.histogram()[-1]
        if area > max_area:
            max_area, biggest = area, body
        mask.paste(0, (0, 0), body)
    if not max_area:
        return image.crop(bounds)
    image = image.copy()
    image.putalpha(biggest)
    return image.crop(biggest.getbbox())


def read_plate(form, key):
    columns, rows = PLATES[key]
    plate = Image.open(SOURCE / f"{form}-{key}.png").convert("RGBA")
    mask = np.asarray(plate.getchannel("A")) >= 180
    frames = []
    for row, (top, bottom) in enumerate(cuts(rows, mask.sum(axis=1))):
        for column, (left, right) in enumerate(cuts(columns, mask[top:bottom].sum(axis=0))):
            cel = plate.crop((left, top, right, bottom))
            bounds = cel.getchannel("A").point(lambda value: 255 if value >= 180 else 0).getbbox()
            if not bounds or bounds[2] - bounds[0] < 20 or bounds[3] - bounds[1] < 21:
                raise ValueError(f"Cel ausente: {form}/{key} {row+1},{column+1}")
            # The illustrated crystal effects are separate from the animated fighter.
            # Drop them here so the authoritative field controls growth and breakage.
            if form == "diamondhead" and key == "combat-2" and row > 0:
                cel = largest_alpha(cel, bounds)
            else:
                cel = cel.crop(bounds)
            frames.append(cel)
    return frames


def plant(cel, ratio, size, root, prone=False):
    cel = cel.resize((round(cel.width * ratio), round(cel.height * ratio)), NEAREST)
    ys, xs = np.where(np.asarray(cel.getchannel("A")) >= 180)
    feet = xs[ys > cel.height * .88]
    center = round(np.median(feet if len(feet) and not prone else xs))
    x, y = root[0] - center, root[1] - cel.height
    if not (0 <= x and 0 <= y and x + cel.width <= size[0]):
        raise ValueError(f"Cel fora do atlas: {cel.size} {(x, y)} {size}")
    output = Image.new("RGBA", size)
    output.alpha_composite(cel, (x, y))
    return output


def motions(form, height, variant, tuning, plates):
    grown = variant > 0
    factor = (1, 1.2, 1.35)[variant]
    size = (608 if grown else 512, 336)
    root = (240, 284)
    folder = f"ben/{form}" + (f"/growth-{variant}" if grown else "")
    directory = ROOT / "public/sprites" / folder
    directory.mkdir(parents=True, exist_ok=True)
    clips = {}
    review = {}
    movement = tuning["movement"]["locomotion"]
    moves = tuning["moves"]

    def export(sheet, poses, reference):
        columns = min(6, len(poses))
        ratio = factor * height / reference
        cells = [plant(cel, ratio, size, root, prone=cel.width > 1.8 * cel.height) for cel in poses]
        bounds = [cell.getbbox() for cell in cells]
        left = max(0, min(box[0] for box in bounds) - 2)
        top = max(0, min(box[1] for box in bounds) - 2)
        right = min(size[0], max(box[2] for box in bounds) + 2)
        bottom = min(size[1], max(root[1], max(box[3] for box in bounds)) + 2)
        tile_width, tile_height = right - left, bottom - top
        atlas = Image.new("RGBA", (tile_width * columns, tile_height * ((len(cells) + columns - 1) // columns)))
        for index, cel in enumerate(cells):
            atlas.paste(cel.crop((left, top, right, bottom)),
                        (index % columns * tile_width, index // columns * tile_height))
        atlas.save(directory / f"{sheet}.png", optimize=True)
        geometry = dict(frameWidth=tile_width, frameHeight=tile_height,
                        pivot=dict(x=root[0] - left, y=root[1] - top))
        return f"{folder}/{sheet}.png", columns, cells, geometry

    def register(name, sheet, columns, indices, durations, geometry, loop=False):
        assert len(indices) == len(durations) and min(durations) > 0, name
        clips[name] = dict(sheet=sheet, columns=columns, frames=indices,
                           durations=durations, ticks=1, loop=loop, **geometry)

    def motion(name, poses, durations, reference, loop=False):
        sheet, columns, cells, geometry = export(name, poses, reference)
        assert len({cel.tobytes() for cel in cells}) == len(cells), (form, name)
        review[name] = cells
        register(name, sheet, columns, list(range(len(poses))), durations, geometry, loop)

    g, d, a = (plates[key] for key in ("ground", "drive", "air"))
    stand = np.median([cel.height for cel in g[:6]])
    drive = np.median([d[i].height for i in (0, 4, 5, 9)])
    air = np.median([a[i].height for i in (0, 4, 11, 12, 13)])
    stride = [4, 4, 4, 4, 4, 4] if form == "feedback" else [5, 5, 4, 5, 5, 4]
    dash_ticks = [2, 3, 3, 2, len(movement["dashForward"]) - 10]
    jump_ticks = [movement["jumpStartup"] // 3] * 2
    jump_ticks.append(movement["jumpStartup"] - sum(jump_ticks))
    land = movement["landingTicks"]
    motion("idle", g[:6], [10, 9, 11, 10, 10, 11], stand, True)
    motion("walkForward", g[6:12], stride, stand, True)
    motion("walkBack", g[12:], stride, stand, True)
    motion("dashForward", d[:5], dash_ticks, drive)
    motion("backdash", d[5:10], dash_ticks, drive)
    motion("crouchStart", d[10:12], [3, 3], drive)
    motion("crouchIdle", d[12:14], [11, 10], drive, True)
    motion("crouchEnd", [d[14], a[0]], [3, 2], drive)
    motion("jumpStart", a[1:4], jump_ticks, air)
    motion("jumpRise", a[4:6], [1, 1], air)
    motion("jumpApex", [a[6]], [1], air)
    motion("jumpFall", a[7:9], [1, 1], air)
    motion("landing", a[9:12], [2, (land - 2) // 2, land - 2 - (land - 2) // 2], air)
    for name, pose in zip(("damage", "guardStand", "guardCrouch", "downed"), a[12:16]):
        motion(name, [pose], [1], air)

    attack_rows = [plates[key][i:i + 4] for key in ("combat-0", "combat-1", "combat-2")
                   for i in range(0, len(plates[key]), 4)]
    for name, row in zip(NORMALS, attack_rows[:6]):
        move = moves[name]
        reference = max(row[0].height, row[3].height)
        if "crouch" in name:
            reference *= 1.18
        sheet, columns, _, geometry = export(name, row, reference)
        start, active, recovery = (move[key] for key in ("startup", "active", "recovery"))
        register(name, sheet, columns, [0, 2, 1, 3],
                 [start, active, recovery // 3, recovery - recovery // 3], geometry)

    row = attack_rows[6]
    sheet, columns, _, geometry = export("throw", row, max(row[0].height, row[3].height))
    throw = moves["throw"]
    register("throw", sheet, columns, [0, 1, 3], [throw["startup"], throw["active"], throw["recovery"]], geometry)
    grab = tuning["grab"]
    register("grabHold", sheet, columns, [1, 2, 3],
             [grab["duration"] // 3, grab["hitTick"] - grab["duration"] // 3, grab["duration"] - grab["hitTick"]], geometry)
    register("throwRecover", sheet, columns, [3], [grab["recoveryTicks"]], geometry)

    for family, row in zip(SPECIALS[form], attack_rows[7:]):
        ref = max(row[0].height, row[3].height)
        sheet, columns, _, geometry = export(family, row, ref)
        if family == "absorb":
            register("absorbConfirm", sheet, columns, [1, 2, 3], [4, 7, 7], geometry)
        for strength in ("light", "medium"):
            move_id = f"{family}_{strength}"
            move = moves[move_id]
            start, active, recovery = (move[key] for key in ("startup", "active", "recovery"))
            if move["ben"].get("field") or move["ben"].get("grow"):
                register(move_id, sheet, columns, [0, 1, 2, 3],
                         [start // 2, start - start // 2, active, recovery], geometry)
            else:
                register(move_id, sheet, columns, [0, 1, 2, 3],
                         [start, active // 2, active - active // 2, recovery], geometry)

    if not grown:
        movement_preview(form, review, root)
    idle = clips["idle"]
    return dict(sheet=idle["sheet"], frameWidth=idle["frameWidth"], frameHeight=idle["frameHeight"],
                pivot=idle["pivot"], scale=1, columns=idle["columns"], clips=clips)


def movement_preview(form, clips, root):
    wanted = ["idle", "walkForward", "walkBack", "dashForward", "backdash",
              "crouchStart", "crouchIdle", "crouchEnd", "jumpStart", "jumpRise", "jumpApex",
              "jumpFall", "landing"]
    width, row_height = 1536, 218
    preview = Image.new("RGB", (width, row_height * len(wanted)), "#273a46")
    draw = ImageDraw.Draw(preview)
    label = ImageFont.truetype(FONT, 17)
    for index, name in enumerate(wanted):
        y = index * row_height
        draw.text((18, y + 6), name, font=label, fill="#b7f86e")
        draw.line((10, y + 207, width - 10, y + 207), fill="#557975")
        for frame, cel in enumerate(clips[name]):
            preview.paste(cel, (128 + frame * 256 - root[0], y + 207 - root[1]), cel)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW / f"movimento-{form}-etapa-5.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--form", choices=list(SPECIALS))
    selected = parser.parse_args().form
    tuning = profile()
    path = ROOT / "src/data/ben-stage5-art.json"
    manifests = json.loads(path.read_text(encoding="utf-8")) if selected and path.exists() else {"forms": {}, "grown": {}}
    for form, _, height, _, _ in MODELS:
        if selected and form != selected:
            continue
        plates = {key: read_plate(form, key) for key in PLATES}
        manifests["forms"][form] = motions(form, height, 0, tuning[form], plates)
        if form == "humungousaur":
            manifests["grown"] = {str(variant): motions(form, height, variant, tuning[form], plates) for variant in (1, 2)}
    path.write_text(json.dumps(manifests, indent=2) + "\n", encoding="utf-8")

