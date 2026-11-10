"""Audit the actual active sprite cels and their arena pivots."""
import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "public/sprites"
FORMS = ("feedback", "nrg", "nrgReleased")


def runtime():
    return json.loads(subprocess.check_output(["node", "-e", """
    eval(require('esbuild').buildSync({stdin:{contents:
    'import {benAnimation} from "./src/render/ben-animations.ts"; console.log(JSON.stringify(Object.fromEntries(["feedback","nrg","nrgReleased"].map(key=>[key,benAnimation(key)]))))',
    resolveDir:process.cwd()},bundle:true,platform:"node",write:false}).outputFiles[0].text)
    """], cwd=ROOT))


def cel(base, clip, i):
    props = base | clip
    width, height = props["frameWidth"], props["frameHeight"]
    x = (i % props["columns"]) * width
    y = (i // props["columns"]) * height
    with Image.open(SPRITES / props["sheet"]) as atlas:
        return atlas.crop((x, y, x + width, y + height)).convert("RGBA"), props["pivot"]


def cels(data):
    slots = {}
    for name, clip in data["clips"].items():
        for i in clip["frames"]:
            key = (clip.get("sheet", data["sheet"]), i)
            if key not in slots:
                slots[key] = (name, *cel(data, clip, i))
    return slots


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="runtime", choices=("runtime", "before", "after"))
    label = parser.parse_args().label
    out = ROOT / "art/ben-body-audit"
    out.mkdir(exist_ok=True)
    data = runtime()
    for key in FORMS:
        frames = cels(data[key])
        w, h, cols, px, py = 220, 215, 7, 90, 186
        sheet = Image.new("RGB", (w * cols, h * ((len(frames) + cols - 1) // cols)), "#26313d")
        d = ImageDraw.Draw(sheet)
        font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 13)
        for i, ((path, frame), (name, image, pivot)) in enumerate(frames.items()):
            x, y = i % cols * w, i // cols * h
            cell = Image.new("RGBA", (w, h))
            cell.paste(image, (px - pivot["x"], py - pivot["y"]))
            d.line((x, y + py, x + w - 1, y + py), fill="#5b6774")
            d.line((x + px, y + 2, x + px, y + py + 2), fill="#5b6774")
            sheet.paste(cell, (x, y), cell)
            d.text((x + 5, y + py + 4), f"{i:02}  {name}  [{frame}]", fill="#fff4bd", font=font)
        sheet.save(out / (key + "-" + label + ".png"))
        print(key, len(frames))
    (out / (label + ".json")).write_text(json.dumps(data, indent=2), encoding="utf8")

