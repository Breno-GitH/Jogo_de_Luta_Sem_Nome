"""Pack final Ben movement, armored NRG steps, and the Alien X cels."""
import json

import numpy as np
from PIL import Image

from inspect_ben_body import ROOT, SPRITES, cel
from pack_ben_stage6_combat import plate

SOURCE = ROOT / "art/ben-source"
DATA = ROOT / "src/data"
SIZE = 256
PIVOT = (128, 224)


def clip(frames, durations, loop=False):
    assert len(frames) == len(durations)
    return {"frames": list(frames), "durations": durations, "ticks": 1, "loop": loop}


def frame(source, ratio, shift=0):
    image = source.resize((round(source.width * ratio), round(source.height * ratio)), Image.Resampling.NEAREST)
    bounds = image.getbbox()
    assert bounds
    image = image.crop(bounds)
    y, x = np.where(np.asarray(image.getchannel("A")) > 0)
    central = x[(y > image.height * .26) & (y < image.height * .64)]
    center = float(np.median(central)) if len(central) else image.width / 2
    x = round(PIVOT[0] - center + shift)
    y = PIVOT[1] - image.height
    assert 1 <= x < x + image.width < SIZE and 1 <= y
    cell = Image.new("RGBA", (SIZE, SIZE))
    cell.alpha_composite(image, (x, y))
    return cell


def make(sheet, cells, clips):
    cols = 6
    image = Image.new("RGBA", (SIZE * cols, SIZE * ((len(cells) + cols - 1) // cols)))
    for i, cell in enumerate(cells):
        image.paste(cell, (i % cols * SIZE, i // cols * SIZE))
    image.save(SPRITES / sheet, optimize=True)
    return {"sheet": sheet, "frameWidth": SIZE, "frameHeight": SIZE,
            "columns": cols, "pivot": dict(zip(("x", "y"), PIVOT)), "scale": 1, "clips": clips}


def load(name, cols, rows):
    return plate(SOURCE / (name + "-final.png"), cols, rows)


def walk_cells(poses, height, amount):
    # One scale for the entire sheet. Offsets represent weight transfer between contacts.
    ratio = height / np.median([im.height for im in poses[:8]])
    offsets = [amount, amount / 2, 0, -amount / 2, amount, amount / 2, 0, -amount / 2]
    return [frame(im, ratio, offsets[i % 8] * (1 if i < 8 else -.7)) for i, im in enumerate(poses)]


def human():
    cells = walk_cells(load("ben-walk", 4, 4), 130, 8)
    poses = load("ben-motion", 5, 5)
    ratio = 130 / np.median([poses[i].height for i in (4, 5, 6, 17, 19, 22, 23)])
    cells += [frame(im, ratio) for im in poses]
    actions = load("ben-actions", 4, 3)
    ratio = 130 / np.median([im.height for im in actions[8:]])
    cells += [frame(im, ratio) for im in actions]
    return make("ben/human-motion.png", cells, {
        "walkForward": clip(range(8), [4] * 8, True),
        "walkBack": clip(range(8, 16), [5] * 8, True),
        "dashForward": clip(range(16, 21), [2, 2, 2, 3, 3]),
        "backdash": clip(range(21, 26), [2, 3, 2, 2, 3]),
        "crouchStart": clip([26, 27], [3, 3]), "crouchIdle": clip([27], [10]),
        "crouchEnd": clip([27, 26], [2, 3]),
        "jumpStart": clip([26, 28], [3, 3]), "jumpRise": clip([28, 29], [1, 1]),
        "jumpApex": clip([30], [1]), "jumpFall": clip([31], [2]),
        "landing": clip([32, 26], [4, 4]),
        "guardStand": clip([33], [8]), "guardCrouch": clip([34], [8]),
        "damage": clip([35], [12]), "launched": clip([35, 31], [7, 12]),
        "downed": clip([36], [8]), "getup": clip([37, 26, 38], [6, 5, 4]),
        "entrance": clip([0, 2, 4, 6, 38], [4, 4, 4, 4, 15]),
        "taunt": clip([38, 39, 52, 39], [5, 12, 14, 13]),
        "victory": clip([38, 39, 40], [6, 8, 25]),
        "crouch_light": clip([41, 42, 41, 27], [5, 3, 4, 5]),
        "crouch_medium": clip([43, 44, 43, 27], [10, 4, 8, 12]),
        "air_light": clip([45, 46, 45], [5, 3, 9]),
        "air_medium": clip([47, 48, 47, 31], [7, 4, 7, 10]),
        "throw": clip([49, 50, 49], [8, 3, 21]),
        "grabHold": clip([50, 49, 51, 38], [6, 11, 6, 3]),
        "throwRecover": clip([51, 49, 38], [4, 5, 5]),
        "omnitrixUse": clip([39, 52, 49], [5, 10, 6]),
        "alienX": clip([38, 39, 52, 51, 49, 38], [6, 7, 10, 6, 15, 24]),
        "alienXWatch": clip([39, 52, 49, 52], [7, 10, 7, 10]),
        "alienXReturn": clip([52, 39, 38], [7, 8, 18]),
    })


def armor():
    base = json.loads((DATA / "ben-body-art.json").read_text(encoding="utf8"))["nrg"]
    idle = base["clips"]["idle"]
    idle_cell, _ = cel(base, idle, idle["frames"][0])
    bounds = idle_cell.getbbox()
    return make("ben/nrg/walk-final.png", walk_cells(load("nrg-walk", 4, 4), bounds[3] - bounds[1], 7), {
        "walkForward": clip(range(8), [5, 4, 4, 4, 5, 4, 4, 4], True),
        "walkBack": clip(range(8, 16), [6, 5, 5, 5, 6, 5, 5, 5], True),
    })


def alien_x():
    poses = load("alien-x", 4, 3)
    ratio = 156 / np.median([im.height for im in poses[3:]])
    return make("ben/alien-x.png", [frame(im, ratio) for im in poses], {
        "idle": clip([3], [8]),
        "alienXReveal": clip([0, 1, 2, 3], [7, 8, 10, 10]),
        "alienXGrasp": clip([3, 4, 5, 6, 7, 6], [8, 11, 16, 16, 23, 16]),
        "alienXRewrite": clip([7, 8, 9, 10, 11], [4, 13, 6, 10, 10]),
    })


if __name__ == "__main__":
    manifest = {"human": human(), "nrgWalk": armor(), "alienX": alien_x()}
    (DATA / "ben-final-art.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")

