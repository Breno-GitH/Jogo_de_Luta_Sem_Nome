"""Complete authored source poses. One uniform scale per source atlas.
No morphing, bone warping, limb compositing or cropped anatomy repairs.
"""
from pathlib import Path
import json,hashlib,math
import numpy as np
from PIL import Image,ImageDraw
from goku_rebuild import ROOT,PALETTE as BASE,component_counts
from goku_fury_source import extract
ART=ROOT/'art/goku/fury';OUT=ROOT/'public/sprites/goku/fury';SIZE=(384,256);PIVOT={'x':192,'y':224}
PALETTE=BASE+['#50331c','#85501b','#bb7a17','#e8ad27','#ffd44a','#ffe780','#fff5bd','#155b54','#358e70','#87dcb0']
PAL=Image.new('P',(1,1));rgb=[v for c in PALETTE for v in bytes.fromhex(c[1:])];PAL.putpalette(rgb+rgb[:3]*(256-len(PALETTE)))
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def protect():
 for name,digest in read(ART/'preservation.json').items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
def import_pose(crop,scale,grounded=True):
 crop=crop.copy();crop.putalpha(crop.getchannel('A').point(lambda a:255 if a>=180 else 0));small=crop.resize(tuple(round(v*scale)for v in crop.size),Image.Resampling.NEAREST)
 q=small.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a);b=q.getbbox()
 # Whole drawing anchored on its two boot contacts (ground) or virtual soles
 # (air). Never change a pose's proportions to make it fit.
 offset=[192-round((b[0]+b[2])/2),224-b[3]]
 out=Image.new('RGBA',SIZE);out.paste(q,tuple(offset));assert out.getbbox()==tuple(b[i]+offset[i%2]for i in range(4)),('clipped',b,offset)
 return out,offset
def validate(im,key):
 a=np.array(im);mask=a[:,:,3]>0;b=im.getbbox();g=component_counts(mask)
 assert b and b[0]>=12 and b[1]>=12 and b[2]<=372 and b[3]<=224,(key,'margin/cut',b)
 assert set(np.unique(a[:,:,3]))<={0,255}and np.all(a[~mask]==0),(key,'alpha')
 assert g[0]/sum(g)>=.99 and(len(g)==1 or g[1]<=12),(key,'detached anatomy',g[:5])
 assert mask.sum()>1400,(key,'incomplete body')
 return {'bbox':b,'opaquePixels':int(mask.sum()),'components':g,'height':b[3]-b[1]}
def reference():
 im,_,_=extract(ART/'raw/transformation.png',3,3,8);scale=130/im.height;pose,_=import_pose(im,scale)
 big=Image.new('RGBA',(1024,1024));large=pose.resize((1536,1024),Image.Resampling.NEAREST);big.paste(large.crop((256,0,1280,1024)),(0,0));big.save(ART/'ssj-reference.png')
def build():
 protect();cfg=read(ART/'sources.json');cache={};report={};clips={};manifest={};OUT.mkdir(parents=True,exist_ok=True)
 for source in sorted({ref.split(':')[0]for c in cfg['clips'].values()for ref in c['cells']if ref!='base:idle'}):
  cal,_,_=extract(ART/'raw'/f'{source}.png',3,3,0);scale=130/cal.height
  for i in range(1,9):
   crop,rect,segmentation=extract(ART/'raw'/f'{source}.png',3,3,i);im,offset=import_pose(crop,scale)
   key=f'{source}:{i}';metrics=validate(im,key);cache[key]=im;report[key]={'source':f'raw/{source}.png','sourceRect':rect,'segmentation':segmentation,'scale':scale,'offset':offset,**metrics}
 for key,c in cfg['clips'].items():
  refs=c['cells'];frames=[]
  for ref in refs:
   if ref=='base:idle':
    im=Image.new('RGBA',SIZE);im.paste(Image.open(ROOT/'public/sprites/goku/idle-00.png').convert('RGBA'),(64,0))
   else:im=cache[ref]
   frames.append(im)
  durations=c['durations'];assert len(durations)==len(frames)and all(v>0 for v in durations),key
  for previous in OUT.glob(f'{key}-[0-9][0-9].png'):
   if int(previous.stem.rsplit('-',1)[1])>=len(frames):
    assert previous.resolve().parent==OUT.resolve();previous.unlink()
  cols=min(6,len(frames));sheet=Image.new('RGBA',(384*cols,256*math.ceil(len(frames)/cols)))
  for i,im in enumerate(frames):sheet.paste(im,(i%cols*384,i//cols*256));im.save(OUT/f'{key}-{i:02}.png')
  sheet.save(OUT/f'{key}.png');frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in durations],loop=0,disposal=0,blend=0)
  clips[key]={'sheet':f'goku/fury/{key}.png','frameWidth':384,'frameHeight':256,'pivot':PIVOT,'columns':cols,'frames':list(range(len(frames))),'durations':durations,'ticks':durations[0],'loop':c.get('loop',False)}
  manifest[key]={'sheet':key+'.png','columns':cols,'count':len(frames),'durations':durations,'sources':refs,'bounds':[im.getbbox()for im in frames],'poses':[{'phase':'cinematic','hurtboxes':[]}for im in frames]}
  board=Image.new('RGB',(768*min(3,len(frames)),550*math.ceil(len(frames)/3)),'#233544');d=ImageDraw.Draw(board)
  for i,im in enumerate(frames):
   x=i%3*768;y=i//3*550;large=im.resize((768,512),Image.Resampling.NEAREST);board.paste(large,(x,y+24),large);d.text((x+12,y+6),f'{key} / {i+1} / {durations[i]} ticks',fill='#ffdc74');d.line((x,y+472,x+767,y+472),fill='#54bcb8');d.line((x+384,y+466,x+384,y+478),fill='#ffc77c')
  board.save(ART/f'{key}-contact.png')
 data={'sheet':'goku/fury/furySuperActivationStart.png','frameWidth':384,'frameHeight':256,'pivot':PIVOT,'clips':clips}
 write(ROOT/'src/data/goku-fury-animations.json',data);write(OUT/'animations.json',data);write(OUT/'manifest.json',{'clips':manifest});write(OUT/'palette.json',PALETTE);write(ART/'validation.json',report)
 print('Published',len(clips),'clips;',len(cache),'complete unique source poses;',sum(len(c['frames'])for c in clips.values()),'cel references')
if __name__=='__main__':
 import sys
 reference()if'reference'in sys.argv else build()
