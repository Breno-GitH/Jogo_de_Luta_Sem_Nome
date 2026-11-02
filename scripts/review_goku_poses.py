"""Nearest-neighbor comparison from actual game cells, never a mock sheet."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'art/goku/revision';out.mkdir(exist_ok=True)
keys=[('idle',0),('walkForward',0),('walkForward',6),('walkForward',12),('walkBack',6),('crouchStart',1),('crouchIdle',0),('jumpStart',1),('jumpRise',2),('jumpApex',0),('jumpFall',1),('landing',1)]
board=Image.new('RGB',(1320,900),'#223341');d=ImageDraw.Draw(board)
for i,(key,index) in enumerate(keys):
 x=i%4*330;y=i//4*300
 im=Image.open(ROOT/f'public/sprites/goku/{key}-{index:02}.png').crop((78,88,181,225)).resize((206,274),Image.Resampling.NEAREST)
 board.paste(im,(x+60,y+20),im);d.text((x+8,y+4),f'{key} / {index+1}',fill='#ffe0a5')
board.save(out/'pose-review-v2.png')
comparison=Image.new('RGB',(1024,1600),'#223341');d=ImageDraw.Draw(comparison)
for i,(key,index) in enumerate([('walkForward',0),('walkForward',6),('crouchIdle',0),('jumpRise',2),('jumpApex',0)]):
 y=i*320;d.text((10,y+4),key+' / anterior | novo',fill='#ffe0a5')
 for col,folder in enumerate(['goku-v1','goku']):
  m=json.loads((ROOT/f'public/sprites/{folder}/movement.json').read_text());n=round(index*(m['clips'][key]['count']-1)/max(1,json.loads((ROOT/'public/sprites/goku/movement.json').read_text())['clips'][key]['count']-1))
  im=Image.open(ROOT/f'public/sprites/{folder}/{key}-{n:02}.png').crop((65,85,189,225)).resize((248,280),Image.Resampling.NEAREST)
  comparison.paste(im,(150+col*500,y+30),im)
comparison.save(out/'comparison.png')
(ROOT/'public/previews/goku-comparison.png').write_bytes((out/'comparison.png').read_bytes())
(ROOT/'public/previews/goku-pose-review.png').write_bytes((out/'pose-review-v2.png').read_bytes())
print('pose-review-v2.png + comparison.png')
