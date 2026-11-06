"""Compose the eight real engine captures into a looping comparison reel."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deployment/audit/sasuke-specials"
TITLES = [
    ("senbon", "CHIDORI SENBON"),
    ("eiso", "CHIDORI EISO"),
    ("chidori", "CHIDORI"),
    ("gokakyu", "KATON: GOKAKYU"),
    ("hosenka", "KATON: HOSENKA"),
    ("goryuka", "KATON: GORYUKA"),
    ("serpents", "SERPENTES"),
    ("nagashi", "CHIDORI NAGASHI"),
]


def compose():
    font = ImageFont.load_default(size=14)
    slides = []
    for frame in range(24):
        sheet = Image.new("RGB", (950, 857), "#141a29")
        draw = ImageDraw.Draw(sheet)
        draw.text((15, 9), "SASUKE HEBI  /  ESPECIAIS  /  CAPTURA DO MOTOR", fill="#eef3ff", font=font)
        for i, (key, title) in enumerate(TITLES):
            x, y = 10 + i % 2 * 470, 31 + i // 2 * 205
            draw.text((x + 3, y + 3), title, fill="#aad4ff", font=font)
            with Image.open(OUT / "frames" / key / f"{frame}.png") as img:
                sheet.paste(img, (x, y + 23))
        slides.append(sheet)
    slides[0].save(OUT / "especiais-em-combate.webp", lossless=True, save_all=True,
                   append_images=slides[1:], duration=[190] + [50] * 22 + [270], loop=0)


if __name__ == "__main__":
    compose()
