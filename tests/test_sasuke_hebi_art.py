"""Verifies the real atlas cells and the contact track against the art."""
import hashlib
import json
from pathlib import Path
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/data"
SPRITES = ROOT / "public/sprites/sasuke"
META = json.loads((DATA / "sasuke-frames.json").read_text())
NORMALS = json.loads((DATA / "sasuke-normals.json").read_text(encoding="utf-8-sig"))


def cel(sheet, index):
    x, y = index % 8 * 256, index // 8 * 256
    return sheet.crop((x, y, x+256, y+256))


class SasukeHebiArt(unittest.TestCase):
    def test_movement_has_45_distinct_binary_alpha_cels_and_correct_ground_pivot(self):
        with Image.open(SPRITES / "movement.png") as sheet:
            hashes = set()
            for name, indices in META["movement"].items():
                for i in indices:
                    sprite = cel(sheet, i)
                    alpha = sprite.getchannel("A")
                    self.assertLessEqual(set(alpha.tobytes()), {0, 255})
                    x0, y0, x1, y1 = alpha.getbbox()
                    self.assertGreater(min(x0, y0), 3)
                    self.assertLess(max(x1, y1), 253)
                    if name in ("idle", "walkForward", "walkBack", "crouchIdle", "crouchStart", "crouchEnd", "landing"):
                        self.assertEqual(y1, 224)
                    hashes.add(hashlib.sha256(sprite.tobytes()).digest())
            self.assertEqual(len(hashes), 45)
            self.assertEqual(cel(sheet, 0).tobytes(), Image.open(SPRITES / "base.png").tobytes())
            _, top, _, bottom = cel(sheet, 0).getbbox()
            self.assertIn(bottom - top, range(125, 135))

    def test_every_active_contact_sits_on_the_authored_weapon_or_limb(self):
        with Image.open(SPRITES / "normals.png") as sheet:
            all_hashes = set()
            for id, poses in META["normals"].items():
                first, end = NORMALS[id]["activeFrames"]
                for i, pose in enumerate(poses):
                    sprite = cel(sheet, pose["frame"])
                    alpha = sprite.getchannel("A")
                    all_hashes.add(hashlib.sha256(sprite.tobytes()).digest())
                    self.assertTrue(pose["hurtboxes"])
                    self.assertEqual("blade" in pose, id.endswith("_heavy") and first <= i < end)
                    if i < first or i >= end:
                        continue
                    contact = pose.get("blade") or pose["hitboxes"][0]
                    for t in (0, .5, 1):
                        x = round((1-t)*contact["a"]["x"] + t*contact["b"]["x"]) + 128
                        y = round((1-t)*contact["a"]["y"] + t*contact["b"]["y"]) + 224
                        self.assertIsNotNone(alpha.crop((x-5,y-5,x+6,y+6)).getbbox(), (id, i, x, y))
            self.assertEqual(len(all_hashes), 36)



    def test_throw_cells_and_grip_match_the_two_approved_forms(self):
        boxes = json.loads((DATA / "sasuke-throw-boxes.json").read_text())
        for form, box in boxes.items():
            with Image.open(SPRITES / f"throw-{form}.png") as sheet:
                self.assertEqual(sheet.size, (1152, 576))
                hashes = set()
                for i in range(6):
                    x, y = i % 3 * 384, i // 3 * 288
                    sprite = sheet.crop((x, y, x + 384, y + 288))
                    alpha = sprite.getchannel("A")
                    self.assertEqual(set(alpha.tobytes()), {0, 255})
                    left, top, right, bottom = alpha.getbbox()
                    self.assertGreaterEqual(min(left, top, 384 - right), 12)
                    self.assertEqual(bottom, 248)
                    hashes.add(hashlib.sha256(sprite.tobytes()).digest())
                    if i == 1:
                        px, py = box["x"] + 192 + box["w"] // 2, box["y"] + 248 + box["h"] // 2
                        self.assertIsNotNone(alpha.crop((px - 4, py - 4, px + 5, py + 5)).getbbox())
                self.assertEqual(len(hashes), 6)
        with Image.open(SPRITES / "menu-idle.webp") as idle:
            self.assertEqual(idle.size, (256, 256))
            self.assertEqual(idle.n_frames, 6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
