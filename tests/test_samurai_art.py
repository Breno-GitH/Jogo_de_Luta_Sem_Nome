"""Validate production PNGs, independently of the exporter's own assertions."""
from pathlib import Path
import json
import unittest
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/sprites/samurai"


class SamuraiArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames = [Image.open(OUT/f"idle-{i:02}.png").convert("RGBA") for i in range(6)]
        cls.meta = json.loads((OUT/"idle.json").read_text(encoding="utf-8"))

    def test_png_cells_and_sheet_are_consistent(self):
        sheet = Image.open(OUT/"idle.png").convert("RGBA")
        self.assertEqual(sheet.size,(1536,256))
        for i,frame in enumerate(self.frames):
            self.assertEqual(frame.size,(256,256))
            self.assertEqual(frame.tobytes(),sheet.crop((i*256,0,(i+1)*256,256)).tobytes())

    def test_alpha_is_binary_and_background_is_empty(self):
        for frame in self.frames:
            data=np.array(frame)
            self.assertEqual(set(np.unique(data[:,:,3])),{0,255})
            self.assertTrue(np.all(data[0]==0))
            self.assertTrue(np.all(data[-1]==0))
            self.assertTrue(np.all(data[:,0]==0))
            self.assertTrue(np.all(data[:,-1]==0))
            self.assertTrue(np.all(data[data[:,:,3]==0]==0))

    def test_height_baseline_and_feet_are_stable(self):
        for frame in self.frames:
            bounds=frame.getbbox()
            self.assertTrue(126<=bounds[3]-bounds[1]<=134)
            self.assertEqual(bounds[3],224)
            self.assertTrue(np.array_equal(np.array(frame)[215:],np.array(self.frames[0])[215:]))

    def test_frames_are_not_copies_or_translations(self):
        self.assertEqual(len({frame.tobytes() for frame in self.frames}),6)
        self.assertEqual(len({frame.crop(frame.getbbox()).tobytes() for frame in self.frames}),6)
        # Torso/arms and coat must change independently, not only the hair tip.
        for region in [(102,128,148,166),(52,158,118,200)]:
            self.assertGreaterEqual(len({frame.crop(region).tobytes() for frame in self.frames}),3)

    def test_limited_palette_and_player_two_identity(self):
        sheet=np.array(Image.open(OUT/"idle.png").convert("RGBA"))
        p2=np.array(Image.open(OUT/"idle-p2.png").convert("RGBA"))
        self.assertLessEqual(len(self.meta["palette"]),36)
        self.assertEqual(p2.shape,sheet.shape)
        self.assertTrue(np.array_equal(sheet[:,:,3],p2[:,:,3]))
        self.assertFalse(np.array_equal(sheet,p2))
        for color in [(255,208,160),(231,167,118),(241,245,245),(20,22,33)]:
            mask=np.all(sheet[:,:,:3]==color,axis=2)
            self.assertTrue(mask.any())
            self.assertTrue(np.array_equal(sheet[mask],p2[mask]))

    def test_apng_and_nearest_neighbor_preview(self):
        with Image.open(OUT/"idle-preview.png") as preview:
            self.assertEqual(preview.n_frames,6)
        contact=np.array(Image.open(OUT/"preview-4x.png"))
        self.assertEqual(contact.shape[0]%4,0)
        self.assertEqual(contact.shape[1]%4,0)
        down=contact[::4,::4]
        self.assertTrue(np.array_equal(contact,np.repeat(np.repeat(down,4,axis=0),4,axis=1)))

    def test_runtime_metadata_matches_the_actual_export(self):
        data=json.loads((ROOT/"src/data/animations.json").read_text(encoding="utf-8"))["clips"]["idle"]
        self.assertEqual(data["frames"],list(range(6)))
        self.assertEqual(data["durations"],self.meta["durations"])
        self.assertEqual(data["pivot"],{"x":128,"y":224})
        self.assertEqual(data["frameWidth"],256)
        self.assertEqual(data["frameHeight"],256)
        self.assertEqual(data["scale"],1)
        self.assertEqual(data["columns"],6)
        self.assertTrue((ROOT/"public/sprites"/data["sheet"]).exists())
        self.assertTrue((ROOT/"public/sprites"/data["player2Sheet"]).exists())


if __name__=="__main__":
    unittest.main(verbosity=2)
