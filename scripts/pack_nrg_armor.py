"""Register only the containment suit's new attack drawings to the game's floor."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from inspect_ben_body import SPRITES, cel
from pack_ben_body import DATA, OUT, PIVOT, SIZE, SOURCE, colors
from pack_ben_stage6_combat import plate

SHEET = "ben/nrg/armadura-combate-v1.png"
DATA_FILE = DATA.with_name("nrg-armor-art.json")


def visor(image):
    r, g, b, a = colors(image)
    ys, xs = np.where((a >= 226) & (r > 170) & (g > 85) & (b < 110) & (r > g * 1.16) & (g > b + 42))
    assert xs.size >= 10
    # The slot cluster is the highest amber feature. Exclude the chest badge.
    xs = xs[ys <= ys.min() + round(image.height * .085)]
    return float(np.median(xs)), float(np.ptp(xs))


def main():
    existing = json.loads(DATA.read_text(encoding="utf8"))["nrg"]
    idle_clip = existing["clips"]["idle"]
    idle, root = cel(existing, idle_clip, idle_clip["frames"][0])
    idle_height = idle.getbbox()[3] - idle.getbbox()[1]
    idle_x = visor(idle)[0] - root["x"]
    parts = {
        name: plate(SOURCE / f"nrg-armor-{name}.png", 4, 3)
        for name in ("special", "ground", "air", "throw")
    }
    scales = {
        "special": idle_height / np.median([parts["special"][i].height for i in (0, 3, 4, 8, 11)]),
        "ground": idle_height / np.median([parts["ground"][i].height for i in (0, 3, 4, 7)]),
        "air": (visor(idle)[1] + 1) / np.median([visor(im)[1] for im in parts["air"]]),
        "throw": idle_height / np.median([im.height for im in parts["throw"]]),
    }
    # Registration places the visor relative to the hips rather than using the
    # midpoint of an extended fist or boot. All cels in a plate share one ratio.
    transfers = {
        "special": (1, 9, 18, 5, 1, 0, 7, 2, 0, 1, 6, 0),
        "ground": (0, 1, 4, 2, 0, -2, 9, 2, -3, 0, 6, 1),
        "air": (-3, -6, -4, -2, 0, 1, 5, 1, 0, 1, 6, 2),
        "throw": (1, 2, 3, 2, 4, 1, 0, 6, 8, 4, 2, 0),
    }
    frames = []
    poses = {}
    clips = {}
    for name, images in parts.items():
        indexes = []
        ratio = scales[name]
        for image, shift in zip(images, transfers[name]):
            part = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.NEAREST)
            x = round(PIVOT[0] + idle_x + shift - visor(image)[0] * ratio)
            y = PIVOT[1] - part.getbbox()[3]
            canvas = Image.new("RGBA", SIZE)
            canvas.alpha_composite(part, (x, y))
            indexes.append(len(frames))
            frames.append(canvas)
        poses[name] = indexes
    neutral = len(frames)
    canvas = Image.new("RGBA", SIZE)
    canvas.alpha_composite(idle, (PIVOT[0] - root["x"], PIVOT[1] - root["y"]))
    frames.append(canvas)
    ground, air, special, throws = (poses[k] for k in ("ground", "air", "special", "throw"))

    def clip(name, indexes, durations):
        assert len(indexes) == len(durations)
        clips[name] = dict(frames=indexes, durations=durations, ticks=1, loop=False)

    for name, indexes, holds in (
        ("stand_light", ground[0:4], [2, 4, 4, 7, 5]),
        ("stand_medium", ground[4:8], [3, 8, 5, 15, 8]),
        ("crouch_light", ground[8:12], [2, 5, 4, 13]),
        ("crouch_medium", air[0:4], [4, 8, 5, 26]),
        ("air_light", air[4:8], [2, 4, 5, 15]),
        ("air_medium", air[8:12], [2, 6, 10, 25]),
        ("armorImpact_light", special[0:4], [4, 5, 7, 14, 10]),
        ("armorImpact_medium", special[4:8], [5, 12, 5, 23, 10]),
    ):
        clip(name, indexes + ([neutral] if len(holds) == 5 else []), holds)
    clip("nrgDropLanding", [air[11], ground[8], neutral], [5, 4, 3])
    clip("armorCounter_medium", [special[8], special[9], special[11], neutral], [3, 10, 18, 11])
    clip("nrgCounterShove", [special[9], special[10], special[11], neutral], [3, 4, 16, 9])
    clip("throw", throws[0:4], [5, 5, 3, 21])
    clip("grabHold", throws[4:9], [3, 6, 8, 4, 5])
    clip("throwRecover", throws[9:12], [4, 4, 4])

    bounds = [im.getbbox() for im in frames]
    area = (min(b[0] for b in bounds) - 2, min(b[1] for b in bounds) - 2,
            max(b[2] for b in bounds) + 2, max(b[3] for b in bounds) + 2)
    width, height = area[2] - area[0], area[3] - area[1]
    cols = 8
    atlas = Image.new("RGBA", (cols * width, ((len(frames) + cols - 1) // cols) * height))
    for i, frame in enumerate(frames):
        atlas.paste(frame.crop(area), (i % cols * width, i // cols * height))
    atlas.save(SPRITES / SHEET, optimize=True)
    DATA_FILE.write_text(json.dumps(dict(sheet=SHEET, frameWidth=width, frameHeight=height, columns=cols,
        pivot=dict(x=PIVOT[0]-area[0], y=PIVOT[1]-area[1]), clips=clips), indent=2) + "\n", encoding="utf8")

    def unchanged(name, i):
        clip = existing["clips"][name]
        im, root = cel(existing, clip, clip["frames"][i])
        result = Image.new("RGBA", SIZE)
        result.alpha_composite(im, (PIVOT[0] - root["x"], PIVOT[1] - root["y"]))
        return result

    board("nrg-armadura-escala", "NRG CONTIDO  /  ESCALA NATIVA NA ARENA", [
        ("Idle", frames[neutral]),
        ("Soco metálico", frames[ground[2]]), ("Golpe de Contenção", frames[ground[6]]),
        ("Soco baixo", frames[ground[10]]), ("Varredura Pesada", frames[air[2]]),
        ("Soco aéreo", frames[air[6]]), ("Impacto Descendente", frames[air[10]]),
        ("Arremesso", frames[throws[7]]),
        ("Aríete", frames[special[2]]), ("Martelo", frames[special[6]]),
        ("Contrapressão", frames[special[10]]),
        ("Raio J", unchanged("thermal_light", 2)), ("Raio K", unchanged("thermal_medium", 2)),
        ("Liberação", unchanged("nrgUnseal_light", 2)),
    ], 5)


def board(name, title, poses, columns):
    width, height = 234, 260
    plate = Image.new("RGB", (columns * width, 34 + ((len(poses) + columns - 1) // columns) * height), "#202934")
    draw = ImageDraw.Draw(plate)
    font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
    draw.text((13, 9), title, fill="#eef3c1", font=font)
    for i, (label, sprite) in enumerate(poses):
        x, y = (i % columns) * width, (i // columns) * height + 34
        floor = y + height - 24
        for level in (0, 40, 80, 120, 160):
            draw.line((x + 5, floor - level, x + width - 5, floor - level), fill="#425566")
        region = sprite.crop((PIVOT[0] - 98, PIVOT[1] - 222, PIVOT[0] + 136, PIVOT[1] + 2))
        plate.paste(region, (x, floor - 222), region)
        draw.text((x + 9, floor + 5), label, font=font, fill="#e4eeee")
    plate.save(OUT / (name + ".png"), optimize=True)


if __name__ == "__main__":
    main()
