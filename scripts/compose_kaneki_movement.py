"""Compose native-pixel contact sheets and animations from the running lab."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "public/sprites/kaneki"
OUTPUT = ROOT / "public/previews/kaneki"


def contact():
    idle = json.loads((ROOT / "src/data/kaneki-art.json").read_text())
    motion = json.loads((ROOT / "src/data/kaneki-movement-art.json").read_text())
    clips = dict(idle["clips"], **motion["clips"])
    art = {
        "kaneki/idle.png": Image.open(SPRITES / "idle.png"),
        "kaneki/movement.png": Image.open(SPRITES / "movement.png"),
    }
    labels = [
        "IDLE", "CAMINHADA / FRENTE", "CAMINHADA / RECUO", "DASH", "BACKDASH",
        "AGACHAR / INÍCIO", "AGACHADO", "AGACHAR / FIM", "SALTO / PREPARAÇÃO",
        "SALTO / SUBIDA", "SALTO / ÁPICE", "SALTO / DESCIDA", "ATERRISSAGEM",
    ]
    cell_w, cell_h = 166, 187
    sheet = Image.new("RGB", (cell_w * 6, cell_h * len(clips) + 36), "#15131e")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 11), "KANEKI KEN  /  MOVIMENTO  /  45 DESENHOS A 1:1", fill="#ffe6ed")
    for row, ((_, clip), label) in enumerate(zip(clips.items(), labels)):
        y = row * cell_h + 36
        draw.text((12, y + 3), label, fill="#ffc4cf")
        atlas = art[clip.get("sheet", idle["sheet"])]
        columns = clip.get("columns", idle["columns"])
        for i, frame in enumerate(clip["frames"]):
            x = cell_w * i
            draw.rectangle((x + 1, y + 20, x + cell_w - 2, y + cell_h - 2), fill="#252434")
            draw.line((x + 2, y + 165, x + cell_w - 3, y + 165), fill="#775469")
            left, top = frame % columns * 256, frame // columns * 256
            crop = atlas.crop((left + 50, top + 79, left + 206, top + 224))
            sheet.paste(crop, (x + 5, y + 20), crop)
            draw.point((x + 83, y + 165), fill="#a5e2ec")
            draw.text((x + 8, y + 169), f"{i + 1:02} / {clip['durations'][i]}t", fill="#d4c0d2")
    sheet.save(OUTPUT / "folha-movimento.png")


def animations(temp):
    groups = {
        "idle": ["idle"], "caminhada": ["walkForward", "walkBack"],
        "dash": ["dashForward", "backdash"], "salto": ["jump", "jumpForward", "jumpBack"],
        "movimentacao": ["idle", "walkForward", "walkBack", "dashForward", "backdash", "crouch", "jump"],
    }
    scenes = {}
    labels = {
        "idle": "IDLE", "walkForward": "CAMINHADA / FRENTE", "walkBack": "CAMINHADA / RECUO",
        "dashForward": "DASH", "backdash": "BACKDASH", "crouch": "AGACHAR",
        "jump": "SALTO", "jumpForward": "SALTO / FRENTE", "jumpBack": "SALTO / RECUO",
    }
    for key, label in labels.items():
        frames = []
        for path in sorted(temp.glob(key + "-*.png")):
            src = Image.open(path).convert("RGB")
            frame = Image.new("RGB", (512, 384), "#1d1d2c")
            frame.paste(src, (0, 125 if key == "idle" else 0))
            draw = ImageDraw.Draw(frame)
            draw.text((12, 360), label, fill="#ffc4cf")
            frames.append(frame)
        if not frames:
            raise ValueError(key)
        scenes[key] = frames
    for name, keys in groups.items():
        frames = [frame for key in keys for frame in scenes[key]]
        frames[0].save(OUTPUT / (name + ".webp"), save_all=True, append_images=frames[1:],
                       lossless=True, method=4, duration=[33, 34] * (len(frames) // 2) + [33] * (len(frames) % 2), loop=0)


if __name__ == "__main__":
    contact()
    animations(Path(sys.argv[1]))
