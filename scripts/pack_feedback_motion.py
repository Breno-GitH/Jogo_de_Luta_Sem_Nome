"""Pack the new Feedback motion at the approved body's native scale."""
import json
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from inspect_ben_body import SPRITES, cel
from pack_ben_body import DATA, OUT, PIVOT, ROOT, SIZE, SOURCE, attach_antennae, draw_antennae, feedback_landmarks
from pack_ben_stage6_combat import plate

SHEET = "ben/feedback/movimento-captura-v1.png"
MANIFEST = DATA.with_name("feedback-motion-art.json")
FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14)
FORWARD = [0, 1, 2, 3, 4, 6, 5, 7]
BACK = [8, 9, 11, 10, 12, 13, 14, 15]


def feet(image):
    """Identify the heel of each foot in contact with the floor."""
    alpha = np.asarray(image.getchannel("A"))
    # Bottom rows of the figure exclude the suspended gold tail plug.
    xs = np.flatnonzero((alpha[-6:] == 255).any(axis=0))
    groups = np.split(xs, np.where(np.diff(xs) > 3)[0] + 1)
    return [float(np.quantile(group, .30)) for group in groups if len(group) >= 6]


def frame_data(source):
    body, mark, scale = source
    image = body.resize((round(body.width * scale), round(body.height * scale)), Image.Resampling.NEAREST)
    # Calibration is based on head-to-hip/torso landmarks, never full cel dimensions.
    hip_x = round(mark["hips"][1] * scale)
    return image, hip_x, (round(mark["face"][1] * scale) - 9, round(mark["face"][0] * scale) - 9)


def normalized(path, columns, rows, span):
    images = plate(path, columns, rows)
    marks = [feedback_landmarks(im) for im in images]
    assert all(marks), path
    scale = span / np.median([a["span"] for a in marks])
    return [frame_data((im, a, scale)) for im, a in zip(images, marks)]


def opener_paths(frames):
    # Build-time sampling of the exact same curves the authoritative hitboxes use.
    program = """const {buildSync}=require('esbuild');
const src = `
import { feedbackConductorPaths } from './src/engine/feedback-conductor.ts';
import { feedbackMoves } from './src/engine/ben-moves.ts';
const {readFileSync} = require('node:fs');
const requests = JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(requests.map(([id,tick,head]) =>
  feedbackConductorPaths(feedbackMoves[id],tick,head))));
`;
eval(buildSync({stdin:{contents:src,resolveDir:process.cwd()},platform:'node',bundle:true,write:false}).outputFiles[0].text);
"""
    return json.loads(subprocess.check_output(["node", "-e", program], cwd=ROOT, input=json.dumps(frames), text=True))


