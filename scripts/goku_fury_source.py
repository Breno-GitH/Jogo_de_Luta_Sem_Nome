"""Segment COMPLETE source actors, never limbs. Generated drawings sometimes
cross an equal-grid boundary. The other actor must not become a severed fragment
inside this cel. Row-run connected components keep every selected actor pixel;
only independently identified NEIGHBOUR ACTORS are excluded from its rectangle.
Uncertain detached pieces are retained and must pass native-body validation.
"""
import numpy as np
from PIL import Image
_cache={}
def actors(path):
 key=str(path)
 if key in _cache:return _cache[key]
 im=Image.open(path).convert('RGBA');a=np.array(im);mask=a[:,:,3]>=180;parent=[];runs=[];previous=[]
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for y,row in enumerate(mask):
  edges=np.diff(np.r_[False,row,False].astype(np.int8));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0];current=[]
  for x0,x1 in zip(starts,ends):
   n=len(parent);parent.append(n);runs.append((y,int(x0),int(x1)));current.append(n)
   for p in previous:
    py,l,r=runs[p]
    if r<x0:continue
    if l>x1:break
    parent[find(n)]=find(p)
  previous=current
 groups={}
 for n,run in enumerate(runs):groups.setdefault(find(n),[]).append(run)
 groups=sorted(groups.values(),key=lambda g:sum(r-l for y,l,r in g),reverse=True)
 assert len(groups)>=9,(path,'missing full actors')
 def box(g):return[min(l for y,l,r in g),min(y for y,l,r in g),max(r for y,l,r in g),max(y for y,l,r in g)+1]
 principal=groups[:9];boxes=[box(g)for g in principal]
 for g in groups[9:]:
  b=box(g);x=(b[0]+b[2])/2;y=(b[1]+b[3])/2
  def distance(i):
   q=boxes[i];return max(q[0]-x,0,x-q[2])**2+max(q[1]-y,0,y-q[3])**2
  principal[min(range(9),key=distance)].extend(g)
 order=sorted(range(9),key=lambda i:(boxes[i][1]+boxes[i][3])/2);ordered=[]
 for row in range(3):ordered+=sorted(order[row*3:row*3+3],key=lambda i:(boxes[i][0]+boxes[i][2])/2)
 result=[]
 for i in ordered:
  g=principal[i];b=box(g);assert b[0]>0 and b[1]>0 and b[2]<im.width and b[3]<im.height,(path,'raw actor clipped',b)
  selected=np.zeros(mask.shape,bool)
  for y,l,r in g:selected[y,l:r]=True
  rgba=a[b[1]:b[3],b[0]:b[2]].copy();rgba[~selected[b[1]:b[3],b[0]:b[2]]]=0
  result.append((Image.fromarray(rgba),b,{'method':'complete actor segmentation','sourcePixels':int(selected.sum()),'neighborPixelsExcluded':int(np.count_nonzero(mask[b[1]:b[3],b[0]:b[2]]&~selected[b[1]:b[3],b[0]:b[2]]))}))
 _cache[key]=result;return result
def extract(path,columns,rows,index):
 assert(columns,rows)==(3,3)
 return actors(path)[index]
