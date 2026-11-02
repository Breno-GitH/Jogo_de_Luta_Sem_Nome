from goku_fury_art import ART,write
clips={}
def add(key,source,cells,times,loop=False):
 clips[key]={'cells':[f'{source}:{v}'for v in cells]if isinstance(source,str)else source,'durations':times,'loop':loop}
add('furySuperActivationStart','activation',[1,2,3],[6,8,10])
add('furyEnergyCharging','activation',[4,5,6],[8,8,8])
add('furyInitialTransformation','transformation',[1,2,3,4],[5,5,5,5])
add('furyTransformationTransition','transformation',[5,6],[5,5])
add('furyTransformationFinish','transformation',[7,8],[5,5])
add('furySuperFightingPose','dash',[1,2,3],[4,5,5],True)
add('furyInitialDash','dash',[4,5,6,7,8],[3,3,4,4,3])
add('furyFirstPunch','ground',[1,2,3,4],[4,3,8,5])
add('furySecondStrike','ground',[5,6,7,8],[3,4,5,4])
add('furyUppercut','uppercut',[1,2,3,4,5],[3,3,5,5,4])
add('furyAirPursuit','uppercut',[6,7,8],[5,5,6])
add('furyAirPunch','air',[1,2,3,4],[2,2,4,4])
add('furyAirKick','air',[5,6,7,8],[2,2,5,3])
add('furyTeleportDisappear','teleport',[1,2,3,4],[2,1,1,2])
add('furyTeleportReappear','teleport',[5,6,7,8],[1,1,1,1])
add('furyTeleportPunch','air',[1,2,3,4],[2,3,5,8])
add('furyTeleportKick','air',[5,6,7,8],[2,3,5,8])
add('furySmash','aerial',[1,2,3,4],[2,3,5,8])
add('furyAerialUppercut','aerial',[5,6,7,8],[2,3,5,8])
clips['furyAerialUppercut']['cells'][2]='uppercut:4'
add('furyKamehamehaPreparation','charge',[1,2,3,4],[7,9,12,14])
add('furyFuriousExpression','charge',[5,6,7,8],[3,3,3,3])
add('furyDownwardBeam','beam',[1,2,3,4],[2,3,4,5])
add('furyKamehamehaMaintain','beam',[5,6],[4,4],True)
add('furyKamehamehaRecovery','beam',[7,8],[5,5])
add('furyAirDescent','descent',[1,2,3],[10,10,10])
add('furyLanding','descent',[4,5,6],[3,5,6])
add('furyTransformationEnding','descent',[7,8],[6,6])
add('furyAuraFading','ending',[1,2],[2,2])
add('furyHairColorTransition','ending',[3,4,5,6],[4,4,4,4])
add('furyReturnToBase','ending',[6,7,8],[4,4,4])
add('furyRecoveryPose','ending',[7,8],[2,2])
add('furyReturnToIdle',['ending:8','base:idle'],[],[3,5])
add('ssj1_fury',[
 *[f'activation:{i}'for i in [1,2,3,4,5,6]],
 *[f'transformation:{i}'for i in range(1,9)],
 *[f'dash:{i}'for i in range(4,9)],'ground:2','ground:3','ground:4',
 *[f'ending:{i}'for i in range(1,9)],'ending:8','base:idle'],[],
 [6,8,10,8,8,8]+[5]*8+[3,3,4,4,3]+[1,5,8]+[4,4,5,5,6,6,5,5]+[4,6])
for c in clips.values():
 cells=[];times=[]
 for ref,t in zip(c['cells'],c['durations']):
  if cells and ref==cells[-1]:times[-1]+=t
  else:cells.append(ref);times.append(t)
 c['cells']=cells;c['durations']=times
write(ART/'sources.json',{'method':'whole-pose, uniform source scale, nearest-neighbor, no morphing','clips':clips})
print(len(clips),'separate body clips')
