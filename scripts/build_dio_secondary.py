"""Additive reactions and personality poses, drawn with the approved pixel rigs."""
from pathlib import Path
import json,hashlib,math,zipfile,copy
import numpy as np
from PIL import Image,ImageDraw
from build_stand_normals import AttackRig,render,dio_commands,world_definitions
from revise_dio_movement import dio_specs,interpolate
from build_linked_movement import rigid,warp,point

ROOT=Path(__file__).resolve().parents[1];PIVOT={'x':128,'y':224}
def protect():
    file=ROOT/'art/dio/secondary-preservation.json'
    if not file.exists():
        data={'images':{},'clips':{},'data':{}}
        for who in ['samurai','dio','the-world','fx','road-roller','road-fx']:
            for f in (ROOT/f'public/sprites/{who}').glob('*.png'):data['images'][str(f.relative_to(ROOT))]=hashlib.sha256(f.read_bytes()).hexdigest()
        for who in ['dio','the-world']:data['clips'][who]=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())['clips']
        for name in ['samurai.json','dio.json','dio-special-moves.json','dio-super-moves.json']:
            data['data'][name]=hashlib.sha256((ROOT/f'src/data/{name}').read_bytes()).hexdigest()
        file.write_text(json.dumps(data,indent=2)+'\n')
    data=json.loads(file.read_text())
    for f,h in data['images'].items():assert hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h,f
    for who,clips in data['clips'].items():
        now=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())['clips']
        for k,c in clips.items():assert now[k]==c,k
    for name,h in data['data'].items():assert hashlib.sha256((ROOT/f'src/data/{name}').read_bytes()).hexdigest()==h,name

EXPRESSIONS=['neutral','smirk','anger','challenge','surprise','victory','pain','closed']
def face(head,expression):
    """Edit native eye/brow/mouth pixels, keeping head silhouette and hair."""
    im=head.copy();d=ImageDraw.Draw(im)
    # Face coordinates are the same as the approved source, before headOffset.
    skin='#e7a776';shade='#92513c';dark='#63342b';ink='#141621';light='#ffe3b8'
    patches={
      'neutral':[(137,113,ink),(138,113,shade),(139,114,light),(140,114,ink),(138,121,dark),(139,121,shade)],
      'smirk':[(137,112,ink),(138,113,ink),(139,114,light),(140,114,ink),(138,121,dark),(139,121,light),(140,120,dark),(141,120,shade)],
      'anger':[(136,112,ink),(137,113,ink),(138,114,ink),(139,115,light),(140,115,ink),(138,121,dark),(139,121,light),(140,121,light),(140,122,dark)],
      'challenge':[(137,111,ink),(138,112,ink),(139,113,light),(140,113,ink),(138,121,dark),(139,122,light),(140,121,dark)],
      'surprise':[(137,111,shade),(138,111,ink),(139,113,light),(140,113,light),(139,114,ink),(140,114,ink),(138,121,dark),(139,121,dark),(138,122,dark),(139,122,shade)],
      'victory':[(137,112,ink),(138,113,ink),(139,114,light),(140,114,ink),(137,121,shade),(138,121,dark),(139,121,light),(140,121,light),(141,120,dark)],
      'pain':[(137,113,shade),(138,114,ink),(139,114,ink),(140,114,shade),(138,121,dark),(139,121,light),(140,121,light),(139,122,dark)],
      'closed':[(137,113,skin),(138,114,ink),(139,114,ink),(140,114,shade),(138,121,dark),(139,121,shade),(140,121,skin)]}
    for x,y,color in patches[expression]:d.point((x-7,y-7),fill=color)
    return im

