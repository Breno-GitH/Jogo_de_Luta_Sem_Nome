"""Package genuine Canvas samples from a 60 Hz simulation at 30 fps."""
from pathlib import Path
import json,gc
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/dio/qa/road-roller'
trace=json.loads((qa/'trace.json').read_text());ticks=json.loads((qa/'capture-ticks.json').read_text());files=sorted((qa/'recording').glob('*.png'))
assert len(files)==len(ticks) and len(trace)>340
assert trace[-1]['cameraZoom']=='1' and trace[-1]['standState']=='follow'
assert trace[-1]['damage']=='350' and trace[-1]['meter']=='0' and trace[-1]['hits']=='15'
phases={s['roadPhase'] for s in trace if s['roadPhase']!='none'};assert len(phases)==12
durations=[((ticks[i+1] if i+1<len(ticks) else len(trace))-tick)*1000/60 for i,tick in enumerate(ticks)]
out=ROOT/'public/previews';out.mkdir(exist_ok=True)
# Pillow traverses append_images more than once; a generator silently loses
# the animation on the second pass. Keep an explicit list until export ends.
frames=[Image.open(f).convert('RGBA') for f in files]
frames[0].save(out/'road-roller-complete.png',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=0,blend=0)
for frame in frames:frame.close()
del frames;gc.collect()
samples=[files[0],qa/'phase-barrage.png',qa/'explosion-peak.png',qa/'phase-smoke.png',qa/'phase-ascent.png']
board=Image.new('RGB',(1280,720*len(samples)))
for i,f in enumerate(samples):
    im=Image.open(f).convert('RGB');board.paste(im,(0,i*720));im.close()
palette=board.quantize(colors=256);board.close()
gif=[Image.open(f).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in files]
# GIF timing is quantized to 10ms. Round accumulated time, avoiding drift.
elapsed=rounded=0;holds=[]
for duration in durations:
    elapsed+=duration;next_rounded=round(elapsed/10)*10;holds.append(max(10,next_rounded-rounded));rounded=next_rounded
gif[0].save(out/'road-roller-complete.gif',save_all=True,append_images=gif[1:],duration=holds,loop=0,disposal=2,optimize=False)
check=Image.open(out/'road-roller-complete.png');assert check.is_animated
total=sum(check.seek(i) or check.info['duration'] for i in range(check.n_frames))
assert abs(total-len(trace)*1000/60)<2
gif_check=Image.open(out/'road-roller-complete.gif');assert gif_check.is_animated
gif_total=sum(gif_check.seek(i) or gif_check.info['duration'] for i in range(gif_check.n_frames))
assert abs(gif_total-len(trace)*1000/60)<10
report=dict(source='actual fixed-tick game Canvas, captured every second simulation tick',simulationTicks=len(trace),ticksPerSecond=60,
            capturedFrames=len(files),captureFPS=30,apngFrames=check.n_frames,durationMs=total,hits=15,damage=350,cost=200,
            cameraRestored=True,ownerAndStandReturned=True,phases=sorted(phases),trace='art/dio/qa/road-roller/trace.json')
(out/'road-roller-complete.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
