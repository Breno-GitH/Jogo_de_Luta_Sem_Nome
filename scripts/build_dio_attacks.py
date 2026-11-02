"""Nine Dio normals + seven independent Stand action sheets.

Uses approved native-pixel painted rigs. Combat boxes are exported from the
actual warped fist/boot layer, never a sword or the owner's torso. No effects.
"""
from pathlib import Path
import json,math,hashlib,zipfile
import numpy as np
from PIL import Image,ImageDraw
from build_linked_movement import Rig,RIGS,rigid,point,warp

ROOT=Path(__file__).resolve().parents[1]

def p(**kw):return kw
def box(points,pad=0):
    a=np.array(points,float);lo=np.floor(a.min(axis=0)-pad).astype(int);hi=np.ceil(a.max(axis=0)+pad).astype(int)
    return {'x':int(lo[0]-128),'y':int(lo[1]-224),'w':max(1,int(hi[0]-lo[0])),'h':max(1,int(hi[1]-lo[1]))}

def fist(wrist):
    # Authored native-pixel closed hand; same skin ramp and jacket cuff.
    im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im);x,y=map(int,wrist)
    d.polygon([(x-2,y-3),(x+2,y-5),(x+6,y-5),(x+9,y-3),(x+10,y+1),(x+7,y+4),(x+1,y+4),(x-2,y+2)],fill='#0c0d15')
    d.polygon([(x-1,y-2),(x+3,y-4),(x+6,y-4),(x+8,y-2),(x+9,y+1),(x+6,y+3),(x+1,y+3)],fill='#be7853')
    d.polygon([(x,y-2),(x+3,y-3),(x+6,y-3),(x+8,y-1),(x+6,y+1),(x+1,y+1)],fill='#ffd0a0')
    d.line([(x+2,y-2),(x+7,y-2)],fill='#ffe3b8');d.line([(x+4,y),(x+4,y+2)],fill='#92513c')
    d.line([(x+7,y),(x+7,y+1)],fill='#92513c');d.line([(x-1,y+2),(x+2,y+2)],fill='#63342b')
    return im

def render(rig,pose,grounded):
    pose=dict(pose);t=rigid(rig.data['pivot'],pose.get('lean',0),(pose.get('x',0),pose.get('hip',0)))
    saved={}
    for side in ['near','far']:
        if side+'Target' in pose:pose[side+'Hand']=(np.array(pose[side+'Target'])-point(t,rig.data['arms'][side][2])).tolist()
        if side+'Kick' in pose:pose[side+'Foot']=(np.array(pose[side+'Kick'])-rig.data['legs'][side][2]).tolist()
        if side in pose.get('fists',[]):
            key=side+'hand';saved[key]=rig.layers[key];rig.layers[key]=fist(rig.data['arms'][side][2])
    try:
        image,anchors=rig.render(pose,grounded)
        surfaces={}
        for side in ['near','far']:
            for limb,part in [('hand','arms'),('boot','legs')]:
                rest=np.array(rig.data[part][side][2]);at=np.array(anchors[part][side][2])
                layer=warp(rig.layers[side+limb],rigid(rest,pose.get(side+('Wrist' if limb=='hand' else 'Toe'),0),at-rest))
                if grounded:layer.paste((0,0,0,0),(0,224,256,256))
                b=layer.getbbox()
                if b:surfaces[side+limb]=box([[b[0],b[1]],[b[2],b[3]]],1)
        dx,dy=anchors['headOffset'];head=rig.data['face']
        hurt=[box([[head[0]+dx-3,head[1]+dy-4],[head[2]+dx+2,head[3]+dy+3]]),
              box([point(t,v) for v in ([(116,119),(140,121),(142,150),(117,150)] if rig.name=='dio' else [(116,102),(145,104),(145,141),(118,141)])],2)]
        for part in ['legs','arms']:
            for side in ['near','far']:
                for a,b in zip(anchors[part][side],anchors[part][side][1:]):hurt.append(box([a,b],5 if part=='legs' else 4))
        if grounded:
            for r in hurt:r['h']=max(1,min(r['h'],-r['y']))
        return image,{'hurtboxes':hurt,'surfaces':surfaces,'anchors':anchors}
    finally:rig.layers.update(saved)

