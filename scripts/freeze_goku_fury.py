from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/fury';ART.mkdir(parents=True,exist_ok=True);p=ART/'preservation.json'
if not p.exists():
 files=json.loads((ROOT/'art/goku/preservation.json').read_text())
 for f in (ROOT/'public/sprites/goku').rglob('*'):
  if f.is_file():files[f.relative_to(ROOT).as_posix()]=hashlib.sha256(f.read_bytes()).hexdigest()
 for f in (ROOT/'src/data').glob('goku*.json'):files[f.relative_to(ROOT).as_posix()]=hashlib.sha256(f.read_bytes()).hexdigest()
 p.write_text(json.dumps(files,indent=2)+'\n',encoding='utf-8')
print('Frozen',len(json.loads(p.read_text())),'approved files.')
