"""Native pixel anatomy for the Goku revision.

Only the approved head, upper gi and sash are sampled. Limbs are painted afresh
around constant-length joints; no trouser/arm cutout is stretched or rotated.
All rasterisation is at 256x256, without supersampling or antialiasing.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from build_linked_movement import rigid, point, warp, solve


def xy(p): return tuple(np.rint(p).astype(int))
def unit(v): return v/max(.001,float(np.linalg.norm(v)))
def normal(v):
 v=unit(v);return np.array([-v[1],v[0]])

def box(points,pad=0):
 a=np.array(points);lo=np.floor(a.min(axis=0)-pad).astype(int);hi=np.ceil(a.max(axis=0)+pad).astype(int)
 return dict(x=int(lo[0]-128),y=int(lo[1]-224),w=max(1,int(hi[0]-lo[0])),h=max(1,int(hi[1]-lo[1])))

def surface_texture(im,points,source,source_points,widths,source_widths,allowed):
 """Sample painted colour clusters along each bone, inside the new contour.

 Source outlines and empty pixels cannot become shards: only material colours
 inside a one-pixel-eroded new silhouette are transferred.
 """
 a=np.array(im);yy,xx=np.mgrid[:256,:256];pos=np.stack([xx,yy],axis=-1)
 best=np.full((256,256),np.inf);sample=np.zeros((256,256,2))
 for j,(p,q) in enumerate(zip(points,points[1:])):
  p,q=np.array(p),np.array(q);v=q-p;u=np.clip(np.sum((pos-p)*v,axis=-1)/max(.001,np.dot(v,v)),0,1)
  along=p+u[:,:,None]*v;distance=np.sum((pos-along)**2,axis=-1);n=normal(v)
  transverse=np.sum((pos-along)*n,axis=-1)
  width=widths[j]*(1-u)+widths[j+1]*u;sw=source_widths[j]*(1-u)+source_widths[j+1]*u
  sp,sq=np.array(source_points[j]),np.array(source_points[j+1]);sn=normal(sq-sp)
  mapped=sp+u[:,:,None]*(sq-sp)+(transverse*sw/width)[:,:,None]*sn
  nearer=distance<best;sample[nearer]=mapped[nearer];best[nearer]=distance[nearer]
 coords=np.clip(np.rint(sample).astype(int),0,255);tex=source[coords[:,:,1],coords[:,:,0]]
 ok=np.zeros((256,256),bool)
 for color in allowed:ok|=np.all(tex[:,:,:3]==list(bytes.fromhex(color[1:])),axis=-1)
 interior=np.array(im.getchannel('A').filter(ImageFilter.MinFilter(3)))>0
 a[ok&interior]=tex[ok&interior];return Image.fromarray(a)


def outline(points,widths):
 """Rounded cloth contour, interpolating widths around a bent skeleton."""
 points=[np.array(p,float) for p in points];samples=[]
 for j in range(len(points)-1):
  a=points[max(0,j-1)];b=points[j];c=points[j+1];d=points[min(len(points)-1,j+2)]
  for t in np.linspace(0,1,12,endpoint=False):
   q=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
   tangent=.5*((-a+c)+2*(2*a-5*b+4*c-d)*t+3*(-a+3*b-3*c+d)*t*t)
   w=widths[j]*(1-t)+widths[j+1]*t
   samples.append((q,normal(tangent),w))
 samples.append((points[-1],normal(points[-1]-points[-2]),widths[-1]))
 return [xy(q+n*w) for q,n,w in samples]+[xy(q-n*w) for q,n,w in reversed(samples)]


def paint_limb(points,widths,colors,cloth=False):
 im=Image.new('RGBA',(256,256));sil=Image.new('L',im.size);d=ImageDraw.Draw(sil)
 d.polygon(outline(points,widths),fill=255)
 # Erosion leaves exactly one native pixel of dark silhouette.
 inner=sil.filter(ImageFilter.MinFilter(3));a=np.zeros((256,256,4),dtype=np.uint8)
 a[np.array(sil)>0]=[*bytes.fromhex(colors[0][1:]),255]
 a[np.array(inner)>0]=[*bytes.fromhex(colors[2][1:]),255];im=Image.fromarray(a);d=ImageDraw.Draw(im)
 for j,(p,q) in enumerate(zip(points,points[1:])):
  p,q=np.array(p,float),np.array(q,float);v=q-p;n=normal(v);w=widths[j]
  def poly(coords,col):d.polygon([xy(p+v*t+n*off) for t,off in coords],fill=col)
  # Long light planes and narrow occlusion seams describe the limb volume.
  poly([(0,-w*.55),(.5,-w*.75),(1,-widths[j+1]*.35),(1,1),(.35,w*.1)],colors[3])
  poly([(.06,w*.55),(.56,w*.3),(.95,widths[j+1]*.65),(.9,widths[j+1]-.8),(.25,w-1)],colors[1])
  if cloth:
   poly([(.1,-w*.45),(.44,-w*.5),(.63,-1),(.3,0)],colors[4])
   # Cloth creases follow the joint, not the original straight source limb.
   for t,length in [(.64,.6),(.83,.4)]:
    q0=p+v*t;d.line([xy(q0-n*w*.55),xy(q0+n*w*length+unit(v)*2)],fill=colors[1],width=1)
    d.line([xy(q0-n*w*.4+unit(v)*2),xy(q0+n*w*.1+unit(v)*3)],fill=colors[4],width=1)
  else:
   d.line([xy(p+v*.18-n*w*.3),xy(p+v*.62-n*w*.4)],fill=colors[4],width=1)
 # Every plane stays inside the actual silhouette, including tight bends.
 a=np.array(im);a[:,:,3]=np.minimum(a[:,:,3],np.array(sil));a[a[:,:,3]==0]=0
 return Image.fromarray(a)


class AnatomyRig:
 def __init__(self,source):
  self.layers=source.layers;self.source=np.array(source.base);self.pelvis=np.array([129,157]);self.headAnchor=np.array([131,122]);self.arms=source.arms
  self.source_legs={'near':[[122,159],[106,185],[95,213]],'far':[[137,159],[153,184],[159,213]]}
  self.legs={}
  for side,hip,ankle in [('near',[123,159],[104,213]),('far',[137,159],[155,213])]:
   hip=np.array(hip,float);knee,target=solve(hip,ankle,34,34,hip+[40,18])
   self.legs[side]=[hip.tolist(),knee.tolist(),target.tolist()]

 def boot(self,ankle,knee,angle=0):
  a=np.array(ankle,float);v=unit(a-knee);n=normal(v);cuff=a-v*14
  # The boot shaft bends with the shin while its sole stays planted. Keeping
  # an upright shaft on a folded calf would leave the trouser disconnected.
  im=paint_limb([cuff,a+[0,4]],[4.6,4.6],['#080a10','#0c2146','#173a6b','#24599a','#3272b5']);d=ImageDraw.Draw(im)
  d.line([xy(cuff-n*2+v*2),xy(a-n*2)],fill='#e35e35',width=1)
  d.line([xy(cuff-n*3),xy(cuff+n*3)],fill='#0c2146',width=1)
  d.line([xy(a-v*2-n*4),xy(a-v*2+n*4)],fill='#ac7940',width=2)
  d.line([xy(a-v*3-n*3),xy(a-v*3+n*3)],fill='#f1d38a',width=1)
  def poly(pts,col):d.polygon([xy(a+q) for q in np.array(pts)],fill=col)
  poly([(-4,-2),(4,-2),(5,2),(13,6),(14,9),(12,10),(-7,10),(-7,7),(-5,2)],'#080a10')
  poly([(-3,-1),(3,-1),(5,4),(12,7),(12,9),(-5,9),(-5,5),(-3,1)],'#0c2146')
  poly([(-2,0),(2,0),(4,5),(10,7),(8,8),(-2,6),(-3,1)],'#24599a')
  poly([(-2,0),(0,0),(0,1),(-2,3)],'#3272b5')
  poly([(1,0),(2,0),(3,2),(7,6),(6,7),(1,3)],'#e35e35')
  d.line([xy(a+[-5,9]),xy(a+[12,9])],fill='#ac7940')
  d.point(xy(a+[10,7]),fill='#5a91c8')
  return warp(im,rigid(a,angle)) if angle else im

 def hand(self,wrist,angle=0,far=False):
  im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im);a=np.array(wrist,float)
  shape=[(-4,-4),(-4,-8),(-2,-10),(2,-10),(5,-7),(5,-2),(2,1),(-2,0)]
  d.polygon([xy(a+q) for q in np.array(shape)],fill='#080a10')
  d.polygon([xy(a+q) for q in np.array([(-3,-7),(-1,-9),(2,-9),(4,-6),(4,-3),(1,-1),(-2,-2)])],fill='#e7a776')
  d.line([xy(a+[-2,-7]),xy(a+[1,-8]),xy(a+[3,-6])],fill='#ffe3b8')
  d.line([xy(a+[-2,-4]),xy(a+[0,-5]),xy(a+[2,-3])],fill='#92513c')
  d.point(xy(a+[0,-7]),fill='#be7853');d.point(xy(a+[2,-6]),fill='#be7853')
  return warp(im,rigid(a,angle)) if angle else im

 def render(self,p,ground):
  t=rigid(self.pelvis,p.get('lean',0),(p.get('x',0),p.get('hip',0)))
  im=Image.new('RGBA',(256,256));anchors={'arms':{},'legs':{}};legs={}
  for side in ['far','near']:
   h0,k0,a0=map(np.array,self.legs[side]);hip=point(t,h0);target=np.array(p.get(side+'Ankle',a0),float)
   # Facing-right knees always flex towards the toes. Never switch the IK
   # branch just to push a deeply folded knee above the ankle.
   knee,target=solve(hip,target,34,34,hip+[100,10])
   cuff=target-unit(target-knee)*11
   colors=['#080a10','#883116','#d95208','#f67a14','#ff9b2b'] if side=='far' else ['#080a10','#ac3c0b','#f67a14','#ff9b2b','#ffbc57']
   leg=paint_limb([hip,knee,cuff],[10,8,4.3],colors,True)
   sh,sk,sa=map(np.array,self.source_legs[side]);sc=sa-unit(sa-sk)*11
   leg=surface_texture(leg,[hip,knee,cuff],self.source,[sh,sk,sc],[10,8,4.3],[11,10,4.3],['#542119','#883116','#ac3c0b','#d95208','#f67a14','#ff9b2b','#ffbc57'])
   boot=self.boot(target,knee,0 if ground and side in p.get('support',[]) else p.get(side+'Toe',0))
   leg.alpha_composite(boot);legs[side]=leg;anchors['legs'][side]=[hip.tolist(),knee.tolist(),target.tolist()]
  for side in p.get('legOrder',['far','near']):im.alpha_composite(legs[side])
  arms={}
  for side in ['far','near']:
   s0,e0,w0=map(np.array,self.arms[side]);shoulder=point(t,s0);target=np.array(p.get(side+'Hand',point(t,w0)))
   elbow,target=solve(shoulder,target,np.linalg.norm(e0-s0),np.linalg.norm(w0-e0),point(t,e0)+p.get(side+'Elbow',[0,0]))
   colors=['#63342b','#92513c','#be7853','#e7a776','#ffd0a0'] if side=='far' else ['#63342b','#be7853','#e7a776','#ffd0a0','#ffe3b8']
   arm=paint_limb([shoulder,elbow,target],[5.5,4,3],colors)
   d=ImageDraw.Draw(arm);v=unit(target-elbow);n=normal(v)
   d.polygon([xy(target-v*b+n*w) for b,w in [(0,3),(6,4),(6,-4),(0,-3)]],fill='#080a10')
   d.polygon([xy(target-v*b+n*w) for b,w in [(1,2),(5,3),(5,-3),(1,-2)]],fill='#173a6b')
   d.line([xy(target-v*4-n*2),xy(target-v*2-n*2)],fill='#3272b5')
   arm.alpha_composite(self.hand(target,p.get(side+'Wrist',0)));arms[side]=arm
   anchors['arms'][side]=[shoulder.tolist(),elbow.tolist(),target.tolist()]
  im.alpha_composite(arms['far']);im.alpha_composite(warp(self.layers['torso'],t))
  cloth=np.array(self.layers['cloth']);out=np.zeros_like(cloth)
  for y in range(256):out[y]=np.roll(cloth[y],round(p.get('cloth',0)*min(1,max(0,(y-156)/25))),axis=0)
  im.alpha_composite(warp(Image.fromarray(out),t));im.alpha_composite(arms['near'])
  offset=np.rint(point(t,self.headAnchor)-self.headAnchor+p.get('head',[0,0])).astype(int)
  head=np.array(self.layers['head']);original=head.copy()
  for y in range(94,110):head[y]=np.roll(original[y],round(p.get('hair',0)*(110-y)/16),axis=0)
  im.alpha_composite(warp(Image.fromarray(head),(np.eye(2),offset)))
  hurt=[box([[124+offset[0],108+offset[1]],[142+offset[0],130+offset[1]]]),box([point(t,q) for q in [(108,126),(143,128),(140,158),(115,158)]])]
  for kind in ['arms','legs']:
   for pts in anchors[kind].values():
    for a,b in zip(pts,pts[1:]):hurt.append(box([a,b],5))
  if p.get('roll'):
   rotation=rigid((129,185),p['roll']);im=warp(im,rotation);shift=224-im.getbbox()[3] if ground else 0
   if shift:im=warp(im,(np.eye(2),np.array([0,shift])))
   rotation=(rotation[0],rotation[1]+np.array([0,shift]));hurt=[box([point(rotation,(b['x']+128+dx,b['y']+224+dy)) for dx in [0,b['w']] for dy in [0,b['h']]]) for b in hurt]
  a=np.array(im);a[a[:,:,3]==0]=0;im=Image.fromarray(a)
  if ground:assert im.getbbox()[3]<=224,('floor penetration',p,im.getbbox())
  return im,dict(anchors=anchors,headOffset=offset.tolist(),hurtboxes=hurt,hitboxes=[])
