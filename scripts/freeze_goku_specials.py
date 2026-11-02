"""One-time baseline: preserve existing figures and animation clips exactly."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'art/goku/specials';OUT.mkdir(exist_ok=True)
path=OUT/'preservation.json'
if not path.exists():
 files={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest()for p in (ROOT/'public/sprites/goku').glob('*')if p.is_file()}
 for p in [ROOT/'src/data/goku-animations.json',ROOT/'src/data/goku-movement.json',ROOT/'src/data/goku-gait.json',ROOT/'src/data/goku-anatomy-guides.json']:files[p.relative_to(ROOT).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 path.write_text(json.dumps(files,indent=2)+'\n')
 before=OUT/'engine-before';before.mkdir(exist_ok=True)
 for p in (ROOT/'src/engine').glob('*.ts'):shutil.copyfile(p,before/p.name)
print('Existing Goku movement baseline archived; other-character baseline remains art/goku/preservation.json.')
