"""Extract a COMPLETE actor even when a generated source drifts across its grid.

Never masks or assembles body parts. The result is one unchanged rectangular
crop from the raw source. Significant detached pieces stay in that rectangle
and must fail the subsequent native-figure validation rather than disappear.
"""
from pathlib import Path
import numpy as np
from PIL import Image
_cache={}

def _actors(path,columns,rows):
 path=Path(path);key=(str(path.resolve()),path.stat().st_mtime_ns,columns,rows)
 if key in _cache:return _cache[key]
 image=Image.open(path).convert('RGBA');alpha=np.array(image)[:,:,3]>=180;remaining=set(map(tuple,np.argwhere(alpha)));groups=[]
 while remaining:
  first=remaining.pop();stack=[first];count=0;y0=y1=first[0];x0=x1=first[1]
  while stack:
   y,x=stack.pop();count+=1;y0=min(y0,y);y1=max(y1,y);x0=min(x0,x);x1=max(x1,x)
   for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    q=y+dy,x+dx
    if q in remaining:remaining.remove(q);stack.append(q)
  groups.append({'count':count,'bbox':[int(x0),int(y0),int(x1)+1,int(y1)+1]})
 groups.sort(key=lambda g:g['count'],reverse=True);number=columns*rows
 assert len(groups)>=number,(path,'not enough complete source actors')
 actors=groups[:number]
 assert min(a['count'] for a in actors)>image.width*image.height/number*.02,(path,'not all source cells contain a complete actor')
 boxes=[list(a['bbox']) for a in actors]
 def distance(point,b):return max(b[0]-point[0],0,point[0]-b[2])**2+max(b[1]-point[1],0,point[1]-b[3])**2
 for g in groups[number:]:
  b=g['bbox'];point=[(b[0]+b[2])/2,(b[1]+b[3])/2];index=min(range(number),key=lambda i:distance(point,actors[i]['bbox']))
  target=boxes[index];target[:]=[min(target[0],b[0]),min(target[1],b[1]),max(target[2],b[2]),max(target[3],b[3])]
 order=sorted(range(number),key=lambda i:(actors[i]['bbox'][1]+actors[i]['bbox'][3])/2);ordered=[]
 for row in range(rows):
  ordered.extend(sorted(order[row*columns:(row+1)*columns],key=lambda i:(actors[i]['bbox'][0]+actors[i]['bbox'][2])/2))
 for b in boxes:assert b[0]>0 and b[1]>0 and b[2]<image.width and b[3]<image.height,(path,'actor clipped by raw image border',b)
 result=image,[boxes[i] for i in ordered];_cache[key]=result;return result

def extract(path,columns,rows,index):
 image=Image.open(path).convert('RGBA');w=image.width/columns;h=image.height/rows
 cellRect=[round(index%columns*w),round(index//columns*h),round((index%columns+1)*w),round((index//columns+1)*h)]
 cell=image.crop(cellRect);b=cell.getchannel('A').point(lambda a:255 if a>=180 else 0).getbbox()
 if b and b[0]>0 and b[1]>0 and b[2]<cell.width and b[3]<cell.height:
  rect=[cellRect[0]+b[0],cellRect[1]+b[1],cellRect[0]+b[2],cellRect[1]+b[3]]
 else:
  image,rects=_actors(path,columns,rows);rect=rects[index]
 return image.crop(rect),rect,cellRect
