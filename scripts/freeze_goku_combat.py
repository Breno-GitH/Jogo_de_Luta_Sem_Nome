"""Snapshot approved locomotion and other characters before adding combat."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/combat';ART.mkdir(exist_ok=True)
target=ART/'preservation.json'
if not target.exists():
 files={}
 for p in (ROOT/'public/sprites/goku').glob('*'):
  if p.is_file():files[p.relative_to(ROOT).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 for name in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json','goku-anatomy-guides.json']:
  p=ROOT/'src/data'/name;files[p.relative_to(ROOT).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 for name,h in json.loads((ROOT/'art/goku/preservation.json').read_text()).items():files[name]=h
 target.write_text(json.dumps(files,indent=2)+'\n')
print('Approved assets frozen without changing them.')
