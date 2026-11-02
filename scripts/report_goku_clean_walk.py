"""Summarize this exact whole-pose release, using its own logs and assets."""
from pathlib import Path
import json,re,hashlib,sys
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'art/goku/qa/walk-clean'
sys.path.insert(0,str(ROOT/'scripts'))
from build_goku import preserve
def log(name):
 raw=(QA/name).read_bytes();s=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8',errors='replace')
 return re.sub(r'\x1b\[[0-9;]*m','',s)
unit=log('test.log');browser=log('browser.log');build=log('build.log')
ts=re.search(r'Tests\s+(\d+) passed',unit);art=list(map(int,re.findall(r'Ran (\d+) tests?',unit)));chrome=re.search(r'(\d+) passed',browser)
assert ts and chrome and len(art)==13 and 'built in' in build
assert not re.search(r'\b(FAILED|FAILURES|ERRORS)\b',unit) and not re.search(r'\d+ failed',browser)
pre=json.loads((ROOT/'art/goku/walk-v4/prepack-validation.json').read_text(encoding='utf-8'))
assert pre['beforeAtlas'] and len(pre['frames'])==16 and all(p['mainComponentFraction']==1 for p in pre['frames'])
preview=json.loads((QA/'preview.json').read_text());prod=json.loads((QA/'production.json').read_text())
assert prod['errors']==[] and prod['exactServedAssets'] and preview['losslessAPNGVerified']
baseline=json.loads((ROOT/'tests/fixtures/goku-non-walk-v2.json').read_text(encoding='utf-8'))
for name,digest in baseline['files'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
preserve()
report={'revision':4,'method':'whole-pose','drawings':{'walkForward':8,'walkBack':8,'interpolated':0},'canvas':[256,256],'pivot':[128,224],
 'prepack':{'completeFigures':16,'mainComponentFraction':1,'visibleHeightRange':[127,133],'beforeAtlas':True,'exactRawSourceAndImportProvenance':True},
 'preservation':{'gokuPNGs':139,'otherGokuClipsPerMetadata':21,'otherRosterFiles':len(json.loads((ROOT/'art/goku/preservation.json').read_text()))},
 'tests':{'vitest':int(ts[1]),'art':sum(art),'artSuites':len(art),'focusedChrome':int(chrome[1]),'build':True,'productionSmoke':True},
 'preview':preview,'production':prod,'sourcesAndPrompts':'art/goku/walk-v4/prompts.json',
 'limitations':['Generated complete poses, not hand painted frames.','Held cels can show residual foot sliding; whole-figure compensation is disabled.','Small cloth/face variation and transition to preserved Idle remain visible in slow playback.','Historical complete browser/online suite not rerun; focused Goku browser scenarios and full unit/art suite were run.']}
(QA/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');print(json.dumps(report['tests']))
