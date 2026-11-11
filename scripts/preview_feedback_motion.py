"""Export animation previews from captures of the actual training arena."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pack_ben_body import OUT

FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
TITLE = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 19)


def footage(path):
    states = json.loads((path / "frames.json").read_text(encoding="utf8"))
    paths = sorted(path.glob("*.png"))
    return states, paths


def loop(path, name):
    states, paths = footage(path)
    walk = path.name.startswith("walk-")
    xs = [s["x"] * .75 for s in states]
    # Fixed camera crop preserves translation through the step rather than
    # following each individual body pose.
    right = states[0]["facing"] > 0
    left = round(min(xs) - (91 if walk or right else 185))
    edge = round(max(xs) + (91 if walk or not right else 185))
    crop = (max(0, left), 239, min(960, edge), 473)
    frames = []
    for path in paths:
        with Image.open(path) as image:
            frames.append(image.crop(crop).convert("RGB"))
    frames[0].save(OUT / name, append_images=frames[1:], save_all=True,
                   loop=0, duration=33, lossless=True, method=2)


def moments(path, variant):
    states, files = footage(path)
    name = "conductor_" + ("light" if variant == "J" else "medium")
    held = [i for i, s in enumerate(states) if s["capture"] == name]
    opening = [i for i, s in enumerate(states) if s["clip"] == name and i < held[0]]
    release = next((i for i, s in enumerate(states) if i > held[-1] and s["clip"].endswith("Recover")), held[-1]+1)
    active = opening[-1]
    impact = next((i for i in held if states[i]["health"] < states[held[0]]["health"]), held[len(held)//2])
    indices = [opening[len(opening)//3], active, held[0], impact, held[-2], release]
    labels = ("Preparação", "Extensão", "Contato", "Descarga", "Retração", "Recuperação")
    x = round(states[active]["x"] * .75)
    width, height = 302, 222
    left = max(0, min(960-width, x - (78 if states[active]["facing"] > 0 else 225)))
    panel = Image.new("RGB", (width * 3, height * 2 + 38), "#18222e")
    d = ImageDraw.Draw(panel)
    d.text((12, 10), f"CAPTURA CONDUTORA {variant}  /  QUADROS DA ARENA", font=TITLE, fill="#eff5b7")
    for i, (label, index) in enumerate(zip(labels, indices)):
        dx, dy = (i % 3) * width, (i // 3) * height + 38
        with Image.open(files[index]) as image:
            panel.paste(image.crop((left, 255, left+width, 450)), (dx, dy))
        d.text((dx+10, dy+201), label, font=FONT, fill="#e3eceb")
    panel.save(OUT / f"feedback-captura-{variant.lower()}-sequencia.png", optimize=True)


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    for code in ("walk-1", "walk--1", "j-direita", "k-direita", "j-esquerda", "k-esquerda", "j-erro", "k-erro", "j-defesa"):
        loop(directory / code, "feedback-arena-" + code + ".webp")
    for key in ("J", "K"):
        moments(directory / (key.lower() + "-direita"), key)
