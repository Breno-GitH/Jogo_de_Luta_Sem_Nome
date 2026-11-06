"""Export Sasuke's authored special cels, collision anchors and independent FX."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art/sasuke-special-source"
OUT = ROOT / "public/sprites/sasuke"
PIVOT = (128, 224)
SIZE = 256

# Centres sit at the loaded hip, so the drive of Chidori lives in the engine.
PLATES = {
    "raiton": (3, .425, [166, 160, 160, 169, 165, 157, 145, 169, 171, 168, 156, 171]),
    "katon": (3, .425, [178, 179, 167, 174, 176, 177, 163, 176, 180, 181, 173, 181]),
    "defence": (2, .369, [229, 215, 198, 213, 223, 223, 213, 222]),
}
# Absolute coordinates in each plate: gather, then release. Hands or mouth.
ANCHORS = {
    "senbon": [(621, 150), (1029, 128)],
    "eiso": [(495, 464), (1048, 500)],
    "chidori": [(620, 899), (1062, 879)],
    "gokakyu": [(561, 85), (967, 117)],
    "hosenka": [(561, 455), (942, 469)],
    "goryuka": [(560, 795), (919, 792)],
    "serpents": [(763, 123), (1268, 282)],
    "nagashi": [(639, 672), (1095, 682)],
}
FX_SIZE = (128, 96)
FX_PIVOT = (92, 48)


def cut(plate, rows, index, edges=None, strict=True):
    col, row = index % 4, index // 4
    columns = edges or [i * plate.width // 4 for i in range(5)]
    left, top = columns[col], row * plate.height // rows
    cel = plate.crop((left, top, columns[col + 1],
                      (row + 1) * plate.height // rows))
    cel.putalpha(cel.getchannel("A").point(lambda a: 255 if a >= 236 else 0))
    bounds = cel.getbbox()
    assert bounds and (not strict or 1 < bounds[0] < bounds[2] < cel.width - 1), (index, bounds)
    return cel, left, top


def pack_body(plate, rows, index, scale, center, point, edges=None):
    crop, left, top = cut(plate, rows, index, edges)
    crop = crop.resize(tuple(round(i * scale) for i in crop.size), Image.Resampling.NEAREST)
    dx = PIVOT[0] - round(center * scale)
    dy = PIVOT[1] - crop.getbbox()[3]
    cell = Image.new("RGBA", (SIZE, SIZE))
    cell.alpha_composite(crop, (dx, dy))
    x0, y0, x1, y1 = cell.getbbox()
    assert min(x0, y0, SIZE - x1, SIZE - y1) >= 12 and y1 == PIVOT[1]
    edges = [y0, round(y0 + (y1 - y0) * .24), round(y0 + (y1 - y0) * .62), y1]
    boxes = []
    for start, end in zip(edges, edges[1:]):
        bounds = cell.crop((83, start, 185, end)).getbbox()
        if bounds:
            x, y, right, bottom = bounds
            boxes.append(dict(x=x + 83 - PIVOT[0], y=y + start - PIVOT[1],
                              w=right - x, h=bottom - y))
    meta = {"hurtboxes": boxes}
    if point:
        x, y = point
        meta["release"] = dict(x=dx + round((x - left) * scale) - PIVOT[0],
                               y=dy + round((y - top) * scale) - PIVOT[1])
    return cell, meta


def largest_component(cel):
    # Remove detached matte and neighboring frames' flecks.
    mask = cel.getchannel("A")
    width, height = cel.size
    points = {(x, y) for y in range(height) for x in range(width) if mask.getpixel((x, y))}
    largest = []
    while points:
        component = [points.pop()]
        for x, y in component:
            for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if point in points:
                    points.remove(point)
                    component.append(point)
        if len(component) > len(largest):
            largest = component
    clean = Image.new("L", cel.size)
    ImageDraw.Draw(clean).point(largest, fill=255)
    cel.putalpha(clean)
    return cel


def pack_effects():
    plate = Image.open(SRC / "fx.png").convert("RGBA")
    sheet = Image.new("RGBA", (FX_SIZE[0] * 4, FX_SIZE[1] * 3))
    for index in range(12):
        col, row = index % 4, index // 4
        edges = [0, 336, 700, 1059, plate.width] if row == 2 else None
        cel, _, _ = cut(plate, 3, index, edges, strict=False)
        cel = largest_component(cel)
        cel = cel.crop(cel.getbbox())
        # The head/core of the projectile is its gameplay position.
        width, height = [(96, 53), (114, 77), (92, 50)][row]
        cel.thumbnail((width, height), Image.Resampling.NEAREST)
        local_x = FX_PIVOT[0] - round(cel.width * (.77, .79, .83)[row])
        local_y = FX_PIVOT[1] - round(cel.height * (.50, .43, .29)[row])
        assert local_x >= 0 and local_x + cel.width <= FX_SIZE[0]
        assert local_y >= 0 and local_y + cel.height <= FX_SIZE[1]
        sheet.alpha_composite(cel, (col * FX_SIZE[0] + local_x, row * FX_SIZE[1] + local_y))
    sheet.save(OUT / "special-effects.png")


def main():
    timing = json.loads((ROOT / "src/data/sasuke-specials.json").read_text(encoding="utf-8-sig"))
    ids = list(timing["techniques"])
    sheet = Image.new("RGBA", (SIZE * 8, SIZE * 4))
    contact = Image.new("RGB", (880, 8 * 177 + 55), "#141a29")
    labels = ImageDraw.Draw(contact)
    labels.text((22, 19), "SASUKE HEBI  /  SELO - PREPARACAO - EXECUCAO - RECUPERACAO", fill="#eef3ff")
    meta = {}
    n = 0
    for name, (rows, scale, centers) in PLATES.items():
        plate = Image.open(SRC / f"{name}.png").convert("RGBA")
        for index, center in enumerate(centers):
            technique, pose = ids[n // 4], index % 4
            point = ANCHORS[technique][pose - 1] if pose in (1, 2) else None
            edges = [0, 362, 713, 1086, plate.width] if name == "raiton" and index >= 8 else None
            cell, record = pack_body(plate, rows, index, scale, center, point, edges)
            sheet.alpha_composite(cell, (SIZE * (n % 8), SIZE * (n // 8)))
            meta.setdefault(technique, []).append(record)
            x, y = pose * 216 + 12, n // 4 * 177 + 52
            if pose == 0:
                labels.text((x + 5, y + 3), technique.upper(), fill="#aad4ff")
            labels.line((x + 4, y + 156, x + 203, y + 156), fill="#394962")
            art = cell.crop((24, 70, 230, 225))
            contact.paste(art, (x, y + 2), art)
            release = record.get("release")
            if release:
                px, py = x + PIVOT[0] - 24 + release["x"], y + 156 + release["y"]
                labels.line((px - 3, py, px + 3, py), fill="#ffca78")
                labels.line((px, py - 3, px, py + 3), fill="#ffca78")
            n += 1
    sheet.save(OUT / "specials.png")
    contact.save(OUT / "specials-contact.png")
    (ROOT / "src/data/sasuke-special-frames.json").write_text(
        json.dumps(meta, separators=(",", ":")) + "\n", encoding="utf-8")
    pack_effects()


if __name__ == "__main__":
    main()
