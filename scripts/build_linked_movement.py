"""83 native-pixel locomotion keys, using only the two approved painted bases.

Rigid painted limb segments, two-bone IK, planted boot anchors, independent
hands, hair/tubes and belts. Faces are copied without rotation or resampling.
There is no rescaling of anatomy and no whole-idle translation as animation.
"""
from pathlib import Path
import hashlib
import json
import math
import zipfile
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SIZE=256


def mask(points):
    im=Image.new('L',(SIZE,SIZE));ImageDraw.Draw(im).polygon(points,fill=255)
    return np.array(im)>0


def rigid(origin,angle=0,offset=(0,0)):
    a=math.radians(angle);m=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    o=np.array(origin,float)
    return m,o+offset-m@o


def point(t,p):return t[0]@np.array(p,float)+t[1]


def warp(im,t):
    inv=np.linalg.inv(t[0]);v=-inv@t[1]
    return im.transform((SIZE,SIZE),Image.Transform.AFFINE,(*inv[0],v[0],*inv[1],v[1]),Image.Resampling.NEAREST)


def align(a,b,c,d):
    # Rotation only. IK solves the exact lengths; transverse volume is invariant.
    a,b,c,d=[np.array(v,float) for v in [a,b,c,d]]
    angle=math.degrees(math.atan2(*(d-c)[::-1])-math.atan2(*(b-a)[::-1]))
    m,_=rigid((0,0),angle)
    return m,c-m@a


def solve(a,target,l1,l2,hint,planted=False):
    a,target,hint=[np.array(v,float) for v in [a,target,hint]]
    v=target-a;limit=l1+l2-.05
    if np.linalg.norm(v)>limit:
        if planted and abs(v[1])<limit:
            target[0]=a[0]+np.sign(v[0])*math.sqrt(max(0,limit*limit-v[1]*v[1]))
        else:target=a+v*limit/np.linalg.norm(v)
    v=target-a;distance=max(.01,float(np.linalg.norm(v)));unit=v/distance
    run=(l1*l1-l2*l2+distance*distance)/(2*distance)
    height=math.sqrt(max(0,l1*l1-run*run));normal=np.array([-unit[1],unit[0]])
    options=[a+unit*run+normal*height,a+unit*run-normal*height]
    if planted:
        above=[p for p in options if p[1]<=target[1]-4]
        if above:options=above
    return min(options,key=lambda p:np.linalg.norm(p-hint)),target


RIGS={
 'dio':{
  'pivot':[128,150],'headAnchor':[128,116],'headPoly':[(109,93),(139,93),(141,113),(138,116),(131,119),(126,118),(120,115),(109,114)],
  'nearArm':[(97,113),(108,113),(117,121),(113,132),(110,141),(111,147),(121,151),(122,158),(116,161),(107,158),(101,150),(95,145),(93,137),(98,125)],
  'farArm':[(135,119),(142,119),(147,131),(147,138),(153,136),(159,137),(162,141),(161,147),(156,151),(145,151),(140,148),(139,138)],
  'arms':{'near':[[105,122],[102,141],[111,152]],'far':[[140,125],[143,140],[152,145]]},
  'legs':{'near':[[123,150],[111,180],[106,211]],'far':[[135,148],[145,180],[146,211]]},
  'legStart':151,'legSplit':130,'boots':{'near':207,'far':206},
  'armCuts':{'near':[140,148,'y'],'far':[140,151,'x']},
  'skin':['#63342b','#92513c','#e7a776'],'joint':['#664116','#b47c18','#f4c944'],
  'face':[126,105,135,116],
 },
 'the-world':{
  'pivot':[132,137],'headAnchor':[135,99],'headPoly':[(122,68),(148,68),(151,99),(140,104),(128,101),(120,95),(119,83)],
  'nearArm':[(94,95),(106,91),(116,96),(117,108),(109,115),(109,118),(118,119),(123,123),(122,132),(112,135),(98,132),(88,128),(84,120),(91,111),(94,107)],
  'farArm':[(142,100),(150,102),(153,110),(154,119),(157,122),(162,120),(170,123),(173,129),(171,136),(160,137),(152,135),(148,129),(144,127),(143,117)],
  'arms':{'near':[[104,102],[95,120],[113,127]],'far':[[146,107],[148,122],[160,129]]},
  'legs':{'near':[[125,140],[111,172],[98,201]],'far':[[140,140],[149,170],[143,195]]},
  'legStart':138,'legSplit':133,'boots':{'near':198,'far':192},
  'armCuts':{'near':[118,109,'x'],'far':[122,160,'x']},
  'skin':['#414331','#64674b','#939578'],'joint':['#664116','#b47c18','#f4c944'],
  'face':[136,87,145,99],
 },
}


