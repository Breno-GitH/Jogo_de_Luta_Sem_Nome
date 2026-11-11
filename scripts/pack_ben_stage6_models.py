"""Export the reference-led Stage 6 models for the Omnitrix art lab."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import NEAREST, OUTPUT, PREVIEW, ROOT
from pack_ben_stage5_models import BOLD, FONT
from pack_ben_stage5_animations import cuts

SOURCE = ROOT / "art/ben-stage6-source"
MODELS = {
    "bigChill": ("FRIAGEM", 152, .66, .18, .42),
    "ghostfreak": ("FANTASMÁTICO", 144, .48, .19, .53),
    "nrg": ("NRG CONTIDO", 168, .58, .21, .60),
    "nrgReleased": ("NRG LIBERADO", 160, .63, .18, .40),
}
WIDTH, HEIGHT, ROOT_X, FLOOR = 352, 224, 176, 203
POSES = {
    "bigChill": ("ASAS RECOLHIDAS", "ABERTURA", "ASAS ABERTAS", "MERGULHO"),
    "ghostfreak": ("FLUTUAÇÃO", "INVESTIDA", "GARRA", "RECUO"),
    "nrg": ("CONTENÇÃO", "PASSO", "SOCO", "ABERTURA DA ESCOTILHA"),
    "nrgReleased": ("FORMA ENERGÉTICA", "AVANÇO AÉREO", "PALMA", "RECONTENÇÃO"),
}


def source_poses(key):
    source = Image.open(SOURCE / f"{key}.png").convert("RGBA")
    opaque = np.asarray(source.getchannel("A")) >= 208
    for top, bottom in cuts(2, opaque.sum(axis=1)):
        for left, right in cuts(3, opaque[top:bottom].sum(axis=0)):
            cell = source.crop((left, top, right, bottom))
            alpha = cell.getchannel("A").point(lambda a: 255 if a >= 208 else 0)
            bounds = alpha.getbbox()
            if not bounds or bounds[2] - bounds[0] < 50 or bounds[3] - bounds[1] < 100:
                raise ValueError(f"{key}: quadro ausente em {left}, {top}")
            if any((bounds[0] < 1, bounds[1] < 1, bounds[2] > cell.width - 1, bounds[3] > cell.height - 1)):
                raise ValueError(f"{key}: arte fora da célula em {left}, {top} ({bounds})")
            cell.putalpha(alpha)
            yield cell.crop(bounds)


def root_x(art, index, ghost):
    ys, xs = np.where(np.asarray(art.getchannel("A")) > 0)
    if ghost:
        return round(float(np.median(xs[(ys > art.height * .31) & (ys < art.height * .59)])))
    if index < 3:
        return round(float(np.median(xs[ys > art.height * .86])))
    # The active pose may extend an arm or wing much farther than its core.
    return round(float(np.median(xs[(ys > art.height * .44) & (ys < art.height * .76)])))


def model(key, spec):
    _, height, face_x, face_y, face_scale = spec
    poses = list(source_poses(key))
    ratio = height / poses[0].height
    frames = []
    for index, pose in enumerate(poses):
        art = pose.resize((round(pose.width * ratio), round(pose.height * ratio)), NEAREST)
        hover = 9 if key == "ghostfreak" else 0
        lift = (9 if key == "nrgReleased" else 21) if (
            key == "nrgReleased" and index == 3 or key == "bigChill" and index == 5
        ) else 0
        x = ROOT_X - root_x(art, index, key == "ghostfreak")
        y = FLOOR - art.height - hover - lift
        if x < 0 or y < 0 or x + art.width > WIDTH:
            raise ValueError(f"{key}: quadro {index} não cabe no atlas em {x}, {y}")
        frame = Image.new("RGBA", (WIDTH, HEIGHT))
        frame.alpha_composite(art, (x, y))
        # Reuse the planted ankle and sole pixels during the three idle poses.
        # The legless character uses an anchored torso and a separately drawn tail.
        if index in (1, 2) and key != "ghostfreak":
            ankles = (0, FLOOR - 24, WIDTH, HEIGHT)
            frame.paste(frames[0].crop(ankles), (0, ankles[1]))
        frames.append(frame)
    if len({frame.tobytes() for frame in frames}) != 6:
        raise ValueError(f"{key}: quadros duplicados")

    directory = OUTPUT / key
    directory.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (WIDTH * 3, HEIGHT * 2))
    for index, frame in enumerate(frames):
        atlas.paste(frame, (index % 3 * WIDTH, index // 3 * HEIGHT))
    atlas.save(directory / "stage6-model.png", optimize=True)
    if key != "nrgReleased":
        first = poses[0]
        side = round(first.height * face_scale)
        x = round(first.width * face_x) - side // 2
        y = max(0, round(first.height * face_y) - side // 2)
        portrait = first.crop((x, y, x + side, y + side)).resize((48, 48), NEAREST)
        portrait.save(directory / "portrait.png", optimize=True)

    clips = {
        "idle": dict(frames=[0, 1, 2, 1], ticks=12, loop=True),
        "poses": dict(frames=[3, 4, 5], ticks=28, loop=True),
    }
    if key == "bigChill":
        clips["wings"] = dict(frames=[0, 3, 4, 3], ticks=12, loop=True)
    if key in ("nrg", "nrgReleased"):
        clips["containment"] = dict(frames=[0, 5], ticks=24, loop=False)
    data = dict(sheet=f"ben/{key}/stage6-model.png", frameWidth=WIDTH, frameHeight=HEIGHT,
                columns=3, pivot=dict(x=ROOT_X, y=FLOOR), scale=1, clips=clips)
    return data, frames


def lineup(models):
    image = Image.new("RGB", (1216, 292), "#131d29")
    draw = ImageDraw.Draw(image)
    draw.text((20, 15), "OMNITRIX / MODELOS DA ETAPA 6", font=ImageFont.truetype(BOLD, 24), fill="#c9f7a1")
    draw.text((20, 48), "Sprites em escala de jogo · 1×", font=ImageFont.truetype(FONT, 15), fill="#a9bac3")
    draw.rectangle((20, 76, 1196, 244), fill="#2c414f")
    draw.line((20, 244, 1196, 244), fill="#8da59e")
    label = ImageFont.truetype(BOLD, 16)
    for i, (key, (_, frames)) in enumerate(models.items()):
        x = 164 + i * 296
        frame = frames[0]
        image.paste(frame, (x - ROOT_X, 244 - FLOOR), frame)
        draw.text((x, 258), MODELS[key][0], font=label, anchor="mt", fill="#eff6ed")
    image.save(PREVIEW / "modelos-etapa-6.png", optimize=True)


def poses_board(models):
    image = Image.new("RGB", (1216, 890), "#131d29")
    draw = ImageDraw.Draw(image)
    draw.text((20, 15), "OMNITRIX / SILHUETAS E POSES", font=ImageFont.truetype(BOLD, 24), fill="#c9f7a1")
    font = ImageFont.truetype(FONT, 14)
    for row, (key, (_, frames)) in enumerate(models.items()):
        top = 55 + 206 * row
        for col, frame in enumerate((frames[0], *frames[3:])):
            x = 16 + 300 * col
            draw.rectangle((x, top, x + 287, top + 195), fill="#2c414f")
            crop = (ROOT_X - 141, FLOOR - 171, ROOT_X + 141, FLOOR + 2)
            cropped = frame.crop(crop)
            image.paste(cropped, (x + 3, top + 2), cropped)
            draw.text((x + 9, top + 178), POSES[key][col], font=font, fill="#e5f6ed")
    image.save(PREVIEW / "poses-etapa-6.png", optimize=True)


if __name__ == "__main__":
    PREVIEW.mkdir(parents=True, exist_ok=True)
    models = {key: model(key, spec) for key, spec in MODELS.items()}
    manifest = ROOT / "src/data/ben-stage6-models.json"
    manifest.write_text(json.dumps({key: data for key, (data, _) in models.items()}, indent=2) + "\n", encoding="utf-8")
    lineup(models)
    poses_board(models)
