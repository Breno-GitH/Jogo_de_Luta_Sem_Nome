"""Independent Stage3 cel, metadata, FX and preservation checks; not an art score."""
import unittest,sys,json,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from goku_rebuild import PAL,PALETTE,component_counts
ART=ROOT/'art/goku/specials/stage3';OUT=ROOT/'public/sprites/goku/specials'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
P=read(ART/'production.json');M=read(OUT/'manifest.json');A=read(ROOT/'src/data/goku-special-animations.json');MOVES=read(ROOT/'src/data/goku-special-moves.json')
def cell(k,i):return Image.open(OUT/f'{k}-{i:02}.png').convert('RGBA')
class GokuCommonSpecialArt(unittest.TestCase):
 def test_every_approved_old_asset_and_data_file_is_unchanged(self):
  for n,h in read(ART/'preservation.json').items():self.assertEqual(hashlib.sha256((ROOT/n).read_bytes()).hexdigest(),h,n)
 def test_exact_whole_source_import_without_morphing_or_limb_assembly(self):
  scales={}
  for key,clip in P.items():
   for i,r in enumerate(clip['frames']):
    with self.subTest(clip=key,frame=i):
     src=Image.open(ROOT/r['source']).convert('RGBA').crop(r['sourceRect']);src.putalpha(src.getchannel('A').point(lambda a:255 if a>=180 else 0));sm=src.resize(tuple(round(v*r['scale'])for v in src.size),Image.Resampling.NEAREST)
     q=sm.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(sm.getchannel('A'));arr=np.array(q);arr[arr[:,:,3]==0]=0;q=Image.fromarray(arr);im=Image.new('RGBA',(384,256));im.paste(q,tuple(r['offset']));self.assertEqual(im.tobytes(),cell(key,i).tobytes());scales.setdefault(r['source'],set()).add(r['scale'])
  self.assertTrue(all(len(s)==1 for s in scales.values()))
 def test_full_connected_bodies_binary_alpha_palette_margin_and_ground(self):
  allowed={tuple(bytes.fromhex(c[1:]))for c in PALETTE}
  for key,clip in P.items():
   for i,r in enumerate(clip['frames']):
    im=cell(key,i);a=np.array(im);mask=a[:,:,3]>0;b=im.getbbox();self.assertEqual(im.size,(384,256));self.assertTrue(set(np.unique(a[:,:,3]))<={0,255});self.assertTrue(np.all(a[~mask]==0));self.assertTrue(set(map(tuple,a[mask,:3]))<=allowed)
    self.assertTrue(b[0]>=8 and b[1]>=8 and b[2]<=376 and b[3]<=224,f'{key}/{i}');self.assertGreater(mask.sum(),1200);groups=component_counts(mask);self.assertGreaterEqual(groups[0]/sum(groups),.995);self.assertTrue(len(groups)==1 or groups[1]<=8)
    if 'teleport_air-source'not in r['source']:self.assertEqual(b[3],224);self.assertGreaterEqual(mask[223].sum(),2)
 def test_packing_timings_and_pivots_match_both_combat_and_animator(self):
  self.assertEqual(len(MOVES),10);self.assertEqual(set(MOVES),set(P));self.assertEqual(A['pivot'],{'x':192,'y':224});self.assertEqual(read(OUT/'animations.json'),A)
  for k,c in M['clips'].items():
   meta=A['clips'][k];move=MOVES[k];self.assertEqual(sum(meta['durations']),move['startup']+move['active']+move['recovery']);self.assertEqual(meta['durations'],[p['ticks']for p in move['poses']]);self.assertGreater(sum(meta['durations']),c['count']);sheet=Image.open(OUT/c['sheet']).convert('RGBA');cols=c['columns'];self.assertEqual(sheet.size,(384*cols,256*math.ceil(c['count']/cols)))
   for i in range(c['count']):
    x=i%cols*384;y=i//cols*256;self.assertEqual(sheet.crop((x,y,x+384,y+256)).tobytes(),cell(k,i).tobytes())
 def test_body_has_no_baked_offensive_shapes_and_releases_track_actual_hands(self):
  for k,c in MOVES.items():
   for i,p in enumerate(c['poses']):
    self.assertEqual(p['hitboxes'],[]);im=np.array(cell(k,i));mask=im[:,:,3]>0;coverage=np.zeros_like(mask)
    for b in p['hurtboxes']:
     x=b['x']+192;y=b['y']+224;coverage[y:y+b['h'],x:x+b['w']]=True
    self.assertTrue(np.all(coverage[mask]))
    if c['special']!='teleport'and p['phase']=='active':
     x=p['release']['x']+192;y=p['release']['y']+224;self.assertTrue(np.any(mask[y-3:y+4,x-3:x+4]),f'{k}/{i}')
 def test_distinct_cels_not_just_translations_and_real_apng_frames(self):
  for k,c in M['clips'].items():
   hashes=[]
   with Image.open(OUT/f'{k}-animated.png')as apng:
    self.assertEqual(apng.n_frames,c['count'])
    for i in range(c['count']):
     im=cell(k,i);crop=im.crop(im.getbbox());hashes.append(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest());apng.seek(i);self.assertEqual(apng.convert('RGBA').tobytes(),im.tobytes())
   self.assertEqual(len(set(hashes)),len(hashes),k)
 def test_all_effect_layers_are_independent_clean_pixel_sheets(self):
  fx=read(ROOT/'src/data/goku-special-fx.json');self.assertEqual(set(fx['clips']),{'ki','origin','body','tip','impact','dissipate','teleport'});allowed={tuple(bytes.fromhex(c[1:]))for c in fx['palette']}
  for k,c in fx['clips'].items():
   sheet=Image.open(ROOT/'public/sprites'/c['sheet']).convert('RGBA');self.assertEqual(sheet.size,(384,96))
   for i in range(4):
    im=Image.open(OUT/f'fx-{k}-{i}.png').convert('RGBA');a=np.array(im);mask=a[:,:,3]>0;self.assertTrue(mask.any());self.assertTrue(set(np.unique(a[:,:,3]))<={0,255});self.assertTrue(np.all(a[~mask]==0));self.assertTrue(set(map(tuple,a[mask,:3]))<=allowed);self.assertEqual(sheet.crop((i*96,0,(i+1)*96,96)).tobytes(),im.tobytes())
 def test_common_special_balance_has_no_super_or_cinematic_contract(self):
  for k,m in MOVES.items():self.assertEqual(m['cost'],0);self.assertFalse(m.get('super',False));self.assertNotIn(m.get('kind'),['ultimate','roadRoller']);self.assertEqual(m['cancels'],[])
  for s in ['light','medium','heavy']:
   beam=MOVES['kamehameha_'+s]['beam'];self.assertEqual(math.ceil(MOVES['kamehameha_'+s]['active']/beam['interval']),beam['hits'])
  self.assertEqual(len(MOVES['ki_medium']['projectile']['releases']),2);self.assertGreater(MOVES['ki_heavy']['projectile']['radius'],MOVES['ki_light']['projectile']['radius'])
if __name__=='__main__':unittest.main(verbosity=2)
