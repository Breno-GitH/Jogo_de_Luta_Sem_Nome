"""Package real exported walks and the actual keyboard-driven Canvas capture."""
from pathlib import Path
import json,zipfile,gc,sys
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/sprites/goku';PRE=ROOT/'public/previews';QA=ROOT/'art/goku/qa/walk-only'
manifest=json.loads((OUT/'movement.json').read_text());animation=json.loads((OUT/'animations.json').read_text())
for key in ['walkForward','walkBack']:
 board=Image.new('RGB',(1968,900),'#243542');d=ImageDraw.Draw(board)
 for n,t in enumerate([0,4,9,13,18,22,27,31]):
  im=Image.open(OUT/f'{key}-{t:02}.png').crop((48,88,212,225)).resize((492,411),Image.Resampling.NEAREST)
  x=n%4*492;y=n//4*450;board.paste(im,(x,y+30),im);d.text((x+12,y+8),f'{key} / {t+1} / 36',fill='#ffd99d')
 board.save(PRE/f'goku-{key}-v3.png')
if '--boards-only' in sys.argv:sys.exit(0)
files=[]
for folder in ['right-walkForward','right-walkBack','left-walkForward','left-walkBack']:
 samples=sorted((QA/folder).glob('*.png'));assert len(samples)==24,(folder,len(samples));files+=samples
frames=[Image.open(f).convert('RGBA') for f in files]
frames[0].save(PRE/'goku-walk-v3-gameplay.png',save_all=True,append_images=frames[1:],duration=50,loop=0,disposal=0,blend=0)
palette=frames[0].convert('RGB').quantize(colors=256);gif=[f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
gif[0].save(PRE/'goku-walk-v3-gameplay.gif',save_all=True,append_images=gif[1:],duration=50,loop=0,disposal=2,optimize=False)
for f in frames+gif:f.close()
del frames,gif;gc.collect()
with zipfile.ZipFile(ROOT/'public/downloads/goku-walk-v3.zip','w',zipfile.ZIP_DEFLATED) as z:
 for key in ['walkForward','walkBack']:
  for suffix in ['.png','-animated.png','-preview.png']:z.write(OUT/(key+suffix),'goku/'+key+suffix)
  for t in range(36):z.write(OUT/f'{key}-{t:02}.png',f'goku/{key}-{t:02}.png')
 for name in ['walk-head.png','walkStopForward.png','walkStopBack.png','walk-transitions.json']:z.write(OUT/name,'goku/'+name)
 for name in ['goku.json','goku-animations.json','goku-gait.json','goku-movement.json','goku-walk-transitions.json']:z.write(ROOT/f'src/data/{name}','data/'+name)
 z.write(ROOT/'art/goku/walk-v3/generation.json','generation.json')
check=Image.open(PRE/'goku-walk-v3-gameplay.png');end=0;cursor=0
for n in range(check.n_frames):
 check.seek(n);end+=check.info['duration'];decoded=check.convert('RGBA').tobytes()
 while cursor<len(files) and cursor*50<end-.01:
  with Image.open(files[cursor]) as original:assert original.convert('RGBA').tobytes()==decoded,cursor
  cursor+=1
assert cursor==96 and abs(end-4800)<1
report={'source':'actual Match/Renderer Canvas with keyboard controls, not a rendered demonstration','samples':cursor,'sampleFPS':20,'simulationFPS':60,'durationMs':end,'walks':['forward right-facing','backward right-facing','forward left-facing','backward left-facing'],'pngs':['goku/walkForward.png','goku/walkBack.png'],'nearestNeighbor':True,'losslessAPNGVerified':True}
(QA/'preview.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
