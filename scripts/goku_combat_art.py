"""Additive whole-pose combat art. Never modifies approved locomotion.
Source cells are COMPLETE drawings. Import uses uniform scale, palette/alpha
conversion and integer registration. Explicitly reviewed isolated noise may be
removed with an audited coordinate list; anatomy is never assembled or warped.
Cels and ticks are separate.
"""
from pathlib import Path
import argparse,json,hashlib,math,zipfile
import numpy as np
from PIL import Image,ImageDraw
from goku_rebuild import ROOT,PAL,PALETTE,THRESHOLD,component_counts
from goku_whole_source import extract
ART=ROOT/'art/goku/combat';OUT=ROOT/'public/sprites/goku/combat';PIVOT={'x':192,'y':224};SIZE=(384,256)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def protect():
 for name,digest in read(ART/'preservation.json').items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
def validate(im,label,grounded):
 a=np.array(im);mask=a[:,:,3]>0;b=im.getbbox();assert im.mode=='RGBA'and im.size==SIZE and b,(label,'empty/canvas')
 assert set(np.unique(a[:,:,3]))<={0,255}and np.all(a[~mask]==0),(label,'alpha/RGB')
 assert set(map(tuple,a[mask,:3]))<={tuple(bytes.fromhex(c[1:]))for c in PALETTE},(label,'palette')
 assert b[0]>=8 and b[1]>=8 and b[2]<=376 and b[3]<=224,(label,'clipped/below root',b)
 if grounded:assert b[3]==224 and np.count_nonzero(mask[223])>=2,(label,'no real floor contact')
 groups=component_counts(mask);assert groups[0]/sum(groups)>=.995 and(len(groups)==1 or groups[1]<=8),(label,'detached body part',groups[:4])
 assert np.count_nonzero(mask)>1200,(label,'incomplete figure')
 return {'bbox':b,'opaquePixels':int(mask.sum()),'largestComponent':groups[0]/sum(groups),'components':groups}
def whole(crop,scale,grounded,registration=None):
 crop=crop.copy();crop.putalpha(crop.getchannel('A').point(lambda v:255 if v>=THRESHOLD else 0))
 small=crop.resize(tuple(round(v*scale)for v in crop.size),Image.Resampling.NEAREST)
 q=small.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a);b=q.getbbox()
 if registration and 'sourceAnchor'in registration:
  x,y=registration['sourceAnchor'];tx,ty=registration.get('targetAnchor',[192,156]);offset=[round(tx-x*scale),round(ty-y*scale)]
 elif grounded:
  ys,xs=np.where(a[max(0,b[3]-3):b[3],:,3]>0);offset=[192-round((int(xs.min())+int(xs.max()))/2),224-b[3]]
 else:offset=[192-round((b[0]+b[2])/2),min(94-b[1],224-b[3])]
 if registration and 'offsetDelta'in registration:offset=[offset[i]+registration['offsetDelta'][i]for i in range(2)]
 result=Image.new('RGBA',SIZE);result.paste(q,tuple(offset));assert result.getbbox()==(b[0]+offset[0],b[1]+offset[1],b[2]+offset[0],b[3]+offset[1]),('registration cut a complete pose',offset)
 return result,offset
def hurtboxes(im):
 mask=np.array(im)[:,:,3]>0;boxes=[]
 for lo,hi in [(8,126),(126,155),(155,181),(181,204),(204,224)]:
  yy,xx=np.where(mask[lo:hi])
  if len(xx):boxes.append({'x':int(xx.min())-192,'y':int(yy.min())+lo-224,'w':int(xx.max()-xx.min()+1),'h':int(yy.max()-yy.min()+1)})
 return boxes
