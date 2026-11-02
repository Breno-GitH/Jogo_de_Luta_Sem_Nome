from goku_fury_art import *
board=Image.new('RGB',(1200,2000),'#213343');d=ImageDraw.Draw(board);errors=[]
names=sorted({ref.split(':')[0]for c in read(ART/'sources.json')['clips'].values()for ref in c['cells']if ref!='base:idle'})
paths=[ART/'raw'/f'{name}.png'for name in names]
for row,p in enumerate(paths):
 cal,_,_=extract(p,3,3,0);scale=130/cal.height
 for i in range(1,9):
  crop,_,_=extract(p,3,3,i);im,off=import_pose(crop,scale)
  try:m=validate(im,f'{p.stem}:{i}')
  except AssertionError as e:errors.append(str(e));m={'height':im.getbbox()[3]-im.getbbox()[1]};im.save(ART/f'rejected-{p.stem}-{i}.png')
  small=im.crop((95,64,289,232)).resize((145,126),Image.Resampling.NEAREST)
  x=(i-1)*150;y=row*130;board.paste(small,(x,y),small);d.text((x,y),f'{p.stem}:{i} {m["height"]}',fill='white')
board.crop((0,0,1200,130*len(paths))).save(ART/'interim.png')
print('\n'.join(errors)or'All native poses complete and connected')
