"""Import complete newly drawn poses. Never cut, deform or replace body parts."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw
from build_goku import PALETTE
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v4'
THRESHOLD=180;TIMES=[4,5,4,5,4,5,4,5]
pal=Image.new('P',(1,1));values=[v for c in PALETTE for v in bytes.fromhex(c[1:])];pal.putpalette(values+values[:3]*(256-len(PALETTE)))

def native(source,scale,offset):
 size=tuple(round(v*scale) for v in source.size)
 small=source.resize(size,Image.Resampling.NEAREST)
 rgba=small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
 rgba.putalpha(small.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0))
 a=np.array(rgba);a[a[:,:,3]==0]=0;rgba=Image.fromarray(a)
 out=Image.new('RGBA',(256,256));out.paste(rgba,tuple(offset));return out

def prepare_base():
 spec={'version':1,'revision':4,'method':'whole-pose','alphaThreshold':THRESHOLD,'palette':PALETTE,'clips':{}}
 for label,key in [('forward','walkForward'),('back','walkBack')]:
  sheet=Image.open(ART/f'{label}-sheet-source.png').convert('RGBA');cuts=[];heights=[]
  for n in range(8):
   rect=[round(n%4*sheet.width/4),round(n//4*sheet.height/2),round((n%4+1)*sheet.width/4),round((n//4+1)*sheet.height/2)]
   raw=sheet;raw_path=ART/f'{label}-sheet-source.png'
   if label=='forward' and n in [3,7]:
    raw_path=ART/('forward-low-step-source.png' if n==3 else 'forward-opposite-low-step-source.png');raw=Image.open(raw_path).convert('RGBA');rect=[0,0,raw.width,raw.height]
   crop=raw.crop(rect);b=crop.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0).getbbox()
   assert b and b[0]>0 and b[1]>0 and b[2]<crop.width and b[3]<crop.height,(label,n,'source clipped',b,crop.size)
   rect=[rect[0]+b[0],rect[1]+b[1],rect[0]+b[2],rect[1]+b[3]];crop=raw.crop(rect)
   cuts.append((crop,raw_path,rect));
   if not(label=='forward' and n in [3,7]):heights.append(crop.height)
  median=float(np.median(heights));frames=[];native_frames=[]
  for n,(crop,raw_path,rect) in enumerate(cuts):
   # A separately redrawn whole pose is uniformly registered to the sheet's
   # source height. No head, clothing, hand or leg is ever patched separately.
   normalize=median/crop.height if label=='forward' and n in [3,7] else 1.
   q=crop.resize(tuple(round(v*normalize) for v in crop.size),Image.Resampling.NEAREST)
   colors=np.array(q.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB'))
   visible=np.array(q.getchannel('A'))>=THRESHOLD;skin=np.zeros(visible.shape,bool)
   for c in PALETTE[5:11]:skin|=np.all(colors==list(bytes.fromhex(c[1:])),axis=2)
   yy,xx=np.mgrid[:q.height,:q.width];face=skin&visible&(yy>=q.height*.17)&(yy<=q.height*.30)
   assert np.count_nonzero(face)>20,(key,n,'cannot register face')
   face_x=float(xx[face].mean());x=round(277-face_x);y=480-q.height
   source=Image.new('RGBA',(512,512));source.paste(q,(x,y))
   assert source.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0).getbbox()==(x,y,x+q.width,y+q.height),(key,n,'normalization clipped')
   path=ART/f'{label}-source-{n:02}.png';source.save(path)
   scale=130/median;blank=native(source,scale,[0,0]);b=blank.getbbox();offset=[128-round(256*scale),224-b[3]]
   im=native(source,scale,offset);box=im.getbbox();assert box and min(box[:2])>=8 and box[2]<=248 and box[3]==224,(key,n,box)
   native_frames.append(im)
   frames.append({'source':path.relative_to(ROOT).as_posix(),'offset':offset,'rawSource':raw_path.relative_to(ROOT).as_posix(),'sourceRect':rect,'normalization':{'scale':normalize,'offset':[x,y],'canvas':[512,512]},'bbox':box,'phase':['contact','down','passing','up','opposite contact','opposite down','opposite passing','recovery'][n]})
  spec['clips'][key]={'scale':130/median,'durations':TIMES,'frames':frames}
  # Independent cells are reviewed before an atlas is allowed to be exported.
  board=Image.new('RGB',(2048,1024),'#253543');d=ImageDraw.Draw(board)
  for n,im in enumerate(native_frames):
   im.save(ART/f'{key}-{n:02}.png');x=n%4*512;y=n//4*512
   enlarged=im.crop((48,88,212,225)).resize((492,411),Image.Resampling.NEAREST)
   board.paste(enlarged,(x+10,y+45),enlarged);d.text((x+12,y+12),f'{key} / {n+1} / {frames[n]["phase"]}',fill='#ffe0aa')
   d.line((x+10,y+45+408,x+502,y+45+408),fill='#5bc6bd')
  board.save(ART/f'{key}-individual-review.png')
 (ART/'production.json').write_text(json.dumps(spec,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({k:{'frames':len(v['frames']),'scale':v['scale'],'bounds':[f['bbox'] for f in v['frames']]} for k,v in spec['clips'].items()}))
def prepare_expanded_experiment():
 prepare_base()
 spec=json.loads((ART/'production.json').read_text(encoding='utf-8'))
 for label,key in [('forward','walkForward'),('back','walkBack')]:
  path=ART/f'{label}-mid-sheet-source.png'
  assert path.exists(),f'Missing independently drawn complete poses: {path}'
  sheet=Image.open(path).convert('RGBA');base=spec['clips'][key];saved=[Image.open(ROOT/r['source']).copy() for r in base['frames']];cuts=[]
  for n in range(8):
   from goku_whole_source import extract
   crop,rect,_=extract(path,4,2,n);cuts.append((crop,rect))
  normalize=(130/base['scale'])/float(np.median([c.height for c,_ in cuts]));records=[];sources=[];times=[]
  for n,(crop,rect) in enumerate(cuts):
   q=crop.resize(tuple(round(v*normalize) for v in crop.size),Image.Resampling.NEAREST)
   rgb=np.array(q.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB'));visible=np.array(q.getchannel('A'))>=THRESHOLD;skin=np.zeros(visible.shape,bool)
   for color in PALETTE[5:11]:skin|=np.all(rgb==list(bytes.fromhex(color[1:])),axis=2)
   yy,xx=np.mgrid[:q.height,:q.width];face=skin&visible&(yy>=q.height*.17)&(yy<=q.height*.30);assert np.count_nonzero(face)>20,(key,n,'face registration')
   x=round(277-float(xx[face].mean()));y=480-q.height;source=Image.new('RGBA',(512,512));source.paste(q,(x,y))
   assert source.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0).getbbox()==(x,y,x+q.width,y+q.height),(key,n,'source normalization clipped')
   b=native(source,base['scale'],[0,0]).getbbox();offset=[128-round(256*base['scale']),224-b[3]]
   rec={'offset':offset,'rawSource':path.relative_to(ROOT).as_posix(),'sourceRect':rect,'normalization':{'scale':normalize,'offset':[x,y],'canvas':[512,512]},'phase':base['frames'][n]['phase']+' to '+base['frames'][(n+1)%8]['phase'],'independentlyDrawn':True}
   records.extend([base['frames'][n],rec]);sources.extend([saved[n],source]);times.extend([TIMES[n]//2,TIMES[n]-TIMES[n]//2])
  for n,(source,record) in enumerate(zip(sources,records)):
   source_path=ART/f'{label}-source-{n:02}.png';source.save(source_path);record['source']=source_path.relative_to(ROOT).as_posix()
   im=native(source,base['scale'],record['offset']);record['bbox']=im.getbbox();im.save(ART/f'{key}-{n:02}.png')
  base.update(frames=records,durations=times)
  board=Image.new('RGB',(2048,2048),'#253543');d=ImageDraw.Draw(board)
  for n,record in enumerate(records):
   im=Image.open(ART/f'{key}-{n:02}.png');x=n%4*512;y=n//4*512;big=im.crop((48,88,212,225)).resize((492,411),Image.Resampling.NEAREST)
   board.paste(big,(x+10,y+45),big);d.text((x+12,y+12),f'{key} / {n+1} / 16',fill='#ffe0aa');d.line((x+10,y+453,x+502,y+453),fill='#70ccc5')
  board.save(ART/f'{key}-individual-review.png')
 (ART/'production.json').write_text(json.dumps(spec,indent=2)+'\n',encoding='utf-8');print('32 complete separately drawn poses imported; no mesh or pixel interpolation.')
def prepare():
 # The extra mid-pose experiment was not selected: several drawings did not
 # respect the intended support phase. Keep only complete useful drawings.
 prepare_base();spec=json.loads((ART/'production.json').read_text(encoding='utf-8'))
 from goku_whole_source import extract
 raw_path=ROOT/'art/goku/rebuild/passing-source.png';calibration,_,_=extract(raw_path,3,2,0)
 for label,key,cells in [('forward','walkForward',[1,2]),('back','walkBack',[3,4])]:
  clip=spec['clips'][key];normalize=(130/clip['scale'])/calibration.height
  for n,index in zip([2,6],cells):
   crop,rect,_=extract(raw_path,3,2,index);q=crop.resize(tuple(round(v*normalize) for v in crop.size),Image.Resampling.NEAREST)
   rgb=np.array(q.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB'));visible=np.array(q.getchannel('A'))>=THRESHOLD;skin=np.zeros(visible.shape,bool)
   for color in PALETTE[5:11]:skin|=np.all(rgb==list(bytes.fromhex(color[1:])),axis=2)
   yy,xx=np.mgrid[:q.height,:q.width];face=skin&visible&(yy>=q.height*.17)&(yy<=q.height*.30);assert np.count_nonzero(face)>20
   x=round(277-float(xx[face].mean()));y=480-q.height;source=Image.new('RGBA',(512,512));source.paste(q,(x,y))
   path=ART/f'{label}-source-{n:02}.png';source.save(path);b=native(source,clip['scale'],[0,0]).getbbox();offset=[128-round(256*clip['scale']),224-b[3]];im=native(source,clip['scale'],offset);im.save(ART/f'{key}-{n:02}.png')
   clip['frames'][n]={'source':path.relative_to(ROOT).as_posix(),'offset':offset,'rawSource':raw_path.relative_to(ROOT).as_posix(),'sourceRect':rect,'normalization':{'scale':normalize,'offset':[x,y],'canvas':[512,512]},'bbox':im.getbbox(),'phase':'guarded passing','calibrationCell':0,'wholeRedraw':True}
 (ART/'production.json').write_text(json.dumps(spec,indent=2)+'\n',encoding='utf-8')
 print('Selected8 whole poses per walk; four passing drawings fully redrawn from canonical Idle.')
if __name__=='__main__':prepare()
