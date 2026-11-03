"""Draw the movement cels in native pixels using Luffy's own model and pose keys."""
import json
from math import hypot
from PIL import Image, ImageDraw
from build_luffy import ART, OUT, ROOT, Pixel, base, swap
from luffy_drawing import back_hat, head, torso, sash

# Foot positions are sole contacts. Knee positions are authored independently;
# the leading/trailing foot switches roles at each half-cycle.
NEUTRAL = ((104, 224), (152, 224), (114, 189), (153, 188))
FORWARD = [
    ((108,224),(151,224),(116,191),(145,189),0,1,3),
    ((118,219),(138,224),(123,188),(142,192),2,3,4),
    ((141,213),(125,224),(143,184),(133,190),-1,1,3),
    ((146,224),(112,224),(141,189),(122,191),0,1,2),
    ((133,224),(122,218),(138,192),(128,185),2,3,3),
    ((120,224),(146,213),(128,190),(150,184),-1,1,3),
]
BACK = [
    ((107,224),(151,224),(120,191),(149,190),1,-3,-4),
    ((118,224),(145,217),(128,193),(147,186),3,-4,-5),
    ((128,224),(112,215),(136,190),(128,185),0,-4,-5),
    ((139,224),(106,224),(144,191),(119,190),1,-3,-4),
    ((133,219),(117,224),(137,188),(128,193),3,-4,-5),
    ((113,216),(128,224),(123,184),(137,190),0,-4,-5),
]

# (feet, knees, hip height, hip shift, shoulder lean, arm gesture)
def key(back, front, knee_back, knee_front, depth=0, shift=0, lean=0, arms=0):
    return back, front, knee_back, knee_front, depth, shift, lean, arms


