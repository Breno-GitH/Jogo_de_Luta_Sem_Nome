"""Dio commands; The World alone attacks. Native painted rigs, binary RGBA.

Locomotion v2 and Samurai are locked before the first export. Every transition
variant starts at the actual previous pose and blends joint targets to the new
windup. Hit surfaces are the transformed closed fists, not Dio or a sword.
"""
from pathlib import Path
import json,hashlib,shutil,zipfile,math
import numpy as np
from PIL import Image,ImageDraw
from revise_dio_movement import AnatomicalRig,interpolate,dio_specs
from build_linked_movement import rigid,point,warp

ROOT=Path(__file__).resolve().parents[1]
NAMES=['stand_light','stand_medium','stand_heavy','crouch_light','crouch_medium','crouch_heavy','air_light','air_medium','air_heavy']

def protect():
    lock=ROOT/'art/dio/stand-only-preservation.json'
    if not lock.exists():
        files={}
        for name in ['dio','the-world']:
            out=ROOT/f'public/sprites/{name}';movement=json.loads((out/'movement.json').read_text())
            for c in movement['clips'].values():
                for file in [c['sheet']]+[c['sheet'].replace('.png',f'-{i:02}.png') for i in range(c['count'])]:
                    files[f'{name}/{file}']=hashlib.sha256((out/file).read_bytes()).hexdigest()
            for file in ['base.png','movement.json','palette.json']:
                files[f'{name}/{file}']=hashlib.sha256((out/file).read_bytes()).hexdigest()
        for file in (ROOT/'public/sprites/samurai').glob('*.png'):files[f'samurai/{file.name}']=hashlib.sha256(file.read_bytes()).hexdigest()
        lock.write_text(json.dumps(files,indent=2)+'\n')
        for name in ['dio','the-world']:
            out=ROOT/f'public/sprites/{name}';archive=ROOT/f'public/sprites/previous-body-attacks/{name}';archive.mkdir(parents=True,exist_ok=True)
            manifest=json.loads((out/'attacks.json').read_text())
            for key,c in manifest['clips'].items():
                for f in [c['sheet']]+[f'{key}-{i:02}.png' for i in range(c['count'])]:shutil.copy2(out/f,archive/f)
            shutil.copy2(out/'attacks.json',archive/'attacks.json')
    for file,digest in json.loads(lock.read_text()).items():
        if hashlib.sha256((ROOT/'public/sprites'/file).read_bytes()).hexdigest()!=digest:raise ValueError(f'Approved movement/Samurai changed: {file}')

def metal_fist(at):
    im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im);x,y=map(round,at)
    d.polygon([(x-4,y-4),(x,y-7),(x+6,y-7),(x+11,y-3),(x+12,y+2),(x+8,y+6),(x,y+6),(x-4,y+2)],fill='#3e2b13')
    d.polygon([(x-3,y-3),(x,y-6),(x+6,y-6),(x+10,y-2),(x+10,y+2),(x+7,y+5),(x,y+5),(x-3,y+1)],fill='#b47c18')
    d.polygon([(x-1,y-4),(x+2,y-5),(x+6,y-5),(x+9,y-2),(x+7,y+1),(x,y+1)],fill='#f4c944')
    d.line([(x,y-4),(x+6,y-4),(x+8,y-2)],fill='#ffe36c')
    for dx in [2,5,8]:d.line([(x+dx,y-1),(x+dx,y+2)],fill='#8e5b16')
    d.polygon([(x-2,y+1),(x+1,y),(x+4,y+2),(x+3,y+4),(x,y+4)],fill='#d9a523')
    d.line([(x-2,y+2),(x+1,y+1),(x+3,y+2)],fill='#ffe36c');d.point((x+7,y+4),fill='#664116')
    return im

def pointing_hand(at):
    im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im);x,y=map(round,at)
    d.polygon([(x-3,y-3),(x+2,y-5),(x+12,y-5),(x+14,y-3),(x+13,y-1),(x+7,y-1),(x+7,y+3),(x+3,y+5),(x-2,y+3)],fill='#63342b')
    d.polygon([(x-2,y-2),(x+2,y-4),(x+12,y-4),(x+13,y-3),(x+11,y-2),(x+5,y-2),(x+6,y+2),(x+3,y+4),(x-1,y+2)],fill='#e7a776')
    d.line([(x+2,y-3),(x+11,y-3)],fill='#ffe3b8');d.line([(x,y-1),(x+3,y-2)],fill='#ffd0a0')
    d.line([(x+3,y),(x+5,y+1)],fill='#92513c');d.point((x+1,y+2),fill='#be7853')
    return im

