"""Pack the new Feedback poses without moving the arena pivot."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import NEAREST, PREVIEW, ROOT
from pack_ben_combat import profile
from pack_ben_stage5_animations import cuts, plant

SOURCE = ROOT / "art/feedback-rework-source"
DEST = ROOT / "public/sprites/ben/feedback/rework"
SIZE = (480, 260)
ROOT_X, FLOOR = (220, 224)
ROOT_POS = (ROOT_X, FLOOR)
HEIGHT = 145
FONT = "C:/Windows/Fonts/consola.ttf"


def read(name, cols, rows):
    raw = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    opaque = np.asarray(raw.getchannel("A")) >= 180
    output = []
    for top, bottom in cuts(rows, opaque.sum(axis=1)):
        for left, right in cuts(cols, opaque[top:bottom].sum(axis=0)):
            cel = raw.crop((left, top, right, bottom))
            b = cel.getchannel("A").point(lambda a: 255 if a >= 180 else 0).getbbox()
            if not b or b[2] - b[0] < 25 or b[3] - b[1] < 35:
                raise ValueError(f"{name}: cel {len(output)} ausente")
            output.append(cel.crop(b))
    return output


def stable_idle(poses):
    ratio = HEIGHT / np.median([pose.height for pose in poses])
    cells = [plant(pose, ratio, SIZE, ROOT_POS) for pose in poses]
    base = cells[0]
    # Register the new silhouette to the planted leg area. The tail is outside
    # the fit window. Keep the actual lower leg and sole art identical.
    leg_area = (ROOT_X - 27, FLOOR - 41, ROOT_X + 28, FLOOR)
    reference = np.asarray(base.getchannel("A").crop(leg_area)) >= 180
    for i, cel in enumerate(cells[1:], start=1):
        alpha = cel.getchannel("A")
        offsets = [(x, y) for x in range(-6, 7) for y in range(-2, 3)]
        def error(offset):
            x, y = offset
            x0, y0, x1, y1 = leg_area
            region = np.asarray(alpha.crop((x0 - x, y0 - y, x1 - x, y1 - y))) >= 180
            return np.count_nonzero(reference != region), abs(x) + abs(y)
        x, y = min(offsets, key=error)
        fixed = Image.new("RGBA", SIZE)
        fixed.alpha_composite(cel, (x, y))
        feet = (0, FLOOR - 36, SIZE[0], SIZE[1])
        fixed.paste(base.crop(feet), (0, feet[1]))
        cells[i] = fixed
    assert len({cell.tobytes() for cell in cells}) == 6
    assert len({cell.crop((0, FLOOR - 36, SIZE[0], SIZE[1])).tobytes() for cell in cells}) == 1
    return cells


def walk_cells(poses, velocity):
    ratio = HEIGHT / np.median([pose.height for pose in poses])
    cells, offsets = [], []
    for i, pose in enumerate(poses):
        cel = pose.resize((round(pose.width * ratio), round(pose.height * ratio)), NEAREST)
        alpha = np.asarray(cel.getchannel("A"))
        ys, xs = np.where(alpha >= 180)
        feet = xs[ys >= ys.max() - 3]
        support = round(np.median(feet))
        frame = Image.new("RGBA", SIZE)
        # A planted toe is at a defined position for the three poses of its step.
        # The scene applies the remaining correction over the held ticks.
        elapsed = [0, 3, 5][i % 3]
        relative = round((24 if velocity > 0 else -19) - velocity * elapsed)
        frame.alpha_composite(cel, (ROOT_X + relative - support, FLOOR - cel.height))
        cells.append(frame)
        offsets.append(relative)
    return cells, offsets


def head(cell):
    colors = np.asarray(cell).astype(np.int16)
    y, x = np.where((colors[:, :, 3] >= 180) &
                    (colors[:, :, 1] > 140) & (colors[:, :, 0] > 85) &
                    (colors[:, :, 0] > colors[:, :, 2] + 24) &
                    (colors[:, :, 1] > colors[:, :, 0] + 18))
    region = (y >= FLOOR - 158) & (y <= FLOOR - 81) & (x >= ROOT_X - 18)
    if not np.any(region):
        return None
    x, y = x[region], y[region]
    near = y <= y.min() + 4
    return dict(x=round(float(np.median(x[near]))) - ROOT_X - 9,
                y=round(float(np.median(y[near]))) - FLOOR - 8)


def main():
    tuning = profile()["feedback"]
    moves = tuning["moves"]
    clips, heads, supports = {}, {}, {}
    DEST.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)

    def export(name, cells):
        columns = min(6, len(cells))
        bounds = [cel.getbbox() for cel in cells]
        left = min(b[0] for b in bounds) - 2
        top = min(b[1] for b in bounds) - 2
        right = max(b[2] for b in bounds) + 2
        bottom = max(FLOOR, max(b[3] for b in bounds)) + 2
        width, height = right - left, bottom - top
        atlas = Image.new("RGBA", (columns * width, height * ((len(cells) + columns - 1) // columns)))
        for i, cel in enumerate(cells):
            atlas.paste(cel.crop((left, top, right, bottom)), ((i % columns) * width, (i // columns) * height))
        sheet = f"ben/feedback/rework/{name}.png"
        atlas.save(ROOT / "public/sprites" / sheet, optimize=True)
        return dict(sheet=sheet, frameWidth=width, frameHeight=height,
                    columns=columns, pivot=dict(x=ROOT_X - left, y=FLOOR - top))

    def clip(name, geometry, frames, holds, loop=False):
        assert len(frames) == len(holds) and min(holds) > 0
        clips[name] = dict(**geometry, frames=frames, durations=holds, ticks=1, loop=loop)

    idle = stable_idle(read("idle", 3, 2))
    geometry = export("idle", idle)
    clip("idle", geometry, list(range(6)), [12, 10, 11, 11, 10, 12], True)
    preview = Image.new("RGB", (1170, 222), "#293c49")
    draw = ImageDraw.Draw(preview)
    draw.text((18, 14), "FEEDBACK · IDLE / PÉS FIXOS · 1×", font=ImageFont.truetype(FONT, 19), fill="#e5eda5")
    draw.line((12, 195, 1158, 195), fill="#65877d")
    for i, cel in enumerate(idle):
        x = 97 + i * 195
        preview.paste(cel, (x - ROOT_X, 195 - FLOOR), cel)
        draw.text((x, 204), str(i + 1), anchor="mt", fill="#e5eda5")
    preview.save(PREVIEW / "feedback-idle.png")

    walks = read("walk", 6, 2)
    for name, poses, velocity in (
        ("walkForward", walks[:6], tuning["movement"]["speed"]),
        ("walkBack", walks[6:], -tuning["movement"]["locomotion"]["backSpeed"]),
    ):
        cells, supports[name] = walk_cells(poses, velocity)
        clip(name, export(name, cells), list(range(6)), [3, 2, 3, 3, 2, 3], True)

    def body_poses(row, target=HEIGHT):
        ratio = target / max(row[0].height, row[-1].height)
        return [plant(pose, ratio, SIZE, ROOT_POS) for pose in row]

    normal_keys = ["stand_light", "stand_medium", "crouch_light", "crouch_medium", "air_light", "air_medium"]
    normal = read("normals0", 4, 3) + read("normals1", 4, 3)
    for i, key in enumerate(normal_keys):
        row = normal[i*4:(i+1)*4]
        box = export(key, body_poses(row, 115 if key.startswith("crouch") else HEIGHT))
        m = moves[key]
        clip(key, box, [0, 1, 2, 3], [m["startup"] - 2, 2, m["active"], m["recovery"]])

    grab_cells = body_poses(read("throw", 4, 1))
    grab_sheet = export("throw", grab_cells)
    m, g = moves["throw"], tuning["grab"]
    clip("throw", grab_sheet, [0, 1, 3], [m["startup"], m["active"], m["recovery"]])
    clip("grabHold", grab_sheet, [1, 2, 3], [g["hitTick"], 4, g["duration"] - g["hitTick"] - 4])
    clip("throwRecover", grab_sheet, [3], [g["recoveryTicks"]])

    energies = read("special0", 4, 3)
    bodies = read("special1", 4, 3)
    complete = read("special1-complete", 4, 3)
    for i, key in enumerate(("discharge_light", "discharge_medium", "absorb_light")):
        sheet = export(key, body_poses(energies[i*4:(i+1)*4]))
        m = moves[key]
        s, a, r = m["startup"], m["active"], m["recovery"]
        if i == 2:
            clip(key, sheet, [0, 1, 3], [s, a, r])
            clip("absorbConfirm", sheet, [1, 2, 3], [3, 6, 9])
        else:
            clip(key, sheet, [0, 1, 1, 2, 3], [s - 3, 3, a, 7, r - 7])
    sheet = export("counter", body_poses(complete[:4]))
    m = moves["absorb_medium"]
    clip("absorb_medium", sheet, [0, 0, 3], [m["startup"], m["active"], m["recovery"]])
    clip("feedback_counter", sheet, [1, 2, 3], [4, 5, 5])

    for i, key in enumerate(("cables_light", "cables_medium"), start=1):
        full_row = complete[i*4:(i+1)*4]
        full = body_poses(full_row)
        middle = body_poses(bodies[i*4:(i+1)*4], 117)
        cells = [full[0], middle[1], middle[2], full[3]]
        sheet = export(key, cells)
        anchors = [None, head(cells[1]), head(cells[2]), None]
        assert anchors[1] and anchors[2], key
        heads[sheet["sheet"]] = anchors
        m = moves[key]
        clip(key, sheet, [0, 1, 2, 3], [m["startup"] - 4, 4, m["active"] + 6, m["recovery"] - 6])

    data = dict(**geometry, scale=1, clips=clips, heads=heads, supports=supports)
    (ROOT / "src/data/feedback-rework-art.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

