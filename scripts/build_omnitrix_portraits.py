"""Derive small, transparent watch portraits from the approved in-game sprites."""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public"
BEN = ROOT / "sprites/ben"
OUTPUT = BEN / "omnitrix"
OUTPUT.mkdir(exist_ok=True)
STAGE7 = ROOT / "previews/ben/etapa-7"

# Hand-framed head and upper shoulders. Existing close-up tiles keep their framing.
SOURCES = {
    "xlr8": (BEN / "xlr8/base.png", (116, 87, 180, 148)),
    "fourArms": (BEN / "fourArms/base.png", (103, 73, 177, 139)),
    "feedback": (BEN / "feedback/base.png", (70, 35, 198, 150)),
    "gravattack": (STAGE7 / "gravattack-base.png", (99, 20, 231, 128)),
    "ghostfreak": (BEN / "ghostfreak/portrait.png", None),
    "bigChill": (BEN / "bigChill/portrait.png", None),
    "nrg": (BEN / "nrg/portrait.png", None),
    "diamondhead": (BEN / "diamondhead/portrait.png", None),
    "echoEcho": (STAGE7 / "eco-eco-base.png", (127, 100, 178, 156)),
    "heatblast": (BEN / "heatblast/base.png", (100, 78, 157, 145)),
    "humungousaur": (BEN / "humungousaur/portrait.png", None),
    "alienX": (BEN / "alien-x.png", (850, 57, 944, 138)),
}

def main_silhouette(image):
    """Remove isolated fingers/effects at the edge of crops from action poses."""
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if image.getpixel((x, y))[3] > 0}
    largest = set()
    while remaining:
        first = remaining.pop()
        component = {first}
        queue = deque([first])
        while queue:
            x, y = queue.popleft()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    point = x + dx, y + dy
                    if point in remaining:
                        remaining.remove(point)
                        component.add(point)
                        queue.append(point)
        if len(component) > len(largest):
            largest = component
    for y in range(image.height):
        for x in range(image.width):
            if (x, y) not in largest:
                image.putpixel((x, y), (0, 0, 0, 0))
    return image


for name, (source, crop) in SOURCES.items():
    sprite = Image.open(source).convert("RGBA")
    if crop:
        sprite = main_silhouette(sprite.crop(crop))
    sprite = sprite.crop(sprite.getbbox())
    scale = min(46 / sprite.width, 49 / sprite.height)
    # Preserve native shading and pixel edges, including the feedback cable tips.
    sprite = sprite.resize(
        (round(sprite.width * scale), round(sprite.height * scale)),
        Image.Resampling.NEAREST,
    )
    portrait = Image.new("RGBA", (56, 56))
    portrait.paste(sprite, ((56 - sprite.width) // 2, (56 - sprite.height) // 2))
    portrait.save(OUTPUT / f"{name}.png", optimize=True)

