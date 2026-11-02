"""Scoped walk export: preserves every other approved Goku/roster sprite."""
from pathlib import Path
import json,hashlib,zipfile,math
import numpy as np
from PIL import Image,ImageDraw
from goku_walk_painted import PaintedWalk,PERIOD,SPEED,ART

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/sprites/goku'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
def atlas(key,frames,times,loop,data,manifest,poses,support,label,method):
 columns=min(16,len(frames));rows=math.ceil(len(frames)/columns)
 sheet=Image.new('RGBA',(columns*256,rows*256))
 for i,im in enumerate(frames):
  sheet.paste(im,((i%columns)*256,(i//columns)*256));im.save(OUT/f'{key}-{i:02}.png')
 sheet.save(OUT/f'{key}.png')
 data['clips'][key]=dict(sheet=f'goku/{key}.png',columns=columns,frames=list(range(len(frames))),ticks=times[0],durations=times,loop=loop)
 manifest['clips'][key]=dict(label=label,sheet=key+'.png',columns=columns,count=len(frames),durations=times,loop=loop,grounded=True,support=support,bounds=[im.getbbox() for im in frames],poses=poses,method=method)
 frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in times],loop=0,disposal=0,blend=0)
 preview=Image.new('RGBA',sheet.size,'#253543');preview.alpha_composite(sheet);preview.save(OUT/f'{key}-preview.png')

def preserve_other():
 fixture=read(ROOT/'tests/fixtures/goku-non-walk-v2.json')
 for name,expected in fixture['files'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected,name
 from build_goku import preserve
 preserve()

def build_walk(reuse_idle_stops=False):
 from build_goku import MOTION,GokuRig,definitions
 preserve_other();data=read(ROOT/'src/data/goku-animations.json');manifest=read(OUT/'movement.json');gait=read(ROOT/'src/data/goku-gait.json');character=read(ROOT/'src/data/goku.json')
 for key in ['walkForward','walkBack']:
  rig=PaintedWalk(key);frames=[];poses=[];supports=[]
  for t in range(PERIOD):
   im,p=rig.render(t);assert im.getbbox()[3]<=224,(key,t,im.getbbox());frames.append(im);supports.append(p.pop('support'));poses.append(dict(ticks=1,phase='locomotion',**p))
  atlas(key,frames,[1]*PERIOD,True,data,manifest,poses,supports,'Walk Back · guarda de recuo' if key=='walkBack' else 'Walk Forward · transferência de peso','eight painted source poses; native locally rigid mesh inbetweens')
  feet=[[p['anchors']['legs'][side][2][0] for side in ['near','far']] for p in poses]
  gait[key].update(dict(speed=-SPEED[key] if key=='walkBack' else SPEED[key],ticks=PERIOD,restFeet=[104,155],feet=feet,pixelFeet=np.rint(feet).astype(int).tolist(),support=supports[0],supportByFrame=supports))
  character['reactions'][key]=dict(loop=True,poses=poses)
 # These two existing walking transitions use speed-dependent sole paths.
 defs=definitions();rig=GokuRig(Image.open(ROOT/'art/goku/base-native.png').convert('RGBA'))
 for suffix in ['Forward','Back']:
  key='crouchWalk'+suffix;c=defs[key];frames=[];poses=[]
  for p in c['poses']:
   im,g=rig.render(p,True);frames.append(im);poses.append(dict(ticks=1,phase='locomotion',**g))
  atlas(key,frames,c['durations'],False,data,manifest,poses,[p['support'] for p in c['poses']],c['label'],'existing crouch-to-walk poses; recalibrated sole paths')
  character['reactions'][key]=dict(loop=False,poses=poses)
  entry=gait['walk'+suffix]
  entry['crouchExitFeet']=[[p['anchors']['legs'][side][2][0] for side in ['near','far']] for p in poses]
  entry['crouchExitPixelFeet']=np.rint(entry['crouchExitFeet']).astype(int).tolist();entry['crouchExitSupport']=manifest['clips'][key]['support']
 # Optional Goku-only stop pose helper is supplied separately.
 try:
  from build_goku_walk_transitions import build_transitions
 except ImportError:pass
 else:build_transitions(data,manifest,reuse_idle_endpoint=reuse_idle_stops)
 character['speed']=MOTION['speed'];character['locomotion']['backSpeed']=MOTION['backSpeed']
 write(ROOT/'src/data/goku.json',character);write(ROOT/'src/data/goku-animations.json',data);write(OUT/'animations.json',data)
 write(ROOT/'src/data/goku-gait.json',gait);write(ROOT/'src/data/goku-movement.json',MOTION);write(OUT/'movement.json',manifest)
 info=read(OUT/'manifest.json');info.update(dict(walkRevision=3,walkSourcePoses=8,walkRenderedFrames=PERIOD,walkMethod='painted key silhouettes with native mesh inbetweens; projected anatomical joints, not capsule limbs',walkSpeeds={'forward':4.2,'back':3.8}));write(OUT/'manifest.json',info)
 # The separate source head is inspectable and testable; no other character's
 # face or sprite is used by these clips.
 PaintedWalk('walkForward').head.save(OUT/'walk-head.png')
 with zipfile.ZipFile(ROOT/'public/downloads/goku-movement.zip','w',zipfile.ZIP_DEFLATED) as z:
  for f in OUT.glob('*'):z.write(f,'goku/'+f.name)
  for f in ['goku.json','goku-animations.json','goku-movement.json','goku-gait.json']:z.write(ROOT/f'src/data/{f}','data/'+f)
 preserve_other();print(json.dumps({'walkRevision':3,'paintedKeysPerWalk':8,'renderedFramesPerWalk':PERIOD,'speed':character['speed'],'backSpeed':MOTION['backSpeed']}))
if __name__=='__main__':build_walk()
