import unittest,json,hashlib,sys,zipfile
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_dio_secondary import protect,definitions,EXPRESSIONS
ROOT=Path(__file__).resolve().parents[1]
class SecondaryArt(unittest.TestCase):
 def test_preserves_all_old_images_data_and_animation_entries(self):protect()
 def test_all_required_separate_transparent_sheets_have_matching_clocks(self):
  for who,defs in zip(['dio','the-world'],definitions()):
   manifest=json.loads((ROOT/f'public/sprites/{who}/secondary.json').read_text());self.assertEqual(set(defs),set(manifest['clips']))
   animation=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())
   for key,c in manifest['clips'].items():
    im=Image.open(ROOT/f'public/sprites/{who}'/c['sheet']);self.assertEqual(im.size,(256*c['count'],256));self.assertEqual(im.mode,'RGBA');self.assertEqual(c['durations'],animation['clips'][key]['durations']);self.assertEqual(manifest['pivot'],dict(x=128,y=224));self.assertEqual(len(c['poses']),c['count'])
    alpha=np.array(im)[:,:,3];self.assertLessEqual(set(np.unique(alpha)),{0,255});self.assertEqual(int(alpha[0].max()),0)
 def test_grounded_poses_do_not_penetrate_floor_and_reactions_have_no_hitboxes(self):
  for who in ['dio','the-world']:
   m=json.loads((ROOT/f'public/sprites/{who}/secondary.json').read_text())
   for key,c in m['clips'].items():
    for i,p in enumerate(c['poses']):
     self.assertEqual(p['hitboxes'],[])
     if c['grounded']:self.assertLessEqual(c['bounds'][i][3],224,key)
 def test_expressions_change_the_face_pixels_and_keep_hair_outline(self):
  faces=[];heads=[]
  for expression in EXPRESSIONS:
   im=Image.open(ROOT/f'public/sprites/dio/secondaryExpression{expression.title()}-00.png');a=np.array(im);faces.append(a[104:117,125:136].tobytes());a[104:117,125:136]=0;heads.append(a.tobytes())
  self.assertEqual(len(set(faces)),8);self.assertEqual(len(set(heads)),1)
 def test_animated_body_poses_are_not_translations_of_a_single_image(self):
  for who in ['dio','the-world']:
   m=json.loads((ROOT/f'public/sprites/{who}/secondary.json').read_text())
   for key,c in m['clips'].items():
    if c['count']<2 or key.endswith(('Downed','Defeat')):continue
    crops=[]
    for i in range(c['count']):
     im=Image.open(ROOT/f'public/sprites/{who}/{key}-{i:02}.png');b=im.getbbox()
     if b:crops.append(im.crop(b).tobytes())
    self.assertGreater(len(set(crops)),1,key)
    self.assertEqual(len(set(crops)),len(crops),key)
 def test_stand_dissolves_to_fully_transparent_and_reappears_complete(self):
  out=ROOT/'public/sprites/the-world'
  self.assertIsNone(Image.open(out/'secondaryHidden-00.png').getbbox());self.assertIsNone(Image.open(out/'secondaryDissipate-09.png').getbbox())
  self.assertGreater(np.array(Image.open(out/'secondaryAppear-07.png'))[:,:,3].sum(),np.array(Image.open(out/'secondaryAppear-00.png'))[:,:,3].sum()*4)
 def test_zip_contains_all_character_sheets_and_data(self):
  with zipfile.ZipFile(ROOT/'public/downloads/dio-secondary.zip') as z:
   for who in ['dio','the-world']:
    m=json.loads((ROOT/f'public/sprites/{who}/secondary.json').read_text())
    for c in m['clips'].values():self.assertEqual(z.read(who+'/'+c['sheet']),(ROOT/f'public/sprites/{who}'/c['sheet']).read_bytes())
if __name__=='__main__':unittest.main(verbosity=2)
