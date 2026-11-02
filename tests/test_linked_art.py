from pathlib import Path
import hashlib
import json
import unittest
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

class LinkedArtTests(unittest.TestCase):
    def test_independent_native_bases_are_transparent_and_have_requested_heights(self):
        digests=[]
        for name,height in [('dio',130),('the-world',155)]:
            path=ROOT/f'public/sprites/{name}/base.png';im=Image.open(path).convert('RGBA');a=np.array(im)
            self.assertEqual(im.size,(256,256));self.assertEqual(im.getbbox()[3]-im.getbbox()[1],height)
            self.assertEqual(im.getbbox()[3],224)
            self.assertEqual(set(np.unique(a[:,:,3])),{0,255})
            self.assertTrue(np.all(a[a[:,:,3]==0]==0));self.assertTrue(np.all(a[[0,-1]]==0));self.assertTrue(np.all(a[:,[0,-1]]==0))
            colors=set(map(tuple,a[a[:,:,3]!=0,:3]));self.assertLessEqual(len(colors),35)
            digests.append(hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertNotEqual(*digests)

    def test_original_source_pose_is_separate_from_the_new_animation_atlases(self):
        for name in ['dio','the-world']:
            data=json.loads((ROOT/f'public/sprites/{name}/animations.json').read_text())
            self.assertEqual(data,json.loads((ROOT/f'src/data/{name}-animations.json').read_text()))
            self.assertEqual(data['pivot'],{'x':128,'y':224});self.assertEqual(data['clips']['base']['frames'],[0])
            self.assertEqual((ROOT/f'art/{name}/base-native.png').read_bytes(),(ROOT/f'public/sprites/{name}/base.png').read_bytes())

    def test_adding_the_new_bases_does_not_change_any_samurai_png(self):
        records=json.loads((ROOT/'art/dio/samurai-preservation.json').read_text(encoding='utf-8-sig'))
        for name,digest in records.items():
            self.assertEqual(hashlib.sha256((ROOT/'public/sprites/samurai'/name).read_bytes()).hexdigest(),digest)

if __name__=='__main__':unittest.main(verbosity=2)
