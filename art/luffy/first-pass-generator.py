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
        'head': [134, 116], 'neck': [130, 130],
        'shoulderBack': [111, 132], 'elbowBack': [102, 148],
        'wristBack': [117, 145], 'handBack': [121, 142],
        'shoulderFront': [143, 132], 'elbowFront': [154, 147],
        'wristFront': [164, 133], 'handFront': [166, 128],
        'hip': [127, 164], 'hipBack': [117, 168], 'hipFront': [135, 168],
        'kneeBack': [111, 193], 'kneeFront': [145, 193],
        'ankleBack': [103, 215], 'ankleFront': [150, 215],
        'footBack': [102, 223], 'footFront': [153, 223],
    },
    'layers': ['legBack', 'legFront', 'armBack', 'torso', 'shorts',
               'sash', 'head', 'armFront', 'hat'],
    'elastic': {'root': 'shoulderFront', 'tip': 'handFront',
                'nativeRadius': 3, 'maximumLength': 420,
                'components': 'components.png', 'activeInGameplay': False},
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


def leg_back(q):
    q.poly([(112,176),(124,181),(119,191),(115,199),(109,211),
            (109,217),(101,219),(99,214),(103,207),(106,197),(107,187)], 'skin2')
    q.poly([(113,181),(119,183),(114,195),(111,202),(107,210),(104,213),
            (103,208),(108,195)], 'skin1', False)
    q.poly([(116,184),(121,184),(117,193),(113,198),(111,197)], 'skin3', False)
    q.line([(108,200),(111,198),(114,198)], 'skin0')
    q.line([(102,213),(106,215),(108,213)], 'skin0')
    # Bare toes, dark thong strap and thin straw sole are drawn separately.
    q.poly([(100,214),(108,215),(110,217),(113,219),(114,222),
            (112,223),(91,223),(91,221),(96,218)], 'sole1')
    q.poly([(99,215),(105,216),(108,218),(111,220),(110,221),
            (94,221),(96,218)], 'skin3')
    q.line([(99,216),(101,219),(108,220)], 'ink', 2)
    q.line([(94,221),(110,222)], 'sole2')
    q.dots([(96,220),(98,219),(104,220)], 'skin1')


def leg_front(q):
    q.poly([(135,177),(145,180),(149,188),(150,196),(148,201),
            (152,213),(154,217),(150,220),(144,217),(144,209),
            (140,199),(137,193),(130,186)], 'skin2')
    q.poly([(140,182),(145,183),(148,190),(147,196),(143,198),
            (139,191),(134,185)], 'skin3', False)
    q.poly([(141,199),(144,197),(147,199),(147,204),(151,215),
            (148,217),(145,211)], 'skin1', False)
    q.line([(141,197),(145,198),(147,195)], 'skin0')
    q.line([(144,205),(146,210),(147,214)], 'skin3')
    q.poly([(145,215),(153,215),(156,218),(165,220),(167,222),
            (166,223),(143,223),(141,221)], 'sole1')
    q.poly([(146,215),(152,216),(155,219),(162,219),(165,221),
            (146,221),(143,220)], 'skin3')
    q.line([(150,216),(149,219),(146,220)], 'ink', 2)
    q.line([(151,218),(157,220)], 'ink')
    q.line([(144,222),(165,222)], 'sole2')
    q.dots([(159,220),(162,220),(164,221)], 'skin0')


def arm_back(q):
    q.poly([(112,127),(107,128),(103,133),(100,140),(98,148),
            (99,152),(104,155),(110,153),(117,148),(122,148),
            (127,142),(124,137),(118,138),(114,141),(108,144),
            (111,138),(115,134)], 'skin2')
    q.poly([(107,130),(104,135),(101,145),(102,150),(106,151),
            (110,149),(106,148),(106,143),(111,135)], 'skin3', False)
    q.poly([(101,151),(105,153),(113,149),(117,146),(116,143),
            (109,147),(105,148)], 'skin1', False)
    q.line([(105,142),(108,140),(111,140)], 'skin1')
    q.line([(105,151),(110,150),(115,146)], 'skin0')
    # Rear fist is held across the lower chest; visible knuckle clusters.
    q.poly([(117,141),(120,137),(123,137),(126,139),(129,141),
            (128,144),(125,147),(120,147),(116,145)], 'skin3')
    q.line([(119,140),(121,141),(122,144),(125,145)], 'skin1')
    q.line([(124,139),(125,141),(127,141)], 'skin0')
    q.dots([(121,138),(124,140),(126,142)], 'skin4')


