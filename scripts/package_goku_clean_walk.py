"""Export genuine whole-cel loops and the keyboard-driven game capture."""
from pathlib import Path
import json,zipfile,gc
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/sprites/goku';PRE=ROOT/'public/previews';QA=ROOT/'art/goku/qa/walk-clean';QA.mkdir(exist_ok=True)
m=json.loads((OUT/'movement.json').read_text(encoding='utf-8'));loop=[];times=m['clips']['walkForward']['durations']
for n in range(len(times)):
 canvas=Image.new('RGBA',(1280,600),'#243542');d=ImageDraw.Draw(canvas)
 for col,key in enumerate(['walkForward','walkBack']):
  x=320+col*640;y=510;d.line((col*640+20,y,col*640+620,y),fill='#6ecfc8',width=2)
  im=Image.open(OUT/f'{key}-{n:02}.png').convert('RGBA').resize((768,768),Image.Resampling.NEAREST)
  canvas.alpha_composite(im,(x-384,y-672));d.text((col*640+24,24),f'{key} / {n+1} / {len(times)}',fill='#ffe2b0')
  d.line((x-8,y,x+8,y),fill='#fa8182');d.line((x,y-8,x,y+8),fill='#fa8182')
 loop.append(canvas)
loop[0].save(PRE/'goku-walk-v4-loop.png',save_all=True,append_images=loop[1:],duration=[round(t*1000/60) for t in times],loop=0,disposal=0,blend=0)
indexed=[f.convert('RGB').quantize(colors=128,dither=Image.Dither.NONE) for f in loop]
indexed[0].save(PRE/'goku-walk-v4-loop.gif',save_all=True,append_images=indexed[1:],duration=[round(t*1000/60) for t in times],loop=0,disposal=2,optimize=False)
files=[]
for folder in ['right-walkForward','right-walkBack','left-walkForward','left-walkBack']:
 samples=sorted((QA/folder).glob('*.png'));assert len(samples)==24,(folder,len(samples));files+=samples
frames=[Image.open(p).convert('RGBA') for p in files]
frames[0].save(PRE/'goku-walk-v4-gameplay.png',save_all=True,append_images=frames[1:],duration=50,loop=0,disposal=0,blend=0)
palette=frames[0].convert('RGB').quantize(colors=256);gif=[f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
gif[0].save(PRE/'goku-walk-v4-gameplay.gif',save_all=True,append_images=gif[1:],duration=50,loop=0,disposal=2,optimize=False)
for f in frames+gif+loop+indexed:f.close()
del frames,gif,loop,indexed;gc.collect()
apng=Image.open(PRE/'goku-walk-v4-gameplay.png');elapsed=0;cursor=0
for n in range(apng.n_frames):
 apng.seek(n);elapsed+=apng.info['duration'];pixels=apng.convert('RGBA').tobytes()
 while cursor<len(files) and cursor*50<elapsed-.01:
  with Image.open(files[cursor]) as original:assert original.convert('RGBA').tobytes()==pixels,cursor
  cursor+=1
assert cursor==96 and abs(elapsed-4800)<1
with zipfile.ZipFile(ROOT/'public/downloads/goku-walk-v4.zip','w',zipfile.ZIP_DEFLATED) as z:
 for key in ['walkForward','walkBack']:
  for suffix in ['.png','-animated.png','-preview.png']:z.write(OUT/(key+suffix),'goku/'+key+suffix)
  for n in range(len(times)):z.write(OUT/f'{key}-{n:02}.png',f'goku/{key}-{n:02}.png')
 for name in ['goku.json','goku-animations.json','goku-gait.json','goku-movement.json']:z.write(ROOT/f'src/data/{name}','data/'+name)
 for name in ['production.json','landmarks.json','prepack-validation.json','generation.json','prompts.json','forward-sheet-source.png','back-sheet-source.png','forward-low-step-source.png','forward-opposite-low-step-source.png','forward-mid-sheet-source.png','back-mid-sheet-source.png']:
  p=ROOT/f'art/goku/walk-v4/{name}';z.write(p,p.relative_to(ROOT).as_posix())
 for p in (ROOT/'art/goku/walk-v4').glob('*-source-??.png'):z.write(p,p.relative_to(ROOT).as_posix())
 for p in PRE.glob('goku-*-v4.png'):z.write(p,'previews/'+p.name)
 z.write(PRE/'goku-walk-v4-loop.png','previews/loop.png')
 z.write(ROOT/'GOKU-CAMINHADA-LIMPA.md','LEIA-ME.md')
report={'revision':4,'source':'actual keyboard-driven Match/Renderer Canvas','samples':cursor,'sampleFPS':20,'simulationFPS':60,'durationMs':elapsed,'losslessAPNGVerified':True,'wholeDrawings':len(times)*2,'interpolatedDrawings':0,'morphing':False}
(QA/'preview.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
