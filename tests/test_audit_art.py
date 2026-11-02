"""Regression checks for defects measured during the 2026-10-29 audit."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from audit_samurai import measure


class AuditRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.report=measure()

    def test_all_exported_cells_have_clean_transparency_and_no_clipping(self):
        for issue in ['invalidAlpha','dirtyTransparentRGB','edgeClipping']:
            self.assertEqual(self.report[issue],[],issue)

    def test_no_identical_or_translation_only_cells_within_each_clip(self):
        self.assertEqual(self.report['identicalWithinClip'],[])
        self.assertEqual(self.report['translationOnlyWithinClip'],[])

    def test_arm_targets_do_not_require_stretching_beyond_anatomical_reach(self):
        for pose in self.report['armReachRatio']:
            self.assertLessEqual(pose['ratio'],1,pose)

    def test_leg_targets_do_not_require_stretching_beyond_anatomical_reach(self):
        for pose in self.report['legReachRatio']:
            self.assertLessEqual(pose['ratio'],1,pose)

    def test_planted_keyframes_track_real_movement_speed(self):
        for clip,contact in self.report['walkContact'].items():
            self.assertGreaterEqual(len(contact['groundedKeyframeSlipPx']),4,clip)
            self.assertLessEqual(max(contact['groundedKeyframeSlipPx']),1,clip)

    def test_full_active_blade_segments_are_aligned_and_keep_length(self):
        lengths=self.report['activeBladeLengthPixels']
        self.assertLess(max(lengths)-min(lengths),.04)
        for pose in self.report['activeBladeCoverage']:
            self.assertGreaterEqual(pose['fractionWithin2px'],.90,pose)


if __name__=='__main__':unittest.main(verbosity=2)
