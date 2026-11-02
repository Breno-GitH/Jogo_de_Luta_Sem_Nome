"""Goku locomotion: painted source, native palette, articulated segments and IK.

The existing character files are locked before export. Walking exports one
drawing per fixed tick to match a planted sole to the engine's root velocity.
"""
from pathlib import Path
import json,hashlib,math,zipfile,copy
import numpy as np
from PIL import Image,ImageDraw
from build_linked_movement import rigid,point,warp,align,solve,mask

ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku';OUT=ROOT/'public/sprites/goku';PIVOT={'x':128,'y':224}
PALETTE=['#080a10','#141621','#202331','#303547','#444c62',
 '#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8',
 '#542119','#883116','#ac3c0b','#d95208','#f67a14','#ff9b2b','#ffbc57',
 '#071326','#0c2146','#173a6b','#24599a','#3272b5','#5a91c8',
 '#5b2020','#a43929','#e35e35','#49341f','#ac7940','#f1d38a','#fff0d4','#f1f5f5']
MOTION=dict(speed=6.1,backSpeed=5.8,airSpeed=6.5,jump=-17.7,gravity=.72,jumpStartup=6,landingTicks=6,
 dashForward=[4,9,14,19,22,22,22,21,19,16,12,8,4,0],backdash=[3,6,11,15,18,18,18,17,15,12,9,6,3,0])

