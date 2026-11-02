import hashlib
import json
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/sprites/samurai'


class CompleteArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.clips=json.loads((OUT/'complete.json').read_text())['clips']
        cls.config=json.loads((ROOT/'src/data/animations.json').read_text())['clips']
        cls.character=json.loads((ROOT/'src/data/samurai.json').read_text())

    def test_previous_art_bytes_preserved(self):
        for lock in ['idle-lock.json','movement-lock.json','normal-lock.json']:
            for file,digest in json.loads((ROOT/'art/samurai'/lock).read_text()).items():
                self.assertEqual(hashlib.sha256((OUT/file).read_bytes()).hexdigest(),digest,file)

    def test_complete_required_actions_and_native_transparent_atlases(self):
        self.assertEqual(len(self.clips),36)
        self.assertEqual(sum(c['count'] for c in self.clips.values()),203)
        for name,clip in self.clips.items():
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA');data=np.array(sheet)
            p2=np.array(Image.open(OUT/clip['player2Sheet']).convert('RGBA'))
            self.assertEqual(sheet.size,(256*clip['count'],256),name)
            self.assertEqual(set(np.unique(data[:,:,3])),{0,255},name)
            self.assertTrue(np.array_equal(data[:,:,3],p2[:,:,3]),name)
            self.assertTrue(np.any(data[:,:,:3]!=p2[:,:,:3]),name)
            self.assertTrue(np.all(data[data[:,:,3]==0]==0),name)
            self.assertEqual(self.config[name]['pivot'],{'x':128,'y':224})
            self.assertEqual(self.config[name]['durations'],clip['durations'])
            for i in range(clip['count']):
                cell=sheet.crop((i*256,0,(i+1)*256,256))
                self.assertEqual(cell.tobytes(),Image.open(OUT/f'{name}-{i:02}.png').convert('RGBA').tobytes())
                bounds=cell.getbbox();self.assertTrue(0<bounds[0]<bounds[2]<256,name)
                self.assertTrue(0<bounds[1]<bounds[3]<256,name)
                if clip['grounded']:self.assertEqual(bounds[3],224,name)

    def test_nonlooping_actions_have_distinct_articulated_poses(self):
        for name,clip in self.clips.items():
            sheet=Image.open(OUT/clip['sheet']).convert('RGBA')
            # Cropped silhouettes catch whole-cell translations masquerading as
            # animation. Breathing loops intentionally revisit their key poses.
            frames=[sheet.crop((i*256,0,(i+1)*256,256)) for i in range(clip['count'])]
            shapes=[cell.crop(cell.getbbox()).tobytes() for cell in frames]
            if not clip['loop']:self.assertEqual(len(set(shapes)),clip['count'],name)
            else:self.assertGreaterEqual(len(set(shapes)),3,name)

    def test_collision_holds_match_visual_holds_and_attack_phases(self):
        for name,clip in self.clips.items():
            reactions=self.character['reactions'][name]
            self.assertEqual([p['ticks'] for p in reactions['poses']],clip['durations'])
            self.assertEqual([p['hurtboxes'] for p in reactions['poses']],clip['hurtboxes'])
            self.assertTrue(all(r['w']>0 and r['h']>0 for pose in clip['hurtboxes'] for r in pose),name)
            if 'combat' not in clip or name=='throw':continue
            move=clip['combat'];self.assertEqual(move,self.character['moves'][name])
            for phase in ['startup','active','recovery']:
                self.assertEqual(move[phase],sum(p['ticks'] for p in move['poses'] if p['phase']==phase),name)

    def test_active_blades_follow_metal_pixels(self):
        steel=[list(bytes.fromhex(c)) for c in ['f1f5f5','d3d8df','a5a4ae','777280']]
        for name,clip in self.clips.items():
            if 'combat' not in clip or name=='throw':continue
            sheet=np.array(Image.open(OUT/clip['sheet']).convert('RGBA'))
            for i,pose in enumerate(clip['combat']['poses']):
                if pose['phase']!='active':continue
                cell=sheet[:,i*256:(i+1)*256];mask=np.zeros((256,256),bool)
                for rgb in steel:mask|=np.all(cell[:,:,:3]==rgb,axis=2)&(cell[:,:,3]>0)
                points=np.argwhere(mask)[:,::-1].astype(float)
                blade=pose['blade'];a=np.array([blade['a']['x']+128,blade['a']['y']+224]);b=np.array([blade['b']['x']+128,blade['b']['y']+224]);v=b-a
                t=np.clip((points-a)@v/(v@v),0,1);distance=np.linalg.norm(points-(a+t[:,None]*v),axis=1)
                self.assertGreater(np.count_nonzero(distance<=blade['r']+1),25,f'{name}:{i}')

    def test_effects_are_separate_native_pixel_transparent_cells(self):
        data=np.array(Image.open(ROOT/'public/sprites/fx/samurai-fx.png').convert('RGBA'))
        self.assertEqual(data.shape,(448,384,4));self.assertEqual(set(np.unique(data[:,:,3])),{0,255})
        for row in range(7):
            frames=[data[row*64:(row+1)*64,i*64:(i+1)*64] for i in range(6)]
            self.assertEqual(len({f.tobytes() for f in frames}),6)


if __name__=='__main__':unittest.main(verbosity=2)
