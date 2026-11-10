"""Register the two Stage 7 design studies against Ben's actual idle sprite."""
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from inspect_ben_body import ROOT, cel
from pack_ben_stage6_combat import largest_alpha

SOURCE = ROOT / "art/ben-stage7-source"
OUT = ROOT / "public/previews/ben/etapa-7"
PIXEL = Image.Resampling.NEAREST
PIVOT = (144, 202)
CELL = (288, 212)
FONT = "C:/Windows/Fonts/consola.ttf"
BOLD = "C:/Windows/Fonts/consolab.ttf"


def prepare(name, height):
    path = SOURCE / (name + "-fonte.png")
    sprite = Image.open(path).convert("RGBA")
    alpha = sprite.getchannel("A").point(lambda a: 255 if a >= 223 else 0)
    assert alpha.getbbox(), f"No visible character in {path.name}"
    assert min(alpha.getpixel(p) for p in ((0,0), (0,alpha.height-1), (alpha.width-1,0), (alpha.width-1,alpha.height-1))) == 0
    sprite.putalpha(alpha)
    shape = largest_alpha(sprite, alpha.getbbox())
    scale = height / shape.height
    shape = shape.resize((round(shape.width * scale), height), PIXEL)
    shape = shape.crop(shape.getbbox())
    mask = np.asarray(shape.getchannel("A"))
    # Position the body by its feet, independent of the width of the arms.
    _, xs = np.where(mask[max(0, shape.height - 12):] == 255)
    x = round(float(np.median(xs)))
    frame = Image.new("RGBA", CELL)
    dx, dy = PIVOT[0] - x, PIVOT[1] - shape.height
    assert dx >= 1 and dx + shape.width < CELL[0] and dy >= 1
    frame.alpha_composite(shape, (dx, dy))
    assert frame.getbbox()[3] == PIVOT[1]
    frame.save(OUT / (name + "-base.png"), optimize=True)
    return frame, PIVOT


def ben_idle():
    data = json.loads((ROOT / "src/data/ben-art.json").read_text(encoding="utf8"))
    clip = data["clips"]["idle"]
    sprite, pivot = cel(data, clip, clip["frames"][0])
    return sprite, (pivot["x"], pivot["y"])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    subjects = [
        ("Gravattack", "Rocha em camadas · núcleo espiral", *prepare("gravattack", 180)),
        ("Ben humano", "Sprite de Idle usado no jogo", *ben_idle()),
        ("Eco Eco", "Fendas verdes · cabos e módulos sonoros", *prepare("eco-eco", 101)),
    ]
    result = Image.new("RGB", (1242, 552), "#151e29")
    draw = ImageDraw.Draw(result)
    title = ImageFont.truetype(BOLD, 27)
    label = ImageFont.truetype(BOLD, 19)
    detail = ImageFont.truetype(FONT, 15)
    draw.text((22, 15), "BEN 10 OMNIVERSE  /  BASES VISUAIS DA ETAPA 7", fill="#e5f5c1", font=title)
    draw.text((23, 49), "Mesmo piso, escala nativa do jogo · ampliação 2× por vizinho mais próximo",
              fill="#adc0cc", font=detail)
    ground, top = 453, 79
    for (x, width), (name, features, sprite, pivot) in zip(
        ((18, 532), (564, 307), (885, 339)), subjects
    ):
        draw.rectangle((x, top, x + width, ground + 15), fill="#222e3b")
        for level in (0, 50, 100, 150, 180):
            y = ground - level*2
            draw.line((x+6, y, x+width-6, y), fill="#506755" if level == 0 else "#354453")
        board = Image.new("RGBA", (width, ground - top + 15))
        enlarged = sprite.resize((sprite.width * 2, sprite.height * 2), PIXEL)
        board.alpha_composite(enlarged, (width//2 - pivot[0]*2, ground - top - pivot[1]*2))
        result.paste(board, (x, top), board)
        box = sprite.getbbox()
        height = box[3] - box[1]
        draw.text((x+6, ground+26), f"{name} · {height} px", fill="#eef5d2", font=label)
        draw.text((x+6, ground+56), features, fill="#b8ced3", font=detail)
    result.save(OUT / "bases-comparacao.png", optimize=True)


if __name__ == "__main__":
    main()
