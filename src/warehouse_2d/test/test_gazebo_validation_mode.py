import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from traffic_common import open_database  # noqa: E402
from traffic_recorder import Track, TrafficRecorder  # noqa: E402


def test_amcl_recording_does_not_use_gazebo_truth_when_validation_is_disabled(tmp_path):
    recorder = TrafficRecorder.__new__(TrafficRecorder)
    recorder.connection = open_database(tmp_path / "traffic.db")
    recorder.main_vehicle = "my_robot"
    recorder.stale_after = 5.0
    recorder.ground_truth = {
        "vehicle_1": Track(5.0, 6.0, 0.2, time.monotonic(), "gazebo_ground_truth", "map")
    }
    amcl = Track(5.2, 6.1, 0.2, time.monotonic(), "amcl", "map")

    recorder.validate_against_gazebo = False
    recorder._record_localization_metric("vehicle_1", amcl, 100.0, 10.0)
    assert recorder.connection.execute(
        "SELECT COUNT(*) FROM localization_metrics"
    ).fetchone()[0] == 0

    recorder.validate_against_gazebo = True
    recorder._record_localization_metric("vehicle_1", amcl, 101.0, 11.0)
    assert recorder.connection.execute(
        "SELECT COUNT(*) FROM localization_metrics"
    ).fetchone()[0] == 1
    recorder.connection.close()
