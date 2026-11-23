"""Import original pixel-art cels; one fixed scale per character, no per-frame resizing."""
from pathlib import Path
import json, hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/entrances/source"
TARGET_HEIGHT = {"samurai":130,"goku":130,"luffy":130,"sasuke":130,"kaneki":129,"ben":130,"xebec":156,"asta":148}
HOLDS = {
 "samurai":[14,14,16,14,18,14,16,20], "goku":[12,12,16,16,14,12,14,18],
 "luffy":[12,12,16,16,14,12,14,18], "sasuke":[14,14,16,14,14,12,14,16],
 "kaneki":[18,16,16,18,16,12,14,16], "ben":[12,12,16,18,16,12,14,16],
 "xebec":[16,16,18,16,18,16,18,20], "asta":[12,16,18,18,18,16,16,18],
}
# Reviewed native-pixel palm centers after packing, not the extended fingertips.
# The existing arsenal supplies the full Slayer, including the approved blade.
ASTA_GRIPS = [(109,163,-100),(138,127,-75),(153,120,-70),(151,120,-70),
              (113,136,-25),(101,91,-140),(122,143,-55),(116,153,-55)]

def native_palette(atlas, char):
 """One shared palette across all eight cels, without diffusion or smooth alpha."""
 pixels=[p[:3] for p in atlas.get_flattened_data() if p[3]]
 if char in ('samurai','goku'):
  with Image.open(ROOT/'art/entrances/reference'/(char+'.png')) as ref:
   colors=sorted({p[:3] for p in ref.convert('RGBA').get_flattened_data() if p[3]})
  palette=Image.new('P',(1,1));flat=[v for color in colors for v in color]
  palette.putpalette(flat+list(colors[0])*(256-len(colors)))
 else:
  samples=Image.new('RGB',(len(pixels),1));samples.putdata(pixels)
  palette=samples.quantize(colors=64,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
 alpha=atlas.getchannel('A')
 out=atlas.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
 out.putalpha(alpha)
 # Transparent texels carry no hidden color, which keeps packing reproducible.
 out=Image.composite(out,Image.new('RGBA',atlas.size),alpha)
 return out, len({p[:3] for p in out.get_flattened_data() if p[3]})

def pack():
 manifest={"frameWidth":256,"frameHeight":256,"columns":4,"pivot":{"x":128,"y":224},"scale":1,"characters":{}}
 report={}
 for char, height in TARGET_HEIGHT.items():
  im=Image.open(SOURCE/(char+".png")).convert("RGBA")
  assert im.size==(1536,1024), (char,im.size)
  cells=[im.crop((i%4*384,i//4*512,i%4*384+384,i//4*512+512)) for i in range(8)]
  for cell in cells: cell.putalpha(cell.getchannel("A").point(lambda a:255 if a>=128 else 0))
  boxes=[cell.getbbox() for cell in cells]; assert all(boxes),char
  scale=height/(boxes[-1][3]-boxes[-1][1])
  atlas=Image.new("RGBA",(1024,512))
  shifts=[]; output_boxes=[]; hashes=[]
  for i,(cell,box) in enumerate(zip(cells,boxes)):
   resized=cell.resize((round(384*scale),round(512*scale)),Image.Resampling.NEAREST)
   dx=128-round(192*scale);dy=224-round(box[3]*scale)
   tile=Image.new("RGBA",(256,256));tile.alpha_composite(resized,(dx,dy))
   bbox=tile.getbbox();assert bbox and bbox[0]>1 and bbox[1]>1 and bbox[2]<255 and bbox[3]<=225,(char,i,bbox)
   hashes.append(hashlib.sha256(tile.tobytes()).hexdigest());output_boxes.append(bbox)
   atlas.alpha_composite(tile,(i%4*256,i//4*256));shifts.append([dx,dy])
  assert len(set(hashes))==8, char
  atlas, palette_size=native_palette(atlas,char)
  path=ROOT/"public/sprites"/char/"intro.png";atlas.save(path)
  manifest["characters"][char]={"sheet":char+"/intro.png","frames":list(range(8)),"durations":HOLDS[char],"ticks":1,"loop":False}
  if char=="asta":
   manifest["astaGrips"]=[{"x":x-128,"y":y-224,"angle":angle} for x,y,angle in ASTA_GRIPS]
  report[char]={"fixedScale":scale,"targetReferenceHeight":height,"sourceBoxes":boxes,"runtimeBoxes":output_boxes,"shifts":shifts,"uniqueCels":len(set(hashes)),"paletteColors":palette_size,"palette":"existing native reference" if char in ('samurai','goku') else "64 shared colors; no dithering"}
 (ROOT/"src/data/entrance-art.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
 (ROOT/"art/entrances/packing.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
 print("Packed 64 distinct body cels; fixed per-character scale, binary alpha, grounded pivots.")

if __name__=="__main__": pack()
