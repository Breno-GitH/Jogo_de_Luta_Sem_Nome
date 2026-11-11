"""Rasterize hand-authored pixel cels into Kaneki's full-body atlas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/kaneki-centipede-source/KAKUJA-FACES.txt"
APPROVED = SOURCE.with_name("kakuja-rosto-aprovado.png")
INK = {
    "#": (13, 11, 17, 255), "d": (27, 23, 31, 255),
    "s": (46, 40, 50, 255), "g": (75, 64, 78, 255),
    "h": (140, 125, 138, 255), "r": (117, 16, 39, 255),
    "R": (213, 30, 54, 255), "e": (255, 109, 110, 255),
    "b": (125, 103, 113, 255), "P": (211, 190, 183, 255),
    "j": (161, 124, 133, 255), "w": (255, 246, 234, 255),
    "m": (24, 9, 16, 255), "t": (243, 225, 213, 255),
    "v": (182, 146, 149, 255),
    "~": (0, 0, 0, 0),
}

# Manual eye position and drawing direction for each cel. All values are
# native sprite pixels, relative to the cel. None retains the base drawing.
FACES = {
    "transformation": [
        None, (161, 135, "forming"), (163, 123, "charge"),
        (157, 102, "raised"), (135, 94, "arched"), (160, 127, "charge"),
    ],
    "rush": [
        (172, 118, "charge"), (169, 128, "profile"), (144, 114, "charge"),
        (178, 147, "dive"), (175, 125, "profile"), (160, 96, "raised"),
    ],
    "air": [
        (164, 139, "profile"), (147, 108, "raised"), (137, 135, "charge"),
        (154, 123, "profile"), (150, 139, "dive"), (146, 161, "dive"),
    ],
    "descent": [
        (160, 147, "dive"), (161, 125, "dive"), (157, 133, "dive"),
        (158, 136, "charge"), (158, 145, "receding"), None,
    ],
    "frenzy": [
        (175,158,"dive"), (192,144,"charge"), (165,157,"profile"),
        (176,160,"dive"), (168,164,"dive"), (165,144,"raised"),
    ],
}

def read_drawings():
    drawings = {}
    for row in SOURCE.read_text(encoding="utf-8-sig").splitlines():
        if row.startswith("["):
            cel = drawings[row[1:-1]] = []
        elif row.startswith("."):
            cel.append(row)
    return drawings

# Shift the same source pixels to the pose's existing exposed area.
# The approved "arched" cel uses its original coordinates.
FACE_OFFSETS = {
    "forming": (1, -2), "profile": (0, -1), "raised": (0, -2),
    "arched": (0, 0), "charge": (0, -1), "dive": (1, -1),
    "receding": (2, -1),
}
EXPOSED_INK = frozenset("bPjwmtv")

# Left edge of the exposed cheek at rows +2 to +7 relative to the eye.
# Positions follow the visible ear in each cel, not the shared face stamp.
CHEEK_EDGES = {
    "transformation": [
        None, (-14,-13,-12,-11,-10,-9), (-13,-13,-13,-13,-12,-11),
        (-13,-13,-12,-12,-12,-11), None, (-13,-13,-13,-13,-12,-11),
    ],
    "rush": [
        (-15,-14,-13,-13,-13,-12), (-15,-15,-14,-14,-14,-13),
        (-15,-15,-15,-15,-14,-13), (-16,-16,-15,-15,-15,-14),
        (-15,-15,-15,-15,-14,-13), (-13,-12,-12,-12,-12,-11),
    ],
    "air": [
        (-13,-12,-12,-11,-11,-11), (-12,-11,-11,-11,-10,-10),
        (-13,-12,-12,-11,-11,-11), (-12,-11,-11,-10,-10,-10),
        (-13,-13,-13,-13,-12,-11), (-14,-14,-13,-13,-12,-11),
    ],
    "descent": [
        (-16,-16,-15,-15,-14,-13), (-15,-15,-15,-14,-14,-13),
        (-15,-15,-15,-15,-14,-13), (-15,-15,-14,-14,-13,-12),
        (-13,-13,-12,-11,-10,-9), None,
    ],
    "frenzy": [
        (-14,-14,-13,-13,-12,-11), (-15,-15,-14,-14,-13,-12),
        (-12,-12,-12,-11,-11,-10), (-14,-14,-13,-13,-12,-11),
        (-13,-13,-12,-12,-11,-10), (-12,-12,-12,-11,-11,-10),
    ],
}

# Ramp sampled from the approved cheek and the original neck.
CHEEK_RIM = (112, 89, 85)
CHEEK_SHADE = (176, 144, 140)
CHEEK_MID = (193, 167, 160)
CHEEK_HALF = (156, 126, 121)
JAW_SHADE = (137, 109, 108)
COLLAR_EDGE = (46, 34, 39)
MOUTH = (53, 35, 37)
TOOTH = (213, 188, 181)

# Local jaw turns and mouth corners follow the angle of the head.
JAW_AND_MOUTH = {
    "profile": (8, -5, 6), "charge": (8, -5, 6),
    "raised": (8, -5, 5), "dive": (7, -4, 6),
}

def fit_cheek(atlas, left, top, pose, drawing, edges):
    if edges is None:
        return

    def put(col, row, rgb):
        at = (left + col, top + row)
        alpha = atlas.getpixel(at)[3]
        if alpha:
            atlas.putpixel(at, (*rgb, alpha))

    for y, edge in enumerate(edges, 2):
        row = y + 5
        if row >= len(drawing):
            break
        exposed = [col for col, pixel in enumerate(drawing[row]) if pixel in EXPOSED_INK]
        if not exposed:
            continue
        first = exposed[0]
        # The cheek is widest beside the eye and turns in toward the jaw.
        rim = min(first, edge + 13 + max(0, y - 4))
        for col in range(rim, first + 1):
            if 0 <= col < first and drawing[row][col] not in ".#":
                continue
            at = (left + col, top + row)
            r, g, b, _ = atlas.getpixel(at)
            # Preserve the ear's lit edge and strands over the brow.
            if col != first and (max(r, g, b) > 112 or (r > b + 12 and r > 70)):
                continue
            depth = col - rim
            if depth == 0:
                tone = CHEEK_RIM
            elif depth < 3 or y >= 6:
                tone = CHEEK_HALF if depth <= 2 else CHEEK_SHADE
            else:
                tone = CHEEK_SHADE if col < first - 1 or y == 2 else CHEEK_MID
            put(col, row, tone)

    if pose not in JAW_AND_MOUTH:
        return
    jaw, mx, my = JAW_AND_MOUTH[pose]
    for row in range(jaw + 5, len(drawing)):
        tone = CHEEK_SHADE if row == jaw + 5 else JAW_SHADE if row == jaw + 6 else COLLAR_EDGE
        for col, pixel in enumerate(drawing[row]):
            if pixel in EXPOSED_INK:
                put(col, row, tone)
    for dx, dy, tone in ((0,-1,MOUTH), (0,0,MOUTH), (1,0,MOUTH), (2,0,TOOTH), (3,0,MOUTH)):
        col, row = mx + dx + 13, my + dy + 5
        if drawing[row][col] in EXPOSED_INK:
            put(col, row, tone)

def paste_approved_face(atlas, left, top, pose, drawing, approved):
    dx, dy = FACE_OFFSETS[pose]
    for py in range(approved.height):
        for px in range(approved.width):
            pixel = approved.getpixel((px, py))
            if not pixel[3]:
                continue
            x, y = 1 + dx + px, 3 + dy + py
            if pose != "arched":
                if not (0 <= y < len(drawing) and 0 <= x < len(drawing[y])):
                    continue
                if drawing[y][x] not in EXPOSED_INK:
                    continue
            at = (left + x, top + y)
            assert atlas.getpixel(at)[3] == pixel[3], (pose, x, y)
            atlas.putpixel(at, pixel)

def paint_faces(atlas, name, size):
    drawings = read_drawings()
    with Image.open(APPROVED) as file:
        approved = file.convert("RGBA")
    for i, face in enumerate(FACES.get(name, ())):
        if not face:
            continue
        x, y, pose = face
        left = i % 3 * size + x - 13
        top = i // 3 * size + y - 5
        drawing = drawings[pose]
        for j, row in enumerate(drawing):
            for k, pixel in enumerate(row):
                if pixel != ".":
                    atlas.putpixel((left + k, top + j), INK[pixel])
        paste_approved_face(atlas, left, top, pose, drawing, approved)
        fit_cheek(atlas, left, top, pose, drawing, CHEEK_EDGES[name][i])