def definitions():
    d={};w={}
    def add(target,name,label,ticks,poses,phases=None,**stats):
        target[name]={'label':label,'durations':ticks,'poses':poses,'phases':phases or ['none']*len(poses),'stats':stats}
    base=dict(farFoot=[0,0]);air=dict(nearFoot=[8,-10],farFoot=[-5,-9])
    punch=[p(lean=-3,farTarget=[150,133],farWrist=-10,fists=['far']),
           p(lean=9,x=4,nearFoot=[3,0],farFoot=[2,3],farTarget=[172,128],farWrist=0,nearHand=[-3,-2],fists=['far'],cloth=2),
           p(lean=5,x=2,farTarget=[161,134],farWrist=3,fists=['far'],cloth=2),p(lean=0,farTarget=[153,144],farWrist=-5,fists=['far'],cloth=1)]
    add(d,'stand_light','Stand Light',[5,3,4,6],punch,['startup','active','recovery','recovery'],damage=45,stun=24,blockstun=11,push=1.4,launch=0,hitstop=6,level='mid',rank=1,cancels=['medium','heavy'],contact='farhand')
    kick=[p(lean=-4,hip=3,farKick=[147,190],farToe=-15,nearHand=[1,-3]),p(lean=-9,hip=2,farKick=[150,175],farToe=-20,farHand=[0,-5],cloth=-1),
          p(lean=-13,hip=2,farKick=[199,156],farToe=-12,nearHand=[-2,-6],farHand=[1,-9],cloth=3),
          p(lean=-7,hip=4,farKick=[175,177],farToe=-7,nearHand=[0,-4],cloth=2),p(lean=-1,hip=2,farFoot=[1,2],cloth=1)]
    add(d,'stand_medium','Stand Medium',[4,4,4,7,8],kick,['startup','startup','active','recovery','recovery'],damage=70,stun=32,blockstun=16,push=2.2,launch=0,hitstop=9,level='mid',rank=2,cancels=['heavy'],contact='farboot')
    command=[p(lean=-2,farHand=[1,-3],nearHand=[1,0]),p(lean=-4,farTarget=[147,127],farWrist=-35,nearHand=[2,-1],cloth=-1),
             p(lean=1,farTarget=[165,125],farWrist=-5,nearHand=[3,-2],cloth=2),p(lean=5,farTarget=[171,130],farWrist=0,nearHand=[4,-3],cloth=3),
             p(lean=2,farTarget=[158,135],farWrist=8,cloth=2),p(lean=0,farHand=[0,-1],cloth=1)]
    add(d,'stand_heavy','Stand Heavy',[5,7,6,6,8,12],command,['startup']*3+['active','recovery','recovery'],damage=110,stun=38,blockstun=22,push=5.5,launch=0,hitstop=12,level='mid',rank=3,cancels=[])
    low=[p(hip=29,lean=10,farTarget=[151,168],fists=['far']),p(hip=31,lean=20,x=3,nearFoot=[-3,0],farFoot=[4,5],farTarget=[175,185],farWrist=8,fists=['far'],cloth=2),
         p(hip=30,lean=13,farTarget=[161,179],farWrist=12,fists=['far'],cloth=1),p(hip=29,lean=6,farHand=[1,-6],farFoot=[4,5],fists=['far'])]
    add(d,'crouch_light','Crouch Light',[5,3,4,6],low,['startup','active','recovery','recovery'],damage=40,stun=24,blockstun=10,push=1.2,launch=0,hitstop=6,level='low',rank=1,cancels=['medium','heavy'],contact='farhand')
    sweep=[p(hip=27,lean=-4,farKick=[143,211],nearFoot=[-5,0],farToe=0),p(hip=29,lean=-8,farKick=[150,207],nearFoot=[-7,0],farHand=[0,-5],cloth=-1),
           p(hip=27,lean=-10,x=3,farKick=[196,215],nearFoot=[-8,0],farToe=-4,nearHand=[1,-6],cloth=3),
           p(hip=28,lean=-4,farKick=[177,216],farToe=-2,nearFoot=[-5,0],cloth=2),p(hip=29,lean=5,farFoot=[4,5],nearFoot=[-4,0],cloth=1)]
    add(d,'crouch_medium','Crouch Medium',[4,4,4,7,9],sweep,['startup','startup','active','recovery','recovery'],damage=65,stun=32,blockstun=15,push=2,launch=0,hitstop=8,level='low',rank=2,cancels=['heavy'],contact='farboot')
    launch=[p(hip=30,lean=2,farHand=[1,-6],nearHand=[0,-2],farFoot=[4,5]),p(hip=32,lean=-4,farTarget=[149,163],farWrist=-30,farFoot=[4,5],cloth=-2),
            p(hip=25,lean=4,farTarget=[162,153],farWrist=-45,nearHand=[1,-4],farFoot=[5,5],cloth=2),
            p(hip=18,lean=8,farTarget=[167,139],farWrist=-65,nearHand=[2,-7],farFoot=[5,5],cloth=3),
            p(hip=25,lean=5,farTarget=[158,159],farWrist=-25,farFoot=[4,5],cloth=2),p(hip=29,lean=5,farHand=[1,-6],farFoot=[4,5],cloth=1)]
    add(d,'crouch_heavy','Crouch Heavy',[4,6,7,6,8,13],launch,['startup']*3+['active','recovery','recovery'],damage=90,stun=48,blockstun=21,push=2,launch=-14,hitstop=11,level='mid',rank=3,cancels=['jump'])
    ap=[{**q,**air} for q in punch];ap[1]={**ap[1],'x':10,'farTarget':[178,128],'nearFoot':[12,-14],'farFoot':[-6,-10]}
    add(d,'air_light','Air Light',[4,3,4,6],ap,['startup','active','recovery','recovery'],damage=40,stun=31,blockstun=12,push=1,launch=-3,airHold=-3,hitstop=6,level='high',rank=1,cancels=['medium','heavy'],contact='farhand')
    ak=[p(lean=-5,nearFoot=[7,-10],farKick=[146,185],farToe=-10,nearHand=[-1,-5]),p(lean=-10,nearFoot=[10,-15],farKick=[153,172],farToe=-18,farHand=[1,-9],cloth=-1),
        p(lean=-14,nearFoot=[14,-16],farKick=[197,154],farToe=-10,nearHand=[-2,-8],farHand=[2,-11],cloth=3),
        p(lean=-8,nearFoot=[11,-14],farKick=[177,174],farToe=-5,cloth=2),p(lean=-1,**air,nearHand=[-1,-3],farHand=[1,-5],cloth=1)]
    add(d,'air_medium','Air Medium',[3,4,5,6,8],ak,['startup','startup','active','recovery','recovery'],damage=65,stun=35,blockstun=16,push=1.5,launch=-3,airHold=-2,hitstop=9,level='high',rank=2,cancels=['heavy'],contact='farboot')
    ah=[{**q,**air} for q in command];ah[2].update(farTarget=[165,119],farWrist=-20);ah[3].update(farTarget=[172,147],farWrist=25,lean=8,nearFoot=[13,-9],farFoot=[-6,-6])
    add(d,'air_heavy','Air Heavy',[4,5,5,6,7,12],ah,['startup']*3+['active','recovery','recovery'],damage=105,stun=38,blockstun=22,push=4.5,launch=12,airHold=3,knockdown=True,hitstop=13,level='high',rank=3,cancels=[])
    forward=[p(lean=3,nearHand=[1,-2],farHand=[1,-3],nearFoot=[2,-2]),p(lean=7,nearHand=[3,-5],farTarget=[162,118],nearFoot=[5,-5],farFoot=[-2,-2],cloth=1),
             p(lean=12,nearTarget=[133,111],farTarget=[165,111],nearFoot=[8,-9],farFoot=[-4,-5],cloth=2),p(lean=16,nearTarget=[137,109],farTarget=[168,108],nearFoot=[10,-12],farFoot=[-5,-7],cloth=3),
             p(lean=11,nearTarget=[134,112],farTarget=[169,112],nearFoot=[8,-8],farFoot=[-3,-4],cloth=1)]
    add(w,'forwardAttackMovement','Forward Attack Movement',[2,2,2,2,1],forward)
    quick=[p(lean=-3,farTarget=[154,119],farWrist=-15,nearHand=[1,-3]),p(lean=2,farTarget=[163,116],farWrist=-8,nearHand=[2,-4],cloth=-1),
           p(lean=13,x=3,farTarget=[183,119],farWrist=0,nearHand=[-2,-6],nearFoot=[3,-4],farFoot=[-1,-2],cloth=2),p(lean=4,farTarget=[163,124],farWrist=4,nearHand=[0,-3],cloth=1)]
    add(w,'quickPunch','Quick Punch',[2,2,3,5],quick,['startup','startup','active','recovery'])
    heavy=[p(lean=-9,nearTarget=[126,115],farTarget=[151,119],farWrist=-20,nearFoot=[1,-4],farFoot=[-1,-2]),p(lean=-14,nearTarget=[128,111],farTarget=[149,113],farWrist=-35,cloth=-2),
           p(lean=17,x=4,nearTarget=[128,119],farTarget=[187,116],farWrist=0,nearFoot=[6,-6],farFoot=[-3,-3],cloth=3),
           p(lean=22,x=7,nearTarget=[127,121],farTarget=[194,122],farWrist=3,nearFoot=[8,-8],farFoot=[-4,-4],cloth=4),
           p(lean=12,x=3,farTarget=[177,127],farWrist=8,nearHand=[-2,-4],nearFoot=[4,-4],cloth=2),p(lean=3,farTarget=[163,128],nearHand=[0,-2],cloth=1)]
    add(w,'heavyPunch','Heavy Punch',[2,2,3,3,4,4],heavy,['startup','startup','active','active','recovery','recovery'])
    upper=[p(hip=6,lean=-9,farTarget=[151,145],farWrist=20,nearHand=[1,-4],nearFoot=[2,-2],farFoot=[-1,-1]),
           p(hip=10,lean=-13,farTarget=[154,151],farWrist=12,nearHand=[2,-5],cloth=-2),
           p(hip=1,lean=12,x=3,farTarget=[177,116],farWrist=-65,nearTarget=[129,120],nearFoot=[5,-5],cloth=3),
           p(hip=-3,lean=19,x=5,farTarget=[172,88],farWrist=-85,nearTarget=[130,116],nearFoot=[8,-9],farFoot=[-4,-5],cloth=4),
           p(hip=-1,lean=9,farTarget=[164,103],farWrist=-75,nearHand=[2,-5],nearFoot=[4,-5],cloth=2),p(lean=1,farTarget=[160,121],farWrist=-20,nearHand=[1,-2],cloth=1)]
    add(w,'uppercut','Uppercut',[2,3,3,3,4,5],upper,['startup','startup','active','active','recovery','recovery'])
    down=[p(lean=-6,nearFoot=[6,-10],farFoot=[-4,-8],farTarget=[155,104],farWrist=-65,nearHand=[1,-6]),
          p(lean=-11,nearFoot=[9,-14],farFoot=[-5,-11],farTarget=[160,94],farWrist=-85,nearTarget=[129,112],cloth=-2),
          p(lean=13,x=3,nearFoot=[9,-11],farFoot=[-4,-7],farTarget=[183,144],farWrist=45,nearTarget=[129,117],cloth=3),
          p(lean=23,x=5,nearFoot=[7,-6],farFoot=[-2,-3],farTarget=[181,167],farWrist=70,nearTarget=[130,121],cloth=4),
          p(lean=13,nearFoot=[5,-5],farFoot=[-2,-3],farTarget=[171,150],farWrist=40,nearHand=[1,-5],cloth=2),
          p(lean=4,nearFoot=[3,-4],farFoot=[-1,-2],farTarget=[161,132],farWrist=12,nearHand=[1,-3],cloth=1)]
    add(w,'downwardPunch','Downward Punch',[3,2,3,3,4,5],down,['startup','startup','active','active','recovery','recovery'])
    recovery=[p(lean=9,nearHand=[2,-4],farTarget=[169,126],nearFoot=[4,-5],farFoot=[-2,-3],cloth=2),p(lean=5,nearHand=[1,-3],farTarget=[165,127],nearFoot=[3,-4],farFoot=[-2,-2],cloth=1),
              p(lean=2,nearHand=[0,-2],farTarget=[162,128],nearFoot=[2,-2],farFoot=[-1,-1],cloth=-1),p(lean=0,nearHand=[1,-1],farHand=[0,-1],nearFoot=[1,-1],cloth=0)]
    add(w,'attackRecovery','Attack Recovery',[2]*4,recovery)
    returning=[p(lean=-10,farTarget=[162,120],nearTarget=[126,121],nearFoot=[8,-10],farFoot=[-4,-7],cloth=-3),
               p(lean=-7,farHand=[1,-4],nearHand=[2,-4],nearFoot=[6,-8],farFoot=[-3,-5],cloth=-2),
               p(lean=-3,farHand=[1,-3],nearHand=[1,-3],nearFoot=[4,-5],farFoot=[-2,-3],cloth=-1),
               p(hip=1,lean=1,farHand=[0,-2],nearHand=[0,-1],nearFoot=[2,-2],farFoot=[-1,-1],cloth=1),p(lean=0,farHand=[-1,-1],nearHand=[1,0],nearFoot=[1,-1],farFoot=[0,0],cloth=0)]
    add(w,'returnBehind','Return Behind Dio',[3,3,3,3,4],returning)
    return d,w

