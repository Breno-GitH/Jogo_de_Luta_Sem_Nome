"""Read-only preflight for complete Goku walking paintings.

No repair, mask, resample or write is applied to the supplied image. The source
protocol is reconstructed separately in memory to verify the recorded global
operations. Passing these checks does not certify artistic quality or motion.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WALKS = ('walkForward', 'walkBack')


class CompletePoseError(AssertionError):
    def __init__(self, label, errors, report):
        self.label = label
        self.errors = errors
        self.report = report
        super().__init__(f'{label}: ' + '; '.join(errors))


def _material_mask(pixels, colors):
    selected = np.zeros(pixels.shape[:2], bool)
    for color in colors:
        selected |= np.all(pixels[:, :, :3] == list(bytes.fromhex(color.lstrip('#'))), axis=2)
    return selected & (pixels[:, :, 3] > 0)


def _components(alpha):
    remaining = set(map(tuple, np.argwhere(alpha)))
    result = []
    while remaining:
        first = remaining.pop()
        stack = [first]
        size = 0
        lo_y = hi_y = int(first[0])
        lo_x = hi_x = int(first[1])
        while stack:
            y, x = stack.pop()
            size += 1
            lo_y, hi_y = min(lo_y, int(y)), max(hi_y, int(y))
            lo_x, hi_x = min(lo_x, int(x)), max(hi_x, int(x))
            for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
                point = (y + dy, x + dx)
                if point in remaining:
                    remaining.remove(point)
                    stack.append(point)
        result.append({'pixels': size, 'bbox': [lo_x, lo_y, hi_x + 1, hi_y + 1]})
    return sorted(result, key=lambda group: group['pixels'], reverse=True)


def validate_complete(image, palette=None, label='pose'):
    """Return metrics or raise CompletePoseError; never modify the image.

    Intended for the prepared 256x256 native RGBA cell, not the high-resolution
    source drawing. A disconnected boot/hand/limb is a failure, not a repair.
    """
    if palette is None:
        from build_goku import PALETTE
        palette = PALETTE
    errors = []
    if image.mode != 'RGBA':
        errors.append(f'expected native RGBA, got {image.mode}')
    if image.size != (256, 256):
        raise CompletePoseError(label, errors + [f'expected256x256, got{image.size}'], {'size': list(image.size)})
    pixels = np.array(image.convert('RGBA'))
    alpha = pixels[:, :, 3]
    visible = alpha > 0
    bounds = image.convert('RGBA').getbbox()
    if not bounds:
        raise CompletePoseError(label, errors + ['empty drawing'], {'bbox': None})
    unique_alpha = set(map(int, np.unique(alpha)))
    if not unique_alpha.issubset({0, 255}):
        errors.append('non-binary alpha in native cell')
    if np.any(pixels[~visible] != 0):
        errors.append('invisible RGB/alpha data was not cleared')
    allowed = {tuple(bytes.fromhex(c.lstrip('#'))) for c in palette}
    colors = set(map(tuple, pixels[visible, :3]))
    if not colors.issubset(allowed):
        errors.append('native colors outside the approved palette')
    left, top, right, bottom = bounds
    if left < 2 or top < 2 or right > 254:
        errors.append(f'character touches cell margin: {bounds}')
    if bottom != 224:
        errors.append(f'actual sole does not end on ground224: bottom{bottom}')
    if not 120 <= bottom - top <= 140:
        errors.append(f'body height outside120..140px: {bottom-top}')
    if not 40 <= right - left <= 140:
        errors.append(f'silhouette width outside40..140px: {right-left}')
    groups = _components(visible)
    total = sum(group['pixels'] for group in groups)
    fraction = groups[0]['pixels'] / total
    if not 1500 <= total <= 9500:
        errors.append(f'empty, skeletal or opaque-box occupancy: {total}px')
    if fraction < .995:
        errors.append(f'detached figure: main component{fraction:.4%}; fragments{groups[1:5]}')
    if len(groups) > 1 and groups[1]['pixels'] > 8:
        errors.append(f'visible detached part: {groups[1]}')
    orange = _material_mask(pixels, ['#542119', '#883116', '#ac3c0b', '#d95208', '#f67a14', '#ff9b2b', '#ffbc57'])
    blue = _material_mask(pixels, ['#071326', '#0c2146', '#173a6b', '#24599a', '#3272b5', '#5a91c8'])
    skin = _material_mask(pixels, ['#63342b', '#92513c', '#be7853', '#e7a776', '#ffd0a0', '#ffe3b8'])
    dark = _material_mask(pixels, ['#080a10', '#141621', '#202331', '#303547', '#444c62'])
    materials = {'orange': int(orange.sum()), 'blue': int(blue.sum()), 'skin': int(skin.sum()),
                 'upperDark': int(dark[top:top+40].sum()), 'groundBlue': int(blue[217:224].sum())}
    for material, minimum in [('orange', 500), ('blue', 100), ('skin', 100), ('upperDark', 120), ('groundBlue', 4)]:
        if materials[material] < minimum:
            errors.append(f'missing material/readability guard: {material}={materials[material]}<{minimum}')
    report = {'label': label, 'size': list(image.size), 'bbox': list(bounds), 'opaquePixels': total,
              'mainComponentFraction': fraction, 'components': groups, 'colors': len(colors), 'materials': materials}
    if errors:
        raise CompletePoseError(label, errors, report)
    return report


def validate_normalized_source(record, root=ROOT, label='source'):
    """Verify raw crop -> uniform NEAREST -> RGBA paste, without alpha cleanup."""
    source_path = (root / record['source']).resolve()
    raw_path = (root / record['rawSource']).resolve()
    assert source_path.is_relative_to(root / 'art'), f'{label}: source outside archived art'
    assert raw_path.is_relative_to(root / 'art'), f'{label}: raw generation outside archived art'
    raw = Image.open(raw_path).convert('RGBA')
    rect = record['sourceRect']
    assert len(rect) == 4 and all(isinstance(v, int) for v in rect), f'{label}: invalid whole-pose sourceRect'
    x0, y0, x1, y1 = rect
    assert 0 <= x0 < x1 <= raw.width and 0 <= y0 < y1 <= raw.height, f'{label}: sourceRect clips the raw generation'
    normalize = record['normalization']
    scale = normalize['scale']
    assert isinstance(scale, (int, float)) and math.isfinite(scale) and scale > 0, f'{label}: non-uniform or invalid normalization scale'
    assert normalize['canvas'] == [512, 512], f'{label}: normalized source canvas changed'
    offset = normalize['offset']
    assert len(offset) == 2 and all(isinstance(v, int) for v in offset), f'{label}: normalization offset must be integer'
    crop = raw.crop(tuple(rect))
    # RGBA is deliberately left intact, including semi-transparent source pixels
    # and RGB underneath zero alpha. Threshold belongs only to final import.
    resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.NEAREST)
    assert 0 <= offset[0] and 0 <= offset[1] and offset[0] + resized.width <= 512 and offset[1] + resized.height <= 512, f'{label}: normalized whole source is clipped'
    expected = Image.new('RGBA', (512, 512))
    expected.paste(resized, tuple(offset))
    actual = Image.open(source_path).convert('RGBA')
    assert actual.size == (512, 512), f'{label}: source PNG is not512x512'
    if actual.tobytes() != expected.tobytes():
        difference = np.any(np.array(actual) != np.array(expected), axis=2)
        yy, xx = np.where(difference)
        region = [int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1]
        raise AssertionError(f'{label}: raw whole-pose normalization differs in{int(difference.sum())}pixels, region{region}')
    return {'label': label, 'source': record['source'], 'rawSource': record['rawSource'],
            'sourceRect': rect, 'normalizationScale': scale,
            'rgbaSha256': hashlib.sha256(actual.tobytes()).hexdigest()}


def validate_native_import(record, actual, scale, palette, threshold=180, root=ROOT, label='pose'):
    """Check the complete normalized source was only globally imported."""
    source = Image.open(root / record['source']).convert('RGBA')
    small = source.resize(tuple(round(v * scale) for v in source.size), Image.Resampling.NEAREST)
    pal = Image.new('P', (1, 1))
    values = [v for color in palette for v in bytes.fromhex(color.lstrip('#'))]
    pal.putpalette(values + values[:3] * (256 - len(palette)))
    rgba = small.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA')
    rgba.putalpha(small.getchannel('A').point(lambda a: 255 if a >= threshold else 0))
    pixels = np.array(rgba)
    pixels[pixels[:, :, 3] == 0] = 0
    rgba = Image.fromarray(pixels)
    offset = record['offset']
    assert len(offset) == 2 and all(isinstance(v, int) for v in offset), f'{label}: invalid import offset'
    bounds = rgba.getbbox()
    placed = (bounds[0] + offset[0], bounds[1] + offset[1], bounds[2] + offset[0], bounds[3] + offset[1])
    assert placed[0] >= 0 and placed[1] >= 0 and placed[2] <= 256 and placed[3] <= 256, f'{label}: native registration clips whole pose'
    expected = Image.new('RGBA', (256, 256))
    expected.paste(rgba, tuple(offset))
    assert actual.convert('RGBA').tobytes() == expected.tobytes(), f'{label}: prepared cell was modified beyond whole-frame import'


def preflight(production_path):
    production_path = Path(production_path).resolve()
    spec = json.loads(production_path.read_text(encoding='utf-8'))
    result = {'ok': True, 'method': spec.get('method'), 'poses': [], 'errors': []}
    assert spec['method'] == 'whole-pose' and spec['alphaThreshold'] == 180
    for key in WALKS:
        clip = spec['clips'][key]
        for index, record in enumerate(clip['frames']):
            label = f'{key}/{index}'
            try:
                provenance = validate_normalized_source(record, label=label)
                image = Image.open(production_path.parent / f'{key}-{index:02}.png')
                validate_native_import(record, image, clip['scale'], spec['palette'], spec['alphaThreshold'], label=label)
                metrics = validate_complete(image, spec['palette'], label)
                result['poses'].append({**metrics, 'provenance': provenance})
            except (AssertionError, OSError, ValueError, KeyError) as error:
                result['ok'] = False
                failure = {'label': label, 'message': str(error)}
                if isinstance(error, CompletePoseError):
                    failure['report'] = error.report
                result['errors'].append(failure)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('production', nargs='?', default='art/goku/walk-v4/production.json')
    args = parser.parse_args()
    report = preflight(ROOT / args.production)
    print(json.dumps(report, ensure_ascii=True))
    raise SystemExit(0 if report['ok'] else 1)
