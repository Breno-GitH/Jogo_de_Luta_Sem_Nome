"""Contact sheet of actual Canvas captures, for visual review of a full step."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];qa=ROOT/'art/goku/qa'
trace=json.loads((qa/'trace.json').read_text())
for key in ['walkForward','walkBack']:
 chosen=[i for i,s in enumerate(trace) if s['animation']==key][:12]
 assert len(chosen)==12
 board=Image.new('RGB',(1120,1050),'#182631');d=ImageDraw.Draw(board)
 for n,index in enumerate(chosen):
  x=n%4*280;y=n//4*350
  im=Image.open(qa/f'recording/{index:03}.png').crop((500,280,780,610))
  board.paste(im,(x,y+20));s=trace[index]
  d.text((x+5,y+4),f'{key} / frame {int(s["frame"])+1} / tick {s["previewTick"]}',fill='#ffe0a5')
 board.save(qa/f'{key}-captured-cycle.png')
print('12 real capture samples per walking direction')
