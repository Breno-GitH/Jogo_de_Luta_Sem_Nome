"""Pack the special cels and import the supplied knuckle gesture."""
import json
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from pack_kaneki_combat import ROOT, PIVOT, SIZE, COLUMNS, grid, component

SOURCE = ROOT / "art/kaneki-special-source"
OUT = ROOT / "public/sprites/kaneki"
NEAREST = Image.Resampling.NEAREST


def snap_mask(raw):
    """Isolate the supplied pose from its black background without repainting it."""
    red, green, blue, _ = raw.split()
    value = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    mask = value.point(lambda c: 255 if c > 7 else 0)
    # Dark boot soles need a lower key than the hair and the space by the hand.
    sole = value.crop((0, 490, raw.width, raw.height)).point(lambda c: 255 if c > 2 else 0)
    mask.paste(sole, (0, 490))
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    ImageDraw.floodfill(mask, (380, 290), 128)
    return mask.point(lambda c: 255 if c == 128 else 0)

def pack():
    plates = {
        "swords": (3, 3, .431, [254,230,216,260,245,233,220,184,228]),
        "rush": (4, 3, .466, [177,172,159,166,159,154,148,158,151,139,132,161]),
        "finish": (3, 2, .379, [231,226,212,227,204,202]),
        "snap": (3, 1, .215, [372,339,306]),
    }
    atlas = Image.new("RGBA", (SIZE*COLUMNS, SIZE*5))
    anchors, clips, offsets = [], {}, {}
    for name, (cols, rows, scale, roots) in plates.items():
        plate = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        offsets[name] = len(anchors)
        for i, root in enumerate(roots):
            raw = grid(plate, i, cols, rows)
            bounds = raw.getchannel("A").point(lambda a: 255 if a >= 220 else 0).getbbox()
            l,t,r,b = bounds
            hip_y = t + round((b-t) * (.56 if name != "snap" else .55))
            raw.putalpha(snap_mask(raw) if name == 'snap' else component(raw, (root,hip_y), 220))
            l,t,r,b = raw.getbbox()
            art = raw.crop((l,t,r,b)).resize((round((r-l)*scale),round((b-t)*scale)), NEAREST)
            cel = Image.new("RGBA", (SIZE,SIZE))
            dx,dy = PIVOT[0]-round((root-l)*scale),PIVOT[1]-art.height
            cel.alpha_composite(art,(dx,dy))
            frame = len(anchors)
            anchors.append({"x": -8, "y": dy+round((hip_y-t)*scale)-4-PIVOT[1]})
            atlas.paste(cel,(frame%COLUMNS*SIZE,frame//COLUMNS*SIZE))

    def clip(name, plate, frames, durations):
        clips[name] = {"sheet":"kaneki/specials.png","columns":COLUMNS,
                       "frames":[offsets[plate]+i for i in frames],
                       "durations":durations,"ticks":1,"loop":False}

    for i,(rank,starts,drives) in enumerate(zip(("light","medium","heavy"),
                 ((10,6,22),(15,7,28),(21,8,35)),((7,7,16),(11,9,23),(16,11,31)))):
        clip(f"fourSwords_{rank}","swords",[i,2,8],list(starts))
        startup, active, recovery = drives
        clip(f"rinkakuRush_{rank}","rush",range(4*i,4*i+4),[startup-3,3,active,recovery])
        clip(f"rushFinish_{rank}","finish",([0,1,2],[1,0,2],[3,4,5])[i],([6,6,6],[8,7,9],[10,9,11])[i])
    clip("swordsHold","swords",[2,3],[3,16])
    clip("swordsSnap","snap",[0,1,2],[4,5,5])
    clip("swordsDrive","swords",[6,7,6],[4,4,7])
    clip("swordsHeavy","swords",[6,7,2,7],[4,6,4,6])
    clip("swordsThrow","swords",[7,8],[5,14])

    atlas.save(OUT / "specials.png")
    snap_preview(atlas, offsets["snap"])
    (ROOT / "src/data/kaneki-special-art.json").write_text(
        json.dumps({"clips":clips,"lumbar":anchors},separators=(",",":"))+"\n",encoding="utf8")


def snap_preview(atlas, start):
    out = ROOT / "public/previews/kaneki"
    out.mkdir(parents=True, exist_ok=True)
    bodies = Image.new("RGBA", (720,340), "#211a2a")
    for i in range(3):
        frame = start+i
        x, y = frame%COLUMNS*SIZE, frame//COLUMNS*SIZE
        cel = atlas.crop((x+72,y+74,x+192,y+232)).resize((240,316),NEAREST)
        bodies.alpha_composite(cel, (i*240,12))
    bodies.convert("RGB").save(out / "estalo-corpo.png")

if __name__ == "__main__":
    pack()

