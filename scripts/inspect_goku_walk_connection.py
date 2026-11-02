import numpy as np
from PIL import Image,ImageDraw
from goku_walk_painted import PaintedWalk,ART
r=PaintedWalk('walkBack');im,p=r.render(3);im.save(ART/'connection-raw.png')
a=np.array(im);remaining=set(map(tuple,np.argwhere(a[:,:,3]>0)));components=[]
while remaining:
 q=remaining.pop();group={q};stack=[q]
 while stack:
  y,x=stack.pop()
  for dy in [-1,0,1]:
   for dx in [-1,0,1]:
    z=y+dy,x+dx
    if z in remaining:remaining.remove(z);group.add(z);stack.append(z)
 components.append(group)
components.sort(key=len,reverse=True)
for n,c in enumerate(components[:10]):
 yy,xx=zip(*c);print(n,len(c),(min(xx),min(yy),max(xx),max(yy)))
if len(components)>1:
 main=np.array(list(components[0]));other=np.array(list(components[1]));d=((main[:,None,:]-other[None,:,:])**2).sum(axis=2);q=np.unravel_index(d.argmin(),d.shape);print('closest',main[q[0]].tolist(),other[q[1]].tolist(),int(d[q]))
for side,pts in p['anchors']['legs'].items():
 x,y=np.rint(pts[2]).astype(int);print(side,pts,'pixel',a[y,x].tolist(),'component',next((n for n,c in enumerate(components) if (y,x) in c),None))
d=ImageDraw.Draw(im)
for side,pts in p['anchors']['legs'].items():
 d.line([tuple(q) for q in pts],fill='cyan' if side=='far' else 'lime',width=1)
im.crop((70,90,200,226)).resize((650,680),Image.Resampling.NEAREST).save(ART/'connection-review.png')
