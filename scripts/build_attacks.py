"""Nine normal attacks: native-pixel articulated poses and matching combat data.

No effects, smears or re-generation of the approved character. Body/face/cloth
come from the approved base; independent arm IK and a rigid katana supply the
attack silhouettes. Generated combat geometry is independent of PNG loading.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import build_movement as rig
from build_samurai import palette_swap, checker

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/samurai'
OUT=ROOT/'public/sprites/samurai'
BASE=rig.BASE


def cut(image,points):
    data=np.array(image);data[~rig.polygon(points)]=0
    return Image.fromarray(data)


UPPER=cut(BASE,[(103,127),(113,128),(120,139),(123,146),(120,153),(113,148),(107,140)])
FORE=cut(BASE,[(115,141),(123,143),(130,150),(134,157),(133,164),(127,165),(121,157),(116,151)])
HAND=cut(BASE,[(130,164),(137,164),(139,168),(136,172),(130,171),(129,167)])
BLADE=cut(rig.LAYERS['weapon'],[(149,170),(157,172),(212,199),(212,207),(149,180)])
HEAD=rig.LAYERS['head']
OLD_GUARD=rig.polygon([(126,159),(148,158),(154,172),(149,177),(128,175)])


def bare_torso():
    original=rig.LAYERS['body'].copy()
    data=np.array(original)
    clear=rig.polygon([(102,126),(114,127),(122,139),(134,150),(138,164),(128,168),(117,159),(108,148),(103,137)])
    clear|=rig.polygon([(138,140),(149,140),(151,157),(149,168),(138,166),(136,154)])
    clear|=OLD_GUARD
    data[clear]=0
    under=Image.new('RGBA',(256,256));d=ImageDraw.Draw(under)
    d.polygon([(111,130),(126,129),(143,139),(144,166),(124,171),(111,157)],fill='#202331')
    d.polygon([(126,133),(138,142),(130,160),(121,164),(117,154)],fill='#303547')
    d.line([(122,132),(130,144),(123,160)],fill='#444c62',width=2)
    under.alpha_composite(Image.fromarray(data))
    return under


TORSO=bare_torso()


def elbow(shoulder,hand,a,b,outward):
    shoulder=np.array(shoulder,float);hand=np.array(hand,float)
    vector=hand-shoulder;distance=max(.1,np.linalg.norm(vector))
    scale=max(1,distance/(a+b-.5));a*=scale;b*=scale
    direction=vector/distance;run=(a*a-b*b+distance*distance)/(2*distance)
    height=math.sqrt(max(0,a*a-run*run))
    normal=np.array([-direction[1],direction[0]])
    choices=[shoulder+direction*run+normal*height,shoulder+direction*run-normal*height]
    return min(choices,key=lambda p:np.linalg.norm(p-np.array(outward)))


def normalize_pose(source):
    """Keep both arms inside anatomical reach instead of stretching the bones.

    The rear arm used a fixed foreshortened 27px length even for full extension.
    Use a 41px reach and move unreachable grips/free hands, preserving the face,
    limb thickness and the rigid length of the blade. Export these solved poses.
    """
    p=rig.normalize_legs(source)
    def clamp(value,center,radius):
        v=np.array(value,float)-center
        return center+v*min(1,radius/max(.001,np.linalg.norm(v)))
    transform=rig.rigid((128,167),p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    direction=np.array([math.cos(math.radians(p['angle'])),math.sin(math.radians(p['angle']))])
    far=rig.point(transform,(141,140));near=rig.point(transform,(110,132))
    grip=np.array(p['grip'],float)
    for _ in range(12):
        grip=clamp(grip,far,40.5)
        if p.get('two'):grip=clamp(grip,near+direction*7,42.5)
    p['grip']=grip.tolist();p['farReach']=41
    free=clamp(p.get('free',[124,165]),np.array([110,132]),42.5)
    p['free']=free.tolist()
    return p


def arm(shoulder,hand,hint,far=False):
    # Sample the same painted skin and gauntlet ramps for both arms.
    shoulder=np.array(shoulder,float);hand=np.array(hand,float)
    # Retain perspective foreshortening when the rear hand is close to the
    # shoulder. A full 41px chain folded there creates a protruding elbow.
    length=max(27,min(41,float(np.linalg.norm(hand-shoulder))+.5))
    joint=elbow(shoulder,hand,length*20/41 if far else 21,length*21/41 if far else 22,hint)
    image=Image.new('RGBA',(256,256))
    image.alpha_composite(rig.warp(UPPER,rig.bone((110,132),(120,148),shoulder,joint)))
    d=ImageDraw.Draw(image);x,y=np.rint(joint).astype(int)
    d.ellipse((x-3,y-3,x+3,y+3),fill='#92513c')
    d.ellipse((x-2,y-2,x+2,y+2),fill='#e7a776')
    image.alpha_composite(rig.warp(FORE,rig.bone((120,148),(132,163),joint,hand)))
    return image,[(shoulder.tolist(),joint.tolist()),(joint.tolist(),hand.tolist())]


def rect(points,padding=0):
    points=np.array(points,float)
    lo=np.floor(points.min(axis=0)-padding).astype(int);hi=np.ceil(points.max(axis=0)+padding).astype(int)
    return {'x':int(lo[0]-128),'y':int(lo[1]-224),'w':max(1,int(hi[0]-lo[0])),'h':max(1,int(hi[1]-lo[1]))}


def render(p,grounded):
    # Reuse the leg/hip/cloth solver without the old guard's arms and weapon.
    originals=rig.LAYERS.copy()
    try:
        for name,image in originals.items():
            if name=='head':continue
            data=np.array(image);data[OLD_GUARD]=0;rig.LAYERS[name]=Image.fromarray(data)
        rig.LAYERS['body']=TORSO
        rig.LAYERS['weapon']=Image.new('RGBA',(256,256))
        cell=rig.pose(p)
    finally:
        rig.LAYERS.update(originals)
    transform=rig.rigid((128,167),p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    grip=np.array(p['grip'],float)
    angle=math.radians(p['angle']);direction=np.array([math.cos(angle),math.sin(angle)])
    near_hand=grip-direction*7 if p.get('two',False) else rig.point(transform,p.get('free',[124,165]))
    far_shoulder=rig.point(transform,(141,140));near_shoulder=rig.point(transform,(110,132))
    far,far_bones=arm(far_shoulder,grip,grip+[4,16],True)
    near,near_bones=arm(near_shoulder,near_hand,near_hand+[-12,10])
    cell.alpha_composite(far);cell.alpha_composite(near)
    sword=rig.rigid((151,175),p['angle']-math.degrees(math.atan2(27,57)),grip-np.array([151,175]))
    cell.alpha_composite(rig.warp(BLADE,sword))
    for hand in ([near_hand,grip] if p.get('two',False) else [near_hand,grip]):
        hand_transform=rig.rigid((134,168),p['angle']-25 if np.linalg.norm(hand-grip)<10 else 0,hand-np.array([134,168]))
        cell.alpha_composite(rig.warp(HAND,hand_transform))
    # Restore the rigid face in front of any over-shoulder windup.
    head_offset=np.rint(rig.point(transform,(130,125))-np.array([130,125]))
    cell.alpha_composite(rig.warp(rig.secondary(HEAD,p.get('hair',0),125),(np.eye(2),head_offset)))
    if grounded:cell.paste((0,0,0,0),(0,224,256,256))
    data=np.array(cell);data[data[:,:,3]==0]=0;cell=Image.fromarray(data)
    a=rig.point(sword,(155,177));b=rig.point(sword,(208,202))
    blade={'a':{'x':round(float(a[0]-128),2),'y':round(float(a[1]-224),2)},
           'b':{'x':round(float(b[0]-128),2),'y':round(float(b[1]-224),2)},'r':3}
    hurt=[rect([[123+head_offset[0],109+head_offset[1]],[144+head_offset[0],128+head_offset[1]]]),
          rect([rig.point(transform,v) for v in [(111,131),(141,132),(145,167),(117,171)]],1)]
    for shoulder,knee0,ankle0,side in [((125,170),(100,195),(89,216),'left'),((132,173),(151,195),(159,215),'right')]:
        hip=rig.point(transform,shoulder);ankle=np.array(ankle0)+np.array(p.get(side,[0,0]))
        if side=='right':ankle[1]+=2
        joint=rig.knee(hip,ankle,np.linalg.norm(np.array(knee0)-shoulder),np.linalg.norm(np.array(ankle0)-knee0),knee0,side)
        box=rect([hip,joint,ankle],7)
        box['h']=min(box['h'], -box['y'] if grounded else box['h'])
        hurt.append(box)
    for bones in [near_bones,far_bones]:
        hurt.extend(rect([a,b],4) for a,b in bones)
    return cell,blade,hurt,head_offset.astype(int).tolist()


def specs():
    def p(grip,angle,**kw):return {'grip':grip,'angle':angle,**kw}
    out={}
    def add(name,label,durations,phases,poses,**stats):out[name]={'label':label,'durations':durations,'phases':phases,'poses':poses,**stats}
    add('stand_light','Stand Light',[5,3,4,6],['startup','active','recovery','recovery'],[
        p([146,151],-65,lean=-3,x=0,free=[123,165]),
        p([161,148],-2,lean=6,x=8,left=[5,0],right=[4,0],cloth=2,free=[119,165]),
        p([158,154],12,lean=4,x=5,left=[3,0],right=[2,0],cloth=3,free=[120,166]),
        p([145,165],24,lean=0,cloth=1)],damage=45,stun=20,blockstun=11,push=2.5,launch=0,hitstop=6,level='mid',rank=1,cancels=['medium','heavy','special'])
    add('stand_medium','Stand Medium',[4,4,4,7,9],['startup','startup','active','recovery','recovery'],[
        p([143,174],40,lean=-7,hip=2,free=[122,163]),
        p([151,181],18,lean=-4,hip=4,cloth=-2,free=[120,165]),
        p([170,155],-25,lean=13,x=10,left=[7,0],right=[5,0],cloth=3,free=[115,164]),
        p([160,131],-88,lean=9,x=6,left=[4,0],right=[2,0],cloth=4,free=[116,162]),
        p([145,165],24,lean=1,cloth=1)],damage=75,stun=28,blockstun=15,push=3.5,launch=0,hitstop=9,level='mid',rank=2,cancels=['heavy','special'])
    add('stand_heavy','Stand Heavy',[5,7,3,2,9,14],['startup','startup','active','active','recovery','recovery'],[
        p([137,141],-145,lean=-8,two=True,cloth=-1),
        p([138,133],-110,lean=-13,hip=3,two=True,cloth=-3),
        p([170,144],-5,lean=15,x=12,left=[9,0],right=[6,0],two=True,cloth=4,hair=2),
        p([175,151],6,lean=19,x=14,left=[10,0],right=[8,0],two=True,cloth=5,hair=3),
        p([167,159],20,lean=9,x=7,left=[5,0],right=[3,0],two=True,cloth=3),
        p([145,165],24,lean=0,two=True,cloth=1)],damage=115,stun=35,blockstun=19,push=7,launch=0,hitstop=12,level='mid',rank=3,cancels=['special'])
    add('crouch_light','Crouch Light',[5,3,4,7],['startup','active','recovery','recovery'],[
        p([145,195],18,hip=21,lean=2,free=[124,165]),
        p([161,193],-4,hip=22,lean=9,x=6,left=[3,0],right=[3,0],cloth=2,free=[121,164]),
        p([157,196],5,hip=23,lean=6,x=3,left=[1,0],right=[2,0],cloth=3,free=[122,165]),
        p([145,185],17,hip=21,lean=6,cloth=0,hair=-1)],damage=40,stun=20,blockstun=10,push=2,launch=0,hitstop=6,level='low',rank=1,cancels=['medium','heavy','special'])
    add('crouch_medium','Crouch Medium',[4,4,4,7,9],['startup','startup','active','recovery','recovery'],[
        p([144,188],-8,hip=21,lean=0,free=[122,164]),
        p([137,191],0,hip=23,lean=-4,cloth=-1,free=[121,165]),
        p([179,192],0,hip=19,lean=16,x=12,left=[9,0],right=[7,0],cloth=4,free=[116,164]),
        p([173,192],2,hip=21,lean=10,x=7,left=[5,0],right=[4,0],cloth=3,free=[119,164]),
        p([145,185],17,hip=22,lean=7,cloth=1)],damage=65,stun=28,blockstun=14,push=3,launch=0,hitstop=8,level='low',rank=2,cancels=['heavy','special'])
    add('crouch_heavy','Crouch Heavy',[5,6,3,2,9,15],['startup','startup','active','active','recovery','recovery'],[
        p([143,199],15,hip=22,lean=-5,two=True,cloth=-1),
        p([149,201],5,hip=24,lean=-7,two=True,cloth=-3),
        p([166,181],-20,hip=12,lean=10,x=7,left=[5,0],right=[4,0],two=True,cloth=4),
        p([168,145],-80,hip=-2,lean=14,x=9,left=[6,0],right=[5,0],two=True,cloth=5,hair=2),
        p([161,133],-95,hip=0,lean=7,x=4,left=[3,0],right=[2,0],two=True,cloth=3),
        p([147,184],20,hip=20,lean=5,two=True,cloth=1)],damage=95,stun=44,blockstun=18,push=2.5,launch=-13,hitstop=11,level='mid',rank=3,cancels=['jump','special'])
    air={'left':[8,-9],'right':[-4,-10]}
    add('air_light','Air Light',[4,4,4,5],['startup','active','recovery','recovery'],[
        p([146,151],-65,lean=-3,**air),
        p([160,146],-8,lean=6,x=6,left=[12,-9],right=[1,-10],cloth=2,free=[119,164]),
        p([155,152],14,lean=4,x=3,left=[10,-8],right=[-1,-9],cloth=3,free=[120,165]),
        p([145,165],24,lean=1,cloth=1,**air)],damage=40,stun=27,blockstun=12,push=1.5,launch=-3,hitstop=6,level='high',rank=1,cancels=['medium','heavy'],airHold=-3)
    add('air_medium','Air Medium',[3,4,5,6,7],['startup','startup','active','recovery','recovery'],[
        p([139,135],-150,lean=-9,two=True,**air),
        p([141,133],-115,lean=-12,two=True,cloth=-2,**air),
        p([174,146],-2,lean=13,x=10,left=[15,-8],right=[4,-9],two=True,cloth=4),
        p([171,156],18,lean=10,x=7,left=[12,-7],right=[1,-8],two=True,cloth=3),
        p([145,165],24,lean=1,two=True,cloth=1,**air)],damage=65,stun=31,blockstun=15,push=2,launch=-3,hitstop=9,level='high',rank=2,cancels=['heavy'],airHold=-2)
    add('air_heavy','Air Heavy',[4,6,3,2,7,13],['startup','startup','active','active','recovery','recovery'],[
        p([143,124],-115,lean=-5,two=True,**air),
        p([151,118],-85,lean=-8,hip=-2,two=True,cloth=-3,**air),
        p([172,150],25,lean=13,x=9,left=[9,-5],right=[0,-7],two=True,cloth=4),
        p([167,167],67,lean=18,x=8,left=[8,-2],right=[0,-3],two=True,cloth=5),
        p([160,173],44,lean=11,x=3,left=[5,-2],right=[-2,-3],two=True,cloth=3),
        p([145,163],23,lean=2,left=[3,-1],right=[-1,-2],two=True,cloth=1)],damage=105,stun=35,blockstun=20,push=5,launch=12,hitstop=13,level='high',rank=3,cancels=[],airHold=4,knockdown=True)
    for definition in out.values():definition['poses']=[normalize_pose(p) for p in definition['poses']]
    return out


def preserve_previous():
    lock=ART/'movement-lock.json'
    movement=json.loads((OUT/'movement.json').read_text())
    files={'base.png','idle.png','idle-p2.png','movement.json'}
    for clip in movement['clips'].values():files.update([clip['sheet'],clip['player2Sheet']])
    digests={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in sorted(files)}
    if lock.exists() and json.loads(lock.read_text())!=digests:raise ValueError('Approved movement assets changed')
    lock.write_text(json.dumps(digests,indent=2)+'\n')


def build():
    preserve_previous()
    config_path=ROOT/'src/data/animations.json';config=json.loads(config_path.read_text())
    character_path=ROOT/'src/data/samurai.json';character=json.loads(character_path.read_text())
    definitions=specs();(ART/'attack-rig.json').write_text(json.dumps(definitions,indent=2)+'\n')
    manifest={'pivot':{'x':128,'y':224},'cell':[256,256],'clips':{}}
    rows=[]
    for name,definition in definitions.items():
        grounded=not name.startswith('air_');frames=[];poses=[];offsets=[]
        for i,p in enumerate(definition['poses']):
            image,blade,hurt,offset=render(p,grounded);frames.append(image);offsets.append(offset)
            poses.append({'ticks':definition['durations'][i],'phase':definition['phases'][i],'blade':blade,'hurtboxes':hurt})
            image.save(OUT/f'{name}-{i:02}.png')
        if len({f.crop(f.getbbox()).tobytes() for f in frames})!=len(frames):raise ValueError(f'Duplicate pose in {name}')
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,frame in enumerate(frames):sheet.paste(frame,(256*i,0))
        sheet.save(OUT/f'{name}.png');palette_swap(sheet).save(OUT/f'{name}-p2.png')
        config['clips'][name]={'sheet':f'samurai/{name}.png','player2Sheet':f'samurai/{name}-p2.png','frameWidth':256,'frameHeight':256,
                              'columns':len(frames),'pivot':{'x':128,'y':224},'scale':1,'frames':list(range(len(frames))),
                              'ticks':definition['durations'][0],'durations':definition['durations'],'loop':False}
        move=character['moves'][name]
        for key in ['damage','stun','blockstun','push','launch','hitstop','level','rank','cancels','airHold','knockdown']:
            if key in definition:move[key]=definition[key]
            elif key in ['airHold','knockdown']:move.pop(key,None)
        move['startup']=sum(p['ticks'] for p in poses if p['phase']=='startup')
        move['active']=sum(p['ticks'] for p in poses if p['phase']=='active')
        move['recovery']=sum(p['ticks'] for p in poses if p['phase']=='recovery')
        move['poses']=poses
        manifest['clips'][name]={'label':definition['label'],'sheet':f'{name}.png','player2Sheet':f'{name}-p2.png','durations':definition['durations'],
            'loop':False,'count':len(frames),'grounded':grounded,'bounds':[f.getbbox() for f in frames],'headOffsets':offsets,
            'combat':move}
        row=Image.new('RGBA',(256*len(frames),256))
        for i,frame in enumerate(frames):
            tile=checker((256,256));tile.alpha_composite(frame);row.paste(tile,(256*i,0))
        row.resize((row.width*2,512),Image.Resampling.NEAREST).save(OUT/f'{name}-preview.png');rows.append((name,row))
    # Reuse recognizable poses for unfinished reactions instead of reverting to
    # the geometric prototype. These are explicitly not new reaction animations.
    for alias,source,index in [('hitstun','backdash',2),('blockstun','backdash',1),('ko','crouchIdle',1),
                               ('walk','walkForward',0),('crouch','crouchIdle',0),('air','jumpRise',0),('dash','dashForward',0),('attack','stand_heavy',2)]:
        config['clips'][alias]={**config['clips'][source],'frames':[index],'durations':[12],'ticks':12,'loop':True}
    config.update({'sheet':'samurai/idle.png','frameWidth':256,'frameHeight':256,'pivot':{'x':128,'y':224},'scale':1})
    config_path.write_text(json.dumps(config,indent=2)+'\n');character_path.write_text(json.dumps(character,indent=2)+'\n')
    character['hurtboxes']={'standing':[{'x':-5,'y':-115,'w':22,'h':23},{'x':-23,'y':-96,'w':46,'h':44},{'x':-42,'y':-55,'w':84,'h':55}],
                          'crouching':[{'x':-8,'y':-92,'w':29,'h':25},{'x':-25,'y':-69,'w':55,'h':40},{'x':-48,'y':-34,'w':96,'h':34}],
                          'air':[{'x':-5,'y':-115,'w':22,'h':23},{'x':-23,'y':-96,'w':46,'h':44},{'x':-34,'y':-55,'w':70,'h':48}]}
    character_path.write_text(json.dumps(character,indent=2)+'\n')
    (OUT/'attacks.json').write_text(json.dumps(manifest,indent=2)+'\n')
    overview=Image.new('RGBA',(1536,280*len(rows)),'#162130');draw=ImageDraw.Draw(overview)
    for i,(name,row) in enumerate(rows):draw.text((8,i*280+5),name,fill='#e7b777');overview.paste(row,(0,i*280+24))
    overview.save(OUT/'attacks-overview.png')
    print(json.dumps({'attacks':len(definitions),'frames':sum(len(d['poses']) for d in definitions.values()),'previousAssetsPreserved':True}))


if __name__=='__main__':build()