def definitions():
    dio={};world={};base=dio_commands()['commandRelaxed']['poses'][0];wb=world_definitions()['quickPunch']['poses'][0]
    def dp(**kw):return {**base,**kw}
    def wp(**kw):return {**wb,**kw}
    def add(dest,key,label,poses,times,loop=False,ground=True):dest[key]=dict(label=label,poses=poses,durations=times,loop=loop,grounded=ground)
    def d(key,label,poses,times,loop=False,ground=True):add(dio,'secondary'+key,label,poses,times,loop,ground)
    def w(key,label,poses,times,loop=False):add(world,'secondary'+key,label,poses,times,loop,False)
    guard=dict(nearTarget=[139,129],farTarget=[154,123],nearWrist=-35,farWrist=-25,lean=-5,expression='neutral')
    d('GuardStand','Defesa em pé',[dp(**{**guard,'hip':h,'nearTarget':[139,129+h],'farTarget':[154,123+h],'cloth':i%3-1}) for i,h in enumerate([0,-1,-.5,.6])],[9]*4,True)
    crouch=dio_specs()['crouchIdle']['poses'][0]
    cg={**crouch,'nearTarget':[138,157],'farTarget':[154,150],'nearWrist':-25,'farWrist':-15,'expression':'neutral'}
    d('GuardCrouch','Defesa agachada',[{**cg,'hip':31+h,'nearTarget':[138,157+h],'farTarget':[154,150+h],'cloth':i%3-1} for i,h in enumerate([0,-1,.5,1.6])],[9]*4,True)
    for suffix,g in [('Stand',guard),('Crouch',cg)]:
        ps=[]
        for i,(lean,x,hand) in enumerate([(-12,-2,-3),(-9,-1,-2),(-5,0,0)]):
            ps.append(dp(**{**g,'lean':lean,'x':g.get('x',0)+x,'nearTarget':[g['nearTarget'][0]+hand,g['nearTarget'][1]],'cloth':-2+i,'expression':'anger' if i==0 else 'neutral'}))
        d('GuardImpact'+suffix,'Impacto na defesa '+suffix,ps,[2,2,2])
    for key,label,leans in [('DamageLight','Dano leve',[-6,-10,-7,-2]),('DamageMedium','Dano médio',[-7,-16,-22,-14,-5]),('DamageHeavy','Dano forte',[-8,-20,-32,-28,-19,-7])]:
        d(key,label,[dp(lean=l,hip=min(i,4),nearTarget=[114+i,151+i],farTarget=[145-i,146+i],nearWrist=-i*4,farWrist=12+i*3,cloth=-i,hair=(i%3)-1,expression='surprise' if i==0 else 'pain') for i,l in enumerate(leans)],[3]*len(leans))
    d('DamageCrouch','Dano agachado',[{**cg,'hip':31+h,'lean':l,'nearTarget':[126,162+h],'farTarget':[150,161+h],'expression':'surprise' if i==0 else 'pain','cloth':-i} for i,(h,l) in enumerate([(0,-4),(4,-12),(3,-17),(1,-6)])],[4]*4)
    air=dio_specs()['jumpApex']['poses'][0]
    d('DamageAir','Dano aéreo',[{**air,'lean':l,'nearTarget':[112+i,140],'farTarget':[151,137+i],'roll':r,'expression':'surprise' if i==0 else 'pain','cloth':-i} for i,(l,r) in enumerate([(-5,-3),(-12,-9),(-17,-14),(-9,-8)])],[4]*4,False,False)
    d('Launched','Lançado para cima',[{**air,'lean':-10-i*3,'nearAnkle':[120+i*2,189-i],'farAnkle':[143,197-i*2],'nearTarget':[111,135+i],'farTarget':[151,127+i],'roll':-6-i*5,'cloth':3+i,'expression':'pain'} for i in range(4)],[4]*4,False,False)
    d('Falling','Queda',[{**air,'lean':-9+i,'nearAnkle':[118-i,191+i*2],'farAnkle':[147+i,199+i],'nearTarget':[110+i*2,142+i],'farTarget':[154-i,139+i],'roll':-20-i*6,'cloth':2-i,'expression':'pain'} for i in range(4)],[4]*4,True,False)
    floor=dp(hip=0,lean=-2,nearAnkle=[110,204],farAnkle=[147,211],nearTarget=[119,151],farTarget=[151,154],roll=-90,expression='closed')
    d('Downed','Derrubado',[{**floor,'nearTarget':[119,151+i%2],'farTarget':[151,154-i%2],'cloth':i%3-1,'hair':i%2} for i in range(4)],[6]*4,True)
    getup=[]
    for i,(r,h,l,nt,ft) in enumerate([(-90,0,-2,[119,151],[151,154]),(-77,8,4,[117,157],[153,160]),(-54,19,9,[117,166],[155,163]),(-30,29,10,[123,172],[154,166]),(-8,21,6,[127,167],[151,159]),(0,9,3,[121,162],[151,154]),(0,0,0,[115,160],[150,151])]):
        getup.append(dp(roll=r,hip=h,lean=l,nearTarget=nt,farTarget=ft,nearAnkle=[106,211],farAnkle=[146,214],cloth=i%3-1,expression='anger' if i<5 else 'neutral'))
    d('Getup','Levantando',getup,[3,3,3,3,3,3,4])
    d('Grabbed','Agarrado',[dp(lean=l,hip=i%3,nearTarget=[118+i,139+i*2],farTarget=[149-i,137+i],nearWrist=-20,cloth=-i,expression='surprise' if i<2 else 'pain') for i,l in enumerate([6,15,21,16,-7])],[4,4,4,4,6])
    ko=[]
    for i,(r,l,h) in enumerate([(0,-5,2),(-9,-14,6),(-22,-18,9),(-41,-13,7),(-66,-6,3),(-82,-2,0),(-90,-2,0),(-90,-2,0)]):
        ko.append(dp(roll=r,lean=l,hip=h,nearAnkle=[106+i,211-i%3],farAnkle=[146+i*.5,214],nearTarget=[113+i,151+i*.2],farTarget=[147+i*.3,149+i],expression='surprise' if i<2 else 'pain' if i<5 else 'closed',cloth=-i%4,hair=i%2))
    d('Ko','Nocaute',ko,[4,5,6,7,8,8,10,12])
    d('Defeat','Derrota',[{**floor,'nearTarget':[119+i*.3,151+i%2],'farTarget':[151,154-i%2],'cloth':2-i*.4,'hair':0} for i in range(6)],[8]*6)
    # Slow entrance is a complete distance-matched walk cycle, then a real
    # settling gesture. Physics travels 64 px in 40 ticks, as approved gait.
    entrance=[{**p,'expression':'smirk'} for p in dio_specs()['walkForward']['poses']]
    settle=[dp(lean=l,hip=h,nearTarget=n,farTarget=f,expression='smirk',cloth=i%3-1) for i,(l,h,n,f) in enumerate([(1,2,[117,157],[151,151]),(-1,1,[119,153],[154,145]),(-3,0,[121,151],[156,139]),(-3,-1,[123,150],[158,135]),(-2,0,[121,152],[156,140]),(0,0,[115,160],[150,151])])]
    d('Entrance','Entrada confiante e manifestação',entrance+settle,[1]*40+[6,7,8,12,13,14])
    taunt=[]
    for i,(l,n,f) in enumerate([(-1,[117,156],[152,148]),(-3,[125,146],[153,137]),(-4,[137,137],[143,134]),(-5,[145,132],[131,136]),(-5,[148,132],[127,137]),(-4,[147,131],[128,136]),(-5,[148,132],[127,137]),(-3,[142,136],[139,138]),(-1,[125,149],[153,146]),(0,[115,160],[150,151])]):
        taunt.append(dp(lean=l,nearTarget=n,farTarget=f,nearWrist=-20 if i in range(3,7) else 0,farWrist=15 if i in range(3,7) else 0,cloth=i%3-1,expression='challenge' if i<3 else 'smirk'))
    d('Taunt','Provocação: braços cruzados',taunt,[4,4,4,5,8,8,8,5,4,4])
    triumph=[]
    for i,(l,n,f) in enumerate([(0,[115,160],[150,151]),(-3,[119,150],[153,144]),(-5,[124,139],[156,130]),(-6,[127,129],[157,118]),(-5,[129,123],[158,111]),(-4,[130,122],[159,110]),(-5,[130,121],[159,109]),(-4,[130,122],[159,110])]):
        triumph.append(dp(lean=l,nearTarget=n,farTarget=f,nearWrist=-20,farWrist=-25,cloth=i%3-1,hair=i%2,expression='victory'))
    d('Victory','Vitória triunfante',triumph,[5,5,6,6,7,9,10,12])
    for expression in EXPRESSIONS:
        d('Expression'+expression.title(),'Expressão: '+expression,[dp(expression=expression)],[30],True)
    # Independent Stand anatomy. Fade sheets use binary pixel dissolution,
    # retaining pose changes instead of sliding one unchanged sprite.
    recoil=[]
    for i,(l,n,f) in enumerate([(-6,[126,117],[150,113]),(-14,[132,114],[148,108]),(-19,[136,112],[146,105]),(-10,[128,118],[149,114])]):
        recoil.append(wp(lean=l,hip=i%2,nearTarget=n,farTarget=f,nearAnkle=[104+i,194-i],farAnkle=[145,191-i],cloth=-i))
    w('Interrupt','Ataque interrompido',recoil,[1,2,2,1])
    retreat=[wp(lean=l,hip=h,nearTarget=[125-i,118+i],farTarget=[149+i,112+i*2],nearAnkle=[109-i,190+i],farAnkle=[145-i,187+i],cloth=i%3-1) for i,(l,h) in enumerate([(-15,0),(-11,-1),(-7,-2),(-3,-1),(0,0)])]
    w('Recoil','Recuar ao sofrer dano',retreat,[2,2,2,3,3])
    neutral=wp(lean=0,nearTarget=[115,124],farTarget=[152,122])
    w('Return','Retorno à posição neutra',[{**interpolate(retreat[-1],neutral,u),'cloth':i%3-1} for i,u in enumerate([0,.2,.4,.65,.85,1])],[3]*6)
    fading=[{**interpolate(retreat[0],neutral,i/5),'dissolve':(i+1)/6,'cloth':i-2} for i in range(6)]
    w('Vanish','Desaparecer temporariamente',fading,[2]*6)
    w('Hidden','Stand ausente',[{**neutral,'dissolve':1}],[1],True)
    w('Appear','Reaparecer atrás de Dio',[{**neutral,'lean':-6+i,'hip':2-i*.3,'nearTarget':[120-i*.6,119+i*.6],'farTarget':[151+i*.2,117+i*.7],'dissolve':max(0,1-(i+1)/8),'cloth':i%3-1} for i in range(8)],[3]*8)
    w('Dissipate','Dissipação no nocaute',[wp(lean=-i*1.5,hip=i*.9,nearTarget=[116+i,125+i*2],farTarget=[151-i*.5,124+i*2],nearAnkle=[106,194+i*.5],farAnkle=[144,190+i*.7],cloth=i%3-1,dissolve=i/9) for i in range(10)],[5]*10)
    w('Threat','Ameaça durante provocação',[wp(lean=l,hip=h,nearTarget=[118+i%2,120-i%2],farTarget=[154 if i==3 else 153,118+i%2],cloth=i%3-1) for i,(l,h) in enumerate([(-2,0),(-3,-1),(-4,-2),(-3,-1),(-1,0),(0,.5)])],[10]*6,True)
    victory=[]
    for i,(n,f) in enumerate([([117,122],[151,120]),([124,117],[148,115]),([137,114],[138,117]),([147,112],[125,120]),([149,112],[122,120]),([148,111],[123,119]),([149,112],[122,120]),([148,111],[123,119])]):
        victory.append(wp(lean=-2-i*.2,nearTarget=n,farTarget=f,nearWrist=-25,farWrist=20,cloth=i%3-1))
    w('Victory','Vitória: braços cruzados',victory,[5,5,6,6,8,10,10,12])
    return dio,world

