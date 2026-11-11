"""Export the approved combat cels at the project's native pivot."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PIVOT = (128, 224)
SIZE = 256
COLUMNS = 6
SHEETS = {
    "stand": (.532, [
        145, 145, 147, 155, 147, 145, 141, 128, 125, 117, 125, 145, 146, 144, 141, 146, 150, 145]),
    "crouch": (.445, [
        144, 145, 145, 144, 146, 145, 143, 124, 120, 115, 125, 144, 147, 145, 143, 137, 137, 143]),
    "air": (.49, [
        137, 138, 132, 129, 131, 134, 131, 124, 127, 121, 129, 133, 136, 123, 131, 132, 133, 133]),
    "grab": (.419, [181, 170, 161, 153, 178, 169, 181, 184, 174, 164, 167, 165]),
    "react": (.43, [177, 170, 180, 143, 170, 133, 142, 158, 191, 163, 164, 171]),
}


def grid(plate, i, cols, rows):
    x, y = i % cols, i // cols
    return plate.crop((x * plate.width // cols, y * plate.height // rows,
                       (x + 1) * plate.width // cols, (y + 1) * plate.height // rows))


def component(cel, seed, alpha=235):
    mask = cel.getchannel("A").point(lambda a: 255 if a >= alpha else 0)
    x, y = seed
    if not mask.getpixel(seed):
        points = [(xx, yy) for yy in range(max(0, y-20), min(mask.height, y+21))
                  for xx in range(max(0, x-20), min(mask.width, x+21)) if mask.getpixel((xx, yy))]
        assert points, seed
        seed = min(points, key=lambda p: (p[0]-x)**2 + (p[1]-y)**2)
    ImageDraw.floodfill(mask, seed, 128, thresh=0)
    return mask.point(lambda a: 255 if a == 128 else 0)


def pack():
    atlas = Image.new("RGBA", (SIZE*COLUMNS, SIZE*13))
    normals, clips, anchors = {}, {}, []
    atlas_name = "kaneki/combat.png"

    def clip(name, indices, durations, loop=False):
        clips[name] = {"sheet": atlas_name, "columns": COLUMNS, "frames": indices,
                       "durations": durations, "ticks": 1, "loop": loop}

    for name, (scale, roots) in SHEETS.items():
        plate = Image.open(ROOT / "art/kaneki-combat-source" / (name + ".png")).convert("RGBA")
        start = len(anchors)
        for i, root in enumerate(roots):
            raw = grid(plate, i, 6 if len(roots) == 18 else 4, 3)
            mask = raw.getchannel("A").point(lambda a: 255 if a >= 235 else 0)
            l, t, r, b = mask.getbbox()
            if name == "air":
                hip_y = t + round((b-t) * (.58 if i % 6 in (0, 5) else .55))
            elif name == "crouch":
                hip_y = b - (88 if i >= 15 and i < 17 else 68 if i < 6 else 51)
            elif name == "react":
                hip_y = t + round((b-t) * .57)
            else:
                hip_y = b - round(61/scale)
            raw.putalpha(component(raw, (root, hip_y)))
            l, t, r, b = raw.getbbox()
            assert min(l, t, raw.width-r, raw.height-b) >= 2, (name, i, raw.getbbox())
            art = raw.crop((l,t,r,b)).resize((round((r-l)*scale), round((b-t)*scale)), Image.Resampling.NEAREST)
            dx = PIVOT[0] - round((root - l) * scale)
            dy = PIVOT[1] - art.height
            if name == "air":
                dy = min(dy-3, PIVOT[1] - 66 - round((hip_y-t)*scale))
            cel = Image.new("RGBA", (SIZE, SIZE))
            cel.alpha_composite(art, (dx, dy))
            left, top, right, bottom = cel.getbbox()
            assert min(left, top, SIZE-right) >= 6 and bottom <= PIVOT[1]
            ax = max(left+3, PIVOT[0]-8)
            ay = max(top+7, dy + round((hip_y-t)*scale)-4)
            amask = cel.getchannel("A")
            points = [(x,y) for y in range(max(top,ay-9), min(bottom,ay+10))
                      for x in range(max(left,ax-13),min(right,ax+13)) if amask.getpixel((x,y))]
            if points:
                ax, ay = min(points, key=lambda p: (p[0]-ax)**2+(p[1]-ay)**2)
            else:
                ax, ay = PIVOT[0], dy + round((hip_y-t)*scale)
            frame = len(anchors)
            anchors.append({"x": ax-PIVOT[0], "y": ay-PIVOT[1]})
            atlas.paste(cel, (frame % COLUMNS * SIZE, frame // COLUMNS * SIZE))
            if name in ("stand","crouch","air") and i % 6 == 3:
                rank = ["light","medium","heavy"][i//6]
                hit = None
                if rank != "heavy":
                    edge = amask.crop((right-6, top, right, bottom)).getbbox()
                    py = top + (edge[1]+edge[3])//2 - PIVOT[1]
                    px = right - 3 - PIVOT[0]
                    hit = {"a": {"x": px - 20, "y": py - (7 if name == "air" and rank == "medium" else 0)},
                           "b": {"x": px, "y": py}, "r": 12 if rank == "light" else 13}
                id = name+"_"+rank
                indices = list(range(frame-3, frame+3))
                normals[id] = {"frames": indices, "hit": hit}
                clip(id, indices, [1]*6)
        if name == "grab":
            for label, indices, holds in [
                ("grabStartup",[0,1],[7,7]), ("grabMiss",[11,10],[12,11]),
                ("grabConnected",[2],[4]), ("grabHold",[3],[24]),
                ("kagunePull",[4,5],[6,7]), ("kaguneThrow",[6,7],[7,8]),
                ("kaguneLaunch",[8,9],[6,8]), ("grabRecovery",[10],[15]),
            ]:
                clip(label, [start+i for i in indices], holds)
        if name == "react":
            for label, indices, holds in [
                ("guardStand",[0],[8]), ("guardCrouch",[1],[8]), ("guardImpactStand",[2,0],[5,8]),
                ("guardImpactCrouch",[3,1],[5,8]), ("damageLight",[2],[10]), ("damageMedium",[2,4],[6,12]),
                ("damageHeavy",[4],[18]), ("damageCrouch",[3],[13]), ("damageAir",[5],[14]),
                ("launched",[6],[13]), ("falling",[7],[12]), ("downed",[8],[25]),
                ("getup",[9,1,0],[9,7,4]), ("ko",[8,10],[8,42]), ("defeat",[10],[40]),
                ("grabbed",[2],[12]), ("entrance",[11],[24]), ("victory",[11],[38]), ("taunt",[11],[30]),
            ]:
                clip(label, [start+i for i in indices], holds, label in ("guardStand","guardCrouch","falling"))
    atlas.save(ROOT / "public/sprites/kaneki/combat.png")
    (ROOT / "src/data/kaneki-combat-art.json").write_text(
        json.dumps({"clips": clips,"lumbar": anchors,"normals": normals}, separators=(",",":"))+"\n", encoding="utf8")


def sasuke():
    plate = Image.open(ROOT / "art/sasuke-final-source/taunt.png").convert("RGBA")
    for row, form in enumerate(("hebi","marca")):
        sheet = Image.new("RGBA", (384*3, 288))
        for i in range(3):
            raw = grid(plate, row*3+i, 3, 2)
            raw.putalpha(component(raw,(265,240),235))
            l,t,r,b = raw.getbbox()
            scale = .328 if row == 0 else .338
            art = raw.crop((l,t,r,b)).resize((round((r-l)*scale),round((b-t)*scale)), Image.Resampling.NEAREST)
            dx = 192-round((265-l)*scale)
            sheet.alpha_composite(art,(i*384+dx,248-art.height))
        sheet.save(ROOT / "public/sprites/sasuke" / f"taunt-{form}.png")


if __name__ == "__main__":
    sasuke()
    pack()
