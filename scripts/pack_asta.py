"""Pack the authored short cels. No joint transforms, redraw, warping or per-cel resizing.
One fixed source-pixel ratio for every body cel. Weapons are separate authored props.
Run with Pillow: python scripts/pack_asta.py
"""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"art/asta-source"
OUT=ROOT/"public/sprites/asta"
OUT.mkdir(parents=True,exist_ok=True)
SCALE=.30
PIVOT=(128,224)
sources=json.loads((SRC/"sources.json").read_text(encoding="utf-8-sig"))
sockets=json.loads((SRC/"sockets-source.json").read_text(encoding="utf-8-sig"))
# Super bodies remain short authored atlases. No changes to the approved base sources.
if (SRC/"super-sources.json").exists(): sources.update(json.loads((SRC/"super-sources.json").read_text(encoding="utf8")))
if (SRC/"super-sockets.json").exists(): sockets.update(json.loads((SRC/"super-sockets.json").read_text(encoding="utf8")))
if (SRC/"super41-sources.json").exists(): sources.update(json.loads((SRC/"super41-sources.json").read_text(encoding="utf8")))
if (SRC/"super41-sockets.json").exists(): sockets.update(json.loads((SRC/"super41-sockets.json").read_text(encoding="utf8")))
bounds={}
packed={}
for name,info in sources.items():
    if name=="arsenal": continue
    im=Image.open(SRC/info["file"]).convert("RGBA")
    if im.size != (1536,1024): raise ValueError((name,im.size))
    atlas=Image.new("RGBA",(768,512))
    grips=[]
    for i in range(6):
        cel=im.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512))
        cel.putalpha(cel.getchannel("A").point(lambda a:255 if a>=128 else 0))
        box=cel.getbbox()
        if not box: raise ValueError((name,i,"empty"))
        # Grounded cels share planted feet. Air cels retain their authored tuck.
        floor=500 if name.startswith("air_") or name=="jump" else box[3]
        size=(round(512*SCALE),round(512*SCALE))
        cel=cel.resize(size,Image.Resampling.NEAREST)
        footbox=im.crop((i%3*512,i//3*512+max(0,box[3]-60),i%3*512+512,i//3*512+box[3])).getchannel("A").point(lambda a:255 if a>=128 else 0).getbbox()
        rootx=(footbox[0]+footbox[2])/2 if footbox else 256
        x=PIVOT[0]-round(rootx*SCALE)
        y=PIVOT[1]-round(floor*SCALE)
        atlas.alpha_composite(cel,(i%3*256+x,i//3*256+y))
        if info.get("weapon",True):
            sx,sy,angle=sockets[name][i]
            grips.append({"x":round((sx-rootx)*SCALE),"y":round((sy-floor)*SCALE),"angle":angle})
        bounds.setdefault(name,[]).append({"sourceBounds":box,"floor":floor,"rootX":rootx})
    atlas.save(OUT/(name+".png"))
    if grips: packed[name]=grips
# Weapon props: top-left Slayer, top-right Slasher, bottom-left Dweller, bottom-right Destroyer.
im=Image.open(SRC/sources["arsenal"]["file"]).convert("RGBA")
arsenal=Image.new("RGBA",(512,192))
weaponmeta={}
for i,(name,reach,gripY) in enumerate([("slayer",112,507),("slasher",80,500),("dweller",91,1155),("destroyer",83,1152)]):
    col=i%2; row=i//2; side=im.width//2
    cel=im.crop((col*side,row*side,(col+1)*side,(row+1)*side))
    cel.putalpha(cel.getchannel("A").point(lambda a:255 if a>=128 else 0))
    box=cel.getbbox(); bx=(box[0]+box[2])/2; gy=gripY-row*side
    factor=reach/(gy-box[1])
    obj=cel.crop(box).resize((round((box[2]-box[0])*factor),round((box[3]-box[1])*factor)),Image.Resampling.NEAREST)
    dx=64-round((bx-box[0])*factor); dy=160-round((gy-box[1])*factor)
    arsenal.alpha_composite(obj,(i*128+dx,dy))
    weaponmeta[name]={"index":i,"pivot":{"x":64,"y":160},"reach":reach}
arsenal.save(OUT/"arsenal.png")
(ROOT/"src/data/asta-sockets.json").write_text(json.dumps(packed,indent=2)+"\n",encoding="utf-8")
(ROOT/"src/data/asta-weapons.json").write_text(json.dumps(weaponmeta,indent=2)+"\n",encoding="utf-8")
(SRC/"packing.json").write_text(json.dumps({"bodyScale":SCALE,"cell":[256,256],"pivot":PIVOT,"bounds":bounds},indent=2)+"\n",encoding="utf-8")
# Selection card uses the idle cel plus the actual Slayer sprite at its hand.
base=Image.new("RGBA",(256,256))
body=Image.open(OUT/"idle.png").crop((0,0,256,256))
g=packed["idle"][0]; weapon=arsenal.crop((0,0,128,192))
# Runtime owns articulated weapons; selection art is the separate approved base.
base.alpha_composite(body)
Image.open(SRC/"asta-demon-slayer-base-v2.png").save(OUT/"base.png")
print(f"Packed {len(packed)} six-cel action atlases and four distinct weapon props.")
