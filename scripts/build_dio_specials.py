"""Additive pixel-art production for ordinary Dio specials. Approved art is locked."""
from pathlib import Path
import json, hashlib, math, copy, zipfile
from PIL import Image, ImageDraw
from build_stand_normals import AttackRig, render, world_definitions, dio_commands
from revise_dio_movement import interpolate

ROOT=Path(__file__).resolve().parents[1]
BAL=json.loads((ROOT/'src/data/dio-specials.json').read_text())

def protect():
    lock=ROOT/'art/dio/specials-preservation.json'
    if not lock.exists():
        images={}
        for who in ['samurai','dio','the-world']:
            for f in (ROOT/f'public/sprites/{who}').glob('*.png'):
                images[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
        lock.write_text(json.dumps(dict(images=images,
          animations={n:json.loads((ROOT/f'src/data/{n}-animations.json').read_text()) for n in ['dio','the-world']},
          characterHash=hashlib.sha256((ROOT/'src/data/dio.json').read_bytes()).hexdigest(),
          samuraiHash=hashlib.sha256((ROOT/'src/data/samurai.json').read_bytes()).hexdigest()),indent=2)+'\n')
    data=json.loads(lock.read_text())
    for f,digest in data['images'].items():
        if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=digest:raise ValueError('Approved image modified: '+f)
    for name,old in data['animations'].items():
        current=json.loads((ROOT/f'src/data/{name}-animations.json').read_text())
        for key,clip in old['clips'].items():
            if current['clips'][key]!=clip:raise ValueError('Approved animation modified: '+key)
    assert hashlib.sha256((ROOT/'src/data/dio.json').read_bytes()).hexdigest()==data['characterHash']
    assert hashlib.sha256((ROOT/'src/data/samurai.json').read_bytes()).hexdigest()==data['samuraiHash']

def knife_pixels(at=(0,0),angle=0):
    im=Image.new('RGBA',(48,48));d=ImageDraw.Draw(im)
    d.polygon([(12,21),(28,21),(37,24),(28,26),(12,25)],fill='#0c0d15')
    d.polygon([(14,22),(28,22),(34,24),(14,24)],fill='#f1f5f5')
    d.line((14,25,28,25),fill='#444c62');d.line((15,24,30,24),fill='#f1d38a')
    d.rectangle((8,22,13,25),fill='#77502c');d.line((9,22,12,22),fill='#deb65d')
    d.line((13,20,13,27),fill='#f4c944')
    im=im.rotate(-angle,resample=Image.Resampling.NEAREST,center=(12,24))
    out=Image.new('RGBA',(256,256));out.alpha_composite(im,(round(at[0])-12,round(at[1])-24));return out

def definitions():
    commands=dio_commands();idle=commands['commandRelaxed']['poses'][0]
    def dp(**kw):return {**idle,**kw}
    dio={}
    def add(dest,key,label,poses,durations,contacts=None):
        dest[key]=dict(label=label,poses=poses,durations=durations,contacts=contacts or {})
    add(dio,'knifePrepare','Facas / preparação',[
      dp(lean=-2,farTarget=[148,148],nearHand=[-1,0],cloth=0),
      dp(lean=-4,hip=1,farTarget=[145,152],nearHand=[-2,-1],cloth=-1),
      dp(lean=-6,hip=1,farTarget=[141,153],nearHand=[-2,-2],cloth=-2),
      dp(lean=-5,farTarget=[140,150],nearHand=[-1,-3],cloth=-1)], [2,2,2,2])
    add(dio,'knifeDraw','Facas / retirada',[
      dp(lean=-6,farTarget=[140,150],farWrist=-40,heldKnife=-70,cloth=-1),
      dp(lean=-5,farTarget=[141,143],farWrist=-60,heldKnife=-85,cloth=-2),
      dp(lean=-4,farTarget=[144,133],farWrist=-70,heldKnife=-90,cloth=-1),
      dp(lean=-3,farTarget=[147,126],farWrist=-65,heldKnife=-90,cloth=0)], [2]*4)
    add(dio,'knifeArm','Facas / braço',[
      dp(lean=-8,farTarget=[143,123],farWrist=-80,heldKnife=-95,nearHand=[1,-4],cloth=-2),
      dp(lean=-10,farTarget=[140,116],farWrist=-90,heldKnife=-105,nearHand=[2,-5],cloth=-3),
      dp(lean=-7,farTarget=[148,112],farWrist=-100,heldKnife=-70,nearHand=[2,-4],cloth=-2),
      dp(lean=-2,farTarget=[157,118],farWrist=-45,heldKnife=-30,nearHand=[2,-3],cloth=1)], [2]*4)
    add(dio,'knifeThrow','Facas / arremesso',[
      dp(lean=-3,farTarget=[152,117],farWrist=-60,heldKnife=-50,nearHand=[1,-3],cloth=-1),
      dp(lean=2,farTarget=[164,126],farWrist=-20,heldKnife=-10,nearHand=[2,-2],cloth=1),
      dp(lean=8,farTarget=[180,135],farWrist=0,nearHand=[2,-1],cloth=3),
      dp(lean=11,farTarget=[184,141],farWrist=5,nearHand=[3,0],cloth=4),
      dp(lean=7,farTarget=[174,143],farWrist=9,nearHand=[1,0],cloth=2),
      dp(lean=3,farTarget=[160,145],farWrist=4,nearHand=[0,0],cloth=1)], [1,1,2,2,3,3])
    recovery=[interpolate(dio['knifeThrow']['poses'][-1],idle,t) for t in [0,.25,.5,.75,1]]
    add(dio,'knifeRecover','Facas / recuperação',recovery,[2]*5)
    add(dio,'rushCommand','Muda / comando de Dio',[
      dp(lean=l,hip=h,farTarget=t,farWrist=w,pointing=True,nearHand=[1,-2],cloth=c)
      for l,h,t,w,c in [(-2,0,[152,142],-5,0),(-3,1,[151,132],-20,-1),(-1,0,[158,127],-15,-2),
                           (2,-1,[166,131],0,3),(1,-.5,[160,136],3,1),(0,0,[153,142],0,-1)]],[3]*6)
    add(dio,'timePreparation','Tempo / preparação',[
      dp(lean=l,hip=h,nearTarget=n,farTarget=f,farWrist=w,nearWrist=-w,cloth=c)
      for l,h,n,f,w,c in [(-1,0,[111,149],[151,143],0,0),(-3,1,[112,144],[153,137],-15,-1),
                          (-5,1,[113,137],[156,129],-30,-2),(-3,0,[110,129],[158,121],-45,-1)]],[3]*4)
    add(dio,'timeCommand','Tempo / comando',[
      dp(lean=l,nearTarget=n,farTarget=f,farWrist=-70,nearWrist=-35,cloth=c)
      for l,n,f,c in [(-2,[109,125],[159,116],-1),(-1,[106,121],[161,110],0),
                       (0,[104,119],[163,104],1),(1,[102,116],[165,100],2)]],[3]*4)
    add(dio,'timeActivation','Tempo / ativação',[
      dp(lean=l,hip=h,nearTarget=n,farTarget=f,farWrist=-80,nearWrist=-35,cloth=c)
      for l,h,n,f,c in [(1,0,[102,116],[165,100],1),(2,-1,[101,113],[168,95],3),
                         (3,-1,[100,112],[169,92],4),(2,0,[103,117],[165,105],2)]],[2,2,3,2])
    add(dio,'timeGuard','Tempo / retorno à guarda',[
      interpolate(dio['timeActivation']['poses'][-1],idle,t) for t in [0,.33,.66,1]],[2]*4)
    normal=world_definitions();base=normal['quickPunch']['poses'][0]
    def wp(**kw):return {**base,**kw}
    world={}
    add(world,'rushPrepare','Muda / preparação',[
      wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearAnkle=a,cloth=c)
      for l,h,n,f,a,c in [(-3,2,[121,120],[149,118],[101,198],-1),(-7,4,[125,116],[146,113],[102,197],-2),
                           (-12,5,[128,112],[144,109],[103,196],-3),(-9,3,[130,113],[146,110],[104,194],-2)]],[2]*4)
    add(world,'rushAdvance','Muda / avanço',[
      wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearAnkle=a,farAnkle=[141,188],cloth=c)
      for l,h,n,f,a,c in [(-3,2,[130,115],[151,111],[105,193],-1),(3,0,[128,117],[157,111],[107,191],1),
                           (8,-1,[126,118],[161,112],[109,190],2),(12,0,[124,119],[164,113],[111,189],3)]],[1]*4)
    for key,side,label in [('rushFirst','far','primeiro soco'),('rushLeft','near','braço esquerdo'),('rushRight','far','braço direito')]:
        poses=[]
        for j,(lean,hip,x,reach) in enumerate([(-6,2,0,0),(6,0,3,.35),(23,1,8,1),(15,2,4,.55),(-2,1,1,.05)]):
            if side=='near':
                # Bring the near shoulder across the chest with a real hip
                # turn. Stretching this shorter projected arm would be wrong.
                x+=18*reach;lean+=6*reach
                n=[125+56*reach,118+8*reach];f=[154-7*reach,113-2*reach]
            else:n=[125-4*reach,118+3*reach];f=[151+48*reach,113+12*reach]
            poses.append(wp(lean=lean+(2 if key=='rushRight' else 0),hip=hip,x=x,
              nearTarget=n,farTarget=f,nearAnkle=[108+round(5*reach),190-round(3*reach)],
              farAnkle=[141-round(2*reach),186+round(2*reach)],cloth=j-2))
        add(world,key,'Muda / '+label,poses,[1,1,2,1,1],{2:(side,0)})
    alt=[]
    for i in range(6):
        source=world['rushLeft' if i%2==0 else 'rushRight']['poses'][2 if i%3!=2 else 3]
        alt.append({**source,'hip':i*.3,'cloth':i-3,'hair':(i%3)-1})
    add(world,'rushAlternation','Muda / alternância',alt,[1]*6)
    finish=[copy.deepcopy(p) for p in normal['heavyPunch']['poses'][2:]]
    for i,p in enumerate(finish):p['cloth']=p.get('cloth',0)+.3;p['nearAnkle']=[p['nearAnkle'][0]+1,p['nearAnkle'][1]-1]
    add(world,'rushFinisher','Muda / soco final',finish,[2,1,2,2,3,3],{2:('far',0),3:('far',0)})
    rec=[interpolate(finish[-1],base,t) for t in [0,.25,.5,.75,1]]
    add(world,'rushRecovery','Muda / recuperação',rec,[2]*5)
    ret=[{**p,'cloth':p.get('cloth',0)-.3} for p in normal['returnBehind']['poses']]
    add(world,'rushReturn','Muda / retorno',ret,[2]*5)
    add(world,'timePrepare','Tempo / preparo do Stand',[
      wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearAnkle=a,farAnkle=[142,190],cloth=c)
      for l,h,n,f,a,c in [(-3,1,[119,120],[151,117],[103,196],-1),(-6,3,[123,116],[153,111],[105,193],-2),
                           (-4,1,[124,110],[157,104],[107,190],-1),(-1,-1,[123,104],[160,96],[109,188],1)]],[4]*4)
    add(world,'timeActivate','Tempo / ativação do Stand',[
      wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearWrist=-60,farWrist=-80,nearAnkle=a,farAnkle=[140,183],cloth=c)
      for l,h,n,f,a,c in [(1,-2,[122,100],[164,88],[110,186],1),(3,-3,[120,96],[167,80],[112,183],3),
                           (5,-4,[119,93],[169,75],[114,180],4),(3,-2,[121,98],[166,84],[112,184],2)]],[2,2,3,2])
    add(world,'timeMaintain','Tempo / manutenção',[
      wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearAnkle=a,farAnkle=[142,187],cloth=c)
      for l,h,n,f,a,c in [(0,-1,[120,111],[158,104],[107,191],0),(1,-2,[121,110],[159,103],[108,190],1),
                           (2,-3,[122,109],[160,102],[109,189],2),(1,-1.5,[121,110],[159,104],[108,190],-1)]],[6]*4)
    add(world,'timeFinish','Tempo / finalização',[
      interpolate(world['timeMaintain']['poses'][0],base,t) for t in [0,.33,.66,1]],[2]*4)
    # Compose each timed Rush from distinct torso/shoulder and limb keys.
    for strength in ['light','medium','heavy']:
        cfg=BAL['rush'][strength];poses=[];times=[];contacts={}
        prep=world['rushPrepare']['poses'];advance=world['rushAdvance']['poses']
        for p,t in [(prep[0],3),(prep[2],3),(advance[1],2),(advance[3],cfg['startup']-8)]:poses.append(p);times.append(t)
        for i in range(cfg['hits']):
            last=i==cfg['hits']-1;side='far' if last or i%2==0 else 'near'
            src=world['rushFinisher' if last else 'rushRight' if side=='far' else 'rushLeft']['poses']
            p=copy.deepcopy(src[2]);p['hip']=p.get('hip',0)+i*.2;p['cloth']=p.get('cloth',0)+(i%3)*.4
            contacts[len(poses)]=(side,i);poses.append(p);times.append(BAL['rush']['contactTicks'])
            if not last:
                recoil=copy.deepcopy(src[3]);recoil['hip']=recoil.get('hip',0)+i*.2;recoil['cloth']=i*.3
                poses.append(recoil);times.append(BAL['rush']['spacingTicks']-BAL['rush']['contactTicks'])
        for j,p in enumerate(rec):poses.append(p);times.append(cfg['recovery']//5+(1 if j<cfg['recovery']%5 else 0))
        add(world,'muda'+strength.title(),'Muda Muda / '+strength,poses,times,contacts)
    # The owner uses gestures, never the Stand's attack drawings.
    for strength,points in {
      'light':[(0,'knifePrepare',0),(3,'knifePrepare',2),(6,'knifeDraw',1),(8,'knifeDraw',3),(9,'knifeArm',1),(11,'knifeThrow',2),(13,'knifeThrow',3),(16,'knifeThrow',5),(20,'knifeRecover',1),(24,'knifeRecover',3)],
      'medium':[(0,'knifePrepare',0),(4,'knifePrepare',2),(8,'knifeDraw',1),(11,'knifeDraw',3),(13,'knifeArm',1),(16,'knifeThrow',2),(18,'knifeThrow',3),(20,'knifeArm',0),(22,'knifeArm',2),(24,'knifeThrow',2),(27,'knifeThrow',4),(31,'knifeRecover',0),(36,'knifeRecover',2),(41,'knifeRecover',4)],
      'heavy':[(0,'knifePrepare',0),(5,'knifePrepare',2),(9,'knifeDraw',1),(13,'knifeDraw',3),(17,'knifeArm',0),(20,'knifeArm',2),(22,'knifeThrow',2),(25,'knifeThrow',3),(29,'knifeThrow',4),(34,'knifeThrow',5),(40,'knifeRecover',0),(46,'knifeRecover',2),(51,'knifeRecover',4)]}.items():
        poses=[];times=[]
        for i,(tick,key,index) in enumerate(points):
            p=copy.deepcopy(dio[key]['poses'][index]);p['cloth']=p.get('cloth',0)+i*.08
            if strength=='medium' and tick==24:p['hip']=-1;p['hair']=1
            poses.append(p);times.append((points[i+1][0] if i+1<len(points) else BAL['knives'][strength]['duration'])-tick)
        add(dio,'knives_'+strength,'Lançamento de facas / '+strength,poses,times)
        total=sum(world['muda'+strength.title()]['durations']);c=dio['rushCommand']
        add(dio,'rush_'+strength,'Comando / Muda '+strength,c['poses'],[total//6+(1 if i<total%6 else 0) for i in range(6)])
    poses=dio['timePreparation']['poses']+dio['timeCommand']['poses']+dio['timeActivation']['poses'][:2]+dio['timeGuard']['poses'][1:]
    times=[3]*8+[1,2,2,2,2]
    assert sum(times)==BAL['timeStop']['startupTicks']+BAL['timeStop']['activationRecoveryTicks']
    add(dio,'time_stop','Parada do Tempo',poses,times)
    return dio,world

def export(who,defs):
    rig=AttackRig(who);out=ROOT/f'public/sprites/{who}';manifest={'id':who,'revision':4,'cell':[256,256],'pivot':{'x':128,'y':224},'clips':{}}
    config=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())
    for key,definition in defs.items():
        frames=[];poses=[]
        for i,p in enumerate(definition['poses']):
            im,g=render(rig,p,who=='dio')
            if 'heldKnife' in p:im.alpha_composite(knife_pixels(g['anchors']['arms']['far'][2],p['heldKnife']))
            contact=definition['contacts'].get(i);wrist=g['anchors']['arms']['far'][2]
            poses.append(dict(ticks=definition['durations'][i],phase='active' if contact else 'transition',
              hitboxes=[g['surfaces'][contact[0]]] if contact else [],hitId=contact[1] if contact else -1,
              release={'x':wrist[0]-128+10,'y':wrist[1]-224},**g))
            frames.append(im);im.save(out/f'{key}-{i:02}.png')
        if len(set(f.tobytes() for f in frames))!=len(frames):raise ValueError('Duplicate special cells: '+key)
        sheet=Image.new('RGBA',(256*len(frames),256))
        for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
        sheet.save(out/f'{key}.png')
        preview=Image.new('RGBA',sheet.size,'#293a47');preview.alpha_composite(sheet)
        preview.resize((preview.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
        frames[0].save(out/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in definition['durations']],loop=0,disposal=0,blend=0)
        clip=dict(label=definition['label'],sheet=key+'.png',count=len(frames),durations=definition['durations'],loop=key=='timeMaintain',poses=poses,bounds=[f.getbbox() for f in frames])
        manifest['clips'][key]=clip
        config['clips'][key]=dict(sheet=f'{who}/{key}.png',columns=len(frames),frames=list(range(len(frames))),ticks=definition['durations'][0],durations=definition['durations'],loop=clip['loop'])
    (ROOT/f'src/data/{who}-animations.json').write_text(json.dumps(config,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'specials.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest

def moves(dm,wm):
    out={}
    for strength in ['light','medium','heavy']:
        key='knives_'+strength;cfg=BAL['knives'][strength];clip=dm['clips'][key];active=max(cfg['releases'])-cfg['startup']+1
        out[key]=dict(special='knives',kind='projectile',startup=cfg['startup'],active=active,recovery=cfg['duration']-cfg['startup']-active,
          damage=cfg['damage'],stun=cfg['stun'],blockstun=cfg['blockstun'],push=1.8,launch=0,level='mid',rank=4,cancels=[],hitWindows=[],
          hitstop=3,meterGain=3,box=dict(x=0,y=0,w=0,h=0),poses=clip['poses'],
          projectile=dict(releases=cfg['releases'],angles=cfg['angles'],speed=cfg['speed'],life=BAL['knives']['lifeTicks']))
        key='rush_'+strength;cfg=BAL['rush'][strength];clip=wm['clips']['muda'+strength.title()];clock=0;windows=[]
        for p in clip['poses']:
            if p['hitId']>=0:
                last=p['hitId']==cfg['hits']-1
                windows.append(dict(id=p['hitId'],fromTick=clock,toTick=clock+p['ticks'],damage=cfg['finisherDamage'] if last else cfg['damage'],push=6 if last else .18,stun=29 if last else 13,blockstun=14 if last else 8))
            clock+=p['ticks']
        end=windows[-1]['toTick'];out[key]=dict(special='rush',kind='rush',startup=cfg['startup'],active=end-cfg['startup'],recovery=clock-end,
          damage=cfg['damage'],stun=13,blockstun=8,push=.18,launch=0,level='mid',rank=4,cancels=[],hitWindows=windows,hitstop=2,meterGain=1,
          comboHitLimit=BAL['rush']['comboHitLimit'],box=dict(x=0,y=0,w=0,h=0),poses=dm['clips'][key]['poses'],
          stand=dict(approachAt=0,approachTicks=cfg['startup'],punchAt=0,recoverAt=clock,returnAt=clock,returnTicks=12 if strength=='light' else 16,
                     returnClip='rushReturn',front=dict(x=cfg['advance'],y=-14),clip='muda'+strength.title(),bridgeTicks=4))
    cfg=BAL['timeStop'];out['time_stop']=dict(special='timeStop',kind='ability',startup=cfg['startupTicks'],active=1,recovery=cfg['activationRecoveryTicks']-1,
      damage=0,stun=0,blockstun=0,push=0,launch=0,level='mid',rank=4,cancels=[],hitWindows=[],box=dict(x=0,y=0,w=0,h=0),poses=dm['clips']['time_stop']['poses'])
    return out

def bridges(world):
    normal=world_definitions();rig=AttackRig('the-world');out=ROOT/'public/sprites/the-world';entries={}
    for source in ['quickPunch','straightPunch','heavyPunch','lowPunch','lowSweep','uppercut']:
        for i in normal[source]['contacts']:
            for target in ['mudaLight','mudaMedium','mudaHeavy']:
                a=normal[source]['poses'][i];b=world[target]['poses'][0];frames=[];poses=[]
                for t in [0,.25,.5,.75,1]:
                    im,g=render(rig,interpolate(a,b,t),False)
                    if frames and im.tobytes()==frames[-1].tobytes():continue
                    frames.append(im);poses.append(dict(ticks=1,phase='transition',hitboxes=[],hitId=-1,**g))
                key=f'bridge_{source}_{i}_{target}';sheet=Image.new('RGBA',(256*len(frames),256))
                for j,f in enumerate(frames):sheet.paste(f,(256*j,0))
                sheet.save(out/f'{key}.png');entries[key]=dict(sheet=key+'.png',count=len(frames),durations=[1]*len(frames),poses=poses)
    config=json.loads((ROOT/'src/data/the-world-animations.json').read_text())
    for k,c in entries.items():config['clips'][k]=dict(sheet='the-world/'+c['sheet'],columns=c['count'],frames=list(range(c['count'])),ticks=1,durations=c['durations'],loop=False)
    (ROOT/'src/data/the-world-animations.json').write_text(json.dumps(config,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'special-transitions.json').write_text(json.dumps(entries,indent=2)+'\n');return entries

def fx():
    atlas=Image.new('RGBA',(128*14,128))
    for angle in range(3):
        for glint in range(2):
            knife=knife_pixels((118,224),(angle-1)*-4).crop((104,212,152,236))
            if glint:ImageDraw.Draw(knife).point((26,11),fill='#fff0d4')
            cell=Image.new('RGBA',(128,128));cell.alpha_composite(knife,(40,52));atlas.paste(cell,((angle*2+glint)*128,0))
    for i in range(8):
        cell=Image.new('RGBA',(128,128));d=ImageDraw.Draw(cell);radius=10+i*7
        for degrees in range(0,360,4):
            a=math.radians(degrees);x=round(64+math.cos(a)*radius);y=round(64+math.sin(a)*radius)
            d.rectangle((x-1,y-1,x+1,y+1),fill=['#f1d38a','#a9d6e5','#c6b7f1'][i%3])
        for k in range(8):
            a=k*math.pi/4+.1*i;x=round(64+math.cos(a)*(radius+3));y=round(64+math.sin(a)*(radius+3))
            d.rectangle((x,y,x+2,y+2),fill='#f1f5f5')
        atlas.paste(cell,((6+i)*128,0))
    atlas.save(ROOT/'public/sprites/fx/dio-specials.png')
    (ROOT/'public/sprites/fx/dio-specials.json').write_text(json.dumps(dict(cell=[128,128],knives=list(range(6)),timePulse=list(range(6,14))),indent=2)+'\n')

def build():
    protect();dio,world=definitions();dm=export('dio',dio);wm=export('the-world',world);transition=bridges(world)
    (ROOT/'src/data/dio-special-moves.json').write_text(json.dumps(moves(dm,wm),indent=2)+'\n')
    (ROOT/'src/data/the-world-special-actions.json').write_text(json.dumps({**wm['clips'],**transition},indent=2)+'\n')
    fx();qa=ROOT/'art/dio/qa/specials';qa.mkdir(parents=True,exist_ok=True)
    for who,manifest in [('dio',dm),('the-world',wm)]:
        rows=[]
        for key,c in manifest['clips'].items():
            # Main timed Rush sheets remain available unabridged in the ZIP.
            indices=range(c['count']) if c['count']<=16 else range(0,c['count'],2)
            board=Image.new('RGB',(max(1,len(indices))*155,185),'#1a2934');d=ImageDraw.Draw(board);d.text((4,2),key,fill='#edc984')
            for j,i in enumerate(indices):
                f=Image.open(ROOT/f'public/sprites/{who}/{key}-{i:02}.png');tile=Image.new('RGBA',(155,165),'#596674');tile.alpha_composite(f.crop((55,65,210,230)));board.paste(tile.convert('RGB'),(j*155,18))
            rows.append(board)
        contact=Image.new('RGB',(max(r.width for r in rows),sum(r.height for r in rows)),'#1a2934');y=0
        for row in rows:contact.paste(row,(0,y));y+=row.height
        contact.save(qa/f'{who}-contact.png')
        (ROOT/f'art/{who}/specials-rig.json').write_text(json.dumps(dio if who=='dio' else world,indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'public/downloads/dio-specials.zip','w',zipfile.ZIP_DEFLATED) as z:
        for who,m in [('dio',dm),('the-world',wm)]:
            out=ROOT/f'public/sprites/{who}'
            for k,c in m['clips'].items():
                z.write(out/c['sheet'],f'{who}/{c["sheet"]}')
                for i in range(c['count']):z.write(out/f'{k}-{i:02}.png',f'{who}/cells/{k}-{i:02}.png')
            z.writestr(f'{who}/specials.json',json.dumps(m,indent=2))
        for k,c in transition.items():z.write(ROOT/f'public/sprites/the-world/{c["sheet"]}',f'the-world/{c["sheet"]}')
        z.writestr('the-world/special-transitions.json',json.dumps(transition,indent=2))
        for file in ['dio-specials.json','dio-special-moves.json','the-world-special-actions.json']:z.write(ROOT/f'src/data/{file}',file)
        for file in ['dio-specials.png','dio-specials.json']:z.write(ROOT/f'public/sprites/fx/{file}','fx/'+file)
    protect();print(json.dumps(dict(dioClips=len(dm['clips']),dioFrames=sum(c['count'] for c in dm['clips'].values()),
      worldClips=len(wm['clips']),worldFrames=sum(c['count'] for c in wm['clips'].values()),bridges=len(transition))))

if __name__=='__main__':build()
