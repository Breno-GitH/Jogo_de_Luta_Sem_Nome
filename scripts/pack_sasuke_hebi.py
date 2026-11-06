"""Pack the transparent Hebi pose plates on the shared 256px grid."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art/sasuke-hebi-source"
OUT = ROOT / "public/sprites/sasuke"
SIZE, COLS = 256, 8
PIVOT = (128, 224)

# The first group uses genuine whole-body cels. A hold controls playback;
# the packer never interpolates, warps or duplicates a movement frame.
MOVEMENT = {
    "idle": ("idle-walk", 0, 6), "walkForward": ("idle-walk", 6, 6),
    "walkBack": ("movementA", 0, 6), "dashForward": ("movementA", 6, 5),
    "backdash": ("movementB", 0, 5), "crouchStart": ("movementB", 5, 2),
    "crouchIdle": ("movementB", 7, 2), "crouchEnd": ("movementB", 9, 2),
    "jumpStart": ("jump", 0, 3), "jumpRise": ("jump", 3, 2),
    "jumpApex": ("jump", 5, 1), "jumpFall": ("jump", 6, 2),
    "landing": ("jump", 8, 3),
}
REACTIONS = {
    "guardStand": [0], "guardImpactStand": [1, 0], "guardCrouch": [2],
    "guardImpactCrouch": [3, 2], "damageLight": [4, 1],
    "damageMedium": [5, 4], "damageHeavy": [5, 4], "damageCrouch": [3, 2],
    "damageAir": [6, 7], "launched": [6, 7], "falling": [7], "downed": [8],
    "getup": [9, 10, 11], "grabbed": [5], "ko": [11, 8], "defeat": [8],
    "entrance": [12, 13, 14, 15, 16], "victory": [16, 18], "taunt": [16, 18, 17],
}

# Source-cel pivots and contact points are specified in that plate's original
# pixels. Omitted pivots sit between the hips above the planted sandals.
SCALE = {"idle-walk": .441}
CENTERS = {
    "idle-walk": [178,180,178,179,177,179,180,184,177,178,182,177],
    "movementA": [171,178,161,151,164,172,151,195,191,178,155,156],
    "movementB": [134,141,148,153,130,130,133,128,137,126,126,128],
    "jump": [176,172,166,169,175,173,167,177,183,174,164,196],
    "stand": [169,154,149,156,156,131,158,160,163,114,137,153],
    "crouch": [155,132,150,154,134,133,132,145,157,133,143,143],
    "air": [168,150,167,171,162,137,164,167,161,134,154,175],
    "reaction": [180,169,156,177,177,162,156,165,181,175,170,165],
}
FOOT_LINES = {
    ("jump",4):314, ("jump",5):312, ("jump",6):322,
    ("movementA",8):313, ("movementB",2):325,
    ("air",0):330, ("air",1):330, ("air",2):330, ("air",3):330,
    ("air",5):331, ("air",6):331, ("air",7):331, ("air",9):345,
    ("reaction",6):326, ("reaction",7):328,
}
TOUCH = {
    ("stand",1): ((228,110),(287,109),8),
    ("stand",5): ((249,149),(296,146),9),
    ("crouch",1): ((270,199),(323,204),8),
    ("crouch",5): ((252,275),(302,283),8),
    ("air",1): ((232,105),(313,106),8),
    ("air",5): ((272,166),(333,161),9),
}
BLADES = {
    ("stand",8): ((132,180),(39,210)),
    ("stand",9): ((235,133),(356,133)),
    ("stand",10): ((212,202),(331,251)),
    ("stand",11): ((105,221),(151,318)),
    ("crouch",8): ((159,237),(264,259)),
    ("crouch",9): ((229,151),(341,102)),
    ("crouch",10): ((258,100),(338,44)),
    ("crouch",11): ((237,232),(325,289)),
    ("air",8): ((136,70),(252,14)),
    ("air",9): ((222,214),(317,278)),
    ("air",10): ((231,243),(313,323)),
    ("air",11): ((123,244),(236,326)),
}


def cut_source(name, frame):
    source = Image.open(SRC / f"{name}.png").convert("RGBA")
    col, row = frame % 4, frame // 4
    x0, y0 = source.width * col // 4, source.height * row // 3
    x1, y1 = source.width * (col + 1) // 4, source.height * (row + 1) // 3
    if name == "movementB" and row == 0:
        edges = [0, 320, 660, 1020, source.width]
        x0, x1 = edges[col:col+2]
    if name == "air":
        edges = [0, 362, 707, source.height]
        y0, y1 = edges[row:row+2]
    crop = source.crop((x0, y0, x1, y1))
    crop.putalpha(crop.getchannel("A").point(lambda p: 255 if p >= 226 else 0))
    bounds = crop.getbbox()
    assert bounds and bounds[0] > 1 and bounds[2] < crop.width - 1, (name, frame, bounds)
    return crop


def pack_cel(name, frame):
    crop = cut_source(name, frame)
    scale = SCALE.get(name, .442)
    x0, y0, x1, y1 = crop.getbbox()
    center = CENTERS[name][frame]
    image = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.NEAREST)
    bottom = FOOT_LINES.get((name, frame))
    at_x = PIVOT[0] - round(center * scale)
    at_y = PIVOT[1] - (round(bottom * scale) if bottom else image.getbbox()[3])
    cell = Image.new("RGBA", (SIZE, SIZE))
    cell.alpha_composite(image, (at_x, at_y))
    bounds = cell.getbbox()
    assert bounds and min(bounds[:2]) >= 4 and max(bounds[2:]) <= 252, (name, frame, bounds)

    def place(point):
        x, y = point
        return {"x": at_x + round(x * scale) - PIVOT[0], "y": at_y + round(y * scale) - PIVOT[1]}

    blade = BLADES.get((name, frame))
    body = cell.getchannel("A")
    if blade:
        a, b = map(place, blade)
        draw = ImageDraw.Draw(body)
        draw.line((a["x"] + 128, a["y"] + 224, b["x"] + 128, b["y"] + 224), fill=0, width=8)
    x0, y0, x1, y1 = body.getbbox()
    # Horizontal slices follow crouch, kicks and recoils. Long sheaths are
    # outside the torso lane; weapon steel is never counted as a hurtbox.
    boxes = []
    edges = [round(y0 + (y1-y0)*v) for v in (0, .21, .49, .74, 1)]
    for start, end in zip(edges, edges[1:]):
        bounds = body.crop((0, start, SIZE, end)).getbbox()
        if not bounds:
            continue
        left, top, right, bottom = bounds
        left, right = max(70, left), min(193, right)
        if right > left:
            boxes.append({"x": left - 128, "y": start + top - 224, "w": right-left, "h": bottom-top})
    art = {"hurtboxes": boxes}
    if blade and frame in (9, 10):
        art["blade"] = {"a": place(blade[0]), "b": place(blade[1]), "r": 7}
    hit = TOUCH.get((name, frame))
    if hit:
        a, b, r = hit
        art["hitboxes"] = [{"a": place(a), "b": place(b), "r": r}]
    return cell, art


def atlas(cels):
    sheet = Image.new("RGBA", (SIZE*COLS, SIZE*((len(cels)+COLS-1)//COLS)))
    for index, cel in enumerate(cels):
        sheet.paste(cel, ((index%COLS)*SIZE, (index//COLS)*SIZE))
    return sheet


def preview(cels, labels, title, filename):
    columns, tile_w, tile_h = 6, 236, 222
    image = Image.new("RGB", (tile_w*columns, 38+tile_h*((len(cels)+columns-1)//columns)), "#151e2a")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("consola.ttf", 14)
    draw.text((12, 11), title, "#f2cc88", font)
    for i, (cel, label) in enumerate(zip(cels, labels)):
        x, y = (i%columns)*tile_w, 38+(i//columns)*tile_h
        draw.rectangle((x+2, y+2, x+tile_w-3, y+tile_h-3), fill="#253542")
        draw.line((x+5, y+186, x+tile_w-6, y+186), fill="#43666d")
        sprite = cel.crop((10, 38, 246, 236))
        image.paste(sprite, (x, y), sprite)
        draw.text((x+9, y+202), label, "#efe4cb", font)
    image.save(OUT / filename)


def main():
    movement, normals, reaction, generated = [], [], [], {}
    metadata = {"movement": {}, "normals": {}, "reactions": {}}
    labels = []
    for label, (plate, start, count) in MOVEMENT.items():
        metadata["movement"][label] = []
        for i in range(count):
            frame, _ = pack_cel(plate, start+i)
            metadata["movement"][label].append(len(movement))
            movement.append(frame)
            labels.append(f"{label} {i+1}/{count}")
    atlas(movement).save(OUT / "movement.png")
    movement[0].save(OUT / "base.png")
    preview(movement, labels, "SASUKE HEBI · 45 DESENHOS DE MOVIMENTAÇÃO", "preview-movement.png")

    labels = []
    for plate in ("stand", "crouch", "air"):
        for rank, strength in enumerate(("light", "medium", "heavy")):
            move = f"{plate}_{strength}"
            frames = []
            for i in range(4):
                cel, art = pack_cel(plate, rank*4+i)
                frames.append({**art, "frame": len(normals)})
                labels.append(f"{move} {i+1}/4")
                normals.append(cel)
            metadata["normals"][move] = frames
    atlas(normals).save(OUT / "normals.png")
    preview(normals, labels, "SASUKE HEBI · 36 DESENHOS DOS NOVE NORMAIS", "preview-normals.png")

    for index in range(12):
        cel, data = pack_cel("reaction", index)
        reaction.append(cel)
        generated[index] = {**data, "frame": index}
    for i, (plate, index) in enumerate((
        ("idle-walk", 6), ("idle-walk", 7), ("idle-walk", 8), ("idle-walk", 9),
        ("idle-walk", 0), ("idle-walk", 3), ("idle-walk", 1),
    ), 12):
        cel, data = pack_cel(plate, index)
        reaction.append(cel)
        generated[i] = {**data, "frame": i}
    for name, indices in REACTIONS.items():
        metadata["reactions"][name] = [generated[i] for i in indices]
    atlas(reaction).save(OUT / "reactions.png")
    preview(reaction[:12], ["Guarda alta", "Bloqueio alto", "Guarda baixa", "Bloqueio baixo",
        "Dano leve", "Dano forte", "Lançamento", "Queda", "Derrubado", "Levantar 1",
        "Levantar 2", "Esgotado"], "SASUKE HEBI · DEFESA E REAÇÕES", "preview-reactions.png")

    (ROOT / "src/data/sasuke-frames.json").write_text(
        json.dumps(metadata, separators=(",", ":"))+"\n", encoding="utf-8",
    )


if __name__ == "__main__":
    main()
