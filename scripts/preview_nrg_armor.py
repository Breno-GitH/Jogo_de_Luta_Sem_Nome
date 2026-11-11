"""Use the shipped arena recordings to produce the containment combat previews."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pack_ben_body import OUT

FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14)
TITLE = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 20)

NORMALS = {
    "stand_light": "J · Soco Metálico",
    "stand_medium": "K · Golpe de Contenção",
    "crouch_light": "S + J · Soco Baixo",
    "crouch_medium": "S + K · Varredura Pesada",
    "air_light": "J no ar · Soco Aéreo",
    "air_medium": "K no ar · Impacto Descendente",
    "throw": "U · Arremesso de Contenção",
}


def timeline(directory):
    states = json.loads((directory / "frames.json").read_text(encoding="utf8"))
    return states, sorted(directory.glob("*.png"))


def viewport(states, width, top=224):
    center = (states[0]["x"] + states[0]["rival"]) * .375
    left = max(0, min(960 - width, round(center - width / 2)))
    return left, top, left + width, 456


def film(directory, name, width=420):
    states, files = timeline(directory)
    crop = viewport(states, width)
    frames = []
    for file in files:
        with Image.open(file) as im:
            frames.append(im.crop(crop).convert("RGB"))
    frames[0].save(OUT / ("nrg-arena-" + name + ".webp"), append_images=frames[1:],
                   save_all=True, loop=0, duration=33, lossless=True, method=2)


def board(directory, normals):
    title = "NRG CONTIDO  /  NORMAIS E ARREMESSO NA ARENA"
    width, height = 266, 232
    sheet = Image.new("RGB", (width * 4, 37 + height * 2), "#192631")
    draw = ImageDraw.Draw(sheet)
    draw.text((13, 9), title, fill="#fff2c0", font=TITLE)
    for i, (key, name) in enumerate(normals.items()):
        states, files = timeline(directory / key)
        strike = next((i for i,s in enumerate(states) if s["health"] < states[0]["health"]), len(states)//2)
        tile = viewport(states, width, 249)
        x,y = (i % 4)*width, 37+(i // 4)*height
        with Image.open(files[strike]) as im:
            sheet.paste(im.crop(tile), (x,y))
        draw.text((x+8,y+211), name, fill="#e5eff2", font=FONT)
    sheet.save(OUT / "nrg-arena-normais.png", optimize=True)


def specials_board(training, lan):
    records = [
        (training / "armorImpact_light", "Aríete de Contenção", "armorImpact_light", 9),
        (training / "armorImpact_medium", "Martelo da Fornalha", "armorImpact_medium", 17),
        (lan, "Contrapressão", "nrgCounterShove", 3),
        (training / "thermal_light", "Raio de Calor J", "thermal_light", 12),
        (training / "thermal_medium", "Raio de Calor K", "thermal_medium", 22),
        (training / "release", "Liberação da Armadura", "nrgUnseal_light", 14),
    ]
    width, height = 322, 255
    sheet = Image.new("RGB", (width * 3, 38 + height * 2), "#192631")
    d = ImageDraw.Draw(sheet)
    d.text((13, 10), "NRG CONTIDO  /  ESPECIAIS NA ARENA", fill="#fff2c0", font=TITLE)
    for i, (folder, label, move, tick) in enumerate(records):
        states, files = timeline(folder)
        candidates = [i for i,s in enumerate(states) if s["move"] == move]
        if move == "nrgCounterShove":
            sample = next((i for i,s in enumerate(states) if s["health"] < states[0]["health"]), candidates[-1])
        else:
            sample = min(candidates, key=lambda i: abs(states[i]["tick"] - tick))
        x,y = (i % 3)*width, 38+(i // 3)*height
        with Image.open(files[sample]) as im:
            sheet.paste(im.crop(viewport(states, width)), (x,y))
        d.text((x+10,y+235), label, font=FONT, fill="#e5eff2")
    sheet.save(OUT / "nrg-arena-especiais.png", optimize=True)


if __name__ == "__main__":
    training, lan = map(Path, sys.argv[1:3])
    for key, label in (
        ("idle", "idle"), ("armorImpact_light", "ariete"), ("armorImpact_medium", "martelo"),
        ("armorCounter_medium", "contrapressao-falha"), ("thermal_light", "raio-j"),
        ("thermal_medium", "raio-k"), ("release", "liberacao"), ("combo", "combo"),
    ):
        film(training / key, label, 480 if key.startswith("thermal") else 410)
    film(lan, "contrapressao")
    board(training, NORMALS)
    specials_board(training, lan)
