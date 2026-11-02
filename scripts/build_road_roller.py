"""Additive Road Roller pixel-art production. No approved image is rewritten."""
from pathlib import Path
import json,hashlib,copy,math,zipfile
from PIL import Image,ImageDraw
from build_stand_normals import AttackRig,render,dio_commands,world_definitions
from revise_dio_movement import interpolate
from build_dio_specials import definitions as special_definitions

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/'src/data/road-roller.json').read_text())

def protect():
    file=ROOT/'art/dio/road-preservation.json'
    if not file.exists():
        images={}
        for who in ['samurai','dio','the-world','fx']:
            for f in (ROOT/f'public/sprites/{who}').glob('*.png'):
                images[str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
        data=dict(images=images,clips={who:json.loads((ROOT/f'src/data/{who}-animations.json').read_text())['clips'] for who in ['dio','the-world']},
          data={name:hashlib.sha256((ROOT/'src/data'/name).read_bytes()).hexdigest() for name in ['samurai.json','dio.json','dio-specials.json','dio-special-moves.json','the-world-special-actions.json']})
        file.write_text(json.dumps(data,indent=2)+'\n')
    data=json.loads(file.read_text())
    for f,h in data['images'].items():assert hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h,f
    for who,clips in data['clips'].items():
        now=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())['clips']
        for key,clip in clips.items():assert now[key]==clip,key
    for name,h in data['data'].items():assert hashlib.sha256((ROOT/'src/data'/name).read_bytes()).hexdigest()==h,name

