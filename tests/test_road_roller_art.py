from pathlib import Path
import json,hashlib,unittest,zipfile
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class RoadArtTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
    cls.manifests={who:json.loads((ROOT/f'public/sprites/{who}/{file}').read_text()) for who,file in [('dio','road-roller.json'),('the-world','road-roller.json'),('road-roller','manifest.json'),('road-fx','manifest.json')]}
 def test_preserves_all_previously_approved_images_data_and_clips(self):
    old=json.loads((ROOT/'art/dio/road-preservation.json').read_text())
    for file,digest in old['images'].items():self.assertEqual(hashlib.sha256((ROOT/file).read_bytes()).hexdigest(),digest,file)
    for who,clips in old['clips'].items():
        now=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())['clips']
        for key,clip in clips.items():self.assertEqual(now[key],clip,key)
    for file,digest in old['data'].items():self.assertEqual(hashlib.sha256((ROOT/'src/data'/file).read_bytes()).hexdigest(),digest,file)
 def test_required_character_object_and_separate_effect_sheets_exist(self):
    for key in ['roadUltimateStart','roadFlyingPreparation','roadFlyingUp','roadReturning','roadRollerPose','roadUltimateFinish','roadReturnIdle']:self.assertIn(key,self.manifests['dio']['clips'])
    for key in ['roadUltimateStart','roadFlyingUp','roadCarrying','roadFirstPunch','roadAlternating','roadBarrage','roadFinalHeavy','roadUltimateRecovery','roadReturnBehind']:self.assertIn(key,self.manifests['the-world']['clips'])
    self.assertEqual(len(self.manifests['road-roller']['clips']),5);self.assertEqual(len(self.manifests['road-fx']['clips']),6)
 def test_native_pixel_palettes_binary_alpha_and_real_nontranslation_poses(self):
    for who,m in self.manifests.items():
      palette={tuple(bytes.fromhex(c[1:])) for c in json.loads((ROOT/f'art/{who}/palette.json').read_text())}if who in ['dio','the-world']else None
      w,h=m['cell']
      for key,c in m['clips'].items():
        im=Image.open(ROOT/f'public/sprites/{who}/{c["sheet"]}').convert('RGBA');self.assertEqual(im.size,(w*c['count'],h))
        frames=[];crops=[]
        for i in range(c['count']):
          f=im.crop((i*w,0,(i+1)*w,h));a=np.array(f);self.assertEqual(set(np.unique(a[:,:,3])),{0,255},key);self.assertTrue(np.all(a[a[:,:,3]==0]==0))
          if palette:self.assertTrue(set(map(tuple,a[a[:,:,3]>0,:3])).issubset(palette),key)
          if who in ['dio','the-world','road-roller']:self.assertTrue(np.all(a[[0,-1]]==0),key);self.assertTrue(np.all(a[:,[0,-1]]==0),key)
          frames.append(f.tobytes());crop=f.crop(f.getbbox());crops.append((crop.size,crop.tobytes()))
        self.assertEqual(len(set(frames)),c['count'],key)
        if who in ['dio','the-world']:self.assertEqual(len(set(crops)),c['count'],key)
 def test_anatomical_bone_lengths_and_faces_are_preserved(self):
    for who,m in self.manifests.items():
      if who not in ['dio','the-world']:continue
      rig=json.loads((ROOT/f'art/{who}/rig.json').read_text()) if (ROOT/f'art/{who}/rig.json').exists() else None
      # Match each limb's length to the same approved base skeleton.
      reference={'dio':{'arms':{'near':[[105,122],[102,141],[111,152]],'far':[[140,125],[143,140],[152,145]]},'legs':{'near':[[123,150],[111,180],[106,211]],'far':[[135,148],[145,180],[146,211]]}},
                 'the-world':{'arms':{'near':[[104,102],[95,120],[113,127]],'far':[[146,107],[148,122],[160,129]]},'legs':{'near':[[125,140],[111,172],[98,201]],'far':[[140,140],[149,170],[143,195]]}}}[who]
      for key,c in m['clips'].items():
        for p in c['poses']:
          for kind in ['arms','legs']:
            for side in ['near','far']:
              a=np.array(p['anchors'][kind][side]);b=np.array(reference[kind][side])
              self.assertTrue(np.allclose(np.linalg.norm(np.diff(a,axis=0),axis=1),np.linalg.norm(np.diff(b,axis=0),axis=1),atol=.25),key)
 def test_initial_contact_is_a_real_stand_fist_and_dio_only_commands(self):
    move=json.loads((ROOT/'src/data/dio-super-moves.json').read_text())['road_roller'];self.assertEqual(move['cost'],200)
    self.assertTrue(all(not p['hitboxes'] for p in move['poses']))
    action=self.manifests['the-world']['clips']['roadStrike'];clock=0;windows=[]
    for p in action['poses']:
      if p['hitId']>=0:self.assertEqual(p['hitboxes'],[p['surfaces']['far']]);windows.extend(range(clock,clock+p['ticks']))
      clock+=p['ticks']
    self.assertEqual(windows,list(range(26,30)))
 def test_barrage_contact_ids_have_exactly_the_configured_punch_ticks(self):
    config=json.loads((ROOT/'src/data/road-roller.json').read_text());clip=self.manifests['the-world']['clips']['roadBarrage'];tick=config['phases']['barrage'];contacts=[]
    for p in clip['poses']:
      if p['hitId']>=0:contacts.append(tick);side='far' if p['hitId']%2==0 else 'near';self.assertEqual(p['hitboxes'],[p['surfaces'][side]])
      tick+=p['ticks']
    self.assertEqual(contacts,config['punchTicks'])
 def test_every_super_cancel_bridge_matches_both_actual_endpoints(self):
    data=json.loads((ROOT/'public/sprites/the-world/road-transitions.json').read_text());self.assertEqual(len(data),14)
    for key,c in data.items():
      _,source,index,target=key.split('_');i=int(index);im=Image.open(ROOT/f'public/sprites/the-world/{c["sheet"]}').convert('RGBA')
      a=Image.open(ROOT/f'public/sprites/the-world/{source}.png').convert('RGBA');b=Image.open(ROOT/f'public/sprites/the-world/{target}.png').convert('RGBA')
      self.assertEqual(im.crop((0,0,256,256)).tobytes(),a.crop((i*256,0,(i+1)*256,256)).tobytes(),key)
      self.assertEqual(im.crop((im.width-256,0,im.width,256)).tobytes(),b.crop((0,0,256,256)).tobytes(),key)
 def test_effects_pivots_are_correct_and_machine_damage_does_not_loop_back_to_intact(self):
    data=json.loads((ROOT/'src/data/road-roller-fx.json').read_text())
    for key in ['impactFlash','finalImpact']:self.assertEqual(data['clips'][key]['pivot'],{'x':128,'y':128})
    self.assertEqual(data['clips']['explosion']['pivot'],{'x':128,'y':140})
    self.assertFalse(json.loads((ROOT/'src/data/road-roller-object.json').read_text())['clips']['roadPunched']['loop'])
 def test_export_zip_contains_every_sheet_frame_and_configuration(self):
    with zipfile.ZipFile(ROOT/'public/downloads/road-roller.zip')as z:
      for who,m in self.manifests.items():
        for key,c in m['clips'].items():
          self.assertIn(f'{who}/{c["sheet"]}',z.namelist())
          for i in range(c['count']):self.assertIn(f'{who}/cells/{key}-{i:02}.png',z.namelist())
      for file in ['road-roller.json','dio-super-moves.json','road-roller-object.json','road-roller-fx.json']:self.assertIn(file,z.namelist())
if __name__=='__main__':unittest.main(verbosity=2)
