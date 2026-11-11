"""Kirin body alignment, fx separation and alpha at native scale."""
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public/sprites/sasuke"


class KirinArt(unittest.TestCase):
    def test_each_cel_is_unique_and_wholly_padded(self):
        for name,w,h,cols,rows in [("base",384,288,3,3),("curse",384,288,3,3),
                                   ("dragon",512,352,2,2),("sky",512,352,2,2),("dragon-black",512,352,2,2),("sky-black",512,352,2,2)]:
            sheet = Image.open(ROOT / f"kirin-{name}.png")
            self.assertEqual(sheet.size,(cols*w,rows*h))
            cels = set()
            for j in range(rows):
                for i in range(cols):
                    cel = sheet.crop((i*w,j*h,(i+1)*w,(j+1)*h))
                    mask = cel.getchannel("A")
                    self.assertEqual(set(mask.tobytes()),{0,255})
                    l,t,r,b = mask.getbbox()
                    self.assertGreaterEqual(min(l,t,w-r,h-b),8)
                    if name in ("base","curse"):
                        self.assertEqual(b,248)
                    cels.add(cel.tobytes())
            self.assertEqual(len(cels),cols*rows)


    def test_polished_special_atlases_have_distinct_padded_cels(self):
        for name,w,h,cols,rows in [("chidori-dash",384,288,3,2),
                                   ("chidori-dash-curse",384,288,3,2),
                                   ("goryuka-heads",128,108,3,2)]:
            sheet = Image.open(ROOT / f"{name}.png")
            self.assertEqual(sheet.size, (w*cols,h*rows))
            seen = set()
            for j in range(rows):
                for i in range(cols):
                    cel = sheet.crop((i*w,j*h,(i+1)*w,(j+1)*h))
                    l,t,r,b = cel.getchannel("A").getbbox()
                    self.assertGreaterEqual(min(l,t,w-r,h-b),6)
                    if name.startswith("chidori"):
                        self.assertEqual(b,248)
                    seen.add(cel.tobytes())
            self.assertEqual(len(seen),6)

if __name__ == "__main__":
    unittest.main()
