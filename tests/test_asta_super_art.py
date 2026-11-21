"""Atlas/alpha regressions supplement the recorded in-arena visual inspection."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = json.loads((root / "art/asta-source/super-sources.json").read_text(encoding="utf8"))
assert len(sources) == 9
for name, source in sources.items():
    original = Image.open(root / "art/asta-source" / source["file"]).convert("RGBA")
    atlas = Image.open(root / f"public/sprites/asta/{name}.png").convert("RGBA")
    assert original.size == (1536, 1024), name
    assert atlas.size == (768, 512), name
    poses = set()
    for cel in range(6):
        x, y = cel % 3 * 256, cel // 3 * 256
        pose = atlas.crop((x, y, x + 256, y + 256))
        bounds = pose.getbbox()
        assert bounds and min(bounds[:2]) > 0 and max(bounds[2:]) < 256, (name, cel)
        assert set(pose.getchannel("A").tobytes()) == {0, 255}, (name, cel)
        poses.add(hashlib.sha256(pose.tobytes()).digest())
    assert len(poses) == 6, (name, "duplicate body drawing")

# These are authored empty locations beside a cel's head/shoulder.
# The previous matte at these points survived the normal packing threshold,
# producing a visible gray rectangle behind Equinox and the return animation.
for name, point in {"r-equinox": (380, 180), "r-union-return": (1404, 692),
                    "r-union-rush": (380, 180)}.items():
    original = Image.open(root / f"art/asta-source/frames/{name}.png").convert("RGBA")
    assert original.getpixel(point)[3] < 16, (name, "background matte")
print("Nine short Super atlases: 54 unique drawings, clean alpha, safe margins and no matte regression.")