def definitions():
    dbase=dio_commands();wbase=world_definitions();dio={};world={}
    def add(dest,key,label,poses,durations,contacts=None,loop=False):dest[key]=dict(label=label,poses=poses,durations=durations,contacts=contacts or {},loop=loop)
    idle=dbase['commandRelaxed']['poses'][0]
    def dp(**kw):return {**idle,**kw}
    wb=wbase['quickPunch']['poses'][0]
    def wp(**kw):return {**wb,**kw}
    add(dio,'roadUltimateStart','Ultimate Start',[
      dp(lean=l,hip=h,farTarget=t,farWrist=w,pointing=True,nearHand=n,cloth=c,hair=i%3-1)
      for i,(l,h,t,w,n,c) in enumerate([(-1,0,[152,145],0,[0,0],0),(-3,1,[151,138],-20,[1,-2],-1),
      (-5,1,[153,128],-35,[2,-4],-2),(-3,0,[159,124],-20,[2,-3],1),
      (1,-1,[165,128],0,[1,-2],3),(2,0,[161,134],5,[0,-1],1)])],[4]*6)
    prep=[]
    for hip,lean,n,f,na,fa,cloth in [(3,-1,[111,146],[153,140],[106,211],[146,211],0),(12,3,[112,149],[153,144],[107,211],[148,211],-1),
      (24,8,[117,156],[158,149],[108,211],[150,211],-2),(16,5,[116,139],[159,132],[110,210],[149,210],1),
      (-3,0,[112,122],[158,115],[112,204],[147,202],3)]:
        prep.append(dp(hip=hip,lean=lean,nearTarget=n,farTarget=f,nearAnkle=na,farAnkle=fa,
          nearKnee=[146,193],farKnee=[174,185],cloth=cloth))
    add(dio,'roadFlyingPreparation','Flying Preparation',prep,[3,3,3,3,4])
    flight=[]
    for i,(hip,l,na,fa,n,f) in enumerate([(-2,-7,[115,194],[146,190],[111,123],[157,114]),(-4,-11,[119,185],[147,181],[110,119],[159,108]),
      (-5,-15,[126,180],[151,174],[112,116],[162,104]),(-4,-18,[131,182],[152,171],[116,113],[165,103]),
      (-2,-14,[126,184],[149,176],[113,115],[161,106]),(-3,-10,[120,188],[147,181],[110,120],[158,110]),
      (-4,-8,[117,191],[146,185],[109,123],[156,114]),(-3,-9,[118,187],[147,182],[110,121],[157,111])]):
        flight.append(dp(hip=hip,lean=l,nearAnkle=na,farAnkle=fa,nearTarget=n,farTarget=f,
          nearKnee=[155,174],farKnee=[174,169],cloth=(i%4)-2,hair=(i%3)-1,support=[]))
    add(dio,'roadFlyingUp','Flying Up',flight,[3]*8,loop=True)
    returning=[]
    for i,(h,l,na,fa,n,f) in enumerate([(4,10,[115,183],[149,181],[129,160],[167,156]),(7,16,[119,182],[151,178],[133,169],[173,164]),
      (10,21,[125,184],[154,179],[137,176],[179,170]),(8,19,[123,187],[152,184],[135,172],[177,168]),
      (5,14,[118,191],[150,189],[131,165],[171,163]),(8,17,[121,185],[151,181],[133,170],[175,166])]):
        returning.append(dp(hip=h,lean=l,nearAnkle=na,farAnkle=fa,nearTarget=n,farTarget=f,
          nearKnee=[160,165],farKnee=[178,162],nearWrist=40,farWrist=40,cloth=i%3-1,support=[]))
    add(dio,'roadReturning','Returning With Road Roller',returning,[5]*6,loop=True)
    perched=[dp(lean=l,hip=h,farTarget=f,pointing=True,nearHand=n,cloth=c,hair=i%3-1)
      for i,(l,h,f,n,c) in enumerate([(-2,0,[154,139],[0,-1],0),(-3,-1,[157,135],[1,-2],-1),(-4,-1,[160,132],[2,-2],-2),
      (-2,-.5,[159,134],[1,-1],1),(0,0,[156,138],[0,0],2),(-1,.4,[154,141],[-1,0],1)])]
    add(dio,'roadRollerPose','Road Roller Pose',perched,[5]*6,loop=True)
    impact=[interpolate(prep[2],perched[0],u) for u in [0,.25,.65,1]]
    add(dio,'roadImpactPose','Absorção do impacto',impact,[3,4,4,5])
    finish=[]
    for i,u in enumerate([0,.15,.3,.5,.7,.85,.95,1]):
        p=interpolate(returning[2],idle,u);p['cloth']=i%4-2;p['hair']=(i%3)-1;p['support']=[];finish.append(p)
    add(dio,'roadUltimateFinish','Ultimate Finish',finish,[5]*8)
    ret=[interpolate(perched[1],idle,u) for u in [0,.25,.5,.75,1]]
    add(dio,'roadReturnIdle','Return to Idle',ret,[3]*5)
    # Initial move is a command; the Stand alone provides the confirm strike.
    add(dio,'road_roller','Road Roller / golpe inicial',dio['roadUltimateStart']['poses'],[10,10,10,12,12,12])
    start=[wp(lean=l,hip=h,nearTarget=n,farTarget=f,nearAnkle=a,farAnkle=[142,191],cloth=c)
      for l,h,n,f,a,c in [(-3,0,[121,121],[150,119],[102,197],0),(-7,2,[125,116],[148,113],[104,195],-1),
      (-10,3,[128,111],[147,106],[106,192],-2),(-6,0,[126,108],[154,100],[107,190],1),
      (-2,-2,[122,110],[160,97],[109,187],2),(1,-1,[119,116],[156,108],[106,192],1)]]
    add(world,'roadUltimateStart','Ultimate Start',start,[4]*6)
    strike=start[:4]+[wp(lean=3,nearTarget=[126,117],farTarget=[169,114],nearAnkle=[108,192],cloth=2),
      wp(lean=21,x=8,nearTarget=[122,124],farTarget=[199,132],nearAnkle=[114,189],farAnkle=[140,187],cloth=4),
      wp(lean=24,x=10,nearTarget=[120,127],farTarget=[201,137],nearAnkle=[115,191],farAnkle=[140,189],cloth=3),
      wp(lean=9,x=3,nearTarget=[119,121],farTarget=[168,125],cloth=1),wp(lean=1,nearTarget=[116,123],farTarget=[154,121],cloth=-1)]
    add(world,'roadStrike','Super / primeiro contato',strike,[6,5,5,5,5,2,2,4,6],{5:('far',0),6:('far',0)})
    add(world,'roadFlyingPreparation','Impulso do Stand',[
      wp(hip=h,lean=l,nearTarget=n,farTarget=f,nearAnkle=a,farAnkle=b,nearKnee=[158,173],farKnee=[178,167],cloth=c)
      for h,l,n,f,a,b,c in [(4,-4,[121,125],[153,123],[107,194],[144,190],0),(13,-9,[127,134],[156,129],[113,196],[146,191],-1),
      (23,-13,[132,141],[161,135],[120,195],[150,189],-2),(9,-6,[126,117],[160,106],[114,185],[146,181],1),
      (-5,0,[121,99],[160,90],[110,178],[142,174],3)]],[3,3,3,3,4])
    up=[]
    for i,p in enumerate(flight):
        up.append(wp(lean=p['lean']*.8,hip=p['hip']-3,nearAnkle=[p['nearAnkle'][0]-4,p['nearAnkle'][1]-5],
          farAnkle=[p['farAnkle'][0]-3,p['farAnkle'][1]-7],nearTarget=[121+i%3,100-i%4],farTarget=[160+i%3,92-i%4],
          nearKnee=[160,163],farKnee=[179,158],cloth=i%4-2))
    add(world,'roadFlyingUp','Flying Up',up,[3]*8,loop=True)
    carry=[]
    for i,(h,l,x,n,f,na,fa) in enumerate([(15,14,5,[135,160],[177,154],[111,184],[145,181]),(20,19,8,[140,169],[184,163],[115,181],[146,177]),
      (25,24,10,[145,175],[189,170],[120,184],[149,179]),(22,21,8,[142,171],[185,166],[117,188],[147,183]),
      (17,16,6,[137,163],[180,157],[112,191],[145,187]),(21,20,8,[141,170],[184,164],[116,185],[146,180])]):
        carry.append(wp(hip=h,lean=l,x=x,nearTarget=n,farTarget=f,nearAnkle=na,farAnkle=fa,
          nearKnee=[166,165],farKnee=[181,162],nearWrist=45,farWrist=45,cloth=i%3-1))
    add(world,'roadCarrying','Carrying Road Roller',carry,[5]*6,loop=True)
    def punch(side,amount,variant=0):
        # Whole shoulder/hip follows the alternating fist down into the roof.
        p=wp(hip=10+amount*22,lean=-5+amount*31,x=amount*(12 if side=='far' else 26),
          nearAnkle=[110+round(amount*9),181+round(amount*7)],farAnkle=[143,176+round(amount*7)],
          nearKnee=[165,163],farKnee=[183,160],cloth=(variant%4)-2)
        p['nearTarget']=[127+amount*(37 if side=='near' else 0),119+amount*(60 if side=='near' else 15)]
        p['farTarget']=[151+amount*(35 if side=='far' else 0),112+amount*(67 if side=='far' else 18)]
        p[side+'Wrist']=45+amount*20;p['hip']+=variant*.2
        return p
    first=[punch('far',v,i) for i,v in enumerate([0,.3,1,.6,.1])]
    add(world,'roadFirstPunch','First Punch',first,[5,5,2,4,4],{2:('far',0)})
    add(world,'roadReposition','Reposicionamento após impacto',[
      interpolate(carry[-1],first[0],u) for u in [0,.25,.5,.75,1]],[3,3,3,3,4])
    alternating=[punch(side,v,i) for i,(side,v) in enumerate([('near',0),('near',.5),('near',1),('near',.3),('far',.5),('far',1),('far',.4),('far',.1)])]
    add(world,'roadAlternating','Alternating Punches',alternating,[2]*8,{2:('near',0),5:('far',1)},loop=True)
    barrage=[];times=[];contacts={};clock=0
    for i,hit in enumerate(CFG['punchTicks']):
        local=hit-CFG['phases']['barrage'];side='far' if i%2==0 else 'near'
        if local>clock:barrage.append(punch(side,.2,i));times.append(local-clock);clock=local
        contacts[len(barrage)]=(side,i);barrage.append(punch(side,1,i));times.append(2);clock+=2
        next_start=(CFG['punchTicks'][i+1]-CFG['phases']['barrage']) if i+1<len(CFG['punchTicks']) else CFG['phases']['finisher']-CFG['phases']['barrage']
        if next_start>clock:barrage.append(punch(side,.45,i));times.append(next_start-clock);clock=next_start
    add(world,'roadBarrage','Rapid Punch Barrage',barrage,times,contacts)
    final=[punch('far',v,15+i) for i,v in enumerate([0,.15,.5,.8,1,1,.6,.2])]
    final[0]['farTarget']=[163,81];final[1]['farTarget']=[165,75];final[2]['farTarget']=[174,117]
    add(world,'roadFinalHeavy','Final Heavy Punch',final,[1,1,1,1,2,1,1,2],{4:('far',0),5:('far',0)})
    recovery=[interpolate(final[-1],wb,u) for u in [0,.2,.4,.6,.8,1]]
    add(world,'roadUltimateRecovery','Ultimate Recovery',recovery,[5]*6)
    ret=[{**p,'cloth':p.get('cloth',0)+.2} for p in wbase['returnBehind']['poses']]
    add(world,'roadReturnBehind','Return Behind Dio',ret,[4]*5)
    return dio,world

