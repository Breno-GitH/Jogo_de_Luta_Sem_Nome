"""Pack complete drawings, using the existing 256 px Kaneki pivot.

The Stage 1 atlas is left intact. Ground calibration in the two walking
cycles fixes the authored support point at each frame's entry.
"""
import json
from pathlib import Path

from PIL import Image

from pack_kaneki import CELL, PIVOT, SCALE

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/kaneki-source"
DATA = ROOT / "src/data"
OUTPUT = ROOT / "public/sprites/kaneki"
COLUMNS = 6

# (source pelvis x, source lumbar x/y, optional supporting sole x).
# Coordinates are local to the original 512 px cells.
POSES = {
    "walkForward": [(268, 238, 251, 365), (224, 196, 246, 276),
                    (194, 167, 242, 147), (261, 236, 240, 351),
                    (227, 197, 251, 277), (200, 176, 246, 147)],
    "walkBack": [(256, 239, 249, 129), (224, 193, 243, 139),
                 (194, 171, 238, 166), (254, 237, 244, 133),
                 (225, 197, 249, 136), (197, 172, 242, 146)],
    "dashForward": [(228, 208, 257), (219, 211, 244), (235, 210, 248),
                    (239, 222, 250), (221, 183, 245)],
    "backdash": [(253, 224, 265), (205, 179, 258), (183, 159, 219),
                 (221, 190, 257), (218, 183, 253)],
    "crouch": [(256, 232, 250), (223, 182, 282), (197, 154, 320),
               (263, 221, 320), (209, 178, 272), (199, 163, 246)],
    "jumpLift": [(263, 239, 252), (232, 192, 283), (186, 165, 227),
                 (266, 241, 221), (220, 192, 198), (166, 138, 178)],
    "jumpLand": [(247, 224, 214), (215, 188, 244), (235, 207, 276),
                 (267, 218, 291), (228, 197, 248)],
}
CLIPS = [
    ("walkForward", "walkForward", 0, [3, 4, 3, 3, 4, 3]),
    ("walkBack", "walkBack", 0, [4, 4, 3, 4, 4, 3]),
    ("dashForward", "dashForward", 0, [2, 3, 3, 3, 3]),
    ("backdash", "backdash", 0, [2, 3, 3, 3, 3]),
    ("crouchStart", "crouch", 0, [3, 4]),
    ("crouchIdle", "crouch", 2, [13, 13]),
    ("crouchEnd", "crouch", 4, [4, 3]),
    ("jumpStart", "jumpLift", 0, [2, 2, 1]),
    ("jumpRise", "jumpLift", 3, [9, 10]),
    ("jumpApex", "jumpLift", 5, [7]),
    ("jumpFall", "jumpLand", 0, [8, 10]),
    ("landing", "jumpLand", 2, [2, 3, 2]),
]


def main():
    balance = json.loads((DATA / "kaneki-motion.json").read_text(encoding="utf-8-sig"))
    plates = {name: Image.open(SOURCE / (name + ".png")).convert("RGBA") for name in POSES}
    total = sum(len(holds) for _, _, _, holds in CLIPS)
    atlas = Image.new("RGBA", (COLUMNS * CELL, ((total + COLUMNS - 1) // COLUMNS) * CELL))
    clips, lumbar, planted = {}, [], []
    for clip, source, start, holds in CLIPS:
        frames = []
        for j in range(len(holds)):
            index = start + j
            left, top = index % 3 * 512, index // 3 * 512
            cel = plates[source].crop((left, top, left + 512, top + 512))
            cel.putalpha(cel.getchannel("A").point(lambda a: 255 if a >= 228 else 0))
            l, t, r, b = cel.getbbox()
            assert min(l, t, 512 - r, 512 - b) >= 6, (clip, j, cel.getbbox())
            art = cel.crop((l, t, r, b)).resize(
                (round((r - l) * SCALE), round((b - t) * SCALE)), Image.Resampling.NEAREST,
            )
            root, sx, sy, *sole = POSES[source][index]
            x = PIVOT[0] - round((root - l) * SCALE)
            y = PIVOT[1] - art.getbbox()[3]
            foot = None
            if sole:
                forward = clip == "walkForward"
                speed = balance["speed"] if forward else balance["locomotion"]["backSpeed"]
                part = j % 3
                foot = (28 - sum(holds[:part]) * speed) if forward else (-28 + sum(holds[:part]) * speed)
                x = PIVOT[0] + round(foot) - round((sole[0] - l) * SCALE)
                foot = round(foot)
            elif clip in ("jumpRise", "jumpApex", "jumpFall"):
                y = min(y, PIVOT[1] - 73 - round((sy - t) * SCALE))
            elif j == 2 and clip in ("dashForward", "backdash"):
                y -= 5 if clip == "dashForward" else 8

            tile = Image.new("RGBA", (CELL, CELL))
            tile.alpha_composite(art, (x, y))
            ax = x + round((sx - l) * SCALE)
            ay = y + round((sy - t) * SCALE)
            assert tile.getpixel((ax, ay))[3] == 255, (clip, j, sx, sy)
            bounds = tile.getbbox()
            assert min(bounds[0], bounds[1], CELL - bounds[2]) >= 8 and bounds[3] <= PIVOT[1]
            frame = len(lumbar)
            frames.append(frame)
            lumbar.append({"x": ax - PIVOT[0], "y": ay - PIVOT[1]})
            planted.append(foot)
            atlas.paste(tile, (frame % COLUMNS * CELL, frame // COLUMNS * CELL))
        clips[clip] = {
            "sheet": "kaneki/movement.png", "columns": COLUMNS, "frames": frames,
            "ticks": 1, "durations": holds,
            "loop": clip in ("walkForward", "walkBack", "crouchIdle"),
        }
    atlas.save(OUTPUT / "movement.png")
    (DATA / "kaneki-movement-art.json").write_text(json.dumps(
        {"clips": clips, "lumbar": lumbar, "planted": planted}, indent=2,
    ) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
