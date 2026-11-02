from goku_rebuild import ART,read,write
c=read(ART/'sources.json');clips={}
source={'path':'art/goku/rebuild/transitions-source.png','columns':3,'rows':3,'calibration':0}
for suffix,walk,start,stop in [('Forward','walkForward',[1,2],[3,4]),('Back','walkBack',[5,6],[7,8])]:
 clips['idleToWalk'+suffix]={'source':source,'cells':start,'prependReference':{'stage':'foundation','clip':'idle','index':0},'appendReference':{'stage':'walk','clip':walk,'index':0},'durations':[1,1,1,1],'loop':False,'grounded':True,'minHeight':110,'label':'Idle to walk '+suffix}
 clips['walkToIdle'+suffix]={'source':source,'cells':stop,'appendReference':{'stage':'foundation','clip':'idle','index':0},'durations':[1,2,1],'loop':False,'grounded':True,'minHeight':110,'label':'Walk to idle '+suffix}
 clips['crouchWalk'+suffix]={'source':{'path':'art/goku/rebuild/crouch-source.png','columns':3,'rows':3,'calibration':0},'cells':[6,2,7,1,8],'prependReference':{'stage':'crouch','clip':'crouchIdle','index':0},'appendReference':{'stage':'walk','clip':walk,'index':0},'durations':[1,1,1,1,1,1,2],'loop':False,'grounded':True,'minHeight':75,'label':'Crouch rising into walk '+suffix}
c['stages']['transitions']=clips;write(ART/'sources.json',c)
