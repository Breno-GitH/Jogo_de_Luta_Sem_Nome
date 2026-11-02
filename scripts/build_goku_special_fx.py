"""Import separate generated pixel FX; no character pixels in this atlas."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/specials/stage3';OUT=ROOT/'public/sprites/goku/specials'
COLORS=['#071a41','#06356e','#0758ad','#087eef','#1ba8f5','#32cef5','#72eaff','#b9f8ff','#f0ffff','#ffffff','#89530b','#bb7a07','#e9ae0e','#ffd73a','#fff17b','#fff9ce']
pal=Image.new('P',(1,1));values=[v for c in COLORS for v in bytes.fromhex(c[1:])];pal.putpalette(values+values[:3]*(256-len(COLORS)))
specs=[('ki','energy',0,4),('origin','energy',1,4),('body','energy',2,4),('tip','energy',3,4),('impact','impact',0,3),('dissipate','impact',1,3),('teleport','impact',2,3)]
clips={};proof={}
for key,source,row,rows in specs:
 raw=Image.open(ART/f'{source}-source.png').convert('RGBA');images=[];records=[]
 for col in range(4):
  rect=[round(col*raw.width/4),round(row*raw.height/rows),round((col+1)*raw.width/4),round((row+1)*raw.height/rows)];cell=raw.crop(rect)
  cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=180 else 0));bbox=cell.getbbox();assert bbox
  cell=cell.crop(bbox)
  # A repeating beam tile deliberately crops a central strip; source tips
  # and origins are separate, so a stretched energy ball is never the beam.
  tileCrop=None
  if key=='body':
   a=np.array(cell);white=(a[:,:,0]>220)&(a[:,:,1]>220)&(a[:,:,2]>220)&(a[:,:,3]>0);center=int(np.argmax(white.sum(axis=1)));half=round(cell.height*.22)
   tileCrop=[round(cell.width*.2),max(0,center-half),round(cell.width*.8),min(cell.height,center+half)];cell=cell.crop(tileCrop)
  scale=min(88/cell.width,88/cell.height);small=cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.NEAREST)
  q=small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a);frame=Image.new('RGBA',(96,96));offset=((96-q.width)//2,(96-q.height)//2);frame.paste(q,offset);images.append(frame)
  records.append({'source':source+'-source.png','cell':rect,'bbox':bbox,'tileCrop':tileCrop,'scale':scale,'offset':offset,'bounds':frame.getbbox()})
 sheet=Image.new('RGBA',(384,96))
 for i,im in enumerate(images):sheet.paste(im,(i*96,0));im.save(OUT/f'fx-{key}-{i}.png')
 sheet.save(OUT/f'fx-{key}.png');clips[key]={'sheet':f'goku/specials/fx-{key}.png','frames':4,'bounds':[im.getbbox()for im in images]};proof[key]=records
(ROOT/'src/data/goku-special-fx.json').write_text(json.dumps({'cell':96,'palette':COLORS,'clips':clips},indent=2)+'\n')
(ART/'fx-production.json').write_text(json.dumps(proof,indent=2)+'\n');print('Seven independent FX atlases exported.')