class Rig:
 def __init__(self,name):
    self.name=name;self.data=RIGS[name];self.base=Image.open(ROOT/f'art/{name}/base-native.png').convert('RGBA')
    source=np.array(self.base);y,x=np.mgrid[:256,:256];labels=np.full((256,256),'torso',dtype='U12')
    split=self.data['legSplit'] if name=='dio' else np.where(y<160,133,np.where(y<185,128,124))
    labels[(y>=self.data['legStart'])&(x<split)]='nearLeg'
    labels[(y>=self.data['legStart'])&(x>=split)]='farLeg'
    pelvis_poly=[(119,140),(139,140),(140,151),(130,156),(120,151)] if name=='dio' else [(123,131),(143,131),(142,143),(136,151),(128,148)]
    labels[mask(pelvis_poly)]='torso'
    # Painted hanging straps/tubing move separately from the legs.
    green=np.zeros((256,256),bool)
    for color in ['112c24','174735','226248','398554','69a75a']:
        green|=np.all(source[:,:,:3]==list(bytes.fromhex(color)),axis=2)
    if name=='dio':cloth=green&(y>=149)&(y<170)&((x<124)|(x>140))
    else:cloth=green&(y>=133)&(y<150)&((x<118)|(x>150))
    labels[cloth]='cloth'
    labels[mask(self.data['farArm'])]='farArm'
    labels[mask(self.data['nearArm'])]='nearArm'
    labels[mask(self.data['headPoly'])]='head'
    self.layers={}
    for label in ['torso','cloth','head','nearArm','farArm','nearLeg','farLeg']:
        pixels=source.copy();pixels[labels!=label]=0;self.layers[label]=Image.fromarray(pixels)
    for side in ['near','far']:
        pixels=np.array(self.layers[side+'Leg'])
        under=cloth&(y>=self.data['legStart'])&((x<split) if side=='near' else (x>=split))&(source[:,:,3]>0)
        pixels[under]=[*bytes.fromhex('8e5b16'),255]
        self.layers[side+'Leg']=Image.fromarray(pixels)
    # Retain the painted joint overlaps so rotation does not expose cut seams.
    for side in ['near','far']:
        data=np.array(self.layers[side+'Leg']);knee=self.data['legs'][side][1][1];boot=self.data['boots'][side]
        knee_x=self.data['legs'][side][1][0]
        knee_mask=(abs(x-knee_x)<=7)&(abs(y-knee)<=5)
        for key,region in [('thigh',y<=knee+2),('shin',(y>=knee-2)&(y<=boot+3)),('boot',y>=boot-2),('knee',knee_mask)]:
            part=data.copy();part[~region]=0
            if key in ['thigh','shin']:part[knee_mask]=0
            self.layers[side+key]=Image.fromarray(part)
        data=np.array(self.layers[side+'Arm']);elbow,wrist,axis=self.data['armCuts'][side]
        if name=='dio' and side=='near':regions=[y<=143,(y>=137)&(y<=153),y>=148]
        elif name=='dio':regions=[(x<=148)&(y<=144),(y>=137)&(x>=140)&(x<=155),x>=151]
        elif side=='near':regions=[y<=121,(y>=113)&(x<=115),(y>=119)&(x>=109)]
        else:regions=[y<=125,(y>=119)&(x<=163),x>=160]
        for key,region in zip(['upper','fore','hand'],regions):
            part=data.copy();part[~region]=0;self.layers[side+key]=Image.fromarray(part)
    target=ROOT/f'art/{name}/movement-layers';target.mkdir(exist_ok=True)
    for key,image in self.layers.items():image.save(target/f'{key}.png')

 def cap(self,canvas,at,radius,metal=True):
    d=ImageDraw.Draw(canvas);x,y=np.rint(at).astype(int);colors=self.data['joint'] if metal else self.data['skin']
    d.ellipse((x-radius,y-radius,x+radius,y+radius),fill=colors[0])
    d.ellipse((x-radius+1,y-radius+1,x+radius-1,y+radius-1),fill=colors[1])
    if radius>=4:d.line((x-radius+2,y-radius+2,x+1,y-radius+2),fill=colors[2],width=1)

 def secondary(self,image,amount):
    # A one-pixel sway at a hanging tip, never a resized garment.
    a=np.array(image);out=np.zeros_like(a)
    for y in range(256):
        shift=round(amount*min(1,max(0,(y-140)/28)))
        if shift>=0:out[y,shift:]=a[y,:256-shift] if shift else a[y]
        else:out[y,:shift]=a[y,-shift:]
    return Image.fromarray(out)

 def render(self,p,grounded):
    t=rigid(self.data['pivot'],p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    cell=Image.new('RGBA',(256,256));legs={};arms={}
    # Pelvis underlap is covered by the original belt/thigh pixels.
    pelvis=point(t,self.data['pivot']);self.cap(cell,pelvis,7)
    for side in ['far','near']:
        hip0,knee0,ankle0=map(np.array,self.data['legs'][side]);hip=point(t,hip0)
        target=ankle0+np.array(p.get(side+'Foot',[0,0]))
        hint=point(t,knee0)+np.array([-7 if side=='near' else 7,0])
        if self.name=='dio' and grounded and p.get('hip',0)>=18:
            hint=hip+np.array([-50 if side=='near' else 50,-8])
        knee,target=solve(hip,target,np.linalg.norm(knee0-hip0),np.linalg.norm(ankle0-knee0),hint,grounded)
        self.cap(cell,knee,4);self.cap(cell,target,3)
        cell.alpha_composite(warp(self.layers[side+'thigh'],align(hip0,knee0,hip,knee)))
        cell.alpha_composite(warp(self.layers[side+'shin'],align(knee0,ankle0,knee,target)))
        thigh_angle=math.degrees(math.atan2(*(knee-hip)[::-1])-math.atan2(*(knee0-hip0)[::-1]))
        shin_angle=math.degrees(math.atan2(*(target-knee)[::-1])-math.atan2(*(ankle0-knee0)[::-1]))
        cell.alpha_composite(warp(self.layers[side+'knee'],rigid(knee0,(thigh_angle+shin_angle)*.5,knee-knee0)))
        cell.alpha_composite(warp(self.layers[side+'boot'],rigid(ankle0,p.get(side+'Toe',0),target-ankle0)))
        legs[side]=[hip.tolist(),knee.tolist(),target.tolist()]
    # Far arm sits behind the torso, near arm in front.
    arm_images={}
    for side in ['far','near']:
        shoulder0,elbow0,wrist0=map(np.array,self.data['arms'][side]);shoulder=point(t,shoulder0)
        target=point(t,wrist0)+p.get(side+'Hand',[0,0]);hint=point(t,elbow0)+p.get(side+'Elbow',[0,0])
        elbow,target=solve(shoulder,target,np.linalg.norm(elbow0-shoulder0),np.linalg.norm(wrist0-elbow0),hint)
        arm=Image.new('RGBA',(256,256));self.cap(arm,shoulder,4);self.cap(arm,elbow,3)
        arm.alpha_composite(warp(self.layers[side+'upper'],align(shoulder0,elbow0,shoulder,elbow)))
        arm.alpha_composite(warp(self.layers[side+'fore'],align(elbow0,wrist0,elbow,target)))
        arm.alpha_composite(warp(self.layers[side+'hand'],rigid(wrist0,p.get(side+'Wrist',0),target-wrist0)))
        arm_images[side]=arm;arms[side]=[shoulder.tolist(),elbow.tolist(),target.tolist()]
    cell.alpha_composite(arm_images['far'])
    head_offset=np.rint(point(t,self.data['headAnchor'])-self.data['headAnchor']+p.get('head',[0,0])).astype(int)
    # Painted collar underlap bridges a raised head and a lowered walking hip.
    # Without it the original cut boundary left a transparent bar at the neck.
    if self.name=='dio':
        a=np.array([127,116])+head_offset;b=point(t,(127,123))
        d=ImageDraw.Draw(cell);d.line([tuple(np.rint(a).astype(int)),tuple(np.rint(b).astype(int))],fill='#141621',width=9)
        d.line([tuple(np.rint(a+[1,0]).astype(int)),tuple(np.rint(b+[1,0]).astype(int))],fill='#303547',width=3)
    else:
        a=np.array([132,98])+head_offset;b=point(t,(132,107))
        d=ImageDraw.Draw(cell);d.line([tuple(np.rint(a).astype(int)),tuple(np.rint(b).astype(int))],fill='#414331',width=9)
        d.line([tuple(np.rint(a+[1,0]).astype(int)),tuple(np.rint(b+[1,0]).astype(int))],fill='#939578',width=3)
    cell.alpha_composite(warp(self.layers['torso'],t))
    cell.alpha_composite(warp(self.secondary(self.layers['cloth'],p.get('cloth',0)),t))
    cell.alpha_composite(arm_images['near'])
    head=np.array(self.layers['head']);hair=p.get('hair',0)
    if self.name=='dio' and hair:
        # Hair tips above the forehead; no face pixel enters the deforming mask.
        changed=head.copy()
        for y in range(94,104):
            shift=round(hair*(104-y)/10)
            changed[y]=np.roll(head[y],shift,axis=0)
        head=changed
    cell.alpha_composite(warp(Image.fromarray(head),(np.eye(2),head_offset)))
    # Never normalize by each frame's bounds: the pivot remains fixed.
    if grounded:cell.paste((0,0,0,0),(0,224,256,256))
    a=np.array(cell);a[a[:,:,3]==0]=0
    # Remove only detached cut-boundary dust; full hands/feet remain connected.
    points=set(map(tuple,np.argwhere(a[:,:,3]>0)))
    while points:
        first=points.pop();component=[first];stack=[first]
        while stack:
            yy,xx=stack.pop()
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    q=(yy+dy,xx+dx)
                    if q in points:points.remove(q);component.append(q);stack.append(q)
        if len(component)<16:
            for yy,xx in component:a[yy,xx]=0
    return Image.fromarray(a),{'legs':legs,'arms':arms,'headOffset':head_offset.tolist()}


def dio_specs():
    out={}
    def p(**kw):return kw
    def add(name,label,durations,poses,loop=False,ground=True):
        out[name]={'label':label,'durations':durations,'poses':poses,'loop':loop,'grounded':ground}
    add('idle','Idle',[11,9,10,11,9,10],[
        p(lean=0,nearHand=[0,0],farHand=[0,0],cloth=0),
        p(hip=-1,lean=-1,nearHand=[-1,-1],farHand=[1,-1],farWrist=-3,cloth=1,hair=1),
        p(hip=-2,lean=0,nearHand=[-2,-2],farHand=[2,-2],farWrist=-6,nearWrist=-2,cloth=2,hair=1),
        p(hip=-1,lean=1,nearHand=[-1,-1],farHand=[1,-2],farWrist=-4,cloth=1,hair=-1),
        p(lean=0,nearHand=[1,0],farHand=[0,-1],nearWrist=3,cloth=-1,hair=-1),
        p(hip=1,lean=-1,nearHand=[1,1],farHand=[-1,0],farWrist=3,nearWrist=1,cloth=-2)],True)
    near=[27,15,3,-9,3,15];far=[-32,-20,-8,4,-8,-20]
    for backwards in [False,True]:
        poses=[]
        for i in range(6):
            j=(5-i)%6 if backwards else i
            n,f=near[j],far[j]
            ny=0 if j<3 else [-4,-9,-4][j-3]
            fy=[-4,-9,-4][j] if j<3 else 5
            poses.append(p(hip=[6,5,6,7,6,5][j],lean=(-2 if backwards else 1)+[0,1,0,-1,0,1][j],head=[0,-4],
                nearFoot=[n,ny],farFoot=[f,fy],nearHand=[[-3,1],[-2,0],[0,-1],[2,-1],[3,0],[0,1]][j],
                farHand=[[1,-2],[0,-3],[-2,-2],[-3,0],[-1,1],[1,0]][j],farWrist=[-4,-6,-3,2,4,0][j],
                nearToe=0 if ny==0 else [-3,-6,-3][j-3],farToe=0 if fy==5 else -3,
                cloth=[0,1,2,1,-1,-2][j],hair=[0,1,1,0,-1,-1][j]))
        # Start near the approved stance, not on the widest crossing step.
        # Subsequent planted positions still track the fixed root speed.
        start=3 if backwards else 2
        poses=poses[start:]+poses[:start]
        # Backwards foot contact must advance in local space while root recedes.
        add('walkBack' if backwards else 'walkForward','Walk Back' if backwards else 'Walk Forward',[4]*6,poses,True)
    add('dashForward','Dash Forward',[2,2,3,3,3],[
        p(hip=7,lean=8,farFoot=[0,5],nearHand=[-2,-2],farHand=[2,-2],cloth=1),
        p(hip=8,lean=19,nearFoot=[-5,-4],farFoot=[6,5],nearHand=[-7,-4],farHand=[6,-8],nearWrist=-8,cloth=3,hair=-1),
        p(hip=6,lean=28,nearFoot=[-10,-10],farFoot=[12,5],nearHand=[-11,-8],farHand=[8,-12],farWrist=-12,cloth=5,hair=-2),
        p(hip=7,lean=22,nearFoot=[-5,-5],farFoot=[7,5],nearHand=[-8,-5],farHand=[5,-9],cloth=4,hair=-1),
        p(hip=4,lean=8,nearFoot=[-2,0],farFoot=[2,5],nearHand=[-3,-2],farHand=[2,-3],cloth=2)],False)
    add('backdash','Backdash',[2,2,3,3,3],[
        p(hip=8,lean=-6,farFoot=[0,5],nearHand=[1,-2],farHand=[1,-2],cloth=-1),
        p(hip=2,lean=-12,nearFoot=[-3,-5],farFoot=[-5,-3],nearHand=[3,-5],farHand=[3,-6],cloth=-3,hair=1),
        p(hip=-1,lean=-17,nearFoot=[-5,-9],farFoot=[-8,-6],nearHand=[5,-8],farHand=[4,-9],farWrist=-8,cloth=-4,hair=2),
        p(hip=3,lean=-10,nearFoot=[-3,-3],farFoot=[-4,1],nearHand=[3,-5],farHand=[2,-5],cloth=-2,hair=1),
        p(hip=6,lean=-3,farFoot=[-2,5],nearHand=[1,-2],farHand=[1,-1],cloth=1)],False)
    crouch=p(hip=30,lean=6,nearFoot=[-6,0],farFoot=[6,5],nearHand=[3,-4],farHand=[2,-6],nearWrist=-4,farWrist=-12,cloth=-1)
    add('crouchStart','Crouch Start',[3,3],[p(hip=14,lean=3,farFoot=[3,5],nearHand=[1,-2],farHand=[1,-3],cloth=1),crouch])
    add('crouchIdle','Crouch Idle',[16,18],[crouch,{**crouch,'hip':31,'lean':7,'nearHand':[4,-5],'farHand':[1,-7],'cloth':1,'hair':1}],True)
    add('crouchEnd','Crouch End',[3,3],[p(hip=17,lean=4,farFoot=[3,5],nearHand=[2,-3],farHand=[1,-4],cloth=2),p(hip=3,lean=1,farFoot=[1,2],nearHand=[0,-1],farHand=[0,-1],cloth=1)])
    add('jumpStart','Jump Start',[1,1,2],[p(hip=6,lean=1,farFoot=[0,5],cloth=-1),p(hip=15,lean=4,farFoot=[2,5],nearHand=[2,-3],farHand=[1,-5],cloth=-2),p(hip=2,lean=2,nearFoot=[2,0],farFoot=[-2,5],nearHand=[-1,-5],farHand=[3,-7],cloth=2,hair=-1)])
    add('jumpRise','Jump Rise',[4,5],[p(hip=0,lean=5,nearFoot=[7,-7],farFoot=[-5,-5],nearHand=[-3,-8],farHand=[4,-10],cloth=2,hair=1),p(hip=1,lean=7,nearFoot=[13,-17],farFoot=[-9,-12],nearHand=[-5,-12],farHand=[6,-14],nearToe=-5,farToe=-5,cloth=3,hair=2)],False,False)
    add('jumpApex','Jump Apex',[8],[p(hip=2,lean=4,nearFoot=[15,-20],farFoot=[-11,-15],nearHand=[-4,-10],farHand=[5,-12],nearToe=-7,farToe=-4,cloth=2,hair=1)],False,False)
    add('jumpFall','Jump Fall',[4,5],[p(hip=1,lean=1,nearFoot=[10,-12],farFoot=[-7,-8],nearHand=[-2,-6],farHand=[3,-8],nearToe=-3,cloth=-2,hair=-1),p(hip=2,lean=-1,nearFoot=[3,-3],farFoot=[-2,2],nearHand=[0,-2],farHand=[1,-3],cloth=-3,hair=-1)],False,False)
    add('landing','Landing',[2,2,2],[p(hip=11,lean=3,farFoot=[1,5],nearHand=[2,-4],farHand=[1,-5],cloth=-3,hair=-1),p(hip=18,lean=4,nearFoot=[-2,0],farFoot=[3,5],nearHand=[3,-5],farHand=[2,-6],cloth=-1,hair=1),p(hip=5,lean=1,farFoot=[1,5],nearHand=[1,-1],farHand=[0,-2],cloth=2,hair=1)])
    return out


def world_specs():
    out={}
    def p(**kw):return kw
    def add(name,label,durations,poses,loop=True):out[name]={'label':label,'durations':durations,'poses':poses,'loop':loop,'grounded':False}
    add('standIdle','Stand Idle',[10,9,9,10,9,9],[
      p(nearHand=[0,0],farHand=[0,0]),p(hip=-1,lean=-1,nearHand=[1,-1],farHand=[1,-1],nearFoot=[1,-1],farFoot=[-1,-1],cloth=1),
      p(hip=-2,lean=0,nearHand=[2,-2],farHand=[0,-2],nearFoot=[2,-2],farFoot=[-2,-2],nearWrist=-3,cloth=2),
      p(hip=-1,lean=1,nearHand=[1,-2],farHand=[-1,-1],nearFoot=[1,-2],farFoot=[-1,-1],farWrist=3,cloth=1),
      p(lean=0,nearHand=[-1,0],farHand=[-1,1],nearFoot=[0,-1],farFoot=[1,-1],nearWrist=2,cloth=-1),
      p(hip=1,lean=-1,nearHand=[0,1],farHand=[1,1],nearFoot=[-1,0],farFoot=[1,0],farWrist=-2,cloth=-2)])
    add('floating','Floating',[8,7,8,8,7,8],[
      p(hip=0,lean=0,nearFoot=[3,-3],farFoot=[-2,-2],nearHand=[1,-2],farHand=[-1,-2],nearToe=-2,cloth=1),
      p(hip=-1,lean=1,nearFoot=[5,-5],farFoot=[-3,-4],nearHand=[2,-3],farHand=[0,-3],nearToe=-4,farToe=-2,cloth=2),
      p(hip=-2,lean=2,nearFoot=[6,-7],farFoot=[-4,-5],nearHand=[1,-4],farHand=[1,-4],nearToe=-5,farToe=-3,cloth=3),
      p(hip=-1,lean=1,nearFoot=[5,-6],farFoot=[-3,-5],nearHand=[0,-3],farHand=[2,-3],nearToe=-3,farWrist=-4,cloth=1),
      p(hip=1,lean=0,nearFoot=[3,-4],farFoot=[-1,-3],nearHand=[-1,-2],farHand=[1,-1],farToe=2,cloth=-1),
      p(hip=0,lean=-1,nearFoot=[2,-2],farFoot=[0,-1],nearHand=[0,-1],farHand=[-1,-1],nearWrist=3,cloth=-2)])
    for backward in [False,True]:
      poses=[]
      for i in range(6):
        v=[0,1,2,1,-1,-2][i]
        poses.append(p(hip=[0,-1,-2,-1,0,1][i],lean=(-5-v if backward else 7+v),
          nearHand=[3+v,-4-v] if backward else [-3-v,-2-v],farHand=[2+v,-5-v] if backward else [-4-v,-3-v],
          nearFoot=[4+v+(i%2),-5-v-(i//3)],farFoot=[-3-v,-4-v+(i//3)],nearToe=-3-v,farToe=2+v,nearWrist=v*2,farWrist=-v*2,cloth=-v if backward else v))
      add('followBackward' if backward else 'followForward','Follow Backward' if backward else 'Follow Forward',[4]*6,poses)
    add('dashFollow','Dash Follow',[2,2,3,3,3],[
      p(lean=8,nearHand=[3,-5],farHand=[3,-6],nearFoot=[5,-5],farFoot=[-3,-4],cloth=1),
      p(hip=-1,lean=17,nearHand=[6,-9],farHand=[6,-10],nearFoot=[9,-13],farFoot=[-5,-9],nearToe=-8,cloth=3),
      p(hip=-2,lean=25,nearHand=[10,-13],farHand=[9,-13],nearFoot=[14,-22],farFoot=[-9,-16],nearToe=-12,farToe=-7,cloth=4),
      p(hip=-1,lean=20,nearHand=[7,-10],farHand=[7,-11],nearFoot=[11,-17],farFoot=[-7,-12],nearToe=-8,cloth=2),
      p(lean=10,nearHand=[4,-6],farHand=[3,-7],nearFoot=[6,-8],farFoot=[-4,-6],nearToe=-4,cloth=-1)],False)
    add('jumpFollow','Jump Follow',[5,6,7,7],[
      p(lean=2,nearHand=[1,-5],farHand=[2,-6],nearFoot=[4,-8],farFoot=[-3,-6],nearToe=-3,cloth=1),
      p(hip=-1,lean=6,nearHand=[3,-8],farHand=[4,-9],nearFoot=[9,-17],farFoot=[-6,-13],nearToe=-7,farToe=-4,cloth=3),
      p(hip=1,lean=4,nearHand=[2,-7],farHand=[3,-8],nearFoot=[12,-21],farFoot=[-8,-14],nearToe=-9,farToe=-5,cloth=1),
      p(hip=2,lean=1,nearHand=[0,-3],farHand=[1,-4],nearFoot=[6,-9],farFoot=[-3,-4],nearToe=-3,farToe=-1,cloth=-2)],False)
    add('returnPosition','Return to Position',[3,3,3,4,5],[
      p(lean=-7,nearHand=[4,-5],farHand=[3,-5],nearFoot=[9,-11],farFoot=[-5,-8],nearToe=-7,cloth=-3),
      p(hip=1,lean=-4,nearHand=[3,-4],farHand=[2,-4],nearFoot=[7,-8],farFoot=[-4,-6],nearToe=-5,cloth=-2),
      p(hip=2,lean=-1,nearHand=[2,-2],farHand=[1,-3],nearFoot=[5,-5],farFoot=[-2,-4],nearToe=-3,cloth=-1),
      p(hip=1,lean=1,nearHand=[1,-1],farHand=[0,-2],nearFoot=[2,-3],farFoot=[-1,-2],farWrist=3,cloth=1),
      p(lean=0,nearHand=[0,0],farHand=[-1,-1],nearFoot=[1,-1],farFoot=[0,-1],nearWrist=-2,cloth=0)],False)
    return out


def build(name,definitions):
    art=ROOT/f'art/{name}';out=ROOT/f'public/sprites/{name}';rig=Rig(name)
    timing_file=art/'movement-timing.json'
    if timing_file.exists():
        timings=json.loads(timing_file.read_text())
        if set(timings)-set(definitions):raise ValueError(f'{name}: unknown animation in movement-timing.json')
        for key,values in timings.items():
            if len(values)!=len(definitions[key]['poses']) or not all(type(t) is int and t>0 for t in values):
                raise ValueError(f'{name}/{key}: expected one positive integer duration per frame')
            definitions[key]['durations']=values
    else:timing_file.write_text(json.dumps({key:c['durations'] for key,c in definitions.items()},indent=2)+'\n')
    lock=art/'movement-base-lock.json';digest=hashlib.sha256((art/'base-native.png').read_bytes()).hexdigest()
    if lock.exists() and json.loads(lock.read_text())['sha256']!=digest:raise ValueError(f'{name}: approved base changed')
    lock.write_text(json.dumps({'file':'base-native.png','sha256':digest},indent=2)+'\n')
    config={'sheet':f'{name}/base.png','frameWidth':256,'frameHeight':256,'columns':1,'pivot':{'x':128,'y':224},'scale':1,'clips':{}}
    manifest={'id':name,'cell':[256,256],'pivot':{'x':128,'y':224},'baseSha256':digest,'clips':{}}
    rows=[]
    for key,clip in definitions.items():
        frames=[];joints=[]
        for i,p in enumerate(clip['poses']):
            image,anchors=rig.render(p,clip['grounded']);frames.append(image);joints.append(anchors)
            image.save(out/f'{key}-{i:02}.png')
        if len({f.tobytes() for f in frames})!=len(frames):raise ValueError(f'{name}/{key}: duplicate frames')
        shapes=[(f.crop(f.getbbox()).size,f.crop(f.getbbox()).tobytes()) for f in frames]
        if len(set(shapes))!=len(frames):raise ValueError(f'{name}/{key}: translation-only frame')
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,frame in enumerate(frames):sheet.paste(frame,(256*i,0))
        sheet.save(out/f'{key}.png')
        config['clips'][key]={'sheet':f'{name}/{key}.png','columns':len(frames),'frames':list(range(len(frames))),'ticks':clip['durations'][0],
            'durations':clip['durations'],'loop':clip['loop']}
        manifest['clips'][key]={k:v for k,v in clip.items() if k!='poses'}
        manifest['clips'][key].update({'sheet':f'{key}.png','count':len(frames),'bounds':[f.getbbox() for f in frames],'anchors':joints})
        tiles=[]
        for frame in frames:
            bg=Image.new('RGBA',(256,256),'#596674');bg.alpha_composite(frame)
            ImageDraw.Draw(bg).line((0,224,255,224),fill='#a1afb3');tiles.append(bg)
        preview=Image.new('RGBA',sheet.size)
        for i,tile in enumerate(tiles):preview.paste(tile,(256*i,0))
        preview.resize((preview.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
        scaled=[tile.resize((768,768),Image.Resampling.NEAREST) for tile in tiles]
        scaled[0].save(out/f'{key}-animated.png',save_all=True,append_images=scaled[1:],duration=[round(t*1000/60) for t in clip['durations']],loop=0,disposal=0,blend=0)
        rows.append((key,preview))
    # Keep an explicitly named source pose and the legacy Stand hover alias.
    config['clips']['base']={'sheet':f'{name}/base.png','columns':1,'frames':[0],'ticks':60,'durations':[60],'loop':True}
    if name=='the-world':config['clips']['hover']={**config['clips']['floating']}
    (ROOT/f'src/data/{name}-animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'movement.json').write_text(json.dumps(manifest,indent=2)+'\n')
    base_manifest=json.loads((out/'manifest.json').read_text())
    base_manifest.update({'baseOnly':False,'baseDrawnFrames':1,'drawnFrames':sum(c['count'] for c in manifest['clips'].values()),'animationClips':len(manifest['clips']),
       'method':'approved native base, rigid articulated painted limbs and IK, independent face/hair/cloth; no new AI redraw'})
    (out/'manifest.json').write_text(json.dumps(base_manifest,indent=2)+'\n')
    (art/'movement-rig.json').write_text(json.dumps(definitions,indent=2)+'\n')
    overview=Image.new('RGBA',(1536,len(rows)*280),'#15222b');d=ImageDraw.Draw(overview)
    for i,(key,row) in enumerate(rows):d.text((8,i*280+3),key,fill='#edd4a0');overview.paste(row,(0,i*280+24))
    overview.save(out/'movement-overview.png')
    return manifest


if __name__=='__main__':
    manifests=[build('dio',dio_specs()),build('the-world',world_specs())]
    target=ROOT/'public/downloads/dio-the-world-movement.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
        for manifest in manifests:
            name=manifest['id'];out=ROOT/f'public/sprites/{name}'
            for file in ['base.png','palette.json','animations.json','movement.json']:archive.write(out/file,f'{name}/{file}')
            for key,clip in manifest['clips'].items():
                archive.write(out/clip['sheet'],f'{name}/{clip["sheet"]}')
                for i in range(clip['count']):archive.write(out/f'{key}-{i:02}.png',f'{name}/cells/{key}-{i:02}.png')
        for file in ['dio-movement.json','dio-visual.json','the-world-visual.json']:
            archive.write(ROOT/f'src/data/{file}',f'metadata/{file}')
        for name in ['dio','the-world']:
            archive.write(ROOT/f'art/{name}/movement-timing.json',f'metadata/{name}-movement-timing.json')
        archive.writestr('LEIA-ME.txt','Dio: 13 clipes/45 quadros. The World: 7 clipes/38 quadros.\n83 quadros articulados a partir das bases aprovadas, sem redesenho por IA.\nPNG RGBA256x256, pivo128,224, sem suavizacao. Duracoes/loops/ancoras em movement.json.\nNao inclui golpes ou combate de Dio.\n')
    qa=ROOT/'art/dio/qa/movement';qa.mkdir(parents=True,exist_ok=True)
    groups=[('dio-ground','dio',list(dio_specs())[:8]),('dio-jump','dio',list(dio_specs())[8:]),('world-all','the-world',list(world_specs()))]
    for label,name,keys in groups:
        board=Image.new('RGB',(900,184*len(keys)),'#192833');draw=ImageDraw.Draw(board)
        for row,key in enumerate(keys):
            clip=next(m for m in manifests if m['id']==name)['clips'][key]
            draw.text((8,row*184+3),f'{name} / {key}',fill='#edc984')
            for i in range(clip['count']):
                cell=Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png').convert('RGBA')
                tile=Image.new('RGBA',(150,164),'#596674');tile.alpha_composite(cell.crop((60,70,210,234)))
                ImageDraw.Draw(tile).line((0,154,149,154),fill='#a1afb3')
                board.paste(tile.convert('RGB'),(150*i,row*184+20))
        board.save(qa/f'contact-{label}.png')
    print(json.dumps({m['id']:{'clips':len(m['clips']),'frames':sum(c['count'] for c in m['clips'].values())} for m in manifests}))
