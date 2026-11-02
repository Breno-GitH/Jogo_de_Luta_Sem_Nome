"""Verify release evidence and lossless preview against the real game Canvas."""
from pathlib import Path
import json,re,hashlib
from PIL import Image
from build_goku import preserve
ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/goku/qa';preserve()
test=(qa/'test.log').read_text(encoding='utf-8');browser=(qa/'browser-all.log').read_text(encoding='utf-8');online=(qa/'online-test.log').read_text(encoding='utf-8');build=(qa/'build.log').read_text(encoding='utf-8')
assert re.search(r'Tests\s+357 passed',test)
assert sum(map(int,re.findall(r'Ran (\d+) tests',test)))==84
rerun=(qa/'browser-rerun.log').read_text(encoding='utf-8')
assert '59 passed' in browser and '1 passed' in rerun and '5 passed' in online
assert 'records a real Stand-only ground combo' in rerun
assert 'Ran 11 tests' in (qa/'goku-art.log').read_text(encoding='utf-8')
assert 'built in' in build and 'error TS' not in build
version=re.search(r'ENGINE_VERSION = "([^"]+)"',(ROOT/'src/net/version.ts').read_text())[1]
production=json.loads((qa/'production-results.json').read_text());assert production['version']==version and production['errors']==[]
for k in ['mainTraining','walkBothDirections','mirroring','crouch','jump','allExportedSheetsInspectable','unimplementedAttacksHonest','receivesBotAttacks','pause','exactServedAssets']:assert production[k]
assert production['comparison'] and production['wallCrouchRecovery'] and production['revision']==2
m=json.loads((ROOT/'public/sprites/goku/movement.json').read_text());lock=json.loads((ROOT/'art/goku/preservation.json').read_text())
preserved={who:sum(name.replace('\\','/').startswith(f'public/sprites/{who}/') for name in lock) for who in ['samurai','dio','the-world']}
trace=json.loads((qa/'trace.json').read_text());files=sorted((qa/'recording').glob('*.png'));assert len(files)==len(trace)
required=['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd','jumpStart','jumpRise','jumpApex','jumpFall','landing'];assert all(any(t['animation'].startswith(k) for t in trace) for k in required)
apng=Image.open(ROOT/'public/previews/goku-gameplay.png');assert apng.is_animated and apng.size==(1280,720)
cursor=0;end=0
for i in range(apng.n_frames):
 apng.seek(i);start=end;end+=apng.info['duration'];decoded=apng.convert('RGBA').tobytes()
 while cursor<len(files) and cursor*1000/30<end-.01:
  assert cursor*1000/30>=start-.1
  with Image.open(files[cursor]) as im:assert decoded==im.convert('RGBA').tobytes(),cursor
  cursor+=1
assert cursor==len(files) and abs(end-len(files)*1000/30)<2
gif=Image.open(ROOT/'public/previews/goku-gameplay.gif');assert gif.is_animated;gif_ms=0
for i in range(gif.n_frames):gif.seek(i);gif_ms+=gif.info['duration']
assert abs(gif_ms-end)<10
overview=Image.open(ROOT/'public/previews/goku-movement.png');assert overview.is_animated and overview.size==(1024,880)
report={'revision':2,'engineVersion':version,'approvedSourceSha256':hashlib.sha256((ROOT/'art/goku/revision/approved-source.png').read_bytes()).hexdigest(),'tests':{'simulation':357,'art':84,'browser':60,'onlineExistingSamuraiRooms':5,'compiledProduction':production},'build':'TypeScript + Vite + Node passed','newArt':{'basicClips':13,'basicCells':sum(m['clips'][k]['count'] for k in required),'totalSheets':len(m['clips']),'totalCells':sum(c['count'] for c in m['clips'].values())},'preservedPNGs':preserved,'mobility':{'samuraiSpeed':5.5,'gokuSpeed':6.1,'airSpeed':6.5,'jump':-17.7},'preview':{'losslessCanvasSamplesVerified':cursor,'durationMs':end,'captureFPS':30,'gifDurationMs':gif_ms,'phases':sorted(set(s['animation'] for s in trace))},'files':{f:{'bytes':(ROOT/f).stat().st_size,'sha256':hashlib.sha256((ROOT/f).read_bytes()).hexdigest()} for f in ['public/downloads/goku-movement.zip','public/previews/goku-gameplay.png','public/previews/goku-gameplay.gif','public/previews/goku-movement.png']},'limitations':['Movement-stage character selectable in Training; no attacks, specials, Super or Goku online.','Four provisional support reaction sheets; extreme fabric folds benefit from manual refinement.','User-approved generated image supplies the actual new head/upper gi and painted cloth colours; limbs use a native-pixel articulated rig, not manual frame-by-frame animation.','The 130px palette import retains less facial and cloth detail than the supplied large guide.']}
report['testNotes']=['Initial concurrent unit run exceeded the 5s BOT self-play timeout; the clean npm test run passed all 357 simulation tests and 84 art checks.','The full browser run passed 59/60. The last existing Dio recording scenario exceeded its 5s initial asset-load wait; its isolated rerun passed. All 60 scenarios were covered, not a single uninterrupted 60/60 run.']
(qa/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'tests':{'simulation':357,'art':84,'browser':60,'online':5},'newArt':report['newArt'],'preservedPNGs':preserved,'losslessCanvasSamplesVerified':cursor,'engineVersion':version}))
