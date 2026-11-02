"""Small native-pixel deformations of painted walk keys, without repainting.

``warp_painted(image, source_controls, target_controls, stiffness=1.0)``
uses inverse rigid moving least squares. Controls are (x, y) pairs, or two
matching dictionaries of named pairs. Pixel centres use integer coordinates.
The result has the input canvas size, samples only original RGBA pixels with
nearest-neighbour lookup, and fills coordinates outside the source with zero.

``stiffness`` > 1 spreads control influence further; values < 1 make it more
local. This utility is intended for *small adjacent-pose* inbetweens. It does
not invent anatomy or guarantee an injective warp for contradictory controls.
Fixed head/sole/canvas controls and separate limb masks belong to the caller.

Run this module directly for identity, translation, palette and degenerate-
control checks. Requires only the project's existing Pillow and numpy.
"""
from collections.abc import Mapping
import math

import numpy as np
from PIL import Image


def _pairs(source_controls, target_controls):
    if isinstance(source_controls, Mapping):
        if not isinstance(target_controls, Mapping):
            raise ValueError("Both control sets must be mappings or sequences")
        if set(source_controls) != set(target_controls):
            raise ValueError("Named source and target controls must match")
        names = list(source_controls)
        source_controls = [source_controls[name] for name in names]
        target_controls = [target_controls[name] for name in names]
    elif isinstance(target_controls, Mapping):
        raise ValueError("Both control sets must be mappings or sequences")
    source = np.asarray(source_controls, dtype=np.float64)
    target = np.asarray(target_controls, dtype=np.float64)
    if source.size == 0 and target.size == 0:
        return np.empty((0, 2)), np.empty((0, 2))
    if source.ndim != 2 or source.shape[1] != 2 or target.shape != source.shape:
        raise ValueError("Controls must have matching (N, 2) shapes")
    if not np.isfinite(source).all() or not np.isfinite(target).all():
        raise ValueError("Control coordinates must be finite")
    return source, target


def _merge_coincident(points, values):
    """Average contradictory duplicate constraints instead of dividing by zero."""
    groups = {}
    for i, p in enumerate(points):
        groups.setdefault(tuple(np.round(p, 6)), []).append(i)
    merged_points, merged_values = [], []
    for key in sorted(groups):
        indices = groups[key]
        merged_points.append(points[indices].mean(axis=0))
        merged_values.append(values[indices].mean(axis=0))
    return np.asarray(merged_points), np.asarray(merged_values)


def _sample(source, coordinates):
    # No colour interpolation, filtering or alpha arithmetic happens here.
    indices = np.rint(coordinates).astype(np.int64)
    h, w = source.shape[:2]
    valid = ((indices[:, 0] >= 0) & (indices[:, 0] < w) &
             (indices[:, 1] >= 0) & (indices[:, 1] < h))
    result = np.zeros((len(indices), 4), dtype=np.uint8)
    result[valid] = source[indices[valid, 1], indices[valid, 0]]
    return result


