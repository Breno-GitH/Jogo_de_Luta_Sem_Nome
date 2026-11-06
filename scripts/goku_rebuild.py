"""Whole-pose Goku pipeline. No limb cuts, mesh, morphing or anatomy rendering.

Each sheet supplies a standing calibration pose. Its ONE uniform scale is
used for every drawing on that sheet, including crouched and airborne poses.
Only complete-cell extraction, palette/alpha conversion and integer placement
are allowed. Prepared cells are validated before any public atlas is written.
"""
from pathlib import Path
import argparse,hashlib,json,math,shutil
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/rebuild';OUT=ROOT/'public/sprites/goku'
PALETTE=json.loads((OUT/'palette.json').read_text(encoding='utf-8'))
PIVOT={'x':128,'y':224};THRESHOLD=180
PAL=Image.new('P',(1,1));RGB=[v for c in PALETTE for v in bytes.fromhex(c[1:])];PAL.putpalette(RGB+RGB[:3]*(256-len(PALETTE)))

def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def protect():
 for name,digest in read(ROOT/'art/goku/preservation.json').items():assert sha(ROOT/name)==digest,name
 frozen=read(ART/'physics-freeze.json');g=read(ROOT/'src/data/goku.json')
 assert read(ROOT/'src/data/goku-movement.json')==frozen['motion'],'movement physics changed'
 assert {k:g[k] for k in frozen['goku']}==frozen['goku'],'character physics changed'
 # Stage 2 adds data-driven attacks and a throw to this same engine. Keep
 # the original freeze intact; audited revisions accept only exact hashes,
 # never a broad exemption for simulation or other-character changes.
 ledger=ROOT/'art/goku/combat/shared-engine-revisions.json'
 revisions=read(ledger)['files']if ledger.exists()else{}
 stage3=ROOT/'art/goku/specials/stage3/shared-engine-revisions.json'
 if stage3.exists():revisions.update(read(stage3)['files'])
 stage4=ROOT/'art/goku/fury/shared-engine-revisions.json'
 if stage4.exists():revisions.update(read(stage4)['files'])
 # A later explicit request rebalances ALL characters and adds universal R /
 # aerial teleport. Keep the original freeze and a specific file allowlist;
 # require a separately recorded, reasoned hash for each authorised revision.
 frenzy=ROOT/'deployment/audit/frenzy-shared-engine-revisions.json'
 if frenzy.exists():revisions.update(read(frenzy)['files'])
 luffy=ROOT/'deployment/audit/luffy-normals-shared-engine-revisions.json'
 if luffy.exists():revisions.update(read(luffy)['files'])
 menu=ROOT/'deployment/audit/menu-shared-engine-revisions.json'
 if menu.exists():revisions.update(read(menu)['files'])
 luffy_secondary=ROOT/'deployment/audit/luffy-secondary-shared-engine-revisions.json'
 if luffy_secondary.exists():revisions.update(read(luffy_secondary)['files'])
 luffy_jet=ROOT/'deployment/audit/luffy-jet-shared-engine-revisions.json'
 if luffy_jet.exists():revisions.update(read(luffy_jet)['files'])
 sasuke=ROOT/'deployment/audit/sasuke-shared-engine-revisions.json'
 if sasuke.exists():revisions.update(read(sasuke)['files'])
 allowed={'src/engine/bot.ts','src/engine/characters.ts','src/engine/combat.ts','src/engine/types.ts','src/engine/input.ts','src/engine/state.ts'}
 allowed.update({'src/engine/moves.ts','src/engine/stand-combat.ts','src/engine/lifecycle.ts','src/render/dio-motion.ts'})
 assert set(revisions)<=allowed,'unreviewed shared-engine exemption'
 for name,digest in frozen['files'].items():
  current=sha(ROOT/name)
  if current==digest:continue
  entry=revisions.get(name,{})
  assert entry.get('baseline')==digest and entry.get('current')==current and entry.get('reason'),name

def component_counts(alpha):
 remaining=set(map(tuple,np.argwhere(alpha)));groups=[]
 while remaining:
  start=remaining.pop();stack=[start];count=0
  while stack:
   y,x=stack.pop();count+=1
   for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    q=y+dy,x+dx
    if q in remaining:remaining.remove(q);stack.append(q)
  groups.append(count)
 return sorted(groups,reverse=True)

