from pathlib import Path
import hashlib,json,unittest,zipfile
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

class DioSpecialArt(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
    cls.manifests={who:json.loads((ROOT/f'public/sprites/{who}/specials.json').read_text()) for who in ['dio','the-world']}
    cls.moves=json.loads((ROOT/'src/data/dio-special-moves.json').read_text())
 def test_preserves_every_approved_png_character_and_clip(self):
    lock=json.loads((ROOT/'art/dio/specials-preservation.json').read_text())
    for f,digest in lock['images'].items():self.assertEqual(hashlib.sha256((ROOT/f).read_bytes()).hexdigest(),digest,f)
    for who,old in lock['animations'].items():
        current=json.loads((ROOT/f'src/data/{who}-animations.json').read_text())
        for name,c in old['clips'].items():self.assertEqual(c,current['clips'][name],name)
    for who in ['dio','samurai']:self.assertEqual(hashlib.sha256((ROOT/f'src/data/{who}.json').read_bytes()).hexdigest(),lock['characterHash' if who=='dio' else 'samuraiHash'])
 def test_all_requested_phases_and_seven_usable_moves_exist(self):
    for k in ['knifePrepare','knifeDraw','knifeArm','knifeThrow','knifeRecover','rushCommand','timePreparation','timeCommand','timeActivation','timeGuard']:self.assertIn(k,self.manifests['dio']['clips'])
    for k in ['rushPrepare','rushAdvance','rushFirst','rushLeft','rushRight','rushAlternation','rushFinisher','rushRecovery','rushReturn','timePrepare','timeActivate','timeMaintain','timeFinish']:self.assertIn(k,self.manifests['the-world']['clips'])
    self.assertEqual(len(self.moves),7)
 def test_crisp_native_palettes_transparency_and_real_distinct_drawings(self):
    for who,m in self.manifests.items():
        palette={tuple(bytes.fromhex(c[1:])) for c in json.loads((ROOT/f'art/{who}/palette.json').read_text())}
        for name,c in m['clips'].items():
            sheet=Image.open(ROOT/f'public/sprites/{who}/{c["sheet"]}').convert('RGBA')
            self.assertEqual(sheet.size,(256*c['count'],256));frames=[];crops=[]
            for i in range(c['count']):
                cell=sheet.crop((i*256,0,(i+1)*256,256));a=np.array(cell);opaque=a[:,:,3]>0
                self.assertEqual(set(np.unique(a[:,:,3])),{0,255},name)
                self.assertTrue(np.all(a[~opaque]==0));self.assertTrue(np.all(a[[0,-1]]==0));self.assertTrue(np.all(a[:,[0,-1]]==0))
                self.assertTrue(set(map(tuple,a[opaque,:3])).issubset(palette),name)
                frames.append(cell.tobytes());crop=cell.crop(cell.getbbox());crops.append((crop.size,crop.tobytes()))
            self.assertEqual(len(set(frames)),c['count'],name);self.assertEqual(len(set(crops)),c['count'],name)
 def test_no_body_hitboxes_and_every_release_matches_a_drawn_hand(self):
    for key,m in self.moves.items():
        for p in m['poses']:self.assertEqual(p['hitboxes'],[],key)
        if m['special']=='knives':
            for tick in m['projectile']['releases']:
                time=0
                for p in m['poses']:
                    if tick<time+p['ticks']:break
                    time+=p['ticks']
                wrist=p['anchors']['arms']['far'][2]
                self.assertAlmostEqual(p['release']['x'],wrist[0]-118)
                self.assertAlmostEqual(p['release']['y'],wrist[1]-224)
 def test_each_rush_hit_uses_the_alternating_real_fist_once(self):
    actions=self.manifests['the-world']['clips']
    for strength,count in [('light',4),('medium',7),('heavy',10)]:
        m=self.moves['rush_'+strength];action=actions[m['stand']['clip']];hits=[p for p in action['poses'] if p['hitId']>=0]
        self.assertEqual([p['hitId'] for p in hits],list(range(count)))
        for i,p in enumerate(hits):
            side='far' if i==count-1 or i%2==0 else 'near'
            self.assertEqual(p['hitboxes'],[p['surfaces'][side]])
        self.assertEqual(len(m['hitWindows']),count)
        for a,b in zip(m['hitWindows'],m['hitWindows'][1:]):self.assertLess(a['toTick'],b['fromTick'])
 def test_fx_projectiles_are_independent_transparent_pixel_assets(self):
    im=Image.open(ROOT/'public/sprites/fx/dio-specials.png').convert('RGBA');a=np.array(im)
    self.assertEqual(im.size,(14*128,128));self.assertEqual(set(np.unique(a[:,:,3])),{0,255})
    for i in range(6):
        cell=im.crop((i*128,0,(i+1)*128,128));b=cell.getbbox();self.assertLess(b[2]-b[0],36);self.assertLess(b[3]-b[1],18)
 def test_combo_bridge_endpoints_are_actual_normal_and_rush_poses(self):
    bridges=json.loads((ROOT/'public/sprites/the-world/special-transitions.json').read_text())
    self.assertEqual(len(bridges),33)
    for key,c in bridges.items():
        _,source,index,target=key.split('_');index=int(index)
        sheet=Image.open(ROOT/f'public/sprites/the-world/{c["sheet"]}').convert('RGBA')
        old=Image.open(ROOT/f'public/sprites/the-world/{source}.png').convert('RGBA')
        new=Image.open(ROOT/f'public/sprites/the-world/{target}.png').convert('RGBA')
        self.assertEqual(sheet.crop((0,0,256,256)).tobytes(),old.crop((index*256,0,(index+1)*256,256)).tobytes(),key)
        self.assertEqual(sheet.crop((sheet.width-256,0,sheet.width,256)).tobytes(),new.crop((0,0,256,256)).tobytes(),key)
 def test_download_contains_every_promised_sheet_and_cell(self):
    with zipfile.ZipFile(ROOT/'public/downloads/dio-specials.zip') as z:
        for who,m in self.manifests.items():
            for key,c in m['clips'].items():
                self.assertIn(who+'/'+c['sheet'],z.namelist())
                for i in range(c['count']):self.assertIn(f'{who}/cells/{key}-{i:02}.png',z.namelist())
        self.assertIn('fx/dio-specials.png',z.namelist());self.assertIn('dio-specials.json',z.namelist())

if __name__=='__main__':unittest.main(verbosity=2)
