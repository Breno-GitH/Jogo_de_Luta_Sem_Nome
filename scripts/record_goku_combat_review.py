"""Record reviewed Stage 2 engine extensions without replacing MOV5 baselines.
Run deliberately after shared-code review, never automatically during tests.
"""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/combat'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
reasons={
 'src/engine/characters.ts':'Registers additive Goku combat data; Samurai and Dio composition retained.',
 'src/engine/bot.ts':'Goku-only choices use its available normals, launcher and universal grab; previous character branches retained.',
 'src/engine/combat.ts':'Optional data-driven capture trajectory/release and Goku landing knockdown. Default capture path retained for Samurai/Dio; serializer unchanged.',
 'src/engine/types.ts':'Optional shared grabSequence schema. Existing unconnected Goku specials draft fields were present before this stage and are not used.',
 'src/engine/input.ts':'Pre-existing unconnected gokuSpecial recognizer draft retained unchanged during this stage. No active Goku specialMoves, superMoves or dispatch added.'
}
frozen=read(ROOT/'art/goku/rebuild/physics-freeze.json')['files'];entries={}
for name,before in frozen.items():
 after=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
 if after!=before:
  assert name in reasons,('unreviewed engine modification',name)
  entries[name]={'baseline':before,'current':after,'reason':reasons[name]}
write(ART/'shared-engine-revisions.json',{'stage':'Goku normal combat','originalFreeze':'art/goku/rebuild/physics-freeze.json','files':entries})
print('Recorded exact reviewed revisions:',list(entries))