def validate(image,label,grounded=True,min_height=70,max_height=145):
 assert image.mode=='RGBA' and image.size==(256,256),(label,'canvas')
 a=np.array(image);visible=a[:,:,3]>0;bounds=image.getbbox();assert bounds,(label,'empty')
 assert set(np.unique(a[:,:,3]))<={0,255},(label,'soft alpha')
 assert np.all(a[~visible]==0),(label,'hidden RGB')
 colors=set(map(tuple,a[visible,:3]));allowed={tuple(bytes.fromhex(c[1:])) for c in PALETTE}
 assert colors<=allowed,(label,'palette')
 x0,y0,x1,y1=bounds
 assert x0>=8 and y0>=8 and x1<=248 and y1<=224,(label,'clipping or below physical foot origin',bounds)
 assert min_height<=y1-y0<=max_height,(label,'apparent height',bounds)
 if grounded:assert y1==224 and np.count_nonzero(a[223,:,3])>=2,(label,'not grounded',bounds)
 groups=component_counts(visible);assert groups[0]/sum(groups)>=.995 and (len(groups)==1 or groups[1]<=8),(label,'detached part',groups[:5])
 assert len(colors)>=15,(label,'insufficient material shading')
 return {'label':label,'bbox':bounds,'opaquePixels':int(visible.sum()),'mainComponentFraction':groups[0]/sum(groups),'components':groups,'colors':len(colors)}

def extract_sheet(path,columns,rows,index):
 from goku_whole_source import extract
 return extract(path,columns,rows,index)

def import_whole(crop,scale,grounded,registration=None):
 crop=crop.copy();crop.putalpha(crop.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0))
 small=crop.resize(tuple(round(v*scale) for v in crop.size),Image.Resampling.NEAREST)
 image=small.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');image.putalpha(small.getchannel('A'))
 a=np.array(image);a[a[:,:,3]==0]=0;image=Image.fromarray(a);b=image.getbbox()
 if registration and 'sourceAnchor' in registration:
  source=registration['sourceAnchor'];target=registration.get('targetAnchor',[128,159]);offset=[round(target[0]-source[0]*scale),round(target[1]-source[1]*scale)]
 else:
  # Ground poses register the midpoint of the lowest complete shoe pixels.
  # This is whole-frame registration, never an edit to the boots or legs.
  if registration and registration.get('mode')=='centerFeet':
   offset=[128-round((b[0]+b[2])/2),224-b[3]]
  elif grounded or (registration and registration.get('mode')=='feet'):
   ys,xs=np.where(a[max(0,b[3]-3):b[3],:,3]>0);anchor=(int(xs.min())+int(xs.max()))/2
   offset=[128-round(anchor),224-b[3]]
  else:offset=[128-round((b[0]+b[2])/2),min(94-b[1],224-b[3])]
 out=Image.new('RGBA',(256,256));out.paste(image,tuple(offset))
 placed=[b[0]+offset[0],b[1]+offset[1],b[2]+offset[0],b[3]+offset[1]]
 assert out.getbbox()==tuple(placed),('whole-frame placement cropped a body part',placed)
 return out,offset

def pixel_boxes(image):
 a=np.array(image)[:,:,3]>0;boxes=[]
 for lo,hi in [(8,126),(126,155),(155,180),(180,203),(203,224)]:
  yy,xx=np.where(a[lo:hi])
  if len(xx):boxes.append({'x':int(xx.min())-128,'y':int(yy.min())+lo-224,'w':int(xx.max()-xx.min()+1),'h':int(yy.max()-yy.min()+1)})
 return boxes

