"""Real exported drawings, plus the Canvas recording of actual keyboard play."""
from pathlib import Path
import json,gc
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'public/previews';out.mkdir(exist_ok=True);qa=ROOT/'art/goku/qa'
m=json.loads((ROOT/'public/sprites/goku/movement.json').read_text())
required=['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd','jumpStart','jumpRise','jumpApex','jumpFall','landing']
images={k:[Image.open(ROOT/f'public/sprites/goku/{k}-{i:02}.png').convert('RGBA') for i in range(m['clips'][k]['count'])] for k in required}
frames=[]
for t in range(120):
 board=Image.new('RGB',(1024,880),'#182631');d=ImageDraw.Draw(board)
 for i,k in enumerate(required):
  x=(i%4)*256;y=(i//4)*220;clip=m['clips'][k];d.text((x+10,y+8),f'{k} / {clip["count"]}',fill='#f3d58c')
  total=sum(clip['durations']);clock=t%total if clip['loop'] else min(t%60,total-1);index=0
  for j,hold in enumerate(clip['durations']):
   index=j
   if clock<hold:break
   clock-=hold
  im=images[k][index];board.paste(im,(x,y-28),im);d.line((x+20,y+196,x+236,y+196),fill='#48616b')
 frames.append(board)
frames[0].save(out/'goku-movement.png',save_all=True,append_images=frames[1:],duration=1000/60,loop=0,disposal=0,blend=0)
palette=frames[0].quantize(colors=256);gif=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames[::2]]
gif[0].save(out/'goku-movement.gif',save_all=True,append_images=gif[1:],duration=[30,40,30]*20,loop=0,disposal=2,optimize=False)
for f in frames+gif:f.close()
del frames,gif;gc.collect()
trace_path=qa/'trace.json'
if trace_path.exists():
 trace=json.loads(trace_path.read_text());files=sorted((qa/'recording').glob('*.png'));assert len(files)==len(trace)
 phases={s['animation'] for s in trace};assert all(any(v.startswith(k) for v in phases) for k in required)
 frames=[Image.open(f).convert('RGBA') for f in files]
 frames[0].save(out/'goku-gameplay.png',save_all=True,append_images=frames[1:],duration=1000/30,loop=0,disposal=0,blend=0)
 for f in frames:f.close()
 del frames;gc.collect()
 samples=[files[i] for i in [0,len(files)//4,len(files)//2,len(files)*3//4]];board=Image.new('RGB',(1280,720*len(samples)))
 for i,f in enumerate(samples):
  im=Image.open(f).convert('RGB');board.paste(im,(0,i*720));im.close()
 palette=board.quantize(colors=256);board.close();gif=[Image.open(f).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in files]
 holds=[round((i+1)*10/3)*10-round(i*10/3)*10 for i in range(len(gif))]
 gif[0].save(out/'goku-gameplay.gif',save_all=True,append_images=gif[1:],duration=holds,loop=0,disposal=2,optimize=False)
 check=Image.open(out/'goku-gameplay.png');assert check.is_animated;duration=0
 for i in range(check.n_frames):check.seek(i);duration+=check.info['duration']
 assert abs(duration-len(files)*1000/30)<2
 report={'source':'actual Match + Renderer Canvas controlled by keyboard at fixed 60 Hz','samples':len(files),'captureFPS':30,'durationMs':duration,'apngFrames':check.n_frames,'phases':sorted(phases),'silent':True,'drawingOverview':'goku-movement.png','overviewMeaning':'13 exported locomotion clips in inspection loops; physical jump trajectory is shown in gameplay capture'}
 (out/'goku-gameplay.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
