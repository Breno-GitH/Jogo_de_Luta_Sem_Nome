"""Read the actual fight atlases and check anatomical landmarks in native pixels."""
import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from pack_ben_body import DATA, feedback_landmarks
from inspect_ben_body import SPRITES, cel, cels, runtime
from pack_nrg_armor import visor

FORMS = json.loads(DATA.read_text(encoding="utf8"))
FEEDBACK = FORMS["feedback"]
MOTION = json.loads(DATA.with_name("feedback-motion-art.json").read_text(encoding="utf8"))
ARMOR = json.loads(DATA.with_name("nrg-armor-art.json").read_text(encoding="utf8"))

# Native-pixel landmarks on the near side. Measure chains through the
# elbow and knee so a bent limb does not register as a shorter bone.
# Order: crown, chin, shoulder, elbow, hand, hip, knee, ankle.
LANDMARKS = {
    "idle": (0, [(21,-133),(29,-119),(3,-107),(-7,-80),(-9,-34),(14,-76),(4,-41),(-4,-10)]),
    "walkForward": (2, [(36,-122),(39,-111),(10,-99),(-1,-76),(-2,-45),(19,-65),
                        (4,-40),(-9,-11)]),
    "conductor_medium": (2, [(11,-109),(16,-97),(-9,-94),(-33,-80),(-46,-93),(-10,-63),
                              (-26,-36),(-38,-9)]),
    "discharge_medium": (2, [(10,-107),(14,-92),(-9,-85),(18,-78),(58,-86),(-6,-54),(23,-40),(23,-10)]),
}


def frame(art, name, at=0):
    clip = art["clips"][name]
    return cel(art, clip, clip["frames"][at])


def landmarks(points):
    crown, chin, shoulder, elbow, hand, hip, knee, ankle = points
    return (math.dist(crown, chin), math.dist(shoulder, hip),
            math.dist(shoulder, elbow)+math.dist(elbow, hand),
            math.dist(hip, knee)+math.dist(knee, ankle))


