from goku_rebuild import ART,read,write
c=read(ART/'sources.json')
def sheet(name):return {'path':f'art/goku/rebuild/{name}-source.png','columns':3,'rows':3,'calibration':0}
c['stages']['reactions']={
 'trainingHit':{'source':sheet('reactions'),'cells':[1,2,3],'durations':[3,4,5],'loop':False,'grounded':True,'minHeight':80,'label':'Training hit / complete-body fallback'},
 'trainingAirHit':{'source':sheet('reactions'),'cells':[4,5,6],'durations':[5,5,5],'loop':False,'grounded':False,'minHeight':45,'label':'Training air recoil / complete-body fallback'},
 'trainingDown':{'source':sheet('getup'),'cells':[1,2,3],'durations':[4,6,18],'loop':False,'grounded':True,'minHeight':32,'label':'Training fall / down'},
 'trainingGetup':{'source':sheet('getup'),'cells':[5,6,7,8],'prependReference':{'stage':'current','clip':'trainingDown','index':2},'durations':[2,4,4,4,4],'loop':False,'grounded':True,'minHeight':32,'label':'Training getup / bracing, kneel and rising'}
}
write(ART/'sources.json',c)
