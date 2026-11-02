"""Native import of the newly painted walk keys. Not a game export."""
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from build_goku import PALETTE
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v3'
def import_keys(name):
 source=Image.open(ART/f'{name}-source.png').convert('RGBA');w=source.width/4;h=source.height/2
 # All keys share a single import scale, preserving volume across poses.
 factor=130/(419-10)
 palette=Image.new('P',(1,1));rgb=[v for c in PALETTE for v in bytes.fromhex(c[1:])];palette.putpalette(rgb+rgb[:3]*(256-len(PALETTE)))
 frames=[];info=[]
 for n in range(8):
  cell=source.crop((round(n%4*w),round(n//4*h),round((n%4+1)*w),round((n//4+1)*h)))
  # Normalise the generated retreat row's facing before anatomical retargeting.
  # Every final frame faces right and uses the same unmirrored canonical head.
  if name=='back' and n>=4:cell=cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  size=(round(cell.width*factor),round(cell.height*factor));small=cell.resize(size,Image.Resampling.NEAREST)
  alpha=small.getchannel('A').point(lambda a:255 if a>=180 else 0)
  native=small.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');native.putalpha(alpha)
  im=Image.new('RGBA',(256,256));im.paste(native,(128-size[0]//2,90))
  bounds=im.getbbox();offset=224-bounds[3]
  if offset:
   shifted=Image.new('RGBA',im.size);shifted.paste(im,(0,offset));im=shifted
  a=np.array(im);inside=np.array(im.getchannel('A').filter(ImageFilter.MinFilter(3)))>0
  border=(a[:,:,3]>0)&~inside
  a[border,:3]=list(bytes.fromhex('080a10'));a[a[:,:,3]==0]=0;im=Image.fromarray(a)
  im.save(ART/f'{name}-key-{n}.png');frames.append(im);info.append({'bbox':im.getbbox(),'verticalCorrection':offset})
 board=Image.new('RGB',(1024,1024),'#253543');d=ImageDraw.Draw(board)
 for n,im in enumerate(frames):
  x=n%4*256;y=n//4*512
  crop=im.crop((65,85,193,225)).resize((256,280),Image.Resampling.NEAREST)
  board.paste(crop,(x,y+25),crop);d.text((x+5,y+5),f'{name} key {n}',fill='#ffce85')
  # Magnified original cell landmarks with a sparse coordinate grid.
  for py in [120,140,160,180,200,220]:d.text((x+2,y+25+(py-85)*2),str(py),fill='#94aab0')
 board.crop((0,0,1024,820)).save(ART/f'{name}-keys-review.png')
 return info
if __name__=='__main__':
 result={name:import_keys(name) for name in ['forward','back']};(ART/'import.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
