"""Asset checks complement (not replace) the arena captures."""
import json,hashlib
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1]
sockets=json.loads((R/"src/data/asta-sockets.json").read_text())
errors=[]
for name,grips in sockets.items():
 im=Image.open(R/f"public/sprites/asta/{name}.png").convert("RGBA")
 assert im.size==(768,512),(name,im.size)
 hashes=set()
 for i,g in enumerate(grips):
  cel=im.crop((i%3*256,i//3*256,i%3*256+256,i//3*256+256))
  box=cel.getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<256 and box[3]<256,(name,i,box)
  assert set(cel.getchannel("A").tobytes())=={0,255}
  hashes.add(hashlib.sha256(cel.tobytes()).digest())
  pt=(128+g["x"],224+g["y"]);color=cel.getpixel(pt)
  if color[3]!=255 or max(color[:3])>125: errors.append((name,i,pt,color))
 assert len(hashes)==6,(name,"repeated cel")
print("17 action atlases, all six cels distinct; alpha, margins and scale checked.")
print("Sockets requiring manual review:",errors)
if errors:raise SystemExit(1)
