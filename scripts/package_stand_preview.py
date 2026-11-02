"""Package genuine fixed-tick Canvas captures; no generated mock gameplay."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
qa = ROOT / 'art/dio/qa/stand-only'
files = sorted((qa / 'combo-recording').glob('*.png'))
trace = json.loads((qa / 'combo-trace.json').read_text())
assert len(files) == len(trace) and 60 <= len(trace) <= 180
assert all(p['revision'] == '3' for p in trace)
assert int(trace[-1]['maxCombo']) == 3
assert trace[-1]['standMode'] == 'follow'
assert len({p['playerX'] for p in trace}) == 1, 'Dio must remain in place'
frames = [Image.open(p).convert('RGBA') for p in files]
out = ROOT / 'public/previews'
out.mkdir(exist_ok=True)
target = out / 'dio-stand-combo.png'
frames[0].save(target, save_all=True, append_images=frames[1:], duration=1000/60,
               loop=0, disposal=0, blend=0)
# One palette, no dithering or resampling. GIF fallback runs at 30 fps.
palette = frames[0].convert('RGB').quantize(colors=256)
gif = [f.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
       for f in frames[::2]]
gif[0].save(out / 'dio-stand-combo.gif', save_all=True, append_images=gif[1:],
            duration=[30 if i % 3 != 2 else 40 for i in range(len(gif))],
            loop=0, disposal=2, optimize=False)
check = Image.open(target)
# Encoders may merge the identical hitstop frames; preserve their time.
duration = sum(check.seek(i) or check.info['duration'] for i in range(check.n_frames))
assert abs(duration - len(frames)*1000/60) < 2
(out / 'dio-stand-combo.json').write_text(json.dumps({
    'source': 'actual Canvas frames from paused game, advancing one fixed tick per capture',
    'sourceTicks': len(frames), 'ticksPerSecond': 60,
    'apngFrames': check.n_frames, 'combo': 'Stand Light > Medium > Heavy',
    'damage': int(trace[-1]['damage']), 'hits': int(trace[-1]['hits']),
    'ownerRemainsInPlace': True, 'nearestNeighborCameraZoom': 2,
    'sourceTrace': 'art/dio/qa/stand-only/combo-trace.json'
}, indent=2) + '\n')
print(json.dumps({'preview': str(target.relative_to(ROOT)), 'ticks': len(frames),
                  'frames': check.n_frames, 'durationMs': duration}))
