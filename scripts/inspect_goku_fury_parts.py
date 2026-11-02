from goku_fury_art import *
for p in ART.glob('rejected*.png'):
 if '-view'in p.stem:continue
 im=Image.open(p).convert('RGBA');m=np.array(im)[:,:,3]>0;remaining=set(map(tuple,np.argwhere(m)));groups=[]
 while remaining:
  start=remaining.pop();s=[start];g=[start]
  while s:
   y,x=s.pop()
   for dy,dx in[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    q=y+dy,x+dx
    if q in remaining:remaining.remove(q);s.append(q);g.append(q)
  groups.append(g)
 groups.sort(key=len,reverse=True)
 for g in groups[1:]:print(p.name,len(g),'bbox',min(x for y,x in g),min(y for y,x in g),max(x for y,x in g),max(y for y,x in g))
 b=Image.new('RGB',(768,512),'#283946');big=im.resize((768,512),Image.Resampling.NEAREST);b.paste(big,(0,0),big);b.save(p.with_name(p.stem+'-view.png'))
