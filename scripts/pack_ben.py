"""Pack Ben's original cels into the game's 256 px atlas and proof sheet."""
import json

from PIL import Image, ImageDraw, ImageFont

from pack_kaneki_combat import PIVOT, ROOT, SIZE, component, grid

SOURCE = ROOT / "art/ben-source"
SPRITES = ROOT / "public/sprites/ben"
PREVIEWS = ROOT / "public/previews/ben"
SCALE = .29
IDLE_HOLDS = [12, 11, 12, 12, 12, 11]
NEAREST = Image.Resampling.NEAREST


def extract(name, roots):
    source = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    frames = []
    for i, root in enumerate(roots):
        raw = grid(source, i, 3, 2)
        raw.putalpha(component(raw, (root, 240), 225))
        l, t, r, b = raw.getbbox()
        art = raw.crop((l, t, r, b)).resize((round((r - l) * SCALE), round((b - t) * SCALE)), NEAREST)
        frame = Image.new("RGBA", (SIZE, SIZE))
        frame.alpha_composite(art, (PIVOT[0] - round((root - l) * SCALE), PIVOT[1] - art.height))
        assert frame.getbbox()[3] == PIVOT[1]
        frames.append(frame)
    return frames


def sheet(name, frames):
    image = Image.new("RGBA", (SIZE * 3, SIZE * 2))
    for i, frame in enumerate(frames):
        image.paste(frame, (i % 3 * SIZE, i // 3 * SIZE))
    image.save(SPRITES / f"{name}.png")


def atlas_clip(frames, durations, **extras):
    return dict(frames=frames, durations=durations, ticks=1, **extras)


def proof(idle):
    dark, panel, ink, green = "#101418", "#1b2229", "#edf3eb", "#a8ed4d"
    output = Image.new("RGB", (1160, 570), dark)
    draw = ImageDraw.Draw(output)
    title = ImageFont.load_default(size=26)
    label = ImageFont.load_default(size=15)

    def box(bounds, heading):
        draw.rectangle(bounds, fill=panel)
        draw.text((bounds[0] + 12, bounds[1] + 10), heading, fill=green, font=label)

    def art(image, x, y, scale=1):
        image = image.resize((image.width * scale, image.height * scale), NEAREST)
        output.paste(image, (x, y), image)

    draw.text((20, 13), "BEN TENNYSON / OMNIVERSE", fill=ink, font=title)
    box((20, 59, 481, 321), "ESCALA NATIVA / MESMA LINHA DO PISO")
    draw.line((34, 271, 465, 271), fill="#546451")
    for x, name, sprite in [
        (98, "SASUKE", Image.open(ROOT / "public/sprites/sasuke/base.png").convert("RGBA")),
        (248, "BEN", idle[0]),
        (393, "KANEKI", Image.open(ROOT / "public/sprites/kaneki/base.png").convert("RGBA")),
    ]:
        body = sprite.crop(sprite.getbbox())
        art(body, x - body.width // 2, 271 - body.height)
        draw.text((x, 286), name, anchor="mt", fill=ink, font=label)
    box((494, 59, 816, 321), "ROSTO / ZOOM 5x")
    l, t, r, b = idle[0].getbbox()
    art(idle[0].crop((l + 10, t, r - 12, t + 37)), 535, 108, 5)
    box((829, 59, 1140, 321), "OMNITRIX / ZOOM 8x")
    x, y = WATCH[0]
    art(idle[0].crop((x - 12, y - 12, x + 12, y + 12)), 886, 105, 8)
    for i, frame in enumerate(idle):
        x = 20 + i * 187
        box((x, 334, x + 181, 545), f"IDLE {i + 1:02}   {IDLE_HOLDS[i]} TICKS")
        body = frame.crop(frame.getbbox())
        art(body, x + 90 - body.width // 2, 519 - body.height)
    output.save(PREVIEWS / "idle-e-escala.png")


# Wrist centers in the packed native cels, checked against the source drawings.
WATCH = [(151, 142), (152, 141), (152, 143), (148, 140), (152, 142), (150, 140)]

if __name__ == "__main__":
    SPRITES.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    idle = extract("idle", [239, 240, 241, 238, 232, 239])
    normals = extract("normals", [239, 239, 239, 224, 223, 222])
    assert len({frame.tobytes() for frame in idle}) == 6
    assert all(124 <= PIVOT[1] - frame.getbbox()[1] <= 134 for frame in idle)
    assert all(frame.getpixel(point)[3] == 255 for frame, point in zip(idle, WATCH))
    sheet("idle", idle)
    sheet("normals", normals)
    idle[0].save(SPRITES / "base.png")
    idle[0].save(SPRITES / "menu-idle.webp", save_all=True, append_images=idle[1:],
                 lossless=True, duration=[round(t * 1000 / 60) for t in IDLE_HOLDS], loop=0)
    manifest = dict(sheet="ben/idle.png", frameWidth=SIZE, frameHeight=SIZE, columns=3,
                    pivot=dict(x=PIVOT[0], y=PIVOT[1]), scale=1,
                    watch=[dict(x=x-PIVOT[0], y=y-PIVOT[1]) for x, y in WATCH],
                    clips=dict(idle=atlas_clip(list(range(6)), IDLE_HOLDS),
                               stand_light=atlas_clip([0, 1, 2], [5, 3, 9], sheet="ben/normals.png", loop=False),
                               stand_medium=atlas_clip([3, 4, 5], [9, 4, 17], sheet="ben/normals.png", loop=False)))
    (ROOT / "src/data/ben-art.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    proof(idle)

