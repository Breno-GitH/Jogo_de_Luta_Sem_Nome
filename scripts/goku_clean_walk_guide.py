"""Pose layout only, never a game sprite. No previous body pixels are reused."""
from pathlib import Path
import math,json,shutil
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/walk-v4';ART.mkdir(exist_ok=True)
OLD=ROOT/'public/sprites/goku-walk-v3';OLD.mkdir(exist_ok=True)
for p in (ROOT/'public/sprites/goku').glob('*'):
 if p.name.startswith(('walkForward','walkBack')) or p.name in ['movement.json','animations.json']:
  if p.is_file() and not (OLD/p.name).exists():shutil.copyfile(p,OLD/p.name)
shutil.copyfile(ROOT/'art/goku/walk-v3/reference.png',ART/'reference.png')
times=[0,4,9,13,18,22,27,31];all_poses={}
for name in ['forward','back']:
 sheet=Image.new('RGB',(2048,1024),'#efede4');poses=[]
 for n,t in enumerate(times):
  cell=Image.new('RGB',(512,512),'#efede4');d=ImageDraw.Draw(cell)
  def p(pt):return (round((pt[0]-44)*3),round((pt[1]-72)*3))
  def line(pts,color,width):d.line([p(q) for q in pts],fill=color,width=width)
  def dot(pt,color,r=3):x,y=p(pt);d.ellipse((x-r,y-r,x+r,y+r),fill=color)
  bob=[0,2,0,-1,0,2,0,-1][n];turn=math.cos(math.pi*n/4)
  if name=='forward':
   near=[[164,213],[147.2,213],[126.2,213],[109.4,213],[88.4,213],[94,210],[121,207],[151,209]][n]
   far=[[88.4,213],[94,210],[121,207],[151,209],[164,213],[147.2,213],[126.2,213],[109.4,213]][n]
  else:
   near=[[97,213],[112.2,213],[131.2,213],[146.4,213],[165.4,213],[159,205],[132,201],[104,205]][n]
   far=[[165.4,213],[159,205],[132,201],[104,205],[97,213],[112.2,213],[131.2,213],[146.4,213]][n]
  # Anatomy guide has whole continuous limbs and a live two-fist guard.
  hipN=[130+(6 if name=='forward' else -6)*turn,158+bob]
  hipF=[130-(6 if name=='forward' else -6)*turn,158+bob]
  legN=[hipN,[(hipN[0]+near[0])/2+4,184+bob*.4],near]
  legF=[hipF,[(hipF[0]+far[0])/2+4,184+bob*.4],far]
  neck=[134+(1 if n%4<2 else 0),128+bob*.4]
  armN=[[109+turn,135+bob],[104+turn,149+bob*.4],[123+turn*2,145+bob*.3]]
  armF=[[147-turn,137+bob],[155-turn,151+bob*.4],[164-turn*2,136+bob*.3]]
  line([[68,224],[199,224]],'#839792',2)
  line(legF,'#6650b6',18);line(legN,'#bf3b4a',18)
  line([[130,158+bob],neck],'#273d59',32)
  line(armF,'#6650b6',15);line(armN,'#bf3b4a',15)
  hx,hy=p([134,115+bob*.4]);d.ellipse((hx-23,hy-28,hx+24,hy+27),outline='#273d59',width=6)
  for limb,col in [(legN,'#bf3b4a'),(legF,'#6650b6'),(armN,'#bf3b4a'),(armF,'#6650b6')]:
   for q in limb:dot(q,'#edac42',5)
  for side,ankle in [('far',far),('near',near)]:
   support=(side=='near') if n<4 else (side=='far')
   color=('#268256' if support else '#d37626') if name=='back' else '#273d59'
   line([[ankle[0]-6,ankle[1]+9],[ankle[0]+14,ankle[1]+9]],color,14)
  sheet.paste(cell,(n%4*512,n//4*512))
  poses.append({'phase':n,'tick':t,'near':legN,'far':legF,'neck':neck,'arms':{'near':armN,'far':armF}})
 sheet.save(ART/f'{name}-pose-guide.png');all_poses[name]=poses
(ART/'pose-guide.json').write_text(json.dumps(all_poses,indent=2)+'\n')
print('Prepared new whole-pose guides; archived rejected v3 walking PNGs.')
