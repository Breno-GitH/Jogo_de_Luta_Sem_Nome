from goku_combat_art import ART,read,write
c=read(ART/'sources.json');clips=c['clips']
def clip(key,source,cells,times,grounded=True,loop=False):
 clips[key]={'source':f'art/goku/combat/{source}-source.png','kind':'reaction','grounded':grounded,'cells':cells,'durations':times,'loop':loop,'label':key}
clip('guardStand','guard_standing',[1,2,3],[6,9,9],loop=True)
clip('guardCrouch','guard_crouch',[2,3],[10,12],loop=True)
clip('guardImpactStand','guard_standing',[4,5,6],[2,2,2])
clip('guardImpactCrouch','guard_crouch',[4,5,6],[2,2,2])
clip('guardRecovery','guard_standing',[6,7,8],[2,3,3])
clip('guardRecoveryCrouch','guard_crouch',[6,7,8],[2,3,3])
for name,cells,times in [('hitLight',[1,2],[4,6]),('hitMedium',[3,4],[4,8]),('hitHeavy',[5,6],[4,10]),('hitRecovery',[7,8],[4,4])]:clip(name,'hit_standing',cells,times)
clip('hitCrouch','hit_crouch_air',[1,2],[4,8])
clip('hitRecoveryCrouch','hit_crouch_air',[2,3],[3,5])
clip('hitAir','hit_crouch_air',[4,5],[6,7],False)
clip('launched','hit_crouch_air',[6,4],[5,6],False)
clip('falling','hit_crouch_air',[5,7,8],[4,5,5],False)
# Source cell2's toe touches the outer source edge; reject it rather than
# padding a clipped painting. The selected lying cells3/4 are complete.
clip('downed','down_getup',[1,3,4],[3,4,17])
clip('getup','down_getup',[3,5,6,7,8],[2,4,4,4,4])
clip('ko','down_getup',[1,3,4],[5,10,15])
clip('grabHold','throw_attacker',[3,4,5,6],[4,4,4,10])
clip('throwRecover','throw_attacker',[7,8,0],[4,4,4])
clip('grabbed','grabbed_victim',[1,2,3,4],[4,4,6,8],False)
clips['throw']={'source':'art/goku/combat/throw_attacker-source.png','kind':'throw','grounded':True,'cells':[0,1,2,7,8],'durations':[3,4,2,8,12],'startup':7,'active':2,'label':'Universal throw / attempt','combat':{'damage':0,'stun':0,'blockstun':0,'push':0,'launch':0,'level':'throw','kind':'grab','box':{'x':24,'y':-115,'w':50,'h':62},'rank':4,'cancels':[]}}
secondary=read(ART/'secondary-config.json')
secondary['reactionClips']={'damageLight':'hitLight','damageMedium':'hitMedium','damageHeavy':'hitHeavy','damageCrouch':'hitCrouch','damageAir':'hitAir','launched':'launched','falling':'falling','downed':'downed','getup':'getup','ko':'ko','defeat':'ko','grabbed':'grabbed','guardStand':'guardStand','guardCrouch':'guardCrouch','guardImpactStand':'guardImpactStand','guardImpactCrouch':'guardImpactCrouch','throwRecover':'throwRecover'}
secondary['grabSequence']={'duration':22,'hitTick':12,'damage':125,'recoveryTicks':12,'release':{'vx':7,'vy':-7,'stun':38},'victimTrack':[{'tick':0,'x':72,'y':0,'clip':'grabbed'},{'tick':4,'x':52,'y':-12,'clip':'grabbed'},{'tick':8,'x':38,'y':-42,'clip':'grabbed'},{'tick':12,'x':70,'y':-72,'clip':'damageAir'},{'tick':17,'x':110,'y':-40,'clip':'damageAir'},{'tick':21,'x':132,'y':-18,'clip':'falling'}]}
write(ART/'sources.json',c);write(ART/'secondary-config.json',secondary)
