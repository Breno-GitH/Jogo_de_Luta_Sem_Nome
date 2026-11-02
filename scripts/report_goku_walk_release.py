"""Collect this release's actual logs/captures without reusing older QA claims."""
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'art/goku/qa/walk-only'
sys.path.insert(0,str(ROOT/'scripts'))
from build_goku import preserve

def log(name):
    raw=(QA/name).read_bytes()
    value=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8',errors='replace')
    return re.sub(r'\x1b\[[0-9;]*m','',value)

test=log('test-final.log');browser=log('browser-final.log')
unit=re.search(r'Tests\s+(\d+) passed',test)
art=[int(n) for n in re.findall(r'Ran (\d+) tests?',test)]
browser_count=re.search(r'(\d+) passed',browser)
assert unit and len(art)==13 and browser_count
assert not re.search(r'\b(FAILED|FAILURES|ERRORS)\b',test)
assert not re.search(r'\d+ failed',browser)
baseline=json.loads((ROOT/'tests/fixtures/goku-non-walk-v2.json').read_text(encoding='utf-8'))
for name,expected in baseline['files'].items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected,name
preserve()
preview=json.loads((QA/'preview.json').read_text())
production=json.loads((QA/'production.json').read_text())
assert production['errors']==[] and production['exactServedAssets']
roster=json.loads((ROOT/'art/goku/preservation.json').read_text())
report={
 'scope':'Goku walking only: forward/back + walking transitions',
 'paintedKeysPerWalk':8,'exportedFramesPerWalk':36,'simulationFPS':60,
 'speedPxPerTick':{'forward':4.2,'backward':3.8},
 'sourceAndPrompts':'art/goku/walk-v3/generation.json',
 'preserved':{'gokuPNGs':len(baseline['files']),'gokuClipsPerMetadata':21,'otherRosterPNGAndDataFiles':len(roster)},
 'tests':{'vitest':int(unit.group(1)),'art':sum(art),'artSuites':len(art),'focusedChrome':int(browser_count.group(1)),'productionSmoke':True},
 'actualCanvasPreview':preview,'production':production,
 'limitations':['AI-assisted painted sources and computed native intermediates; not every exported frame is hand painted.',
 'Slow playback can expose fold/occlusion changes and the change in finish from painted walks to preserved Idle.',
 'Walking speed intentionally reduced to match stride; dash and airborne movement unchanged.',
 'Focused Goku browser tests were run; the whole historical browser/online suite was not rerun for this art-only revision.']
}
(QA/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps(report['tests']))
