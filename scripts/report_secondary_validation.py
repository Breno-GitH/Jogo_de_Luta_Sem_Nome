"""Validate final test evidence, preserved assets and genuine preview pixels."""
from pathlib import Path
import json,re,hashlib
from PIL import Image
from build_dio_secondary import protect
ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/dio/qa/secondary'
protect()
unit=(qa/'test.log').read_text(encoding='utf-8');browser=(qa/'browser-all.log').read_text(encoding='utf-8');online=(qa/'online-final.log').read_text(encoding='utf-8');build=(qa/'build.log').read_text(encoding='utf-8')
assert re.search(r'Tests\s+337 passed',unit)
assert sum(map(int,re.findall(r'Ran (\d+) tests',unit)))==73
assert '54 passed' in browser and '5 passed' in online
assert 'built in' in build and 'error TS' not in build
version=re.search(r'ENGINE_VERSION = "([^"]+)"',(ROOT/'src/net/version.ts').read_text())[1]
production=json.loads((qa/'production-results.json').read_text());assert production['version']==version and production['errors']==[]
for k in ['actualBotEntrance','launcherRecovery','interruptionBothSides','koDissipation','mainKeyboardRT','exactAssets']:assert production[k]
assert 'passed.' in (qa/'road-production-test.log').read_text()

manifest={who:json.loads((ROOT/f'public/sprites/{who}/secondary.json').read_text()) for who in ['dio','the-world']}
counts={who:{'clips':len(m['clips']),'exportedCells':sum(c['count'] for c in m['clips'].values())} for who,m in manifest.items()}
lock=json.loads((ROOT/'art/dio/secondary-preservation.json').read_text())
preserved={who:sum(f.replace('\\','/').startswith(f'public/sprites/{who}/') for f in lock['images']) for who in ['samurai','dio','the-world','fx','road-roller','road-fx']}

preview=json.loads((ROOT/'public/previews/dio-secondary.json').read_text());files=sorted((qa/'recording').glob('*.png'))
assert len(files)==205
apng=Image.open(ROOT/'public/previews/dio-secondary.png');assert apng.is_animated and apng.size==(1280,720)
cursor=0;end=0
for i in range(apng.n_frames):
 apng.seek(i);start=end;end+=apng.info['duration'];decoded=apng.convert('RGBA').tobytes()
 while cursor<len(files) and cursor*1000/30<end-.01:
  assert cursor*1000/30>=start-.1
  with Image.open(files[cursor]) as source:assert decoded==source.convert('RGBA').tobytes(),cursor
  cursor+=1
assert cursor==205 and abs(end-205*1000/30)<2
gif=Image.open(ROOT/'public/previews/dio-secondary.gif');assert gif.is_animated;gif_ms=0
for i in range(gif.n_frames):gif.seek(i);gif_ms+=gif.info['duration']
assert abs(gif_ms-end)<10
report={'engineVersion':version,'tests':{'simulation':337,'art':73,'browser':54,'onlineExistingSamuraiRooms':5,'compiledProduction':production,'roadRollerCompiledRegression':True},'build':'TypeScript + Vite + Node passed','preservedPNGs':preserved,'newArt':counts,'preview':{**preview,'losslessCanvasCapturesVerified':cursor,'gifDurationMs':gif_ms},'files':{f:{'bytes':(ROOT/f).stat().st_size,'sha256':hashlib.sha256((ROOT/f).read_bytes()).hexdigest()} for f in ['public/downloads/dio-secondary.zip','public/previews/dio-secondary.png','public/previews/dio-secondary.gif']},'limitations':['Existing articulated pixel rig; facial expression is subtle at native face resolution.','Extreme anatomical angles still benefit from manual art review.','Own offensive throw and Dio online remain unavailable.','Preview concatenates four explicitly prepared game scenarios and has no audio.']}
(qa/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'tests':{k:v for k,v in report['tests'].items() if isinstance(v,int)},'newArt':counts,'preservedPNGs':preserved,'losslessCanvasCapturesVerified':cursor,'engineVersion':version}))
