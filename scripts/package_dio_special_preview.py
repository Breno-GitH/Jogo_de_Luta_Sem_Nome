"""Lossless preview of real game Canvas frames, one fixed update per image."""
from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
qa=ROOT/'art/dio/qa/specials';trace=json.loads((qa/'rush-trace.json').read_text())
files=sorted((qa/'rush-recording').glob('*.png'))
assert len(files)==len(trace) and 80<len(trace)<210
assert trace[-1]['hits']=='10' and trace[-1]['ownerStandState']=='follow'
assert int(trace[-1]['targetHealth']) < 1000
assert all(s['revision']=='4' for s in trace)
assert len({s['playerX'] for s in trace})==1
frames=[Image.open(f).convert('RGBA') for f in files]
out=ROOT/'public/previews';out.mkdir(exist_ok=True)
target=out/'dio-muda-rush.png'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=1000/60,loop=0,disposal=0,blend=0)
palette=frames[0].convert('RGB').quantize(colors=256)
gif=[f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in frames[::2]]
gif[0].save(out/'dio-muda-rush.gif',save_all=True,append_images=gif[1:],duration=[30 if i%3!=2 else 40 for i in range(len(gif))],loop=0,disposal=2,optimize=False)
check=Image.open(target);duration=sum(check.seek(i) or check.info['duration'] for i in range(check.n_frames))
assert abs(duration-len(trace)*1000/60)<2
(out/'dio-muda-rush.json').write_text(json.dumps({'source':'actual fixed-tick game Canvas capture','sourceTicks':len(trace),
  'ticksPerSecond':60,'apngFrames':check.n_frames,'hits':10,'ownerStationary':True,'durationMs':duration,
  'sourceTrace':'art/dio/qa/specials/rush-trace.json'},indent=2)+'\n')
print(json.dumps({'sourceTicks':len(trace),'apngFrames':check.n_frames,'durationMs':duration}))