def export_character(who,defs):
    out=ROOT/f'public/sprites/{who}';rig=AttackRig(who);data=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())
    manifest=dict(id=who,cell=[256,256],pivot={'x':128,'y':224},clips={})
    grounded={'roadUltimateStart','roadFlyingPreparation','roadRollerPose','roadImpactPose','roadReturnIdle','road_roller'}
    for key,c in defs.items():
        frames=[];poses=[]
        for i,p in enumerate(c['poses']):
            im,g=render(rig,p,who=='dio' and key in grounded);contact=c['contacts'].get(i)
            frames.append(im);poses.append(dict(ticks=c['durations'][i],phase='active' if contact else 'cinematic',hitboxes=[g['surfaces'][contact[0]]] if contact else [],hitId=contact[1] if contact else -1,**g))
            im.save(out/f'{key}-{i:02}.png')
        assert len(set(f.tobytes() for f in frames))==len(frames),key
        sheet=Image.new('RGBA',(len(frames)*256,256))
        for i,im in enumerate(frames):sheet.paste(im,(i*256,0))
        sheet.save(out/f'{key}.png')
        prev=Image.new('RGBA',sheet.size,'#283944');prev.alpha_composite(sheet)
        prev.resize((prev.width*2,512),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
        frames[0].save(out/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in c['durations']],loop=0,disposal=0,blend=0)
        manifest['clips'][key]=dict(label=c['label'],sheet=key+'.png',count=len(frames),durations=c['durations'],loop=c['loop'],poses=poses,bounds=[f.getbbox() for f in frames])
        data['clips'][key]=dict(sheet=who+'/'+key+'.png',columns=len(frames),frames=list(range(len(frames))),ticks=c['durations'][0],durations=c['durations'],loop=c['loop'])
    (ROOT/f'src/data/{who}-animations.json').write_text(json.dumps(data,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(data,indent=2)+'\n')
    (out/'road-roller.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest

PAL={'ink':'#14151d','dark':'#2a2930','steel0':'#343d49','steel1':'#52606d','steel2':'#82929b','steel3':'#bac8cb','light':'#e4e8d1',
 'gold0':'#49321c','gold1':'#72501f','gold2':'#a36c20','gold3':'#cf952a','gold4':'#edbc46','gold5':'#ffe18a',
 'rubber':'#20232b','tread':'#3b414b','glass':'#29434b','glass2':'#476b72','rust':'#8b4c2e','red':'#b74332','shine':'#fff1ba'}
def roller(frame=0,state='base'):
    im=Image.new('RGBA',(384,256));d=ImageDraw.Draw(im);bend=[0,3,5,2,0,1][frame%6] if state in ['impact','punched'] else frame%2
    # Rear tyre, hand-cut treads and hub: distinct from the broad steel drum.
    d.ellipse((67,168,123,224),fill=PAL['ink']);d.ellipse((72,173,118,220),fill=PAL['rubber'])
    for a in range(0,360,30):
        rad=math.radians(a);x=round(95+math.cos(rad)*23);y=round(196+math.sin(rad)*23)
        d.rectangle((x-2,y-2,x+2,y+2),fill=PAL['tread'])
    d.ellipse((82,183,108,209),fill=PAL['gold1']);d.ellipse((86,186,105,205),fill=PAL['gold3']);d.ellipse((92,191,100,200),fill=PAL['steel1'])
    # Roller cylinder: broad steel tread, side face, axle and bevel bands.
    d.rectangle((222,165,314,221),fill=PAL['ink']);d.rectangle((222,168,314,218),fill=PAL['steel1'])
    d.ellipse((199,165,247,221),fill=PAL['ink']);d.ellipse((202,168,245,218),fill=PAL['steel0'])
    d.rectangle((224,169,314,216),fill=PAL['steel1']);d.rectangle((224,171,314,179),fill=PAL['steel3'])
    d.rectangle((224,180,314,191),fill=PAL['steel2']);d.rectangle((224,205,314,216),fill=PAL['steel0'])
    for x in [230,245,263,281,300]:d.line((x,173,x,215),fill=PAL['steel0']);d.line((x+1,174,x+1,212),fill=PAL['steel2'])
    d.ellipse((290,165,340,221),fill=PAL['ink']);d.ellipse((294,169,336,217),fill=PAL['steel2']);d.ellipse((299,174,332,213),fill=PAL['steel1'])
    d.arc((299,174,332,213),245,80,fill=PAL['light'],width=2);d.ellipse((310,184,324,203),fill=PAL['steel0']);d.rectangle((315,188,321,199),fill=PAL['gold2'])
    for y in [177+frame%3,190+frame%3,205+frame%3]:d.line((301,y,329,y-2),fill=PAL['steel0'])
    # Chassis, engine hood, vents, seams, bolts and warning stripes.
    def poly(points,color):d.polygon([(x,y+bend) for x,y in points],fill=PAL[color])
    poly([(53,143),(132,131),(212,144),(275,161),(269,186),(110,187),(55,172)],'ink')
    poly([(57,145),(132,135),(210,147),(270,163),(265,181),(111,182),(58,169)],'gold2')
    poly([(58,145),(132,136),(207,148),(122,160),(58,158)],'gold4')
    poly([(122,161),(209,150),(269,163),(265,177),(122,178)],'gold3')
    d.line([(60,146+bend),(130,138+bend),(206,149+bend)],fill=PAL['gold5'],width=2)
    d.rectangle((65,151+bend,115,168+bend),fill=PAL['gold0'])
    for x in range(70,113,7):d.line((x,153+bend,x,166+bend),fill=PAL['ink']);d.line((x+1,153+bend,x+1,164+bend),fill=PAL['gold2'])
    for x,y in [(60,164),(124,171),(145,165),(182,166),(210,170),(260,172)]:d.rectangle((x,y+bend,x+2,y+2+bend),fill=PAL['gold5']);d.point((x+1,y+1+bend),fill=PAL['steel0'])
    for x in range(134,204,14):poly([(x,173),(x+6,173),(x+1,180),(x-5,180)],'ink')
    # Open cab, seat, roll cage, hinged steering column and overhanging roof.
    poly([(134,99),(213,99),(220,150),(132,153)],'ink');poly([(140,104),(207,104),(211,143),(139,147)],'glass')
    poly([(143,108),(162,108),(156,137),(142,141)],'glass2')
    poly([(161,126),(177,126),(180,145),(163,146)],'dark');poly([(158,123),(175,123),(178,131),(160,132)],'rubber')
    d.line((192,133+bend,201,146+bend),fill=PAL['steel3'],width=3);d.ellipse((185,127+bend,202,135+bend),outline=PAL['ink'],width=2)
    poly([(132,97),(140,97),(140,151),(131,153)],'gold3');poly([(207,98),(214,101),(220,153),(212,150)],'gold2')
    d.line((135,102+bend,135,147+bend),fill=PAL['gold5'],width=2);d.line((210,105+bend,215,148+bend),fill=PAL['gold4'],width=2)
    poly([(126,92),(206,89),(221,96),(217,103),(128,102)],'ink');poly([(129,94),(206,92),(217,97),(215,100),(130,99)],'gold4')
    d.line((130,94+bend,205,92+bend),fill=PAL['gold5'],width=2)
    d.rectangle((76,107+bend,83,139+bend),fill=PAL['ink']);d.rectangle((78,110+bend,81,136+bend),fill=PAL['steel1']);d.rectangle((74,105+bend,85,111+bend),fill=PAL['steel0'])
    # Articulated front yoke and hydraulic piston.
    poly([(231,158),(246,155),(293,181),(288,194),(273,191)],'ink');poly([(237,160),(245,160),(288,183),(285,190),(276,187)],'gold4')
    d.line((249,166+bend,277,184+bend),fill=PAL['steel0'],width=5);d.line((249,165+bend,276,182+bend),fill=PAL['steel3'],width=2)
    d.ellipse((279,182+bend,290,193+bend),fill=PAL['gold1']);d.point((284,186+bend),fill=PAL['gold5'])
    d.rectangle((122,148+bend,129,153+bend),fill=PAL['shine']);d.rectangle((62,169+bend,67,173+bend),fill=PAL['red'])
    if state in ['impact','punched','explosion']:
        level=frame if state!='punched' else frame+2
        for i in range(level+1):
            x=150+i*17%69;y=112+i*11%45
            d.line([(x,y+bend),(x-3,y+6+bend),(x+2,y+10+bend),(x-4,y+16+bend)],fill=PAL['ink'],width=1)
        for i in range(level):d.line((115+i*11,161+bend,121+i*11,164+bend),fill=PAL['rust'],width=2)
        if state=='punched':
            for i in range(level):d.line([(300+i*3%24,177),(303+i*3%24,181+i%5),(299+i*3%24,186+i%4)],fill=PAL['steel0'])
    if state=='explosion':
        # Split actual machine regions apart; expose bent panels and broken
        # cab, rather than scaling/rotating the whole intact drawing.
        source=im.copy();im=Image.new('RGBA',im.size)
        pieces=[(48,130,130,185),(125,85,225,155),(130,150,225,189),(198,162,273,225),(273,156,344,225),(63,167,126,226)]
        for i,b in enumerate(pieces):
            dx=round((i-2.5)*frame*3);dy=-frame*(7 if i%2 else 4)+frame*frame//3
            dx=max(4-b[0],min(380-b[2],dx));dy=max(4-b[1],min(252-b[3],dy))
            im.alpha_composite(source.crop(b),(b[0]+dx,b[1]+dy))
        d=ImageDraw.Draw(im)
        for i in range(12):
            x=192+round(math.cos(i*2.4)*(24+frame*12));y=151+round(math.sin(i*2.4)*(18+frame*8))-frame*3
            d.rectangle((x,y,x+3+i%3,y+2),fill=PAL['gold4'] if i%2 else PAL['steel2'])
    return im

def atlas_export(who,defs,cell,pivot):
    out=ROOT/f'public/sprites/{who}';out.mkdir(parents=True,exist_ok=True)
    data=dict(sheet=who+'/roadBase.png' if who=='road-roller' else who+'/explosion.png',frameWidth=cell[0],frameHeight=cell[1],pivot=pivot,clips={})
    manifest=dict(id=who,cell=cell,pivot=pivot,clips={})
    for key,frames,times,loop in defs:
        sheet=Image.new('RGBA',(len(frames)*cell[0],cell[1]))
        for i,f in enumerate(frames):sheet.paste(f,(i*cell[0],0));f.save(out/f'{key}-{i:02}.png')
        sheet.save(out/f'{key}.png');data['clips'][key]=dict(sheet=who+'/'+key+'.png',columns=len(frames),frames=list(range(len(frames))),ticks=times[0],durations=times,loop=loop)
        manifest['clips'][key]=dict(sheet=key+'.png',count=len(frames),durations=times,loop=loop,bounds=[f.getbbox() for f in frames])
        prev=Image.new('RGBA',sheet.size,'#283944');prev.alpha_composite(sheet);prev.resize((prev.width*2,prev.height*2),Image.Resampling.NEAREST).save(out/f'{key}-preview.png')
    (out/'animations.json').write_text(json.dumps(data,indent=2)+'\n');(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return data,manifest

def effects():
    out=[]
    def cloud(key,count,kind):
        frames=[]
        for i in range(count):
            im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im)
            if kind=='explosion':
                radius=12+i*10 if i<7 else 90+(i-7)*3
                for layer,color in enumerate(['#542735','#a43d32','#e56b32','#f5ad43','#ffe191','#fff2ce']):
                    r=max(3,radius-layer*9)
                    pts=[]
                    for k in range(28):
                        a=k*math.pi/14;rr=r*(.64 if (k+i)%5==0 else .83 if k%3==0 else 1)
                        pts.append((round(128+math.cos(a)*rr),round(140+math.sin(a)*rr*.85)))
                    d.polygon(pts,fill=color)
                # Uneven fire lobes and hot cores break the regular star shape.
                for k in range(7):
                    a=k*2.4+i*.08;x=round(128+math.cos(a)*radius*.48);y=round(140+math.sin(a)*radius*.45)
                    r=max(3,round(radius*.22));d.polygon([(x-r,y),(x-r//2,y-r),(x+r//2,y-r+2),(x+r,y),(x+r//2,y+r),(x-r//2,y+r-2)],fill='#ffe191' if k%2 else '#fff2ce')
                for k in range(18):
                    a=k*2.4;rr=radius+8+k%4*4;x=round(128+math.cos(a)*rr);y=round(140+math.sin(a)*rr*.85)
                    d.rectangle((x,y,x+2,y+3),fill='#f5ad43')
            elif kind in ['dust','smoke']:
                pal=['#2f3342','#53525a','#77706b','#a79a7e'] if kind=='dust' else ['#242b38','#3d4653','#5d6570','#858881']
                for k in range(9):
                    x=128+round(math.cos(k*2.4)*(16+i*(10 if kind=='dust' else 8)))
                    y=216-i-k%3*3 if kind=='dust' else 184-round(abs(math.sin(k*2.4))*(8+i*5))-i*2
                    rx=max(4,12+i*2-k%3*2);ry=5+i%3 if kind=='dust' else max(5,14+i-k%3*2-max(0,i-7)*3)
                    for j,color in enumerate(pal):
                        xx=max(2,rx-j*2);yy=max(2,ry-j)
                        pts=[(round(x+math.cos(a*math.pi/6)*xx*(.8 if (a+k)%3==0 else 1)),round(y+math.sin(a*math.pi/6)*yy)) for a in range(12)]
                        d.polygon(pts,fill=color)
                for k in range(20):
                    x=(37*k+i*13)%250;y=(205-k%4*5-i*3) if kind=='dust' else 90+(k*23+i*9)%130
                    d.rectangle((x,y,x+2,y+2),fill=pal[1])
            elif kind=='speed':
                for k in range(18):
                    x=(k*37+i*17)%250;y=(k*23+i*31)%230
                    d.line((x,y,x+(k%3-1)*2,min(255,y+15+k%5*8)),fill='#e4e8d1' if k%3==0 else '#cf952a',width=1+k%2)
            else:
                r=15+i*13;points=[]
                for k in range(16):
                    a=k*math.pi/8;rr=r if k%2==0 else r*.23
                    points.append((round(128+math.cos(a)*rr),round(128+math.sin(a)*rr)))
                d.polygon(points,fill='#fff2ce');d.ellipse((120,120,136,136),fill='#ffffff')
            frames.append(im)
        return frames
    for key,count,kind,times in [('impactFlash',5,'flash',[1,1,2,2,2]),('dust',8,'dust',[3]*8),('smoke',10,'smoke',[4]*10),
      ('speedLines',6,'speed',[2]*6),('explosion',12,'explosion',[2]*12),('finalImpact',6,'flash',[1,1,2,2,2,2])]:
        out.append((key,cloud(key,count,kind),times,key=='speedLines'))
    data,manifest=atlas_export('road-fx',out,[256,256],{'x':128,'y':224})
    for key in ['impactFlash','finalImpact']:data['clips'][key]['pivot']={'x':128,'y':128}
    data['clips']['explosion']['pivot']={'x':128,'y':140}
    (ROOT/'public/sprites/road-fx/animations.json').write_text(json.dumps(data,indent=2)+'\n')
    return data,manifest

def transitions(world):
    normal=world_definitions();special=special_definitions()[1];out=ROOT/'public/sprites/the-world';rig=AttackRig('the-world');entries={}
    sources={k:(v, list(v['contacts'])) for k,v in normal.items() if k in ['quickPunch','straightPunch','heavyPunch','lowPunch','lowSweep','uppercut']}
    for key in ['mudaLight','mudaMedium','mudaHeavy']:
        c=special[key];sources[key]=(c,[max(c['contacts'])])
    for source,(c,indices) in sources.items():
      for index in indices:
        frames=[];poses=[]
        for u in [0,.25,.5,.75,1]:
            im,g=render(rig,interpolate(c['poses'][index],world['roadStrike']['poses'][0],u),False)
            if frames and frames[-1].tobytes()==im.tobytes():continue
            frames.append(im);poses.append(dict(ticks=1,phase='transition',hitboxes=[],hitId=-1,**g))
        key=f'bridge_{source}_{index}_roadStrike';sheet=Image.new('RGBA',(256*len(frames),256))
        for i,f in enumerate(frames):sheet.paste(f,(i*256,0))
        sheet.save(out/f'{key}.png');entries[key]=dict(sheet=key+'.png',count=len(frames),durations=[1]*len(frames),poses=poses)
    data=json.loads((ROOT/'src/data/the-world-animations.json').read_text())
    for key,c in entries.items():data['clips'][key]=dict(sheet='the-world/'+c['sheet'],columns=c['count'],frames=list(range(c['count'])),ticks=1,durations=c['durations'],loop=False)
    (ROOT/'src/data/the-world-animations.json').write_text(json.dumps(data,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(data,indent=2)+'\n');(out/'road-transitions.json').write_text(json.dumps(entries,indent=2)+'\n')
    return entries

def build():
    protect();dio,world=definitions();dm=export_character('dio',dio);wm=export_character('the-world',world)
    obj,om=atlas_export('road-roller',[
      ('roadBase',[roller(0)],[1],False),('roadFalling',[roller(i,'fall') for i in range(5)],[6]*5,False),
      ('roadImpact',[roller(i,'impact') for i in range(5)],[2,2,3,4,5],False),
      ('roadPunched',[roller(i,'punched') for i in range(6)],[4]*6,False),
      ('roadExplosion',[roller(i,'explosion') for i in range(8)],[3]*8,False)], [384,256],{'x':192,'y':224})
    fx,fm=effects()
    (ROOT/'src/data/road-roller-object.json').write_text(json.dumps(obj,indent=2)+'\n')
    (ROOT/'src/data/road-roller-fx.json').write_text(json.dumps(fx,indent=2)+'\n')
    move=dict(super=True,kind='roadRoller',startup=CFG['startup'],active=CFG['active'],recovery=CFG['recovery'],cost=CFG['cost'],damage=CFG['initialDamage'],
      stun=44,blockstun=18,push=1,launch=0,level='mid',rank=5,cancels=[],meterGain=0,hitstop=8,box={'x':0,'y':0,'w':0,'h':0},poses=dm['clips']['road_roller']['poses'],
      hitWindows=[dict(id=0,fromTick=26,toTick=30)],stand=dict(approachAt=0,approachTicks=24,punchAt=0,recoverAt=40,returnAt=66,returnTicks=16,
      front={'x':110,'y':-12},clip='roadStrike',recoveryClip='roadUltimateRecovery',returnClip='roadReturnBehind',bridgeTicks=4))
    (ROOT/'src/data/dio-super-moves.json').write_text(json.dumps({'road_roller':move},indent=2)+'\n')
    bridges=transitions(world)
    (ROOT/'src/data/the-world-super-actions.json').write_text(json.dumps({**wm['clips'],**bridges},indent=2)+'\n')
    for who,data in [('dio',dio),('the-world',world)]:
        (ROOT/f'art/{who}/road-rig.json').write_text(json.dumps(data,indent=2)+'\n')
    qa=ROOT/'art/dio/qa/road-roller';qa.mkdir(parents=True,exist_ok=True)
    (ROOT/'public/sprites/road-roller/palette.json').write_text(json.dumps(list(PAL.values()),indent=2)+'\n')
    with zipfile.ZipFile(ROOT/'public/downloads/road-roller.zip','w',zipfile.ZIP_DEFLATED) as z:
        for who,m,file in [('dio',dm,'road-roller.json'),('the-world',wm,'road-roller.json'),('road-roller',om,'manifest.json'),('road-fx',fm,'manifest.json')]:
            out=ROOT/f'public/sprites/{who}';z.write(out/file,f'{who}/{file}')
            for k,c in m['clips'].items():
                z.write(out/c['sheet'],f'{who}/{c["sheet"]}')
                for i in range(c['count']):z.write(out/f'{k}-{i:02}.png',f'{who}/cells/{k}-{i:02}.png')
        for f in ['road-roller.json','road-roller-object.json','road-roller-fx.json','dio-super-moves.json','the-world-super-actions.json']:z.write(ROOT/f'src/data/{f}',f)
        for key,c in bridges.items():z.write(ROOT/f'public/sprites/the-world/{c["sheet"]}',f'the-world/{c["sheet"]}')
        z.writestr('the-world/road-transitions.json',json.dumps(bridges,indent=2))
    protect();print(json.dumps({who:{'clips':len(m['clips']),'cells':sum(c['count'] for c in m['clips'].values())} for who,m in [('dio',dm),('the-world',wm),('object',om),('fx',fm)]}))

if __name__=='__main__':build()
