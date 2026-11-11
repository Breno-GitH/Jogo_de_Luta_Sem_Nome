import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "public/sprites"
KAN = SPRITES / "kaneki"


class KanekiArt(unittest.TestCase):
    def test_body_atlas_matches_the_native_sasuke_scale_and_stable_ground(self):
        data = json.loads((ROOT / "src/data/kaneki-art.json").read_text(encoding="utf8"))
        atlas = Image.open(KAN / "idle.png")
        self.assertEqual((atlas.mode, atlas.size), ("RGBA", (768, 512)))
        self.assertEqual(data["pivot"], {"x": 128, "y": 224})
        self.assertEqual(data["scale"], 1)
        sasuke = Image.open(SPRITES / "sasuke/base.png").getchannel("A").getbbox()
        unique, footprints = set(), []
        for i, anchor in enumerate(data["lumbar"]):
            x, y = i % 3 * 256, i // 3 * 256
            cel = atlas.crop((x, y, x + 256, y + 256))
            mask = cel.getchannel("A")
            self.assertEqual(set(mask.tobytes()), {0, 255})
            l, t, r, b = mask.getbbox()
            self.assertGreaterEqual(min(l, t, 256 - r), 8)
            self.assertEqual(b, 224)
            self.assertTrue(128 <= b - t <= 135)
            self.assertLessEqual(abs((b - t) - (sasuke[3] - sasuke[1])), 9)
            self.assertEqual(mask.getpixel((128 + anchor["x"], 224 + anchor["y"])), 255)
            boots = mask.crop((l, b - 4, r, b))
            footprints.append((l + boots.getbbox()[0], l + boots.getbbox()[2]))
            head = cel.crop((l, t, r, t + 35))
            reds = [pixel for pixel in head.getdata()
                    if pixel[3] == 255 and pixel[0] >= 103 and pixel[0] > 1.5 * pixel[1]
                    and pixel[0] > 1.5 * pixel[2]]
            self.assertTrue(reds, f"ghoul eye absent in drawing {i + 1}")
            unique.add(cel.tobytes())
            if i == 0:
                self.assertEqual(Image.open(KAN / "base.png").tobytes(), cel.tobytes())
        self.assertEqual(len(unique), 6)
        self.assertTrue(all(max(side) - min(side) <= 2 for side in zip(*footprints)))


    def test_movement_poses_have_authored_cels_lumbar_anchors_and_foot_contact(self):
        data = json.loads((ROOT / "src/data/kaneki-movement-art.json").read_text())
        atlas = Image.open(KAN / "movement.png")
        self.assertEqual((atlas.mode, atlas.size), ("RGBA", (1536, 1792)))
        counts = [6, 6, 5, 5, 2, 2, 2, 3, 2, 1, 2, 3]
        self.assertEqual([len(clip["frames"]) for clip in data["clips"].values()], counts)
        seen = set()
        for name, clip in data["clips"].items():
            self.assertEqual(len(clip["durations"]), len(clip["frames"]))
            for i in clip["frames"]:
                x, y = i % 6 * 256, i // 6 * 256
                cel = atlas.crop((x, y, x + 256, y + 256))
                mask = cel.getchannel("A")
                self.assertEqual(set(mask.tobytes()), {0, 255})
                l, t, r, b = mask.getbbox()
                self.assertTrue(50 <= l < r <= 206 and 79 <= t < b <= 224, (name, i, mask.getbbox()))
                anchor = data["lumbar"][i]
                self.assertEqual(mask.getpixel((128 + anchor["x"], 224 + anchor["y"])), 255)
                plant = data["planted"][i]
                if plant is not None:
                    foot = 128 + plant
                    self.assertIsNotNone(mask.crop((foot - 4, 221, foot + 5, 224)).getbbox(), (name, i, plant))
                self.assertNotIn(cel.tobytes(), seen)
                seen.add(cel.tobytes())
        self.assertEqual(len(seen), 39)
        for i in range(39, 42):
            x, y = i % 6 * 256, i // 6 * 256
            self.assertIsNone(atlas.crop((x, y, x + 256, y + 256)).getbbox())


    def test_native_pose_atlas_has_six_padded_transparent_examples(self):
        atlas = Image.open(KAN / "kagune-poses.png")
        self.assertEqual((atlas.mode, atlas.size), ("RGBA", (1200, 416)))
        red_widths = []
        unique = set()
        for i in range(6):
            x, y = i % 3 * 400, i // 3 * 208
            cel = atlas.crop((x, y, x + 400, y + 208))
            mask = cel.getchannel("A")
            self.assertEqual(set(mask.tobytes()), {0, 255})
            l, t, r, b = mask.getbbox()
            self.assertGreaterEqual(min(l, t, 400 - r, 208 - b), 8)
            unique.add(cel.tobytes())
            red = cel.getchannel("R").point(lambda value: 255 if value >= 181 else 0)
            red_widths.append(red.getbbox()[2] - red.getbbox()[0])
        self.assertEqual(len(unique), 6)
        self.assertLess(red_widths[0], red_widths[1])
        self.assertLess(red_widths[3], red_widths[4])
        self.assertLess(red_widths[5], red_widths[1])



    def test_combat_atlas_keeps_all_authored_poses_and_connected_lumbar_pivots(self):
        data = json.loads((ROOT / "src/data/kaneki-combat-art.json").read_text())
        with Image.open(KAN / "combat.png") as atlas:
            self.assertEqual(atlas.size, (1536, 3328))
            self.assertEqual(len(data["lumbar"]), 78)
            cels = []
            for i, root in enumerate(data["lumbar"]):
                x, y = i % 6 * 256, i // 6 * 256
                cel = atlas.crop((x, y, x + 256, y + 256))
                mask = cel.getchannel("A")
                self.assertEqual(set(mask.tobytes()), {0, 255})
                l, t, r, b = mask.getbbox()
                self.assertGreaterEqual(min(l, t, 256-r), 6)
                self.assertLessEqual(b, 224)
                self.assertEqual(mask.getpixel((128 + root["x"], 224 + root["y"])), 255, i)
                cels.append(cel)
            for move in data["normals"].values():
                frames = move["frames"]
                self.assertEqual(len({cels[i].tobytes() for i in frames}), 6)
                if move["hit"]:
                    p = move["hit"]["b"]
                    px, py = 128 + p["x"], 224 + p["y"]
                    self.assertIsNotNone(cels[frames[3]].getchannel("A").crop(
                        (px-4, py-4, px+5, py+5)).getbbox())

    def test_sasuke_both_taunt_sheets_are_three_distinct_padded_drawings(self):
        for form in ("hebi", "marca"):
            with Image.open(SPRITES / "sasuke" / f"taunt-{form}.png") as atlas:
                self.assertEqual(atlas.size, (1152, 288))
                poses = set()
                for i in range(3):
                    tile = atlas.crop((384*i, 0, 384*(i+1), 288))
                    self.assertEqual(set(tile.getchannel("A").tobytes()), {0, 255})
                    self.assertEqual(tile.getbbox()[3], 248)
                    poses.add(tile.tobytes())
                self.assertEqual(len(poses), 3)


if __name__ == "__main__":
    unittest.main()