class AttackRig(AnatomicalRig):
    def __init__(self,name):
        super().__init__(name)
        if name=='the-world':
            for side in ['far','near']:self.layers[side+'hand']=metal_fist(self.data['arms'][side][2])
            a=np.array(self.layers['farfore']);a[:,160:]=0;self.layers['farfore']=Image.fromarray(a)
            y,x=np.mgrid[:256,:256]
            for key,region in [('nearupper',(x>=109)&(y>=117)),('nearfore',(x>=110)&(y>=121))]:
                a=np.array(self.layers[key]);a[region]=0;self.layers[key]=Image.fromarray(a)

def box(points,pad=0):
    a=np.array(points);lo=np.floor(a.min(axis=0)-pad).astype(int);hi=np.ceil(a.max(axis=0)+pad).astype(int)
    return dict(x=int(lo[0]-128),y=int(lo[1]-224),w=max(1,int(hi[0]-lo[0])),h=max(1,int(hi[1]-lo[1])))

def render(rig,p,grounded):
    p=dict(p);t=rigid(rig.data['pivot'],p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    # A deeply folded two-bone limb also has a minimum reachable radius. The
    # original solver only capped extension; honour the inner radius without
    # stretching a shin or changing any approved locomotion renderer.
    for kind,field in [('legs','Ankle'),('arms','Target')]:
        for side in ['near','far']:
            a,b,c=map(np.array,rig.data[kind][side]);origin=point(t,a)
            target=np.array(p.get(side+field,c if kind=='legs' else point(t,c)),float)
            radius=abs(np.linalg.norm(b-a)-np.linalg.norm(c-b))+.1
            vector=target-origin;length=float(np.linalg.norm(vector))
            if length<radius:
                vector=vector/max(length,.001) if length>.001 else np.array([1.,0.])
                p[side+field]=(origin+vector*radius).tolist()
    saved=rig.layers.get('farhand')
    if p.get('pointing'):rig.layers['farhand']=pointing_hand(rig.data['arms']['far'][2])
    try:
        im,anchors=rig.render(p,grounded);surfaces={}
        for side in ['far','near']:
            wrist=np.array(rig.data['arms'][side][2]);actual=np.array(anchors['arms'][side][2])
            layer=warp(rig.layers[side+'hand'],rigid(wrist,p.get(side+'Wrist',0),actual-wrist))
            b=layer.getbbox()
            surfaces[side]=box([[b[0],b[1]],[b[2],b[3]]],0)
        x,y=anchors['headOffset'];f=rig.data['face']
        hurt=[box([[f[0]+x-2,f[1]+y-3],[f[2]+x+2,f[3]+y+3]])]
        hurt.append(box([point(t,q) for q in ([(116,120),(140,120),(141,151),(117,151)] if rig.name=='dio' else [(116,102),(144,104),(145,141),(118,141)])],2))
        for kind in ['arms','legs']:
            for side in ['far','near']:
                for a,b in zip(anchors[kind][side],anchors[kind][side][1:]):hurt.append(box([a,b],5 if kind=='legs' else 4))
        if grounded:
            for h in hurt:h['h']=max(1,min(h['h'],-h['y']))
        return im,dict(anchors=anchors,hurtboxes=hurt,surfaces=surfaces)
    finally:rig.layers['farhand']=saved

def world_definitions():
    out={}
    # Accept overrides without duplicate keyword arguments.
    def p(**kw):
        pose={**dict(nearAnkle=[101,198],farAnkle=[144,193],nearTarget=[115,124],farTarget=[152,122],support=[]),**kw}
        t=rigid((132,137),pose.get('lean',0),(pose.get('x',0),pose.get('hip',0)))
        for side,knee in [('near',[111,172]),('far',[149,170])]:pose.setdefault(side+'Knee',(point(t,knee)+[12,-2]).tolist())
        return pose
    def add(key,label,poses,times,contacts=None):out[key]=dict(label=label,poses=poses,durations=times,contacts=contacts or {})
    add('forwardAttackMovement','Attack Forward Movement',[
        p(lean=-1,hip=1,nearTarget=[117,124],farTarget=[150,121]),p(lean=3,nearTarget=[120,122],farTarget=[150,119],cloth=-1),
        p(lean=7,hip=-1,nearAnkle=[104,194],farAnkle=[141,190],nearTarget=[123,121],farTarget=[149,117],cloth=-2),
        p(lean=5,nearAnkle=[103,195],farAnkle=[142,191],nearTarget=[121,122],farTarget=[151,119],cloth=-1),p(lean=1,nearTarget=[118,123],farTarget=[152,122],cloth=1)], [1]*5)
    add('quickPunch','Quick Punch',[
        p(lean=-2,farTarget=[149,122],nearTarget=[117,123]),p(lean=-4,farTarget=[147,119],farWrist=-6,nearTarget=[120,122],cloth=-1),
        p(lean=7,x=1,farTarget=[169,120],nearTarget=[120,121],nearAnkle=[103,196],farAnkle=[143,192],cloth=1),
        p(lean=13,x=3,hip=3,farTarget=[184,136],nearTarget=[117,125],farWrist=0,nearAnkle=[106,193],farAnkle=[142,190],cloth=2),
        p(lean=7,x=1,farTarget=[168,124],nearTarget=[118,123],farWrist=4,nearAnkle=[103,196],cloth=1),p(lean=1,farTarget=[154,122],nearTarget=[116,124],cloth=-1)], [2,2,2,3,4,4],{3:('far',0)})
    add('straightPunch','Straight Punch',[
        p(lean=-3,nearTarget=[120,120],farTarget=[150,120]),p(lean=-8,x=-2,nearTarget=[124,118],farTarget=[146,115],cloth=-2),
        p(lean=3,nearTarget=[126,119],farTarget=[161,116],nearAnkle=[103,195],cloth=-1),
        p(lean=16,x=5,nearTarget=[124,121],farTarget=[189,120],nearAnkle=[108,192],farAnkle=[142,189],cloth=3),
        p(lean=20,x=7,nearTarget=[121,124],farTarget=[194,124],nearAnkle=[110,191],farAnkle=[141,189],cloth=4),
        p(lean=11,x=2,nearTarget=[119,122],farTarget=[170,124],nearAnkle=[105,195],cloth=2),p(lean=2,farTarget=[155,123],nearTarget=[117,123],cloth=-1)], [2,2,3,3,3,4,5],{3:('far',0),4:('far',0)})
    add('heavyPunch','Heavy Punch',[
        p(lean=-3,hip=2,nearTarget=[120,123],farTarget=[150,122]),p(lean=-10,hip=5,x=-2,nearTarget=[124,119],farTarget=[146,115],cloth=-2),
        p(lean=-15,hip=5,x=-3,nearTarget=[128,117],farTarget=[143,111],nearAnkle=[99,196],farAnkle=[144,194],cloth=-3),
        p(lean=7,x=3,nearTarget=[131,119],farTarget=[173,115],nearAnkle=[106,193],farAnkle=[142,190],cloth=1),
        p(lean=23,x=10,hip=-1,nearTarget=[127,124],farTarget=[201,121],nearAnkle=[113,189],farAnkle=[141,187],cloth=5),
        p(lean=28,x=12,nearTarget=[125,127],farTarget=[204,128],nearAnkle=[115,191],farAnkle=[140,189],cloth=4),
        p(lean=15,x=4,nearTarget=[119,123],farTarget=[177,128],nearAnkle=[107,195],farAnkle=[142,192],cloth=2),p(lean=3,farTarget=[157,124],nearTarget=[116,124],cloth=-1)], [3,3,3,3,3,3,6,7],{4:('far',0),5:('far',0)})
    low=dict(hip=49,lean=17,nearAnkle=[123,204],farAnkle=[147,199],nearKnee=[166,188],farKnee=[176,185],nearTarget=[135,165],farTarget=[156,170])
    def lp(**kw):return p(**{**low,**kw})
    add('lowPunch','Low Punch',[
        p(hip=16,lean=5,nearAnkle=[110,199],farAnkle=[145,195],nearTarget=[122,139],farTarget=[152,140]),
        lp(hip=39,lean=12,farTarget=[151,164],cloth=-2),lp(hip=51,lean=17,farTarget=[161,185],nearTarget=[137,166],cloth=-1),
        lp(hip=54,lean=23,x=3,farTarget=[184,193],nearTarget=[136,169],farWrist=8,cloth=3),
        lp(hip=49,lean=17,farTarget=[166,180],farWrist=4,cloth=1),lp(hip=36,lean=9,nearAnkle=[116,200],farAnkle=[145,196],nearTarget=[128,153],farTarget=[154,157],cloth=-1)], [2,2,2,3,4,4],{3:('far',0)})
    add('lowSweep','Low Sweep',[
        p(hip=17,lean=6,nearAnkle=[112,200],farAnkle=[145,196],nearTarget=[123,142],farTarget=[152,143]),
        lp(hip=42,lean=16,farTarget=[148,172],nearTarget=[135,159],cloth=-2),lp(hip=55,lean=26,farTarget=[154,194],nearTarget=[139,170],cloth=-2),
        lp(hip=57,lean=31,x=3,farTarget=[173,202],farWrist=12,nearTarget=[139,173],cloth=3),
        lp(hip=56,lean=35,x=5,farTarget=[195,197],farWrist=0,nearTarget=[138,171],cloth=4),
        lp(hip=46,lean=22,farTarget=[167,184],nearTarget=[134,164],cloth=2),lp(hip=32,lean=11,nearAnkle=[116,200],farAnkle=[145,196],nearTarget=[127,151],farTarget=[154,154],cloth=-1)], [3,3,3,3,3,5,6],{3:('far',0),4:('far',0)})
    add('uppercut','Uppercut',[
        p(hip=11,lean=-3,nearAnkle=[109,197],farAnkle=[145,194],nearTarget=[122,133],farTarget=[151,139]),
        p(hip=25,lean=-9,nearAnkle=[115,199],farAnkle=[145,195],nearTarget=[128,145],farTarget=[149,160],nearKnee=[165,182],farKnee=[174,180],cloth=-2),
        p(hip=24,lean=-12,nearAnkle=[114,199],farAnkle=[145,195],nearTarget=[130,144],farTarget=[150,166],cloth=-3),
        p(hip=9,lean=6,x=2,nearAnkle=[110,189],farAnkle=[142,186],nearTarget=[129,129],farTarget=[179,132],farWrist=-35,cloth=2),
        p(hip=-4,lean=19,x=5,nearAnkle=[112,184],farAnkle=[141,182],nearTarget=[127,116],farTarget=[177,97],farWrist=-75,cloth=4),
        p(hip=-7,lean=23,x=6,nearAnkle=[114,181],farAnkle=[140,180],nearTarget=[126,113],farTarget=[172,80],farWrist=-90,cloth=3),
        p(hip=-1,lean=12,x=2,nearAnkle=[106,190],farAnkle=[143,187],nearTarget=[121,118],farTarget=[163,103],farWrist=-55,cloth=1),p(lean=2,nearTarget=[116,123],farTarget=[154,121],cloth=-1)], [3,3,3,3,3,3,5,6],{3:('far',0),4:('far',0),5:('far',0)})
    air=dict(nearAnkle=[108,187],farAnkle=[143,183])
    def ap(**kw):return p(**{**air,**kw})
    add('airQuickPunch','Air Quick Punch',[
        ap(lean=-2,farTarget=[151,119],nearTarget=[119,120]),ap(lean=-5,farTarget=[148,115],nearTarget=[123,119],cloth=-1),
        ap(lean=9,x=3,farTarget=[172,116],nearTarget=[124,119],nearAnkle=[111,183],cloth=1),
        ap(lean=17,x=6,hip=5,farTarget=[189,139],nearTarget=[120,125],nearAnkle=[114,182],farAnkle=[141,180],cloth=3),
        ap(lean=9,x=2,farTarget=[169,122],nearTarget=[119,121],cloth=1),ap(lean=1,farTarget=[154,121],nearTarget=[117,121],cloth=-1)], [1,2,2,3,4,4],{3:('far',0)})
    add('airDoublePunch','Air Double Punch',[
        ap(lean=-3,nearTarget=[123,117],farTarget=[151,118],cloth=-1),
        ap(lean=28,x=13,hip=3,nearTarget=[172,122],farTarget=[159,116],nearAnkle=[116,180],farAnkle=[141,178],cloth=3),
        ap(lean=16,x=6,nearTarget=[142,119],farTarget=[153,115],nearAnkle=[111,184],cloth=1),
        ap(lean=-9,nearTarget=[129,119],farTarget=[147,112],cloth=-2),
        ap(lean=22,x=9,hip=4,nearTarget=[126,125],farTarget=[196,139],nearAnkle=[115,181],farAnkle=[140,179],cloth=4),
        ap(lean=11,x=3,nearTarget=[122,120],farTarget=[171,123],cloth=2),ap(lean=2,nearTarget=[117,122],farTarget=[154,121],cloth=-1)], [3,2,2,2,3,4,4],{1:('near',0),4:('far',1)})
    add('airDownwardSmash','Air Downward Smash',[
        ap(lean=-3,nearTarget=[123,117],farTarget=[153,112]),ap(lean=-9,nearTarget=[128,113],farTarget=[157,98],farWrist=-60,cloth=-2),
        ap(lean=-12,hip=-2,nearTarget=[131,111],farTarget=[163,85],farWrist=-85,nearAnkle=[112,180],farAnkle=[140,178],cloth=-3),
        ap(lean=2,x=3,nearTarget=[132,115],farTarget=[180,115],farWrist=-15,cloth=1),
        ap(lean=21,x=8,hip=3,nearTarget=[128,124],farTarget=[190,155],farWrist=55,nearAnkle=[114,188],farAnkle=[141,185],cloth=4),
        ap(lean=30,x=10,hip=6,nearTarget=[127,128],farTarget=[186,178],farWrist=85,nearAnkle=[112,193],farAnkle=[142,188],cloth=3),
        ap(lean=15,x=3,nearTarget=[121,122],farTarget=[171,145],farWrist=25,cloth=2),ap(lean=3,nearTarget=[117,122],farTarget=[155,123],cloth=-1)], [3,3,3,2,3,3,5,6],{4:('far',0),5:('far',0)})
    add('attackRecovery','Attack Recovery',[p(lean=9,nearTarget=[122,121],farTarget=[168,126],nearAnkle=[106,193],cloth=2),p(lean=5,nearTarget=[120,122],farTarget=[161,124],nearAnkle=[104,196],cloth=1),p(lean=2,nearTarget=[117,123],farTarget=[156,123],cloth=-1),p(lean=0,nearTarget=[115,124],farTarget=[152,122])],[1,1,1,1])
    add('returnBehind','Return Behind Dio',[p(lean=-6,nearTarget=[125,119],farTarget=[157,118],nearAnkle=[109,188],farAnkle=[141,184],cloth=-3),p(lean=-4,nearTarget=[122,120],farTarget=[155,120],nearAnkle=[107,191],farAnkle=[142,187],cloth=-2),p(lean=-1,nearTarget=[119,121],farTarget=[153,121],nearAnkle=[104,195],farAnkle=[143,190],cloth=-1),p(lean=1,nearTarget=[117,122],farTarget=[152,122],nearAnkle=[102,197],farAnkle=[144,192],cloth=1),p(lean=0,nearTarget=[115,124],farTarget=[152,122])],[2,2,2,2,2])
    add('comboTransition','Combo Transition',[p(lean=14,x=4,nearTarget=[122,122],farTarget=[178,124],nearAnkle=[108,191],cloth=2),p(lean=9,x=2,nearTarget=[125,119],farTarget=[166,121],nearAnkle=[106,193],cloth=1),p(lean=3,nearTarget=[128,117],farTarget=[154,116],nearAnkle=[104,195],cloth=-1),p(lean=-2,nearTarget=[125,118],farTarget=[148,116],cloth=-2),p(lean=-3,nearTarget=[122,120],farTarget=[150,120],cloth=-1)],[1]*5)
    add('interruptRecoil','Interruption Recoil',[p(lean=-9,hip=4,nearTarget=[126,115],farTarget=[152,112],nearAnkle=[106,190],farAnkle=[142,186],cloth=-2),p(lean=-5,hip=2,nearTarget=[122,119],farTarget=[153,117],nearAnkle=[104,194],farAnkle=[143,190],cloth=-1),p(lean=-1,nearTarget=[117,123],farTarget=[152,122],cloth=1)],[2,2,2])
    # Preserve the last actual attack drawing through recovery. Deep low poses
    # use more inbetweens so rising does not jump 20–30 pixels in one key.
    for key in ['quickPunch','straightPunch','heavyPunch','lowPunch','lowSweep','uppercut','airQuickPunch','airDoublePunch','airDownwardSmash']:
        count=8 if key in ['lowPunch','lowSweep'] else 4
        poses=[interpolate(out[key]['poses'][-1],out['attackRecovery']['poses'][-1],i/(count-1)) for i in range(count)]
        for pose in poses:pose['support']=[]
        out['recover_'+key]=dict(label='Recovery / '+key,poses=poses,durations=[1]*count,contacts={})
    return out

def dio_commands():
    specs=dio_specs();idle=specs['idle']['poses'][0]
    def p(**kw):return {**idle,**kw}
    crouch=specs['crouchIdle']['poses'][0]
    air=specs['jumpApex']['poses'][0]
    out={
      'commandRelaxed':dict(label='Comando neutro',poses=[p(hip=h,farHand=[v,-v],nearHand=[-v,0],hair=v,cloth=v) for h,v in [(0,0),(-.7,1),(-1.1,.3),(.2,-.7)]],durations=[4,4,4,5]),
      'commandPoint':dict(label='Comando discreto',poses=[p(hip=h,lean=l,farTarget=t,farWrist=w,pointing=True,cloth=c,nearHand=[0,-1]) for h,l,t,w,c in [(0,0,[152,141],0,0),(-.5,-1,[154,137],-5,-1),(-1,1,[160,136],0,1),(-.3,1,[158,138],3,2),(.2,0,[153,141],0,-1)]],durations=[4,4,4,5,5]),
      'commandStrong':dict(label='Comando ofensivo',poses=[p(hip=h,lean=l,farTarget=t,farWrist=w,pointing=True,cloth=c,nearHand=[0,-2]) for h,l,t,w,c in [(0,-1,[152,141],-5,0),(1,-2,[151,134],-25,-1),(0,-1,[156,130],-15,-2),(-1,2,[162,134],0,2),(-.4,1,[159,138],3,1),(.3,0,[153,142],0,-1)]],durations=[4,4,4,6,7,6]),
      'commandCrouch':dict(label='Comando agachado',poses=[{**crouch,'hip':h,'farTarget':t,'farWrist':w,'pointing':True,'nearHand':[2,-8],'cloth':c} for h,t,w,c in [(31,[152,171],0,0),(30.5,[156,164],-8,-1),(31.2,[162,162],0,1),(31,[155,168],5,-.5)]],durations=[4,4,5,5]),
      'commandAir':dict(label='Comando aéreo',poses=[{**air,'lean':l,'farTarget':t,'farWrist':w,'pointing':True,'cloth':c} for l,t,w,c in [(2,[151,133],-5,0),(3,[157,128],-8,-1),(4,[161,132],0,2),(2,[153,135],4,1)]],durations=[4,4,5,5]),
      'commandRecovery':dict(label='Recuperação de comando',poses=[p(lean=l,farTarget=t,pointing=True,nearHand=[0,-1],cloth=c) for l,t,c in [(2,[160,137],2),(1,[157,140],1),(0,[154,143],-1),(-.5,[152,144],0)]],durations=[3,3,3,3]),
    }
    lift=[interpolate(out['commandCrouch']['poses'][0],out['commandAir']['poses'][0],t) for t in [.15,.45,.75,1]]
    for pose in lift:pose['support']=[]
    out['commandJumpLink']=dict(label='Transição de comando para salto',poses=lift,durations=[1]*4)
    return out

def export(name,defs):
    rig=AttackRig(name);out=ROOT/f'public/sprites/{name}';configfile=ROOT/f'src/data/{name}-animations.json';config=json.loads(configfile.read_text())
    manifest=dict(id=name,revision=3,standOnly=True,cell=[256,256],pivot=dict(x=128,y=224),clips={})
    for key,c in defs.items():
        frames=[];poses=[];ground=name=='dio' and key not in ['commandAir','commandJumpLink']
        for i,p in enumerate(c['poses']):
            im,g=render(rig,p,ground);frames.append(im)
            contact=c.get('contacts',{}).get(i)
            active=list(c.get('contacts',{}))
            phase='active' if contact else ('startup' if active and i<min(active) else 'recovery' if active and i>max(active) else 'transition')
            poses.append(dict(ticks=c['durations'][i],phase=phase,hitboxes=[g['surfaces'][contact[0]]] if contact else [],hitId=contact[1] if contact else -1,**g))
            im.save(out/f'{key}-{i:02}.png')
        if len({f.tobytes() for f in frames})!=len(frames):raise ValueError(f'Duplicate {name}/{key}')
        sheet=Image.new('RGBA',(256*len(frames),256));tiles=[]
        for i,f in enumerate(frames):
            sheet.paste(f,(256*i,0));tile=Image.new('RGBA',(180,180),'#293a47');tile.alpha_composite(f.crop((50,55,230,235)));tiles.append(tile.resize((540,540),Image.Resampling.NEAREST))
        sheet.save(out/f'{key}.png')
        preview=Image.new('RGBA',sheet.size,'#596674')
        for i,f in enumerate(frames):preview.alpha_composite(f,(i*256,0))
        preview.resize((preview.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
        tiles[0].save(out/f'{key}-animated.png',save_all=True,append_images=tiles[1:],duration=[t*1000/60 for t in c['durations']],loop=0,disposal=0,blend=0)
        config['clips'][key]=dict(sheet=f'{name}/{key}.png',columns=len(frames),frames=list(range(len(frames))),ticks=c['durations'][0],durations=c['durations'],loop=False)
        manifest['clips'][key]=dict(label=c['label'],sheet=key+'.png',count=len(frames),durations=c['durations'],loop=False,grounded=ground,poses=poses,bounds=[f.getbbox() for f in frames])
    configfile.write_text(json.dumps(config,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(config,indent=2)+'\n');(out/'stand-actions.json' if name=='the-world' else out/'commands.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

def transitions(defs):
    rig=AttackRig('the-world');out=ROOT/'public/sprites/the-world';entries={}
    routes={'quickPunch':['straightPunch','heavyPunch'],'straightPunch':['heavyPunch'],'lowPunch':['lowSweep','uppercut'],'lowSweep':['uppercut'],
      'uppercut':['airQuickPunch','airDoublePunch','airDownwardSmash'],'airQuickPunch':['airDoublePunch','airDownwardSmash'],'airDoublePunch':['airDownwardSmash']}
    candidates=[(source,i,target) for source,targets in routes.items() for i in range(len(defs[source]['poses'])) for target in targets]
    for source,i,target in candidates:
        a=defs[source]['poses'][i];b=defs[target]['poses'][0];frames=[];poses=[]
        # All coordinates are absolute limb targets. Faces keep their original
        # source pixels. Deduplicate rounded inbetweens, never invent holds.
        for t in [0,.25,.5,.75,1]:
            p=interpolate(a,b,t);p['support']=[]
            im,g=render(rig,p,False)
            if frames and frames[-1].tobytes()==im.tobytes():continue
            frames.append(im);poses.append(dict(ticks=1,phase='transition',hitboxes=[],hitId=-1,**g))
        key=f'bridge_{source}_{i}_{target}';sheet=Image.new('RGBA',(len(frames)*256,256))
        for j,f in enumerate(frames):sheet.paste(f,(j*256,0))
        sheet.save(out/f'{key}.png')
        entries[key]=dict(durations=[1]*len(frames),poses=poses,sheet=key+'.png',count=len(frames),bounds=[f.getbbox() for f in frames])
    configfile=ROOT/'src/data/the-world-animations.json';config=json.loads(configfile.read_text())
    for key,c in entries.items():config['clips'][key]=dict(sheet=f'the-world/{key}.png',columns=c['count'],frames=list(range(c['count'])),ticks=1,durations=c['durations'],loop=False)
    configfile.write_text(json.dumps(config,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(config,indent=2)+'\n');(out/'combo-transitions.json').write_text(json.dumps(entries,indent=2)+'\n')
    return entries

def build():
    protect();wd=world_definitions();wm=export('the-world',wd);commands=dio_commands();dm=export('dio',commands);bridges=transitions(wd)
    character=json.loads((ROOT/'src/data/dio.json').read_text());character['moves']={};character['combatLimits']=dict(maxHits=12,maxAirHits=8,maxTicks=240)
    character['commandTransitions']={'jump':{'poses':dm['clips']['commandJumpLink']['poses']}}
    character['airChaseSpeed']=3;character['airChaseTicks']=8
    character['companion']=dict(neutral=dict(x=-30,y=-18),returnTicks=12,quickReturnTicks=8,comboGrace=12,actions={**wm['clips'],**bridges})
    # clip, command, command delay, approach ticks, active spans are derived
    # from the actual transformed punch drawings, not the owner's gesture.
    setup=[
      ('stand_light','quickPunch','commandRelaxed',0,6,12,-10,42,25,11,1.2,0,6,'mid',1,['medium','heavy'],8),
      ('stand_medium','straightPunch','commandPoint',2,8,42,-16,72,32,16,2,0,8,'mid',2,['heavy'],12),
      ('stand_heavy','heavyPunch','commandStrong',5,11,84,-14,116,36,22,5,0,12,'mid',3,[],18),
      ('crouch_light','lowPunch','commandCrouch',1,6,14,-6,38,27,11,1,0,6,'low',1,['medium','heavy'],8),
      ('crouch_medium','lowSweep','commandCrouch',3,9,45,-10,64,34,16,1.8,0,8,'low',2,['heavy'],13),
      ('crouch_heavy','uppercut','commandCrouch',5,10,56,-18,88,48,21,1.8,-14,11,'mid',3,['jump'],19),
      ('air_light','airQuickPunch','commandAir',0,5,18,-8,38,33,12,1,-3,6,'high',1,['medium','heavy'],10),
      ('air_medium','airDoublePunch','commandAir',4,7,43,-14,70,37,16,1,-3,7,'high',2,['heavy'],14),
      ('air_heavy','airDownwardSmash','commandAir',2,10,66,-12,108,38,22,4,12,13,'high',3,[],17),
    ]
    configfile=ROOT/'src/data/dio-animations.json';config=json.loads(configfile.read_text());attackmanifest=dict(id='dio',revision=3,standOnly=True,clips={})
    for name,clip,command,delay,approach,reach,y,damage,stun,blockstun,push,launch,stop,level,rank,cancels,tail in setup:
        action=wm['clips'][clip];clock=delay;windows={}
        for pose in action['poses']:
            if pose['hitId']>=0:
                w=windows.setdefault(pose['hitId'],dict(id=pose['hitId'],fromTick=clock,toTick=clock))
                w['toTick']=clock+pose['ticks']
            clock+=pose['ticks']
        startup=min(w['fromTick'] for w in windows.values());end=max(w['toTick'] for w in windows.values())
        recovery='recover_'+clip
        total=max(clock+sum(wm['clips'][recovery]['durations']),end+tail)
        hitWindows=list(windows.values())
        if len(hitWindows)>1:
            hitWindows[0]['damage']=32;hitWindows[1]['damage']=38
        move=dict(startup=startup,active=end-startup,recovery=total-end,damage=damage,stun=stun,blockstun=blockstun,push=push,launch=launch,hitstop=stop,
          level=level,rank=rank,cancels=cancels,hitWindows=hitWindows,box=dict(x=0,y=0,w=0,h=0),cancelWindow=dict(fromTick=(hitWindows[-1]['fromTick']+1),toTick=min(clock-1,end+9)),
          stand=dict(approachAt=0,approachTicks=approach,punchAt=delay,recoverAt=clock,recoveryClip=recovery,returnAt=total,returnTicks=8 if rank==1 else 12,front=dict(x=reach,y=y),clip=clip,bridgeTicks=4),
          commandClip=command)
        move['cancelMoves']=[name.split('_')[0]+'_'+button for button in cancels if button in ['light','medium','heavy']]
        if name.startswith('air_'):move['airHold']=-2 if rank<3 else 3
        if name=='air_heavy':move['knockdown']=True
        # Gesture timing is independent from the 6–8 Stand drawings. Divide
        # the full attack into native owner drawings; only hurtboxes are used.
        owner=dm['clips'][command];n=owner['count'];times=[total//n+(1 if i<total%n else 0) for i in range(n)]
        move['poses']=[dict(ticks=t,phase='command',hitboxes=[],hurtboxes=p['hurtboxes']) for t,p in zip(times,owner['poses'])]
        config['clips'][name]={**config['clips'][command], 'durations':times,'ticks':times[0]}
        character['moves'][name]=move
        # Canonical normal sheets now contain commands too. Old body attacks
        # are accessible only in the explicitly named previous-version folder.
        out=ROOT/'public/sprites/dio';shutil.copy2(out/owner['sheet'],out/f'{name}.png')
        for suffix in ['-animated.png','-preview.png']:shutil.copy2(out/f'{command}{suffix}',out/f'{name}{suffix}')
        for i in range(n):shutil.copy2(out/f'{command}-{i:02}.png',out/f'{name}-{i:02}.png')
        for file in out.glob(f'{name}-[0-9][0-9].png'):
            if int(file.stem[-2:])>=n:
                if not file.resolve().is_relative_to(out.resolve()):raise ValueError('Unsafe output path')
                file.unlink()
        config['clips'][name]['sheet']=f'dio/{name}.png'
        attackmanifest['clips'][name]={**owner,'label':name.replace('_',' ').title(),'sheet':name+'.png','durations':times,'poses':[{**p,'ticks':t} for p,t in zip(owner['poses'],times)],'combat':move}
    configfile.write_text(json.dumps(config,indent=2)+'\n');(ROOT/'public/sprites/dio/animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (ROOT/'src/data/dio.json').write_text(json.dumps(character,indent=2)+'\n');(ROOT/'public/sprites/dio/attacks.json').write_text(json.dumps(attackmanifest,indent=2)+'\n')
    (ROOT/'public/sprites/the-world/attacks.json').write_text(json.dumps(wm,indent=2)+'\n')
    for name,defs in [('dio',commands),('the-world',wd)]:
        (ROOT/f'art/{name}/stand-only-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
    qa=ROOT/'art/dio/qa/stand-only';qa.mkdir(parents=True,exist_ok=True)
    for name,manifest in [('dio',dm),('the-world',wm)]:
        board=Image.new('RGB',(1200,len(manifest['clips'])*190),'#16242f');draw=ImageDraw.Draw(board)
        for row,(key,c) in enumerate(manifest['clips'].items()):
            draw.text((8,row*190+3),key,fill='#edc984')
            for i in range(c['count']):
                f=Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png');tile=Image.new('RGBA',(150,166),'#596674');tile.alpha_composite(f.crop((60,69,210,235)));ImageDraw.Draw(tile).line((0,155,149,155),fill='#a1afb3');board.paste(tile.convert('RGB'),(150*i,row*190+20))
        board.save(qa/f'{name}-contact.png')
    with zipfile.ZipFile(ROOT/'public/downloads/dio-normal-attacks.zip','w',zipfile.ZIP_DEFLATED) as z:
        for name,m in [('dio',dm),('the-world',wm)]:
            out=ROOT/f'public/sprites/{name}'
            for f in ['base.png','palette.json']:z.write(out/f,f'{name}/{f}')
            for key,c in m['clips'].items():
                z.write(out/c['sheet'],f'{name}/{c["sheet"]}')
                for i in range(c['count']):z.write(out/f'{key}-{i:02}.png',f'{name}/cells/{key}-{i:02}.png')
            z.writestr(f'{name}/actions.json',json.dumps(m,indent=2))
            if name=='dio':
                for key,c in attackmanifest['clips'].items():
                    z.write(out/c['sheet'],f'dio/{c["sheet"]}')
                    for i in range(c['count']):z.write(out/f'{key}-{i:02}.png',f'dio/cells/{key}-{i:02}.png')
            config=json.loads((out/'animations.json').read_text());available=set(m['clips'])|(set(attackmanifest['clips']) if name=='dio' else set(bridges))|{'base'}
            config['clips']={k:v for k,v in config['clips'].items() if k in available}
            z.writestr(f'{name}/animations.json',json.dumps(config,indent=2))
        z.writestr('the-world/combo-transitions.json',json.dumps(bridges,indent=2))
        z.writestr('dio/normal-attacks.json',json.dumps(attackmanifest,indent=2))
        for key in bridges:z.write(ROOT/f'public/sprites/the-world/{key}.png',f'the-world/{key}.png')
        z.write(ROOT/'src/data/dio.json','dio/character.json');z.writestr('LEIA-ME.txt','Revisao 3: somente The World possui hitboxes ofensivas. Dio executa gestos.\nCombine com o pacote de movimentacao v2 para um personagem completo no motor.\n')
    protect()
    print(json.dumps(dict(standOnly=True,worldActions=len(wm['clips']),worldFrames=sum(c['count'] for c in wm['clips'].values()),dioCommandSheets=len(dm['clips']),dioCommandFrames=sum(c['count'] for c in dm['clips'].values()),bridges=len(bridges))))

if __name__=='__main__':build()
