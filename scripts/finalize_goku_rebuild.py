"""Package only validated whole poses; never render or modify anatomy."""
from pathlib import Path
import math,re,shutil,zipfile,json
from PIL import Image,ImageDraw
from goku_rebuild import ROOT,ART,OUT,read,write,protect,sha,validate

def finalize():
 protect();config=read(ART/'sources.json');keys=[key for stage in config['stages'].values() for key in stage]
 data=read(ROOT/'src/data/goku-animations.json');movement=read(OUT/'movement.json');g=read(ROOT/'src/data/goku.json')
 assert all(k in movement['clips'] and movement['clips'][k].get('method')=='whole-pose' for k in keys)
 for obj in [data,movement]:obj['clips']={k:obj['clips'][k] for k in keys}
 g['reactions']={k:g['reactions'][k] for k in keys}
 write(ROOT/'src/data/goku-animations.json',data);write(OUT/'animations.json',data);write(OUT/'movement.json',movement);write(ROOT/'src/data/goku.json',g)
 allowed={'base.png','palette.json','manifest.json','movement.json','animations.json'}
 for k in keys:
  allowed.update([f'{k}.png',f'{k}-animated.png',f'{k}-preview.png'])
  allowed.update(f'{k}-{i:02}.png' for i in range(movement['clips'][k]['count']))
 retired=ART/'retired-public';retired.mkdir(exist_ok=True)
 for p in OUT.iterdir():
  if p.is_file() and p.name not in allowed:
   assert p.resolve().is_relative_to(OUT.resolve())
   shutil.move(str(p),str(retired/p.name))
 info=read(OUT/'manifest.json');info.update(revision=5,method='complete separately posed paintings, one uniform standing calibration per source sheet; no body-part deformation',approvedDesignSha256=sha(ROOT/'art/goku/revision/approved-source.png'),sourceSha256=sha(ART/'idle-source-attempt1.png'),source='art/goku/rebuild/idle-source-attempt1.png',clips=len(keys),celReferences=sum(movement['clips'][k]['count'] for k in keys))
 write(OUT/'manifest.json',info)
 previews=ROOT/'public/previews';previews.mkdir(exist_ok=True)
 enlarged=ART/'enlarged';enlarged.mkdir(exist_ok=True)
 summary=[];board=Image.new('RGB',(1280,len(keys)*290),'#1b2c3e');d=ImageDraw.Draw(board)
 unique=set();metrics=[]
 for row,k in enumerate(keys):
  meta=movement['clips'][k];frames=[]
  for n in range(meta['count']):
   im=Image.open(OUT/f'{k}-{n:02}.png').convert('RGBA');frames.append(im);unique.add(im.tobytes())
   metrics.append(validate(im,f'{k}/{n}',meta['grounded'],32,145))
   big=Image.new('RGB',(768,800),'#253543');big.paste(im.resize((768,768),Image.Resampling.NEAREST),(0,20),im.resize((768,768),Image.Resampling.NEAREST));draw=ImageDraw.Draw(big);draw.line((0,692,767,692),fill='#70ccc5');draw.line((378,692,390,692),fill='#ffc071');draw.line((384,686,384,698),fill='#ffc071');b=im.getbbox();draw.rectangle((b[0]*3,b[1]*3+20,b[2]*3-1,b[3]*3+19),outline='#b99569');draw.text((8,4),f'{k}/{n+1} / {meta["durations"][n]} ticks',fill='#ffe2b2');big.save(enlarged/f'{k}-{n:02}.png')
  contact=Image.new('RGB',(512*min(4,len(frames)),550*math.ceil(len(frames)/4)),'#253543');cd=ImageDraw.Draw(contact)
  for n,im in enumerate(frames):
   x=n%4*512;y=n//4*550;big=im.resize((512,512),Image.Resampling.NEAREST);contact.paste(big,(x,y+20),big);cd.text((x+8,y+4),f'{k}/{n+1} / {meta["durations"][n]}ticks',fill='#ffe2b2');cd.line((x,y+468,x+511,y+468),fill='#70ccc5');cd.line((x+256,y+462,x+256,y+474),fill='#ffc071')
  contact.save(ART/f'{k}-contact.png')
  d.text((10,row*290+4),f'{k} / {meta["count"]} drawings / {sum(meta["durations"])} ticks',fill='#ffe2b2')
  indices=[round(i*(len(frames)-1)/4) for i in range(5)]
  for j,index in enumerate(indices):
   im=frames[index];board.paste(im,(j*256,row*290+20),im)
  summary.append({'clip':k,'drawings':len(frames),'durations':meta['durations'],'ticks':sum(meta['durations']),'stage':meta['rebuildStage']})
  # Native game cels and timing, composited only over an inspection background.
  loops=[]
  for im in frames:
   p=Image.new('RGBA',(512,512),'#253543');p.alpha_composite(im.resize((512,512),Image.Resampling.NEAREST));loops.append(p)
  loops[0].save(previews/f'goku-{k}.png',save_all=True,append_images=loops[1:],duration=[t*1000/60 for t in meta['durations']],loop=0,disposal=0,blend=0)
 board.save(previews/'goku-rebuild-contact.png');write(ART/'export-validation.json',{'frames':metrics,'otherCharactersUnchanged':True,'physicsUnchanged':True,'uniqueWholeDrawings':len(unique),'clips':summary})
 (ROOT/'public/downloads').mkdir(exist_ok=True)
 with zipfile.ZipFile(ROOT/'public/downloads/goku-movement.zip','w',zipfile.ZIP_DEFLATED)as z:
  for p in OUT.iterdir():
   if p.is_file():z.write(p,'goku/'+p.name)
  for p in enlarged.glob('*.png'):z.write(p,'enlarged/'+p.name)
  for p in ART.glob('*-contact.png'):z.write(p,'contact/'+p.name)
  for name in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json','goku-anatomy-guides.json']:z.write(ROOT/'src/data'/name,'data/'+name)
  for name in ['sources.json','prompts.json','additional-prompts.json','diagnostic-pipeline.md','export-validation.json']:z.write(ART/name,'audit/'+name)
  if (ART/'REBUILD.md').exists():z.write(ART/'REBUILD.md','audit/REBUILD.md')
 protect();print(json.dumps({'clips':len(keys),'celReferences':info['celReferences'],'uniqueDrawings':len(unique),'preservedFiles':len(read(ROOT/'art/goku/preservation.json'))}))

if __name__=='__main__':finalize()