def forearm_back(q):
    # The forearm crosses IN FRONT of the vest. Keep it in its own depth
    # layer so the torso never erases the elbow-to-fist connection.
    q.poly([(101,147),(106,147),(115,142),(118,139),(122,139),
            (125,142),(123,146),(117,148),(108,153),(103,153)], 'skin2')
    q.poly([(105,148),(114,144),(118,142),(120,144),(115,146),
            (108,150),(104,150)], 'skin3', False)
    q.line([(105,152),(110,150),(116,147)], 'skin0')
    q.poly([(117,141),(120,137),(123,137),(126,139),(129,141),
            (128,144),(125,147),(120,147),(116,145)], 'skin3')
    q.line([(119,140),(121,141),(122,144),(125,145)], 'skin1')
    q.line([(124,139),(125,141),(127,141)], 'skin0')
    q.dots([(121,138),(124,140),(126,142)], 'skin4')


def torso(q):
    # Neck/chest retains the same silhouette for all facial studies.
    q.poly([(125,124),(138,125),(139,131),(145,134),(140,146),
            (139,159),(124,164),(114,157),(114,135),(124,130)], 'skin2')
    q.poly([(128,127),(134,129),(137,132),(140,134),(135,139),
            (128,136),(123,134)], 'skin3', False)
    q.line([(129,130),(129,134),(133,136)], 'skin0')
    q.line([(133,139),(132,146),(133,155)], 'skin1')
    q.line([(125,139),(130,141),(133,141),(138,138)], 'skin0')
    q.line([(125,147),(130,148),(134,147)], 'skin1')
    q.line([(125,152),(130,153),(134,152)], 'skin1')
    q.poly([(127,143),(130,143),(130,146),(126,145)], 'skin3', False)
    q.poly([(126,149),(130,150),(130,152),(125,151)], 'skin3', False)
    # Red open vest: independent lapels, armholes, folds, hem and buttons.
    q.poly([(121,127),(125,130),(124,140),(124,150),(121,158),
            (117,165),(107,167),(109,158),(110,148),(108,140),
            (106,133),(110,128),(115,127)], 'red2')
    q.poly([(111,130),(116,129),(119,131),(117,139),(116,151),
            (111,160),(109,162),(112,150),(111,140)], 'red3', False)
    q.poly([(121,131),(120,144),(117,157),(113,163),(118,162),
            (122,153),(123,140)], 'red1', False)
    q.line([(111,129),(109,132),(109,137)], 'red4')
    q.line([(118,132),(116,138),(116,145)], 'red0')
    q.line([(110,158),(114,154),(115,150)], 'red0')
    q.poly([(138,129),(142,130),(146,135),(144,142),(142,147),
            (144,157),(145,163),(139,164),(136,159),(138,149),
            (137,140)], 'red2')
    q.poly([(140,132),(142,134),(142,141),(139,151),(140,159),
            (142,161),(138,160),(138,151)], 'red3', False)
    q.line([(144,136),(142,140),(141,145)], 'red0')
    q.line([(138,154),(140,157),(143,158)], 'red1')
    for x,y in [(122,141),(120,150),(117,158)]:
        q.poly([(x,y-1),(x+1,y),(x+1,y+2),(x-1,y+2),(x-1,y)], 'straw1')
        q.dots([(x,y),(x,y+1)], 'straw4')


def shorts(q):
    q.poly([(117,160),(137,160),(141,167),(147,174),(148,183),
            (140,188),(133,186),(128,176),(124,174),(122,183),
            (111,185),(104,181),(108,172)], 'blue2')
    q.poly([(117,164),(125,164),(122,172),(116,178),(111,181),
            (107,179),(113,171)], 'blue3', False)
    q.poly([(127,164),(136,163),(137,169),(142,176),(144,181),
            (139,183),(134,175),(128,173)], 'blue3', False)
    q.poly([(123,168),(128,169),(131,175),(135,184),(132,183),
            (126,176),(124,175),(121,181),(117,183)], 'blue1', False)
    q.line([(125,165),(125,171),(128,174)], 'blue0')
    q.line([(110,175),(117,173),(121,169)], 'blue1')
    q.line([(136,171),(139,173),(142,178)], 'blue4')
    q.line([(110,179),(115,177)], 'blue4')
    for pts in [
        [(105,179),(110,180),(116,181),(122,179),(123,184),
         (120,184),(118,186),(115,185),(113,187),(109,185),(107,185),(104,183)],
        [(133,182),(138,184),(142,182),(147,180),(150,184),
         (147,186),(146,188),(143,187),(140,190),(137,187),(134,188),(132,185)],
    ]:
        q.poly(pts,'cloth1')
    q.line([(106,181),(111,183),(116,183),(120,182)], 'cloth2', 2)
    q.line([(135,184),(140,186),(144,185),(147,183)], 'cloth2', 2)
    q.dots([(108,184),(114,185),(119,184),(135,186),(143,188),(147,185)], 'cloth0')


