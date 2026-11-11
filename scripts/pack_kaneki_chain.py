"""Build native fighting cels and measured lumbar anchors for the chain routes."""
import json
from PIL import Image
from pack_kaneki_combat import ROOT, SIZE, PIVOT, component, grid

SOURCES = ROOT / "art/kaneki-chain-source"
OUT = ROOT / "public/sprites/kaneki"
PLATES = {
    "centipede": (.358, [(200,309),(199,227),(194,183),(210,200),
                       (201,190),(194,269),(197,247),(198,236)]),
    "meteor": (.355, [(212,218),(215,217),(203,192),(217,200),
                     (211,225),(214,247),(226,265),(204,242)]),
    "links": (.368, [(201,226),(204,231),(211,220),(207,231),
                    (200,200),(202,221),(216,220),(213,181)]),
}
CELS = {
    "centipede": ("centipede", list(range(8)), [10,8,13,10,12,8,7,10]),
    "meteor": ("meteor", list(range(8)), [6,8,10,9,8,10,7,12]),
    "embrace": ("links", [0,1,0], [13,6,7]),
    "pendulum": ("links", [2,3,0], [23,7,8]),
    "lasso": ("links", [4,5,4], [15,9,14]),
    "spin": ("links", [6,7,5], [28,9,14]),
}

def pack():
    clips, lumbar = {}, {}
    for name, (scale, hips) in PLATES.items():
        source = Image.open(SOURCES / f"{name}.png").convert("RGBA")
        atlas = Image.new("RGBA", (SIZE * 4, SIZE * 2))
        anchors = []
        for i, (hx, hy) in enumerate(hips):
            raw = grid(source, i, 4, 2)
            raw.putalpha(component(raw, (hx, hy), 225))
            l, t, r, b = raw.getbbox()
            cel = raw.crop((l, t, r, b)).resize(
                (round((r-l)*scale), round((b-t)*scale)), Image.Resampling.NEAREST)
            dx = PIVOT[0] - round((hx-l)*scale)
            dy = PIVOT[1] - cel.height
            assert dx >= 4 and dx+cel.width <= SIZE-4 and dy >= 4, (name, i)
            atlas.alpha_composite(cel, (i%4*SIZE+dx, i//4*SIZE+dy))
            anchors.append({"x": -9, "y": dy + round((hy-t)*scale) - 4 - PIVOT[1]})
        sheet = f"kaneki/chain-{name}.png"
        atlas.save(OUT / f"chain-{name}.png")
        lumbar[sheet] = anchors
    for name, (sheet, frames, holds) in CELS.items():
        clips[f"chain_{name}"] = {"sheet": f"kaneki/chain-{sheet}.png",
                                 "columns": 4, "frames": frames,
                                 "durations": holds, "ticks": 1, "loop": False}
    (ROOT / "src/data/kaneki-chain-art.json").write_text(
        json.dumps({"clips": clips, "lumbar": lumbar}, separators=(",", ":")) + "\n", encoding="utf8")

if __name__ == "__main__":
    pack()

