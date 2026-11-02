"""Package the actual browser capture, without synthesizing a mock animation."""
from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
qa=ROOT/'art/dio/qa/revision'
source=qa/'walk-recording';files=sorted(source.glob('*.png'))
if len(files)!=80:raise ValueError('Run e2e/dio-revision.pw.mjs to record 80 actual simulation ticks first')
trace=json.loads((qa/'walk-trace.json').read_text())
if len(trace)!=80 or any(p['revision']!='2' for p in trace):raise ValueError('Capture is not from revision 2')
frames=[Image.open(f).convert('RGBA') for f in files]
floor_rows=[]
for f in frames:
    floor_rows.append(next(y for y in range(f.height) if f.getpixel((0,y))[:3]==(98,117,119)))
if len(set(floor_rows))!=1:raise ValueError('The camera made the ground oscillate during the walking capture')
out=ROOT/'public/previews';out.mkdir(exist_ok=True)
target=out/'dio-movement-v2-before-after.png'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=1000/60,loop=0,disposal=0,blend=0)
# Compatibility GIF at 30fps. A single palette prevents per-frame hue flicker.
# Pixel positions are unchanged; 30/30/40 ms holds approximate 1/30 second.
palette=frames[0].convert('RGB').quantize(colors=256)
gif=[f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in frames[::2]]
gif[0].save(out/'dio-movement-v2-before-after.gif',save_all=True,append_images=gif[1:],duration=[30 if i%3!=2 else 40 for i in range(len(gif))],loop=0,disposal=2,optimize=False)
check=Image.open(target)
assert check.n_frames==80
assert abs(sum(check.seek(i) or check.info['duration'] for i in range(check.n_frames))-80*1000/60)<1
(out/'dio-movement-v2-before-after.json').write_text(json.dumps({'source':'actual production browser Canvas captured by Playwright','frames':80,'ticksPerSecond':60,'stableFloorScreenY':floor_rows[0],'left':'previous drawings, current physics','right':'revision 2','sourceTrace':'art/dio/qa/revision/walk-trace.json'},indent=2)+'\n')
print(json.dumps({'apng':str(target.relative_to(ROOT)),'frames':80,'gifFrames':40}))