def export(name,defs):
    rig=Rig(name);out=ROOT/f'public/sprites/{name}';config_file=ROOT/f'src/data/{name}-animations.json';config=json.loads(config_file.read_text())
    if name=='the-world':
        # The locomotion cut overlaps a little of the original fist. A fully
        # extended punch exposed those pixels as a second floating knuckle.
        for key,limit in [('farupper',154),('farfore',161)]:
            a=np.array(rig.layers[key]);a[:,limit+1:]=0;rig.layers[key]=Image.fromarray(a)
    manifest={'id':name,'cell':[256,256],'pivot':{'x':128,'y':224},'clips':{}}
    for key,definition in defs.items():
        frames=[];geometry=[];ground=name=='dio' and not key.startswith('air_')
        for i,pose in enumerate(definition['poses']):
            image,g=render(rig,pose,ground);frames.append(image);image.save(out/f'{key}-{i:02}.png')
            contact=definition['stats'].get('contact','farhand' if name=='the-world' else None)
            active=definition['phases'][i]=='active'
            geometry.append({'ticks':definition['durations'][i],'phase':definition['phases'][i],
              'hitboxes':[g['surfaces'][contact]] if active and contact else [],'hurtboxes':g['hurtboxes'],'surfaces':g['surfaces'],'anchors':g['anchors']})
        if len({f.tobytes() for f in frames})!=len(frames):raise ValueError(f'{name}/{key}: duplicate art')
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
        sheet.save(out/f'{key}.png')
        config['clips'][key]={'sheet':f'{name}/{key}.png','columns':len(frames),'frames':list(range(len(frames))),'ticks':definition['durations'][0],'durations':definition['durations'],'loop':False}
        manifest['clips'][key]={'label':definition['label'],'sheet':f'{key}.png','count':len(frames),'durations':definition['durations'],'loop':False,'grounded':ground,'poses':geometry,'bounds':[f.getbbox() for f in frames]}
        preview=Image.new('RGBA',sheet.size,'#596674')
        for i,f in enumerate(frames):preview.alpha_composite(f,(i*256,0))
        preview.resize((sheet.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
    config_file.write_text(json.dumps(config,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'attacks.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/f'art/{name}/attack-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
    return manifest

def build():
    lock=ROOT/'art/dio/normal-source-lock.json'
    if not lock.exists():
        files={}
        for name in ['dio','the-world']:
            for file in (ROOT/f'public/sprites/{name}').glob('*.png'):files[f'{name}/{file.name}']=hashlib.sha256(file.read_bytes()).hexdigest()
        lock.write_text(json.dumps(files,indent=2)+'\n')
    else:
        for file,digest in json.loads(lock.read_text()).items():
            if hashlib.sha256((ROOT/'public/sprites'/file).read_bytes()).hexdigest()!=digest:raise ValueError(f'Approved movement changed: {file}')
    dio,world=definitions();dm=export('dio',dio);wm=export('the-world',world)
    companion={'neutral':{'x':-30,'y':-18},'returnTicks':16,'quickReturnTicks':12,'actions':wm['clips']}
    character={'id':'dio','name':'Dio Brando','health':1000,'speed':3,'jump':-15.5,'gravity':.7,'airChaseSpeed':6,'airChaseTicks':12,
      'moves':{},'companion':companion,'hurtboxes':{'standing':[{'x':-8,'y':-119,'w':20,'h':23},{'x':-25,'y':-101,'w':49,'h':55},{'x':-29,'y':-51,'w':62,'h':51}],
       'crouching':[{'x':-8,'y':-90,'w':25,'h':24},{'x':-27,'y':-72,'w':57,'h':43},{'x':-42,'y':-34,'w':84,'h':34}],
       'air':[{'x':-8,'y':-117,'w':20,'h':23},{'x':-25,'y':-99,'w':49,'h':55},{'x':-27,'y':-48,'w':58,'h':44}]}}
    timelines={
      'stand_light':{'optional':True,'approachAt':0,'approachTicks':5,'punchAt':1,'recoverAt':13,'returnAt':21,'returnTicks':12,'front':{'x':10,'y':-6},'clip':'quickPunch'},
      'air_light':{'optional':True,'approachAt':0,'approachTicks':4,'punchAt':0,'recoverAt':12,'returnAt':20,'returnTicks':12,'front':{'x':10,'y':-6},'clip':'quickPunch'},
      'stand_heavy':{'approachAt':5,'approachTicks':9,'punchAt':14,'recoverAt':32,'returnAt':40,'returnTicks':16,'front':{'x':60,'y':-6},'clip':'heavyPunch'},
      'crouch_heavy':{'approachAt':4,'approachTicks':8,'punchAt':12,'recoverAt':32,'returnAt':40,'returnTicks':16,'front':{'x':36,'y':-6},'clip':'uppercut'},
      'air_heavy':{'approachAt':3,'approachTicks':6,'punchAt':9,'recoverAt':29,'returnAt':37,'returnTicks':16,'front':{'x':48,'y':-10},'clip':'downwardPunch'},
    }
    for key,definition in dio.items():
        stats={k:v for k,v in definition['stats'].items() if k!='contact'}
        stats.update({phase:sum(t for t,p in zip(definition['durations'],definition['phases']) if p==phase) for phase in ['startup','active','recovery']})
        stats['poses']=[{k:v for k,v in p.items() if k in ['ticks','phase','hitboxes','hurtboxes']} for p in dm['clips'][key]['poses']]
        stats['box']={'x':0,'y':-100,'w':1,'h':1}
        if key in timelines:stats['stand']=timelines[key]
        character['moves'][key]=stats;dm['clips'][key]['combat']=stats
    # Provisional OWN-pose reactions keep Dio recognizable until reaction art is authored.
    config_file=ROOT/'src/data/dio-animations.json';config=json.loads(config_file.read_text())
    for alias,source,index in [('guardStand','idle',1),('guardCrouch','crouchIdle',0),('guardImpactStand','backdash',1),('guardImpactCrouch','crouchIdle',1),('damageLight','backdash',1),('damageMedium','backdash',2),('damageHeavy','backdash',3),('damageCrouch','crouchIdle',1),('damageAir','jumpFall',1),('launched','jumpRise',1),('falling','jumpFall',1),('downed','crouchIdle',1),('getup','crouchEnd',0),('entrance','walkForward',0),('victory','idle',2),('ko','crouchIdle',1),('defeat','crouchIdle',1),('grabbed','backdash',2)]:
        config['clips'][alias]={**config['clips'][source],'frames':[index],'durations':[12],'ticks':12,'loop':True}
    config_file.write_text(json.dumps(config,indent=2)+'\n');(ROOT/'public/sprites/dio/animations.json').write_text(json.dumps(config,indent=2)+'\n')
    movement=json.loads((ROOT/'src/data/dio-movement.json').read_text())
    character['speed']=movement['walkSpeed']
    character['locomotion']={k:movement[k] for k in ['backSpeed','airSpeed','jumpStartup','landingTicks','dashForward','backdash']}
    (ROOT/'src/data/dio.json').write_text(json.dumps(character,indent=2)+'\n')
    (ROOT/'public/sprites/dio/attacks.json').write_text(json.dumps(dm,indent=2)+'\n')
    print(json.dumps({'dioNormals':9,'dioFrames':45,'standActions':7,'standFrames':37,'bodyAndStandGeometry':'separate native fist/boot surfaces'}))

if __name__=='__main__':
    # The former physical-attack recipe is retained only as production history.
    from build_stand_normals import build as build_current
    build_current()
