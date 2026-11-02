"""ALL Goku whole-pose integrity/provenance. Numeric checks do not certify art.
The full-rebuild user request supersedes the old139 Goku PNG freeze; other
characters and simulation physics remain locked. Browser review is separate.
"""
import unittest,json,sys,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from goku_rebuild import ART,OUT,PAL,THRESHOLD,protect,validate,extract_sheet
def read(p):return json.loads(p.read_text(encoding='utf-8'))
M=read(OUT/'movement.json');A=read(ROOT/'src/data/goku-animations.json');CONFIG=read(ART/'sources.json')
P={key:clip for stage in CONFIG['stages'] for key,clip in read(ART/f'{stage}-production.json')['clips'].items()}
def cell(k,i):return Image.open(OUT/f'{k}-{i:02}.png').convert('RGBA')

class CompleteGokuRebuild(unittest.TestCase):
 def test_all_old_and_new_clips_use_whole_drawings(self):
  self.assertTrue(set(read(ART/'animation-inventory.json'))<=set(P));self.assertEqual(set(P),set(M['clips']));self.assertEqual(set(P),set(A['clips']))
  self.assertEqual(M['rebuildRevision'],5)
  for k,c in M['clips'].items():
   self.assertEqual(c['method'],'whole-pose',k);self.assertEqual(c['count'],len(P[k]['frames']),k)
   self.assertFalse(c.get('internal'));self.assertFalse(c.get('externalGeometry'));self.assertFalse(k.startswith('walkStop'))
 def test_complete_connected_alpha_and_safe_margins_for_every_cel(self):
  for k,c in M['clips'].items():
   for i in range(c['count']):
    with self.subTest(clip=k,frame=i):
     im=cell(k,i);validate(im,f'{k}/{i}',c['grounded'],32,145)
     self.assertEqual(list(im.getbbox()),c['bounds'][i]);self.assertTrue(c['poses'][i]['wholePose'])
 def test_exact_uniform_whole_source_import_no_limb_reconstruction(self):
  for k,c in P.items():
   for i,r in enumerate(c['frames']):
    with self.subTest(clip=k,frame=i):
     source=Image.open(ROOT/r['source']).convert('RGBA')
     if 'rawSource'not in r:source=source.crop(r['sourceRect'])
     source.putalpha(source.getchannel('A').point(lambda a:255 if a>=THRESHOLD else 0))
     small=source.resize(tuple(round(v*r['scale'])for v in source.size),Image.Resampling.NEAREST)
     q=small.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'))
     a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a);out=Image.new('RGBA',(256,256));out.paste(q,tuple(r['offset']))
     self.assertEqual(out.tobytes(),cell(k,i).tobytes())
     b=q.getbbox();x,y=r['offset'];self.assertTrue(8<=b[0]+x and 8<=b[1]+y and b[2]+x<=248 and b[3]+y<=224)
 def test_one_scale_per_calibration_sheet_not_per_pose(self):
  scales={}
  for c in P.values():
   for r in c['frames']:
    if 'rawSource'in r:continue
    source=r['source'];scales.setdefault(source,set()).add(r['scale'])
    crop,_,_=extract_sheet(ROOT/source,3,2 if source.endswith('idle-source-attempt1.png')else 3,0)
    self.assertAlmostEqual(r['scale'],130/crop.height)
  self.assertTrue(all(len(v)==1 for v in scales.values()))
 def test_packing_reconstructs_standalone_cells_and_individual_durations(self):
  self.assertEqual(A['pivot'],{'x':128,'y':224});self.assertEqual(M['cell'],[256,256])
  for k,c in M['clips'].items():
   a=A['clips'][k];cols=a['columns'];sheet=Image.open(OUT/c['sheet']).convert('RGBA')
   self.assertEqual(sheet.size,(256*cols,256*math.ceil(c['count']/cols)),k)
   self.assertEqual(a['frames'],list(range(c['count'])));self.assertEqual(a['durations'],c['durations']);self.assertEqual(len(c['durations']),c['count'])
   self.assertTrue(all(isinstance(t,int)and t>0 for t in c['durations']))
   for i in range(c['count']):
    x=i%cols*256;y=i//cols*256;self.assertEqual(sheet.crop((x,y,x+256,y+256)).tobytes(),cell(k,i).tobytes(),f'{k}/{i}')
 def test_no_translated_duplicate_cels_inside_a_clip(self):
  for k,c in M['clips'].items():
   hashes=[]
   for i in range(c['count']):
    im=cell(k,i);crop=im.crop(im.getbbox());hashes.append(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest())
   self.assertEqual(len(set(hashes)),len(hashes),k)
 def test_anatomical_pose_depth_and_whole_frame_seams(self):
  self.assertLess(max(b[3]-b[1]for b in M['clips']['crouchIdle']['bounds']),100)
  self.assertGreater(M['clips']['idle']['bounds'][0][3]-M['clips']['idle']['bounds'][0][1],125)
  self.assertEqual(cell('crouchStart',0).tobytes(),cell('idle',3).tobytes());self.assertEqual(cell('crouchEnd',M['clips']['crouchEnd']['count']-1).tobytes(),cell('idle',0).tobytes())
  for s in ['', 'Forward','Backward']:
   self.assertEqual(cell('jumpFall'+s,2).tobytes(),cell('landing'+s,0).tobytes());self.assertEqual(sum(M['clips']['landing'+s]['durations']),8)
 def test_drawings_not_confused_with_ticks_and_air_has_tucked_legs(self):
  self.assertEqual(sum(M['clips']['jumpStart']['durations']),6)
  for k in ['walkForward','walkBack']:self.assertEqual(sum(M['clips'][k]['durations']),36);self.assertEqual(M['clips'][k]['count'],8)
  for s in ['', 'Forward','Backward']:
   c=M['clips']['jumpApex'+s];self.assertTrue(any(b[3]<224 for b in c['bounds']));self.assertEqual(c['count'],2);self.assertEqual(sum(c['durations']),8)
 def test_hurtboxes_cover_opaque_pose_and_no_offensive_boxes(self):
  for k,c in M['clips'].items():
   for i,p in enumerate(c['poses']):
    a=np.array(cell(k,i))[:,:,3]>0;cover=np.zeros_like(a)
    for b in p['hurtboxes']:
     x=b['x']+128;y=b['y']+224;cover[y:y+b['h'],x:x+b['w']]=True
    self.assertTrue(np.all(cover[a]),f'{k}/{i}');self.assertEqual(p['hitboxes'],[])
 def test_other_characters_and_shared_physics_remain_exact(self):protect()
 def test_base_and_manifest_match_the_current_export(self):
  self.assertEqual((OUT/'base.png').read_bytes(),(OUT/'idle-00.png').read_bytes());self.assertEqual(read(OUT/'animations.json'),A);self.assertEqual(read(OUT/'manifest.json')['revision'],5)

if __name__=='__main__':unittest.main(verbosity=2)
