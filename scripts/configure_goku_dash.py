from goku_rebuild import ART,read,write
c=read(ART/'sources.json');clips={}
for key,name in [('dashForward','forward'),('backdash','back')]:
 source={'path':f'art/goku/rebuild/dash-{name}-source.png','columns':3,'rows':3,'calibration':0}
 clips[key]={'source':source,'cells':list(range(1,8)),'registration':{str(i):{'mode':'centerFeet'} for i in range(7)},'durations':[2]*7,'loop':False,'grounded':True,'minHeight':85,'label':key+' / anticipation, drive and braking'}
 clips[key+'Recovery']={'source':source,'cells':[8],'prependReference':{'stage':'current','clip':key,'index':6},'appendReference':{'stage':'foundation','clip':'idle','index':0},'durations':[1,2,1],'loop':False,'grounded':True,'minHeight':85,'label':key+' / settling guard'}
c['stages']['dash']=clips;write(ART/'sources.json',c)
