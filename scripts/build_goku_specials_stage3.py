"""Stage 3 whole-pose importer. Only full poses, uniform scale and registration.
Approved MOV5 and normal/reaction data and sprites are never rewritten.
"""
from pathlib import Path
import json,hashlib,math,zipfile
import numpy as np
from PIL import Image,ImageDraw
from goku_rebuild import ROOT,PAL,THRESHOLD
from goku_combat_art import whole,validate,hurtboxes
from goku_whole_source import extract
ART=ROOT/'art/goku/specials/stage3';OUT=ROOT/'public/sprites/goku/specials';OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def protect():
 for n,h in read(ART/'preservation.json').items():assert hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==h,n
def palette(im):
 im=im.copy();im.putalpha(im.getchannel('A').point(lambda a:255 if a>=180 else 0));q=im.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(im.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;return Image.fromarray(a)
def hand(im,chamber=False):
 a=np.array(im);yy,xx=np.mgrid[:256,:384];m=np.zeros((256,384),bool)
 for color in ['#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8']:m|=np.all(a[:,:,:3]==list(bytes.fromhex(color[1:])),axis=2)
 m&=(a[:,:,3]>0)&(yy>130)&(yy<192)&(xx>148)
 if chamber:m&=xx<205
 assert m.any(),'no actual hand material'
 if chamber:
  distance=(xx-174)**2+(yy-168)**2;edge=distance[m].min();sel=m&(distance<=edge+25)
 else:edge=xx[m].max();sel=m&(xx>=edge-6)
 return {'x':round(float(xx[sel].mean()))-192,'y':round(float(yy[sel].mean()))-224}
def make():
 protect();bal=read(ROOT/'src/data/goku-specials.json');clips={};moves={};proof={};manifest={'id':'goku','cell':[384,256],'pivot':{'x':192,'y':224},'clips':{}}
 for family in ['ki','kamehameha','teleport']:
  for strength in ['light','medium','heavy']:
   key=f'{family}_{strength}';cfg=bal[family][strength];source=family+'_'+strength if family=='ki'else family
   start=cfg['startup'];active=cfg.get('active',cfg.get('vanishTicks',1));rec=cfg['recovery']
   if family=='ki':
    # Medium's second extended arm is a distinct release drawing.
    cells=[1,2,3,4,5,6,7,8];pre=[max(1,start//3),max(1,start//3)];pre.append(start-sum(pre))
    durations=pre+([4,5,1]if strength=='medium'else[active])+([5,6,rec-11]if strength=='medium'else[3,4,4,rec-11])
    if strength=='medium':cells=[0,1,2,3,4,5,6,7,8]
   elif family=='kamehameha':
    cells=[1,2,3,4,5,6,7,8,0];pre=[start//3,start//3];pre.append(start-sum(pre));durations=pre+[1,active//2,active-1-active//2]+[rec//3,rec//3,rec-2*(rec//3)]
   else:
    cells=[1,2,3,4,5,6,7,8,0];pre=[start//3,start//3];pre.append(start-sum(pre));durations=pre+[active]+[max(1,rec//5)]*4;durations+=[rec-4*max(1,rec//5)]
   variants=[key]+(['teleport_air']if key=='teleport_heavy'else[])
   for variant in variants:
    localCells=cells;localDurations=durations
    if key=='teleport_heavy':
     # Source airborne cel 5 fails connectivity: reject it, never erase or
     # reassemble its detached pixels. Use complete, distinct aerial poses.
     localCells=[1,2,3,4,3,4,6,8]if variant==key else[1,2,3,4,6,7,8]
     count=len(localCells)-4;q=rec//count;localDurations=pre+[active]+[q]*(count-1)+[rec-q*(count-1)]
    images=[];records=[];elapsed=0
    for i,(index,ticks)in enumerate(zip(localCells,localDurations)):
     file=source
     airborne=variant=='teleport_air' or(key=='teleport_heavy'and elapsed>=start+active)
     if airborne:file='teleport_air'
     path=ART/f'{file}-source.png';cal,_,_=extract(path,3,3,0);crop,rect,cell=extract(path,3,3,index);scale=130/cal.height
     im,offset=whole(crop,scale,not airborne)
     try:metric=validate(im,f'{variant}/{i}',not airborne)
     except AssertionError:im.save(ART/f'rejected-{variant}-{i}.png');raise
     phase='startup'if elapsed<start else'active'if elapsed<start+active else'recovery'
     release=hand(im,chamber=phase=='startup')if family in ['ki','kamehameha']else{'x':15,'y':-108}
     pose={'ticks':ticks,'phase':phase,'hurtboxes':hurtboxes(im),'hitboxes':[],'release':release}
     records.append({'source':path.relative_to(ROOT).as_posix(),'sourceRect':rect,'scale':scale,'offset':offset,'metrics':metric,'pose':pose});images.append(im);elapsed+=ticks
    durations=localDurations
    assert len(localCells)==len(durations)and elapsed==start+active+rec,(key,localCells,durations)
    hashes=[hashlib.sha256(str(im.crop(im.getbbox()).size).encode()+im.crop(im.getbbox()).tobytes()).hexdigest()for im in images];assert len(set(hashes))==len(hashes),(variant,'duplicated pose')
    cols=min(6,len(images));sheet=Image.new('RGBA',(cols*384,math.ceil(len(images)/cols)*256))
    for i,im in enumerate(images):sheet.paste(im,(i%cols*384,i//cols*256));im.save(OUT/f'{variant}-{i:02}.png')
    sheet.save(OUT/f'{variant}.png');images[0].save(OUT/f'{variant}-animated.png',save_all=True,append_images=images[1:],duration=[t*1000/60 for t in durations],loop=0,disposal=0,blend=0)
    clips[variant]={'sheet':f'goku/specials/{variant}.png','frameWidth':384,'frameHeight':256,'pivot':{'x':192,'y':224},'columns':cols,'frames':list(range(len(images))),'ticks':durations[0],'durations':durations,'loop':False,'visualHeights':[im.getbbox()[3]-im.getbbox()[1]for im in images]}
    poses=[r['pose']for r in records];manifest['clips'][variant]={'sheet':variant+'.png','count':len(images),'columns':cols,'durations':durations,'poses':poses,'bounds':[im.getbbox()for im in images]}
    move={'special':family,'gokuStrength':strength,'startup':start,'active':active,'recovery':rec,'damage':cfg.get('damage',0),'stun':cfg.get('stun',0),'blockstun':cfg.get('blockstun',0),'push':.8 if family=='kamehameha'else 2,'launch':0,'level':'mid','rank':4,'cancels':[],'box':{'x':0,'y':0,'w':0,'h':0},'poses':poses,'hitstop':4 if family=='kamehameha'else 6,'cost':0,'meterGain':3}
    if family=='ki':move['projectile']={'releases':cfg['releases'],'angles':[0]*len(cfg['releases']),'speed':cfg['speed'],'life':cfg['life'],'kind':'ki','radius':cfg['radius']}
    if family=='kamehameha':move['beam']={k:cfg[k]for k in ['range','radius','interval','hits']}
    moves[variant]=move;proof[variant]={'durations':durations,'frames':records}
    board=Image.new('RGB',(768*3,560*math.ceil(len(images)/3)),'#20303e');d=ImageDraw.Draw(board)
    for i,im in enumerate(images):
     x=i%3*768;y=i//3*560;big=im.resize((768,512),Image.Resampling.NEAREST);board.paste(big,(x,y+24),big);d.text((x+8,y+5),f'{variant} / {i+1} / {durations[i]} ticks / {poses[i]["phase"]}',fill='#ffe2ad');d.line((x,y+472,x+767,y+472),fill='#79c1c8')
    board.save(ART/f'{variant}-contact.png')
 animations={'sheet':'goku/specials/ki_light.png','frameWidth':384,'frameHeight':256,'pivot':{'x':192,'y':224},'scale':1,'clips':clips}
 write(ROOT/'src/data/goku-special-moves.json',moves);write(ROOT/'src/data/goku-special-animations.json',animations);write(OUT/'animations.json',animations);write(OUT/'manifest.json',manifest);write(ART/'production.json',proof);protect();print('Exported',len(clips),'clips,',sum(len(v['frames'])for v in proof.values()),'cel references.')
if __name__=='__main__':make()
