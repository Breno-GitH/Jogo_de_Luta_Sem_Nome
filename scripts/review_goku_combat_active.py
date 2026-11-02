from goku_combat_art import ART,read
from PIL import Image,ImageDraw
keys=['stand_light','stand_medium','stand_heavy','crouch_light','crouch_medium','crouch_heavy','air_light','air_medium','air_heavy']
for key in keys:
 r=read(ART/f'{key}-production.json');active=[(n,f)for n,f in enumerate(r['frames'])if f['pose']['phase']=='active'];board=Image.new('RGB',(768*len(active),560),'#253543');d=ImageDraw.Draw(board)
 for j,(n,f)in enumerate(active):
  im=Image.open(ART/f'prepared/{key}-{n:02}.png');big=im.resize((768,512),Image.Resampling.NEAREST);x=j*768;board.paste(big,(x,24),big)
  for gy in range(64,225,16):d.line((x+240,24+gy*2,x+660,24+gy*2),fill='#465869');d.text((x+220,24+gy*2),str(gy),fill='#abcbd0')
  for gx in range(128,321,16):d.line((x+gx*2,152,x+gx*2,472),fill='#465869');d.text((x+gx*2,480),str(gx),fill='#abcbd0')
  if f['strikePoint']:
   px,py=f['strikePoint'];d.ellipse((x+px*2-7,24+py*2-7,x+px*2+7,24+py*2+7),outline='#ff675c',width=2)
  d.text((x+8,4),f'{key}/{n}',fill='#ffe4bc')
 board.save(ART/f'{key}-active-review.png')