class BenAnatomy(unittest.TestCase):
    def test_transparent_native_cels_use_one_fixed_pivot_and_scale_per_form(self):
        for key, art in FORMS.items():
            self.assertEqual(art["scale"], 1)
            self.assertTrue(all(not (set(c) & {"scale","pivot","frameWidth","frameHeight","sheet"})
                                for c in art["clips"].values()), key)
            for (_, index), (_, im, pivot) in cels(art).items():
                self.assertEqual(pivot, art["pivot"])
                self.assertTrue(set(np.unique(np.asarray(im.getchannel("A")))) <= {0,255}, (key,index))
                self.assertIsNotNone(im.getbbox(), (key,index))

    def test_idle_cels_are_distinct_but_have_identical_ground_contact(self):
        for key, art in FORMS.items():
            samples = [frame(art,"idle",i)[0] for i in range(6)]
            self.assertEqual(len({im.tobytes() for im in samples}), 6, key)
            y = art["pivot"]["y"]
            soles = {im.getchannel("A").crop((0,y-5,im.width,y+1)).tobytes() for im in samples}
            self.assertEqual(len(soles), 1, key)

    def test_feedback_checks_head_torso_and_limb_landmarks_against_idle(self):
        _, reference_points = LANDMARKS["idle"]
        base = landmarks(reference_points)
        for name, (index, points) in LANDMARKS.items():
            with self.subTest(clip=name):
                im, pivot = frame(FEEDBACK,name,index)
                for x,y in points:
                    x, y = x+pivot["x"], y+pivot["y"]
                    self.assertTrue(np.asarray(im.getchannel("A"))[y-4:y+5,x-4:x+5].any(), (name,x,y))
                for value, ref, minimum, maximum in zip(landmarks(points),base,
                                                        (.55,.73,.54,.77),(1.21,1.25,1.20,1.26)):
                    self.assertLessEqual(minimum*ref,value)
                    self.assertLessEqual(value,maximum*ref)

    def test_feedback_chest_width_and_length_stay_at_model_scale_in_specials(self):
        base = np.median([feedback_landmarks(frame(FEEDBACK,"idle",i)[0])["span"] for i in range(6)])
        for name in ("storm_light","storm_medium","conductor_light","conductor_medium","discharge_light","discharge_medium"):
            clip = FEEDBACK["clips"][name]
            for i in range(len(clip["frames"])):
                a = feedback_landmarks(frame(FEEDBACK,name,i)[0])
                self.assertIsNotNone(a, (name,i))
                self.assertTrue(base * .79 <= a["span"] <= base * 1.20, (name,i,a["span"],base))
                self.assertTrue(11 <= a["width"] <= 23, (name,i,a["width"]))

    def test_feedback_antennae_have_two_complete_gold_connectors_in_air_and_storm(self):
        for name in ("air_medium", "storm_light", "storm_medium"):
            for i,index in enumerate(FEEDBACK["clips"][name]["frames"]):
                im, pivot = frame(FEEDBACK,name,i)
                ends = FEEDBACK["tips"][str(index)]
                self.assertEqual(len(ends),2)
                self.assertGreater(math.dist((ends[0]["x"],ends[0]["y"]),(ends[1]["x"],ends[1]["y"])),15)
                r,g,b,a = np.asarray(im).astype(np.int16).transpose(2,0,1)
                golden = (a==255)&(r>150)&(g>95)&(g>b+45)
                for end in ends:
                    x,y = end["x"]+pivot["x"],end["y"]+pivot["y"]
                    self.assertTrue(1 <= x < im.width-1 and 1 <= y < im.height-1, (name,i,end))
                    self.assertFalse(a[0].any() or a[-1].any() or a[:,0].any() or a[:,-1].any())
                    area = golden[max(0,y-8):y+9,max(0,x-8):x+9]
                    self.assertGreaterEqual(area.sum(),7,(name,i,end))

    def test_feedback_walk_cels_keep_both_plugs_and_the_measured_support_on_the_floor(self):
        for key, speed in (("walkForward", 5.8), ("walkBack", -4.5)):
            clip = MOTION["clips"][key]
            self.assertEqual(len(clip["frames"]), 8)
            self.assertTrue(clip["loop"])
            poses = [frame(MOTION, key, i)[0] for i in range(8)]
            self.assertEqual(len({im.tobytes() for im in poses}), 8)
            y = MOTION["pivot"]["y"]
            support = MOTION["supports"][key]
            for i, im in enumerate(poses):
                x = MOTION["pivot"]["x"] + support[i]["x"]
                self.assertTrue(np.asarray(im.getchannel("A"))[y-7:y+1,x-4:x+5].any(), (key,i))
                self.assertLessEqual(im.getbbox()[3], y)
                marked = feedback_landmarks(im)
                face_y, face_x = marked["face"]
                near_head = [c.mean(0) for c in marked["gold"] if face_y-6 <= c.mean(0)[0] <= face_y+26]
                self.assertTrue(any(px < face_x-19 for py,px in near_head), (key,i,"rear plug"))
                self.assertTrue(any(px > face_x+18 for py,px in near_head), (key,i,"front plug"))
            for half in range(0, 8, 4):
                contact = [support[i]["x"] + sum(clip["durations"][half:i])*speed for i in range(half,half+4)]
                self.assertLessEqual(max(contact)-min(contact), 14, (key, half, contact))

    def test_feedback_capture_atlas_has_transparent_margins_on_every_frame(self):
        for key in ("conductor_light", "conductor_medium", "conductorHold", "conductorHoldK"):
            for index in MOTION["clips"][key]["frames"]:
                im, pivot = cel(MOTION, MOTION["clips"][key], index)
                alpha = np.asarray(im.getchannel("A"))
                self.assertTrue(set(np.unique(alpha)) <= {0, 255})
                self.assertFalse(alpha[0].any() or alpha[-1].any() or alpha[:,0].any() or alpha[:,-1].any())
                self.assertEqual(pivot, MOTION["pivot"])

    def test_nrg_armor_cels_keep_the_visor_and_pivot_at_native_scale(self):
        reference, _ = frame(FORMS["nrg"], "idle")
        span = visor(reference)[1]
        with Image.open(SPRITES / ARMOR["sheet"]) as atlas:
            for name, clip in ARMOR["clips"].items():
                poses = set()
                for i in clip["frames"]:
                    w,h = ARMOR["frameWidth"], ARMOR["frameHeight"]
                    x,y = (i % ARMOR["columns"])*w, (i // ARMOR["columns"])*h
                    im = atlas.crop((x,y,x+w,y+h)).convert("RGBA")
                    poses.add(im.tobytes())
                    alpha = np.asarray(im.getchannel("A"))
                    self.assertTrue(set(np.unique(alpha)) <= {0,255})
                    self.assertFalse(alpha[0].any() or alpha[-1].any() or alpha[:,0].any() or alpha[:,-1].any())
                    self.assertEqual(im.getbbox()[3], ARMOR["pivot"]["y"])
                    self.assertTrue(span * .72 <= visor(im)[1] <= span * 1.34, (name,i,visor(im)))
                self.assertGreaterEqual(len(poses), 3, name)

    def test_nrg_heat_release_and_released_atlas_are_the_approved_cels(self):
        art = runtime()
        for name in ("idle", "thermal_light", "thermal_medium", "nrgUnseal_light", "nrgLock"):
            self.assertEqual(art["nrg"]["clips"][name], FORMS["nrg"]["clips"][name])
        self.assertEqual(art["nrg"]["sheet"], FORMS["nrg"]["sheet"])
        self.assertEqual(art["nrgReleased"], FORMS["nrgReleased"])

    def test_nrg_directional_flight_uses_distinct_art_in_every_direction(self):
        form = FORMS["nrgReleased"]
        directions = ("flyIdle","flyUp","flyDown","flyForward","flyBack",
                      "flyForwardUp","flyBackUp","flyForwardDown","flyBackDown")
        poses = []
        for direction in directions:
            indexes = form["clips"][direction]["frames"]
            self.assertGreaterEqual(len(set(indexes)),2)
            poses.append(tuple(indexes))
        self.assertEqual(len(set(poses)),len(directions))


if __name__ == "__main__":
    unittest.main(verbosity=2)

