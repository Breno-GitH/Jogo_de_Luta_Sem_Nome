"""Bind collision/staging to real native fist/boot/palm material."""
from goku_fury_art import *
from goku_combat_art import strike,hurtboxes
specs={'furyFirstPunch':(2,'punch'),'furySecondStrike':(2,'punch'),'furyUppercut':(2,'uppercut'),'furyAirPunch':(2,'punch'),'furyAirKick':(2,'kick'),'furyTeleportPunch':(2,'punch'),'furyTeleportKick':(2,'kick'),'furyAerialUppercut':(2,'uppercut'),'furySmash':(2,'punch'),'furyDownwardBeam':(2,'punch')}
points={};shapes={}
for key,(i,kind)in specs.items():
 im=Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA');shape,p=strike(im,kind);points[key]={'x':p[0]-192,'y':p[1]-224};shapes[key]=shape
write(ROOT/'src/data/goku-fury-contacts.json',points)
release={};manifest=read(OUT/'manifest.json')['clips']
for key in ['furyKamehamehaPreparation','furyFuriousExpression','furyDownwardBeam','furyKamehamehaMaintain','furyKamehamehaRecovery']:
 records=[]
 for i,d in enumerate(manifest[key]['durations']):
  a=np.array(Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA'));yy,xx=np.mgrid[:256,:384];skin=np.zeros((256,384),bool)
  for color in ['#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8']:skin|=np.all(a[:,:,:3]==list(bytes.fromhex(color[1:])),axis=2)
  skin&=(a[:,:,3]>0)&(yy>130)&(yy<198)&(xx>148)
  if key=='furyKamehamehaPreparation'or(key=='furyFuriousExpression'and i<2):
   # Visually reviewed palm centres. An exposed elbow can be farther right
   # than the hands, so a rightmost-skin heuristic is incorrect in this pose.
   hints=[(-20,-63),(-20,-62),(-22,-61),(-25,-63)]if key=='furyKamehamehaPreparation'else[(-18,-76),(-20,-72)]
   hx,hy=hints[i];dist=(xx-(192+hx))**2+(yy-(224+hy))**2
   selected=skin&(dist<=dist[skin].min()+8)
  else:edge=xx[skin].max();selected=skin&(xx>=edge-5)
  records.append({'ticks':d,'x':round(float(xx[selected].mean()))-192,'y':round(float(yy[selected].mean()))-224})
 release[key]=records
write(ROOT/'src/data/goku-fury-release.json',release)
m=read(OUT/'manifest.json')['clips']['ssj1_fury'];poses=[];elapsed=0
for i,d in enumerate(m['durations']):
 im=Image.open(OUT/f'ssj1_fury-{i:02}.png').convert('RGBA');active=106<=elapsed<111
 poses.append({'ticks':d,'phase':'startup'if elapsed<106 else'active'if active else'recovery','hurtboxes':hurtboxes(im),'hitboxes':[shapes['furyFirstPunch']]if active else[]})
 elapsed+=d
assert elapsed==169
write(ROOT/'src/data/goku-fury-poses.json',{'poses':poses});print(points)