def sash(q):
    q.poly([(117,157),(125,158),(135,157),(140,159),(140,164),
            (133,166),(123,165),(115,164)], 'sash1')
    q.line([(118,159),(127,160),(137,159)], 'sash2')
    q.line([(117,163),(125,163),(135,164),(139,162)], 'sash0')
    q.poly([(137,160),(141,160),(142,164),(145,172),(152,179),
            (157,180),(153,184),(149,183),(146,179),(141,171),
            (138,166)], 'sash1')
    q.poly([(140,165),(142,168),(144,175),(148,183),(145,185),
            (141,179),(139,172),(138,166)], 'sash0')
    q.line([(141,165),(145,173),(151,179),(154,180)], 'sash2')
    q.line([(140,170),(142,179),(145,183)], 'sash1')


def head(q, expression='grin'):
    # Hair mass and ears are authored, not scaled from another character.
    q.poly([(117,108),(124,102),(138,102),(146,108),(147,116),
            (150,121),(145,120),(143,126),(139,124),(133,130),
            (125,126),(119,130),(119,124),(113,126),(116,120),
            (111,119),(115,115),(112,112)], 'hair0')
    q.poly([(127,109),(137,107),(143,111),(144,115),(146,117),
            (145,120),(148,121),(145,123),(144,126),(138,129),
            (132,128),(126,124),(123,121),(123,114)], 'skin3')
    q.poly([(125,114),(128,116),(128,121),(132,126),(139,128),
            (135,129),(130,126),(126,123)], 'skin2', False)
    q.poly([(140,111),(143,114),(143,117),(141,119),(144,120),
            (146,121),(143,122),(141,121),(140,118)], 'skin4', False)
    q.poly([(125,115),(123,113),(120,114),(120,118),(123,122),
            (126,121),(126,118)], 'skin2')
    q.line([(123,116),(122,116),(123,119),(124,119)], 'skin0')
    q.dots([(124,115),(125,119)], 'skin4')
    # Stable 3/4 face: eye shapes, brows and under-eye scar remain legible.
    q.poly([(132,115),(135,114),(138,115),(138,118),(136,120),
            (133,119)], 'white')
    q.poly([(142,115),(144,115),(145,117),(144,119),(142,118)], 'white')
    q.line([(136,115),(136,118)], 'hair0')
    q.line([(144,116),(144,118)], 'hair0')
    q.line([(131,113),(135,112),(138,113)], 'hair0')
    q.line([(142,113),(144,113)], 'hair0')
    q.line([(140,117),(139,120),(141,121)], 'skin1')
    q.line([(132,121),(137,122)], 'skin0')
    q.dots([(133,120),(133,122),(136,121),(136,123)], 'skin0')
    if expression == 'grin':
        q.poly([(135,123),(139,124),(144,122),(143,125),(140,127),(137,126)], 'white')
        q.line([(138,125),(142,125)], 'cloth0')
    elif expression == 'determined':
        q.line([(136,124),(141,124),(143,123)], 'skin0')
        q.line([(132,113),(136,114)], 'hair0')
        q.line([(142,114),(144,113)], 'hair0')
    else:
        q.poly([(137,123),(140,123),(142,125),(140,127),(138,127)], 'deep')
        q.dots([(139,126),(140,126)], 'skin1')
    # Short jagged locks, with deliberately quiet specular pixel clusters.
    q.poly([(118,109),(125,106),(132,105),(139,106),(143,109),
            (144,113),(140,111),(139,115),(136,110),(133,115),
            (132,110),(128,116),(128,111),(125,115),(125,110),
            (120,114),(120,119),(117,117),(117,113),(114,114)], 'hair0')
    q.line([(120,109),(125,107),(130,107)], 'hair2')
    q.line([(133,107),(136,108),(137,110)], 'hair1')
    q.line([(118,116),(119,119),(118,122)], 'hair1')
    q.line([(121,122),(123,124),(122,127)], 'hair1')


def arm_front(q):
    q.poly([(144,130),(148,132),(151,137),(155,140),(159,135),
            (160,131),(165,131),(168,134),(165,141),(161,149),
            (157,152),(152,152),(145,146),(140,140),(140,135)], 'skin2')
    q.poly([(145,132),(148,134),(148,139),(154,145),(157,145),
            (161,139),(163,134),(164,136),(160,146),(157,149),
            (153,148),(145,141),(143,137)], 'skin3', False)
    q.line([(144,139),(147,140),(150,143)], 'skin1')
    q.line([(151,149),(155,151),(158,150),(161,146)], 'skin0')
    q.line([(158,143),(161,137)], 'skin4')
    fist(q,160,122)


