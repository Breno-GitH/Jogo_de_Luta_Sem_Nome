"""Real Canvas capture, not a mockup. PNG preserves exact game pixels."""
from pathlib import Path
import json,shutil,gc
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'art/goku/rebuild/qa/full';OUT=ROOT/'public/previews';OUT.mkdir(exist_ok=True)
trace=json.loads((QA/'trace.json').read_text());files=sorted((QA/'recording').glob('[0-9][0-9][0-9].png'));assert len(files)==len(trace)>100
required=['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd','jumpStart','jumpRise','jumpApex','jumpFall','landing']
phases={f['animation']for f in trace};assert all(any(p.startswith(k)for p in phases)for k in required)
frames=[Image.open(p).convert('RGBA')for p in files]
frames[0].save(OUT/'goku-rebuild-gameplay.png',save_all=True,append_images=frames[1:],duration=1000/30,loop=0,disposal=0,blend=0)
samples=[frames[n].resize((640,360),Image.Resampling.NEAREST).convert('RGB')for n in [0,len(frames)//4,len(frames)//2,3*len(frames)//4]]
paletteBoard=Image.new('RGB',(640,1440))
for n,f in enumerate(samples):paletteBoard.paste(f,(0,n*360))
pal=paletteBoard.quantize(colors=256,dither=Image.Dither.NONE)
gif=[im.resize((640,360),Image.Resampling.NEAREST).convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE)for im in frames]
gif[0].save(OUT/'goku-rebuild-gameplay.gif',save_all=True,append_images=gif[1:],duration=[round((n+1)*10/3)*10-round(n*10/3)*10 for n in range(len(gif))],loop=0,disposal=2,optimize=False)
for im in frames+gif:im.close()
del frames,gif;gc.collect()
for ext in ['png','gif']:shutil.copyfile(OUT/f'goku-rebuild-gameplay.{ext}',OUT/f'goku-gameplay.{ext}')
check=Image.open(OUT/'goku-rebuild-gameplay.png');assert check.is_animated;check.seek(check.n_frames-1)
report={'source':'real Match + Renderer canvas, actual keyboard inputs, fixed60Hz physics','captureFPS':30,'samples':len(files),'durationSeconds':len(files)/30,'apngFrames':check.n_frames,'phases':sorted(phases),'apng':'exact1280x720 game pixels','gif':'exact1/2 nearest-neighbor preview, palette-limited only for GIF compatibility','silent':True}
(OUT/'goku-rebuild-gameplay.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
