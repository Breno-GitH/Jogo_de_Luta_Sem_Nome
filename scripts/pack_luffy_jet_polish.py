"""Pack the painted replacement fists without moving gameplay anchors."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
image = Image.open(ROOT / "art/luffy-jet-source/fists-polish.png").convert("RGBA")
alpha = image.getchannel("A").point(lambda p: 255 if p >= 236 else 0)
image.putalpha(alpha)
atlas = Image.new("RGBA", (1024, 512))
baseline = json.loads((ROOT / "src/data/luffy-jet-fists.json").read_text(encoding="utf-8"))
frames = []
for i, base in enumerate(baseline):
    row, col = divmod(i, 4)
    left = [0, 454, 894, 1330, image.width] if row == 0 else [0, 454, 905, 1341, image.width]
    source = image.crop((left[col], row * image.height // 2, left[col+1], (row+1) * image.height // 2))
    source = source.crop(source.getbbox())
    # Maintain the rendered striking edge from the existing contact track.
    width = base["nose"] + 4
    height = round(source.height * width / source.width)
    cel = source.resize((width, height), Image.Resampling.NEAREST)
    # The lowest/upper isolated alpha chips are never used to locate the wrist.
    strip = cel.getchannel("A").crop((4, 0, 7, height))
    y = (strip.getbbox()[1] + strip.getbbox()[3]) // 2
    atlas.paste(cel, (col * 256, row * 256))
    frames.append({"width": width, "height": height, "pivot": {"x": 4, "y": y}})
atlas.save(ROOT / "public/sprites/luffy/jet/fists-polished.png")
(ROOT / "src/data/luffy-jet-fists-polished.json").write_text(json.dumps(frames, indent=2) + "\n", encoding="utf-8")
