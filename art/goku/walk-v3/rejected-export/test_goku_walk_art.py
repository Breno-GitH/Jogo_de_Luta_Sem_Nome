"""Checks for the painted, projected walking cells and phase-indexed stops.

The old procedural rig still owns the untouched animations. These checks use
the actual new raster, projected joints and canonical approved head instead
of pretending that the new paintings have the old fixed 2D limb lengths.
"""
import hashlib
import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/sprites/goku'
sys.path.insert(0, str(ROOT / 'scripts'))
from build_goku import PALETTE, preserve

M = json.loads((OUT / 'movement.json').read_text(encoding='utf-8'))
A = json.loads((ROOT / 'src/data/goku-animations.json').read_text(encoding='utf-8'))
G = json.loads((ROOT / 'src/data/goku-gait.json').read_text(encoding='utf-8'))
S = json.loads((OUT / 'walk-transitions.json').read_text(encoding='utf-8'))
WALKS = ('walkForward', 'walkBack')
STOPS = ('walkStopForward', 'walkStopBack')


def canonical(value):
    # Baseline hashes were made with JSON.stringify, which writes 3.0 as 3.
    def numbers(item):
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, list):
            return [numbers(v) for v in item]
        if isinstance(item, dict):
            return {k: numbers(v) for k, v in item.items()}
        return item
    return json.dumps(numbers(value), ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def cell(key, index):
    return Image.open(OUT / f'{key}-{index:02}.png').convert('RGBA')


def projected_pose_bounds(pose):
    for kind in ('legs', 'arms'):
        for points in pose['anchors'][kind].values():
            for point in points:
                if not len(point) == 2 or not all(math.isfinite(v) for v in point):
                    return False
                if not all(0 <= v < 256 for v in point):
                    return False
    return True


class PaintedGokuWalking(unittest.TestCase):
    def test_approved_non_walk_pngs_and_other_characters_are_unchanged(self):
        baseline = json.loads((ROOT / 'tests/fixtures/goku-non-walk-v2.json').read_text(encoding='utf-8'))
        self.assertEqual(len(baseline['files']), 139)
        for name, expected in baseline['files'].items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected, name)
        for name, clips in baseline['clips'].items():
            current = json.loads((ROOT / name).read_text(encoding='utf-8'))
            self.assertEqual(len(clips), 21)
            for key, expected in clips.items():
                actual = hashlib.sha256(canonical(current['clips'][key]).encode('utf-8')).hexdigest()
                self.assertEqual(actual, expected, f'{name}/{key}')
        # Compare JSON semantically: formatting is not an animation change.
        previous = json.loads((ROOT / 'public/sprites/goku-v1/movement.json').read_text(encoding='utf-8'))
        self.assertEqual(M['cell'], previous['cell'])
        self.assertEqual(M['pivot'], previous['pivot'])
        preserve()

    def test_every_painted_cell_is_an_actual_native_transparent_atlas_cell(self):
        palette = {tuple(bytes.fromhex(c[1:])) for c in PALETTE}
        for key in WALKS + STOPS:
            meta, clip = M['clips'][key], A['clips'][key]
            w = clip.get('frameWidth', A['frameWidth'])
            h = clip.get('frameHeight', A['frameHeight'])
            columns = clip.get('columns', meta['count'])
            pivot = clip.get('pivot', A['pivot'])
            with Image.open(OUT / meta['sheet']) as atlas:
                self.assertEqual(atlas.mode, 'RGBA', key)
                self.assertEqual(atlas.size, (columns * w, math.ceil(meta['count'] / columns) * h), key)
                for index in range(meta['count']):
                    x, y = index % columns * w, index // columns * h
                    reconstructed = Image.new('RGBA', (256, 256))
                    reconstructed.paste(atlas.crop((x, y, x + w, y + h)), (128 - pivot['x'], 224 - pivot['y']))
                    native = cell(key, index)
                    self.assertEqual(native.size, (256, 256), f'{key}/{index}')
                    self.assertEqual(reconstructed.tobytes(), native.tobytes(), f'{key}/{index}: atlas/cell/pivot mismatch')
                    pixels = np.array(native)
                    self.assertLessEqual(set(np.unique(pixels[:, :, 3])), {0, 255}, f'{key}/{index}')
                    self.assertTrue(np.all(pixels[pixels[:, :, 3] == 0] == 0), f'{key}/{index}')
                    colors = set(map(tuple, pixels[pixels[:, :, 3] > 0, :3]))
                    self.assertTrue(colors.issubset(palette), f'{key}/{index}')

    def test_exact_approved_head_is_copied_without_face_or_hair_deformation(self):
        head = Image.open(OUT / 'walk-head.png').convert('RGBA')
        approved = Image.open(ROOT / 'art/goku/layers/head.png').convert('RGBA')
        self.assertEqual(head.tobytes(), approved.tobytes())
        for key in WALKS + STOPS:
            poses = M['clips'][key]['poses'] if key in WALKS else S['clips'][key]['poses']
            for index, pose in enumerate(poses):
                dx, dy = pose['headOffset']
                self.assertEqual((int(dx), int(dy)), (dx, dy), f'{key}/{index}')
                expected = Image.new('RGBA', (256, 256))
                expected.paste(head, (dx, dy))
                expected = np.array(expected)
                visible = expected[:, :, 3] > 0
                actual = np.array(cell(key, index))
                self.assertTrue(np.array_equal(actual[visible], expected[visible]), f'{key}/{index}: changed canonical head pixels')

    def test_walks_have_real_contact_passing_and_weight_shift_drawings(self):
        for key in WALKS:
            clip = M['clips'][key]
            self.assertGreaterEqual(clip['count'], 8)
            self.assertEqual(clip['count'], len(clip['poses']))
            self.assertEqual(len(clip['durations']), clip['count'])
            self.assertTrue(all(t == 1 for t in clip['durations']), 'native inbetweens must update each fixed tick')
            self.assertEqual(G[key]['ticks'], sum(clip['durations']))
            self.assertTrue(all(p['projectedLengths'] for p in clip['poses']))
            self.assertGreaterEqual(len({p['sourceKey'] for p in clip['poses']}), 8)
            poses = clip['poses']
            separation = [abs(p['anchors']['legs']['near'][2][0] - p['anchors']['legs']['far'][2][0]) for p in poses]
            contacts = [i for i, support in enumerate(clip['support']) if len(support) == 2]
            passing = [i for i, support in enumerate(clip['support']) if len(support) == 1 and min(p[2][1] for p in poses[i]['anchors']['legs'].values()) <= 210]
            self.assertTrue(contacts, key)
            self.assertTrue(passing, key)
            contact = max(contacts, key=lambda i: separation[i])
            passing = min(passing, key=lambda i: separation[i])
            self.assertGreater(separation[contact], 30, key)
            self.assertLess(separation[passing], separation[contact] * .45, key)
            contact_mask = np.array(cell(key, contact))[:, :, 3] > 0
            passing_mask = np.array(cell(key, passing))[:, :, 3] > 0
            self.assertGreater(np.count_nonzero(contact_mask ^ passing_mask), 150, key)
            hashes = []
            for i in range(clip['count']):
                image = cell(key, i)
                hashes.append(hashlib.sha256(image.crop(image.getbbox()).tobytes()).hexdigest())
            self.assertEqual(len(set(hashes)), len(hashes), key)
            arms = np.array([p['anchors']['arms']['near'][2] for p in poses])
            self.assertGreater(np.ptp(arms[:, 0]) + np.ptp(arms[:, 1]), 2, key)
            hips = np.array([np.mean([p['anchors']['legs'][s][0] for s in ('near', 'far')], axis=0) for p in poses])
            self.assertGreater(np.ptp(hips[:, 1]), 1, key)
            self.assertLessEqual(np.ptp(np.array([p['headOffset'] for p in poses])[:, 1]), 4, key)

    def test_projected_anatomy_and_ground_contact_are_valid_in_the_actual_raster(self):
        for key in WALKS:
            meta = M['clips'][key]
            for i, pose in enumerate(meta['poses']):
                self.assertTrue(projected_pose_bounds(pose), f'{key}/{i}')
                for kind, low, high in [('legs', 20, 45), ('arms', 8, 30)]:
                    for side, points in pose['anchors'][kind].items():
                        for a, b in zip(points, points[1:]):
                            length = math.dist(a, b)
                            self.assertGreaterEqual(length, low, f'{key}/{i}/{kind}/{side}')
                            self.assertLessEqual(length, high, f'{key}/{i}/{kind}/{side}')
                image = cell(key, i)
                self.assertLessEqual(image.getbbox()[3], 224, f'{key}/{i}')
                self.assertGreaterEqual(image.getbbox()[3] - image.getbbox()[1], 120, f'{key}/{i}')
                self.assertLessEqual(image.getbbox()[3] - image.getbbox()[1], 140, f'{key}/{i}')
                alpha = np.array(image)[:, :, 3]
                for side in meta['support'][i]:
                    x, y = pose['anchors']['legs'][side][2]
                    self.assertAlmostEqual(y, 213, delta=.01, msg=f'{key}/{i}/{side}')
                    # A heel/toe contact need not use the entire old flat sole,
                    # but the actual supporting shoe must reach the ground.
                    x = round(x)
                    self.assertGreater(np.count_nonzero(alpha[223, max(0, x-12):min(256, x+23)]), 0, f'{key}/{i}/{side}: floating shoe')

    def test_every_stop_phase_has_external_geometry_and_reaches_preserved_idle(self):
        idle = cell('idle', 0)
        for key in STOPS:
            meta, geometry = M['clips'][key], S['clips'][key]
            self.assertTrue(meta['internal'])
            self.assertEqual(meta['externalGeometry'], 'walk-transitions.json')
            self.assertEqual(meta['poses'], [])
            self.assertEqual(geometry['sourceClip'], meta['sourceClip'])
            steps, phases = geometry['framesPerSource'], geometry['phaseCount']
            self.assertEqual(steps, 8)
            self.assertEqual(phases, M['clips'][geometry['sourceClip']]['count'])
            self.assertEqual(meta['count'], phases * steps)
            self.assertEqual(len(geometry['poses']), meta['count'])
            self.assertEqual(meta['support'], [p['support'] for p in geometry['poses']])
            for phase in range(phases):
                start = phase * steps
                self.assertEqual(cell(key, start).tobytes(), cell(geometry['sourceClip'], phase).tobytes(), f'{key}/{phase}: starting pop')
                self.assertEqual(cell(key, start + steps - 1).tobytes(), idle.tobytes(), f'{key}/{phase}: wrong Idle endpoint')
                last_foot = None
                for step in range(steps):
                    pose = geometry['poses'][start + step]
                    self.assertEqual(pose['sourceFrame'], phase)
                    self.assertEqual(pose['step'], step)
                    self.assertEqual(pose['hitboxes'], [])
                    self.assertTrue(pose['support'])
                    self.assertTrue(projected_pose_bounds(pose))
                    self.assertEqual(bool(pose['settled']), step == steps - 1)
                    self.assertLessEqual(meta['bounds'][start + step][3], 224)
                    side = pose['support'][0]
                    point = pose['anchors']['legs'][side][2]
                    self.assertAlmostEqual(point[1], 213, delta=.01)
                    if step not in (0, 4):
                        self.assertAlmostEqual(point[0], last_foot, delta=.03, msg=f'{key}/{phase}/{step}: planted settle foot slid')
                    last_foot = point[0]


if __name__ == '__main__':
    unittest.main(verbosity=2)