def strike(im,kind):
 a=np.array(im);yy,xx=np.mgrid[:256,:384];skin=['#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8'];blue=['#071326','#0c2146','#173a6b','#24599a','#3272b5','#5a91c8']
 mask=np.zeros((256,384),bool)
 for color in(blue if kind in ['kick','sweep','downkick']else skin):mask|=np.all(a[:,:,:3]==list(bytes.fromhex(color[1:])),axis=2)
 mask&=(a[:,:,3]>0)&(xx>202)
 if kind=='lowPunch':mask&=yy>=145
 elif kind=='downkick':mask&=yy>=165
 elif kind!='uppercut':mask&=(yy>=85)&(yy<210 if kind=='punch'else yy<224)
 assert mask.any(),('cannot locate actual striking material',kind)
 if kind=='uppercut':edge=int(yy[mask].min());selected=mask&(yy<=edge+6)
 elif kind=='downkick':edge=int(yy[mask].max());selected=mask&(yy>=edge-6)
 else:edge=int(xx[mask].max());selected=mask&(xx>=edge-7)
 px,py=round(float(xx[selected].mean())),round(float(yy[selected].mean()));x,y=px-192,py-224
 # Deliberately small volume on the real fist/boot; inspected in the lab.
 aPoint={'x':x,'y':y+14}if kind=='uppercut'else{'x':x-18,'y':y-26}if kind=='downkick'else{'x':x-36,'y':y}if kind in ['kick','sweep']else{'x':x-14,'y':y}
 return {'a':aPoint,'b':{'x':x,'y':y},'r':7},[px,py]
def prepare(key):
 protect();cfg=read(ART/'sources.json')['clips'][key];source=ROOT/cfg['source'];cal,_,_=extract(source,3,3,0);scale=130/cal.height;frames=[];records=[];elapsed=0
 for n,index in enumerate(cfg['cells']):
  crop,rect,cell=extract(source,3,3,index);im,offset=whole(crop,scale,cfg['grounded'],cfg.get('registration',{}).get(str(n)))
  # Explicitly reviewed isolated source noise only. Never erase a connected
  # body pixel, repair anatomy by masking, or silently discard a body part.
  cleanup=cfg.get('discardSpeckles',{}).get(str(n),[]);removed=[]
  assert len(cleanup)<=8
  points={tuple(p)for p in cleanup}
  for x,y in points:
   color=im.getpixel((x,y));assert color[3]>0
   for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    if (x+dx,y+dy)not in points:assert im.getpixel((x+dx,y+dy))[3]==0,('cleanup touches anatomy',key,n)
   removed.append({'point':[x,y],'rgba':list(color)})
  for point in points:im.putpixel(point,(0,0,0,0))
  metric=validate(im,f'{key}/{n}',cfg['grounded'])
  phase=('startup'if elapsed<cfg.get('startup',0)else'active'if elapsed<cfg.get('startup',0)+cfg.get('active',0)else'recovery')if cfg.get('kind')in['normal','throw']else'reaction'
  boxes=[];point=None
  if cfg.get('strike')and phase=='active':
   shape,point=strike(im,cfg['strike'])
   if str(n) in cfg.get('strikePoints',{}):
    point=cfg['strikePoints'][str(n)];x,y=point[0]-192,point[1]-224
    shape={'a':{'x':x,'y':y+14}if cfg['strike']=='uppercut'else{'x':x-18,'y':y-26}if cfg['strike']=='downkick'else{'x':x-36,'y':y}if cfg['strike']in['kick','sweep']else{'x':x-14,'y':y},'b':{'x':x,'y':y},'r':7}
   boxes=[shape]
  if cfg.get('kind')=='throw'and phase=='active':boxes=[cfg['combat']['box']]
  override=cfg.get('hitboxes',{}).get(str(n));boxes=override if override is not None else boxes
  pose={'ticks':cfg['durations'][n],'phase':phase,'hitboxes':boxes,'hurtboxes':hurtboxes(im)}
  rec={'source':cfg['source'],'sourceRect':rect,'cellRect':cell,'scale':scale,'offset':offset,'metrics':metric,'pose':pose,'strikePoint':point,'discardedSpeckles':removed}
  frames.append(im);records.append(rec);elapsed+=cfg['durations'][n]
 assert len(frames)==len(cfg['durations'])and all(t>0 for t in cfg['durations']),key
 hashes=[hashlib.sha256(str(im.crop(im.getbbox()).size).encode()+im.crop(im.getbbox()).tobytes()).hexdigest()for im in frames];assert len(set(hashes))==len(hashes),(key,'duplicate or only translated frame')
 (ART/'prepared').mkdir(exist_ok=True)
 for n,im in enumerate(frames):im.save(ART/f'prepared/{key}-{n:02}.png')
 board=Image.new('RGB',(768*min(3,len(frames)),560*math.ceil(len(frames)/3)),'#253543');d=ImageDraw.Draw(board)
 for n,im in enumerate(frames):
  x=n%3*768;y=n//3*560;big=im.resize((768,512),Image.Resampling.NEAREST);board.paste(big,(x,y+24),big);d.text((x+10,y+4),f'{key}/{n+1} / {cfg["durations"][n]} ticks / {records[n]["pose"]["phase"]}',fill='#ffe3b8');d.line((x,y+472,x+767,y+472),fill='#6fcfc8');d.line((x+384,y+466,x+384,y+478),fill='#ffb966')
 board.save(ART/f'{key}-contact.png');write(ART/f'{key}-production.json',{'method':'whole-pose','canvas':SIZE,'pivot':PIVOT,'config':cfg,'frames':records})
 return cfg,frames,records
