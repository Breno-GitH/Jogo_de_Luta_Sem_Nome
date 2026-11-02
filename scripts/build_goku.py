"""Goku locomotion: painted source, native palette, articulated segments and IK.

The existing character files are locked before export. Walking exports one
drawing per fixed tick to match a planted sole to the engine's root velocity.
"""
from pathlib import Path
import json,hashlib,zipfile
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku';OUT=ROOT/'public/sprites/goku';PIVOT={'x':128,'y':224}
PALETTE=['#080a10','#141621','#202331','#303547','#444c62',
 '#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8',
 '#542119','#883116','#ac3c0b','#d95208','#f67a14','#ff9b2b','#ffbc57',
 '#071326','#0c2146','#173a6b','#24599a','#3272b5','#5a91c8',
 '#5b2020','#a43929','#e35e35','#49341f','#ac7940','#f1d38a','#fff0d4','#f1f5f5']
MOTION=dict(speed=4.2,backSpeed=3.8,airSpeed=6.5,jump=-17.7,gravity=.72,jumpStartup=6,landingTicks=8,
 dashForward=[4,9,14,19,22,22,22,21,19,16,12,8,4,0],backdash=[3,6,11,15,18,18,18,17,15,12,9,6,3,0])

def preserve():
 file=ART/'preservation.json'
 if not file.exists():
  data={}
  for who in ['samurai','dio','the-world']:
   for f in (ROOT/f'public/sprites/{who}').glob('*.png'):data[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
   for folder,name in [('src/data',who+'.json'),('src/data',who+'-animations.json')]:
    f=ROOT/folder/name
    if f.exists():data[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
  file.write_text(json.dumps(data,indent=2)+'\n')
 for name,h in json.loads(file.read_text()).items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==h,name

def native():
 # The user's approved four-pose image is now the actual production source.
 # Only the complete upper-left guard is imported, never the whole montage.
 source=Image.open(ART/'revision/approved-source.png').convert('RGBA').crop((0,0,640,680));source.putalpha(source.getchannel('A').point(lambda a:255 if a>=180 else 0))
 crop=source.crop(source.getbbox());small=crop.resize((round(crop.width*130/crop.height),130),Image.Resampling.NEAREST)
 pal=Image.new('P',(1,1));values=[v for c in PALETTE for v in bytes.fromhex(c[1:])];pal.putpalette(values+values[:3]*(256-len(PALETTE)))
 small_rgb=small.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');small_rgb.putalpha(small.getchannel('A'))
 a=np.array(small_rgb);a[a[:,:,3]==0]=0;small_rgb=Image.fromarray(a)
 im=Image.new('RGBA',(256,256));im.paste(small_rgb,(128-small.width//2,94));im.save(ART/'base-native.png');im.save(OUT/'base.png')
 (OUT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n');return im

# Revision 2 deliberately replaces the source-cut limb renderer and old poses.
# The archived revision remains available to the comparison viewer.
from goku_anatomy import AnatomyRig
from goku_poses import definitions as anatomy_definitions
from goku_source import SourceRig
class GokuRig(AnatomyRig):
 def __init__(self,base):super().__init__(SourceRig(base))
def definitions():return anatomy_definitions(MOTION)

def build():
 ART.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True);preserve();base=native();rig=GokuRig(base);defs=definitions()
 layers=ART/'layers';layers.mkdir(exist_ok=True)
 for name,layer in rig.layers.items():layer.save(layers/f'{name}.png')
 data=dict(sheet='goku/idle.png',frameWidth=256,frameHeight=256,pivot=PIVOT,scale=1,clips={});manifest=dict(id='goku',cell=[256,256],pivot=PIVOT,clips={});gait={}
 for key,c in defs.items():
  frames=[];poses=[]
  for i,p in enumerate(c['poses']):
   im,g=rig.render(p,c['grounded']);frames.append(im);poses.append(dict(ticks=c['durations'][i],phase='locomotion',**g));im.save(OUT/f'{key}-{i:02}.png')
  sheet=Image.new('RGBA',(256*len(frames),256))
  for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
  sheet.save(OUT/f'{key}.png');data['clips'][key]=dict(sheet=f'goku/{key}.png',columns=len(frames),frames=list(range(len(frames))),ticks=c['durations'][0],durations=c['durations'],loop=c['loop'])
  manifest['clips'][key]=dict(label=c['label'],sheet=key+'.png',count=len(frames),durations=c['durations'],loop=c['loop'],grounded=c['grounded'],support=[p.get('support',[]) for p in c['poses']],bounds=[f.getbbox() for f in frames],poses=poses)
  frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in c['durations']],loop=0,disposal=0,blend=0)
  preview=Image.new('RGBA',sheet.size,'#263745');preview.alpha_composite(sheet);preview.resize((sheet.width*2,512),Image.Resampling.NEAREST).save(OUT/f'{key}-preview.png')
  if key in ['walkForward','walkBack']:
   feet=[[g['anchors']['legs'][side][2][0] for side in ['near','far']] for g in poses]
   gait[key]=dict(speed=c['rootSpeed'],ticks=sum(c['durations']),restFeet=[104,155],feet=feet,pixelFeet=np.rint(feet).astype(int).tolist(),support=c['poses'][0].get('support',[]),supportByFrame=manifest['clips'][key]['support'])
 for direction in ['Forward','Back']:
  transition=manifest['clips']['crouchWalk'+direction]
  gait['walk'+direction]['crouchExitFeet']=[[p['anchors']['legs'][side][2][0] for side in ['near','far']] for p in transition['poses']]
  gait['walk'+direction]['crouchExitPixelFeet']=np.rint(gait['walk'+direction]['crouchExitFeet']).astype(int).tolist()
  gait['walk'+direction]['crouchExitSupport']=transition['support']
 (ROOT/'src/data/goku-animations.json').write_text(json.dumps(data,indent=2)+'\n');(OUT/'animations.json').write_text(json.dumps(data,indent=2)+'\n');(OUT/'movement.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (ROOT/'src/data/goku-gait.json').write_text(json.dumps(gait,indent=2)+'\n');(ART/'movement-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
 (ROOT/'src/data/goku-movement.json').write_text(json.dumps(MOTION,indent=2)+'\n')
 aliases={k:'trainingHit' for k in ['damageLight','damageMedium','damageHeavy','grabbed']};aliases.update(dict(damageCrouch='crouchIdle',damageAir='trainingAirHit',launched='trainingAirHit',falling='trainingAirHit',downed='trainingDown',getup='trainingGetup',ko='trainingDown',defeat='trainingDown',entrance='idle',victory='idle',guardStand='idle',guardCrouch='crouchIdle',guardImpactStand='trainingHit',guardImpactCrouch='crouchIdle'))
 character=dict(id='goku',name='Goku · Base',health=1000,speed=MOTION['speed'],jump=MOTION['jump'],gravity=MOTION['gravity'],locomotion={k:v for k,v in MOTION.items() if k not in ['speed','jump','gravity']},moves={},reactionClips=aliases,hurtboxes=dict(standing=manifest['clips']['idle']['poses'][0]['hurtboxes'],crouching=manifest['clips']['crouchIdle']['poses'][0]['hurtboxes'],air=manifest['clips']['jumpApex']['poses'][0]['hurtboxes']),reactions={key:dict(loop=c['loop'],poses=c['poses']) for key,c in manifest['clips'].items()})
 (ROOT/'src/data/goku.json').write_text(json.dumps(character,indent=2)+'\n')
 info=dict(id='goku',name='Goku',revision=2,stage='locomotion',combatReady=False,trainingOnly=True,visibleHeight=130,sourceSha256=hashlib.sha256((ART/'revision/approved-source.png').read_bytes()).hexdigest(),palette=PALETTE,method='approved head/upper gi; native-pixel redrawn limbs and boots with constant bone lengths and distance-matched soles; no attacks implemented')
 (OUT/'manifest.json').write_text(json.dumps(info,indent=2)+'\n')
 required=['idle','walkForward','walkBack','dashForward','backdash','crouchStart','crouchIdle','crouchEnd','jumpStart','jumpRise','jumpApex','jumpFall','landing']
 board=Image.new('RGB',(1024,len(required)*220),'#182631');d=ImageDraw.Draw(board)
 for row,key in enumerate(required):
  c=manifest['clips'][key];d.text((8,row*220+2),f'{key} / {c["count"]} frames',fill='#f3d58c')
  for j,index in enumerate(np.linspace(0,c['count']-1,4).astype(int)):
   frame=Image.open(OUT/f'{key}-{index:02}.png');board.paste(frame,(j*256,row*220-45),frame)
 board.save(ART/'all-movement.png')
 (OUT/'base.png').write_bytes((OUT/'idle-00.png').read_bytes())
 (ART/'base-preview.png').write_bytes((OUT/'idle-preview.png').read_bytes())
 with zipfile.ZipFile(ROOT/'public/downloads/goku-movement.zip','w',zipfile.ZIP_DEFLATED) as z:
  for f in OUT.glob('*'):z.write(f,'goku/'+f.name)
  for f in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json']:z.write(ROOT/f'src/data/{f}','data/'+f)
 preserve();print(json.dumps(dict(clips=len(defs),frames=sum(len(c['poses']) for c in defs.values()),movementClips=len(required),speed=MOTION['speed'])))
if __name__=='__main__':
 from goku_rebuild import build_all
 build_all()
