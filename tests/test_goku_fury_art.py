"""Technical cel audit, not a claim of perfect professional animation."""
import sys,unittest,json,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from goku_fury_art import ART,OUT,read,validate,import_pose
from goku_fury_source import extract
M=read(OUT/'manifest.json')['clips'];A=read(ROOT/'src/data/goku-fury-animations.json');P=read(ART/'validation.json')
class FuryArt(unittest.TestCase):
 def test_all_approved_characters_movement_normals_and_specials_are_preserved(self):
  for name,digest in read(ART/'preservation.json').items():self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest,name)
 def test_complete_whole_pose_import_no_morphing_or_limb_compositing(self):
  scales={}
  for key,r in P.items():
   source,index=key.split(':');crop,rect,seg=extract(ART/r['source'],3,3,int(index));im,off=import_pose(crop,r['scale']);self.assertEqual(list(off),r['offset']);self.assertEqual(list(rect),r['sourceRect']);validate(im,key);self.assertEqual(seg,r['segmentation']);scales.setdefault(source,set()).add(r['scale'])
  self.assertTrue(all(len(v)==1 for v in scales.values()))
 def test_all_cells_packing_binary_alpha_margins_pivots(self):
  self.assertEqual(len(M),33);self.assertEqual(read(OUT/'animations.json'),A)
  expected={f'{key}-{i:02}.png'for key,c in M.items()for i in range(c['count'])}
  actual={p.name for p in OUT.glob('*-[0-9][0-9].png')if not p.name.startswith('fx-')}
  self.assertEqual(actual,expected,'obsolete or missing standalone body cel')
  for key,c in M.items():
   sheet=Image.open(OUT/c['sheet']).convert('RGBA');cols=c['columns'];self.assertEqual(sheet.size,(cols*384,math.ceil(c['count']/cols)*256));self.assertEqual(A['clips'][key]['pivot'],{'x':192,'y':224})
   for i in range(c['count']):
    im=Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA');validate(im,f'{key}:{i}');x=i%cols*384;y=i//cols*256;self.assertEqual(im.tobytes(),sheet.crop((x,y,x+384,y+256)).tobytes())
 def test_no_duplicate_translation_only_padding_in_individual_action_clips(self):
  for key,c in M.items():
   if key=='ssj1_fury':continue # composite startup + miss recovery deliberately reuses proper phase assets
   hashes=[]
   for i in range(c['count']):
    im=Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA');b=im.crop(im.getbbox());hashes.append(hashlib.sha256(str(b.size).encode()+b.tobytes()).hexdigest())
   self.assertEqual(len(set(hashes)),len(hashes),key)
 def test_timing_not_confused_with_unique_drawings_and_first_hit_only_active(self):
  poses=read(ROOT/'src/data/goku-fury-poses.json')['poses'];self.assertEqual([p['ticks']for p in poses],M['ssj1_fury']['durations']);self.assertEqual(sum(p['ticks']for p in poses),169)
  t=0;active=[]
  for i,p in enumerate(poses):
   if p['hitboxes']:active+=list(range(t,t+p['ticks']))
   t+=p['ticks']
  self.assertEqual(active,list(range(106,111)))
  for key,c in M.items():self.assertGreaterEqual(sum(c['durations']),c['count'])
  self.assertTrue(any(sum(c['durations'])>c['count']*3 for c in M.values()))
 def test_contact_metadata_points_are_on_actual_fists_boots_and_palms(self):
  points=read(ROOT/'src/data/goku-fury-contacts.json')
  for key,p in points.items():
   im=np.array(Image.open(OUT/f'{key}-02.png').convert('RGBA'));x=p['x']+192;y=p['y']+224;self.assertTrue(np.any(im[y-3:y+4,x-3:x+4,3]),key)
 def test_gold_and_base_return_are_actual_hair_drawings_not_global_tints(self):
  def gold(key,i):
   a=np.array(Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA'));m=(a[:,:,3]>0)&(np.indices(a.shape[:2])[0]<143);return int(np.count_nonzero(m&(a[:,:,0]>180)&(a[:,:,1]>140)&(a[:,:,2]<145)))
  self.assertGreater(gold('furyTransformationFinish',1),gold('furySuperActivationStart',0)+50);self.assertGreater(gold('furyHairColorTransition',0),gold('furyHairColorTransition',3)+40)
 def test_reviewed_energy_origin_follows_the_cupped_palms_not_the_elbow(self):
  release=read(ROOT/'src/data/goku-fury-release.json')
  for key,entries in release.items():
   for i,p in enumerate(entries):
    a=np.array(Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA'));x=p['x']+192;y=p['y']+224;self.assertTrue(np.any(a[y-3:y+4,x-3:x+4,3]),(key,i))
    if key=='furyKamehamehaPreparation'or(key=='furyFuriousExpression'and i<2):self.assertLess(p['x'],-10)
 def test_all_real_apng_frames_match_exported_pngs(self):
  for key,c in M.items():
   with Image.open(OUT/f'{key}-animated.png')as apng:
    self.assertEqual(apng.n_frames,c['count'],key)
    for i in range(c['count']):apng.seek(i);self.assertEqual(apng.convert('RGBA').tobytes(),Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA').tobytes())
 def test_fx_are_separate_bounded_transparent_pixel_atlases(self):
  data=read(ROOT/'src/data/goku-fury-fx.json');self.assertEqual(len(data['clips']),14)
  for key,c in data['clips'].items():
   im=Image.open(ROOT/'public/sprites'/c['sheet']).convert('RGBA');a=np.array(im);cell=c.get('cell',128);self.assertEqual(im.size,(cell*c['frames'],cell));self.assertTrue(set(np.unique(a[:,:,3]))<={0,255});self.assertTrue(np.all(a[a[:,:,3]==0]==0));self.assertLess(np.count_nonzero(a[:,:,3]),im.width*im.height*.85)
if __name__=='__main__':unittest.main(verbosity=2)
