"""Pack native body cels and back anchors for the Centipede cinematic."""
import json
from PIL import Image
from pack_kaneki_combat import ROOT, SIZE, PIVOT, component, grid
from kaneki_kakuja_faces import paint_faces

SOURCES = ROOT / "art/kaneki-centipede-source"
OUT = ROOT / "public/sprites/kaneki"
PLATES = {
    "activation": (.329, [254,225,220,228,222,224]),
    "transformation": (.340, [226,211,205,236,216,216]),
    "rush": (.322, [267,238,224,235,250,234]),
    "air": (.322, [246,232,218,254,239,239]),
    "descent": (.329, [246,229,226,233,227,230]),
    "frenzy": (.329, [237,245,169,235,228,206]),
}
CLIPS = {
    "Activation": ("activation",[0,1,2,3,4,5],[12,8,7,8,18,14]),
    "Transform": ("transformation",[0,1,2,3,4],[12,11,11,11,12]),
    "Idle": ("transformation",[5],[9]),

    "RushBrake": ("rush",[3,1],[9,10]),
    "RushCross": ("rush",[2,4,5],[5,6,8]),
    "ReboundLeap": ("air",[0,1,3],[4,7,6]),
    "AttackDiagonal": ("descent",[0,1,2],[4,7,6]),
    "FrenzyPounce": ("frenzy",[0,1],[8,5]),
    "FrenzyBound": ("frenzy",[0,1,3],[3,10,5]),
    "WallPlant": ("frenzy",[2],[14]),
    "WallRebound": ("frenzy",[2,3],[2,16]),
    "FrenzyLand": ("frenzy",[4,5],[9,7]),
    "FrenzyLook": ("frenzy",[4,5],[10,28]),
    "Seize": ("air",[0,2,3],[9,10,11]),
    "Launch": ("air",[0,1,2],[5,8,8]),
    "Ascend": ("air",[1,2,3],[6,7,7]),
    "Windup": ("air",[4,5,4],[12,14,17]),
    "Descent": ("descent",[0,1,2],[10,15,17]),
    "Impact": ("descent",[2,3,4],[8,10,8]),
    "Base": ("descent",[5],[14]),
}
def pack():
    lumbar, back, clips = {}, {}, {}
    landmarks = json.loads((SOURCES / "kakuja-back.json").read_text(encoding="utf-8-sig"))
    for name,(scale,hips) in PLATES.items():
        src = Image.open(SOURCES / f"{name}.png").convert("RGBA")
        atlas = Image.new("RGBA",(SIZE*3,SIZE*2))
        sheet = f"kaneki/centipede-{name}.png"
        anchors = []
        for i,hx in enumerate(hips):
            raw = grid(src,i,3,2)
            _, t, _, b = raw.getchannel("A").point(lambda v:255 if v>=225 else 0).getbbox()
            hy = t+round((b-t)*.56)
            raw.putalpha(component(raw,(hx,hy),225))
            l,t,r,b=raw.getbbox()
            body=raw.crop((l,t,r,b)).resize((round((r-l)*scale),round((b-t)*scale)),Image.Resampling.NEAREST)
            dx,dy=PIVOT[0]-round((hx-l)*scale),PIVOT[1]-body.height
            assert min(dx,dy,SIZE-dx-body.width)>=4,(name,i)
            atlas.alpha_composite(body,(i%3*SIZE+dx,i//3*SIZE+dy))
            anchors.append({"x":-9,"y":dy+round((hy-t)*scale)-5-PIVOT[1]})
        paint_faces(atlas,name,SIZE)
        if name in landmarks:
            cels = landmarks[name]
            assert len(cels) == len(hips)
            for i,points in enumerate(cels):
                assert len(points) == 3 and points[0][1] < points[1][1] < points[2][1], (name,i)
                for x,y in points:
                    assert atlas.getpixel((i%3*SIZE+x,i//3*SIZE+y))[3] >= 225, (name,i,x,y)
            back[sheet] = [[[x-PIVOT[0],y-PIVOT[1]] for x,y in points] for points in cels]
        atlas.save(OUT / f"centipede-{name}.png")
        lumbar[sheet] = anchors
    for name,(plate,frames,durations) in CLIPS.items():
        clips["centipede"+name] = {"sheet":f"kaneki/centipede-{plate}.png",
                                  "columns":3,"frames":frames,"durations":durations,"ticks":1,"loop":False}
    (ROOT / "src/data/kaneki-centipede-art.json").write_text(
        json.dumps({"clips":clips,"lumbar":lumbar,"back":back},separators=(",",":"))+"\n",encoding="utf8")

if __name__=="__main__":
    pack()



