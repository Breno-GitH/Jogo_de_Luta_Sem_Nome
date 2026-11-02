"""Freeze the delivered movement, normals and previous characters for Stage 3."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/specials/stage3';ART.mkdir(parents=True,exist_ok=True)
target=ART/'preservation.json'
if not target.exists():
 files=json.loads((ROOT/'art/goku/preservation.json').read_text(encoding='utf-8'))
 for p in (ROOT/'public/sprites/goku').rglob('*'):
  if p.is_file():files[p.relative_to(ROOT).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 for name in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json','goku-anatomy-guides.json','goku-normals.json','goku-combat.json','goku-combat-animations.json']:
  p=ROOT/'src/data'/name;files[p.relative_to(ROOT).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 target.write_text(json.dumps(files,indent=2)+'\n',encoding='utf-8')
print('Frozen',len(json.loads(target.read_text())),'approved asset/data files.')
