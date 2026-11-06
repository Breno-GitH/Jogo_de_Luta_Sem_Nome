"""Lay out native browser captures from both builds, with nearest-neighbor insets."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "deployment/audit/luffy-polish"
BG, PANEL, INK, ACCENT = "#111923", "#202d39", "#eef0e3", "#ffc775"
FONT = ImageFont.truetype("consola.ttf", 15)
TITLE = ImageFont.truetype("consolab.ttf", 20)
KICKS = {
    "stand_medium": "Em pé · chute horizontal",
    "crouch_medium": "Agachado · rasteira",
    "crouch_heavy": "Agachado · chute ascendente",
    "air_medium": "Aéreo · chute horizontal",
    "air_heavy": "Aéreo · chute descendente",
}
ARMS = {
    "stand_heavy": "Em pé · soco forte",
    "pistol_heavy": "Gomu Gomu no Pistol · L",
    "gatling_heavy": "Gomu Gomu no Gatling · L",
    "bazooka_heavy": "Gomu Gomu no Bazooka · L",
}


def open_frame(side, name):
    return Image.open(ROOT / side / (name + ".png")).convert("RGB")


def body(img, wide=False):
    return img.crop((12, 0, 625 if wide else 343, min(285, img.height)))


def detail(img):
    """Find the front-most opaque cluster above the inspector ruler."""
    panel = (32, 45, 57)
    floor = next(y for y in range(img.height) if img.getpixel((3, y)) == (79, 126, 122))
    for x in range(349, 140, -1):
        pixels = [y for y in range(5, floor - 5) if img.getpixel((x, y)) != panel]
        if pixels:
            y = sum(pixels) // len(pixels)
            left, top = x - 25, y - 22
            tile = Image.new("RGB", (36, 37), PANEL)
            tile.paste(img.crop((left, max(0, top), left + 36, min(top + 37, floor - 2))),
                       (0, max(0, -top)))
            return tile.resize((108, 111), Image.Resampling.NEAREST)
    raise ValueError("Extremidade fora da captura")


def compose_limbs(labels, feet):
    width = 940 if feet else 1280
    row = 318 if feet else 224
    out = Image.new("RGB", (width, 76 + row * len(labels)), BG)
    d = ImageDraw.Draw(out)
    d.text((20, 15), "LUFFY · PÉS E SANDÁLIAS" if feet else "LUFFY · BRAÇOS E PUNHOS", INK, TITLE)
    d.text((20, 46), "ANTES", ACCENT, FONT)
    d.text((475 if feet else 650, 46), "DEPOIS", ACCENT, FONT)
    for i, (move, label) in enumerate(labels.items()):
        y = 76 + i * row
        for side, left in (("before", 18), ("after", 473 if feet else 648)):
            frame = open_frame(side, move + "-right")
            image = body(frame, not feet)
            d.rectangle((left, y, left + (440 if feet else 613), y + row - 8), fill=PANEL)
            out.paste(image, (left, y + 19))
            d.text((left + 8, y + 2), label, INK, FONT)
            if feet:
                out.paste(detail(frame), (left + 329, y + 30))
                d.text((left + 337, y + 146), "3×", ACCENT, FONT)
    out.save(ROOT / ("comparacao-pes.png" if feet else "comparacao-bracos.png"))


def compose_kick_phases():
    phases = {"left": "EXTENSÃO PARCIAL", "right": "EXTENSÃO MÁXIMA",
              "impact": "CONTATO CONFIRMADO", "recovery": "RECOLHIMENTO"}
    out = Image.new("RGB", (1504, 62 + len(KICKS) * 271), BG)
    d = ImageDraw.Draw(out)
    d.text((20, 13), "LUFFY · OS CINCO CHUTES QUADRO A QUADRO", INK, TITLE)
    for col, title in enumerate(phases.values()):
        d.text((20 + 372 * col, 43), title, ACCENT, FONT)
    for row, (move, label) in enumerate(KICKS.items()):
        for col, phase in enumerate(phases):
            x, y = 18 + col * 372, 64 + row * 271
            frame = open_frame("after", move + "-" + phase)
            # Air-contact has an opponent below Luffy's pivot. Keep the foe
            # in the image while retaining a clear view of the foot.
            crop = frame.crop((12, 0, 371 if phase == "impact" else 344, frame.height))
            if crop.height > 245:
                crop.thumbnail((360, 245), Image.Resampling.NEAREST)
            d.rectangle((x, y, x + 359, y + 257), fill=PANEL)
            out.paste(crop, (x, y + 16))
            d.text((x + 5, y + 1), label, INK, FONT)
    out.save(ROOT / "fases-dos-chutes.png")


def compose_kick_details():
    anchors = ROOT / "ankles.json"
    if not anchors.exists():
        return
    origins = json.loads(anchors.read_text(encoding="utf-8"))
    out = Image.new("RGB", (1000, 70 + 204 * len(KICKS)), BG)
    d = ImageDraw.Draw(out)
    d.text((18, 14), "LUFFY · TORNOZELO E SANDÁLIA EM 3×", INK, TITLE)
    for col, phase in enumerate(("left", "right", "impact", "recovery")):
        x = 18 + 246 * col
        d.text((x, 46), ("PARCIAL", "MÁXIMA", "CONTATO", "RECOLHIMENTO")[col], ACCENT, FONT)
        for row, (move, label) in enumerate(KICKS.items()):
            y = 70 + 204 * row
            ax, ay = origins[move][col]
            shot = open_frame("after", move + "-" + phase)
            crop = shot.crop((ax - 39, max(0, ay - 24), ax + 35, min(shot.height, ay + 25)))
            d.rectangle((x, y, x + 233, y + 192), fill=PANEL)
            d.text((x + 5, y + 4), label, INK, FONT)
            out.paste(crop.resize((crop.width * 3, crop.height * 3), Image.Resampling.NEAREST), (x, y + 30))
    out.save(ROOT / "pes-em-movimento-3x.png")


def compose_jet():
    scenes = {"gear": "ATIVAÇÃO", "bazooka": "JET BAZOOKA", "gatling": "JET GATLING",
              "inflate": "INFLAÇÃO", "gigant": "GIGANT PISTOL", "landing": "IMPACTO NO CHÃO"}
    out = Image.new("RGB", (1278, 70 + len(scenes) * 365), BG)
    d = ImageDraw.Draw(out)
    d.text((20, 13), "LUFFY · GOMU GOMU NO JET GIGANT", INK, TITLE)
    d.text((20, 44), "ANTES", ACCENT, FONT)
    d.text((651, 44), "DEPOIS", ACCENT, FONT)
    for i, (phase, label) in enumerate(scenes.items()):
        for side, x in (("before", 18), ("after", 651)):
            y = 70 + i * 365
            img = open_frame(side, "jet-" + phase).resize((610, 343), Image.Resampling.NEAREST)
            out.paste(img, (x, y + 16))
            d.text((x, y), label, INK, FONT)
    out.save(ROOT / "comparacao-super.png")


if __name__ == "__main__":
    compose_limbs(KICKS, feet=True)
    compose_limbs(ARMS, feet=False)
    compose_kick_phases()
    compose_kick_details()
    compose_jet()