def build():
 clips=read(ART/'sources.json')['clips'];prepared={key:prepare(key)for key in clips};OUT.mkdir(exist_ok=True)
 animations={'sheet':'goku/combat/stand_light.png','frameWidth':384,'frameHeight':256,'pivot':PIVOT,'scale':1,'clips':{}};manifest={'id':'goku','cell':SIZE,'pivot':PIVOT,'clips':{}};moves={};reactions={}
 for key,(cfg,frames,records)in prepared.items():
  cols=min(6,len(frames));sheet=Image.new('RGBA',(cols*384,math.ceil(len(frames)/cols)*256))
  for n,im in enumerate(frames):sheet.paste(im,(n%cols*384,n//cols*256));im.save(OUT/f'{key}-{n:02}.png')
  sheet.save(OUT/f'{key}.png');frames[0].save(OUT/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[v*1000/60 for v in cfg['durations']],loop=0,disposal=0,blend=0)
  poses=[r['pose']for r in records]
  animations['clips'][key]={'sheet':f'goku/combat/{key}.png','frameWidth':384,'frameHeight':256,'pivot':PIVOT,'columns':cols,'frames':list(range(len(frames))),'ticks':cfg['durations'][0],'durations':cfg['durations'],'loop':cfg.get('loop',False),'visualHeights':[im.getbbox()[3]-im.getbbox()[1]for im in frames]}
  manifest['clips'][key]={'sheet':key+'.png','label':cfg.get('label',key),'count':len(frames),'columns':cols,'durations':cfg['durations'],'loop':cfg.get('loop',False),'grounded':cfg['grounded'],'bounds':[im.getbbox()for im in frames],'poses':poses,'kind':cfg.get('kind','reaction')}
  if cfg.get('kind')=='normal':
   moves[key]={**cfg['combat'],'startup':cfg['startup'],'active':cfg['active'],'recovery':sum(cfg['durations'])-cfg['startup']-cfg['active'],'hitWindows':[{'id':0,'fromTick':cfg['startup'],'toTick':cfg['startup']+cfg['active']}],'box':{'x':0,'y':0,'w':0,'h':0},'poses':poses}
  elif cfg.get('kind')=='throw':moves['throw']={**cfg['combat'],'startup':cfg['startup'],'active':cfg['active'],'recovery':sum(cfg['durations'])-cfg['startup']-cfg['active'],'poses':poses}
  else:reactions[key]={'loop':cfg.get('loop',False),'poses':poses}
 write(ROOT/'src/data/goku-combat-animations.json',animations);write(OUT/'animations.json',animations);write(OUT/'manifest.json',manifest);write(ROOT/'src/data/goku-normals.json',moves)
 secondary=read(ART/'secondary-config.json');write(ROOT/'src/data/goku-combat.json',{**secondary,'reactions':reactions})
 with zipfile.ZipFile(ROOT/'public/downloads/goku-combat.zip','w',zipfile.ZIP_DEFLATED)as z:
  for p in OUT.glob('*'):z.write(p,'combat/'+p.name)
  for p in ART.glob('*-contact.png'):z.write(p,'contact/'+p.name)
  for p in ART.glob('prompts-*.json'):z.write(p,'audit/'+p.name)
  for name in ['sources.json','secondary-config.json']:z.write(ART/name,'audit/'+name)
  for name in ['goku-combat-animations.json','goku-normals.json','goku-combat.json']:z.write(ROOT/'src/data'/name,'data/'+name)
  for name in ['provenance.json','shared-engine-revisions.json']:
   if (ART/name).exists():z.write(ART/name,'audit/'+name)
 protect();print(json.dumps({'clips':len(clips),'cells':sum(len(v[1])for v in prepared.values()),'moves':list(moves)}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('key',nargs='?',default='all');a=p.parse_args();build()if a.key=='all'else prepare(a.key)
