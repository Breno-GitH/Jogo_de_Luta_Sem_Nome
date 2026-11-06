"""Pack the six authored Kaneki idle cels at the roster's native scale."""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/kaneki-source/idle.png"
OUT = ROOT / "public/sprites/kaneki"
CELL = 256
PIVOT = (128, 224)
SCALE = 0.307
# The centres of the soles stay aligned. Each origin was measured on the
# lumbar pixels of its drawing after the complete source silhouette was cut.
ROOT_X = (271, 228, 192, 271, 228, 194)
LUMBAR = ((245, 255), (202, 249), (176, 246), (252, 245), (203, 253), (167, 247))


def main():
    source = Image.open(SOURCE).convert("RGBA")
    assert source.size == (1536, 1024)
    atlas = Image.new("RGBA", (CELL * 3, CELL * 2))
    anchors = []
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (root_x, (back_x, back_y)) in enumerate(zip(ROOT_X, LUMBAR)):
        col, row = i % 3, i // 3
        art = source.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))
        art.putalpha(art.getchannel("A").point(lambda a: 255 if a >= 228 else 0))
        l, t, r, b = art.getbbox()
        assert 8 <= min(l, t, 512 - r, 512 - b), (i, art.getbbox())
        art = art.crop((l, t, r, b)).resize(
            (round((r - l) * SCALE), round((b - t) * SCALE)), Image.Resampling.NEAREST,
        )
        x = PIVOT[0] - round((root_x - l) * SCALE)
        y = PIVOT[1] - art.getbbox()[3]
        cel = Image.new("RGBA", (CELL, CELL))
        cel.alpha_composite(art, (x, y))
        left, top, right, bottom = cel.getbbox()
        assert bottom == PIVOT[1] and 126 <= bottom - top <= 136
        assert min(left, top, CELL - right) >= 8
        ax = x + round((back_x - l) * SCALE)
        ay = y + round((back_y - t) * SCALE)
        assert cel.getpixel((ax, ay))[3] == 255, (i, ax, ay)
        anchors.append({"x": ax - PIVOT[0], "y": ay - PIVOT[1]})
        atlas.paste(cel, (col * CELL, row * CELL))
        if i == 0:
            cel.save(OUT / "base.png")
    atlas.save(OUT / "idle.png")
    manifest = {
        "sheet": "kaneki/idle.png",
        "frameWidth": CELL,
        "frameHeight": CELL,
        "columns": 3,
        "pivot": {"x": PIVOT[0], "y": PIVOT[1]},
        "scale": 1,
        "clips": {"idle": {"frames": list(range(6)), "ticks": 12, "durations": [13, 10, 11, 12, 14, 12]}},
        "lumbar": anchors,
    }
    (ROOT / "src/data/kaneki-art.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf8",
    )


if __name__ == "__main__":
    main()
