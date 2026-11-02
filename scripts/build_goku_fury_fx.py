"""Independent pixel FX. No body pixels, binary transparency and flat ramps."""
from goku_fury_art import ROOT,ART,OUT,write
from PIL import Image
import numpy as np
COLORS=['#061731','#073c80','#0868c3','#168cf2','#2dbbff','#68ddff','#aaf4ff','#e4ffff','#ffffff','#89530b','#bb7a07','#e9ae0e','#ffd73a','#fff17b','#fff9ce','#172134','#35465e','#667990','#9eaebd','#d8e3eb']
pal=Image.new('P',(1,1));rgb=[v for c in COLORS for v in bytes.fromhex(c[1:])];pal.putpalette(rgb+rgb[:3]*(256-len(COLORS)))
specs={'goldenAura':('golden',3,3,list(range(6))), 'transformationFlash':('golden',3,3,[6,7]),'energyParticles':('golden',3,3,[8]),'auraDisappearance':('golden',3,3,[5,4,3,2,1,0]),'kamehamehaCharge':('blue',4,4,[0,1,2,3]),'beamOrigin':('blue',4,4,[0,1,2,3]),'beamBody':('blue',4,4,[4,5,6,7]),'beamTip':('blue',4,4,[4,5,6,7]),'groundImpact':('blue',4,4,[8,9,10,11]),'energyExplosion':('blue',4,4,[8,9,10,11]),'punchImpact':('blue',4,4,[8,9,10,11]),'kickImpact':('blue',4,4,[8,9,10,11]),'smoke':('blue',4,4,[12,13,14,15])}
clips={};proof={};OUT.mkdir(parents=True,exist_ok=True)
# Source art drifts a few pixels across mathematical thirds. These inspected
# whole-effect rectangles retain the entire flame/ring and exclude the ring
# from the previous row. No body is masked, assembled, warped or regenerated.
goldenRects=[[150,12,500,351],[595,12,943,353],[1030,12,1405,353],
 [150,352,510,705],[590,352,950,705],[1030,352,1410,705],
 [155,710,510,1010],[585,710,950,1010],[1030,710,1410,1010]]
for key,(name,cols,rows,cells)in specs.items():
 raw=Image.open(ART/f'raw/{name}.png').convert('RGBA');assert np.count_nonzero(np.array(raw)[:,:,3]<180)>raw.width*raw.height*.15,(name,'opaque background')
 frames=[];records=[]
 for i in cells:
  rect=goldenRects[i]if name=='golden'else[round(i%cols*raw.width/cols),round(i//cols*raw.height/rows),round((i%cols+1)*raw.width/cols),round((i//cols+1)*raw.height/rows)]
  if name=='golden':assert raw.size==(1536,1024),'review new whole-effect source rectangles'
  cell=raw.crop(rect);cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=180 else 0));b=cell.getbbox();assert b
  cell=cell.crop(b)
  if key=='beamBody':cell=cell.crop((round(cell.width*.3),round(cell.height*.3),round(cell.width*.7),round(cell.height*.7)))
  if key=='beamTip':cell=cell.crop((round(cell.width*.55),round(cell.height*.55),cell.width,cell.height))
  scale=min(120/cell.width,120/cell.height);small=cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.NEAREST)
  q=small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a)
  im=Image.new('RGBA',(128,128));offset=((128-q.width)//2,(128-q.height)//2);im.paste(q,offset);frames.append(im);records.append({'cell':rect,'bbox':b,'scale':scale,'offset':offset})
 sheet=Image.new('RGBA',(len(frames)*128,128))
 for i,im in enumerate(frames):sheet.paste(im,(i*128,0));im.save(OUT/f'fx-{key}-{i:02}.png')
 sheet.save(OUT/f'fx-{key}.png');clips[key]={'sheet':f'goku/fury/fx-{key}.png','frames':len(frames),'bounds':[im.getbbox()for im in frames]};proof[key]=records
# Existing, approved teleport artwork is reused as a separate effect entity.
from shutil import copyfile
copyfile(ROOT/'public/sprites/goku/specials/fx-teleport.png',OUT/'fx-teleport.png')
old=__import__('json').loads((ROOT/'src/data/goku-special-fx.json').read_text())['clips']['teleport'];clips['teleport']={**old,'sheet':'goku/fury/fx-teleport.png','cell':96}
write(ROOT/'src/data/goku-fury-fx.json',{'cell':128,'palette':COLORS,'clips':clips});write(ART/'fx-validation.json',proof)
print('Published',len(clips),'independent FX atlases')
