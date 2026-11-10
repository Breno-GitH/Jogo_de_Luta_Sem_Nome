"""Export the Stage 5 character masters and the Omnitrix portraits."""
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import NEAREST, OUTPUT, PIVOT, PREVIEW, ROOT, SIZE

SOURCE = ROOT / "art/ben-stage5-source"
MODELS = [
    ("diamondhead", "DIAMANTE", 151, "diamondhead-reference.png", (.58, .29, .52)),
    ("humungousaur", "ENORMOSSAURO", 176, "humungousaur-omniverse-reference.png", (.73, .20, .45)),
    ("feedback", "FEEDBACK", 145, "feedback-omniverse-reference.png", (.58, .28, .52)),
]
FONT = "C:/Windows/Fonts/consola.ttf"
BOLD = "C:/Windows/Fonts/consolab.ttf"


def export(form, height, source, portrait):
    master = Image.open(SOURCE / source).convert("RGBA")
    bounds = master.getchannel("A").point(lambda value: 255 if value >= 192 else 0).getbbox()
    if not bounds:
        raise ValueError(f"{source}: silhouette ausente")
    art = master.crop(bounds)
    art = art.resize((round(art.width * height / art.height), height), NEAREST)

    frame = Image.new("RGBA", (SIZE, SIZE))
    frame.alpha_composite(art, (PIVOT[0] - art.width // 2, PIVOT[1] - height))
    target = OUTPUT / form
    target.mkdir(parents=True, exist_ok=True)
    frame.save(target / "base.png")

    cx, cy, scale = portrait
    radius = height * scale / 2
    x, y = art.width * cx, height * cy
    face = art.crop(tuple(round(value) for value in (x - radius, y - radius, x + radius, y + radius)))
    face.resize((48, 48), NEAREST).save(target / "portrait.png")
    return frame


def comparison(new_frames):
    lineup = [
        ("BEN HUMANO", Image.open(OUTPUT / "base.png").convert("RGBA")),
        ("XLR8", Image.open(OUTPUT / "xlr8/base.png").convert("RGBA")),
        ("QUATRO BRAÇOS", Image.open(OUTPUT / "fourArms/base.png").convert("RGBA")),
        ("CHAMA", Image.open(OUTPUT / "heatblast/base.png").convert("RGBA")),
        *new_frames,
    ]
    width, height, floor = 1470, 327, 267
    image = Image.new("RGB", (width, height), "#121b23")
    draw = ImageDraw.Draw(image)
    draw.text((22, 18), "OMNITRIX / MODELOS DA ETAPA 5", font=ImageFont.truetype(BOLD, 22), fill="#b7f86e")
    draw.text((24, 51), "Sprites a 1× na escala do jogo", font=ImageFont.truetype(FONT, 15), fill="#bccdc6")
    draw.rectangle((19, 80, width - 19, floor), fill="#273a46")
    draw.line((19, floor, width - 19, floor), fill="#66867c")
    label = ImageFont.truetype(FONT, 15)
    for index, (name, frame) in enumerate(lineup):
        x = 105 + 210 * index
        image.paste(frame, (x - PIVOT[0], floor - PIVOT[1]), frame)
        draw.text((x, 285), name, font=label, fill="#e8f3ec", anchor="mt")
        _, top, _, bottom = frame.getbbox()
        draw.text((x, 304), f"{bottom - top} px", font=label, fill="#b7f86e", anchor="mt")
    PREVIEW.mkdir(parents=True, exist_ok=True)
    image.save(PREVIEW / "modelos-etapa-5.png")


if __name__ == "__main__":
    comparison([(label, export(form, height, source, portrait))
                for form, label, height, source, portrait in MODELS])