def prepare(stage):
 protect();config=read(ART/'sources.json');clips=config['stages'][stage];prepared={};records={};metrics=[]
 for key,clip in clips.items():
  if clip.get('kind')=='wholeFrames':
   from goku_clean_walk_validation import preflight
   proof=ROOT/clip['production'];result=preflight(proof);assert result['ok'],result['errors']
   origin=read(proof)['clips'][key];images=[];poses=[]
   for n,record in enumerate(origin['frames']):
    image=Image.open(proof.parent/f'{key}-{n:02}.png').convert('RGBA');metrics.append(validate(image,f'{key}/{n}',True,120,140));images.append(image)
    poses.append({**record,'scale':origin['scale'],'hurtboxes':pixel_boxes(image),'hitboxes':[]})
    image.save(ART/f'prepared/{key}-{n:02}.png')
   prepared[key]=images;records[key]={**clip,'frames':poses,'method':'whole-pose','uniqueDrawings':len(images),'ticks':sum(clip['durations'])}
   continue
  source=clip['source'];path=ROOT/source['path'];calibration,_,_=extract_sheet(path,source['columns'],source['rows'],source.get('calibration',0));scale=130/calibration.height
  images=[];poses=[]
  for n,index in enumerate(clip['cells']):
   crop,rect,cellRect=extract_sheet(path,source['columns'],source['rows'],index)
   image,offset=import_whole(crop,scale,clip['grounded'],clip.get('registration',{}).get(str(n)))
   metric=validate(image,f'{key}/{n}',clip['grounded'],clip.get('minHeight',70),clip.get('maxHeight',145));metrics.append(metric)
   image.save(ART/f'prepared/{key}-{n:02}.png') if (ART/'prepared').exists() else None
   images.append(image);poses.append({'source':source['path'],'sourceRect':rect,'cellRect':cellRect,'calibrationCell':source.get('calibration',0),'scale':scale,'offset':offset,'bbox':image.getbbox(),'hurtboxes':pixel_boxes(image),'hitboxes':[]})
  if clip.get('appendReference'):
   ref=clip['appendReference'];origin=(records[ref['clip']] if ref['stage']=='current' else read(ART/f'{ref["stage"]}-production.json')['clips'][ref['clip']])['frames'][ref['index']]
   image=prepared[ref['clip']][ref['index']].copy() if ref['stage']=='current' else Image.open(ART/f'prepared/{ref["clip"]}-{ref["index"]:02}.png').convert('RGBA')
   metrics.append(validate(image,f'{key}/reference',clip['grounded'],clip.get('minHeight',70),clip.get('maxHeight',145)))
   images.append(image);poses.append({**origin,'wholeFrameReference':ref});image.save(ART/f'prepared/{key}-{len(images)-1:02}.png')
  if clip.get('prependReference'):
   ref=clip['prependReference'];origin=(records[ref['clip']] if ref['stage']=='current' else read(ART/f'{ref["stage"]}-production.json')['clips'][ref['clip']])['frames'][ref['index']]
   image=prepared[ref['clip']][ref['index']].copy() if ref['stage']=='current' else Image.open(ART/f'prepared/{ref["clip"]}-{ref["index"]:02}.png').convert('RGBA');images.insert(0,image);poses.insert(0,{**origin,'wholeFrameReference':ref})
   metrics.append(validate(image,f'{key}/initial-reference',clip['grounded'],clip.get('minHeight',70),clip.get('maxHeight',145)))
  for n,image in enumerate(images):image.save(ART/f'prepared/{key}-{n:02}.png')
  hashes=[hashlib.sha256(im.crop(im.getbbox()).tobytes()).hexdigest() for im in images]
  assert len(set(hashes))==len(hashes),(key,'translated/identical drawing')
  prepared[key]=images;records[key]={**clip,'frames':poses,'method':'whole-pose','uniqueDrawings':len(images),'ticks':sum(clip['durations'])}
  assert len(images)==len(clip['durations']) and all(t>0 for t in clip['durations']),key
  board=Image.new('RGB',(1536,math.ceil(len(images)/3)*550),'#253543');d=ImageDraw.Draw(board)
  for n,image in enumerate(images):
   x=n%3*512;y=n//3*550;big=image.resize((512,512),Image.Resampling.NEAREST)
   board.paste(big,(x,y+20),big);d.text((x+10,y+3),f'{key}/{n+1} / {clip["durations"][n]}ticks',fill='#ffe0aa');d.line((x,y+468,x+511,y+468),fill='#6ecfc8');d.line((x+250,y+468,x+262,y+468),fill='#ffbf69');d.line((x+256,y+462,x+256,y+474),fill='#ffbf69')
  board.save(ART/f'{key}-contact.png')
 write(ART/f'{stage}-validation.json',{'stage':stage,'beforeAtlas':True,'method':'whole-pose','frames':metrics})
 write(ART/f'{stage}-production.json',{'stage':stage,'method':'whole-pose','palette':PALETTE,'alphaThreshold':THRESHOLD,'clips':records})
 return prepared,records

def archive():
 destination=ART/'before-public'
 if not destination.exists():shutil.copytree(OUT,destination)
 public=ROOT/'public/sprites/goku-before-rebuild'
 if not public.exists():shutil.copytree(destination,public)

def foot_runs(image,y=223):
 row=np.array(image)[y,:,3]>0;xs=np.flatnonzero(row);runs=[]
 for x in xs:
  if not runs or x>runs[-1][-1]+1:runs.append([int(x)])
  else:runs[-1].append(int(x))
 return [r for r in runs if len(r)>=2]

