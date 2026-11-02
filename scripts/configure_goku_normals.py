from goku_combat_art import ART,read,write
clips={}
specs={
 'stand_light':([1,2,3,4,5,6],[2,2,2,2,4,4],4,4,'punch',42,24,11,.9,0,6),
 'stand_medium':([1,2,3,4,5,6,7],[3,3,2,3,2,5,6],8,5,'kick',66,27,15,1.3,0,8),
 'stand_heavy':([1,2,3,4,5,6,7,8],[3,3,3,2,3,3,5,6],9,5,'punch',100,32,20,7,0,11),
 'crouch_light':([2,3,4,5,6,7],[2,2,3,3,3,4],4,3,'lowPunch',38,24,10,.7,0,5),
 'crouch_medium':([1,2,3,4,5,6,7],[3,3,2,3,2,5,6],8,5,'sweep',62,28,15,1.2,0,8),
 'crouch_heavy':([1,2,3,4,5,6,7,8],[3,3,3,2,3,3,5,6],9,5,'uppercut',88,42,20,.7,-19,10),
 'air_light':([1,2,3,4,5,6],[2,1,2,2,3,3],3,4,'punch',36,25,10,.6,-5,5),
 'air_medium':([1,2,3,4,5,6,7],[2,2,2,2,2,4,4],6,4,'kick',59,28,14,.7,-2.5,7),
 'air_heavy':([1,2,3,4,5,6,7,8],[2,2,2,2,2,3,4,5],6,4,'downkick',92,35,20,5,13,11)
}
for key,(cells,times,startup,active,strike,damage,stun,blockstun,push,launch,hitstop)in specs.items():
 context,strength=key.split('_');rank={'light':1,'medium':2,'heavy':3}[strength]
 cancels=['medium','heavy']if rank==1 else['heavy']if rank==2 else['jump']if key=='crouch_heavy'else[]
 successors=[context+'_'+s for s in cancels if s!='jump']
 combat={'damage':damage,'stun':stun,'blockstun':blockstun,'push':push,'launch':launch,'hitstop':hitstop,'level':'high'if context=='air'else'low'if context=='crouch'and rank<3 else'mid','rank':rank,'cancels':cancels,'cancelWindow':{'fromTick':startup+1,'toTick':startup+active+7},'cancelMoves':successors}
 if context=='air':combat['airHold']=-3 if rank<3 else 2
 if key=='air_medium':combat['airHold']=-8
 if key=='air_heavy':combat['knockdown']=True
 if key=='crouch_heavy':combat['drive']={'from':2,'to':9,'speed':3}
 clips[key]={'source':f'art/goku/combat/{key}-source.png','kind':'normal','grounded':context!='air','cells':cells,'durations':times,'startup':startup,'active':active,'strike':strike,'combat':combat,'label':key}
clips['crouch_heavy']['strikePoints']={'3':[228,128],'4':[210,83]}
clips['crouch_medium']['registration']={'4':{'offsetDelta':[56,0]}}
clips['air_light']['registration']={'2':{'offsetDelta':[16,0]},'3':{'offsetDelta':[16,0]}}
clips['air_medium']['registration']={'3':{'offsetDelta':[20,0]},'4':{'offsetDelta':[20,0]}}
clips['stand_heavy']['discardSpeckles']={'3':[[259,221],[259,222]],'4':[[136,y]for y in range(143,149)]}
existing=read(ART/'sources.json')['clips']if(ART/'sources.json').exists()else{}
clips.update({k:v for k,v in existing.items()if v.get('kind')!='normal'})
write(ART/'sources.json',{'version':1,'method':'whole-pose','clips':clips})
secondary=read(ART/'secondary-config.json')if(ART/'secondary-config.json').exists()else{'reactionClips':{}}
secondary.update({'combatLimits':{'maxHits':8,'maxAirHits':6,'maxTicks':180},'airChaseSpeed':3.4,'airChaseTicks':8});write(ART/'secondary-config.json',secondary)
