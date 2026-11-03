"""Package independently drawn pose plates for Luffy's polished model."""
from argparse import ArgumentParser
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/sprites/luffy"
META = json.loads((ROOT / "src/data/luffy-animations.json").read_text())
PLATES = (
    ("idle", 3, 2, [130]*6),
    ("walk", 4, 3, [130, 127, 131, 130, 127, 131]*2),
    ("dash", 5, 2, [101, 109, 107, 111, 129]),
    ("backdash", 5, 1, [112, 118, 111, 120, 130]),
    ("crouch", 3, 2, [127, 115, 98, 102, 120, 130]),
    ("jump", 4, 3, [121, 104, 132, 131, 131, 122, 122, 126, 124, 107, 124]),
)
GROUND_OFFSETS = {20: 4, 25: 4, 37: 2, 38: 6, 39: 8, 40: 5, 41: 1}


def hard_alpha(image):
    return image.getchannel("A").point(lambda p: 255 if p >= 220 else 0)


def package_frame(image, height, lift):
    alpha = hard_alpha(image)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Empty pose")
    image.putalpha(alpha)
    body = image.crop(bounds)
    body = body.resize((round(body.width * height / body.height), height),
                       Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (256, 256))
    frame.alpha_composite(body, ((256-body.width)//2, 224-height-lift))
    assert set(frame.getchannel("A").tobytes()) == {0, 255}
    assert frame.getbbox()[3] == 224-lift
    return frame


def build(plates, crop_map):
    frames = []
    for path, (name, columns, rows, heights) in zip(plates, PLATES):
        image = Image.open(path).convert("RGBA")
        width, height = image.size
        rects = crop_map.get(name)
        for i, target_height in enumerate(heights):
            col, row = i % columns, i // columns
            rect = (rects[i] if rects else
                    (round(col*width/columns), round(row*height/rows),
                     round((col+1)*width/columns), round((row+1)*height/rows)))
            crop = image.crop(rect)
            bounds = hard_alpha(crop).getbbox()
            if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == crop.width or bounds[3] == crop.height:
                raise ValueError(f"{name} {i+1}: empty cel or touches its source cell boundary {bounds}")
            frames.append(package_frame(crop, target_height, GROUND_OFFSETS.get(len(frames), 0)))

    frames[0] = Image.open(OUT / "base-polished.png").convert("RGBA")
    assert len(frames) == len({frame.tobytes() for frame in frames}) == 45
    atlas = Image.new("RGBA", (2048, 1536))
    for i, frame in enumerate(frames):
        box = frame.getbbox()
        assert min(box[0], box[1], 256-box[2], 256-box[3]) >= 16, (i, box)
        atlas.paste(frame, ((i%8)*256, (i//8)*256))
    atlas.save(OUT / "movement-polished.png")

    contact = Image.new("RGB", (960, 13*155), "#202d39")
    draw = ImageDraw.Draw(contact)
    gif, durations = [], []
    for row, (name, clip) in enumerate(META["clips"].items()):
        if name == "base":
            break
        for col, (i, hold) in enumerate(zip(clip["frames"], clip["durations"])):
            cel = frames[i].crop((48, 86, 208, 230))
            x, y = col*160, row*155
            draw.line((x, y+138, x+159, y+138), fill="#70cbbd")
            contact.paste(cel, (x, y), cel)
            draw.text((x+5, y+142), f"{name} {col+1}", fill="#f3e9da")
            panel = Image.new("RGB", (160, 155), "#202d39")
            panel.paste(cel, (0,0), cel)
            ImageDraw.Draw(panel).text((5,142), name, fill="#f3e9da")
            gif.append(panel.resize((320,310), Image.Resampling.NEAREST))
            durations.append(round(hold*1000/60))
        durations[-1] += 240
    contact.save(OUT / "movement-contact-polished.png")
    gif[0].save(OUT / "movement-preview-polished.gif", save_all=True,
                append_images=gif[1:], duration=durations, loop=0, disposal=2)


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("plates", nargs=len(PLATES), type=Path)
    parser.add_argument("--crops", type=Path)
    args = parser.parse_args()
    build(args.plates, json.loads(args.crops.read_text()) if args.crops else {})

