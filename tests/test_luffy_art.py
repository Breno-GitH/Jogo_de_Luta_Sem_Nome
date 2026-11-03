"""Technical checks complement (not replace) real visual inspection."""
import sys,json,hashlib,unittest
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_luffy import base,side_model,swap,P,RIG
OUT=ROOT/'public/sprites/luffy'

class LuffyFoundation(unittest.TestCase):
 def test_full_native_body_with_safe_margins_and_ground(self):
  for frame in [base(e) for e in ['grin','determined','surprise']]+[side_model()]:
   self.assertEqual(frame.size,(256,256));b=frame.getbbox()
   self.assertEqual((b[1],b[3]),(94,224));self.assertGreaterEqual(b[0],32);self.assertLessEqual(b[2],224)
   self.assertEqual(set(np.unique(np.array(frame)[:,:,3])),{0,255})
   self.assertGreater(np.count_nonzero(np.array(frame)[214:224,:,3]),60)
 def test_palette_is_exact_and_no_hidden_rgb_noise(self):
  colors={tuple(bytes.fromhex(v[1:])) for v in P.values()}
  im=np.array(Image.open(OUT/'base.png').convert('RGBA'))
  self.assertTrue({tuple(v) for v in im[:,:,:3][im[:,:,3]>0]}.issubset(colors))
  self.assertEqual(len(P),35)
  self.assertTrue(np.all(im[im[:,:,3]==0]==0))
 def test_connected_body_no_erased_parts(self):
  a=np.array(base())[:,:,3]>0
  unseen=set(map(tuple,np.argwhere(a)));components=[]
  while unseen:
   p=unseen.pop();stack=[p];count=0
   while stack:
    y,x=stack.pop();count+=1
    for dy in [-1,0,1]:
     for dx in [-1,0,1]:
      q=y+dy,x+dx
      if q in unseen:unseen.remove(q);stack.append(q)
   components.append(count)
  self.assertEqual(len(components),1)
  # Visible front/rear hands, hat, feet, torso and yellow sash.
  for x,y in [(174,143),(128,155),(133,98),(106,220),(154,220),(130,146),(129,165)]:
   self.assertTrue(a[y,x],(x,y))
 def test_distinct_faces_without_changed_body(self):
  poses=[np.array(base(e)) for e in ['grin','determined','surprise']]
  for im in poses[1:]:
   self.assertTrue(np.array_equal(poses[0][133:],im[133:]))
   self.assertTrue(np.array_equal(poses[0][:110],im[:110]))
   self.assertFalse(np.array_equal(poses[0],im))
 def test_real_atlas_cells_and_exact_nearest_preview(self):
  sheet=Image.open(OUT/'expressions.png')
  self.assertEqual(sheet.size,(768,256))
  for i,e in enumerate(['grin','determined','surprise']):
   self.assertEqual(sheet.crop((256*i,0,256*(i+1),256)).tobytes(),base(e).tobytes())
  im=np.array(Image.open(OUT/'base-preview-4x.png'))
  for y in range(4):
   for x in range(4):self.assertTrue(np.array_equal(im[::4,::4],im[y::4,x::4]))
 def test_components_and_palette_do_not_recolor_face(self):
  im=base();alternate=swap(im)
  self.assertEqual(im.crop((126,94,149,127)).tobytes(),alternate.crop((126,94,149,127)).tobytes())
  self.assertEqual(im.getchannel('A').tobytes(),alternate.getchannel('A').tobytes())
  self.assertEqual(Image.open(OUT/'fist.png').size,(19,18))
  self.assertLess(np.count_nonzero(np.array(Image.open(OUT/'body.png'))[:,:,3]),np.count_nonzero(np.array(im)[:,:,3]))
 def test_rig_and_exports_are_reproducible(self):
  self.assertEqual(json.loads((OUT/'rig.json').read_text()),RIG)
  self.assertEqual(Image.open(OUT/'base.png').tobytes(),base().tobytes())
  self.assertEqual(RIG['points']['footBack'][1],223)
  self.assertFalse(RIG['elastic']['activeInGameplay'])
  for name,(x,y) in RIG['points'].items():self.assertTrue(32<=x<224 and 32<=y<224,name)

if __name__=='__main__':unittest.main()
