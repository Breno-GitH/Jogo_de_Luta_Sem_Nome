"""Package four explicitly staged, real fixed-tick Canvas captures."""
from pathlib import Path
import json,gc
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/dio/qa/secondary';out=ROOT/'public/previews';out.mkdir(exist_ok=True)
trace=json.loads((qa/'trace.json').read_text());files=sorted((qa/'recording').glob('*.png'))
assert len(files)==len(trace)==205
assert {t['scenario'] for t in trace}=={'entrance','taunt','launched','ko'}
assert any(t['standClip']=='secondaryAppear' for t in trace)
assert any(t['standClip']=='secondaryHidden' and t['scenario']=='ko' for t in trace)
assert any(t['animation']=='secondaryGetup' for t in trace)
frames=[Image.open(f).convert('RGBA') for f in files];target=out/'dio-secondary.png'
frames[0].save(target,save_all=True,append_images=frames[1:],duration=1000/30,loop=0,disposal=0,blend=0)
for f in frames:f.close()
del frames;gc.collect()
samples=[files[i] for i in [0,44,70,110,160,194]]
board=Image.new('RGB',(1280,720*len(samples)))
for i,f in enumerate(samples):
 im=Image.open(f).convert('RGB');board.paste(im,(0,i*720));im.close()
palette=board.quantize(colors=256);board.close()
frames=[Image.open(f).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE) for f in files]
# Round cumulative milliseconds to GIF's 10ms units, preserving the 30fps rate.
holds=[round((i+1)*10/3)*10-round(i*10/3)*10 for i in range(len(frames))]
frames[0].save(out/'dio-secondary.gif',save_all=True,append_images=frames[1:],duration=holds,loop=0,disposal=2,optimize=False)
apng=Image.open(target);assert apng.is_animated
duration=0
for i in range(apng.n_frames):apng.seek(i);duration+=apng.info['duration']
assert abs(duration-len(trace)*1000/30)<2
report={'source':'four explicitly staged real game Canvas scenarios, not a continuous fight','scenarios':['entrance','taunt','launched','ko'],'simulationHz':60,'capturedFrames':len(files),'captureFPS':30,'durationMs':duration,'apngFrames':apng.n_frames,'silent':True,'trace':'art/dio/qa/secondary/trace.json'}
(out/'dio-secondary.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
