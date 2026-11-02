"""Publish whole-pose walking only, after every independent frame passes QA."""
from pathlib import Path
import json,math,re,zipfile,hashlib
import numpy as np
from PIL import Image,ImageDraw
from prepare_goku_clean_walk import prepare,native
from build_goku import preserve
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v4';OUT=ROOT/'public/sprites/goku'

def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,value):p.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def preserve_other():
 for name,digest in read(ROOT/'tests/fixtures/goku-non-walk-v2.json')['files'].items():
  assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
 preserve()

def raster_boxes(image):
 a=np.array(image)[:,:,3]>0;boxes=[]
 for lo,hi in [(90,126),(126,155),(155,180),(180,203),(203,224)]:
  ys,xs=np.where(a[lo:hi]);
  if len(xs):boxes.append({'x':int(xs.min())-128,'y':int(ys.min())+lo-224,'w':int(xs.max()-xs.min()+1),'h':int(ys.max()-ys.min()+1)})
 return boxes

def archive_obsolete(counts):
 archive=ROOT/'art/goku/walk-v3/rejected-export';archive.mkdir(exist_ok=True)
 for p in list(OUT.glob('walkStop*'))+[OUT/'walk-transitions.json',OUT/'walk-head.png']:
  if p.is_file():
   assert p.resolve().is_relative_to(OUT.resolve()) and archive.resolve().is_relative_to(ROOT)
   target=archive/p.name
   if target.exists():p.unlink()
   else:p.rename(target)
 for name in ['walkForward','walkBack']:
  for p in OUT.glob(name+'-*.png'):
   found=re.fullmatch(name+r'-(\d+)\.png',p.name)
   if found and int(found[1])>=counts[name]:
    assert p.resolve().is_relative_to(OUT.resolve())
    target=archive/p.name
    if target.exists():p.unlink()
    else:p.rename(target)

def build_clean_walk():
 preserve_other();prepare();spec=read(ART/'production.json');landmarks=read(ART/'landmarks.json')
 from goku_clean_walk_validation import preflight
 report=preflight(ART/'production.json');assert report['ok'],report['errors']
 prepared={};checks=report['poses']
 # This gate runs BEFORE touching public PNGs or writing a final atlas.
 for key,c in spec['clips'].items():
  prepared[key]=[]
  for n,record in enumerate(c['frames']):
   path=ART/f'{key}-{n:02}.png'
   assert hashlib.sha256(path.read_bytes()).hexdigest()==landmarks[key][n]['sourceSha256'],(key,n,'stale annotations')
   prepared[key].append(Image.open(path).convert('RGBA'))
 write(ART/'prepack-validation.json',{'method':'whole-pose','frames':checks,'beforeAtlas':True})
 data=read(ROOT/'src/data/goku-animations.json');movement=read(OUT/'movement.json');gait=read(ROOT/'src/data/goku-gait.json');character=read(ROOT/'src/data/goku.json')
 for key in list(data['clips']):
  if key.startswith('walkStop'):data['clips'].pop(key)
 for key in list(movement['clips']):
  if key.startswith('walkStop'):movement['clips'].pop(key)
 archive_obsolete({key:len(c['frames']) for key,c in spec['clips'].items()})
 for key,c in spec['clips'].items():
  frames=prepared[key];count=len(frames);times=c['durations'];poses=[];supports=[]
  for n,(im,mark) in enumerate(zip(frames,landmarks[key])):
   # Annotation affects collision/debug data only, never the drawing.
   ankle=mark['ankle'];legs={}
   for side in ['near','far']:
    hip=[128+(-4 if side=='near' else 4),158];foot=ankle[side];knee=[round((hip[0]+foot[0])/2+3),184]
    legs[side]=[hip,knee,foot]
   pose={'ticks':times[n],'phase':c['frames'][n]['phase'],'wholePose':True,'sourceFrame':n,'headOffset':[0,0],'anchors':{'legs':legs,'arms':{'near':[[109,135],[104,149],[123,146]],'far':[[147,137],[155,151],[162,137]]}},'solePoints':mark['solePoint'],'occluded':mark.get('occluded',{}),'hurtboxes':raster_boxes(im),'hitboxes':[]}
   poses.append(pose);supports.append(mark['support']);im.save(OUT/f'{key}-{n:02}.png')
  atlas=Image.new('RGBA',(256*count,256))
  for n,im in enumerate(frames):atlas.paste(im,(256*n,0))
  atlas.save(OUT/f'{key}.png')
  data['clips'][key]={'sheet':f'goku/{key}.png','columns':count,'frames':list(range(count)),'ticks':times[0],'durations':times,'loop':True}
  movement['clips'][key]={'label':'Walk Forward · poses inteiras' if key=='walkForward' else 'Walk Back · recuo completo','sheet':key+'.png','columns':count,'count':count,'durations':times,'loop':True,'grounded':True,'support':supports,'bounds':[im.getbbox() for im in frames],'poses':poses,'method':'whole-pose; uniform nearest-neighbor scale, palette and integer registration only'}
  character['reactions'][key]={'loop':True,'poses':poses}
  feet=[[(m['solePoint'][s] or m['ankle'][s])[0] for s in ['near','far']] for m in landmarks[key]]
  gait[key].update({'ticks':sum(times),'feet':feet,'pixelFeet':feet,'support':supports[0],'supportByFrame':supports,'maxFootCorrection':0,'wholePose':True})
  frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[round(t*1000/60) for t in times],loop=0,disposal=0,blend=0)
  prev=Image.new('RGBA',atlas.size,'#253543');prev.alpha_composite(atlas);prev.save(OUT/f'{key}-preview.png')
  sheet=Image.new('RGB',(2048,math.ceil(count/4)*512),'#253543');draw=ImageDraw.Draw(sheet)
  for n,im in enumerate(frames):
   x=n%4*512;y=n//4*512;big=im.crop((48,88,212,225)).resize((492,411),Image.Resampling.NEAREST)
   sheet.paste(big,(x+10,y+45),big);draw.text((x+14,y+12),f'{key} / {n+1} / {times[n]} ticks',fill='#ffe0aa');draw.line((x+10,y+453,x+502,y+453),fill='#72ccc5')
   pivot_x=x+10+(128-48)*3;pivot_y=y+45+(224-88)*3;draw.line((pivot_x-8,pivot_y,pivot_x+8,pivot_y),fill='#ff8b89');draw.line((pivot_x,pivot_y-8,pivot_x,pivot_y+8),fill='#ff8b89')
  sheet.save(ROOT/f'public/previews/goku-{key}-v4.png')
 write(ROOT/'src/data/goku.json',character);write(ROOT/'src/data/goku-gait.json',gait);write(ROOT/'src/data/goku-animations.json',data);write(OUT/'animations.json',data);write(OUT/'movement.json',movement)
 info=read(OUT/'manifest.json');info.update({'walkRevision':4,'walkSourcePoses':len(prepared['walkForward']),'walkRenderedFrames':len(prepared['walkForward']),'walkMethod':'whole-pose'});write(OUT/'manifest.json',info)
 with zipfile.ZipFile(ROOT/'public/downloads/goku-movement.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in OUT.glob('*'):
   if p.is_file():z.write(p,'goku/'+p.name)
  for name in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json']:z.write(ROOT/f'src/data/{name}','data/'+name)
 preserve_other();print(json.dumps({'walkRevision':4,'wholePoses':sum(map(len,prepared.values())),'noMorphing':True,'prepackValidated':True}))
if __name__=='__main__':build_clean_walk()
