"""Package actual Apache lab captures into a looping animation."""
from pathlib import Path
from sys import argv
from PIL import Image

out = Path(argv[1] if len(argv) > 1 else "deployment/audit/sasuke-kirin")
frames = []
for path in sorted((out / "frames").glob("*.png")):
    with Image.open(path) as frame:
        frames.append(frame.convert("RGB"))
assert frames, f"No captures in {out}"
frames[0].save(out / (argv[2] if len(argv) > 2 else "kirin-cinematografia.webp"), save_all=True, append_images=frames[1:],
               duration=[50] * (len(frames)-1) + [480], lossless=True, loop=0)
