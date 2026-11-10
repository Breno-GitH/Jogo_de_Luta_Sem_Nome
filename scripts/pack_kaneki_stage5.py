"""Pack the authored grab continuations without modifying the original atlas."""
import json
from PIL import Image
from pack_kaneki_combat import ROOT, SIZE, PIVOT, component

SOURCES = ROOT / "art/kaneki-stage5-source"
OUT = ROOT / "public/sprites/kaneki"
PLATES = {
    "grab-pull": (.452, (415, 825), [207,188,177,201,181,173,195,211,175],
                  ["rinkakuCombo","redSpiral","centipedeDrop"], [[9,10,11],[13,14,12],[12,14,10,12,12,10,17]]),
    "grab-swing": (.394, (437, 874), [186,183,186,176,177,189,187,184,181],
                   ["quickSwing","doubleSwing","redCatapult"], [[10,10,7],[14,24,11],[14,24,12]]),
    "grab-air": (.407, (415, 831), [219,199,211,217,196,193,200,170,207],
                 ["aerialSnatch","rinkakuCyclone","centipedeMeteor"], [[12,12,11],[15,17,20],[7,10,9,12,14,6,15]]),
    "swords": (.436, (415, 831), [201,181,179,199,188,187,192,194,184],
               ["swordsRecall","swordsSide","swordsRise"], [[9,10,7],[11,8,8],[9,7,7]]),
    "rush-light": (.401, (415, 830), [195,194,181,216,194,192,195,189,188],
                   ["rushReel","rushQuickThrow","rushShortLift"], [[5,5,6],[8,5,8],[7,6,7]]),
    "rush-medium": (.390, (415, 806), [219,209,196,206,192,198,188,191,190],
                    ["rushCrossover","rushSpinThrow","rushAirSet"], [[9,11,10],[12,12,10],[8,8,8]]),
    "rush-heavy": (.415, (415, 830), [196,192,189,202,184,200,211,168,191],
                   ["rushDragStrike","rushHeavyThrow","rushSlam"], [[10,13,7],[12,15,10],[7,12,11,12,15]]),
}
BRIDGES = {
    "centipedeDrop": ("centipede", [2,3,4,5], [6,7,9,10,11,12,8]),
    "centipedeMeteor": ("meteor", [1,2,3,5], [6,9,10,11,7,12,8]),
    "rushSlam": ("centipede", [1,4], [6,9,10,7,8]),
}

def pack():
    metadata = json.loads((ROOT / "src/data/kaneki-chain-art.json").read_text(encoding="utf8"))
    clips, lumbar = {}, {}
    for name, (scale, cuts, hips, routes, holds) in PLATES.items():
        source = Image.open(SOURCES / f"{name}.png").convert("RGBA")
        atlas = Image.new("RGBA", (SIZE * 3, SIZE * 5))
        anchors = []
        rows = (0, *cuts, source.height)
        for i, hx in enumerate(hips):
            col, row = i % 3, i // 3
            raw = source.crop((col*source.width//3, rows[row], (col+1)*source.width//3, rows[row+1]))
            l, t, r, b = raw.getchannel("A").point(lambda a: 255 if a >= 225 else 0).getbbox()
            hy = t + round((b-t)*.55)
            raw.putalpha(component(raw, (hx,hy), 225))
            l, t, r, b = raw.getbbox()
            cel = raw.crop((l,t,r,b)).resize((round((r-l)*scale), round((b-t)*scale)), Image.Resampling.NEAREST)
            dx, dy = PIVOT[0] - round((hx-l)*scale), PIVOT[1] - cel.height
            assert min(dx, dy, SIZE-dx-cel.width) >= 4, (name,i)
            atlas.alpha_composite(cel, (col*SIZE+dx, row*SIZE+dy))
            anchors.append({"x": -9, "y": dy + round((hy-t)*scale) - 4 - PIVOT[1]})
        sheet = f"kaneki/stage5-{name}.png"
        for i, (route, durations) in enumerate(zip(routes, holds)):
            frames = list(range(3*i, 3*i+3))
            if route in BRIDGES:
                old, inserts, frames = BRIDGES[route]
                old_sheet = f"kaneki/chain-{old}.png"
                old_atlas = Image.open(OUT / f"chain-{old}.png").convert("RGBA")
                for index in inserts:
                    x,y = index%4*SIZE, index//4*SIZE
                    slot = len(anchors)
                    atlas.alpha_composite(old_atlas.crop((x,y,x+SIZE,y+SIZE)),(slot%3*SIZE,slot//3*SIZE))
                    anchors.append(metadata["lumbar"][old_sheet][index])
            assert len(frames) == len(durations)
            clips[f"chain_{route}"] = {"sheet":sheet, "columns":3, "frames":frames,
                                      "durations":durations, "ticks":1, "loop":False}
        atlas.save(OUT / f"stage5-{name}.png")
        lumbar[sheet] = anchors
    (ROOT / "src/data/kaneki-stage5-art.json").write_text(
        json.dumps({"clips":clips,"lumbar":lumbar}, separators=(",",":"))+"\n", encoding="utf8")

if __name__ == "__main__":
    pack()

