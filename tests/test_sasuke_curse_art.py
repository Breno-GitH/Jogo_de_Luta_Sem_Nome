"""Verify independent transformed drawings, open padding and aligned hit cels."""
from pathlib import Path
import json
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class CurseArt(unittest.TestCase):
    def test_cels_are_transparent_padded_and_unique(self):
        data = json.loads((ROOT / "src/data/sasuke-curse-frames.json").read_text())
        atlas = Image.open(ROOT / "public/sprites/sasuke/curse.png")
        self.assertEqual(len(data["cels"]), 81)
        self.assertEqual(atlas.size, (384 * 8, 288 * 11))
        seen = set()
        for i in range(len(data["cels"])):
            x, y = i % 8 * 384, i // 8 * 288
            cel = atlas.crop((x, y, x + 384, y + 288))
            mask = cel.getchannel("A")
            left, top, right, bottom = mask.getbbox()
            self.assertGreaterEqual(min(left, top, 384 - right), 8)
            self.assertEqual(bottom, 248)
            self.assertEqual(set(mask.tobytes()), {0, 255})
            seen.add(cel.tobytes())
        self.assertEqual(len(seen), 81)

    def test_normal_contacts_reach_authored_opaque_pixels(self):
        data = json.loads((ROOT / "src/data/sasuke-curse-frames.json").read_text())
        atlas = Image.open(ROOT / "public/sprites/sasuke/curse.png").getchannel("A")
        for name, clip in data["clips"].items():
            if not name.startswith(("stand_", "crouch_", "air_")):
                continue
            i = clip["frames"][1]
            point = data["cels"][i]["hitboxes"][0]["b"]
            x = i % 8 * 384 + 192 + point["x"]
            y = i // 8 * 288 + 248 + point["y"]
            self.assertTrue(atlas.crop((x-5, y-5, x+6, y+6)).getbbox(), name)


if __name__ == "__main__":
    unittest.main()
