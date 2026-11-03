"""Luffy foundation: authored native pixel contours, no source-image sampling.

All coordinates below are native pixels. Pillow fills integer polygons/lines;
no AA, mesh, limb crops, image rotation, raster stretching or poster extraction.
Only the inspection exports use NEAREST enlargement. This first stage exports
One combat drawing and the components used by the elastic preview.
"""
from pathlib import Path
from argparse import ArgumentParser
import hashlib
import json
from PIL import Image, ImageDraw
from luffy_drawing import draw_pose

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/sprites/luffy'
ART = ROOT / 'art/luffy'
P = {
    'ink': '#171b25', 'deep': '#33232b',
    'hair0': '#111720', 'hair1': '#242a33', 'hair2': '#343944',
    'skin0': '#894638', 'skin1': '#bf6c48', 'skin2': '#e89b65',
    'skin3': '#ffc489', 'skin4': '#ffdfac',
    'red0': '#531d32', 'red1': '#88243b', 'red2': '#bc3446',
    'red3': '#e54c4b', 'red4': '#ff7560',
    'blue0': '#1d2b4a', 'blue1': '#2c4375', 'blue2': '#3f6196',
    'blue3': '#6584b1', 'blue4': '#8da5c2',
    'straw0': '#755035', 'straw1': '#ac763e', 'straw2': '#dba04f',
    'straw3': '#f3c873', 'straw4': '#ffe2a1',
    'sash0': '#ad702d', 'sash1': '#e5a734', 'sash2': '#ffd465',
    'cloth0': '#8d99ac', 'cloth1': '#c9ccd0', 'cloth2': '#f2e9d9',
    'sole0': '#533e32', 'sole1': '#9f7347', 'sole2': '#d0a269',
    'white': '#fff1d5', 'hatRed': '#a12e35',
}
RIG = {
    'pivot': {'x': 128, 'y': 224}, 'ground': 224, 'cell': [256, 256],
    'facing': 'right', 'height': 130,
    'points': {
        'head': [141, 114], 'neck': [137, 130],
        'center': [130, 154],
        'shoulderBack': [121, 138], 'elbowBack': [114, 152],
        'wristBack': [125, 155], 'handBack': [130, 155],
        'shoulderFront': [145, 139], 'elbowFront': [156, 157],
        'wristFront': [168, 152], 'handFront': [175, 149],
        'hip': [130, 164], 'hipBack': [121, 167], 'hipFront': [137, 168],
        'kneeBack': [114, 192], 'kneeFront': [153, 191],
        'ankleBack': [106, 215], 'ankleFront': [150, 215],
        'footBack': [106, 223], 'footFront': [157, 223],
    },
    'layers': ['backHat', 'legs', 'shorts', 'torso', 'sash', 'armBack', 'armFront', 'head'],
    'elastic': {'root': 'shoulderFront', 'tip': 'handFront',
                'nativeRadius': 3, 'maximumLength': 420,
                'components': ['body.png', 'fist.png'], 'activeInGameplay': False},
}


class Pixel:
    def __init__(self):
        self.im = Image.new('RGBA', (256, 256))
        self.d = ImageDraw.Draw(self.im)

    def poly(self, points, color, outline=True):
        self.d.polygon(points, fill=P[color])
        if outline:
            self.d.line(points + [points[0]], fill=P['ink'], width=1)

    def line(self, points, color, width=1):
        self.d.line(points, fill=P[color], width=width)

    def dots(self, points, color):
        for point in points:
            self.d.point(point, fill=P[color])


def base(front_arm=True):
    drawing = Pixel()
    draw_pose(drawing, front_arm)
    return drawing.im


def swap(im):
    mapping={P[a]:P[b] for a,b in [('red0','blue0'),('red1','blue1'),
        ('red2','blue2'),('red3','blue3'),('red4','blue4'),
        ('blue0','red0'),('blue1','red1'),('blue2','red2'),
        ('blue3','red3'),('blue4','red4')]}
    rgba={tuple(bytes.fromhex(a[1:]))+(255,):tuple(bytes.fromhex(b[1:]))+(255,)
          for a,b in mapping.items()}
    result=im.copy(); result.putdata([rgba.get(p,p) if i//im.width % 256 >= 127 else p
        for i,p in enumerate(im.getdata())])
    return result


