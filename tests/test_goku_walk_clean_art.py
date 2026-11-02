"""Pre-packaging checks for complete painted walking poses.

These checks reject clipping, disconnected figures, stale atlases and forbidden
export deformation. They do NOT certify anatomy, garment design, expression or
natural motion: those still require inspection of the source and game capture.

Production contract: art/goku/walk-v4/production.json, version1,
method="whole-pose", palette32 and alphaThreshold180. Each clip has one uniform
scale and frames[{source: repo-relative whole-pose PNG, offset:[x,y]}]. Sources
may be extracted WHOLE cells from a generated sheet; no limb/head inserts.
Optional native landmarks are QA annotations only and never alter the raster.
"""
import hashlib
import json
import math
import os
import re
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/sprites/goku'
PRODUCTION = ROOT / os.environ.get('GOKU_WALK_PROVENANCE', 'art/goku/walk-v4/production.json')
WALKS = ('walkForward', 'walkBack')
sys.path.insert(0, str(ROOT / 'scripts'))
from goku_clean_walk_validation import validate_normalized_source, preflight


class WholePoseSourceProtocol(unittest.TestCase):
    """Run before publishing: independent of the old game atlas/metadata."""
    def test_normalized_sources_are_exact_raw_whole_pose_crops_without_alpha_cleanup(self):
        production = load(PRODUCTION)
        for key in WALKS:
            for index, record in enumerate(production['clips'][key]['frames']):
                with self.subTest(clip=key, frame=index):
                    validate_normalized_source(record, label=f'{key}/{index}')

    def test_every_prepared_cell_passes_complete_figure_checks_before_atlas_export(self):
        result = preflight(PRODUCTION)
        self.assertTrue(result['ok'], json.dumps(result['errors'], ensure_ascii=False))
        self.assertGreaterEqual(len(result['poses']), 16)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def canonical(value):
    """Match the existing JSON.stringify baseline, including integer floats."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [canonical(v) for v in value]
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in sorted(value.items())}
    return value


def digest_json(value):
    value = json.dumps(canonical(value), ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def material_mask(pixels, colors):
    result = np.zeros(pixels.shape[:2], bool)
    for color in colors:
        result |= np.all(pixels[:, :, :3] == list(bytes.fromhex(color.lstrip('#'))), axis=2)
    return result & (pixels[:, :, 3] > 0)


def component_sizes(alpha):
    """Eight-connectivity allows intentional diagonal one-pixel outlines."""
    remaining = set(map(tuple, np.argwhere(alpha)))
    sizes = []
    while remaining:
        stack = [remaining.pop()]
        size = 0
        while stack:
            y, x = stack.pop()
            size += 1
            for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
                point = (y + dy, x + dx)
                if point in remaining:
                    remaining.remove(point)
                    stack.append(point)
        sizes.append(size)
    return sorted(sizes, reverse=True)


class CompleteGokuWalkFrames(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.production = load(PRODUCTION)
        cls.movement = load(OUT / 'movement.json')
        cls.animation = load(ROOT / 'src/data/goku-animations.json')
        cls.palette = cls.production['palette']

    def frames(self):
        for key in WALKS:
            for index, record in enumerate(self.production['clips'][key]['frames']):
                yield key, index, record, Image.open(OUT / f'{key}-{index:02}.png').convert('RGBA')

    def test_contract_describes_complete_poses_and_no_active_mesh_stops(self):
        p = self.production
        self.assertEqual(p['version'], 1)
        self.assertEqual(p['method'], 'whole-pose')
        self.assertEqual(p['alphaThreshold'], 180)
        self.assertEqual(len(self.palette), 32)
        self.assertEqual(len(set(c.lower() for c in self.palette)), 32)
        self.assertTrue(all(re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in self.palette))
        self.assertEqual(self.movement['cell'], [256, 256])
        self.assertEqual(self.movement['pivot'], {'x': 128, 'y': 224})
        self.assertFalse(any(k.startswith('walkStop') for k in self.movement['clips']),
                         'The abandoned deformed stop atlases must not remain active.')
        for key in WALKS:
            record = p['clips'][key]
            frames = record['frames']
            scale = record['scale']
            self.assertIsInstance(scale, (int, float))
            self.assertTrue(math.isfinite(scale) and 0 < scale <= 4)
            self.assertGreaterEqual(len(frames), 8)
            meta = self.movement['clips'][key]
            self.assertEqual(meta['count'], len(frames))
            self.assertEqual(len(meta['durations']), len(frames))
            self.assertTrue(all(isinstance(t, int) and t > 0 for t in meta['durations']))
            self.assertTrue(meta['loop'])

    def test_export_is_exactly_uniform_scale_palette_and_translation_of_each_whole_source(self):
        palette = Image.new('P', (1, 1))
        colors = [value for c in self.palette for value in bytes.fromhex(c[1:])]
        palette.putpalette(colors + colors[:3] * (256 - len(self.palette)))
        for key, index, record, actual in self.frames():
            label = f'{key}/{index}'
            path = (ROOT / record['source']).resolve()
            self.assertTrue(path.is_relative_to(ROOT / 'art'), f'{label}: source must be the archived complete new drawing')
            self.assertFalse(path.is_relative_to(OUT), f'{label}: self-referencing an exported/deformed frame is not provenance')
            scale = self.production['clips'][key]['scale']
            self.assertEqual(record.get('scale', scale), scale, f'{label}: changing scale between poses changes body volume')
            offset = record['offset']
            self.assertEqual(len(offset), 2)
            self.assertTrue(all(isinstance(v, int) for v in offset))
            source = Image.open(path).convert('RGBA')
            source.putalpha(source.getchannel('A').point(lambda alpha: 255 if alpha >= 180 else 0))
            source = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.NEAREST)
            quantized = source.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
            quantized.putalpha(source.getchannel('A'))
            pixels = np.array(quantized)
            pixels[pixels[:, :, 3] == 0] = 0
            quantized = Image.fromarray(pixels)
            bounds = quantized.getbbox()
            self.assertIsNotNone(bounds, label)
            placed = (bounds[0] + offset[0], bounds[1] + offset[1], bounds[2] + offset[0], bounds[3] + offset[1])
            self.assertTrue(placed[0] >= 0 and placed[1] >= 0 and placed[2] <= 256 and placed[3] <= 256,
                            f'{label}: registering the sprite clips part of the complete pose')
            expected = Image.new('RGBA', (256, 256))
            expected.paste(quantized, tuple(offset))
            self.assertEqual(actual.tobytes(), expected.tobytes(),
                             f'{label}: the exporter changed pixels beyond permitted whole-frame operations')

    def test_atlases_reconstruct_the_complete_native_cells_without_wrong_pivots(self):
        for key in WALKS:
            meta = self.movement['clips'][key]
            clip = self.animation['clips'][key]
            width = clip.get('frameWidth', self.animation['frameWidth'])
            height = clip.get('frameHeight', self.animation['frameHeight'])
            pivot = clip.get('pivot', self.animation['pivot'])
            columns = clip.get('columns', meta['count'])
            self.assertEqual((width, height), (256, 256))
            self.assertEqual(pivot, {'x': 128, 'y': 224})
            self.assertEqual(clip['frames'], list(range(meta['count'])))
            self.assertEqual(clip['durations'], meta['durations'])
            atlas = Image.open(OUT / meta['sheet']).convert('RGBA')
            self.assertEqual(atlas.size, (width * columns, height * math.ceil(meta['count'] / columns)))
            for i in range(meta['count']):
                x, y = i % columns * width, i // columns * height
                expected = Image.open(OUT / f'{key}-{i:02}.png').convert('RGBA')
                self.assertEqual(atlas.crop((x, y, x + width, y + height)).tobytes(), expected.tobytes(), f'{key}/{i}')

    def test_transparency_palette_margins_and_real_floor_contact(self):
        allowed = {tuple(bytes.fromhex(c[1:])) for c in self.palette}
        for key, i, _, image in self.frames():
            label = f'{key}/{i}'
            pixels = np.array(image)
            self.assertEqual(image.size, (256, 256), label)
            self.assertLessEqual(set(np.unique(pixels[:, :, 3])), {0, 255}, label)
            self.assertTrue(np.all(pixels[pixels[:, :, 3] == 0] == 0), label)
            self.assertTrue(set(map(tuple, pixels[pixels[:, :, 3] > 0, :3])).issubset(allowed), label)
            left, top, right, bottom = image.getbbox()
            self.assertGreaterEqual(left, 2, label)
            self.assertGreaterEqual(top, 2, label)
            self.assertLessEqual(right, 254, label)
            self.assertEqual(bottom, 224, f'{label}: no actual sole pixel reaches the floor')
            self.assertTrue(120 <= bottom - top <= 140, f'{label}: incorrect visual body height')
            self.assertTrue(40 <= right - left <= 140, f'{label}: clipping or unreadable silhouette bounds')
            blue = material_mask(pixels, ['#071326', '#0c2146', '#173a6b', '#24599a', '#3272b5', '#5a91c8'])
            self.assertGreater(np.count_nonzero(blue[217:224]), 3, f'{label}: expected a blue boot at the ground')

    def test_the_character_is_connected_not_a_collection_of_detached_parts(self):
        for key, index, _, image in self.frames():
            counts = component_sizes(np.array(image)[:, :, 3] > 0)
            total = sum(counts)
            self.assertTrue(1500 <= total <= 9500, f'{key}/{index}: empty, skeletal or opaque-box sprite')
            self.assertGreaterEqual(counts[0] / total, .995, f'{key}/{index}: body parts are disconnected')
            self.assertTrue(len(counts) == 1 or counts[1] <= 8,
                            f'{key}/{index}: a visible hand, boot, hair mass or limb is detached')

    def test_each_direction_contains_distinct_complete_poses_not_translated_duplicates(self):
        for key in WALKS:
            images = [image for k, _, _, image in self.frames() if k == key]
            paintings, silhouettes = [], []
            for image in images:
                crop = image.crop(image.getbbox())
                geometry = str(crop.size).encode()
                paintings.append(hashlib.sha256(geometry + crop.tobytes()).hexdigest())
                silhouettes.append(hashlib.sha256(geometry + crop.getchannel('A').tobytes()).hexdigest())
            self.assertEqual(len(set(paintings)), len(images), f'{key}: repeated full figure or only a whole-image translation')
            self.assertGreaterEqual(len(set(silhouettes)), 4, f'{key}: material colour changes are not a walking cycle')

    def test_gi_skin_hair_and_boot_materials_remain_present(self):
        # Material presence catches missing clothing/limbs, not their artistic quality.
        orange = ['#542119', '#883116', '#ac3c0b', '#d95208', '#f67a14', '#ff9b2b', '#ffbc57']
        blue = ['#071326', '#0c2146', '#173a6b', '#24599a', '#3272b5', '#5a91c8']
        skin = ['#63342b', '#92513c', '#be7853', '#e7a776', '#ffd0a0', '#ffe3b8']
        dark = ['#080a10', '#141621', '#202331', '#303547', '#444c62']
        for key, i, _, image in self.frames():
            pixels = np.array(image)
            self.assertGreaterEqual(np.count_nonzero(material_mask(pixels, orange)), 500, f'{key}/{i}: missing gi material')
            self.assertGreaterEqual(np.count_nonzero(material_mask(pixels, blue)), 100, f'{key}/{i}: missing blue clothing/boots')
            self.assertGreaterEqual(np.count_nonzero(material_mask(pixels, skin)), 100, f'{key}/{i}: missing face/arms/hands')
            top = image.getbbox()[1]
            self.assertGreaterEqual(np.count_nonzero(material_mask(pixels, dark)[top:top+40]), 120, f'{key}/{i}: missing hair mass')

    def test_full_goku_rebuild_preserves_other_characters_and_existing_physics(self):
        # The user's later full-locomotion request supersedes the139 Goku PNG
        # freeze from the walk-only revision. Other characters remain protected.
        from goku_rebuild import protect
        protect()

    def test_no_obsolete_mesh_cells_are_left_in_the_published_walk_export(self):
        self.assertFalse(list(OUT.glob('walkStop*.png')), 'Archive abandoned mesh stops outside public before packaging.')
        for key in WALKS:
            count = self.movement['clips'][key]['count']
            for path in OUT.glob(f'{key}-*.png'):
                match = re.fullmatch(re.escape(key) + r'-(\d+)\.png', path.name)
                if match:
                    self.assertLess(int(match.group(1)), count, f'{path.name}: stale old mesh frame')
            preview = OUT / f'{key}-animated.png'
            if preview.exists():
                with Image.open(preview) as animation:
                    self.assertEqual(animation.n_frames, count, f'{key}: stale animated preview')
                    for index in range(count):
                        animation.seek(index)
                        expected = Image.open(OUT / f'{key}-{index:02}.png').convert('RGBA')
                        self.assertEqual(animation.convert('RGBA').tobytes(), expected.tobytes(), f'{key}/{index}: preview differs from game cell')


if __name__ == '__main__':
    unittest.main(verbosity=2)
