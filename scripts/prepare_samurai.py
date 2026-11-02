"""Reconstruct a generated pixel-art source on the game's native pixel grid.

This is a one-time import step, not the animation builder. All following work uses
the checked-in 256px native base. No smooth resize, dithering or soft alpha.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/samurai/generated-base.png"
OUT = ROOT / "art/samurai"
COLORS = [
    "#0c0d15", "#141621", "#202331", "#303547", "#444c62", "#60677c",
    "#360f1c", "#5c1325", "#89192b", "#b42132", "#d83740", "#ef5a50",
    "#63342b", "#92513c", "#be7853", "#e7a776", "#ffd0a0", "#ffe3b8",
    "#625951", "#867768", "#aa9580", "#cbb9a0", "#e4d7bd", "#fff0d4",
    "#282631", "#3c3b46", "#565361", "#777280", "#a5a4ae", "#d3d8df",
    "#f1f5f5", "#49341f", "#77502c", "#ac7940", "#deb65d", "#f1d38a",
]


def import_base():
    source = Image.open(SOURCE).convert("RGBA")
    alpha = source.getchannel("A").point(lambda a: 255 if a >= 180 else 0)
    bounds = alpha.getbbox()
    source_bounds = bounds
    if bounds is None:
        raise ValueError("Source is empty")
    crop = source.crop(bounds)
    width = round(crop.width * 130 / crop.height)
    native = crop.resize((width, 130), Image.Resampling.NEAREST)
    palette = Image.new("P", (1, 1))
    raw_palette = [int(color[i:i+2], 16) for color in COLORS for i in (1, 3, 5)]
    palette.putpalette(raw_palette + raw_palette[:3] * (256-len(COLORS)))
    reduced = native.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE).convert("RGBA")
    reduced.putalpha(native.getchannel("A").point(lambda a: 255 if a >= 180 else 0))
    data = np.array(reduced)
    data[data[:, :, 3] == 0] = 0
    reduced = Image.fromarray(data)
    # Original body centre is independent of the sword tip and the coat tails.
    body_origin = round((610-bounds[0]) * 130 / crop.height)
    cell = Image.new("RGBA", (256, 256))
    cell.paste(reduced, (128-body_origin, 224-130))
    # Skin must not borrow the brass/red ramps just because RGB is close.
    skin_regions = [
        [(130,115),(141,115),(143,121),(138,126),(134,124),(132,129),(127,126),(125,119)],
        [(106,128),(112,130),(117,138),(123,146),(129,151),(125,156),(118,151),(111,143),(107,136)],
        [(140,143),(144,144),(145,152),(143,157),(138,155),(138,149)],
        [(132,165),(138,165),(139,170),(135,172),(131,170)],
        [(143,168),(148,169),(150,173),(146,175),(142,172)],
    ]
    mask = Image.new("L", (256,256))
    for polygon in skin_regions:
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
    skin_replacements = {"#f1d38a":"#ffd0a0", "#deb65d":"#e7a776", "#ef5a50":"#be7853", "#d83740":"#92513c"}
    for y in range(256):
        for x in range(256):
            color = cell.getpixel((x,y))
            if mask.getpixel((x,y)) and color[3]:
                key = "#"+bytes(color[:3]).hex()
                if key in skin_replacements:
                    cell.putpixel((x,y), tuple(bytes.fromhex(skin_replacements[key][1:]))+(255,))
    for x,y,color in json.loads((OUT/"retouch.json").read_text(encoding="utf-8"))["pixels"]:
        cell.putpixel((x,y), tuple(bytes.fromhex(color[1:]))+(255,))
    cell.save(OUT / "base-native.png")
    (OUT / "palette.json").write_text(json.dumps(COLORS, indent=2)+"\n", encoding="utf-8")
    bounds = cell.getbbox()
    region = cell.crop((bounds[0]-8,bounds[1]-8,bounds[2]+8,bounds[3]+8))
    review = Image.new("RGBA", region.size, "#687383")
    review.alpha_composite(region)
    review.resize((region.width*6,region.height*6), Image.Resampling.NEAREST).save(OUT / "base-review-6x.png")
    print(json.dumps({"source":str(SOURCE),"sourceBounds":source_bounds,"nativeBounds":cell.getbbox(),"palette":len(COLORS)}))


if __name__ == "__main__":
    import_base()
