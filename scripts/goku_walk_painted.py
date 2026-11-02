"""Painted Goku walking keys and locally-rigid native pixel inbetweens.

The imported drawings supply the actual silhouettes and cloth planes. There
is no capsule/tube limb renderer and no colour/alpha interpolation.
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image,ImageFilter,ImageDraw
from goku_walk_mesh import warp_painted
from build_linked_movement import rigid,warp,align,mask
from goku_anatomy import box

ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v3'
PERIOD=36;SPEED={'walkForward':4.2,'walkBack':3.8}
PHASES=[0,4,9,13,18,22,27,31]
F_BODY=[
 [[129,157],[132,128],[107,136],[103,149],[123,146],[146,139],[154,153],[161,138]],
 [[130,158],[136,129],[108,136],[105,149],[124,148],[146,141],[154,153],[162,139]],
 [[133,159],[135,128],[111,135],[108,149],[131,154],[145,141],[145,154],[154,145]],
 [[132,157],[136,129],[109,136],[105,149],[124,147],[147,139],[154,151],[163,139]],
 [[128,157],[132,128],[106,135],[102,147],[122,145],[146,140],[153,151],[162,140]],
 [[128,157],[134,128],[106,135],[102,148],[123,146],[145,141],[152,152],[161,140]],
 [[131,159],[133,129],[109,136],[108,150],[129,151],[144,141],[146,153],[156,145]],
 [[131,157],[136,128],[108,136],[104,149],[124,146],[147,138],[154,150],[162,135]],
]
F_LEGS=[
 [[[123,161],[103,184],[86,212]],[[136,161],[156,186],[163,213]]],
 [[[124,161],[125,183],[108,211]],[[136,161],[143,185],[146,213]]],
 [[[130,162],[128,185],[125,213]],[[137,162],[137,188],[135,214]]],
 [[[125,161],[116,187],[111,212]],[[137,161],[159,185],[172,206]]],
 [[[122,160],[100,185],[83,212]],[[136,160],[155,187],[165,212]]],
 [[[123,160],[124,182],[106,210]],[[135,160],[143,185],[145,213]]],
 [[[130,160],[132,184],[131,210]],[[136,160],[139,188],[137,213]]],
 [[[125,161],[115,187],[111,211]],[[137,161],[158,184],[173,207]]],
]
B_BODY=[
 [[145,157],[155,129],[123,136],[117,150],[140,151],[169,139],[172,153],[177,136]],
 [[147,158],[155,129],[123,136],[119,149],[143,149],[169,139],[176,152],[176,136]],
 [[145,157],[148,129],[119,135],[119,148],[140,149],[164,138],[171,150],[172,135]],
 [[149,158],[154,129],[125,136],[122,149],[145,151],[172,139],[177,151],[177,136]],
 [[118,158],[128,129],[92,136],[91,149],[113,152],[139,139],[145,150],[139,135]],
 [[121,158],[131,129],[94,136],[92,149],[116,152],[141,140],[149,152],[144,136]],
 [[114,157],[127,129],[89,135],[90,147],[110,151],[137,139],[142,149],[141,135]],
 [[120,158],[132,130],[95,137],[93,148],[114,151],[143,139],[146,151],[142,136]],
]
B_LEGS=[
 [[[139,160],[112,185],[92,211]],[[153,160],[173,185],[176,212]]],
 [[[140,160],[115,185],[104,210]],[[153,160],[170,186],[177,213]]],
 [[[141,161],[132,185],[123,212]],[[151,161],[164,176],[143,203]]],
 [[[144,161],[140,185],[134,213]],[[153,161],[154,186],[147,214]]],
 [[[109,160],[85,187],[70,212]],[[124,160],[141,186],[156,212]]],
 [[[111,160],[88,186],[70,210]],[[126,160],[140,185],[145,213]]],
 [[[105,160],[97,182],[91,210]],[[119,160],[131,176],[111,203]]],
 [[[113,161],[111,186],[106,213]],[[124,161],[128,188],[130,213]]],
]
def unit(v):return v/max(.001,float(np.linalg.norm(v)))
def normal(v):
 v=unit(v);return np.array([v[1],-v[0]])
def distance(points,a,b):
 v=b-a;t=np.clip(np.sum((points-a)*v,axis=-1)/max(.001,np.dot(v,v)),0,1)
 return np.sum((points-a-t[:,:,None]*v)**2,axis=-1)
def leg_distance(points,leg):return np.minimum(distance(points,leg[0],leg[1]),distance(points,leg[1],leg[2]))
def largest_piece(layer):
 a=np.array(layer);remaining=set(map(tuple,np.argwhere(a[:,:,3]>0)));best=[]
 while remaining:
  first=remaining.pop();group=[first];stack=[first]
  while stack:
   y,x=stack.pop()
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     q=(y+dy,x+dx)
     if q in remaining:remaining.remove(q);group.append(q);stack.append(q)
  if len(group)>len(best):best=group
 keep=np.zeros((256,256),bool)
 for y,x in best:keep[y,x]=True
 a[~keep]=0;return Image.fromarray(a)
def cyclic_values(values,t,period=PERIOD):
 for i,start in enumerate(PHASES):
  end=PHASES[i+1] if i<7 else period
  if start<=t<end:
   u=(t-start)/(end-start);j=(i+1)%8
   return np.array(values[i])*(1-u)+np.array(values[j])*u,i if u<.5 else j
 raise ValueError(t)

class PaintedWalk:
 def __init__(self,name):
  self.name=name;self.back=name=='walkBack';label='back' if self.back else 'forward'
  self.keys=[Image.open(ART/f'{label}-key-{i}.png').convert('RGBA') for i in range(8)]
  self.body_points=np.array(B_BODY if self.back else F_BODY,float)
  self.leg_points=np.array(B_LEGS if self.back else F_LEGS,float)
  self.parts=[];yy,xx=np.mgrid[:256,:256];pixels=np.stack([xx,yy],axis=-1)
  orange_colors=['542119','883116','ac3c0b','d95208','f67a14','ff9b2b','ffbc57']
  blue_colors=['071326','0c2146','173a6b','24599a','3272b5','5a91c8']
  for i,im in enumerate(self.keys):
   a=np.array(im);orange=np.zeros((256,256),bool);blue=orange.copy()
   for color in orange_colors:orange|=np.all(a[:,:,:3]==list(bytes.fromhex(color)),axis=2)
   for color in blue_colors:blue|=np.all(a[:,:,:3]==list(bytes.fromhex(color)),axis=2)
   trouser=np.array(Image.fromarray((orange*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
   ds=[leg_distance(pixels,leg) for leg in self.leg_points[i]]
   legs=[]
   for side in [0,1]:
    region=(yy>=158)&trouser&(ds[side]<=ds[1-side])
    layer=a.copy();layer[~region]=0;legs.append(largest_piece(Image.fromarray(layer)))
   # Upper gi, actual arm painting and sash; no old fist repair or blue slab.
   waist=self.body_points[i][0]
   # Retain the painted trouser yoke under the belt. Cutting exactly at the
   # waist detached a projected rear thigh from the torso in a few poses.
   region=(yy<159)|((yy<168)&(np.abs(xx-waist[0])<22))|(blue&(yy<183)&(xx>waist[0]-9)&(xx<waist[0]+14))
   if self.back:region&=~((yy<125)|((yy<134)&(xx>self.body_points[i][1][0]-12)))
   else:region&=~(((yy<124)&(xx>104))|mask([(119,118),(147,118),(145,130),(127,132),(119,126)]))
   layer=a.copy();layer[~region]=0;upper=Image.fromarray(layer)
   self.parts.append((upper,legs))
  base=Image.open(ART/'forward-key-0.png').convert('RGBA');a=np.array(base)
  head=((yy<124)&(xx>104))|mask([(119,118),(147,118),(145,130),(127,132),(119,126)])
  # The approved face/hair are shared with Idle. New painting is confined to
  # the requested walking body; expression and hair identity never change.
  self.head=Image.open(ROOT/'art/goku/layers/head.png').convert('RGBA')
  approved=np.array(Image.open(ROOT/'art/goku/base-native.png').convert('RGBA'))
  skin=np.zeros((256,256),bool)
  for color in ['63342b','92513c','be7853','e7a776','ffd0a0','ffe3b8']:
   skin|=np.all(approved[:,:,:3]==list(bytes.fromhex(color)),axis=2)
  neck=mask([(124,126),(143,126),(143,138),(126,136)])&skin
  approved[~neck]=0;self.neck=Image.fromarray(approved)
  self.neck_under=Image.new('RGBA',(256,256));d=ImageDraw.Draw(self.neck_under)
  d.polygon([(129,126),(138,126),(141,133),(137,140),(127,135)],fill='#92513c')
  d.polygon([(131,127),(136,127),(138,133),(135,137),(130,133)],fill='#e7a776')
  d.line([(134,128),(136,132),(135,134)],fill='#ffd0a0',width=1)
  self.neck_under.alpha_composite(self.neck)
  # One actual painted boot, articulated into shaft and rigid shoe.
  a=np.array(base);boot=mask([(151,198),(170,198),(173,213),(182,219),(182,224),(154,224),(154,213)])
  shaft=a.copy();shaft[~(boot&(yy<213))]=0
  foot=a.copy();foot[~(boot&(yy>=211))]=0
  self.bootshaft=Image.fromarray(shaft)
  # Painted cloth and boot cuts need a hidden cuff underlap. The retreat
  # bends expose a gap if the shaft ends at the source's cropped trouser edge.
  cap=self.bootshaft.crop((0,200,256,201))
  for row in [198,199]:self.bootshaft.paste(cap,(0,row))
  # The generated front shoe's sole was two pixels above the rear sole.
  # Register the shoe to the game's actual 224 boundary, not the source crop.
  self.bootfoot=Image.new('RGBA',(256,256));self.bootfoot.paste(Image.fromarray(foot),(0,2))

 def foot(self,phase,side):
  speed=SPEED[self.name];stance=22 if self.back else 20
  start=(99 if side=='near' else 98) if self.back else (164 if side=='near' else 166)
  if phase<stance:
   x=start+(speed*phase if self.back else -speed*phase);lift=0;support=True
  else:
   u=(phase-stance)/(PERIOD-stance);ease=u*u*(3-2*u)
   x=start+(speed*stance*(1-ease) if self.back else -speed*stance*(1-ease))
   lift=(4 if self.back else 6)*math.sin(math.pi*u);support=False
  return np.array([x,213-lift]),support

 def render(self,t):
  wave=math.sin(2*math.pi*t/PERIOD);bob=.8*math.sin(4*math.pi*t/PERIOD-.4)
  target_pelvis=np.array([130+.6*wave,158+bob]);body_values=[]
  for i in range(8):
   p=self.body_points[i%len(self.keys)].copy();p-=p[0];body_values.append(p)
  offsets,index=cyclic_values(body_values,t);source_index=index%len(self.keys)
  target=offsets+target_pelvis
  target[1]=[133,129+round(bob*.5)]
  # Keep the rear hand at ribs, front fist ready; actual painted muscles move.
  target[4][1]=min(149,target[4][1]);target[4][0]=min(127,max(118,target[4][0]))
  if self.back:target[7][1]=min(136,target[7][1])
  source=self.body_points[source_index]
  upper=warp_painted(self.parts[source_index][0],source,target,.6)
  anchors={'legs':{},'arms':{'near':target[2:5].tolist(),'far':target[5:8].tolist()}}
  support=[];leg_layers={};used=[]
  for side,phase in [('near',t),('far',(t+18)%PERIOD)]:
   ankle,on_ground=self.foot(phase,side)
   if on_ground:support.append(side)
   # Pelvic projection changes with counter-rotation, not anatomical scaling.
   sign=-1 if self.back else 1
   hip=np.array([130+(1 if side=='near' else -1)*sign*6*math.cos(2*math.pi*t/PERIOD),160+bob])
   best=None
   for k,legs in enumerate(self.leg_points):
    for s,points in enumerate(legs):
     if np.count_nonzero(np.array(self.parts[k][1][s])[:,:,3])<500:continue
     v=points[-1]-points[0];desired=ankle-hip
     score=np.sum((v-desired)**2)+abs(k-source_index)*.05
     if best is None or score<best[0]:best=(score,k,s,points)
   _,k,s,points=best;sh,sk,sa=points
   v=sa-sh;projection=np.clip(np.dot(sk-sh,v)/np.dot(v,v),.4,.65)
   bend=np.clip(np.dot(sk-sh-projection*v,normal(v)),2,9)
   knee=hip+projection*(ankle-hip)+normal(ankle-hip)*bend
   sc=sa-unit(sa-sk)*13;dc=ankle-unit(ankle-knee)*13
   leg=warp_painted(self.parts[k][1][s],[sh,sk,sc],[hip,knee,dc],.55)
   # The cloth ends at the boot cuff; remove any source fragments below it.
   a=np.array(leg);yy,xx=np.mgrid[:256,:256];pos=np.stack([xx,yy],axis=-1)
   below=np.sum((pos-dc)*unit(ankle-knee),axis=-1)>2
   a[below]=0;leg=Image.fromarray(a)
   shaft=warp(self.bootshaft,align([160,199],[162,213],dc,ankle))
   shoe=warp(self.bootfoot,rigid([162,213],0,ankle-[162,213]))
   if side=='far':
    for part in [leg,shaft,shoe]:
     a=np.array(part)
     for old,new in [('ffbc57','ff9b2b'),('ff9b2b','f67a14')]:
      a[np.all(a[:,:,:3]==list(bytes.fromhex(old)),axis=2),:3]=list(bytes.fromhex(new))
     part.paste(Image.fromarray(a))
   shaft.alpha_composite(leg);shaft.alpha_composite(shoe);leg_layers[side]=shaft
   anchors['legs'][side]=[hip.tolist(),knee.tolist(),ankle.tolist()];used.append([k,s])
  im=Image.new('RGBA',(256,256))
  im.alpha_composite(leg_layers['far']);im.alpha_composite(leg_layers['near'])
  im.alpha_composite(warp(self.neck_under,rigid([0,0],0,[0,round(bob*.5)])))
  im.alpha_composite(upper)
  head_offset=[0,round(bob*.5)]
  im.alpha_composite(warp(self.head,rigid([0,0],0,head_offset)))
  a=np.array(im);a[a[:,:,3]==0]=0;im=Image.fromarray(a)
  hurt=[box([[118,108+head_offset[1]],[144,130+head_offset[1]]]),box([[108,128],[148,159]])]
  for kind in ['legs','arms']:
   for pts in anchors[kind].values():
    for p,q in zip(pts,pts[1:]):hurt.append(box([p,q],5))
  return im,{'anchors':anchors,'headOffset':head_offset,'hurtboxes':hurt,'hitboxes':[],'support':support,'paintedSources':used,'sourceKey':source_index,'projectedLengths':True}

def preview():
 from PIL import ImageDraw
 board=Image.new('RGB',(1280,960),'#253543');d=ImageDraw.Draw(board)
 for row,name in enumerate(['walkForward','walkBack']):
  rig=PaintedWalk(name)
  for col,t in enumerate([0,6,12,18,24,30]):
   im,meta=rig.render(t);im.save(ART/f'{name}-{t:02}.png')
   crop=im.crop((65,88,193,225)).resize((192,205),Image.Resampling.NEAREST)
   x=col%3*420;y=row*480+col//3*240;board.paste(crop,(x+100,y+25),crop);d.text((x+10,y+5),f'{name} / tick {t}',fill='#ffe0a0')
 board.save(ART/'painted-review.png')
if __name__=='__main__':preview()
