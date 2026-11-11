"""Pack the two Sasuke throw plates without modifying the approved atlases."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/sasuke-final-source"
OUT = ROOT / "public/sprites/sasuke"
SIZE = (384, 288)
PIVOT = (192, 248)
# Original sheet coordinates measured at the belt in each pose.
ROOTS = {"base": [265, 750, 1248, 232, 755, 1263],
         "curse": [275, 783, 1285, 272, 785, 1277]}
PALM = {"base": (908, 229), "curse": (947, 238)}
SCALE = .438


def pack(form):
    plate = Image.open(SOURCE / f"{form}.png").convert("RGBA")
    assert plate.size == (1536, 1024), plate.size
    plate.putalpha(plate.getchannel("A").point(lambda a: 255 if a >= 235 else 0))
    sheet = Image.new("RGBA", (SIZE[0] * 3, SIZE[1] * 2))
    for i, root in enumerate(ROOTS[form]):
        x, y = i % 3 * 512, i // 3 * 512
        raw = plate.crop((x, y, x + 512, y + 512))
        l, t, r, b = raw.getbbox()
        assert min(l, t, 512 - r, 512 - b) >= 12, (form, i, raw.getbbox())
        art = raw.crop((l, t, r, b)).resize(
            (round((r - l) * SCALE), round((b - t) * SCALE)), Image.Resampling.NEAREST
        )
        cel = Image.new("RGBA", SIZE)
        dx = PIVOT[0] - round((root - x - l) * SCALE)
        dy = PIVOT[1] - art.getbbox()[3]
        cel.alpha_composite(art, (dx, dy))
        left, top, right, bottom = cel.getbbox()
        assert min(left, top, SIZE[0] - right) >= 12 and bottom == PIVOT[1]
        if i == 1:
            px, py = PALM[form]
            hand_x = dx + round((px - x - l) * SCALE)
            hand_y = dy + round((py - y - t) * SCALE)
            assert cel.getchannel("A").crop((hand_x - 4, hand_y - 4, hand_x + 5, hand_y + 5)).getbbox()
            box = {"x": hand_x - PIVOT[0] - 13, "y": hand_y - PIVOT[1] - 12,
                   "w": 27, "h": 24}
        sheet.paste(cel, (i % 3 * SIZE[0], i // 3 * SIZE[1]))
    sheet.save(OUT / f"throw-{form}.png")
    return box


def menu_idle():
    with Image.open(OUT / "movement.png") as sheet:
        frames = [sheet.crop((i * 256, 0, (i + 1) * 256, 256)) for i in range(6)]
    frames[0].save(OUT / "menu-idle.webp", save_all=True, append_images=frames[1:],
                   duration=[150, 133, 134, 133, 150, 167], loop=0, lossless=True)


if __name__ == "__main__":
    menu_idle()
    boxes = {form: pack(form) for form in ROOTS}
    (ROOT / "src/data/sasuke-throw-boxes.json").write_text(
        json.dumps(boxes, indent=2) + "\n", encoding="utf8"
    )
