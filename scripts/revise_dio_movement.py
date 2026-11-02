"""Second locomotion pass. Native painted anatomy, contact-aware walk inbetweens.

Eight authored walk keys are sampled at fixed 60 Hz: each stance ankle follows
the inverse root motion, including the ticks between keys. This deliberately
exports 40 usable drawings per walk, rather than holding a planted boot still
in local space while its owner moves. No scaled/squashed bodies, no AA.
The first release is archived once; attack atlases and Samurai are untouched.
"""
from pathlib import Path
import json, math, hashlib, shutil, zipfile
import numpy as np
from PIL import Image, ImageDraw
from build_linked_movement import Rig, RIGS, rigid, point, warp, align, solve

ROOT=Path(__file__).resolve().parents[1]
PIVOT={'x':128,'y':224}

def archive_previous():
    root=ROOT/'public/sprites/previous-movement'
    if (root/'archive.json').exists():return
    hashes={}
    for name in ['dio','the-world']:
        source=ROOT/f'public/sprites/{name}';out=root/name;out.mkdir(parents=True,exist_ok=True)
        manifest=json.loads((source/'movement.json').read_text())
        config=json.loads((ROOT/f'src/data/{name}-animations.json').read_text())
        config['clips']={k:v for k,v in config['clips'].items() if k in manifest['clips'] or k in ['base','hover']}
        files=['base.png','palette.json','movement.json']
        for key,clip in manifest['clips'].items():
            files += [clip['sheet'],f'{key}-preview.png',f'{key}-animated.png']
            files += [f'{key}-{i:02}.png' for i in range(clip['count'])]
        for file in files:
            shutil.copy2(source/file,out/file)
            hashes[f'{name}/{file}']=hashlib.sha256((out/file).read_bytes()).hexdigest()
        for clip in config['clips'].values():clip['sheet']='previous-movement/'+clip['sheet']
        config['sheet']='previous-movement/'+config['sheet']
        (out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
        shutil.copy2(ROOT/f'art/{name}/movement-rig.json',out/'rig.json')
    (root/'archive.json').write_text(json.dumps({'version':1,'files':hashes},indent=2)+'\n')


class AnatomicalRig(Rig):
    """Retains the painted volume. New paths replace the frog-knee solver.

    Both knees bend toward the opponent, not away from each other. Feet have
    independent pitch; source faces remain pixel-exact. Limb underlaps bridge
    rotation seams without the old round metallic joint caps.
    """
    def __init__(self,name):
        super().__init__(name)
        if name=='the-world':
            # The original broad upper-arm cut included the fingers at y123.
            # On elbow flexion those pixels became a second stretched hand.
            for key,limit in [('farupper',154),('farfore',161)]:
                a=np.array(self.layers[key]);a[:,limit+1:]=0;self.layers[key]=Image.fromarray(a)

    def render(self,p,grounded):
        t=rigid(self.data['pivot'],p.get('lean',0),(p.get('x',0),p.get('hip',0)))
        cell=Image.new('RGBA',(256,256));legs={};arms={};leg_images={}
        for side in ['far','near']:
            h0,k0,a0=map(np.array,self.data['legs'][side]);hip=point(t,h0)
            target=np.array(p.get(side+'Ankle',a0),float)
            if self.name=='dio':hint=hip+np.array([45,18])
            else:hint=point(t,k0)+[12,-2]
            hint=np.array(p.get(side+'Knee',hint))
            knee,target=solve(hip,target,np.linalg.norm(k0-h0),np.linalg.norm(a0-k0),hint,grounded)
            leg=Image.new('RGBA',(256,256));d=ImageDraw.Draw(leg)
            # Trouser fabric / armour underlap has the same three-step ramp as
            # the painted source, hidden under the original textured segments.
            def bridge(a,b,r):
                v=b-a;n=np.array([-v[1],v[0]])/max(.01,np.linalg.norm(v))
                d.polygon([tuple(np.rint(q).astype(int)) for q in [a+n*r,b+n*(r-1),b-n*(r-1),a-n*r]],fill='#664116')
                d.line([tuple(np.rint(a).astype(int)),tuple(np.rint(b).astype(int))],fill='#b47c18',width=max(1,r))
            bridge(hip,knee,5);bridge(knee,target,4)
            leg.alpha_composite(warp(self.layers[side+'thigh'],align(h0,k0,hip,knee)))
            leg.alpha_composite(warp(self.layers[side+'shin'],align(k0,a0,knee,target)))
            ta=math.degrees(math.atan2(*(knee-hip)[::-1])-math.atan2(*(k0-h0)[::-1]))
            sa=math.degrees(math.atan2(*(target-knee)[::-1])-math.atan2(*(a0-k0)[::-1]))
            leg.alpha_composite(warp(self.layers[side+'knee'],rigid(k0,(ta+sa)*.5,knee-k0)))
            boot_source=self.layers[side+'boot']
            if side=='near' and p.get('forwardBoot',False):
                boot_source=warp(boot_source,(np.array([[-1,0],[0,1]]),np.array([2*a0[0],0])))
            boot=warp(boot_source,rigid(a0,p.get(side+'Toe',0),target-a0))
            # A planted sole is aligned by the pixels of the actual boot, not
            # by a per-frame bounding box of the whole actor.
            planted=grounded and side in p.get('support',[])
            if planted:
                b=boot.getbbox();dy=224-b[3]
                if dy:boot=warp(boot,(np.eye(2),np.array([0,dy])))
            leg.alpha_composite(boot);leg_images[side]=leg
            legs[side]=[hip.tolist(),knee.tolist(),target.tolist()]
        for side in ['far','near']:cell.alpha_composite(leg_images[side])
        arm_images={}
        for side in ['far','near']:
            s0,e0,w0=map(np.array,self.data['arms'][side]);shoulder=point(t,s0)
            target=np.array(p.get(side+'Target',point(t,w0)+p.get(side+'Hand',[0,0])))
            hint=point(t,e0)+p.get(side+'Elbow',[0,0])
            elbow,target=solve(shoulder,target,np.linalg.norm(e0-s0),np.linalg.norm(w0-e0),hint)
            arm=Image.new('RGBA',(256,256));d=ImageDraw.Draw(arm)
            pts=[tuple(np.rint(q).astype(int)) for q in [shoulder,elbow,target]]
            d.line(pts,fill='#63342b',width=6);d.line(pts,fill='#b47c18',width=4)
            arm.alpha_composite(warp(self.layers[side+'upper'],align(s0,e0,shoulder,elbow)))
            arm.alpha_composite(warp(self.layers[side+'fore'],align(e0,w0,elbow,target)))
            arm.alpha_composite(warp(self.layers[side+'hand'],rigid(w0,p.get(side+'Wrist',0),target-w0)))
            arm_images[side]=arm;arms[side]=[shoulder.tolist(),elbow.tolist(),target.tolist()]
        cell.alpha_composite(arm_images['far'])
        head_offset=np.rint(point(t,self.data['headAnchor'])-self.data['headAnchor']+p.get('head',[0,0])).astype(int)
        a=np.array([127,116] if self.name=='dio' else [132,98])+head_offset
        b=point(t,(127,123) if self.name=='dio' else (132,107));d=ImageDraw.Draw(cell)
        d.line([tuple(np.rint(a).astype(int)),tuple(np.rint(b).astype(int))],fill='#141621' if self.name=='dio' else '#414331',width=9)
        cell.alpha_composite(warp(self.layers['torso'],t))
        if self.name=='dio':
            # The old detached green pixels were sampled from a hanging strap
            # but transformed with the torso. Repaint the two straps connected
            # to their belt anchors, with the same native green ramp.
            d=ImageDraw.Draw(cell)
            for origin,dx,dy in [((122,151),-15,17),((140,150),9,15)]:
                a=point(t,origin);b=a+[dx*.5,dy*.6];end=a+[dx+p.get('cloth',0),dy]
                path=[tuple(np.rint(q).astype(int)) for q in [a,b,end]]
                d.line(path,fill='#112c24',width=4);d.line(path,fill='#226248',width=2)
                d.point(path[0],fill='#69a75a')
        else:cell.alpha_composite(warp(self.secondary(self.layers['cloth'],p.get('cloth',0)),t))
        cell.alpha_composite(arm_images['near'])
        head=np.array(self.layers['head']);hair=p.get('hair',0)
        if self.name=='dio' and hair:
            copy=head.copy()
            for y in range(94,104):copy[y]=np.roll(head[y],round(hair*(104-y)/10),axis=0)
            head=copy
        cell.alpha_composite(warp(Image.fromarray(head),(np.eye(2),head_offset)))
        # Connected dust cleanup only. Never cut a penetrating leg at the floor:
        # a bad grounded pose is rejected below instead of hidden by cropping.
        a=np.array(cell);a[a[:,:,3]==0]=0
        points=set(map(tuple,np.argwhere(a[:,:,3]>0)))
        while points:
            first=points.pop();component=[first];stack=[first]
            while stack:
                yy,xx=stack.pop()
                for dy in (-1,0,1):
                    for dx in (-1,0,1):
                        q=(yy+dy,xx+dx)
                        if q in points:points.remove(q);component.append(q);stack.append(q)
            if len(component)<10:
                for yy,xx in component:a[yy,xx]=0
        return Image.fromarray(a),{'legs':legs,'arms':arms,'headOffset':head_offset.tolist(),'support':p.get('support',[])}


def interpolate(a,b,t):
    out={}
    for k in set(a)|set(b):
        if k=='support':continue
        if isinstance(a.get(k),bool):out[k]=a[k];continue
        va=a.get(k,[0,0] if isinstance(b.get(k),list) else 0)
        vb=b.get(k,[0,0] if isinstance(va,list) else 0)
        v=np.array(va)+(np.array(vb)-va)*t
        out[k]=v.tolist() if isinstance(va,list) else float(v)
    return out


def dio_specs():
    out={}
    def add(key,label,poses,durations,loop=False,grounded=True,**kw):
        out[key]={'label':label,'poses':poses,'durations':durations,'loop':loop,'grounded':grounded,**kw}
    def p(**kw):return {'nearAnkle':[106,211],'farAnkle':[146,214],'support':['near','far'],**kw}
    add('idle','Idle',[p(hip=h,nearHand=[v,-v],farHand=[-v,-v],nearWrist=v,cloth=v,hair=hair,head=[0,-h*.25])
        for h,v,hair in [(0,0,0),(-.6,.5,0),(-1.1,1,1),(-.7,.7,1),(-.2,-.4,0),(.3,-.5,-1)]],[12,10,10,12,10,10],True)
    # Eight keys: contact, down, passing, up, opposite contact, down,
    # passing, up. The support path is linear throughout its stance phase.
    for backward in [False,True]:
        if not backward:
            xs=[112,116,128,140,144,136,128,120];ys=[0,-7,-13,-7,0,0,0,0]
            # Start in the approved split stance, with the far boot leading.
            hip=[1,3,1,-1,1,3,1,-1];speed=1.6
        else:
            xs=[116,122,128,134,140,135,128,120];ys=[0,0,0,0,0,-6,-10,-5]
            hip=[3,5,3,1,3,5,3,1];speed=1.2
        keys=[]
        for i in range(8):
            j=(i+4)%8;wave=math.sin(i*math.pi/4)
            keys.append(p(hip=hip[i]+4,x=-1 if backward else 0,lean=-2+wave*.8 if backward else .5+wave*.9,
                nearAnkle=[xs[i],211+ys[i]],farAnkle=[xs[j],214+ys[j]],
                nearHand=[(-7 if backward else 9)*wave,1-abs(wave)*2],
                farHand=[(5 if backward else -7)*wave,-2-abs(wave)*2],
                nearWrist=wave*5,farWrist=-wave*4,head=[-wave*.4,-hip[i]*.3],
                cloth=wave*2,hair=-wave*.8,forwardBoot=True,
                nearToe=0 if ys[i]==0 else -6 if ys[i]<-8 else 5,
                farToe=0 if ys[j]==0 else -6 if ys[j]<-8 else 5))
        frames=[]
        for i in range(40):
            key=i//5;t=(i%5)/5;pose=interpolate(keys[key],keys[(key+1)%8],t)
            pose['support']=[side for side in ['near','far'] if abs(pose[side+'Ankle'][1]-(211 if side=='near' else 214))<.01]
            frames.append(pose)
        key='walkBack' if backward else 'walkForward'
        add(key,'Walk Back' if backward else 'Walk Forward',frames,[1]*40,True,
            authoredKeys=8,keyFrames=list(range(0,40,5)),rootSpeed=(-speed if backward else speed))
    add('dashForward','Dash Forward',[
        p(hip=5,lean=4,nearHand=[-1,-2],farHand=[2,-3]),
        p(hip=11,x=-3,lean=14,nearAnkle=[104,211],farAnkle=[151,214],nearHand=[-5,-5],farHand=[2,-7],cloth=-2),
        p(hip=6,lean=27,nearAnkle=[96,201],farAnkle=[155,214],support=['far'],nearHand=[-12,-7],farHand=[0,-10],cloth=-4,hair=-1),
        p(hip=3,lean=29,nearAnkle=[101,195],farAnkle=[153,209],support=[],nearToe=-8,farToe=8,nearHand=[-13,-7],farHand=[0,-10],cloth=-5,hair=-2),
        p(hip=6,lean=18,nearAnkle=[112,211],farAnkle=[149,214],nearHand=[-6,-4],farHand=[1,-6],cloth=-3),
        p(hip=3,lean=6,nearAnkle=[108,211],farAnkle=[147,214],nearHand=[-2,-1],farHand=[1,-2],cloth=-1),
    ],[2,2,3,3,3,3])
    add('backdash','Backdash',[
        p(hip=6,lean=-3,nearHand=[1,-3],farHand=[2,-4]),
        p(hip=9,x=1,lean=-8,nearAnkle=[106,211],farAnkle=[149,214],nearHand=[3,-5],farHand=[3,-7]),
        p(hip=-1,lean=-12,nearAnkle=[109,201],farAnkle=[146,203],support=[],nearToe=7,farToe=-5,nearHand=[5,-6],farHand=[6,-9],cloth=3,hair=1),
        p(hip=2,lean=-9,nearAnkle=[108,205],farAnkle=[145,207],support=[],nearHand=[4,-5],farHand=[4,-7],cloth=3),
        p(hip=9,lean=-4,nearAnkle=[105,211],farAnkle=[145,214],nearHand=[2,-4],farHand=[2,-5],cloth=1),
        p(hip=3,lean=-1,nearHand=[0,-1],farHand=[1,-2]),
    ],[2,2,3,3,3,3])
    # Asymmetric fighting crouch: rear heel under the pelvis, front leg bears
    # weight. Both knee planes face forward. No scale transform is used.
    def crouch(amount,breath=0):
        return p(hip=amount,x=-amount*.18,lean=amount*.22,forwardBoot=True,
            nearHand=[2+amount*.06,-amount*.26+breath],farHand=[2,-amount*.38+breath],
            nearWrist=-amount*.1,farWrist=-amount*.3,cloth=-amount*.04+breath,
            head=[0,-amount*.03],hair=breath*.5)
    add('crouchStart','Crouch Start',[crouch(h) for h in [5,13,23,31]],[2,2,2,2])
    add('crouchIdle','Crouch Idle',[crouch(31,0),crouch(30.5,-.7),crouch(31.3,.4)],[12,14,14],True)
    add('crouchEnd','Crouch End',[crouch(h) for h in [24,15,7,1]],[2,2,2,2])
    add('jumpStart','Jump Start',[crouch(7),{**crouch(19),'nearHand':[1,-9],'farHand':[3,-12]},
        p(hip=-1,lean=3,nearHand=[-3,-9],farHand=[4,-12],cloth=-2,hair=-1)],[2,3,3])
    rise=[p(hip=-2,lean=3,nearAnkle=[112,204],farAnkle=[144,208],nearHand=[-4,-8],farHand=[5,-12],support=[],cloth=-2),
        p(hip=0,lean=5,nearAnkle=[119,192],farAnkle=[140,201],nearHand=[-7,-12],farHand=[7,-15],nearToe=-10,farToe=5,support=[],cloth=-3,hair=1),
        p(hip=1,lean=3,nearAnkle=[121,187],farAnkle=[144,197],nearHand=[-6,-12],farHand=[6,-14],nearToe=-12,farToe=4,support=[],cloth=-2,hair=1)]
    apex=[p(hip=1,lean=1,nearAnkle=[119,188],farAnkle=[144,198],nearHand=[-5,-10],farHand=[6,-12],nearToe=-10,farToe=3,support=[],cloth=1,hair=1),
        p(hip=1.5,lean=0,nearAnkle=[117,190],farAnkle=[146,200],nearHand=[-4,-9],farHand=[5,-11],nearToe=-7,farToe=2,support=[],cloth=2)]
    fall=[p(hip=0,lean=-1,nearAnkle=[114,197],farAnkle=[147,204],nearHand=[-2,-7],farHand=[4,-10],nearToe=-3,support=[],cloth=2,hair=-1),
        p(hip=0,lean=-1,nearAnkle=[109,206],farAnkle=[147,211],nearHand=[0,-4],farHand=[3,-6],support=[],cloth=2),
        p(hip=0,lean=0,nearHand=[1,-3],farHand=[2,-4],support=[],cloth=1)]
    add('jumpRise','Jump Rise',rise,[4,5,5],grounded=False)
    add('jumpApex','Jump Apex',apex,[4,5],grounded=False)
    add('jumpFall','Jump Fall',fall,[4,6,6],grounded=False)
    add('landing','Landing',[crouch(5),{**crouch(17),'cloth':2},crouch(10),crouch(2)],[2,2,2,2])
    # Directional silhouettes are source drawings with independently positioned
    # limbs and torso; never rotate the entire actor (especially its face).
    for suffix,direction in [('Forward',1),('Backward',-1)]:
        for key,poses in [('jumpRise',rise),('jumpApex',apex),('jumpFall',fall)]:
            variants=[]
            for pose in poses:
                q=dict(pose);q['lean']=q.get('lean',0)+(5 if direction==1 else -5)
                q['nearAnkle']=[pose['nearAnkle'][0]-direction*4,pose['nearAnkle'][1]]
                q['farAnkle']=[pose['farAnkle'][0]-direction*3,pose['farAnkle'][1]]
                q['nearHand']=[pose['nearHand'][0]-direction*2,pose['nearHand'][1]];variants.append(q)
            add(key+suffix,out[key]['label']+' '+suffix,variants,out[key]['durations'],grounded=False,variantOf=key)
    return out


def world_specs():
    out={}
    def add(key,label,poses,times,loop=True):out[key]={'label':label,'poses':poses,'durations':times,'loop':loop,'grounded':False}
    def p(**kw):return {'nearAnkle':[101,198],'farAnkle':[144,193],**kw}
    add('standIdle','Stand Idle',[p(hip=h,lean=v,nearHand=[v,-1+v],farHand=[-v,-1-v],nearWrist=v*2,farWrist=-v*2,cloth=v,
        nearAnkle=[101+v,198-v],farAnkle=[144-v,193+v]) for h,v in [(0,0),(-.5,.6),(-1,1),(-.5,.4),(0,-.6),(.5,-.4)]],[10,10,10,10,10,10])
    add('floating','Floating',[p(hip=h,lean=v*.7,nearHand=[1+v,-3-v],farHand=[-1-v,-3+v],nearWrist=-v*3,cloth=v*2,
        nearAnkle=[103+v*2,195-v*2],farAnkle=[143-v,191-v],nearToe=-3-v*2) for h,v in [(0,0),(-.5,.6),(-1,1),(-.4,.4),(.5,-.5),(.3,-.4)]],[9,9,9,9,9,9])
    for backward in [False,True]:
        poses=[]
        for i in range(6):
            v=[0,.7,1,.4,-.6,-.5][i]
            poses.append(p(hip=-v,lean=(-4-v if backward else 6+v),nearHand=[3+v,-5-v] if backward else [-5-v,-3-v],
                farHand=[4+v,-6-v] if backward else [-5-v,-4-v],
                nearAnkle=[105+v,191-v*2],farAnkle=[141-v,187-v],nearToe=-6,farToe=3,nearWrist=v*3,farWrist=-v*3,cloth=v*2))
        add('followBackward' if backward else 'followForward','Follow Backward' if backward else 'Follow Forward',poses,[5]*6)
    add('dashFollow','Dash Follow',[p(hip=-h,lean=l,nearHand=[-h-2,-4-h],farHand=[-h-1,-5-h],nearAnkle=[103+h,195-h*2],farAnkle=[144-h,191-h],nearToe=-h*2,cloth=-h)
        for h,l in [(1,5),(3,12),(5,19),(3.5,10),(.4,2)]],[2,3,4,4,3],False)
    add('jumpFollow','Jump Follow',[p(hip=h,lean=l,nearAnkle=[nx,ny],farAnkle=[fx,fy],nearHand=[-3,-8-h],farHand=[3,-10-h],nearToe=toe,cloth=h)
        for h,l,nx,ny,fx,fy,toe in [(0,2,105,190,143,187,-4),(-1,4,111,180,141,180,-9),(1,2,111,182,143,182,-7),(0,0,104,194,145,190,-2)]],[5,8,8,6],False)
    add('returnPosition','Return to Position',[p(hip=h,lean=l,nearAnkle=[nx,ny],farAnkle=[fx,fy],nearHand=[v,-2-v],farHand=[-v,-2-v],nearToe=-v,cloth=v)
        for h,l,nx,ny,fx,fy,v in [(1,-5,109,189,141,185,4),(1,-3,107,191,142,187,3),(.5,-1,105,194,143,190,2),(0,0,102,197,144,192,1),(0,0,101,198,144,193,0)]],[3,3,3,4,5],False)
    # A compact guard keeps the Stand's far fist behind the owner's silhouette
    # instead of putting a floating golden hand across Dio's eyes in neutral.
    for clip in out.values():
        for pose in clip['poses']:
            hand=pose.get('farHand',[0,0]);pose['farHand']=[hand[0]-8,hand[1]-5]
    return out


def build(name,defs):
    art=ROOT/f'art/{name}';out=ROOT/f'public/sprites/{name}';rig=AnatomicalRig(name)
    config=json.loads((ROOT/f'src/data/{name}-animations.json').read_text())
    digest=hashlib.sha256((art/'base-native.png').read_bytes()).hexdigest()
    manifest={'id':name,'revision':2,'cell':[256,256],'pivot':PIVOT,'baseSha256':digest,'clips':{}}
    times={k:v['durations'] for k,v in defs.items()}
    # Revision timing has its own file: old durations cannot silently undo new
    # drawings or invalidate contact paths.
    timing=art/'movement-v2-timing.json'
    if timing.exists():
        values=json.loads(timing.read_text())
        for key,ts in values.items():
            if key not in defs or len(ts)!=len(defs[key]['poses']) or any(type(t)!=int or t<1 for t in ts):raise ValueError(f'Invalid timing {name}/{key}')
            if key.startswith('walk') and ts!=[1]*40:raise ValueError('Walk contact samples require fixed ticks; edit gait rootSpeed too')
            defs[key]['durations']=ts
    else:timing.write_text(json.dumps(times,indent=2)+'\n')
    for key,clip in defs.items():
        frames=[];anchors=[]
        for i,pose in enumerate(clip['poses']):
            im,joints=rig.render(pose,clip['grounded']);frames.append(im);anchors.append(joints)
            if clip['grounded'] and im.getbbox()[3]>224:raise ValueError(f'{key}/{i}: pixels penetrate floor')
            im.save(out/f'{key}-{i:02}.png')
        # Subpixel rounded idle keys occasionally share a limb position, but
        # every exported drawing must still contain an actual silhouette change.
        if len(set(im.tobytes() for im in frames))!=len(frames):raise ValueError(f'{name}/{key}: duplicate pose')
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,im in enumerate(frames):sheet.paste(im,(i*256,0))
        sheet.save(out/f'{key}.png')
        config['clips'][key]={'sheet':f'{name}/{key}.png','columns':len(frames),'frames':list(range(len(frames))),'ticks':clip['durations'][0],'durations':clip['durations'],'loop':clip['loop']}
        m={k:v for k,v in clip.items() if k!='poses'}
        m.update({'sheet':key+'.png','count':len(frames),'bounds':[im.getbbox() for im in frames],'anchors':anchors})
        manifest['clips'][key]=m
        # Full transparent atlas plus a legible 2x contact sheet (all drawings).
        preview=Image.new('RGBA',(256*len(frames),256),'#596674');d=ImageDraw.Draw(preview)
        for i,im in enumerate(frames):preview.alpha_composite(im,(i*256,0));d.line((i*256,224,(i+1)*256-1,224),fill='#a1afb3')
        preview.resize((preview.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
        tiles=[]
        for im in frames:
            tile=Image.new('RGBA',(180,180),'#293a47');tile.alpha_composite(im.crop((50,55,230,235)))
            ImageDraw.Draw(tile).line((0,169,179,169),fill='#7894a0');tiles.append(tile.resize((540,540),Image.Resampling.NEAREST))
        tiles[0].save(out/f'{key}-animated.png',save_all=True,append_images=tiles[1:],duration=[t*1000/60 for t in clip['durations']],loop=0,disposal=0,blend=0)
    if name=='the-world':config['clips']['hover']={**config['clips']['floating']}
    # Own-source provisional reaction aliases retain their own sheet coordinates.
    aliases={'guardStand':'idle','guardCrouch':'crouchIdle','guardImpactStand':'backdash','guardImpactCrouch':'crouchIdle',
        'damageLight':'backdash','damageMedium':'backdash','damageHeavy':'backdash','damageCrouch':'crouchIdle','damageAir':'jumpFall',
        'launched':'jumpRise','falling':'jumpFall','downed':'crouchIdle','getup':'crouchEnd','entrance':'walkForward','victory':'idle','ko':'crouchIdle','defeat':'crouchIdle','grabbed':'backdash'}
    if name=='dio':
        for alias,source in aliases.items():
            if alias in config['clips']:
                frame=min(config['clips'][alias]['frames'][0],len(config['clips'][source]['frames'])-1)
                config['clips'][alias]={**config['clips'][source],'frames':[frame],'durations':[12],'ticks':12,'loop':True}
    (ROOT/f'src/data/{name}-animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'animations.json').write_text(json.dumps(config,indent=2)+'\n');(out/'movement.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (art/'movement-v2-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
    base=json.loads((out/'manifest.json').read_text());base.update({'locomotionRevision':2,'drawnFrames':sum(c['count'] for c in manifest['clips'].values()),'animationClips':len(manifest['clips']),'method':'native painted segments, anatomical forward knee planes, eight walk keys with fixed-tick contact inbetweens'})
    (out/'manifest.json').write_text(json.dumps(base,indent=2)+'\n')
    return manifest


def previews(manifests):
    qa=ROOT/'art/dio/qa/revision';qa.mkdir(parents=True,exist_ok=True)
    groups=[('dio-ground','dio',['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd']),
        ('dio-jump','dio',['jumpStart','jumpRise','jumpApex','jumpFall','landing']),('world-all','the-world',list(manifests[1]['clips']))]
    for label,name,keys in groups:
        manifest=next(m for m in manifests if m['id']==name)
        board=Image.new('RGB',(1200,190*len(keys)),'#16242f');draw=ImageDraw.Draw(board)
        for row,key in enumerate(keys):
            clip=manifest['clips'][key];draw.text((8,row*190+3),f'{name} / {key}',fill='#edc984')
            indices=clip.get('keyFrames',list(range(clip['count'])))
            for col,i in enumerate(indices):
                im=Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png').convert('RGBA')
                tile=Image.new('RGBA',(150,166),'#596674');tile.alpha_composite(im.crop((60,69,210,235)))
                ImageDraw.Draw(tile).line((0,155,149,155),fill='#a1afb3');board.paste(tile.convert('RGB'),(150*col,row*190+20))
        board.save(qa/f'contact-{label}.png')
    for manifest in manifests:
        name=manifest['id'];board=Image.new('RGB',(1200,len(manifest['clips'])*190),'#16242f');draw=ImageDraw.Draw(board)
        for row,(key,clip) in enumerate(manifest['clips'].items()):
            draw.text((8,row*190+3),f'{key} / {clip["count"]} frames',fill='#edc984')
            for col,i in enumerate(clip.get('keyFrames',list(range(clip['count'])))):
                im=Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png').convert('RGBA')
                tile=Image.new('RGBA',(150,166),'#596674');tile.alpha_composite(im.crop((60,69,210,235)))
                ImageDraw.Draw(tile).line((0,155,149,155),fill='#a1afb3');board.paste(tile.convert('RGB'),(150*col,row*190+20))
        board.save(ROOT/f'public/sprites/{name}/movement-overview.png')
    # True world-space walk preview. The planted foot is tested against a fixed
    # ground grid while the body root advances. Camera follows only after a cycle.
    for key in ['walkForward','walkBack']:
        clip=manifests[0]['clips'][key];tiles=[]
        for i in range(80):
            tile=Image.new('RGBA',(320,180),'#293a47');d=ImageDraw.Draw(tile)
            for gx in range(0,320,16):d.line((gx,158,gx,179),fill='#526a77')
            d.line((0,158,319,158),fill='#c6b479')
            im=Image.open(ROOT/f'public/sprites/dio/{key}-{i%40:02}.png').convert('RGBA')
            x=100 if key=='walkForward' else 210;x+=round(i*clip['rootSpeed'])
            tile.alpha_composite(im,(x-128,158-224));tiles.append(tile.resize((960,540),Image.Resampling.NEAREST))
        tiles[0].save(ROOT/f'public/sprites/dio/{key}-world-animated.png',save_all=True,append_images=tiles[1:],duration=1000/60,loop=0,disposal=0,blend=0)


def main():
    archive_previous()
    manifests=[build('dio',dio_specs()),build('the-world',world_specs())]
    previews(manifests)
    gait={}
    for key in ['walkForward','walkBack']:
        clip=manifests[0]['clips'][key]
        gait[key]={'speed':clip['rootSpeed'],'feet':[a['legs']['near'][2]+a['legs']['far'][2] for a in clip['anchors']]}
    (ROOT/'src/data/dio-gait.json').write_text(json.dumps(gait,indent=2)+'\n')
    profile=json.loads((ROOT/'src/data/dio-movement.json').read_text())
    file=ROOT/'src/data/dio.json';character=json.loads(file.read_text())
    character['speed']=profile['walkSpeed']
    character['locomotion']={k:profile[k] for k in ['backSpeed','airSpeed','jumpStartup','landingTicks','dashForward','backdash']}
    file.write_text(json.dumps(character,indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'public/downloads/dio-the-world-movement.zip','w',zipfile.ZIP_DEFLATED) as z:
        for m in manifests:
            name=m['id'];out=ROOT/f'public/sprites/{name}'
            for f in ['base.png','palette.json','movement.json']:z.write(out/f,f'{name}/{f}')
            config=json.loads((out/'animations.json').read_text())
            config['clips']={k:v for k,v in config['clips'].items() if k in m['clips'] or k in ['base','hover']}
            z.writestr(f'{name}/animations.json',json.dumps(config,indent=2)+'\n')
            for key,c in m['clips'].items():
                z.write(out/c['sheet'],f'{name}/{c["sheet"]}')
                z.write(out/f'{key}-animated.png',f'{name}/previews/{key}-animated.png')
                for i in range(c['count']):z.write(out/f'{key}-{i:02}.png',f'{name}/cells/{key}-{i:02}.png')
            z.write(ROOT/f'art/{name}/movement-v2-timing.json',f'{name}/timing.json')
        z.writestr('LEIA-ME.txt','Revisao 2. PNG RGBA, celulas 256x256, pivo 128,224.\nCaminhadas: 8 poses-chave e 40 desenhos interpolados por caminhada, 1 tick/desenho.\nArquivos antigos preservados em sprites/previous-movement no projeto.\n')
    # Keep the existing combat inspector's download usable. This packages the
    # current normals without regenerating or altering any attack drawings.
    if (ROOT/'public/sprites/dio/attacks.json').exists():
        with zipfile.ZipFile(ROOT/'public/downloads/dio-normal-attacks.zip','w',zipfile.ZIP_DEFLATED) as z:
            for name in ['dio','the-world']:
                out=ROOT/f'public/sprites/{name}';attacks=json.loads((out/'attacks.json').read_text())
                z.write(out/'attacks.json',f'{name}/attacks.json')
                for key,clip in attacks['clips'].items():
                    z.write(out/clip['sheet'],f'{name}/{clip["sheet"]}')
                    for i in range(clip['count']):z.write(out/f'{key}-{i:02}.png',f'{name}/cells/{key}-{i:02}.png')
            z.write(ROOT/'src/data/dio.json','dio/character.json')
            z.writestr('LEIA-ME.txt','45 quadros de Dio e 37 do Stand, com hitboxes e propriedades.\nCombine com dio-the-world-movement.zip para a locomocao.\n')
    # The normals builder may regenerate attack art but must now protect the
    # revised locomotion. Its original lock remains in the immutable archive.
    lock=ROOT/'art/dio/normal-source-lock.json'
    archive=ROOT/'public/sprites/previous-movement/normal-source-lock.json'
    if lock.exists() and not archive.exists():shutil.copy2(lock,archive)
    if lock.exists():
        values=json.loads(lock.read_text())
        for file in values:values[file]=hashlib.sha256((ROOT/'public/sprites'/file).read_bytes()).hexdigest()
        lock.write_text(json.dumps(values,indent=2)+'\n')
    print(json.dumps({m['id']:{'clips':len(m['clips']),'frames':sum(c['count'] for c in m['clips'].values())} for m in manifests}))

if __name__=='__main__':main()
