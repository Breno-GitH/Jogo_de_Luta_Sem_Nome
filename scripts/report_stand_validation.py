"""Write a final record from completed test outputs and exported files."""
from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, re

ROOT = Path(__file__).resolve().parents[1]
qa = ROOT / 'art/dio/qa/stand-only'
logs = {key:(qa/file).read_text(encoding='utf-8-sig') for key,file in {
    'unit':'unit-test.log','browser':'browser-test.log',
    'online':'online-test.log','capture':'capture-test.log',
    'build':'build.log','production':'production-test.log'}.items()}
assert '230 passed' in logs['unit']
art_counts = list(map(int,re.findall(r'Ran (\d+) tests',logs['unit'])))
assert sum(art_counts) == 49
assert '33 passed' in logs['browser'] and '5 passed' in logs['online']
assert '1 passed' in logs['capture'] and 'built in' in logs['build']
production = json.loads((qa/'production-results.json').read_text())
assert len(production['tests']) == 26 and not production['errors']
assert 'fixed-tick Canvas captures passed' in logs['production']
lock = json.loads((ROOT/'art/dio/stand-only-preservation.json').read_text())
for file,digest in lock.items():
    assert hashlib.sha256((ROOT/'public/sprites'/file).read_bytes()).hexdigest() == digest,file
world = json.loads((ROOT/'public/sprites/the-world/stand-actions.json').read_text())['clips']
commands = json.loads((ROOT/'public/sprites/dio/commands.json').read_text())['clips']
bridges = json.loads((ROOT/'public/sprites/the-world/combo-transitions.json').read_text())
attacks = json.loads((qa/'browser-attacks.json').read_text())
combos = json.loads((qa/'browser-combos.json').read_text())
assert len(attacks)==36 and len(combos)==8
result = {
    'revision':3,'recordedAtUTC':datetime.now(timezone.utc).isoformat(),
    'normalAttacker':'the-world','owner':'dio','standOnlyNormals':True,
    'tests':{'typescript':230,'art':49,'browserScenarios':33,
        'onlineScenariosTwoBrowsers':5,'fixedTickCaptureRetest':1,
        'productionAttackAndComboCases':26,'build':'passed'},
    'preservation':{'samuraiPNGs':sum(k.startswith('samurai/') for k in lock),
        'allLockedFiles':len(lock),'allByteIdentical':True},
    'exports':{'worldActions':len(world),'worldActionDrawings':sum(c['count'] for c in world.values()),
        'worldComboBridges':len(bridges),'worldComboBridgeDrawings':sum(c['count'] for c in bridges.values()),
        'dioCommandClips':len(commands),'dioCommandDrawings':sum(c['count'] for c in commands.values())},
    'actualBrowserCases':{'isolatedAttacks':len(attacks),'combos':len(combos)},
    'preview':json.loads((ROOT/'public/previews/dio-stand-combo.json').read_text()),
    'production':production,
    'limitations':['Articulated pixel rig; extreme rotations still show stiffness.',
        'Limited facial acting; Dio reactions and results are provisional.',
        'Dio specials, knives, Ultimate, throw and online selection are not implemented.'],
    'logs':{k:str((qa/f).relative_to(ROOT)) for k,f in {'unit':'unit-test.log',
        'browser':'browser-test.log','online':'online-test.log','capture':'capture-test.log',
        'build':'build.log','production':'production-test.log'}.items()}}
(qa/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'tests':result['tests'],'preservation':result['preservation'],
                  'exports':result['exports']}))
