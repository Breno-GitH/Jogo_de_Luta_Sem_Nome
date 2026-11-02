from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v3'
for name in ['forward','back']:
 board=Image.new('RGB',(1920,1200),'#253543');d=ImageDraw.Draw(board)
 for n in range(8):
  im=Image.open(ART/f'{name}-key-{n}.png');crop=im.crop((70,90,190,225)).resize((480,540),Image.Resampling.NEAREST)
  x=n%4*480;y=n//4*600;board.paste(crop,(x,y+40),crop);d.text((x+5,y+5),f'{name} {n}',fill='#ffe0a0')
  for nx in range(80,190,10):
   px=x+(nx-70)*4;d.line((px,y+40,px,y+580),fill='#ffffff18');d.text((px,y+20),str(nx),fill='#7992a5')
  for ny in range(100,225,10):
   py=y+40+(ny-90)*4;d.line((x,py,x+480,py),fill='#ffffff18');d.text((x,py),str(ny),fill='#7992a5')
 board.save(ART/f'{name}-coordinates.png')