def draw(rig,pose,grounded):
    p=dict(pose);roll=p.pop('roll',0);expression=p.pop('expression','neutral');dissolve=p.pop('dissolve',0)
    saved=rig.layers['head'];rig.layers['head']=face(saved,expression) if rig.name=='dio' else saved
    try:im,g=render(rig,p,grounded and not roll)
    finally:rig.layers['head']=saved
    if roll:
        t=rigid((128,185),roll);im=warp(im,t)
        shift=224-im.getbbox()[3] if grounded else 0
        if shift:im=warp(im,(np.eye(2),np.array([0,shift])))
        t=(t[0],t[1]+np.array([0,shift]))
        boxes=[]
        for b in g['hurtboxes']:
            points=[point(t,(b['x']+128+dx,b['y']+224+dy)) for dx in [0,b['w']] for dy in [0,b['h']]]
            lo=np.floor(np.min(points,axis=0));hi=np.ceil(np.max(points,axis=0))
            boxes.append(dict(x=int(lo[0]-128),y=int(lo[1]-224),w=max(1,int(hi[0]-lo[0])),h=max(1,int(hi[1]-lo[1]))))
        g['hurtboxes']=boxes
    if dissolve:
        a=np.array(im);yy,xx=np.mgrid[:256,:256]
        # Deterministic small pixel clusters; all exported pixels remain 0/255.
        threshold=((xx//2*37+yy//2*61+(xx//2)*(yy//2)*7)%101)/100
        a[threshold<dissolve]=0
        if dissolve>=1:a[:]=0
        im=Image.fromarray(a)
    a=np.array(im);a[a[:,:,3]==0]=0;im=Image.fromarray(a)
    if grounded and im.getbbox():assert im.getbbox()[3]<=224,(rig.name,p,im.getbbox())
    return im,g

def build():
    protect();dio,world=definitions();all_man={};qa=ROOT/'art/dio/qa/secondary';qa.mkdir(parents=True,exist_ok=True)
    for who,defs in [('dio',dio),('the-world',world)]:
        rig=AttackRig(who);out=ROOT/f'public/sprites/{who}';animation=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())
        manifest=dict(id=who,cell=[256,256],pivot=PIVOT,clips={})
        for key,c in defs.items():
            frames=[];poses=[]
            for i,p in enumerate(c['poses']):
                im,g=draw(rig,p,c['grounded']);frames.append(im);im.save(out/f'{key}-{i:02}.png')
                poses.append(dict(ticks=c['durations'][i],phase='reaction',hitboxes=[],**g))
            sheet=Image.new('RGBA',(256*len(frames),256))
            for i,f in enumerate(frames):sheet.paste(f,(256*i,0))
            sheet.save(out/f'{key}.png')
            animation['clips'][key]=dict(sheet=f'{who}/{key}.png',columns=len(frames),frames=list(range(len(frames))),ticks=c['durations'][0],durations=c['durations'],loop=c['loop'])
            manifest['clips'][key]=dict(label=c['label'],sheet=key+'.png',count=len(frames),durations=c['durations'],loop=c['loop'],grounded=c['grounded'],bounds=[f.getbbox() or [0,0,0,0] for f in frames],poses=poses)
            frames[0].save(out/f'{key}-animated.png',save_all=True,append_images=frames[1:],duration=[t*1000/60 for t in c['durations']],loop=0,disposal=0,blend=0)
        (ROOT/f'src/data/{who}-animations.json').write_text(json.dumps(animation,indent=2)+'\n');(out/'animations.json').write_text(json.dumps(animation,indent=2)+'\n')
        (out/'secondary.json').write_text(json.dumps(manifest,indent=2)+'\n');all_man[who]=manifest
        (ROOT/f'art/{who}/secondary-rig.json').write_text(json.dumps(defs,indent=2)+'\n')
    mapping={key[9:][:1].lower()+key[10:]:key for key in dio if not key.startswith('secondaryExpression')}
    # Logical aliases used by existing lifecycle selection; approved atlases remain intact.
    reactions={key:dict(loop=c['loop'],poses=c['poses']) for key,c in all_man['dio']['clips'].items()}
    (ROOT/'src/data/dio-secondary.json').write_text(json.dumps(dict(reactionClips=mapping,reactions=reactions,lifecycle=dict(entranceDistance=64,entranceWalkTicks=40,entranceSpeed=1.6,tauntTicks=sum(dio['secondaryTaunt']['durations']),getupTicks=sum(dio['secondaryGetup']['durations']),koTicks=sum(dio['secondaryKo']['durations']))),indent=2)+'\n')
    actions={key:dict(durations=c['durations'],poses=c['poses']) for key,c in all_man['the-world']['clips'].items()}
    (ROOT/'src/data/the-world-secondary.json').write_text(json.dumps(actions,indent=2)+'\n')
    # Compact inspection boards, without fake gameplay or resampling.
    for who,keys in [('dio',['secondaryGuardStand','secondaryDamageHeavy','secondaryGetup','secondaryKo','secondaryTaunt','secondaryVictory']),('the-world',['secondaryInterrupt','secondaryRecoil','secondaryAppear','secondaryDissipate','secondaryVictory'])]:
        board=Image.new('RGB',(1024,len(keys)*260),'#182631');d=ImageDraw.Draw(board)
        for row,key in enumerate(keys):
            c=all_man[who]['clips'][key];d.text((8,row*260+3),key,fill='#f0d894')
            for j,i in enumerate(np.linspace(0,c['count']-1,4).astype(int)):
                im=Image.open(ROOT/f'public/sprites/{who}/{key}-{i:02}.png');board.paste(im,(j*256,row*260+15),im)
        board.save(qa/f'{who}-secondary.png')
    expressions=Image.new('RGB',(8*112,144),'#182631');d=ImageDraw.Draw(expressions)
    for i,e in enumerate(EXPRESSIONS):
        im=Image.open(ROOT/f'public/sprites/dio/secondaryExpression{e.title()}-00.png').crop((119,97,145,126)).resize((104,116),Image.Resampling.NEAREST)
        expressions.paste(im,(i*112,20),im);d.text((i*112+2,3),e,fill='#f0d894')
    expressions.save(qa/'expressions.png')
    with zipfile.ZipFile(ROOT/'public/downloads/dio-secondary.zip','w',zipfile.ZIP_DEFLATED) as z:
        for who,m in all_man.items():
            out=ROOT/f'public/sprites/{who}';z.write(out/'secondary.json',who+'/secondary.json')
            for k,c in m['clips'].items():
                for name in [c['sheet'],f'{k}-animated.png']+[f'{k}-{i:02}.png' for i in range(c['count'])]:z.write(out/name,who+'/'+name)
        for f in ['dio-secondary.json','the-world-secondary.json']:z.write(ROOT/f'src/data/{f}',f)
    protect();print(json.dumps({who:dict(clips=len(m['clips']),frames=sum(c['count'] for c in m['clips'].values())) for who,m in all_man.items()}))
if __name__=='__main__':build()
