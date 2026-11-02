"""Pose-conditioning guide only; never a game sprite."""
from pathlib import Path
import math,json
import numpy as np
from PIL import Image,ImageDraw
from build_linked_movement import solve
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'art/goku/walk-v3';OUT.mkdir(exist_ok=True)
PHASES=[0,3,6,9,12,15,18,21]
def pose(t,back=False):
 speed=3.8 if back else 4.2;period=24;stance=16 if back else 14
 feet={};support=[]
 for side,phase,center in [('near',t,125),('far',(t+12)%period,139)]:
  if phase<stance:
   x=center+(6-phase)*speed;y=213;support.append(side)
  else:
   u=(phase-stance)/(period-stance);s=u*u*(3-2*u)
   x=center+((6-stance)+stance*s)*speed;y=213-(3 if back else 6)*math.sin(math.pi*u)
  feet[side]=np.array([2*center-x if back else x,y])
 hip=(4 if back else 3.2)+1.2*math.sin(2*math.pi*t/12-.4);shift=math.cos(2*math.pi*t/24)
 hips={'near':np.array([123+shift,159+hip]),'far':np.array([137+shift,159+hip])}
 joints={}
 for side in ['near','far']:
  knee,ankle=solve(hips[side],feet[side],31,31,hips[side]+[80,10]);joints[side]=[hips[side].tolist(),knee.tolist(),ankle.tolist()]
 return {'hip':hip,'shift':shift,'legs':joints,'support':support}
def draw_guide(back):
 im=Image.new('RGB',(1024,512),'#e1e5e1');d=ImageDraw.Draw(im)
 for n,t in enumerate(PHASES):
  p=pose(t,back);ox=(n%4)*256;oy=(n//4)*256
  draw_pose(d,p,t,ox,oy,back)
 im.resize((2048,1024),Image.Resampling.NEAREST).save(OUT/('pose-guide-back.png' if back else 'pose-guide-forward.png'))
def draw_pose(d,p,t,ox,oy,back):
 def q(v):return tuple(np.rint(np.array(v)+[ox,oy]).astype(int))
 for side,col in [('far','#806194'),('near','#d75d37')]:
  points=p['legs'][side];d.line([q(v) for v in points],fill=col,width=7)
  for v in points:d.ellipse((q(np.array(v)-3),q(np.array(v)+3)),fill=col)
  a=np.array(points[-1]);d.line([q(a+[0,-5]),q(a+[0,9]),q(a+[13,9])],fill=col,width=6)
 h=p['hip'];x=p['shift'];d.line([q([129+x,157+h]),q([130+x,129+h])],fill='#336075',width=13)
 d.line([q([106+x,135+h]),q([146+x,135+h])],fill='#336075',width=9)
 wave=math.sin(t*math.pi/12)
 for pts in [[[105+x,135+h],[102-wave*3,150+h],[120-wave*4,146+h]],[[146+x,136+h],[153+wave*2,148+h],[165+wave*3,131+h if back else 136+h]]]:d.line([q(a) for a in pts],fill='#917045',width=6)
 d.ellipse((q([120+x,104+h]),q([143+x,128+h])),fill='#917045')
 d.line([q([65,224]),q([193,224])],fill='#a9b3ad',width=1)
draw_guide(False);draw_guide(True)
(OUT/'guide-landmarks.json').write_text(json.dumps({'phases':PHASES,'forward':[pose(t) for t in PHASES],'back':[pose(t,True) for t in PHASES]},indent=2)+'\n')
print('art/goku/walk-v3/pose-guide-forward.png')
