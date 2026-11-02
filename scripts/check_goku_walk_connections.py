import numpy as np
from goku_walk_painted import PaintedWalk
def largest(alpha):
 r=set(map(tuple,np.argwhere(alpha)));best=set()
 while r:
  p=r.pop();g={p};stack=[p]
  while stack:
   y,x=stack.pop()
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     q=y+dy,x+dx
     if q in r:r.remove(q);g.add(q);stack.append(q)
  if len(g)>len(best):best=g
 return best
if __name__=='__main__':
 failures=[]
 for name in ['walkForward','walkBack']:
  rig=PaintedWalk(name)
  for t in range(36):
   im,p=rig.render(t);a=np.array(im)[:,:,3]>0;g=largest(a)
   for side in ['near','far']:
    x,y=np.rint(p['anchors']['legs'][side][2]).astype(int)
    if (y,x) not in g:failures.append([name,t,side])
   if (123+p['headOffset'][1],133) not in g:failures.append([name,t,'head'])
 print('painted connection failures:',failures)
 assert not failures
