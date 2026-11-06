"""Export the distinct Kirin body and VFX cels at the game's native scale."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pack_sasuke_curse import nearest_gutters

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/sasuke-kirin-source"
OUT = ROOT / "public/sprites/sasuke"
NEAREST = Image.Resampling.NEAREST
BODY = (384, 288)
PIVOT = (192, 248)
FX = (512, 352)


def clean(name, threshold):
    plate = Image.open(SOURCE / f"{name}.png").convert("RGBA")
    plate.putalpha(plate.getchannel("A").point(lambda a: 255 if a >= threshold else 0))
    return plate


def export_body(name, scale, roots, palm):
    plate = clean(name, 236)
    ys = nearest_gutters(plate.getchannel("A"), 3, True)
    sheet = Image.new("RGBA", (BODY[0]*3, BODY[1]*3))
    metadata = []
    for row in range(3):
        y0, y1 = ys[row:row+2]
        xs = nearest_gutters(plate.getchannel("A").crop((0,y0,plate.width,y1)), 3, False)
        for col in range(3):
            i = row*3+col
            x0, x1 = xs[col:col+2]
            art = plate.crop((x0, y0, x1, y1))
            art = art.resize(tuple(round(n*scale) for n in art.size), NEAREST)
            dx = PIVOT[0] - round((roots[i]-x0)*scale)
            dy = PIVOT[1] - art.getbbox()[3]
            cel = Image.new("RGBA", BODY)
            cel.alpha_composite(art, (dx, dy))
            l,t,r,b = cel.getbbox()
            assert min(l,t,BODY[0]-r) >= 10 and b == PIVOT[1], (name, i, (l,t,r,b))
            metadata.append({
                "hurtboxes": [
                    {"x": -15, "y": -126, "w": 38, "h": 30},
                    {"x": -28, "y": -96, "w": 58, "h": 49},
                    {"x": -44, "y": -47, "w": 91, "h": 47},
                ],
            })
            if i == 1:
                x = dx + round((palm[0] - x0)*scale) - PIVOT[0]
                y = dy + round((palm[1] - y0)*scale) - PIVOT[1]
                metadata[-1]["hitboxes"] = [{"a": {"x": x-22,"y":y+4}, "b":{"x":x,"y":y}, "r":12}]
                assert cel.getchannel("A").crop((PIVOT[0]+x-6,PIVOT[1]+y-6,PIVOT[0]+x+7,PIVOT[1]+y+7)).getbbox()
            sheet.paste(cel, (col*BODY[0],row*BODY[1]))
    sheet.save(OUT / f"kirin-{name}.png")
    return metadata


def export_fx(name, threshold, bounds, anchors):
    plate = clean(name, threshold)
    w,h = plate.size
    sheet = Image.new("RGBA", (FX[0]*2,FX[1]*2))
    cells = []
    for i,(max_width,max_height) in enumerate(bounds):
        col,row = i%2,i//2
        tile = plate.crop((col*w//2,row*h//2,(col+1)*w//2,(row+1)*h//2))
        box = tile.getbbox()
        assert box, (name, i)
        art = tile.crop(box)
        art.thumbnail((max_width,max_height), NEAREST)
        dx,dy = (FX[0]-art.width)//2,(FX[1]-art.height)//2
        sheet.alpha_composite(art,(col*FX[0]+dx,row*FX[1]+dy))
        x,y = anchors[i]
        cells.append({"x":dx+round(art.width*x),"y":dy+round(art.height*y)})
    sheet.save(OUT / f"kirin-{name}.png")
    return sheet, cells


def contact(dragon, sky):
    image = Image.new("RGB",(1130,880),"#111a2c")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=19)
    draw.text((24,13),"KIRIN  /  PRANCHA DE EFEITOS",fill="#d6f2ff",font=font)
    for i,label in enumerate(["FORMA INICIAL","BOCA ABERTA","MERGULHO","QUEDA","NUVENS ALTAS","NUVENS ILUMINADAS","DESCARGA","POEIRA"]):
        x,y = i%4*279+16,i//4*401+55
        draw.rectangle((x,y,x+263,y+362),fill="#18243b",outline="#314e6a")
        draw.text((x+12,y+12),label,fill="#c7e7ff",font=font)
        local = i % 4
        dx,dy=local%2*FX[0],local//2*FX[1]
        tile=(dragon if i<4 else sky).crop((dx,dy,dx+FX[0],dy+FX[1]))
        tile=tile.crop(tile.getbbox())
        tile.thumbnail((250,308),NEAREST)
        image.paste(tile,(x+(263-tile.width)//2,y+38+(308-tile.height)//2),tile)
    image.save(OUT / "kirin-effects-contact.png")


def main():
    meta = {
        "base":export_body("base",.396,[208,597,1017,216,620,1026,205,591,1031],(756,131)),
        "curse":export_body("curse",.464,[225,665,1101,252,668,1129,251,669,1113],(817,172)),
    }
    dragon, meta["dragon"] = export_fx("dragon", 236, [(486,328)]*4,
                                      [(0.97,.43),(.97,.46),(.96,.78),(.96,.88)])
    sky, meta["sky"] = export_fx("sky", 228, [(496,230),(496,225),(475,330),(496,174)],
                                  [(.50,.53),(.50,.53),(.50,.90),(.50,.89)])
    contact(dragon, sky)
    (ROOT / "src/data/sasuke-kirin-art.json").write_text(
        json.dumps(meta,separators=(",",":"))+"\n",encoding="utf-8")


if __name__ == "__main__":
    main()
