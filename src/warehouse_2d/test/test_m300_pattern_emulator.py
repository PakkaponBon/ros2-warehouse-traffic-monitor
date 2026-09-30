import math
import sys
from pathlib import Path


PACKAGE_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(PACKAGE_ROOT / "scripts"))

from m300_pattern_emulator import pattern_accepts  # noqa: E402


KEEP_RATIO = 154600.0 / (720.0 * 70.0 * 8.0)


def sampled_pattern(frame_index):
    accepted = set()
    for horizontal in range(360):
        azimuth = -math.pi + horizontal * 2.0 * math.pi / 360.0
        for vertical in range(70):
            elevation = math.radians(-10.0 + vertical * 70.0 / 69.0)
            if pattern_accepts(azimuth, elevation, frame_index, KEEP_RATIO):
                accepted.add((horizontal, vertical))
    return accepted


def test_pattern_retains_the_documented_approximate_point_ratio():
    pattern = sampled_pattern(0)
    observed_ratio = len(pattern) / (360.0 * 70.0)
    assert abs(observed_ratio - KEEP_RATIO) < 0.02


def test_pattern_changes_and_accumulates_across_frames():
    first = sampled_pattern(0)
    second = sampled_pattern(1)
    assert first != second
    assert len(first | second) > len(first)
