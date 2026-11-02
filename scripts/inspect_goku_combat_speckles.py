from goku_combat_art import ART,OUT,read,write
from PIL import Image
import numpy as np
report={}
for key,c in read(OUT/'manifest.json')['clips'].items():
 for i in range(c['count']):
  im=Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA');todo=set(map(tuple,np.argwhere(np.array(im)[:,:,3]>0)));groups=[]
  while todo:
   p=todo.pop();stack=[p];group=[p]
   while stack:
    y,x=stack.pop()
    for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
     q=(y+dy,x+dx)
     if q in todo:todo.remove(q);stack.append(q);group.append(q)
   groups.append(group)
  tiny=[[[int(x),int(y)]for y,x in g]for g in groups if len(g)<=8]
  if tiny:report[f'{key}/{i}']=tiny
write(ART/'qa/speckles.json',report);print(report)