def board(name, labelled, columns, *, mirror=False):
    width, height = 230, 210
    sheet = Image.new("RGB", (width * columns, height * ((len(labelled)+columns-1)//columns) + 34), "#202934")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 9), name, font=FONT, fill="#dfefb5")
    for i, (label, im, pivot) in enumerate(labelled):
        x, y = (i % columns) * width, (i // columns) * height + 34
        line = y + height - 19
        draw.line((x + 5, line, x + width - 5, line), fill="#4d645f")
        draw.line((x + width // 2, y + 2, x + width // 2, line + 4), fill="#415261")
        if mirror:
            im = ImageOps.mirror(im)
            px = im.width - pivot[0]
        else:
            px = pivot[0]
        tile = Image.new("RGBA", (width, height))
        tile.alpha_composite(im, (width // 2 - px, height - 19 - pivot[1]))
        sheet.paste(tile, (x, y), tile)
        draw.text((x + 8, y + height - 17), label, font=FONT, fill="#daebee")
    return sheet


def main():
    baseline = json.loads(DATA.read_text(encoding="utf8"))["feedback"]
    idle, idle_pivot = cel(baseline, baseline["clips"]["idle"], baseline["clips"]["idle"]["frames"][0])
    span = feedback_landmarks(idle)["span"]
    walk = normalized(SOURCE / "feedback-walk-antenas.png", 4, 4, span)
    grip = normalized(SOURCE / "feedback-grip-body.png", 4, 3, span * 1.12)
    frames, clips, heads, supports = [], {}, {}, {}
    idle_item = ("Idle", idle, (idle_pivot["x"], idle_pivot["y"]))

    def add(image, hip_x, head, offset=0, *, full=False):
        frame = Image.new("RGBA", SIZE)
        x, y = PIVOT[0] - hip_x + offset, PIVOT[1] - image.height
        frame.alpha_composite(image, (x, y))
        anchor = (x + head[0], y + head[1])
        index = len(frames)
        if not full:
            heads[index] = dict(x=anchor[0] - PIVOT[0], y=anchor[1] - PIVOT[1])
        frames.append(frame)
        return index

    def clip(name, frames, holds, loop=False):
        clips[name] = dict(frames=frames, durations=holds, ticks=1, loop=loop)

    for name, order, speed, contact, holds, toe in (
        ("walkForward", FORWARD, 5.8, 28, [4, 3, 3, 3] * 2, [1, 0, 0, 0] * 2),
        ("walkBack", BACK, -4.5, -24, [3] * 8, [0, 0, 1, 1] * 2),
    ):
        ids, contact_info = [], []
        for i, index in enumerate(order):
            im, hip, head = walk[index]
            ankles = feet(im)
            assert ankles, (name, i)
            phase = i % 4
            support = ankles[-1] if toe[i] else ankles[0]
            relative = round(contact - speed * sum(holds[i-phase:i]))
            # Limit whole-pose registration to twelve pixels around the hip.
            offset = max(-12, min(12, round(relative - (support - hip))))
            contact_info.append(dict(x=round(support - hip + offset), step=i//4))
            ids.append(add(im, hip, head, offset, full=True))
        clip(name, ids, holds, True)
        supports[name] = contact_info

    ids = [add(*pose) for pose in grip]
    j = ids[:4]
    k = ids[4:]
    for name, pose_ids, holds in (
        ("conductor_light", [j[0], j[1], j[2], j[3], j[1], j[0]], [2, 3, 11, 6, 7, 11]),
        ("conductor_medium", [k[0], k[1], k[2], k[3], k[6], k[7], j[0]], [5, 6, 14, 6, 9, 8, 10]),
    ):
        poses = [index for index, hold in zip(pose_ids, holds) for _ in range(hold)]
        paths = opener_paths([(name,tick,heads[index]) for tick,index in enumerate(poses)])
        indexes = []
        for index, paths_at_tick in zip(poses, paths):
            curves = [[(p["x"] + PIVOT[0], p["y"] + PIVOT[1]) for p in path] for path in paths_at_tick]
            image, _ = draw_antennae(frames[index], curves)
            indexes.append(len(frames))
            frames.append(image)
        clip(name, indexes, [1] * len(indexes))
    clip("conductorHold", [j[2], j[3], j[2], j[1]], [3, 7, 5, 5])
    clip("conductorHoldK", [k[2], k[3], k[4], k[5], k[4], k[5], k[6], k[7]], [3, 5, 3, 4, 3, 4, 3, 3])
    clip("conductor_lightRecover", [j[1], j[0]], [4, 8])
    clip("conductor_mediumRecover", [k[7], j[0]], [4, 8])

    bounds = [im.getbbox() for im in frames]
    crop = (min(b[0] for b in bounds)-2, min(b[1] for b in bounds)-2,
            max(b[2] for b in bounds)+2, max(PIVOT[1]+1, max(b[3] for b in bounds)+2))
    width, height = crop[2]-crop[0], crop[3]-crop[1]
    pivot = (PIVOT[0]-crop[0], PIVOT[1]-crop[1])
    cols = 8
    atlas = Image.new("RGBA", (cols*width, ((len(frames)+cols-1)//cols)*height))
    for i, im in enumerate(frames):
        atlas.paste(im.crop(crop), (i % cols * width, i // cols * height))
    atlas.save(SPRITES / SHEET, optimize=True)
    data = dict(sheet=SHEET, frameWidth=width, frameHeight=height, columns=cols,
                pivot=dict(x=pivot[0], y=pivot[1]), clips=clips, heads=heads, supports=supports)
    MANIFEST.write_text(json.dumps(data, indent=2)+"\n", encoding="utf8")

    for name, label, key in (
        ("walkForward", "Avanço", "feedback-caminhada-frente"),
        ("walkBack", "Recuo", "feedback-caminhada-tras"),
    ):
        ims = [(str(i+1), frames[index].crop(crop), pivot) for i,index in enumerate(clips[name]["frames"])]
        board(label + " · 8 quadros reais · escala 1×", ims, 4).save(OUT / (key + ".png"))
    mirror = [(label, frames[clips[name]["frames"][i]].crop(crop), pivot)
              for name in ("walkForward", "walkBack") for i, label in ((1,"Apoio"),(3,"Impulso"))]
    board("Caminhada espelhada · 1×", mirror, 4, mirror=True).save(OUT / "feedback-caminhada-espelhada.png")
    scale = [idle_item]
    for label, index in (("Preparação J", j[1]), ("Lançamento J", j[2]),
                         ("Preparação K", k[1]), ("Descarga K", k[5])):
        head = heads[index]
        full, _ = attach_antennae(frames[index], (PIVOT[0]+head["x"], PIVOT[1]+head["y"]))
        scale.append((label, full, PIVOT))
    board("Escala nativa · Idle e Captura Condutora", scale, 5).save(OUT / "feedback-captura-escala.png")


if __name__ == "__main__":
    main()