def publish(stage):
 (ART/'prepared').mkdir(exist_ok=True);prepared,records=prepare(stage);archive()
 data=read(ROOT/'src/data/goku-animations.json');movement=read(OUT/'movement.json');g=read(ROOT/'src/data/goku.json');gait=read(ROOT/'src/data/goku-gait.json')
 for key,frames in prepared.items():
  clip=records[key];columns=min(8,len(frames));atlas=Image.new('RGBA',(columns*256,math.ceil(len(frames)/columns)*256))
  for n,image in enumerate(frames):atlas.paste(image,(n%columns*256,n//columns*256));image.save(OUT/f'{key}-{n:02}.png')
  atlas.save(OUT/f'{key}.png');times=clip['durations']
  data['clips'][key]={'sheet':f'goku/{key}.png','columns':columns,'frames':list(range(len(frames))),'ticks':times[0],'durations':times,'loop':clip['loop'],'visualHeights':[im.getbbox()[3]-im.getbbox()[1] for im in frames]}
  poses=[{'ticks':times[n],'phase':'locomotion','wholePose':True,'hurtboxes':r['hurtboxes'],'hitboxes':[]} for n,r in enumerate(clip['frames'])]
  movement['clips'][key]={'label':clip.get('label',key),'sheet':key+'.png','columns':columns,'count':len(frames),'durations':times,'loop':clip['loop'],'grounded':clip['grounded'],'support':[[] for _ in frames],'bounds':[im.getbbox() for im in frames],'poses':poses,'method':'whole-pose','rebuildStage':stage}
  g['reactions'][key]={'loop':clip['loop'],'poses':poses}
  frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in times],loop=0,disposal=0,blend=0)
  preview=Image.new('RGBA',atlas.size,'#253543');preview.alpha_composite(atlas);preview.save(OUT/f'{key}-preview.png')
  if key=='idle':
   frames[0].save(OUT/'base.png');g['hurtboxes']['standing']=poses[0]['hurtboxes']
   # Perspective/rasterisation may place the far sole1-2px above row223.
   # Measure BOTH actual boot footprints in the lowest six rows for entry,
   # rather than inventing a second foot at the only row223 support.
   band=np.array(frames[0])[218:224,:,3].any(axis=0);runs=[]
   for x in np.flatnonzero(band):
    if not runs or x>runs[-1][-1]+1:runs.append([int(x)])
    else:runs[-1].append(int(x))
   rest=[round(np.mean(runs[0])),round(np.mean(runs[-1]))]
   for name in ['walkForward','walkBack']:gait[name]['restFeet']=rest
  if key in ['walkForward','walkBack']:
   feet=[];supports=[];last=None;time=0
   for n,image in enumerate(frames):
    runs=foot_runs(image);assert runs,(key,n,'no real supporting sole');centers=[round(np.mean(r)) for r in runs]
    side='near' if n<len(frames)//2 else 'far'
    if n in [0,len(frames)//2]:target=max(centers) if key=='walkForward' else min(centers)
    else:target=last+(-1 if key=='walkForward' else 1)*abs(gait[key]['speed'])*clip['durations'][n-1]
    point=min(centers,key=lambda x:abs(x-target));last=point
    other=min(centers,key=lambda x:-abs(x-point)) if len(centers)>1 else point
    feet.append([point,other] if side=='near' else [other,point]);supports.append([side]);poses[n]['solePoints']={side:[point,223]};time+=clip['durations'][n]
   gait[key].update(ticks=time,feet=feet,pixelFeet=feet,support=supports[0],supportByFrame=supports,maxFootCorrection=0,wholePose=True)
   movement['clips'][key]['support']=supports
  if key in ['crouchWalkForward','crouchWalkBack']:
   feet=[];supports=[]
   for n,image in enumerate(frames):
    runs=foot_runs(image);assert runs,(key,n,'no visible sole');centers=[round(np.mean(r)) for r in runs]
    feet.append([centers[0],centers[-1]]);supports.append(['near','far'] if len(centers)>1 else ['near'])
   gait['walk'+key[len('crouchWalk'):]].update(crouchExitFeet=feet,crouchExitPixelFeet=feet,crouchExitSupport=supports)
   movement['clips'][key]['support']=supports
  if key=='crouchIdle':g['hurtboxes']['crouching']=poses[0]['hurtboxes']
  if key=='jumpApex':g['hurtboxes']['air']=poses[0]['hurtboxes']
 movement['rebuildRevision']=5;movement['rebuildStages']=list(dict.fromkeys(movement.get('rebuildStages',[])+[stage]))
 write(ROOT/'src/data/goku-animations.json',data);write(OUT/'animations.json',data);write(OUT/'movement.json',movement);write(ROOT/'src/data/goku.json',g);write(ROOT/'src/data/goku-gait.json',gait)
 info=read(OUT/'manifest.json');info.update({'revision':5,'method':'whole-pose with standing calibration per sheet','rebuildStages':list(dict.fromkeys(info.get('rebuildStages',[])+[stage]))});write(OUT/'manifest.json',info)
 protect();print(json.dumps({'stage':stage,'published':list(prepared),'drawings':sum(map(len,prepared.values()))}))

def build_all():
 stages=['foundation','walk','crouch','jump','dash','transitions','reactions'];config=read(ART/'sources.json')
 missing=[s for s in stages if s not in config['stages']]
 if missing:raise ValueError('Full rebuild sources are not ready: '+', '.join(missing))
 for stage in stages:publish(stage)
 from finalize_goku_rebuild import finalize
 finalize()

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('stage');parser.add_argument('--publish',action='store_true');args=parser.parse_args();(ART/'prepared').mkdir(exist_ok=True)
 publish(args.stage) if args.publish else prepare(args.stage)
