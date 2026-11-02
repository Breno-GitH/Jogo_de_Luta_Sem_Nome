from pathlib import Path
import json
import hashlib
import unittest
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
COUNTS={
 'dio':{'idle':6,'walkForward':40,'walkBack':40,'dashForward':6,'backdash':6,'crouchStart':4,'crouchIdle':3,'crouchEnd':4,'jumpStart':3,'jumpRise':3,'jumpApex':2,'jumpFall':3,'landing':4,
        'jumpRiseForward':3,'jumpApexForward':2,'jumpFallForward':3,'jumpRiseBackward':3,'jumpApexBackward':2,'jumpFallBackward':3},
 'the-world':{'standIdle':6,'floating':6,'followForward':6,'followBackward':6,'dashFollow':5,'jumpFollow':4,'returnPosition':5},
}
class LinkedMovementArtTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
    cls.manifests={name:json.loads((ROOT/f'public/sprites/{name}/movement.json').read_text()) for name in COUNTS}

 def test_twenty_six_clips_and_178_real_cells(self):
    for name,counts in COUNTS.items():
        manifest=self.manifests[name];config=json.loads((ROOT/f'src/data/{name}-animations.json').read_text())
        self.assertEqual(set(manifest['clips']),set(counts));self.assertEqual(config['pivot'],{'x':128,'y':224});self.assertEqual(config['scale'],1)
        for key,count in counts.items():
            clip=manifest['clips'][key];self.assertEqual(clip['count'],count)
            self.assertEqual(config['clips'][key]['durations'],clip['durations'])
            self.assertEqual(len(clip['durations']),count);self.assertTrue(all(t>0 for t in clip['durations']))

 def test_exported_pixels_are_clean_and_have_no_translations_masquerading_as_poses(self):
    for name,manifest in self.manifests.items():
        palette={tuple(bytes.fromhex(c[1:])) for c in json.loads((ROOT/f'art/{name}/palette.json').read_text())}
        for key,clip in manifest['clips'].items():
            sheet=Image.open(ROOT/f'public/sprites/{name}/{clip["sheet"]}').convert('RGBA')
            self.assertEqual(sheet.size,(256*clip['count'],256));frames=[];shapes=[]
            for i in range(clip['count']):
                cell=sheet.crop((i*256,0,(i+1)*256,256));a=np.array(cell)
                self.assertEqual(cell.tobytes(),Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png').convert('RGBA').tobytes())
                self.assertEqual(set(np.unique(a[:,:,3])),{0,255});self.assertTrue(np.all(a[a[:,:,3]==0]==0))
                self.assertTrue(np.all(a[[0,-1]]==0));self.assertTrue(np.all(a[:,[0,-1]]==0))
                self.assertTrue(set(map(tuple,a[a[:,:,3]>0,:3])).issubset(palette))
                crop=cell.crop(cell.getbbox());frames.append(cell.tobytes());shapes.append((crop.size,crop.tobytes()))
            self.assertEqual(len(set(frames)),clip['count'],f'{name}/{key}')
            self.assertEqual(len(set(shapes)),clip['count'],f'{name}/{key}')

 def test_approved_bases_and_opaque_face_pixels_are_preserved(self):
    for name,manifest in self.manifests.items():
        file=ROOT/f'art/{name}/base-native.png';self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(),manifest['baseSha256'])
        patch=(126,105,135,116) if name=='dio' else (136,87,145,99)
        original=np.array(Image.open(file).convert('RGBA').crop(patch));opaque=original[:,:,3]>0
        for key,clip in manifest['clips'].items():
            for i,anchors in enumerate(clip['anchors']):
                x,y=anchors['headOffset'];x0,y0,x1,y1=patch
                image=Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png').convert('RGBA')
                actual=np.array(image.crop((x0+x,y0+y,x1+x,y1+y)))
                self.assertTrue(np.array_equal(actual[opaque],original[opaque]),f'{name}/{key}:{i} face')

 def test_bones_do_not_stretch_and_grounded_images_do_not_penetrate_floor(self):
    skeletons={
      'dio':{'legs':{'near':[[123,150],[111,180],[106,211]],'far':[[135,148],[145,180],[146,211]]},'arms':{'near':[[105,122],[102,141],[111,152]],'far':[[140,125],[143,140],[152,145]]}},
      'the-world':{'legs':{'near':[[125,140],[111,172],[98,201]],'far':[[140,140],[149,170],[143,195]]},'arms':{'near':[[104,102],[95,120],[113,127]],'far':[[146,107],[148,122],[160,129]]}},
    }
    for name,manifest in self.manifests.items():
        for key,clip in manifest['clips'].items():
            for i,anchors in enumerate(clip['anchors']):
                for part in ['legs','arms']:
                    for side in ['near','far']:
                        rest=np.array(skeletons[name][part][side]);actual=np.array(anchors[part][side])
                        self.assertTrue(np.allclose(np.linalg.norm(np.diff(rest,axis=0),axis=1),np.linalg.norm(np.diff(actual,axis=0),axis=1),atol=.07),f'{name}/{key}:{i} {part}/{side}')
                if clip['grounded']:
                    im=np.array(Image.open(ROOT/f'public/sprites/{name}/{key}-{i:02}.png'))
                    self.assertTrue(np.all(im[224:]==0))
                    if anchors.get('support'):self.assertEqual(clip['bounds'][i][3],224,f'{key}:{i} support')

 def test_walk_keys_match_real_walk_speed_during_plant(self):
    movement=json.loads((ROOT/'src/data/dio-movement.json').read_text())
    for key,direction in [('walkForward',1),('walkBack',-1)]:
        clip=self.manifests['dio']['clips'][key];checks=0
        speed=movement['walkSpeed' if direction==1 else 'backSpeed']
        for side in ['near','far']:
            floor_y=211 if side=='near' else 214
            for i in range(clip['count']):
                a=np.array(clip['anchors'][i]['legs'][side][2]);b=np.array(clip['anchors'][(i+1)%clip['count']]['legs'][side][2])
                if side in clip['anchors'][i]['support'] and side in clip['anchors'][(i+1)%clip['count']]['support']:
                    slip=clip['durations'][i]*speed*direction+b[0]-a[0]
                    self.assertLess(abs(slip),1,f'{key}:{side}:{i}');checks+=1
        self.assertGreaterEqual(checks,38,key)

 def test_previous_release_is_immutable_and_new_poses_are_actually_replaced(self):
    archive=ROOT/'public/sprites/previous-movement'
    for file,digest in json.loads((archive/'archive.json').read_text())['files'].items():
        self.assertEqual(hashlib.sha256((archive/file).read_bytes()).hexdigest(),digest)
    for name,manifest in self.manifests.items():
        for key in manifest['clips']:
            old=archive/name/(key+'.png')
            if old.exists():self.assertNotEqual(old.read_bytes(),(ROOT/f'public/sprites/{name}/{key}.png').read_bytes(),f'{name}/{key}')

 def test_walks_have_opposite_plant_and_swing_phases_and_different_drawings(self):
    clips=self.manifests['dio']['clips']
    for key in ['walkForward','walkBack']:
        c=clips[key];self.assertEqual(c['authoredKeys'],8);self.assertEqual(c['durations'],[1]*40)
        for side in ['near','far']:
            samples=c['anchors'];heights=[a['legs'][side][2][1] for a in samples]
            self.assertGreater(max(heights)-min(heights),8)
            self.assertGreaterEqual(sum(side in a['support'] for a in samples),20)
    forward=Image.open(ROOT/'public/sprites/dio/walkForward.png')
    backward=Image.open(ROOT/'public/sprites/dio/walkBack.png')
    self.assertNotEqual(forward.tobytes(),backward.tobytes())

 def test_world_far_arm_has_no_duplicate_hand_spikes_outside_the_actual_limb(self):
    def distance(p,a,b):
        v=b-a;t=np.clip(np.dot(p-a,v)/max(.01,np.dot(v,v)),0,1)
        return np.linalg.norm(p-a-t*v)
    for key,c in self.manifests['the-world']['clips'].items():
        for i,anchors in enumerate(c['anchors']):
            im=np.array(Image.open(ROOT/f'public/sprites/the-world/{key}-{i:02}.png'))
            arm=np.array(anchors['arms']['far'])
            # Right of the chest, below the helmet and above the hanging belt:
            # source finger pixels
            # accidentally included in an upper-arm cut escaped this envelope.
            for y,x in np.argwhere(im[:,:,3]>0):
                if x>155 and 104<=y<133:
                    d=min(distance(np.array([x,y]),a,b) for a,b in zip(arm,arm[1:]))
                    self.assertLessEqual(d,16,f'{key}:{i} stray arm pixel at {x},{y}')

if __name__=='__main__':unittest.main(verbosity=2)
