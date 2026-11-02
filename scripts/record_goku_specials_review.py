"""Explicit review ledger; never called automatically by tests or builds."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/specials/stage3'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
old=read(ROOT/'art/goku/combat/shared-engine-revisions.json')['files'];base=read(ROOT/'art/goku/rebuild/physics-freeze.json')['files'];result={}
reasons={'src/engine/combat.ts':'Goku-only special dispatch, can-cancel gates, separate Ki/beam simulation and teleport validation. Existing Samurai/Dio paths retained; common new energy arrays reset at round end.', 'src/engine/input.ts':'Existing Goku command recognizer formatted and integrated. Relative cardinal/diagonal motion and strict 2-neutral-2 double down; Dio/Samurai recognizers unchanged.', 'src/engine/state.ts':'Explicit deterministic snapshot fields for Ki projectiles, beams and Goku teleport lock/cast serial. No externally supplied character data is restored.', 'src/engine/bot.ts':'Goku-only probabilistic delayed-perception Ki, Kamehameha and teleport choices. Earlier character branches retained.'}
for name,digest in base.items():
 current=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
 if current==digest:continue
 if name in reasons:reason=reasons[name]
 else:
  assert name in old and old[name]['current']==current,('unreviewed change',name);reason=old[name]['reason']
 result[name]={'baseline':digest,'current':current,'reason':reason}
(ART/'shared-engine-revisions.json').write_text(json.dumps({'stage':'Goku common specials, no Super','files':result},indent=2)+'\n',encoding='utf-8');print('Reviewed exact hashes:',list(result))
