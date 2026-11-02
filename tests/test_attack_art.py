import hashlib
import json
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/sprites/samurai'
COUNTS={f'{stance}_{power}':count for stance in ['stand','crouch','air'] for power,count in [('light',4),('medium',5),('heavy',6)]}


class AttackArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((OUT/'attacks.json').read_text())
        cls.config=json.loads((ROOT/'src/data/animations.json').read_text())
        cls.character=json.loads((ROOT/'src/data/samurai.json').read_text())
        cls.base=Image.open(OUT/'base.png').convert('RGBA')

    def test_exactly_nine_attacks_and_45_distinct_poses(self):
        self.assertEqual(set(self.manifest['clips']),set(COUNTS));all_frames=[]
        for name,count in COUNTS.items():
            clip=self.manifest['clips'][name];self.assertEqual(clip['count'],count)
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA');self.assertEqual(sheet.size,(count*256,256))
            for i in range(count):
                frame=sheet.crop((i*256,0,(i+1)*256,256));all_frames.append(frame.tobytes())
        self.assertEqual(len(all_frames),45);self.assertEqual(len(set(all_frames)),45)

    def test_timings_are_identical_in_combat_atlas_and_clip(self):
        for name,clip in self.manifest['clips'].items():
            move=self.character['moves'][name];self.assertEqual(move,clip['combat'])
            self.assertEqual(clip['durations'],[pose['ticks'] for pose in move['poses']])
            self.assertEqual(clip['durations'],self.config['clips'][name]['durations'])
            for phase,key in [('startup','startup'),('active','active'),('recovery','recovery')]:
                self.assertEqual(move[key],sum(p['ticks'] for p in move['poses'] if p['phase']==phase))
            self.assertFalse(self.config['clips'][name]['loop']);self.assertEqual(self.config['clips'][name]['pivot'],{'x':128,'y':224})

    def test_approved_movement_and_face_are_preserved(self):
        locks=json.loads((ROOT/'art/samurai/movement-lock.json').read_text())
        for name,digest in locks.items():self.assertEqual(hashlib.sha256((OUT/name).read_bytes()).hexdigest(),digest,name)
        patch=(134,116,141,124);reference=self.base.crop(patch).tobytes()
        for name,clip in self.manifest['clips'].items():
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA')
            for i,(dx,dy) in enumerate(clip['headOffsets']):
                x0,y0,x1,y1=patch
                self.assertEqual(sheet.crop((i*256+x0+dx,y0+dy,i*256+x1+dx,y1+dy)).tobytes(),reference,f'{name}:{i}')

    def test_binary_alpha_palette_pivot_and_player_two(self):
        source_colors={tuple(p) for p in np.array(self.base).reshape(-1,4).tolist()}
        for name,clip in self.manifest['clips'].items():
            sheet=np.array(Image.open(OUT/clip['sheet']).convert('RGBA'))
            p2=np.array(Image.open(OUT/clip['player2Sheet']).convert('RGBA'))
            self.assertEqual(set(np.unique(sheet[:,:,3])),{0,255});self.assertTrue(np.array_equal(sheet[:,:,3],p2[:,:,3]))
            self.assertTrue({tuple(p) for p in sheet.reshape(-1,4).tolist()}.issubset(source_colors))
            for i in range(clip['count']):
                cell=sheet[:,i*256:(i+1)*256]
                self.assertTrue(np.all(cell[[0,-1]]==0));self.assertTrue(np.all(cell[:,[0,-1]]==0))
                if clip['grounded']:self.assertTrue(np.all(cell[224:]==0))

    def test_capsule_geometry_follows_visible_metal_in_every_pose(self):
        steel=[bytes.fromhex(c) for c in ['f1f5f5','d3d8df','a5a4ae','777280']]
        for name,clip in self.manifest['clips'].items():
            sheet=np.array(Image.open(OUT/clip['sheet']).convert('RGBA'))
            for i,pose in enumerate(clip['combat']['poses']):
                cell=sheet[:,i*256:(i+1)*256];mask=np.zeros((256,256),bool)
                for rgb in steel:mask|=np.all(cell[:,:,:3]==list(rgb),axis=2)&(cell[:,:,3]>0)
                points=np.argwhere(mask)[:,::-1].astype(float)
                blade=pose['blade'];a=np.array([blade['a']['x']+128,blade['a']['y']+224]);b=np.array([blade['b']['x']+128,blade['b']['y']+224])
                direction=b-a;time=np.clip((points-a)@direction/(direction@direction),0,1)
                distance=np.linalg.norm(points-(a+time[:,None]*direction),axis=1)
                self.assertGreater(np.count_nonzero(distance<=blade['r']+1),25,f'{name}:{i}')
                self.assertTrue(all(box['w']>0 and box['h']>0 for box in pose['hurtboxes']))


if __name__=='__main__':unittest.main(verbosity=2)
