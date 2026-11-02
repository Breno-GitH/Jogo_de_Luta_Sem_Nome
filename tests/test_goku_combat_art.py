"""Independent cel/atlas/source checks. These do not certify artistic quality."""
import unittest,json,hashlib,math,sys,zipfile
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from goku_rebuild import PAL,THRESHOLD,PALETTE,component_counts
ART=ROOT/'art/goku/combat';OUT=ROOT/'public/sprites/goku/combat'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
M=read(OUT/'manifest.json');A=read(ROOT/'src/data/goku-combat-animations.json');MOVES=read(ROOT/'src/data/goku-normals.json')
def cell(k,i):return Image.open(OUT/f'{k}-{i:02}.png').convert('RGBA')

class GokuCombatArt(unittest.TestCase):
 def test_complete_binary_palette_connected_silhouettes_and_floor(self):
  allowed={tuple(bytes.fromhex(c[1:]))for c in PALETTE}
  for k,c in M['clips'].items():
   for i in range(c['count']):
    with self.subTest(clip=k,cel=i):
     im=cell(k,i);a=np.array(im);mask=a[:,:,3]>0;b=im.getbbox()
     self.assertEqual(im.size,(384,256));self.assertEqual(list(b),c['bounds'][i]);self.assertTrue(set(np.unique(a[:,:,3]))<={0,255});self.assertTrue(np.all(a[~mask]==0))
     self.assertTrue(set(map(tuple,a[mask,:3]))<=allowed);self.assertGreater(mask.sum(),1200)
     self.assertTrue(b[0]>=8 and b[1]>=8 and b[2]<=376 and b[3]<=224)
     groups=component_counts(mask);self.assertGreaterEqual(groups[0]/sum(groups),.995);self.assertTrue(len(groups)==1 or groups[1]<=8)
     if c['grounded']:self.assertEqual(b[3],224);self.assertGreaterEqual(np.count_nonzero(mask[223]),2)
 def test_exact_whole_pose_source_reconstruction(self):
  scales={}
  for k,c in M['clips'].items():
   proof=read(ART/f'{k}-production.json');self.assertEqual(proof['method'],'whole-pose')
   for i,r in enumerate(proof['frames']):
    with self.subTest(clip=k,cel=i):
     source=Image.open(ROOT/r['source']).convert('RGBA');rect=r['sourceRect']
     self.assertTrue(0<rect[0]<rect[2]<source.width and 0<rect[1]<rect[3]<source.height)
     source=source.crop(rect);source.putalpha(source.getchannel('A').point(lambda v:255 if v>=THRESHOLD else 0))
     small=source.resize(tuple(round(v*r['scale'])for v in source.size),Image.Resampling.NEAREST)
     q=small.convert('RGB').quantize(palette=PAL,dither=Image.Dither.NONE).convert('RGBA');q.putalpha(small.getchannel('A'));a=np.array(q);a[a[:,:,3]==0]=0;q=Image.fromarray(a)
     out=Image.new('RGBA',(384,256));out.paste(q,tuple(r['offset']))
     b=q.getbbox();x,y=r['offset'];self.assertEqual(out.getbbox(),(b[0]+x,b[1]+y,b[2]+x,b[3]+y))
     discarded=r.get('discardedSpeckles',[]);points={tuple(d['point'])for d in discarded};self.assertLessEqual(len(points),8)
     for d in discarded:
      x,y=d['point'];self.assertEqual(list(out.getpixel((x,y))),d['rgba'])
      for dx,dy in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
       if (x+dx,y+dy)not in points:self.assertEqual(out.getpixel((x+dx,y+dy))[3],0,'cleanup must never remove connected anatomy')
     for point in points:out.putpixel(point,(0,0,0,0))
     self.assertEqual(out.tobytes(),cell(k,i).tobytes())
     scales.setdefault(r['source'],set()).add(r['scale'])
  self.assertTrue(all(len(s)==1 for s in scales.values()),'per-pose stretching is forbidden')
 def test_every_atlas_recrops_to_the_standalone_cel_in_order(self):
  self.assertEqual(A['pivot'],{'x':192,'y':224});self.assertEqual(M['cell'],[384,256])
  self.assertEqual(set(A['clips']),set(M['clips']));self.assertEqual(read(OUT/'animations.json'),A)
  for k,c in M['clips'].items():
   a=A['clips'][k];sheet=Image.open(OUT/c['sheet']).convert('RGBA');cols=c['columns']
   self.assertEqual(sheet.size,(384*cols,256*math.ceil(c['count']/cols)));self.assertEqual(a['frames'],list(range(c['count'])))
   self.assertEqual(a['frameWidth'],384);self.assertEqual(a['frameHeight'],256);self.assertEqual(a['pivot'],A['pivot']);self.assertEqual(a['durations'],c['durations'])
   for i in range(c['count']):
    x=i%cols*384;y=i//cols*256;self.assertEqual(sheet.crop((x,y,x+384,y+256)).tobytes(),cell(k,i).tobytes(),f'{k}/{i}')
 def test_durations_active_windows_and_real_limb_contacts(self):
  for k,move in MOVES.items():
   c=M['clips'][k];proof=read(ART/f'{k}-production.json');elapsed=0
   self.assertEqual(sum(c['durations']),move['startup']+move['active']+move['recovery'])
   self.assertGreater(sum(c['durations']),c['count']);self.assertEqual(len(move['poses']),c['count'])
   for i,p in enumerate(move['poses']):
    active=move['startup']<=elapsed<move['startup']+move['active'];self.assertEqual(bool(p['hitboxes']),active,f'{k}/{i}')
    if active and k!='throw':
     point=proof['frames'][i]['strikePoint'];x,y=point;im=np.array(cell(k,i));self.assertTrue(np.any(im[max(0,y-4):y+5,max(0,x-4):x+5,3]>0),f'{k}/{i}: invisible fist/boot')
     capsule=p['hitboxes'][0];self.assertEqual([capsule['b']['x']+192,capsule['b']['y']+224],point);self.assertLessEqual(capsule['r'],7)
    elapsed+=p['ticks']
 def test_pose_hurtboxes_cover_the_drawn_character(self):
  for k,c in M['clips'].items():
   for i,p in enumerate(c['poses']):
    mask=np.array(cell(k,i))[:,:,3]>0;coverage=np.zeros_like(mask)
    for b in p['hurtboxes']:
     x=b['x']+192;y=b['y']+224;coverage[y:y+b['h'],x:x+b['w']]=True
    self.assertTrue(np.all(coverage[mask]),f'{k}/{i}')
 def test_no_cels_are_duplicates_or_just_translated_inside_a_clip(self):
  for k,c in M['clips'].items():
   hashes=[]
   for i in range(c['count']):
    im=cell(k,i);crop=im.crop(im.getbbox());hashes.append(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest())
   self.assertEqual(len(hashes),len(set(hashes)),k)
 def test_apng_frames_are_the_real_exported_cels_with_individual_ticks(self):
  for k,c in M['clips'].items():
   apng=Image.open(OUT/f'{k}-animated.png');self.assertEqual(apng.n_frames,c['count'])
   for i,ticks in enumerate(c['durations']):
    apng.seek(i);self.assertEqual(apng.convert('RGBA').tobytes(),cell(k,i).tobytes());self.assertAlmostEqual(apng.info['duration'],ticks*1000/60,delta=1)
   apng.close()
 def test_approved_locomotion_samurai_dio_and_world_remain_byte_identical(self):
  for name,digest in read(ART/'preservation.json').items():self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest,name)
 def test_grab_and_combo_rules_use_the_shared_data_contract(self):
  data=read(ROOT/'src/data/goku-combat.json');seq=data['grabSequence']
  self.assertLess(seq['hitTick'],seq['duration']);self.assertEqual(seq['damage'],125);self.assertEqual(data['combatLimits'],{'maxHits':8,'maxAirHits':6,'maxTicks':180})
  self.assertTrue(all(seq['victimTrack'][i]['tick']<seq['victimTrack'][i+1]['tick']for i in range(len(seq['victimTrack'])-1)))
  self.assertTrue(MOVES['crouch_heavy']['launch']<0 and 'jump'in MOVES['crouch_heavy']['cancels']);self.assertTrue(MOVES['air_heavy']['knockdown'])
  for key in ['specialMoves','superMoves','companion']:self.assertNotIn(key,data)
 def test_download_contains_usable_sheets_animation_metadata_and_combat_data(self):
  with zipfile.ZipFile(ROOT/'public/downloads/goku-combat.zip')as z:
   for k,c in M['clips'].items():self.assertEqual(z.read('combat/'+c['sheet']),(OUT/c['sheet']).read_bytes())
   for name in ['goku-combat-animations.json','goku-normals.json','goku-combat.json']:self.assertEqual(z.read('data/'+name),(ROOT/'src/data'/name).read_bytes())
if __name__=='__main__':unittest.main(verbosity=2)
