"""Structural checks complement the real-game captures; they do not grade acting."""
from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

class EntranceArtTests(unittest.TestCase):
    def test_native_frames_are_distinct_grounded_and_not_clipped(self):
        manifest = json.loads((ROOT/'src/data/entrance-art.json').read_text(encoding='utf8'))
        packing = json.loads((ROOT/'art/entrances/packing.json').read_text(encoding='utf8'))
        self.assertEqual(len(manifest['characters']), 8)
        for char, clip in manifest['characters'].items():
            atlas = Image.open(ROOT/'public/sprites'/clip['sheet']).convert('RGBA')
            self.assertEqual(atlas.size, (1024,512))
            self.assertEqual(set(atlas.getchannel('A').get_flattened_data()), {0,255})
            self.assertLessEqual(len({p[:3] for p in atlas.get_flattened_data() if p[3]}),64)
            hashes = []
            for i in range(8):
                tile = atlas.crop((i%4*256,i//4*256,i%4*256+256,i//4*256+256))
                box = tile.getbbox()
                self.assertGreater(box[0],1); self.assertGreater(box[1],1)
                self.assertLess(box[2],255); self.assertIn(box[3],[223,224,225])
                hashes.append(hashlib.sha256(tile.crop(box).tobytes()).hexdigest())
            self.assertEqual(len(set(hashes)),8,char)
            self.assertEqual(len(clip['durations']),8)
            # Fixed scale for every cel: matching current body, never independent resizing.
            self.assertGreater(packing[char]['fixedScale'],0)
            actual_height=packing[char]['runtimeBoxes'][-1][3]-packing[char]['runtimeBoxes'][-1][1]
            self.assertLessEqual(abs(packing[char]['targetReferenceHeight']-actual_height),1)

    def test_original_sources_and_weapon_hand_anchors_are_retained(self):
        manifest = json.loads((ROOT/'src/data/entrance-art.json').read_text(encoding='utf8'))
        sources = json.loads((ROOT/'art/entrances/sources.json').read_text(encoding='utf8'))
        self.assertEqual(len(sources),8)
        for source in sources:
            with Image.open(ROOT/'art/entrances'/source['source']) as im:
                self.assertEqual(im.size,(1536,1024))
            self.assertTrue((ROOT/'art/entrances'/source['reference']).is_file())
        asta = Image.open(ROOT/'public/sprites/asta/intro.png').convert('RGBA')
        for i,grip in enumerate(manifest['astaGrips']):
            x=i%4*256+128+grip['x']; y=i//4*256+224+grip['y']
            self.assertGreater(asta.getpixel((x,y))[3],0, f'hand {i}')

if __name__=='__main__': unittest.main()