def grounded(depth, bend, lean=0, shift=0, arms=0):
    return key(*NEUTRAL[:2], (114+bend,189+depth//2),
               (153+bend,188+depth//2), depth, shift, lean, arms)


DASH = [
    grounded(9,5,7,-3,-2),
    key((100,224),(145,223),(114,195),(148,185),5,0,13,-6),
    key((105,218),(157,214),(114,187),(165,183),1,1,17,-9),
    key((118,219),(164,224),(133,183),(161,194),7,4,11,-4),
    grounded(4,3,4,2,1),
]
BACKDASH = [
    grounded(8,4,-4,3,3),
    key((110,217),(159,224),(123,186),(155,193),5,-2,-11,5),
    key((100,214),(151,218),(114,184),(153,186),1,-2,-14,8),
    key((101,224),(145,219),(114,194),(151,187),8,-4,-9,5),
    grounded(4,3,-4,-2,2),
]
CROUCH = [
    grounded(18,10,7,-4,5),
    grounded(34,13,13,-8,10),
    grounded(35,13,13,-8,11),
    grounded(36,13,14,-8,10),
    grounded(26,12,10,-6,8),
    grounded(9,6,4,-3,3),
]
JUMP = [
    grounded(9,6,5,-3,3),
    grounded(19,11,10,-5,5),
    key((107,224),(152,222),(113,189),(150,186),-2,0,3,-5),
    key((108,221),(148,214),(116,188),(155,182),-3,0,3,-9),
    key((113,211),(151,197),(107,177),(155,165),-1,0,8,-12),
    key((112,210),(150,192),(110,176),(156,163),2,-2,6,-13),
    key((109,213),(151,204),(113,182),(160,174),1,-2,4,-8),
    key((106,221),(151,220),(115,188),(153,188),0,0,2,-3),
    grounded(3,2,3,0,0),
    grounded(16,10,8,-4,4),
    grounded(6,4,4,-2,2),
]


class Offset:
    """Place the model's drawn facial clusters and vest on each keyed torso."""
    def __init__(self, target, dx, dy, lean=0):
        self.target, self.dx, self.dy, self.lean = target, dx, dy, lean

    def shift(self, points):
        return [(x+self.dx+round(self.lean*(163-y)/34), y+self.dy) for x,y in points]

    def poly(self, points, *args):
        self.target.poly(self.shift(points), *args)

    def line(self, points, *args):
        self.target.line(self.shift(points), *args)

    def dots(self, points, *args):
        self.target.dots(self.shift(points), *args)


def edges(path, widths, factors=(1,-1)):
    points = [[], []]
    for i, ((x,y), width) in enumerate(zip(path, widths)):
        before, after = path[max(0,i-1)], path[min(len(path)-1,i+1)]
        dx, dy = after[0]-before[0], after[1]-before[1]
        length = max(1, hypot(dx,dy))
        for j, factor in enumerate(factors):
            points[j].append((round(x-dy/length*width*factor),
                              round(y+dx/length*width*factor)))
    return points[0] + points[1][::-1]


def leg(q, hip, knee, sole, near):
    sx, sy = sole
    ankle = (sx,sy-7)
    cuff = (round((hip[0]+4*knee[0])/5), round((hip[1]+4*knee[1])/5))
    q.poly(edges([cuff,knee,ankle],[6,5,3]), 'skin3' if near else 'skin2')
    q.poly(edges([knee,ankle],[3,2], (1,0)), 'skin2' if near else 'skin1', False)
    q.poly([(sx-3,sy-10),(sx+3,sy-10),(sx+4,sy-6),(sx+9,sy-4),
            (sx+14,sy-3),(sx+15,sy-1),(sx-6,sy-1),(sx-6,sy-4)], 'skin2')
    q.line([(sx-5,sy-2),(sx+13,sy-2)], 'sole2')
    q.line([(sx-5,sy-1),(sx+14,sy-1)], 'sole0')
    q.line([(sx-2,sy-6),(sx+3,sy-4),(sx+9,sy-4)], 'ink', 2)
    q.line([(sx+5,sy-6),(sx+6,sy-4)], 'ink')
    q.dots([(sx+10,sy-3),(sx+12,sy-3)], 'skin4')
    q.poly(edges([hip,cuff,knee],[10,10,8]), 'blue2' if near else 'blue1')
    q.poly(edges([hip,cuff],[6,7], (0.6,-0.3)), 'blue3' if near else 'blue2', False)
    q.line([(hip[0]+2,hip[1]+4),(cuff[0]+3,cuff[1]-1)], 'blue4' if near else 'blue3')
    q.poly(edges([cuff,knee],[9,8]), 'cloth1' if near else 'cloth0')
    q.line(edges([cuff,knee],[8,7])[:2], 'cloth2' if near else 'cloth1', 2)
    q.dots([(knee[0]-2,knee[1]),(knee[0]+2,knee[1]-1)], 'cloth2')


def arm(q, shoulder, elbow, wrist, open_hand, near):
    wx, wy = wrist
    q.poly(edges([shoulder,elbow,wrist],[5,4,3]), 'skin2' if near else 'skin1')
    q.poly(edges([shoulder,elbow,wrist],[4,2,1], (0,-1)), 'skin3' if near else 'skin2', False)
    q.line([(elbow[0]-1,elbow[1]),(elbow[0]+1,elbow[1]+1)], 'skin1')
    if open_hand:
        hand = [(-2,3),(-3,-1),(0,-5),(2,-8),(4,-7),(3,-4),
                (8,-8),(10,-7),(8,-4),(13,-6),(14,-4),(9,-1),
                (13,-2),(13,0),(8,3),(4,4),(2,5)]
    else:
        hand = [(-3,2),(-3,-3),(0,-5),(4,-6),(7,-4),(8,0),(5,4),(0,5)]
    q.poly([(wx+x,wy+y) for x,y in hand], 'skin3' if near else 'skin2')
    q.line([(wx+1,wy-2),(wx+4,wy),(wx+7,wy-1)], 'skin1')
    q.dots([(wx+3,wy-3)], 'skin4')


def draw(pose):
    back, front, kb, kf, depth, shift, lean, gesture = pose
    q = Pixel()
    body = Offset(q, shift, depth, lean)
    back_hat(body)
    leg(q, (121+shift,165+depth), kb, back, False)
    leg(q, (137+shift,166+depth), kf, front, True)
    arm(q, (121+shift+lean,137+depth),(113+shift+lean+gesture,151+depth),
        (125+shift+lean+gesture,155+depth+gesture//3),False,False)
    torso(body)
    sash(Offset(q, shift, depth, lean//2 - gesture//3))
    arm(q, (147+shift+lean,137+depth),(154+shift+lean-gesture//2,156+depth-gesture//2),
        (167+shift+lean+gesture//2,151+depth-gesture),True,True)
    head(Offset(q, shift+lean, depth))
    return q.im


def walk(cycle):
    return [draw((*pose, (0,-4,-7,0,4,7)[i])) for i,pose in enumerate(cycle)]


def build():
    idle = []
    # Idle shares the same original contour drawing with subtle independent
    # chest, head and hand adjustments. Use the articulated poses for travel.
    from luffy_drawing import legs, shorts, rear_arm, lead_arm
    for breath, hand, tilt in [(0,0,0),(0,-1,0),(-1,-1,0),
                               (-2,-2,1),(-1,-1,1),(0,0,1)]:
        q = Pixel()
        back_hat(Offset(q,0,breath))
        legs(q)
        shorts(q)
        torso(Offset(q,0,breath,tilt))
        sash(q)
        rear_arm(Offset(q,0,breath))
        lead_arm(Offset(q,tilt,hand))
        head(Offset(q,tilt,breath))
        idle.append(q.im)
    frames = idle + walk(FORWARD) + walk(BACK) + [draw(p) for p in DASH+BACKDASH+CROUCH+JUMP]
    meta = json.loads((ROOT/'src/data/luffy-animations.json').read_text())
    assert len(frames)==45 and len({im.tobytes() for im in frames})==45
    assert frames[0].tobytes() == base().tobytes()
    atlas = Image.new('RGBA',(2048,1536))
    alt = atlas.copy()
    for i,im in enumerate(frames):
        box = im.getbbox()
        assert box and min(box[0],box[1],256-box[2],256-box[3]) >= 16, (i,box)
        assert set(im.getchannel('A').tobytes()) == {0,255}
        origin = ((i%8)*256,(i//8)*256)
        atlas.paste(im,origin)
        alt.paste(swap(im),origin)
    atlas.save(OUT/'movement.png')
    alt.save(OUT/'movement-p2.png')
    contact = Image.new('RGBA',(6*152,13*153),'#202e3a')
    guide = ImageDraw.Draw(contact)
    animation, durations = [], []
    for row,(name,clip) in enumerate(meta['clips'].items()):
        if name == 'base':
            break
        for col,(index,hold) in enumerate(zip(clip['frames'],clip['durations'])):
            x,y = col*152,row*153
            guide.line((x,y+139,x+151,y+139),fill='#64cdbb')
            contact.alpha_composite(frames[index].crop((57,85,209,229)),(x,y))
            guide.point((x+71,y+139),fill='#ffcc73')
            guide.text((x+6,y+141),f'{name} {col+1}',fill='#f3e9da')
            panel = Image.new('RGBA',(152,161),'#202e3a')
            panel.alpha_composite(frames[index].crop((57,85,209,229)))
            ImageDraw.Draw(panel).text((8,144),name,fill='#f3e9da')
            animation.append(panel.resize((304,322),Image.Resampling.NEAREST).convert('RGB'))
            durations.append(max(55,round(hold*1000/60)))
        durations[-1] += 260
    contact.save(OUT/'movement-contact.png')
    animation[0].save(OUT/'movement-preview.gif',save_all=True,append_images=animation[1:],
                      duration=durations,loop=0,disposal=2)
    model_path = OUT/'model.json'
    model = json.loads(model_path.read_text())
    model.update(stage='movement', drawings=45, pending=['normals','defense',
                 'damage reactions','throws','specials','cinematic Super'])
    model_path.write_text(json.dumps(model,indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__':
    build()