def warp_painted(image, source_controls, target_controls, stiffness=1.0):
    """Deform an RGBA painted key with a locally rigid inverse pixel map.

    Empty controls and identity constraints return an exact RGBA copy. A single
    effective control is a translation. Coincident controls are averaged; near-
    singular rotation fits fall back to local translation, never to stretching.
    """
    stiffness = float(stiffness)
    if not math.isfinite(stiffness) or stiffness <= 0:
        raise ValueError("stiffness must be finite and greater than zero")
    p, q = _pairs(source_controls, target_controls)
    rgba = image.convert("RGBA")
    if not len(p) or np.array_equal(p, q):
        return rgba.copy()
    # First merge a shared source joint, then any collapsed target joints.
    p, q = _merge_coincident(p, q)
    q, p = _merge_coincident(q, p)
    source = np.asarray(rgba)
    h, w = source.shape[:2]
    result = np.zeros_like(source)
    translation = q - p
    uniform_translation = np.allclose(translation, translation[0], rtol=0, atol=1e-10)
    # Extremely sharp/flat requests saturate safely instead of overflowing
    # log weights. Ordinary stiffness values retain the documented behaviour.
    alpha = min(16.0, max(0.0625, 1.0 / stiffness))
    # Bound temporary memory when callers provide many semantic landmarks.
    for top in range(0, h, 32):
        bottom = min(h, top + 32)
        yy, xx = np.mgrid[top:bottom, :w]
        v = np.stack((xx.ravel(), yy.ravel()), axis=1).astype(np.float64)
        if uniform_translation:
            mapped = v - translation[0]
        else:
            delta = v[:, None, :] - q[None, :, :]
            distance2 = np.sum(delta * delta, axis=2)
            # Log normalisation prevents overflow for highly local stiffness.
            log_weights = -alpha * np.log(np.maximum(distance2, 1e-12))
            log_weights -= log_weights.max(axis=1, keepdims=True)
            weights = np.exp(log_weights)
            denominator = weights.sum(axis=1, keepdims=True)
            q_star = (weights @ q) / denominator
            p_star = (weights @ p) / denominator
            q_hat = q[None, :, :] - q_star[:, None, :]
            p_hat = p[None, :, :] - p_star[:, None, :]
            dot = np.sum(weights * np.sum(q_hat * p_hat, axis=2), axis=1)
            cross = np.sum(weights * (q_hat[:, :, 0] * p_hat[:, :, 1] -
                                      q_hat[:, :, 1] * p_hat[:, :, 0]), axis=1)
            length = np.hypot(dot, cross)
            usable = length > 1e-12
            cosine = np.divide(dot, length, out=np.ones_like(dot), where=usable)
            sine = np.divide(cross, length, out=np.zeros_like(cross), where=usable)
            relative = v - q_star
            mapped = p_star + np.stack((cosine * relative[:, 0] - sine * relative[:, 1],
                                        sine * relative[:, 0] + cosine * relative[:, 1]), axis=1)
            # A target landmark exactly on a pixel must sample its source key.
            nearest = np.argmin(distance2, axis=1)
            exact = distance2[np.arange(len(v)), nearest] < 1e-12
            mapped[exact] = p[nearest[exact]]
        result[top:bottom] = _sample(source, mapped).reshape(bottom - top, w, 4)
    return Image.fromarray(result)


def _self_test():
    from PIL import ImageDraw
    im = Image.new("RGBA", (32, 24))
    d = ImageDraw.Draw(im)
    d.polygon([(4, 3), (17, 4), (24, 18), (8, 21)], fill=(244, 122, 20, 255))
    d.line([(6, 5), (13, 8), (18, 17)], fill=(11, 30, 70, 255), width=2)
    controls = [(5, 4), (15, 5), (22, 17), (7, 20)]
    assert warp_painted(im, controls, controls).tobytes() == im.tobytes()
    assert warp_painted(im, [], []).tobytes() == im.tobytes()
    shifted = [(x + 3, y - 2) for x, y in controls]
    expected = Image.new("RGBA", im.size)
    expected.paste(im, (3, -2))
    assert warp_painted(im, controls, shifted).tobytes() == expected.tobytes()
    assert warp_painted(im, [controls[0]], [shifted[0]]).tobytes() == expected.tobytes()
    targets = [(5, 4), (15, 7), (23, 16), (7, 20)]
    bent = warp_painted(im, controls, targets)
    assert bent.tobytes() == warp_painted(im, controls, targets).tobytes()
    original_colours = set(map(tuple, np.asarray(im).reshape(-1, 4))) | {(0, 0, 0, 0)}
    assert set(map(tuple, np.asarray(bent).reshape(-1, 4))) <= original_colours
    assert set(np.unique(np.asarray(bent)[:, :, 3])) <= {0, 255}
    # Degenerate constraints, named controls and subpixel coincidences are safe.
    for source, target in [
        ([(8, 8), (8, 8)], [(9, 8), (11, 8)]),
        ([(6, 6), (12, 12)], [(8, 8), (8, 8)]),
        ([(8, 8), (8 + 1e-10, 8)], [(9, 8), (9, 8 + 1e-10)]),
        ({"hip": (8, 8), "ankle": (8, 18)}, {"ankle": (9, 18), "hip": (8, 8)}),
    ]:
        warped = warp_painted(im, source, target)
        assert warped.size == im.size and warped.mode == "RGBA"
        assert set(map(tuple, np.asarray(warped).reshape(-1, 4))) <= original_colours
    print("goku_walk_mesh: identity, translation, deterministic local bend, palette/alpha and degenerate controls passed")


if __name__ == "__main__":
    _self_test()