def preserve():
 file=ART/'preservation.json'
 if not file.exists():
  data={}
  for who in ['samurai','dio','the-world']:
   for f in (ROOT/f'public/sprites/{who}').glob('*.png'):data[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
   for folder,name in [('src/data',who+'.json'),('src/data',who+'-animations.json')]:
    f=ROOT/folder/name
    if f.exists():data[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
  file.write_text(json.dumps(data,indent=2)+'\n')
 for name,h in json.loads(file.read_text()).items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==h,name

def native():
 source=Image.open(ART/'generated-base.png').convert('RGBA');source.putalpha(source.getchannel('A').point(lambda a:255 if a>=180 else 0))
 crop=source.crop(source.getbbox());small=crop.resize((round(crop.width*130/crop.height),130),Image.Resampling.NEAREST)
 pal=Image.new('P',(1,1));values=[v for c in PALETTE for v in bytes.fromhex(c[1:])];pal.putpalette(values+values[:3]*(256-len(PALETTE)))
 small_rgb=small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');small_rgb.putalpha(small.getchannel('A'))
 a=np.array(small_rgb);a[a[:,:,3]==0]=0;small_rgb=Image.fromarray(a)
 im=Image.new('RGBA',(256,256));im.paste(small_rgb,(128-small.width//2,94));im.save(ART/'base-native.png');im.save(OUT/'base.png')
 (OUT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n');return im

def box(points,pad=0):
 a=np.array(points);lo=np.floor(a.min(axis=0)-pad).astype(int);hi=np.ceil(a.max(axis=0)+pad).astype(int)
 return dict(x=int(lo[0]-128),y=int(lo[1]-224),w=max(1,int(hi[0]-lo[0])),h=max(1,int(hi[1]-lo[1])))

class GokuRig:
 def __init__(self,base):
  self.base=base;self.pelvis=[129,157];self.headAnchor=[131,122]
  self.arms={'near':[[102,132],[98,145],[113,150]],'far':[[145,138],[155,149],[162,136]]}
  self.legs={'near':[[123,159],[103,185],[86,213]],'far':[[137,159],[154,185],[164,211]]}
  source=np.array(base);yy,xx=np.mgrid[:256,:256];labels=np.full((256,256),'torso',dtype='U12')
  labels[(yy>=157)&(xx<130)]='nearLeg';labels[(yy>=157)&(xx>=130)]='farLeg'
  # Torso includes the waist knot; hanging blue fabric is a separate layer.
  labels[mask([(115,152),(137,152),(142,161),(132,164),(116,161)])]='torso'
  blue=np.zeros((256,256),bool)
  for color in PALETTE[18:24]:blue|=np.all(source[:,:,:3]==list(bytes.fromhex(color[1:])),axis=2)
  cloth=blue&(yy>=159)&(yy<184)&(xx>=121)&(xx<=140);labels[cloth]='cloth'
  labels[mask([(139,128),(149,128),(155,143),(160,139),(160,132),(164,127),(169,128),(171,134),(170,142),(164,148),(160,153),(153,155),(146,151),(139,144)])]='farArm'
  labels[mask([(99,123),(105,125),(109,131),(106,139),(109,144),(115,143),(121,143),(123,148),(119,153),(112,154),(104,153),(97,151),(94,148),(94,141),(97,132)])]='nearArm'
  labels[mask([(104,112),(110,101),(124,94),(144,94),(151,101),(150,109),(157,113),(153,118),(146,121),(145,126),(138,128),(130,125),(126,121),(120,124),(114,120),(105,119)])]='head'
  # Include every hair pixel, but keep shoulders separate from the neck.
  labels[(yy<121)&(xx>=108)]='head'
  self.layers={}
  for label in ['torso','head','cloth','nearLeg','farLeg','nearArm','farArm']:
   a=source.copy();a[labels!=label]=0;self.layers[label]=Image.fromarray(a)
  for side in ['far','near']:
   a=np.array(self.layers[side+'Leg']);k=self.legs[side][1];ankle=self.legs[side][2]
   # Fill only the small sash underlap hidden by the original hanging pixels.
   under=cloth&((xx<130) if side=='near' else (xx>=130))
   a[under]=[*bytes.fromhex('d95208'),255]
   boot=199 if side=='near' else 198
   for name,region in [('thigh',yy<=k[1]+3),('shin',(yy>=k[1]-3)&(yy<=boot+3)),('boot',yy>=boot-2),('knee',(abs(xx-k[0])<10)&(abs(yy-k[1])<6))]:
    layer=a.copy();layer[~region]=0;self.layers[side+name]=Image.fromarray(layer)
   boot_pixels=np.array(self.layers[side+'boot'])
   for color in PALETTE[11:18]:boot_pixels[np.all(boot_pixels[:,:,:3]==list(bytes.fromhex(color[1:])),axis=2)]=0
   self.layers[side+'boot']=Image.fromarray(boot_pixels)
   a=np.array(self.layers[side+'Arm'])
   regions=([yy<=145,(yy>=139)&(xx<=116),xx>=109] if side=='near' else [(xx<=157)&(yy<=151),(xx>=150)&(yy>=133),(xx>=159)&(yy<=142)])
   for name,region in zip(['upper','fore','hand'],regions):
    layer=a.copy();layer[~region]=0;self.layers[side+name]=Image.fromarray(layer)
  target=ART/'layers';target.mkdir(exist_ok=True)
  for name,im in self.layers.items():im.save(target/f'{name}.png')

 def render(self,p,ground):
  t=rigid(self.pelvis,p.get('lean',0),(p.get('x',0),p.get('hip',0)));im=Image.new('RGBA',(256,256));anchors={'arms':{},'legs':{}}
  def underlay(points,width,color):
   d=ImageDraw.Draw(im);d.line([tuple(np.rint(q).astype(int)) for q in points],fill=color,width=width)
  leg_images={}
  for side in ['far','near']:
   hip0,k0,a0=map(np.array,self.legs[side]);hip=point(t,hip0);target=np.array(p.get(side+'Ankle',a0),float)
   hint=np.array(p.get(side+'Knee',hip+[36,13]));l1=np.linalg.norm(k0-hip0);l2=np.linalg.norm(a0-k0)
   vector=target-hip;radius=abs(l1-l2)+.05;length=np.linalg.norm(vector)
   if length<radius:target=hip+(vector/max(.01,length))*radius
   knee,target=solve(hip,target,l1,l2,hint,ground and side in p.get('support',['near','far']))
   def contour(widths):
    pts=[hip,knee,target];v1=(knee-hip)/max(.01,np.linalg.norm(knee-hip));v2=(target-knee)/max(.01,np.linalg.norm(target-knee));normals=[np.array([-v1[1],v1[0]]),np.array([-(v1[1]+v2[1]),v1[0]+v2[0]]),np.array([-v2[1],v2[0]])]
    normals=[n/max(.01,np.linalg.norm(n)) for n in normals]
    return [tuple(np.rint(p+n*w).astype(int)) for p,n,w in zip(pts,normals,widths)]+[tuple(np.rint(p-n*w).astype(int)) for p,n,w in reversed(list(zip(pts,normals,widths)))]
   silhouette=Image.new('L',(256,256));ImageDraw.Draw(silhouette).polygon(contour([12,11,6]),fill=255)
   leg=Image.new('RGBA',(256,256));d=ImageDraw.Draw(leg)
   d.polygon(contour([12,11,6]),fill='#542119');d.polygon(contour([10,9,5]),fill='#d95208')
   leg.alpha_composite(warp(self.layers[side+'thigh'],align(hip0,k0,hip,knee)))
   leg.alpha_composite(warp(self.layers[side+'shin'],align(k0,a0,knee,target)))
   ta=math.degrees(math.atan2(*(knee-hip)[::-1])-math.atan2(*(k0-hip0)[::-1]));sa=math.degrees(math.atan2(*(target-knee)[::-1])-math.atan2(*(a0-k0)[::-1]))
   leg.alpha_composite(warp(self.layers[side+'knee'],rigid(k0,(ta+sa)*.5,knee-k0)))
   # Confine the painted source to the new bent fabric silhouette. Without
   # this mask, broad trouser hems survive as disconnected triangular shards.
   a=np.array(leg);a[:,:,3]=np.minimum(a[:,:,3],np.array(silhouette));a[a[:,:,3]==0]=0;leg=Image.fromarray(a)
   d=ImageDraw.Draw(leg)
   for delta,color in [(0,'#883116'),(2,'#ff9b2b')]:
    v=(knee-hip)/max(.01,np.linalg.norm(knee-hip));n=np.array([-v[1],v[0]])
    for run in [.66,.83]:
     q=hip+(knee-hip)*run+n*delta
     d.line([tuple(np.rint(q-n*4).astype(int)),tuple(np.rint(q+n*3+v*2).astype(int))],fill=color,width=1)
   boot_source=self.layers[side+'boot']
   if side=='near' and p.get('forwardBoot'):boot_source=warp(boot_source,(np.array([[-1,0],[0,1]]),np.array([2*a0[0],0])))
   boot=warp(boot_source,rigid(a0,p.get(side+'Toe',0),target-a0))
   if ground and side in p.get('support',['near','far']):
    b=boot.getbbox();shift=224-b[3]
    if shift:boot=warp(boot,(np.eye(2),np.array([0,shift])))
   leg.alpha_composite(boot);leg_images[side]=leg;anchors['legs'][side]=[hip.tolist(),knee.tolist(),target.tolist()]
  for side in p.get('legOrder',['far','near']):im.alpha_composite(leg_images[side])
  arms={}
  for side in ['far','near']:
   s0,e0,w0=map(np.array,self.arms[side]);shoulder=point(t,s0);target=np.array(p.get(side+'Hand',point(t,w0)))
   elbow,target=solve(shoulder,target,np.linalg.norm(e0-s0),np.linalg.norm(w0-e0),point(t,e0)+p.get(side+'Elbow',[0,0]))
   arm=Image.new('RGBA',(256,256));d=ImageDraw.Draw(arm);pts=[tuple(np.rint(q).astype(int)) for q in [shoulder,elbow,target]]
   d.line(pts,fill='#92513c',width=7);d.line(pts,fill='#e7a776',width=5)
   arm.alpha_composite(warp(self.layers[side+'upper'],align(s0,e0,shoulder,elbow)))
   arm.alpha_composite(warp(self.layers[side+'fore'],align(e0,w0,elbow,target)))
   arm.alpha_composite(warp(self.layers[side+'hand'],rigid(w0,p.get(side+'Wrist',0),target-w0)))
   arms[side]=arm;anchors['arms'][side]=[shoulder.tolist(),elbow.tolist(),target.tolist()]
  im.alpha_composite(arms['far']);im.alpha_composite(warp(self.layers['torso'],t))
  cloth=np.array(self.layers['cloth']);out=np.zeros_like(cloth)
  for y in range(256):
   shift=round(p.get('cloth',0)*min(1,max(0,(y-156)/25)));out[y]=np.roll(cloth[y],shift,axis=0)
  im.alpha_composite(warp(Image.fromarray(out),t));im.alpha_composite(arms['near'])
  headOffset=np.rint(point(t,self.headAnchor)-self.headAnchor+p.get('head',[0,0])).astype(int)
  head=np.array(self.layers['head']);hair=p.get('hair',0)
  if hair:
   original=head.copy()
   for y in range(94,112):head[y]=np.roll(original[y],round(hair*(112-y)/18),axis=0)
  im.alpha_composite(warp(Image.fromarray(head),(np.eye(2),headOffset)))
  hurt=[box([[124+headOffset[0],108+headOffset[1]],[142+headOffset[0],130+headOffset[1]]]),box([point(t,q) for q in [(108,126),(143,128),(140,158),(115,158)]])]
  for kind in ['arms','legs']:
   for side,pts in anchors[kind].items():
    for a,b in zip(pts,pts[1:]):hurt.append(box([a,b],5))
  roll=p.get('roll',0)
  if roll:
   rotation=rigid((129,185),roll);im=warp(im,rotation)
   shift=224-im.getbbox()[3] if ground else 0
   if shift:im=warp(im,(np.eye(2),np.array([0,shift])))
   rotation=(rotation[0],rotation[1]+np.array([0,shift]));hurt=[box([point(rotation,(b['x']+128+dx,b['y']+224+dy)) for dx in [0,b['w']] for dy in [0,b['h']]]) for b in hurt]
  a=np.array(im);a[a[:,:,3]==0]=0
  points=set(map(tuple,np.argwhere(a[:,:,3]>0)))
  while points:
   first=points.pop();group=[first];stack=[first]
   while stack:
    y,x=stack.pop()
    for dy in [-1,0,1]:
     for dx in [-1,0,1]:
      q=(y+dy,x+dx)
      if q in points:points.remove(q);group.append(q);stack.append(q)
   if len(group)<8:
    for y,x in group:a[y,x]=0
  im=Image.fromarray(a)
  if ground:assert im.getbbox()[3]<=224,('floor penetration',p,im.getbbox())
  return im,dict(anchors=anchors,headOffset=headOffset.tolist(),hurtboxes=hurt,hitboxes=[])

def definitions():
 out={}
 def pose(**kw):return {**dict(nearAnkle=[86,213],farAnkle=[164,211],support=['near','far']),**kw}
 def add(key,label,ps,times,loop=False,ground=True,**extra):out[key]=dict(label=label,poses=ps,durations=times,loop=loop,grounded=ground,**extra)
 add('idle','Idle',[pose(hip=h,lean=l,nearHand=[113+a,150-b],farHand=[162-a,136-b],cloth=c,hair=hair) for h,l,a,b,c,hair in [(0,0,0,0,0,0),(-.7,-.5,1,1,1,0),(-1.2,-1,2,2,2,1),(-.8,-.6,1,1,1,1),(-.2,0,-1,0,-1,0),(.4,.4,0,-1,-2,-1)]],[10,9,10,11,10,10],True)
 for backward in [False,True]:
  speed=MOTION['backSpeed'] if backward else MOTION['speed'];ps=[]
  for i in range(20):
   feet={};support=[]
   for side,phase,center,ay in [('near',i,125,213),('far',(i+10)%20,136,211)]:
    if phase<10:x=(5-phase)*speed;y=0;support.append(side)
    else:
     u=(phase-10)/10;x=(-5+10*u)*speed;y=-17*math.sin(math.pi*u)
    feet[side+'Ankle']=[center+(-x if backward else x),ay+y]
    feet[side+'Toe']=-6*math.sin(math.pi*max(0,(phase-10)/10)) if phase>=10 else 0
   wave=math.sin(i*math.pi/10);hip=8+2*math.sin(i*math.pi/5)
   p=pose(hip=hip,lean=-3+wave if backward else 2+wave,nearHand=[113+(-3 if backward else 6)*wave,148-abs(wave)*2],farHand=[159+(3 if backward else -6)*wave,135-abs(wave)*2],nearWrist=wave*4,farWrist=-wave*4,cloth=wave*3,hair=-wave,head=[0,-hip*.15],**feet)
   p['support']=support;p['forwardBoot']=True;p['legOrder']=['far','near'] if i<10 else ['near','far'];ps.append(p)
  add('walkBack' if backward else 'walkForward','Walk Back' if backward else 'Walk Forward',ps,[1]*20,True,rootSpeed=-speed if backward else speed,authoredCyclePhases=['contact','down','passing','up','opposite contact'])
 add('dashForward','Dash Forward',[
  pose(hip=6,lean=7,nearHand=[110,145],farHand=[161,132],cloth=-1),
  pose(hip=11,lean=20,nearAnkle=[86,210],farAnkle=[165,211],nearHand=[104,143],farHand=[155,126],cloth=-3),
  pose(hip=4,lean=29,nearAnkle=[104,195],farAnkle=[165,202],nearHand=[104,137],farHand=[155,120],cloth=-5,support=[]),
  pose(hip=2,lean=30,nearAnkle=[111,192],farAnkle=[159,198],nearHand=[106,136],farHand=[156,121],cloth=-4,support=[]),
  pose(hip=7,lean=16,nearAnkle=[105,211],farAnkle=[162,211],nearHand=[110,145],farHand=[160,130],cloth=-2),
  pose(hip=1,lean=3,nearAnkle=[90,213],farAnkle=[164,211],nearHand=[113,149],farHand=[162,136],cloth=1)], [2,2,3,3,2,2])
 add('backdash','Backdash',[
  pose(hip=6,lean=-3,nearHand=[116,146],farHand=[163,132]),pose(hip=10,lean=-10,nearHand=[119,143],farHand=[166,128],cloth=2),
  pose(hip=-2,lean=-15,nearAnkle=[98,201],farAnkle=[159,198],nearHand=[119,139],farHand=[167,123],cloth=4,support=[]),
  pose(hip=1,lean=-12,nearAnkle=[97,202],farAnkle=[159,201],nearHand=[118,142],farHand=[166,128],cloth=3,support=[]),
  pose(hip=8,lean=-5,nearHand=[115,146],farHand=[163,132],cloth=1),pose(hip=1,lean=-1,nearHand=[113,150],farHand=[162,136],cloth=-1)], [2,2,3,3,2,2])
 def crouch(h,breath=0):return pose(hip=h,x=-h*.12,lean=h*.2,nearHand=[113+h*.18,150+h*.15+breath],farHand=[162-h*.12,136+h*.26+breath],nearWrist=-h*.2,farWrist=-h*.12,nearKnee=[119+h*.7,185+h*.15],farKnee=[155+h*.7,185+h*.05],cloth=-h*.05+breath,hair=breath)
 add('crouchStart','Crouch Start',[crouch(h) for h in [8,21,34]],[2,2,2])
 add('crouchIdle','Crouch Idle',[crouch(34,0),crouch(33,-1),crouch(34.7,.8)],[12,14,14],True)
 add('crouchEnd','Crouch End',[crouch(h) for h in [24,12,1]],[2,2,2])
 add('jumpStart','Jump Start',[crouch(10),crouch(23),pose(hip=-2,lean=3,nearHand=[112,139],farHand=[163,123],cloth=-2)],[2,2,2])
 rise=[pose(hip=-2,lean=3,nearAnkle=[102,202],farAnkle=[155,202],nearHand=[111,137],farHand=[163,122],support=[],cloth=-2),pose(hip=-1,lean=5,nearAnkle=[115,190],farAnkle=[154,196],nearHand=[110,131],farHand=[161,117],support=[],cloth=-3,hair=1),pose(hip=0,lean=3,nearAnkle=[117,185],farAnkle=[153,193],nearHand=[111,130],farHand=[160,118],support=[],cloth=-2,hair=1)]
 apex=[pose(hip=1,lean=1,nearAnkle=[116,185],farAnkle=[153,193],nearHand=[112,132],farHand=[161,121],support=[],cloth=1),pose(hip=1.5,lean=0,nearAnkle=[113,188],farAnkle=[155,197],nearHand=[113,134],farHand=[162,123],support=[],cloth=2)]
 fall=[pose(hip=1,lean=-1,nearAnkle=[108,194],farAnkle=[160,202],nearHand=[114,138],farHand=[163,127],support=[],cloth=3),pose(hip=2,lean=-1,nearAnkle=[97,205],farAnkle=[163,208],nearHand=[115,143],farHand=[164,131],support=[],cloth=2),pose(hip=0,lean=0,nearHand=[114,147],farHand=[163,135],support=[],cloth=1)]
 for key,ps in [('jumpRise',rise),('jumpApex',apex),('jumpFall',fall)]:
  for suffix,lean in [('',0),('Forward',9),('Backward',-8)]:
   add(key+suffix,key+(' '+suffix if suffix else ''),[{**p,'lean':p.get('lean',0)+lean,'nearAnkle':[p['nearAnkle'][0]-lean*.3,p['nearAnkle'][1]],'farAnkle':[p['farAnkle'][0]-lean*.2,p['farAnkle'][1]]} for p in ps],[4]*len(ps),False,False)
 add('landing','Landing',[crouch(20),crouch(10),crouch(0)],[2,2,2])
 # Explicit training support, separate from the requested locomotion package.
 # No attack sprites, hitboxes or special commands are supplied at this stage.
 add('trainingHit','Reação provisória de treino',[pose(lean=l,hip=h,nearHand=[110,148+i],farHand=[157,135+i],cloth=-i) for i,(l,h) in enumerate([(-7,2),(-15,4),(-6,1)])],[4]*3)
 add('trainingAirHit','Reação aérea provisória',[{**rise[min(i,2)],'lean':-8-i*4,'roll':-i*7} for i in range(3)],[5]*3,False,False)
 down=[pose(hip=3,lean=-6,nearHand=[111,150],farHand=[160,142],roll=r,cloth=i) for i,r in enumerate([-28,-64,-90])]
 add('trainingDown','Queda provisória de treino',down,[8,8,12])
 add('trainingGetup','Recuperação provisória',[pose(hip=h,lean=l,nearHand=[112,151],farHand=[158,140],roll=r,cloth=i) for i,(r,h,l) in enumerate([(-90,3,-6),(-44,20,4),(0,12,3),(0,0,0)])],[4,4,5,5])
 return out

def build():
 ART.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True);preserve();base=native();rig=GokuRig(base);defs=definitions()
 data=dict(sheet='goku/idle.png',frameWidth=256,frameHeight=256,pivot=PIVOT,scale=1,clips={});manifest=dict(id='goku',cell=[256,256],pivot=PIVOT,clips={});gait={}
 for key,c in defs.items():
  frames=[];poses=[]
  for i,p in enumerate(c['poses']):
   im,g=rig.render(p,c['grounded']);frames.append(im);poses.append(dict(ticks=c['durations'][i],phase='locomotion',**g));im.save(OUT/f'{key}-{i:02}.png')
  sheet=Image.new('RGBA',(256*len(frames),256))
  for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
  sheet.save(OUT/f'{key}.png');data['clips'][key]=dict(sheet=f'goku/{key}.png',columns=len(frames),frames=list(range(len(frames))),ticks=c['durations'][0],durations=c['durations'],loop=c['loop'])
  manifest['clips'][key]=dict(label=c['label'],sheet=key+'.png',count=len(frames),durations=c['durations'],loop=c['loop'],grounded=c['grounded'],support=[p.get('support',[]) for p in c['poses']],bounds=[f.getbbox() for f in frames],poses=poses)
  frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in c['durations']],loop=0,disposal=0,blend=0)
  preview=Image.new('RGBA',sheet.size,'#263745');preview.alpha_composite(sheet);preview.resize((sheet.width*2,512),Image.Resampling.NEAREST).save(OUT/f'{key}-preview.png')
  if key in ['walkForward','walkBack']:gait[key]=dict(speed=c['rootSpeed'],ticks=20,feet=[[g['anchors']['legs'][side][2][0] for side in ['near','far']] for g in poses],support=c['poses'][0].get('support',[]))
 (ROOT/'src/data/goku-animations.json').write_text(json.dumps(data,indent=2)+'\n');(OUT/'animations.json').write_text(json.dumps(data,indent=2)+'\n');(OUT/'movement.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (ROOT/'src/data/goku-gait.json').write_text(json.dumps(gait,indent=2)+'\n');(ART/'movement-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
 (ROOT/'src/data/goku-movement.json').write_text(json.dumps(MOTION,indent=2)+'\n')
 aliases={k:'trainingHit' for k in ['damageLight','damageMedium','damageHeavy','grabbed']};aliases.update(dict(damageCrouch='crouchIdle',damageAir='trainingAirHit',launched='trainingAirHit',falling='trainingAirHit',downed='trainingDown',getup='trainingGetup',ko='trainingDown',defeat='trainingDown',entrance='idle',victory='idle',guardStand='idle',guardCrouch='crouchIdle',guardImpactStand='trainingHit',guardImpactCrouch='crouchIdle'))
 character=dict(id='goku',name='Goku · Base',health=1000,speed=MOTION['speed'],jump=MOTION['jump'],gravity=MOTION['gravity'],locomotion={k:v for k,v in MOTION.items() if k not in ['speed','jump','gravity']},moves={},reactionClips=aliases,hurtboxes=dict(standing=manifest['clips']['idle']['poses'][0]['hurtboxes'],crouching=manifest['clips']['crouchIdle']['poses'][0]['hurtboxes'],air=manifest['clips']['jumpApex']['poses'][0]['hurtboxes']),reactions={key:dict(loop=c['loop'],poses=c['poses']) for key,c in manifest['clips'].items()})
 (ROOT/'src/data/goku.json').write_text(json.dumps(character,indent=2)+'\n')
 info=dict(id='goku',name='Goku',stage='locomotion',combatReady=False,trainingOnly=True,visibleHeight=130,sourceSha256=hashlib.sha256((ART/'generated-base.png').read_bytes()).hexdigest(),palette=PALETTE,method='built-in imagegen base; nearest-neighbor native import and painted layered IK animation; no attacks implemented')
 (OUT/'manifest.json').write_text(json.dumps(info,indent=2)+'\n')
 required=['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd','jumpStart','jumpRise','jumpApex','jumpFall','landing']
 board=Image.new('RGB',(1024,len(required)*220),'#182631');d=ImageDraw.Draw(board)
 for row,key in enumerate(required):
  c=manifest['clips'][key];d.text((8,row*220+2),f'{key} / {c["count"]} frames',fill='#f3d58c')
  for j,index in enumerate(np.linspace(0,c['count']-1,4).astype(int)):
   frame=Image.open(OUT/f'{key}-{index:02}.png');board.paste(frame,(j*256,row*220-45),frame)
 board.save(ART/'all-movement.png')
 (ART/'base-preview.png').write_bytes((OUT/'idle-preview.png').read_bytes())
 with zipfile.ZipFile(ROOT/'public/downloads/goku-movement.zip','w',zipfile.ZIP_DEFLATED) as z:
  for f in OUT.glob('*'):z.write(f,'goku/'+f.name)
  for f in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json']:z.write(ROOT/f'src/data/{f}','data/'+f)
 preserve();print(json.dumps(dict(clips=len(defs),frames=sum(len(c['poses']) for c in defs.values()),movementClips=len(required),speed=MOTION['speed'])))
if __name__=='__main__':build()
