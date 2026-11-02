from pathlib import Path
import hashlib
import json
import unittest
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/sprites/samurai'
COUNTS={'idle':6,'walkForward':6,'walkBack':6,'dashForward':5,'backdash':5,
        'crouchStart':2,'crouchIdle':2,'crouchEnd':2,'jumpStart':3,'jumpRise':2,
        'jumpApex':1,'jumpFall':2,'landing':3}


class MovementArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((OUT/'movement.json').read_text(encoding='utf-8'))
        cls.base=Image.open(OUT/'base.png').convert('RGBA')

    def test_all_required_counts_and_pivots(self):
        self.assertEqual(set(self.manifest['clips']),set(COUNTS))
        config=json.loads((ROOT/'src/data/animations.json').read_text(encoding='utf-8'))
        for name,count in COUNTS.items():
            clip=self.manifest['clips'][name]
            self.assertEqual(clip['count'],count)
            self.assertEqual(len(clip['durations']),count)
            self.assertTrue(all(d>0 for d in clip['durations']))
            self.assertEqual(config['clips'][name]['pivot'],{'x':128,'y':224})
            self.assertEqual(config['clips'][name]['scale'],1)

    def test_approved_idle_bytes_are_untouched(self):
        locks=json.loads((ROOT/'art/samurai/idle-lock.json').read_text())
        for name,digest in locks.items():
            self.assertEqual(hashlib.sha256((OUT/name).read_bytes()).hexdigest(),digest)

    def test_transparent_native_pixel_atlases_and_real_poses(self):
        base_colors={tuple(p) for p in np.array(self.base).reshape(-1,4).tolist()}
        for name,count in COUNTS.items():
            clip=self.manifest['clips'][name]
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA')
            self.assertEqual(sheet.size,(256*count,256))
            frames=[];normalized=[]
            for i in range(count):
                cell=sheet.crop((256*i,0,256*(i+1),256))
                data=np.array(cell)
                self.assertEqual(set(np.unique(data[:,:,3])),{0,255})
                self.assertTrue(np.all(data[[0,-1]]==0));self.assertTrue(np.all(data[:,[0,-1]]==0))
                self.assertTrue({tuple(p) for p in data.reshape(-1,4).tolist()}.issubset(base_colors))
                frames.append(cell.tobytes());normalized.append(cell.crop(cell.getbbox()).tobytes())
            self.assertEqual(len(set(frames)),count,name)
            self.assertEqual(len(set(normalized)),count,name)

    def test_face_pixels_are_rigid_and_never_redrawn(self):
        patch=(134,116,141,124)
        source=self.base.crop(patch).tobytes()
        for name,clip in self.manifest['clips'].items():
            if name=='idle':continue
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA')
            for i,(dx,dy) in enumerate(clip['headOffsets']):
                x0,y0,x1,y1=patch
                self.assertEqual(sheet.crop((i*256+x0+dx,y0+dy,i*256+x1+dx,y1+dy)).tobytes(),source,f'{name}:{i}')

    def test_grounded_contact_and_no_art_below_floor(self):
        for name,clip in self.manifest['clips'].items():
            if not clip['grounded']:continue
            for i,bounds in enumerate(clip['bounds']):
                self.assertLessEqual(bounds[3],224,f'{name}:{i} below floor')
                if name!='backdash':self.assertEqual(bounds[3],224,f'{name}:{i} missing planted contact')

    def test_palette_two_matches_geometry(self):
        for name,clip in self.manifest['clips'].items():
            p1=np.array(Image.open(OUT/clip['sheet']).convert('RGBA'))
            p2=np.array(Image.open(OUT/clip['player2Sheet']).convert('RGBA'))
            self.assertEqual(p1.shape,p2.shape);self.assertTrue(np.array_equal(p1[:,:,3],p2[:,:,3]))
            self.assertFalse(np.array_equal(p1,p2))


if __name__=='__main__':unittest.main(verbosity=2)
