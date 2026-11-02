"""Goku-only authored pose keys. The root trajectory belongs to the engine."""
import math

def definitions(motion):
 out={}
 def pose(**kw):return {**dict(nearAnkle=[104,213],farAnkle=[155,213],support=['near','far']),**kw}
 def add(key,label,ps,times,loop=False,ground=True,**extra):out[key]=dict(label=label,poses=ps,durations=times,loop=loop,grounded=ground,**extra)
 add('idle','Idle',[pose(hip=h,lean=l,nearHand=[114+a,148-b],farHand=[162-a,135-b],cloth=c,hair=hair) for h,l,a,b,c,hair in [(0,0,0,0,0,0),(-.6,-.3,.5,.5,.5,0),(-1,-.5,1,1,1,.6),(-.6,-.2,.5,.5,.5,.5),(0,0,-.5,0,-.5,0),(.4,.3,0,-.5,-1,-.5)]],[11,10,10,11,9,9],True)
 for back in [False,True]:
  speed=motion['backSpeed'] if back else motion['speed'];ps=[]
  for i in range(24):
   feet={};support=[]
   for side,phase,center in [('near',i,122),('far',(i+12)%24,136)]:
    if phase<12:
     x=(6-phase)*speed;y=0;support.append(side)
    else:
     u=(phase-12)/12
     # Equal velocity at toe-off/touch-down; swing accelerates in the middle.
     x=(-6+12*(u-math.sin(2*math.pi*u)/(2*math.pi)))*speed
     y=-(13 if back else 18)*math.sin(math.pi*u)
    feet[side+'Ankle']=[center+(-x if back else x),213+y]
    feet[side+'Toe']=(-5 if back else 6)*math.sin(math.pi*(phase-12)/12) if phase>=12 else 0
   wave=math.sin(i*math.pi/12);dip=math.sin(i*math.pi/6)
   ps.append(pose(hip=3+1.2*dip,x=(-1.5 if back else 1)*wave,lean=(-2 if back else 2)+wave,nearHand=[114+(-2 if back else 4)*wave,147-abs(wave)],farHand=[162+(2 if back else -4)*wave,134-abs(wave)*1.5],nearWrist=wave*5,farWrist=-wave*4,nearElbow=[-wave*2,0],cloth=wave*2,hair=-wave*.7,head=[0,-.4*dip],support=support,legOrder=['far','near'] if i<12 else ['near','far'],**feet))
  add('walkBack' if back else 'walkForward','Walk Back' if back else 'Walk Forward',ps,[1]*24,True,rootSpeed=-speed if back else speed,authoredCyclePhases=['contact','down','passing','up','opposite contact','down','passing','up'])
 def crouch(h,breath=0):return pose(hip=h,x=-h*.38,lean=h*.12,nearHand=[114+h*.12,148+h*.42+breath],farHand=[162-h*.18,135+h*.58+breath],nearWrist=-h*.15,farWrist=-h*.12,nearElbow=[-h*.1,2],cloth=-h*.055+breath,hair=breath*.4)
 add('crouchStart','Crouch Start',[crouch(h) for h in [4,11,18,22]],[2,2,2,2])
 add('crouchIdle','Crouch Idle',[crouch(22,0),crouch(21.5,-.5),crouch(22.2,.5)],[12,14,14],True)
 add('crouchEnd','Crouch End',[crouch(h) for h in [18,11,4,0]],[2,2,2,2])
 # A real first step while rising prevents snapping from a full squat into
 # an upright walking drawing when S is released together with A or D.
 for back in [False,True]:
  speed=(-motion['backSpeed'] if back else motion['speed']);ps=[]
  first,second=('far','near') if back else ('near','far')
  origin={'near':104,'far':155}
  for n,h in enumerate([20,18,15,11,7,4,2,0]):
   feet={};support=[first if n<4 else second]
   for side in ['near','far']:
    x=origin[side]-speed*(n+1);y=213
    if side==second:
     u=min(1,n/4);x+=( -20 if back else 20)*(u-math.sin(2*math.pi*u)/(2*math.pi));y-=9*math.sin(math.pi*u)
    elif n>=4:
     u=(n-3)/4;start=origin[side]-speed*4;target=145 if back else 110
     x=start*(1-u)+target*u;y-=12*math.sin(math.pi*u)
    feet[side+'Ankle']=[x,y]
   ps.append({**crouch(h),'support':support,**feet})
  add('crouchWalkBack' if back else 'crouchWalkForward','Levantar recuando' if back else 'Levantar avançando',ps,[1]*8,rootSpeed=speed)
 add('dashForward','Dash Forward',[
  crouch(8),pose(hip=12,x=0,lean=10,nearHand=[108,143],farHand=[157,126],cloth=-2),
  pose(hip=4,lean=22,nearAnkle=[103,202],farAnkle=[160,206],nearHand=[102,139],farHand=[153,122],support=[],cloth=-3),
  pose(hip=2,lean=25,nearAnkle=[113,194],farAnkle=[156,201],nearHand=[104,136],farHand=[151,120],support=[],cloth=-4),
  pose(hip=5,lean=17,nearAnkle=[112,203],farAnkle=[158,210],nearHand=[108,140],farHand=[157,126],support=[],cloth=-2),
  pose(hip=9,lean=7,nearHand=[112,146],farHand=[161,131],cloth=-1),pose(hip=1,lean=1,nearHand=[114,148],farHand=[162,135],cloth=.5)], [2]*7)
 add('backdash','Backdash',[
  crouch(6),pose(hip=10,x=-3,lean=-6,nearHand=[118,144],farHand=[165,130],cloth=1),
  pose(hip=0,lean=-12,nearAnkle=[102,202],farAnkle=[150,198],nearHand=[119,141],farHand=[166,125],support=[],cloth=3),
  pose(hip=-1,lean=-13,nearAnkle=[108,199],farAnkle=[154,201],nearHand=[119,138],farHand=[167,126],support=[],cloth=3),
  pose(hip=4,lean=-7,nearAnkle=[105,206],farAnkle=[154,209],nearHand=[118,144],farHand=[165,130],support=[],cloth=2),
  pose(hip=8,lean=-3,nearHand=[115,146],farHand=[163,133],cloth=1),pose(hip=1,nearHand=[114,148],farHand=[162,135],cloth=-.5)], [2]*7)
 add('jumpStart','Jump Start',[crouch(9),crouch(20),pose(hip=-2,lean=2,nearHand=[113,137],farHand=[162,123],cloth=-2)],[2,2,2])
 rise=[pose(hip=-2,lean=2,nearAnkle=[106,205],farAnkle=[154,207],nearHand=[112,137],farHand=[161,122],support=[],cloth=-1),pose(hip=-1,lean=3,nearAnkle=[120,193],farAnkle=[158,201],nearHand=[111,132],farHand=[160,118],support=[],cloth=-2,hair=.5),pose(hip=0,lean=2,nearAnkle=[125,185],farAnkle=[157,197],nearHand=[112,131],farHand=[162,119],nearWrist=-5,support=[],cloth=-2,hair=.8)]
 apex=[pose(hip=0,lean=1,nearAnkle=[126,185],farAnkle=[155,197],nearHand=[113,132],farHand=[162,120],support=[],cloth=.5),pose(hip=.5,lean=0,nearAnkle=[123,188],farAnkle=[156,199],nearHand=[114,134],farHand=[163,122],support=[],cloth=1)]
 fall=[pose(hip=.5,lean=-1,nearAnkle=[118,193],farAnkle=[157,202],nearHand=[115,138],farHand=[164,126],support=[],cloth=2),pose(hip=1,lean=-1,nearAnkle=[109,204],farAnkle=[156,208],nearHand=[115,143],farHand=[164,131],support=[],cloth=1.5),pose(hip=0,nearHand=[114,147],farHand=[162,134],support=[],cloth=.5)]
 for key,ps in [('jumpRise',rise),('jumpApex',apex),('jumpFall',fall)]:
  for suffix,lean in [('',0),('Forward',6),('Backward',-5)]:
   add(key+suffix,key+(' '+suffix if suffix else ''),[{**p,'lean':p.get('lean',0)+lean,'nearAnkle':[p['nearAnkle'][0]-lean*.35,p['nearAnkle'][1]],'farAnkle':[p['farAnkle'][0]-lean*.25,p['farAnkle'][1]],'nearHand':[p['nearHand'][0]-lean*.15,p['nearHand'][1]]} for p in ps],[4]*len(ps),False,False)
 # Contact precedes the deepest compression, then legs extend to the guard.
 add('landing','Landing',[crouch(h) for h in [7,20,12,1]],[2,2,2,2])
 add('trainingHit','Reação provisória de treino',[pose(lean=l,hip=h,nearHand=[112,148+i],farHand=[158,135+i],cloth=-i) for i,(l,h) in enumerate([(-6,2),(-12,4),(-5,1)])],[4]*3)
 add('trainingAirHit','Reação aérea provisória',[{**rise[min(i,2)],'lean':-8-i*4,'roll':-i*7} for i in range(3)],[5]*3,False,False)
 add('trainingDown','Queda provisória de treino',[pose(hip=3,lean=-6,nearHand=[112,150],farHand=[160,142],roll=r,cloth=i) for i,r in enumerate([-28,-64,-90])],[8,8,12])
 add('trainingGetup','Recuperação provisória',[pose(hip=h,lean=l,nearHand=[113,151],farHand=[158,140],roll=r,cloth=i) for i,(r,h,l) in enumerate([(-90,3,-6),(-44,18,4),(0,10,3),(0,0,0)])],[4,4,5,5])
 # Match the forward fist tucked against the chest in the approved guard.
 for c in out.values():
  for p in c['poses']:
   if 'nearHand' in p:p['nearHand'][0]+=6
 return out
