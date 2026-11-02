"""Verify release evidence and the lossless preview against actual Canvas captures."""
from pathlib import Path
import json,re,hashlib
from PIL import Image
from build_road_roller import protect

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'art/dio/qa/road-roller'
protect()
unit=(QA/'test.log').read_text(encoding='utf-8')
browser=(QA/'browser-all.log').read_text(encoding='utf-8')
online=(QA/'online-test.log').read_text(encoding='utf-8')
last_unit=(QA/'final-unit.log').read_text(encoding='utf-8')
assert re.search(r'Tests\s+307 passed',unit)
art_counts=[int(x) for x in re.findall(r'Ran (\d+) tests',unit)]
assert sum(art_counts)==66 and len(art_counts)==10
assert '48 passed' in browser and '5 passed' in online
assert 'built in' in online and 'error TS' not in online
assert re.search(r'Tests\s+23 passed',last_unit)
production=json.loads((QA/'production-results.json').read_text())
assert production['errors']==[] and len(production['results'])==4
assert all(production[k] for k in ['insufficientMeter','block','ko','rematch','cooldownPreserved','mainKeyboardConfirmed','pause','cameraRestored','exactAssets'])
version=re.search(r'ENGINE_VERSION = "([^"]+)"',(ROOT/'src/net/version.ts').read_text())[1]
assert production['version']==version

preview=json.loads((ROOT/'public/previews/road-roller-complete.json').read_text())
ticks=json.loads((QA/'capture-ticks.json').read_text())
files=sorted((QA/'recording').glob('*.png'))
apng=Image.open(ROOT/'public/previews/road-roller-complete.png')
assert apng.is_animated and apng.size==(1280,720)
cursor=0;end=0;checked=0
for i in range(apng.n_frames):
    apng.seek(i);start=end;end+=apng.info['duration']
    decoded=apng.convert('RGBA').tobytes()
    while cursor<len(ticks) and ticks[cursor]*1000/60 < end-.01:
        assert ticks[cursor]*1000/60 >= start-.1
        with Image.open(files[cursor]) as actual:assert decoded==actual.convert('RGBA').tobytes(),cursor
        cursor+=1;checked+=1
assert checked==180 and abs(end-6000)<2
gif=Image.open(ROOT/'public/previews/road-roller-complete.gif')
assert gif.is_animated and gif.size==apng.size
gif_ms=0
for i in range(gif.n_frames):gif.seek(i);gif_ms+=gif.info['duration']
assert gif_ms==6000

counts={}
for name,path in [('dio','dio/road-roller.json'),('theWorld','the-world/road-roller.json'),('object','road-roller/manifest.json'),('effects','road-fx/manifest.json')]:
    data=json.loads((ROOT/'public/sprites'/path).read_text())
    counts[name]={'clips':len(data['clips']),'exportedCells':sum(c['count'] for c in data['clips'].values())}
bridges=json.loads((ROOT/'public/sprites/the-world/road-transitions.json').read_text())
counts['cancelTransitions']={'clips':len(bridges),'exportedCells':sum(c['count'] for c in bridges.values())}
lock=json.loads((ROOT/'art/dio/road-preservation.json').read_text())
preserved={who:sum(f.replace('\\','/').startswith('public/sprites/'+who+'/') for f in lock['images']) for who in ['samurai','dio','the-world','fx']}
report={
 'engineVersion':version,'build':'TypeScript + Vite + Node server passed',
 'tests':{'simulation':307,'art':66,'browser':48,'onlineTwoBrowsers':5,'finalSuperUnitRerun':23,'compiledProduction':production},
 'preservedPNGs':preserved,'newAssets':counts,
 'preview':{**preview,'losslessCanvasSamplesVerified':checked,'gifFrames':gif.n_frames,'gifDurationMs':gif_ms},
 'files':{name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['public/downloads/road-roller.zip','public/previews/road-roller-complete.png','public/previews/road-roller-complete.gif']},
 'limitations':['Articulated pixel rig with limited facial acting and volume rotation.','Initial damage and timing; no long-term human competitive balance study.','Integer camera zoom cuts; synthesized audio without voices.','Dio remains local-only; online regression covers the existing Samurai rooms.']
}
(QA/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'tests':{k:v for k,v in report['tests'].items() if isinstance(v,int)},'preservedPNGs':preserved,'newAssets':counts,'losslessCanvasSamplesVerified':checked,'previewMs':end,'engineVersion':version}))