def preview(im, rig=False, scale=4):
    crop=(78,84,198,234)
    bg=Image.new('RGBA',(256,256),'#202e3a');d=ImageDraw.Draw(bg)
    for y in range(80,240,8):
        for x in range(72,200,8):
            if (x//8+y//8)%2:d.rectangle((x,y,x+7,y+7),fill='#263744')
    bg.alpha_composite(im)
    if rig:
        d=ImageDraw.Draw(bg);d.line([(78,224),(198,224)],fill='#64cdbb')
        for x,y in RIG['points'].values():d.rectangle((x-1,y-1,x+1,y+1),fill='#f8da77')
        d.line([(124,224),(132,224)],fill='#ff6b80');d.line([(128,220),(128,228)],fill='#ff6b80')
    return bg.crop(crop).resize((120*scale,150*scale),Image.Resampling.NEAREST)


def comparison(rows, destination, scale=3):
    # Whole cells share their original pivot and ground. Nothing is resized
    # until the final integer enlargement of the complete contact sheet.
    panel = Image.new('RGBA', (176 * len(rows), 174), '#202e3a')
    guide = ImageDraw.Draw(panel)
    guide.line((0, 146, panel.width - 1, 146), fill='#64cdbb')
    for index, (name, sprite) in enumerate(rows):
        offset = 176 * index
        panel.alpha_composite(sprite.crop((48, 78, 224, 232)), (offset, 0))
        guide.text((offset + 12, 155), name, fill='#f4e8cf')
    panel.resize((panel.width * scale, panel.height * scale),
                 Image.Resampling.NEAREST).save(destination)


def review_exports(sprite):
    silhouette = Image.new('RGBA', sprite.size)
    silhouette.paste('#f0dfb8', (0, 0, *sprite.size), sprite.getchannel('A'))
    silhouette.save(OUT / 'silhouette.png')
    preview(silhouette).save(OUT / 'silhouette-preview-4x.png')
    old_path = ART / 'archive-rev5/sprites/base.png'
    if old_path.exists():
        with Image.open(old_path) as previous:
            comparison([('ANTERIOR', previous.convert('RGBA')), ('NOVA BASE', sprite)],
                       ART / 'before-after.png')
    roster = []
    for name in ('samurai', 'dio', 'goku'):
        with Image.open(OUT.parent / name / 'base.png') as source:
            roster.append((name.upper(), source.convert('RGBA')))
    comparison([*roster, ('LUFFY', sprite)], ART / 'comparison.png', scale=2)


def compare_reference(sprite, path):
    """Compare against the large illustration only in this review artifact."""
    with Image.open(path) as source:
        image = source.convert('RGBA')
        width, height = image.size
        illustration = image.crop(tuple(round(edge * extent) for edge, extent in
            [(12/1536, width), (145/1024, height), (490/1536, width), (881/1024, height)]))
    illustration = illustration.resize(
        (round(illustration.width * 540 / illustration.height), 540),
        Image.Resampling.NEAREST,
    )
    drawing = preview(sprite)
    sheet = Image.new('RGBA', (illustration.width + drawing.width + 36, 642), '#202e3a')
    sheet.alpha_composite(illustration, (12, 22))
    right = illustration.width + 24
    sheet.alpha_composite(drawing, (right, 0))
    labels = ImageDraw.Draw(sheet)
    labels.text((12, 610), 'REFERENCIA | ILUSTRACAO', fill='#f4e8cf')
    labels.text((right, 610), 'LUFFY | SPRITE 4X NEAREST', fill='#f4e8cf')
    sheet.save(ART / 'reference-comparison.png')


def build(reference=None):
    ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    im=base(); im.save(OUT/'base.png'); swap(im).save(OUT/'base-p2.png')
    body=base(front_arm=False);body.save(OUT/'body.png');swap(body).save(OUT/'body-p2.png')
    q=Pixel()
    q.poly([(126,132),(130,131),(132,129),(135,127),(139,128),
            (142,131),(143,134),(142,138),(138,141),(133,142),
            (129,140),(126,139)], 'skin2')
    q.poly([(130,133),(134,130),(137,129),(141,131),(141,134),
            (138,136),(134,135),(132,137),(129,136)], 'skin3', False)
    q.line([(134,132),(136,134),(141,134)], 'skin1')
    q.line([(132,137),(134,139),(137,138)], 'skin0')
    q.dots([(136,129),(139,131)], 'skin4')
    component=q.im.crop((125,126,144,144));component.save(OUT/'fist.png')
    swap(component).save(OUT/'fist-p2.png')
    review_exports(im)
    if reference:
        compare_reference(im, reference)
    preview(im).save(OUT/'base-preview-4x.png')
    preview(im,True).save(OUT/'rig-preview-4x.png')
    for file,data in [('palette.json',P),('rig.json',RIG)]:
        (OUT/file).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    (ART/'rig.json').write_text(json.dumps(RIG,indent=2)+'\n',encoding='utf-8')
    alpha=im.getchannel('A'); bounds=alpha.getbbox()
    assert bounds and bounds[1]==94 and bounds[3]==224,bounds
    assert set(alpha.getdata())=={0,255},'Soft alpha'
    assert min(bounds[0],bounds[1],256-bounds[2],256-bounds[3])>=16
    manifest={'stage':'base-model-only','drawings':1,'cell':[256,256],
        'pivot':RIG['pivot'],'bounds':bounds,'visibleHeight':bounds[3]-bounds[1],
        'facing':'right','scale':1,'paletteColors':len(P),'alpha':'binary',
        'source':'scripts/build_luffy.py','drawingsSource':'scripts/luffy_drawing.py','sourceImages':[],
        'revision':6,'direction':'Enies Lobby open guard, straw hat on back',
        'pending':['idle animation','locomotion drawings','normals','defense',
                   'damage reactions','throws','specials','cinematic Super'],
        'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
    (OUT/'model.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest))


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--reference', type=Path)
    build(parser.parse_args().reference)
