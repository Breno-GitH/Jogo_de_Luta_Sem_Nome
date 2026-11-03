"""Luffy foundation: authored native pixel contours, no source-image sampling.

All coordinates below are native pixels. Pillow fills integer polygons/lines;
no AA, mesh, limb crops, image rotation, raster stretching or poster extraction.
Only the inspection exports use NEAREST enlargement. This first stage exports
ONE combat drawing, three face studies and a side model, not fake animation.
"""
from pathlib import Path
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
    'white': '#fff1d5',
}
RIG = {
    'pivot': {'x': 128, 'y': 224}, 'ground': 224, 'cell': [256, 256],
    'facing': 'right', 'height': 130,
    'points': {
        'head': [138, 117], 'neck': [134, 130],
        'shoulderBack': [121, 137], 'elbowBack': [114, 156],
        'wristBack': [124, 155], 'handBack': [128, 155],
        'shoulderFront': [145, 139], 'elbowFront': [157, 155],
        'wristFront': [170, 145], 'handFront': [174, 143],
        'hip': [128, 165], 'hipBack': [119, 167], 'hipFront': [135, 167],
        'kneeBack': [111, 193], 'kneeFront': [150, 193],
        'ankleBack': [106, 215], 'ankleFront': [149, 215],
        'footBack': [106, 223], 'footFront': [154, 223],
    },
    'layers': ['legs', 'torso', 'shorts', 'sash', 'armBack',
               'head', 'armFront', 'hat'],
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


def hat(q):
    # Compact tilted brim leaves the forehead and both eyes unobstructed.
    q.poly([(121,104),(123,100),(127,96),(132,94),(139,94),
            (144,96),(147,100),(147,104),(134,105),(123,107)], 'straw2')
    q.poly([(125,100),(130,96),(135,95),(141,95),(144,98),
            (143,101),(135,101),(127,103)], 'straw3', False)
    q.line([(130,97),(135,95),(139,95)], 'straw4')
    q.poly([(122,102),(129,101),(137,100),(145,100),(147,102),
            (146,104),(135,103),(122,106)], 'red2')
    q.line([(125,102),(134,101),(143,101)], 'red3')
    q.poly([(116,107),(122,104),(132,103),(142,102),(149,103),
            (153,105),(152,107),(146,108),(137,107),(128,109),
            (121,111),(116,110),(115,109)], 'straw2')
    q.poly([(118,107),(124,105),(133,104),(143,103),(150,104),
            (147,105),(137,105),(128,107),(120,109)], 'straw3', False)
    q.line([(118,109),(126,108),(136,106),(145,106),(150,106)], 'straw0')
    q.dots([(126,99),(130,98),(139,97),(143,98),(123,106),(134,105)], 'straw1')


def base(expression='grin', front_arm=True):
    q=Pixel()
    draw_pose(q,expression,front_arm)
    hat(q)
    return q.im


def side_model():
    """Separately authored side silhouette for future locomotion reference."""
    q=Pixel()
    q.poly([(122,176),(131,176),(128,194),(126,214),(131,219),
            (129,223),(115,223),(116,219),(119,215),(118,196)],'skin2')
    q.poly([(131,176),(139,177),(143,194),(140,213),(145,218),
            (154,220),(155,223),(136,223),(133,220),(135,214),
            (135,195),(128,185)],'skin3')
    q.line([(120,197),(122,211)],'skin1',2)
    q.line([(137,198),(138,210)],'skin1')
    q.line([(116,222),(129,222)],'sole1',2)
    q.line([(136,222),(153,222)],'sole1',2)
    q.line([(137,216),(140,219),(145,219)],'ink',2)
    q.line([(120,216),(122,220),(125,220)],'ink',2)
    q.poly([(122,126),(132,126),(138,132),(139,143),(136,158),
            (139,165),(125,167),(117,162),(118,146),(117,134)],'red2')
    q.poly([(128,129),(133,130),(136,135),(133,145),(133,156),
            (136,161),(132,162),(128,155),(129,143)],'red3',False)
    q.line([(120,136),(122,145),(120,155)],'red0')
    q.poly([(125,131),(130,130),(133,135),(131,145),(129,153),
            (130,163),(126,166),(121,163),(122,154),(122,144),(121,137)],'skin3')
    q.line([(124,137),(124,146),(126,151)],'skin1',2)
    q.line([(125,156),(125,162),(128,163)],'skin0')
    q.poly([(120,163),(136,162),(142,174),(141,184),(132,187),
            (127,178),(126,185),(116,184),(116,175)],'blue2')
    q.poly([(124,166),(131,165),(137,175),(136,180),(131,176)],'blue3',False)
    q.line([(128,170),(127,177),(124,182)],'blue0')
    q.line([(117,183),(123,184),(126,183)],'cloth2',3)
    q.line([(132,185),(139,183),(141,181)],'cloth2',3)
    q.poly([(120,159),(134,159),(138,161),(137,165),(121,166)],'sash1')
    q.line([(122,161),(134,161)],'sash2')
    q.poly([(135,163),(139,164),(144,176),(143,183),(140,178)],'sash1')
    # Side face uses the same skull height and hat construction.
    q.poly([(125,107),(137,107),(143,111),(143,115),(147,119),
            (144,121),(144,126),(137,129),(129,126),(124,120)],'skin3')
    q.poly([(122,106),(132,104),(142,108),(143,112),(138,111),
            (137,116),(134,112),(130,116),(130,121),(126,124),
            (124,128),(120,126),(121,120),(117,121),(121,115),(118,113)],'hair0')
    q.poly([(128,115),(131,115),(133,118),(132,121),(130,122),(127,119)],'skin2')
    q.line([(130,117),(129,118),(130,120)],'skin0')
    q.poly([(137,115),(140,114),(142,116),(141,119),(138,119)],'white')
    q.line([(140,115),(140,118)],'hair0')
    q.line([(136,113),(140,112),(142,113)],'ink')
    q.line([(138,121),(141,122)],'skin0')
    q.line([(139,125),(143,124)],'skin0')
    hat(q)
    return q.im


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
    old_path = ART / 'base-rev3.png'
    if old_path.exists():
        with Image.open(old_path) as previous:
            comparison([('ANTERIOR', previous.convert('RGBA')), ('REVISAO 4', sprite)],
                       ART / 'before-after.png')
    roster = []
    for name in ('samurai', 'dio', 'goku'):
        with Image.open(OUT.parent / name / 'base.png') as source:
            roster.append((name.upper(), source.convert('RGBA')))
    comparison([*roster, ('LUFFY', sprite)], ART / 'comparison.png', scale=2)


def build():
    ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    im=base(); im.save(OUT/'base.png'); swap(im).save(OUT/'base-p2.png')
    body=base(front_arm=False);body.save(OUT/'body.png');swap(body).save(OUT/'body-p2.png')
    side=side_model();side.save(OUT/'side-model.png')
    expressions=[base(e) for e in ['grin','determined','surprise']]
    sheet=Image.new('RGBA',(768,256))
    for i,frame in enumerate(expressions):sheet.paste(frame,(i*256,0))
    sheet.save(OUT/'expressions.png');swap(sheet).save(OUT/'expressions-p2.png')
    q=Pixel()
    q.poly([(127,131),(130,128),(134,128),(135,129),(139,129),
            (142,132),(142,138),(140,141),(134,142),(130,140),
            (127,140)],'skin3')
    q.poly([(129,137),(132,138),(135,140),(140,138),(140,140),
            (135,141),(130,139)],'skin2',False)
    q.line([(131,130),(133,133),(138,133),(140,135)],'skin1')
    q.line([(130,133),(133,135),(133,137),(137,138)],'skin0')
    q.dots([(134,129),(138,130),(140,132)],'skin4')
    # A forward-facing fist for the extensible-limb renderer. Its attachment
    # anchor is the left wrist pixel; the component is never raster-stretched.
    component=q.im.crop((125,126,144,144));component.save(OUT/'fist.png')
    swap(component).save(OUT/'fist-p2.png')
    review_exports(im)
    preview(im).save(OUT/'base-preview-4x.png')
    preview(im,True).save(OUT/'rig-preview-4x.png')
    contact=Image.new('RGBA',(480*4,600),'#202e3a')
    for i,f in enumerate([*expressions,side]):contact.paste(preview(f),(480*i,0))
    contact.save(OUT/'model-contact.png')
    for file,data in [('palette.json',P),('rig.json',RIG)]:
        (OUT/file).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    (ART/'rig.json').write_text(json.dumps(RIG,indent=2)+'\n',encoding='utf-8')
    alpha=im.getchannel('A'); bounds=alpha.getbbox()
    assert bounds and bounds[1]==94 and bounds[3]==224,bounds
    assert set(alpha.getdata())=={0,255},'Soft alpha'
    assert min(bounds[0],bounds[1],256-bounds[2],256-bounds[3])>=16
    assert all(f.getbbox()[3]==224 for f in expressions+[side])
    manifest={'stage':'base-model-only','drawings':1,'cell':[256,256],
        'pivot':RIG['pivot'],'bounds':bounds,'visibleHeight':bounds[3]-bounds[1],
        'facing':'right','scale':1,'paletteColors':len(P),'alpha':'binary',
        'source':'scripts/build_luffy.py','drawingsSource':'scripts/luffy_drawing.py','sourceImages':[],
        'revision':4,'direction':'lean, relaxed three-quarter guard with original pre-timeskip outfit',
        'expressions':['grin','determined','surprise'],
        'pending':['idle animation','locomotion drawings','normals','defense',
                   'damage reactions','throws','specials','cinematic Super'],
        'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
    (OUT/'model.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest))


if __name__=='__main__':build()
