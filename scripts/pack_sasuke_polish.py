"""Pack independently authored Chidori, Goryuka and black Kirin cels."""
import json
from pathlib import Path
from PIL import Image
from pack_sasuke_curse import nearest_gutters

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art/sasuke-polish-source"
OUT = ROOT / "public/sprites/sasuke"
BODY = (384, 288)
PIVOT = (192, 248)
NEAREST = Image.Resampling.NEAREST


def cut(name, cols, rows, threshold=236):
    plate = Image.open(SRC / f"{name}.png").convert("RGBA")
    plate.putalpha(plate.getchannel("A").point(lambda a: 255 if a >= threshold else 0))
    mask = plate.getchannel("A")
    ys = nearest_gutters(mask, rows, True)
    for row in range(rows):
        y0, y1 = ys[row:row+2]
        xs = nearest_gutters(mask.crop((0,y0,plate.width,y1)), cols, False)
        for col in range(cols):
            x0,x1=xs[col:col+2]
            yield plate.crop((x0,y0,x1,y1)), x0, y0


def bodies(name, sheet_name, scale, roots, palms):
    sheet = Image.new("RGBA",(BODY[0]*3,BODY[1]*2))
    cels = []
    for i,(raw,x0,y0) in enumerate(cut(name,3,2)):
        cel = Image.new("RGBA",BODY)
        art = raw.resize(tuple(round(n*scale) for n in raw.size), NEAREST)
        dx = PIVOT[0]-round((roots[i]-x0)*scale)
        dy = PIVOT[1]-art.getbbox()[3]
        cel.alpha_composite(art,(dx,dy))
        l,t,r,b=cel.getbbox()
        assert min(l,t,BODY[0]-r) >= 10 and b == PIVOT[1], (name,i,cel.getbbox())
        x,y=palms[i]
        px=dx+round((x-x0)*scale)
        py=dy+round((y-y0)*scale)
        assert cel.getchannel("A").crop((px-6,py-6,px+7,py+7)).getbbox(), (name,i,px,py)
        top = -107 if i < 4 else -126
        cels.append({
            "release":{"x":px-PIVOT[0],"y":py-PIVOT[1]},
            "hurtboxes":[{"x":-12,"y":top,"w":49,"h":32},
                         {"x":-28,"y":top+29,"w":61,"h":42},
                         {"x":-43,"y":-45,"w":91,"h":45}],
        })
        sheet.paste(cel,((i%3)*BODY[0],(i//3)*BODY[1]))
    sheet.save(OUT / sheet_name)
    return cels


def effects(name, sheet_name, cols, rows, cell, sizes, pivots, threshold=236):
    sheet = Image.new("RGBA",(cell[0]*cols,cell[1]*rows))
    data = []
    for i,(raw,_,_) in enumerate(cut(name,cols,rows,threshold)):
        tile = raw.crop(raw.getbbox())
        tile.thumbnail(sizes[i],NEAREST)
        x,y = (cell[0]-tile.width)//2,(cell[1]-tile.height)//2
        assert min(x,y) >= 6, (name,i,x,y)
        sheet.paste(tile,((i%cols)*cell[0]+x,(i//cols)*cell[1]+y))
        data.append(dict(x=x+round(tile.width*pivots[i][0]),y=y+round(tile.height*pivots[i][1])))
    sheet.save(OUT / sheet_name)
    return data


def main():
    data = {
        "chidori": bodies("chidori","chidori-dash.png",.355,[223,722,1268,249,788,1296],
                         [(329,374),(901,364),(1465,323),(463,788),(1025,716),(1402,706)]),
        "chidoriCurse": bodies("chidoriCurse","chidori-dash-curse.png",.423,[239,744,1270,290,769,1282],
                         [(354,350),(882,371),(1415,371),(458,857),(970,747),(1373,792)]),
        "fire": effects("fire","goryuka-heads.png",3,2,(128,108),[(104,86)]*6,
                        [(.76,.40),(.76,.48),(.77,.65),(.76,.42),(.76,.52),(.77,.64)]),
        "blackDragon": effects("blackDragon","kirin-dragon-black.png",2,2,(512,352),[(486,328)]*4,
                               [(.97,.43),(.97,.46),(.96,.78),(.96,.89)]),
        "blackSky": effects("blackSky","kirin-sky-black.png",2,2,(512,352),
                            [(496,230),(496,225),(475,330),(496,174)],
                            [(.50,.53),(.50,.53),(.50,.90),(.50,.89)],228),
    }
    (ROOT / "src/data/sasuke-polish-art.json").write_text(json.dumps(data,separators=(",",":"))+"\n",encoding="utf8")


if __name__=="__main__":
    main()
