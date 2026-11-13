import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "src/data/ben-final-art.json").read_text(encoding="utf-8"))


class BenFinalArt(unittest.TestCase):
    def test_cels_are_transparent_and_fit_the_fixed_pivot(self):
        for name, manifest in MANIFEST.items():
            with Image.open(ROOT / "public/sprites" / manifest["sheet"]) as atlas:
                self.assertEqual(atlas.mode, "RGBA", name)
                self.assertEqual(manifest["pivot"], {"x": 128, "y": 224})
                self.assertEqual((manifest["frameWidth"], manifest["frameHeight"]), (256, 256))
                for i in {frame for clip in manifest["clips"].values() for frame in clip["frames"]}:
                    cell = self.cell(atlas, manifest, i)
                    mask = cell.getchannel("A")
                    self.assertFalse(any(mask.histogram()[1:255]), (name, i))
                    left, top, right, bottom = mask.getbbox()
                    self.assertTrue(0 < left < right < 256 and 0 < top < bottom == 224, (name, i))

    def test_walks_use_distinct_drawings_at_the_same_body_scale(self):
        for name, height in [("human", 130), ("nrgWalk", 164)]:
            manifest = MANIFEST[name]
            with Image.open(ROOT / "public/sprites" / manifest["sheet"]) as atlas:
                for action in ["walkForward", "walkBack"]:
                    indexes = manifest["clips"][action]["frames"]
                    poses = [self.cell(atlas, manifest, i) for i in indexes]
                    bounds = [pose.getbbox() for pose in poses]
                    unique = {pose.crop(bound).tobytes() for pose, bound in zip(poses, bounds)}
                    self.assertEqual(len(unique), 8, (name, action))
                    for _, top, _, bottom in bounds:
                        self.assertLessEqual(abs(bottom - top - height), 13, (name, action))

    def test_gravattack_jump_preserves_mass_and_ground_origin(self):
        stage7 = json.loads((ROOT / "src/data/ben-stage7-art.json").read_text(encoding="utf-8"))
        manifest = stage7["gravattack"]
        pivot = manifest["pivot"]["y"]
        width, height = manifest["frameWidth"], manifest["frameHeight"]
        cols = manifest["columns"]
        self.assertEqual(manifest["scale"], 1)
        with Image.open(ROOT / "public/sprites" / manifest["sheet"]) as atlas:
            for action in ("jumpRise", "jumpApex", "jumpFall", "landing"):
                for index in manifest["clips"][action]["frames"]:
                    x, y = index % cols * width, index // cols * height
                    box = atlas.crop((x, y, x + width, y + height)).getbbox()
                    self.assertEqual(box[3], pivot, (action, index))
                    self.assertGreaterEqual(box[3] - box[1], 163 if action == "landing" else 173)
                    self.assertLessEqual(box[3] - box[1], 180)

    @staticmethod
    def cell(atlas, manifest, index):
        cols = manifest["columns"]
        x, y = (index % cols) * 256, (index // cols) * 256
        return atlas.crop((x, y, x + 256, y + 256))


if __name__ == "__main__":
    unittest.main()