def fist(q,x,y):
    pts=[(0,2),(2,0),(5,0),(6,1),(9,1),(11,4),(12,7),
         (10,10),(7,12),(3,11),(1,9),(1,6),(-1,5)]
    q.poly([(x+a,y+b) for a,b in pts], 'skin3')
    q.poly([(x+1,y+6),(x+3,y+8),(x+7,y+9),(x+10,y+7),
            (x+9,y+10),(x+6,y+11),(x+3,y+10)], 'skin2', False)
    q.line([(x+2,y+2),(x+5,y+3),(x+6,y+5)], 'skin1')
    q.line([(x+1,y+5),(x+4,y+5),(x+5,y+7),(x+7,y+7)], 'skin0')
    q.line([(x+7,y+2),(x+8,y+4),(x+10,y+4)], 'skin1')
    q.dots([(x+3,y+1),(x+6,y+2),(x+9,y+3)], 'skin4')


def hat(q):
    q.poly([(115,105),(116,101),(120,97),(126,94),(134,94),
            (141,96),(146,100),(148,106),(146,109),(118,110)], 'straw2')
    q.poly([(119,102),(122,98),(128,95),(133,95),(139,97),
            (142,100),(141,103),(126,104)], 'straw3', False)
    q.poly([(128,96),(133,95),(139,97),(141,99),(135,98),
            (128,99),(121,102),(122,100)], 'straw4', False)
    q.poly([(116,103),(124,102),(133,101),(142,101),(146,103),
            (148,106),(139,107),(129,107),(118,109),(115,107)], 'red2')
    q.line([(119,104),(128,103),(138,103),(143,104)], 'red3')
    q.poly([(110,108),(116,106),(125,105),(137,104),(145,104),
            (151,106),(154,109),(152,111),(144,112),(133,111),
            (125,112),(116,114),(110,113),(107,111)], 'straw2')
    q.poly([(110,109),(117,108),(128,106),(140,105),(146,106),
            (151,108),(143,108),(132,108),(123,110),(114,112),
            (110,112)], 'straw3', False)
    q.line([(111,109),(119,107),(127,106),(139,105),(144,106)], 'straw4')
    q.line([(114,113),(126,111),(136,110),(146,110),(151,109)], 'straw0')
    q.dots([(120,100),(123,98),(126,97),(133,97),(137,98),
            (141,99),(143,101),(116,109),(121,108),(128,107),
            (133,106),(142,107),(148,108)], 'straw1')


def base(expression='grin', front_arm=True):
    q=Pixel()
    for layer in [leg_back,leg_front,arm_back,torso,shorts,sash]: layer(q)
    forearm_back(q)
    head(q,expression)
    if front_arm: arm_front(q)
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
    result=im.copy(); result.putdata([rgba.get(p,p) for p in im.getdata()])
    return result


def preview(im, rig=False, scale=4):
    crop=(80,84,182,234)
    bg=Image.new('RGBA',(256,256),'#202e3a');d=ImageDraw.Draw(bg)
    for y in range(80,240,8):
        for x in range(80,184,8):
            if (x//8+y//8)%2:d.rectangle((x,y,x+7,y+7),fill='#263744')
    bg.alpha_composite(im)
    if rig:
        d=ImageDraw.Draw(bg);d.line([(80,224),(181,224)],fill='#64cdbb')
        for x,y in RIG['points'].values():d.rectangle((x-1,y-1,x+1,y+1),fill='#f8da77')
        d.line([(124,224),(132,224)],fill='#ff6b80');d.line([(128,220),(128,228)],fill='#ff6b80')
    return bg.crop(crop).resize((102*scale,150*scale),Image.Resampling.NEAREST)


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
    preview(im).save(OUT/'base-preview-4x.png')
    preview(im,True).save(OUT/'rig-preview-4x.png')
    contact=Image.new('RGBA',(408*4,600),'#202e3a')
    for i,f in enumerate([*expressions,side]):contact.paste(preview(f),(408*i,0))
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
        'source':'scripts/build_luffy.py','sourceImages':[],
        'expressions':['grin','determined','surprise'],
        'pending':['idle animation','locomotion drawings','normals','defense',
                   'damage reactions','throws','specials','cinematic Super'],
        'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
    (OUT/'model.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest))


if __name__=='__main__':build()
