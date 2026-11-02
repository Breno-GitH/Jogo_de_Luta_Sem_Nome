"""Finish Samurai using the approved native-pixel articulated sprite pipeline.

Preserves all movement/normal PNGs. New action/reaction sheets, real sheathing
and floor poses, separate pixel FX and authored combat/lifecycle metadata.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import build_attacks as attacks
import build_movement as rig
from build_samurai import palette_swap, checker

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/sprites/samurai'
ART=ROOT/'art/samurai'


def p(grip=(145,165),angle=24,**kw):return {'grip':list(grip),'angle':angle,**kw}


def render(pose,ground=True):
    floor_cloth=pose.get('floorCloth',False)
    saved={name:rig.LAYERS[name] for name in ['tails','front']}
    try:
        if floor_cloth:
            for name in saved:rig.LAYERS[name]=Image.new('RGBA',(256,256))
        image,blade,hurt,offset=attacks.render(pose,False)
    finally:rig.LAYERS.update(saved)
    extra=pose.get('detail','')
    if extra in ['sheath','hidden']:
        # Remove ONLY this pose's katana, rather than painting over its blade.
        original=attacks.BLADE
        try:attacks.BLADE=Image.new('RGBA',(256,256));image,blade,hurt,offset=attacks.render(pose,False)
        finally:attacks.BLADE=original
    d=ImageDraw.Draw(image)
    if extra=='sheath':
        x=118+round(pose.get('x',0));y=169+round(pose.get('hip',0))
        d.line([(x,y),(x-36,y+24)],fill='#0c0d15',width=5)
        d.line([(x,y),(x-36,y+24)],fill='#202331',width=3)
        d.line([(x-1,y-1),(x-32,y+21)],fill='#444c62',width=1)
        d.line([(x,y),(x+11,y-7)],fill='#63342b',width=4)
        d.line([(x,y),(x+11,y-7)],fill='#ac7940',width=2)
        for i in [2,5,8]:d.point((x+i,y-round(i*.6)),fill='#e4d7bd')
        blade={'a':{'x':x-128,'y':y-224},'b':{'x':x-164,'y':y-200},'r':3}
    if extra=='wipe':
        x,y=pose['grip'];d.polygon([(x+14,y-4),(x+21,y-5),(x+22,y+3),(x+17,y+5)],fill='#cbb9a0')
        d.line([(x+16,y-3),(x+20,y-3),(x+20,y+2)],fill='#fff0d4',width=1)
    if extra=='challenge':
        transform=rig.rigid((128,167),pose.get('lean',0),(pose.get('x',0),pose.get('hip',0)))
        x,y=np.rint(rig.point(transform,pose.get('free',[146,148]))).astype(int)
        d.line([(x,y),(x+7,y-5)],fill='#0c0d15',width=3)
        d.line([(x,y),(x+6,y-5)],fill='#ffd0a0',width=1)
    if pose.get('backTurn'):
        # Rear panel/collar and overlapping hair occlude part of the face as he
        # turns away; no new face or palette is substituted.
        dx,dy=offset
        d.polygon([(118+dx,126+dy),(133+dx,130+dy),(143+dx,149+dy),(123+dx,166+dy),(109+dx,149+dy)],fill='#202331')
        d.line([(116+dx,130+dy),(124+dx,145+dy),(123+dx,162+dy)],fill='#303547',width=3)
        d.line([(126+dx,134+dy),(137+dx,148+dy)],fill='#444c62',width=1)
        d.line([(118+dx,127+dy),(131+dx,132+dy),(138+dx,141+dy)],fill='#89192b',width=2)
        d.line([(111+dx,148+dy),(120+dx,160+dy)],fill='#5c1325',width=2)
        d.polygon([(134+dx,112+dy),(140+dx,114+dy),(137+dx,123+dy),(133+dx,125+dy)],fill='#141621')
        d.line([(136+dx,114+dy),(135+dx,121+dy)],fill='#444c62',width=1)
    # Native-pixel acting, with the same face outline/hair/nose/jaw. Reactions
    # previously used the identical confident expression even during a K.O.
    expression=pose.get('expression','')
    if expression:
        dx,dy=offset
        def pixel(x,y,color):d.point((x+int(dx),y+int(dy)),fill=color)
        if expression in ['pain','closed']:
            for x,y,color in [(135,117,'#be7853'),(136,117,'#92513c'),(137,117,'#0c0d15'),
                              (135,118,'#92513c'),(136,118,'#63342b')]:pixel(x,y,color)
        if expression=='pain':
            for x,y,color in [(138,122,'#63342b'),(139,122,'#fff0d4'),(140,122,'#e4d7bd'),(139,123,'#92513c')]:pixel(x,y,color)
        elif expression=='closed':
            pixel(139,122,'#92513c');pixel(140,122,'#63342b')
    rotation=pose.get('roll',0)
    if rotation:
        transform=rig.rigid((128,185),rotation)
        image=rig.warp(image,transform)
        # Land articulated falling/getup poses on a single fixed floor line.
        # No centre-of-bounds normalization is used for airborne reactions.
        if ground:
            bounds=image.getbbox();shift=224-bounds[3]
            image=rig.warp(image,(np.eye(2),np.array([0,shift])))
            transform=(transform[0],transform[1]+np.array([0,shift]))
        hurt=[attacks.rect([rig.point(transform,(r['x']+128,r['y']+224)),rig.point(transform,(r['x']+r['w']+128,r['y']+224)),rig.point(transform,(r['x']+128,r['y']+r['h']+224)),rig.point(transform,(r['x']+r['w']+128,r['y']+r['h']+224))]) for r in hurt]
        for end in ['a','b']:
            xy=rig.point(transform,(blade[end]['x']+128,blade[end]['y']+224))
            blade[end]={'x':round(float(xy[0]-128),2),'y':round(float(xy[1]-224),2)}
    if floor_cloth:
        # Cloth settles along the floor instead of pinning a rotated body in
        # mid-air by the lowest coat tail. Reuse the original coloured pixels.
        cloth=rig.warp(rig.secondary(saved['tails'],pose.get('cloth',0),126),(np.diag([.85,.28]),np.array([5.75,174.24])))
        cloth.alpha_composite(image);image=cloth
    if ground:image.paste((0,0,0,0),(0,224,256,256))
    data=np.array(image);data[data[:,:,3]==0]=0
    return Image.fromarray(data),blade,hurt


def definitions():
    result={}
    def clip(key,label,poses,durations=None,loop=False,ground=True):
        result[key]={'label':label,'poses':poses,'durations':durations or [5]*len(poses),'loop':loop,'grounded':ground}
    clip('guardStand','Defesa em pé',[p((150,140+dy),-70,hip=dy,lean=-5,free=[137,144],cloth=i,hair=i%2) for i,dy in enumerate([0,-1,0,1])],[8]*4,True)
    clip('guardCrouch','Defesa agachada',[p((154,177+dy),-50,hip=22+dy,lean=-4,free=[137,149],cloth=i) for i,dy in enumerate([0,-1,0,1])],[8]*4,True)
    for posture,hip in [('Stand',0),('Crouch',22)]:
        clip('guardImpact'+posture,'Impacto na defesa '+posture.lower(),[
            p((148,142+hip),-72,hip=hip,lean=-11,x=-2,free=[136,145],cloth=-2),
            p((149,141+hip),-71,hip=hip,lean=-8,x=-1,free=[136,145],cloth=-1),
            p((150,140+hip),-70,hip=hip,lean=-5,free=[137,144])],[2,2,2])
    for name,label,leans in [('damageLight','Dano leve',[-5,-9,-5,-2]),('damageMedium','Dano médio',[-7,-15,-20,-11,-4]),
                            ('damageHeavy','Dano forte',[-9,-21,-29,-25,-15,-6])]:
        clip(name,label,[p((139+i,173),37+i*3,lean=lean,hip=min(6,i),free=[118,158],cloth=-i,hair=i) for i,lean in enumerate(leans)],[3]*len(leans))
    clip('damageCrouch','Dano agachado',[p((145,193),30,hip=22+i,lean=-7-i*3,free=[121,159],cloth=-i) for i in [0,2,3,1]],[4]*4)
    clip('damageAir','Dano aéreo',[p((142,166),45,lean=-10-i*3,left=[9,-12],right=[-4,-10],free=[119,157],cloth=-i,roll=-i*2) for i in [0,2,3,1]],[4]*4,False,False)
    clip('launched','Lançado para cima',[p((139,163),55,lean=-12-i*3,left=[10,-15],right=[-7,-12],free=[116,151],cloth=3+i,roll=-i*4) for i in [1,2,3,4]],[4]*4,False,False)
    clip('falling','Queda',[p((143,172),60,lean=-12,left=[6,-7],right=[-5,-5],free=[118,155],cloth=-i,roll=-i*5) for i in [2,3,4,5]],[4]*4,True,False)
    floor_pose={'hip':-3,'lean':-3,'left':[40,11],'right':[-25,10],'free':[126,156],'leftAngle':-5,'rightAngle':5,'floorCloth':True}
    clip('downed','Derrubado',[p((140,160+i%2),82,**{**floor_pose,'lean':-3-i*.35},cloth=i,roll=-90) for i in range(4)],[6]*4,True)
    getup=[]
    for i,(angle,hip) in enumerate([(-90,-3),(-73,4),(-48,12),(-23,15),(-8,7),(0,0)]):
        t=1-i/5
        getup.append(p((132+round(i*2.6),179-round(i*1.8)),82-i*10,hip=hip,lean=-3-i,free=[126-i,156+i],left=[round(40*t),round(11*t)],right=[round(-25*t),round(10*t)],cloth=i,roll=angle,floorCloth=i<2))
    clip('getup','Levantando',getup,[3]*6)
    clip('throw','Tentativa de agarrão',[p((140,172),30,lean=lean,x=x,free=hand,cloth=i) for i,(lean,x,hand) in enumerate([(0,0,[128,163]),(4,4,[144,150]),(9,8,[172,148]),(5,5,[151,155]),(0,0,[125,165])])],[3,2,2,12,16])
    clip('grabHold','Agarrando',[p((140,172),25,lean=lean,x=x,free=hand,cloth=i) for i,(lean,x,hand) in enumerate([(7,6,[169,147]),(10,8,[167,144]),(3,4,[157,139]),(-5,0,[148,141]),(13,9,[174,150]),(5,4,[149,161])])],[3,3,4,3,4,5])
    clip('grabbed','Sendo agarrado',[p((139,172),45,lean=lean,hip=i,free=[119,148],cloth=-i) for i,lean in enumerate([8,16,22,15,-10])],[4,4,4,4,6])
    clip('throwRecover','Agarrão: retorno',[p((142+i,170-i),30-i*2,lean=6-i*2,free=[125,162],cloth=3-i) for i in range(4)],[3]*4)
    clip('ko','Nocaute',[p((139-round(i*1.4),174+i),45+i*7,lean=-15+round(i*2.4),hip=-round(i*.6),left=[i*8,i*2],right=[-i*5,i*2],free=[116+i*2,156],cloth=-i,roll=angle,floorCloth=i>=3) for i,angle in enumerate([-8,-18,-35,-60,-85,-90])],[5,6,7,8,10,12])
    clip('defeat','Derrota',[p((140-i*.4,160+i*.2),82+i*.3,**{**floor_pose,'lean':-3-i*.15},cloth=3-i*.5,hair=0,roll=-90) for i in range(6)],[7]*6,False)
    entrance=[]
    steps=[([-5,0],[6,-5]),([-1,0],[2,-7]),([4,-3],[-3,0]),([8,-6],[-5,0]),([3,-4],[1,0]),([-3,0],[6,-2])]
    for i,(left,right) in enumerate(steps):entrance.append(p((122,168),25,lean=i%3-1,left=left,right=right,cloth=i%3,detail='sheath',free=[124,162]))
    entrance.extend([p((123,166),20,detail='sheath'),p((130,164),5,detail='sheath'),p((148,161),0,free=[124,162]),p((157,150),-25,free=[123,164]),p((150,159),12,two=True),p((145,165),24,two=True)])
    clip('entrance','Entrada: caminhar e desembainhar',entrance,[4]*10+[6,6])
    clip('taunt','Provocação',[p((140,178),50,lean=-3,free=hand,cloth=i%3,detail='challenge' if i in [2,3,4,5] else '') for i,hand in enumerate([[125,162],[140,149],[150,139],[155,142],[149,145],[155,140],[139,151],[125,165]])],[5,5,6,6,6,6,6,8])
    victory=[p((146,157),0,free=[148+i*4,151],detail='wipe',cloth=i%2) for i in range(4)]
    victory.extend([p((151,160),10,free=[128,164]),p((139,164),18,free=[125,166]),p((127,167),23,detail='sheath'),p((122,168),25,detail='sheath')])
    victory.extend(p((122,168),25,detail='sheath',backTurn=True,lean=-i,cloth=i%2,free=[123,166]) for i in range(4))
    clip('victory','Vitória: limpar, embainhar e virar',victory,[4]*4+[5]*4+[6]*4)
    clip('counterEntry','Contra-ataque: entrada',[p((150,152),-45,lean=-i,free=[137,146],cloth=-i) for i in [1,4,6]],[2]*3)
    clip('counterWait','Contra-ataque: espera',[p((152,145+dy),-65,hip=dy,lean=-6,free=[137,145],cloth=i,hair=i%2) for i,dy in enumerate([0,-1,0,1])],[5]*4,True)
    clip('counterFail','Contra-ataque: recuperação sem ativação',[p((150-i,148+i*5),-55+i*25,lean=-6+i*2,free=[130,158],cloth=3-i) for i in range(4)],[6]*4)
    counter=[p((150,145),-65,lean=-6,free=[137,145]),p((155,148),-30,lean=2,x=4,free=[125,162]),p((173,146),-3,lean=12,x=9,two=True,cloth=4),p((177,152),4,lean=14,x=10,two=True,cloth=3),p((158,160),17,lean=5,two=True),p(two=True)]
    clip('counter_strike','Contra-ataque bem-sucedido',counter,[2,2,2,2,7,9])
    result['counter_strike']['move']={'startup':4,'active':4,'recovery':16,'damage':110,'stun':32,'blockstun':17,'push':5,'launch':-4,'hitstop':11,'level':'mid','rank':4,'cancels':[],'kind':'counterStrike','drive':{'from':0,'to':4,'speed':9},'invulnerable':{'from':0,'to':8}}
    for index,strength in enumerate(['light','medium','heavy']):
        start=[7,10,14][index];active=[4,5,6][index];recovery=[18,24,32][index]
        drawposes=[p((121,170),30,hip=9,lean=3,detail='sheath',free=[122,167]),p((128,168),12,hip=6,lean=9,detail='sheath',free=[124,166]),
                   p((168+index*3,147),-2,lean=16+index*2,x=8+index*2,left=[7,0],right=[4,0],free=[120,163],cloth=5),
                   p((174+index*2,151),4,lean=13,x=7,left=[5,0],right=[3,0],free=[119,163],cloth=4),p((156,160),17,lean=5,cloth=2),p(two=True)]
        key='draw_'+strength;clip(key,'Saque Relâmpago — '+strength,drawposes,[start//2,start-start//2,active//2,active-active//2,recovery//2,recovery-recovery//2])
        result[key]['move']={'startup':start,'active':active,'recovery':recovery,'damage':[75,100,125][index],'stun':[25,30,35][index],'blockstun':[13,17,21][index],'push':[4,5,7][index],'launch':0,'hitstop':[8,10,12][index],'level':'mid','rank':4,'cancels':[],'kind':'draw','cost':0,'drive':{'from':[4,5,7][index],'to':[12,17,23][index],'speed':[10,13,16][index]}}
        start=[5,7,10][index];active=[5,6,7][index];recovery=[27,33,42][index]
        upposes=[p((144,190),15,hip=13,lean=-8,two=True),p((155,180),-15,hip=8,lean=0,two=True,cloth=-2),
                 p((168,146),-55,hip=-1,lean=11,x=5,left=[7,-4],right=[-3,-4],two=True,cloth=4),
                 p((164,125),-87,hip=-3,lean=13,x=4,left=[10,-9],right=[-4,-8],two=True,cloth=5),
                 p((159,134),-103,lean=7,left=[8,-6],right=[-3,-5],two=True,cloth=3),
                 p((150,155),-8,lean=2,two=True,cloth=1),p(two=True)]
        key='crescent_'+strength;clip(key,'Corte Crescente — '+strength,upposes,[start//2,start-start//2,active//2,active-active//2,recovery//3,recovery//3,recovery-2*(recovery//3)],ground=False)
        result[key]['move']={'startup':start,'active':active,'recovery':recovery,'damage':[90,115,140][index],'stun':[35,40,45][index],'blockstun':[17,21,25][index],'push':[3,4,5][index],'launch':[-12,-15,-17][index],'hitstop':[10,12,14][index],'level':'mid','rank':4,'cancels':[],'kind':'crescent','cost':0,'hopAt':start,'hopVelocity':[-8,-10,-12][index],'invulnerable':{'from':0,'to':[3,7,12][index],'upperOnly':index==0}}
    ultstart=[p((121,170),25,hip=8,detail='sheath',free=[122,164]),p((128,168),5,hip=7,lean=7,detail='sheath'),p((173,146),0,lean=17,x=10,left=[7,0],right=[4,0],two=True,cloth=5),p((177,151),5,lean=14,x=8,two=True,cloth=4),p((157,160),18,lean=5,two=True),p(two=True)]
    clip('ultimate_start','Mil Cortes: ativação e confirmação',ultstart,[5,5,2,1,16,19])
    result['ultimate_start']['move']={'startup':10,'active':3,'recovery':35,'damage':55,'stun':40,'blockstun':23,'push':0,'launch':0,'hitstop':12,'level':'mid','rank':5,'cancels':[],'kind':'ultimate','cost':100,'drive':{'from':5,'to':13,'speed':10},'invulnerable':{'from':0,'to':5}}
    rush=[]
    for i in range(12):rush.append(p((166+(i%3)*3,143+(i%4)*5),[-35,25,-12,40][i%4],lean=[10,-5,16,4][i%4],x=[6,-3,9,1][i%4],two=i%2==0,free=[117,156],cloth=(i%5)-2,hair=i%3))
    clip('ultimateRush','Mil Cortes: sequência',rush,[4]*12)
    clip('ultimateFinish','Mil Cortes: finalização',[p((141,130),-130,lean=-8,two=True),p((145,125),-100,lean=-12,two=True),p((169,144),-5,lean=16,x=9,two=True,cloth=5),p((178,154),9,lean=21,x=12,two=True,cloth=6),p((174,163),24,lean=14,x=8,two=True),p((154,165),24,lean=5,two=True)],[2,2,2,3,3,6])
    clip('ultimateRecover','Mil Cortes: retorno',[p((154-i*3,165),24,lean=6-i*2,two=True,cloth=3-i) for i in range(4)],[4,4,5,5])
    for key,definition in result.items():
        for pose in definition['poses']:
            if key.startswith('damage') or key in ['launched','falling','grabbed']:
                pose['expression']='pain'
            elif key in ['downed','ko','defeat']:
                pose['expression']='closed'
        definition['poses']=[attacks.normalize_pose(pose) for pose in definition['poses']]
    return result


def fx():
    names=['hit','guard','draw','crescent','counter','ultimate','power']
    meta={};sheet=Image.new('RGBA',(64*6,64*len(names)))
    for row,name in enumerate(names):
        for frame in range(6):
            image=Image.new('RGBA',(64,64));d=ImageDraw.Draw(image)
            radius=8+frame*4;color='#fff0d4' if name not in ['guard','counter'] else '#a7e4ee'
            if name in ['hit','guard','counter','power']:
                for ray in range(8):
                    a=ray*math.pi/4+.13*frame
                    x=32+round(math.cos(a)*radius);y=32+round(math.sin(a)*radius)
                    x2=32+round(math.cos(a)*(radius+7-frame));y2=32+round(math.sin(a)*(radius+7-frame))
                    d.line((x,y,x2,y2),fill=color,width=2)
                if name in ['counter','power']:d.ellipse((32-radius,32-radius,32+radius,32+radius),outline='#d83740' if name=='power' else '#deb65d',width=2)
            else:
                points=[]
                for k in range(12):
                    a=(-130+k*14+frame*12)*math.pi/180
                    points.append((32+round(math.cos(a)*(20+frame)),32+round(math.sin(a)*(20+frame))))
                d.line(points,fill='#89192b',width=5);d.line(points,fill=color,width=2)
                if name=='draw':d.line((5,31-frame,58,29-frame),fill='#fff0d4',width=2)
            sheet.paste(image,(frame*64,row*64))
        meta[name]={'row':row,'frames':6,'ticks':2,'width':64,'height':64}
    target=ROOT/'public/sprites/fx';target.mkdir(exist_ok=True)
    sheet.save(target/'samurai-fx.png');(ROOT/'src/data/fx.json').write_text(json.dumps(meta,indent=2)+'\n')


def build():
    # Lock the existing 90 frames before producing the completion layer.
    lock=ART/'normal-lock.json';old=json.loads((OUT/'attacks.json').read_text())
    names={'attacks.json'}
    for clip in old['clips'].values():names.update([clip['sheet'],clip['player2Sheet']])
    hashes={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in sorted(names)}
    if lock.exists() and json.loads(lock.read_text())!=hashes:raise ValueError('Approved normals changed')
    lock.write_text(json.dumps(hashes,indent=2)+'\n')
    defs=definitions();config_path=ROOT/'src/data/animations.json';config=json.loads(config_path.read_text());char_path=ROOT/'src/data/samurai.json';char=json.loads(char_path.read_text())
    manifest={'pivot':{'x':128,'y':224},'cell':[256,256],'clips':{}}
    reactions={}
    for name,definition in defs.items():
        frames=[];poses=[]
        durations=definition['durations']
        for i,pose in enumerate(definition['poses']):
            image,blade,hurt=render(pose,definition['grounded']);frames.append(image)
            move=definition.get('move');time=sum(durations[:i])
            phase='startup' if not move or time<move['startup'] else 'active' if time<move['startup']+move['active'] else 'recovery'
            poses.append({'ticks':durations[i],'phase':phase,'blade':blade,'hurtboxes':hurt})
            image.save(OUT/f'{name}-{i:02}.png')
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,frame in enumerate(frames):sheet.paste(frame,(i*256,0))
        sheet.save(OUT/f'{name}.png');palette_swap(sheet).save(OUT/f'{name}-p2.png')
        config['clips'][name]={'sheet':f'samurai/{name}.png','player2Sheet':f'samurai/{name}-p2.png','frames':list(range(len(frames))),'frameWidth':256,'frameHeight':256,'columns':len(frames),'pivot':{'x':128,'y':224},'scale':1,'ticks':durations[0],'durations':durations,'loop':definition['loop']}
        clip={k:v for k,v in definition.items() if k not in ['poses','move']};clip.update({'sheet':f'{name}.png','player2Sheet':f'{name}-p2.png','count':len(frames),'bounds':[frame.getbbox() for frame in frames]})
        clip['hurtboxes']=[pose['hurtboxes'] for pose in poses]
        reactions[name]={'loop':definition['loop'],'poses':[{'ticks':pose['ticks'],'hurtboxes':pose['hurtboxes']} for pose in poses]}
        if 'move' in definition:
            move=definition['move'];move.update({'poses':poses,'box':{'x':0,'y':-110,'w':100,'h':80}})
            char['moves'][name]=move;clip['combat']=move
        manifest['clips'][name]=clip
    # Grab has a hand-range collision, then runs a synchronized capture timeline.
    char['moves']['throw'].update({'startup':5,'active':2,'recovery':28,'kind':'grab','damage':120,'hitstop':7,'box':{'x':0,'y':-110,'w':62,'h':100}})
    char['reactions']=reactions
    manifest['clips']['throw']['combat']=char['moves']['throw']
    config_path.write_text(json.dumps(config,indent=2)+'\n');char_path.write_text(json.dumps(char,indent=2)+'\n')
    (OUT/'complete.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (ART/'complete-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
    fx()
    # A real atlas-based nearest-neighbour inspection sheet, never a painted
    # mock spritesheet. Every shown cell is the same PNG loaded by the game.
    names=['draw_heavy','crescent_heavy','counter_strike','ultimateRush','ultimateFinish','victory','downed']
    preview=Image.new('RGB',(256*6,276*len(names)), '#182331')
    draw=ImageDraw.Draw(preview)
    for row,name in enumerate(names):
        clip=manifest['clips'][name];sheet=Image.open(OUT/clip['sheet']).convert('RGBA')
        draw.text((8,row*276+3),clip['label'],fill='#e5b674')
        for column,index in enumerate(np.linspace(0,clip['count']-1,min(6,clip['count'])).astype(int)):
            cell=sheet.crop((index*256,0,(index+1)*256,256))
            tile=Image.new('RGBA',(256,256),'#66717f');tile.alpha_composite(cell)
            preview.paste(tile.convert('RGB'),(column*256,row*276+20))
    preview.resize((preview.width*2,preview.height*2),Image.Resampling.NEAREST).save(OUT/'complete-preview.png')
    print(json.dumps({'newClips':len(defs),'newFrames':sum(len(d['poses']) for d in defs.values()),'priorArtPreserved':True,'fx':7}))


if __name__=='__main__':build()
