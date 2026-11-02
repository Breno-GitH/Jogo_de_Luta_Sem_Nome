"""Final, evidence-based validation record for the ordinary specials."""
from pathlib import Path
from datetime import datetime,timezone
import json,re
from build_dio_specials import protect

ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/dio/qa/specials'
files={'unit':'final-unit.log','art':'test.log','browser':'browser-all.log',
       'online':'online-final.log','production':'production-test.log','capture':'capture-final.log'}
logs={k:(qa/f).read_text(encoding='utf-8-sig') for k,f in files.items()}
assert '284 passed' in logs['unit']
assert sum(map(int,re.findall(r'Ran (\d+) tests',logs['art'])))==57
assert '41 passed' in logs['browser'] and '5 passed' in logs['online']
assert 'built in' in logs['online'] and '1 passed' in logs['capture']
assert 'exact exported files passed' in logs['production']
production=json.loads((qa/'production-results.json').read_text())
assert len(production['cases'])==12 and not production['errors']
assert all(production[k] for k in ['mainKeyboard','freeze','cooldownProgression','roundPersistence','newMatchReset','downloadsByteIdentical'])
protect();lock=json.loads((ROOT/'art/dio/specials-preservation.json').read_text())
manifests={who:json.loads((ROOT/f'public/sprites/{who}/specials.json').read_text()) for who in ['dio','the-world']}
result={
 'revision':4,'recordedAtUTC':datetime.now(timezone.utc).isoformat(),
 'implemented':['knife projectiles: 1/2/3','Muda Rush: 4/7/10 contacts','selective 120-tick time stop',
                'match-persistent progressive cooldown','separate sprites, effects and inspection'],
 'tests':{'typescript':284,'art':57,'browserScenarios':41,'onlineTwoBrowserScenarios':5,
          'productionVariantCases':12,'captureRetest':1,'build':'passed'},
 'preservation':{'approvedPNGs':len(lock['images']),'samuraiPNGs':sum('/samurai/' in f.replace('\\','/') for f in lock['images']),
                 'approvedClipEntriesUnchanged':True,'originalNormalDataUnchanged':True,'originalSamuraiDataUnchanged':True},
 'art':{who:{'clips':len(m['clips']),'exportedCells':sum(c['count'] for c in m['clips'].values())} for who,m in manifests.items()},
 'preview':json.loads((ROOT/'public/previews/dio-muda-rush.json').read_text()),
 'production':production,'logFiles':files,
 'testHarnessCorrections':['Accept checkpoint repair without requiring a shared session ID rotation.',
                          'Compare converged ticks after repair, excluding the deliberately corrupted interval.'],
 'limitations':['Articulated pixel rig and limited facial acting; existing Dio reactions remain provisional.',
                'Initial balance; no human playtest session claimed.',
                'Road Roller, Dio online and Dio throws are not implemented.',
                'Ground-only specials; no projectile clashes or reflection.']}
(qa/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'tests':result['tests'],'preservation':result['preservation'],'art':result['art']}))
