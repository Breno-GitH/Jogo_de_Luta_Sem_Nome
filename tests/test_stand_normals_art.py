from pathlib import Path
import json,hashlib,unittest,zipfile
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
COUNTS={'forwardAttackMovement':5,'quickPunch':6,'straightPunch':7,'heavyPunch':8,'lowPunch':6,'lowSweep':7,'uppercut':8,'airQuickPunch':6,'airDoublePunch':7,'airDownwardSmash':8,'attackRecovery':4,'returnBehind':5,'comboTransition':5,'interruptRecoil':3}

class StandNormalsArtTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
    cls.dio=json.loads((ROOT/'src/data/dio.json').read_text())
    cls.manifests={n:json.loads((ROOT/f'public/sprites/{n}/{f}').read_text()) for n,f in [('dio','commands.json'),('the-world','stand-actions.json')]}
    cls.bridges=json.loads((ROOT/'public/sprites/the-world/combo-transitions.json').read_text())

 def test_all_required_sheets_and_independent_gestures_exist(self):
    world=self.manifests['the-world']['clips'];dio=self.manifests['dio']['clips']
    for k,n in COUNTS.items():self.assertEqual(world[k]['count'],n,k)
    self.assertEqual(len(dio),7);self.assertEqual(sum(c['count'] for c in dio.values()),31)
    self.assertGreaterEqual(len(self.bridges),81)
    for name,m in self.dio['moves'].items():
        self.assertIn(m['stand']['clip'],world);self.assertNotIn('optional',m['stand'])
        self.assertTrue(all(not p['hitboxes'] and 'blade' not in p for p in m['poses']),name)

 def test_all_exported_pixels_are_crisp_paletted_transparent_and_not_idle_translations(self):
    for name,manifest in self.manifests.items():
        palette={tuple(bytes.fromhex(c[1:])) for c in json.loads((ROOT/f'art/{name}/palette.json').read_text())}
        allclips={**manifest['clips'],**(self.bridges if name=='the-world' else {})}
        for key,c in allclips.items():
            sheet=Image.open(ROOT/f'public/sprites/{name}/{c["sheet"]}').convert('RGBA');self.assertEqual(sheet.size,(c['count']*256,256))
            frames=[];normalized=[]
            for i in range(c['count']):
                cell=sheet.crop((i*256,0,(i+1)*256,256));a=np.array(cell)
                self.assertEqual(set(np.unique(a[:,:,3])),{0,255},key)
                self.assertTrue(np.all(a[a[:,:,3]==0]==0));self.assertTrue(np.all(a[[0,-1]]==0));self.assertTrue(np.all(a[:,[0,-1]]==0))
                self.assertTrue(set(map(tuple,a[a[:,:,3]>0,:3])).issubset(palette),key)
                frames.append(cell.tobytes());crop=cell.crop(cell.getbbox());normalized.append((crop.size,crop.tobytes()))
            self.assertEqual(len(set(frames)),c['count'],key)
            self.assertEqual(len(set(normalized)),c['count'],key)

 def test_face_and_limb_lengths_stay_consistent(self):
    skeletons={
      'dio':{'legs':{'near':[[123,150],[111,180],[106,211]],'far':[[135,148],[145,180],[146,211]]},'arms':{'near':[[105,122],[102,141],[111,152]],'far':[[140,125],[143,140],[152,145]]}},
      'the-world':{'legs':{'near':[[125,140],[111,172],[98,201]],'far':[[140,140],[149,170],[143,195]]},'arms':{'near':[[104,102],[95,120],[113,127]],'far':[[146,107],[148,122],[160,129]]}}}
    for name,manifest in self.manifests.items():
        patch=(126,105,135,116) if name=='dio' else (136,87,145,99)
        original=np.array(Image.open(ROOT/f'art/{name}/base-native.png').convert('RGBA').crop(patch));opaque=original[:,:,3]>0
        for key,c in {**manifest['clips'],**(self.bridges if name=='the-world' else {})}.items():
            sheet=Image.open(ROOT/f'public/sprites/{name}/{c["sheet"]}').convert('RGBA')
            for i,p in enumerate(c['poses']):
                a=p['anchors'];x,y=a['headOffset'];x0,y0,x1,y1=patch
                face=np.array(sheet.crop((i*256+x0+x,y0+y,i*256+x1+x,y1+y)))
                self.assertTrue(np.array_equal(face[opaque],original[opaque]),f'{key}/{i} face')
                for kind in ['arms','legs']:
                    for side in ['near','far']:
                        rest=np.array(skeletons[name][kind][side]);actual=np.array(a[kind][side])
                        self.assertTrue(np.allclose(np.linalg.norm(np.diff(rest,axis=0),axis=1),np.linalg.norm(np.diff(actual,axis=0),axis=1),atol=.07),f'{key}/{i} {kind}/{side}')

 def test_combo_bridge_endpoints_match_the_actual_source_and_target_drawings(self):
    root=ROOT/'public/sprites/the-world'
    for key,c in self.bridges.items():
        source,index,target=key[len('bridge_'):].split('_');index=int(index)
        sheet=Image.open(root/c['sheet']).convert('RGBA');first=sheet.crop((0,0,256,256));last=sheet.crop(((c['count']-1)*256,0,c['count']*256,256))
        self.assertEqual(first.tobytes(),Image.open(root/f'{source}-{index:02}.png').convert('RGBA').tobytes(),key)
        self.assertEqual(last.tobytes(),Image.open(root/f'{target}-00.png').convert('RGBA').tobytes(),key)
        self.assertTrue(all(not p['hitboxes'] for p in c['poses']))

 def test_hitboxes_are_actual_fist_surfaces_in_the_correct_game_windows(self):
    actions=self.manifests['the-world']['clips']
    for name,m in self.dio['moves'].items():
        a=actions[m['stand']['clip']];clock=m['stand']['punchAt']
        for i,p in enumerate(a['poses']):
            matches=[w for w in m['hitWindows'] if w['fromTick']<=clock<w['toTick']]
            if p['hitboxes']:
                self.assertEqual(len(matches),1);self.assertEqual(matches[0]['id'],p['hitId'])
                self.assertEqual(len(p['hitboxes']),1);self.assertIn(p['hitboxes'][0],p['surfaces'].values())
                h=p['hitboxes'][0];self.assertLessEqual(h['w'],22);self.assertLessEqual(h['h'],22)
                self.assertLessEqual(a['bounds'][i][3]+m['stand']['front']['y'],224,f'{name}/{i} Stand below floor')
            else:self.assertFalse(matches)
            clock+=p['ticks']
        self.assertEqual(sum(p['ticks'] for p in m['poses']),m['startup']+m['active']+m['recovery'])
    self.assertEqual(len(self.dio['moves']['air_medium']['hitWindows']),2)

 def test_approved_movement_and_samurai_are_byte_identical(self):
    lock=json.loads((ROOT/'art/dio/stand-only-preservation.json').read_text())
    for name,digest in lock.items():self.assertEqual(hashlib.sha256((ROOT/'public/sprites'/name).read_bytes()).hexdigest(),digest,name)

 def test_canonical_dio_attack_files_only_contain_commands(self):
    config=json.loads((ROOT/'src/data/dio-animations.json').read_text())
    for name,m in self.dio['moves'].items():
        clip=config['clips'][name];self.assertEqual(clip['sheet'],f'dio/{name}.png')
        self.assertEqual((ROOT/f'public/sprites/dio/{name}.png').read_bytes(),(ROOT/f'public/sprites/dio/{m["commandClip"]}.png').read_bytes())
        self.assertNotEqual((ROOT/f'public/sprites/dio/{name}.png').read_bytes(),(ROOT/f'public/sprites/previous-body-attacks/dio/{name}.png').read_bytes())

 def test_download_has_all_atlases_referenced_by_its_metadata(self):
    with zipfile.ZipFile(ROOT/'public/downloads/dio-normal-attacks.zip') as z:
        for name in ['dio','the-world']:
            config=json.loads(z.read(f'{name}/animations.json'))
            for c in config['clips'].values():self.assertIn(c['sheet'],z.namelist())

if __name__=='__main__':unittest.main(verbosity=2)
