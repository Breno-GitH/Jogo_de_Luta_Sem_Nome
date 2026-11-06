"""Check the special atlas padding, transparent alpha and anchors."""
import json
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class SasukeSpecialArt(unittest.TestCase):
    def test_each_body_is_a_unique_padded_cel_with_matching_pivot_and_release(self):
        data = json.loads((ROOT / "src/data/sasuke-special-frames.json").read_text())
        sheet = Image.open(ROOT / "public/sprites/sasuke/specials.png")
        self.assertEqual(sheet.size, (2048, 1024))
        unique = set()
        for i, poses in enumerate(data.values()):
            self.assertEqual(len(poses), 4)
            for j, pose in enumerate(poses):
                n = i * 4 + j
                x, y = n % 8 * 256, n // 8 * 256
                cel = sheet.crop((x, y, x + 256, y + 256))
                mask = cel.getchannel("A")
                self.assertEqual(set(mask.tobytes()), {0, 255})
                l, t, r, b = mask.getbbox()
                self.assertGreaterEqual(min(l, t, 256 - r), 12)
                self.assertEqual(b, 224)
                self.assertGreaterEqual(b - t, 95)
                self.assertTrue(pose["hurtboxes"])
                if j in (1, 2):
                    point = pose["release"]
                    px, py = 128 + point["x"], 224 + point["y"]
                    self.assertTrue(mask.crop((px - 6, py - 6, px + 7, py + 7)).getbbox())
                unique.add(cel.tobytes())
        self.assertEqual(len(unique), 32)

    def test_effects_are_twelve_separate_transparent_cels(self):
        sheet = Image.open(ROOT / "public/sprites/sasuke/special-effects.png")
        self.assertEqual(sheet.size, (512, 288))
        seen = set()
        for n in range(12):
            x, y = n % 4 * 128, n // 4 * 96
            cel = sheet.crop((x, y, x + 128, y + 96))
            mask = cel.getchannel("A")
            self.assertEqual(set(mask.tobytes()), {0, 255})
            l, t, r, b = mask.getbbox()
            self.assertGreaterEqual(min(l, t, 128 - r, 96 - b), 2)
            seen.add(cel.tobytes())
        self.assertEqual(len(seen), 12)


if __name__ == "__main__":
    unittest.main()
