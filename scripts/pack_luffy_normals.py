"""Package Luffy body layers and export the corresponding native joint positions."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art/luffy-normals-source"
DATA = ROOT / "src/data"
OUT = ROOT / "public/sprites/luffy"

# Each entry anchors one original body pose, with a polygon removing the
# attacking forearm/leg where it would otherwise duplicate the live limb.
# (pivot in source, joint in source, polygon of the removable pixels)
SOURCES = {
    "stand_light": [
        ((204,367),(193,140),[(114,137),(183,119),(188,155),(169,170),(182,228),(115,229)]),
        ((623,367),(652,162),[(653,146),(692,148),(699,207),(658,213),(627,196),(632,161)]),
        ((1019,367),(998,145),[(924,137),(989,122),(996,151),(979,173),(996,230),(930,232)]),
    ],
    "stand_medium": [
        ((177,790),(262,624),[(266,608),(290,608),(301,735),(219,735),(229,648)]),
        ((584,790),(658,589),[(664,558),(699,558),(702,633),(629,644),(624,625)]),
        ((990,790),(1093,649),[(1101,622),(1134,628),(1128,761),(1033,759),(1040,681)]),
    ],
    "stand_heavy": [
        ((202,1208),(196,1020),[(118,1005),(178,992),(196,1031),(169,1050),(176,1092),(125,1100)]),
        ((614,1208),(675,1026),[(676,1001),(724,1004),(734,1052),(710,1074),(656,1064),(651,1036)]),
        ((1023,1208),(1032,1009),[(957,1000),(1021,984),(1034,1025),(1003,1049),(1015,1083),(959,1094)]),
    ],
    "crouch_light": [
        ((229,380),(217,188),[(144,180),(204,163),(220,184),(203,221),(215,288),(146,288)]),
        ((613,380),(596,208),[(516,195),(589,181),(606,205),(574,225),(577,286),(519,286)]),
        ((986,380),(964,177),[(900,168),(960,157),(973,184),(955,208),(958,278),(902,279)]),
    ],
    "crouch_medium": [
        ((202,781),(285,647),[(290,630),(319,635),(317,697),(280,743),(241,739),(239,698)]),
        ((582,781),(650,690),[(654,681),(690,679),(680,736),(632,746),(600,738),(609,708)]),
        ((978,781),(1046,642),[(1062,631),(1085,634),(1082,683),(1043,732),(1003,730),(1006,693)]),
    ],
    "crouch_heavy": [
        ((230,1188),(231,1119),[(234,1112),(261,1117),(252,1155),(232,1161),(204,1189),(145,1190),(143,1161),(189,1123)]),
        ((583,1188),(663,1000),[(670,984),(697,985),(695,1036),(654,1081),(624,1074),(622,1038)]),
        ((986,1188),(1055,1044),[(1066,1026),(1090,1036),(1082,1083),(1039,1126),(1009,1121),(1008,1082)]),
    ],
    "air_light": [
        ((194,370),(184,132),[(95,138),(174,109),(187,136),(161,164),(140,220),(90,226)]),
        ((614,326),(595,123),[(530,128),(584,104),(602,128),(583,168),(550,171),(523,159)]),
        ((1016,355),(995,131),[(944,123),(984,103),(1001,131),(989,162),(995,224),(952,229)]),
    ],
    "air_medium": [
        ((189,752),(269,605),[(278,574),(308,584),(306,628),(283,687),(245,694),(223,666)]),
        ((596,741),(688,597),[(690,558),(812,569),(816,646),(757,649),(681,629)]),
        ((1015,752),(1081,604),[(1093,575),(1129,576),(1125,633),(1098,682),(1058,692),(1032,665)]),
    ],
    "air_heavy": [
        ((189,1160),(269,1024),[(273,1006),(304,1007),(307,1055),(261,1110),(213,1114),(200,1087),(222,1047)]),
        ((586,1214),(671,1087),[(674,1070),(705,1074),(785,1172),(771,1201),(719,1201),(639,1106)]),
        ((1014,1158),(1088,1024),[(1102,1005),(1133,1006),(1131,1056),(1080,1110),(1030,1111),(1022,1080),(1043,1048)]),
    ],
}

SCALE = {"stand": .40, "crouch": .38, "air": .37}
PATTERNS = {4: [0,1,1,2], 6: [0,0,1,1,2,2], 7: [0,0,1,1,1,2,2]}


def anchor_in_body(cell, x, y):
    """Seat the joint a few pixels inside the retained shoulder or cuff."""
    alpha = cell.getchannel("A")
    candidates = (
        ((px-x)**2 + (py-y)**2, px, py)
        for px in range(x-12, x+13) for py in range(y-12, y+13)
        if all(alpha.getpixel((px+dx, py+dy)) == 255
               for dx, dy in [(0,0),(-2,0),(2,0),(0,-2),(0,2)])
    )
    _, px, py = min(candidates)
    return [px-128, py-224]


def body_boxes(cell):
    alpha = cell.getchannel("A")
    _, top, _, bottom = alpha.getbbox()
    # Short horizontal slices track crouches, lunges and tucks independently.
    edges = [top + round((bottom-top)*fraction) for fraction in [0,.22,.48,.72,1]]
    boxes = []
    for y0, y1 in zip(edges, edges[1:]):
        x0, a, x1, b = alpha.crop((0,y0,256,y1)).getbbox()
        boxes.append({"x":x0-128,"y":y0+a-224,"w":x1-x0,"h":b-a})
    return boxes


def main():
    specs = json.loads((DATA / "luffy-normals.json").read_text())
    atlas = Image.new("RGBA", (2048, 1792))
    images = {name: Image.open(SRC / (name + ".png")).convert("RGBA") for name in SCALE}
    joints = {}
    i = 0
    for index, (move, spec) in enumerate(specs.items()):
        group = move.split("_")[0]
        image = images[group]
        row = index % 3
        scale = SCALE[group]
        cels = []
        for col, (pivot, joint, remove) in enumerate(SOURCES[move]):
            ox, oy = col*418, row*418
            crop = image.crop((ox, oy, ox+418, oy+418))
            alpha = crop.getchannel("A").point(lambda p: 255 if p >= 220 else 0)
            ImageDraw.Draw(alpha).polygon([(x-ox,y-oy) for x,y in remove], fill=0)
            crop.putalpha(alpha)
            small = crop.resize((round(418*scale),)*2, Image.Resampling.NEAREST)
            cell = Image.new("RGBA", (256,256))
            at = (128-round((pivot[0]-ox)*scale),224-round((pivot[1]-oy)*scale))
            cell.alpha_composite(small, at)
            bounds = cell.getbbox()
            assert bounds and bounds[0] > 8 and bounds[1] > 8 and bounds[2] < 248
            x = 128 + round((joint[0]-pivot[0])*scale)
            y = 224 + round((joint[1]-pivot[1])*scale)
            cels.append((cell, {"joint":anchor_in_body(cell, x, y),
                                "hurtboxes":body_boxes(cell)}))
        joints[move] = []
        for variant in PATTERNS[len(spec["holds"])]:
            cell, joint = cels[variant]
            atlas.paste(cell, ((i%8)*256,(i//8)*256))
            joints[move].append(joint)
            i += 1
    assert i == 51
    atlas.save(OUT / "normals.png")
    (DATA / "luffy-normal-joints.json").write_text(json.dumps(joints, separators=(",",":"))+"\n")


if __name__ == "__main__":
    main()

