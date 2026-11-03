from pathlib import Path
import json
from PIL import Image, ImageDraw
from pack_luffy_normals import anchor_in_body, body_boxes

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/luffy-specials-source/body.png"
OUTPUT = ROOT / "public/sprites/luffy/specials.png"
# Source coordinates: body pivot, near shoulder, far shoulder, removable near arm.
CELS = [
    ((192,345),(135,134),(186,130),[(95,133),(128,124),(153,151),(151,164),(174,165),(176,197),(106,200)]),
    ((538,345),(547,139),(590,139),[(483,138),(535,124),(551,145),(532,158),(547,182),(535,204),(496,204),(483,178)]),
    ((906,345),(931,169),(961,173),[(866,159),(919,151),(948,164),(934,186),(914,190),(921,219),(887,229),(875,201)]),
    ((1250,345),(1239,126),(1280,134),[(1181,124),(1225,113),(1250,129),(1234,150),(1245,175),(1239,196),(1191,194)]),
    ((191,692),(163,533),(210,532),[(110,530),(153,515),(182,535),(161,552),(145,556),(170,575),(161,602),(110,601)]),
    ((540,692),(545,501),(584,499),[(489,501),(530,482),(552,500),(533,522),(546,542),(543,562),(501,561),(490,528)]),
    ((899,692),(926,500),(957,497),[(887,492),(917,478),(943,493),(925,520),(950,529),(952,557),(916,560),(889,540)]),
    ((1246,692),(1243,515),(1287,521),[(1181,511),(1228,501),(1253,518),(1236,538),(1249,555),(1240,582),(1190,581)]),
    ((202,1047),(139,853),(188,850),[(104,848),(131,838),(156,859),(152,871),(181,872),(188,898),(173,909),(106,910)]),
    ((538,1047),(539,865),(577,868),[(481,854),(524,843),(547,859),(535,875),(531,885),(525,915),(482,910)]),
    ((907,1047),(894,880),(930,880),[(833,868),(882,855),(913,873),(902,889),(881,897),(883,924),(841,926)]),
    ((1251,1047),(1240,869),(1288,872),[(1183,860),(1226,850),(1248,868),(1236,887),(1250,909),(1240,932),(1190,931)]),
]

FAR_HANDS = {
    5: [(573,533),(591,534),(595,550),(583,558),(573,550)],
    7: [(1280,558),(1294,558),(1300,576),(1286,585),(1278,574)],
    8: [(231,868),(246,871),(253,890),(241,903),(233,891)],
    9: [(557,891),(575,890),(578,904),(566,917),(555,907)],
    11: [(1289,895),(1303,897),(1310,916),(1298,928),(1287,914)],
}

with Image.open(SOURCE) as original:
    image = original.convert("RGBA")
atlas = Image.new("RGBA", (2048, 512))
poses = {key: [] for key in ("pistol", "gatling", "bazooka")}
for i, (pivot, near, far, cut) in enumerate(CELS):
    col, row = i % 4, i // 4
    ox, oy = col * image.width // 4, row * image.height // 3
    crop = image.crop((ox, oy, (col + 1) * image.width // 4, (row + 1) * image.height // 3))
    alpha = crop.getchannel("A").point(lambda a: 255 if a >= 220 else 0)
    bounds = alpha.getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < crop.width and bounds[3] < crop.height
    mask = ImageDraw.Draw(alpha)
    mask.polygon([(x-ox,y-oy) for x,y in cut], fill=0)
    if i in FAR_HANDS:
        mask.polygon([(x-ox,y-oy) for x,y in FAR_HANDS[i]], fill=0)
    crop.putalpha(alpha)
    scale = .42
    small = crop.resize(tuple(round(v*scale) for v in crop.size), Image.Resampling.NEAREST)
    cell = Image.new("RGBA", (256,256))
    cell.alpha_composite(small, (128-round((pivot[0]-ox)*scale),224-round((pivot[1]-oy)*scale)))
    anchors = [anchor_in_body(cell, 128+round((x-pivot[0])*scale), 224+round((y-pivot[1])*scale))
               for x,y in (near,far)]
    poses[tuple(poses)[row]].append({"joints": anchors, "hurtboxes": body_boxes(cell)})
    atlas.paste(cell, (i%8*256,i//8*256))

atlas.save(OUTPUT)
(ROOT / "src/data/luffy-special-poses.json").write_text(json.dumps(poses,separators=(",",":"))+"\n")

