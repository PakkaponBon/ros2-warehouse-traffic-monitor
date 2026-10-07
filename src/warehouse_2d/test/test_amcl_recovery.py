"""AMCL startup recovery must activate nodes left inactive by manager timeouts."""

from pathlib import Path
import sys
from types import SimpleNamespace

from lifecycle_msgs.msg import State, Transition

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from ensure_traffic_amcl import TrafficAmclRecovery, next_transition  # noqa: E402
from gazebo_amcl_validator import (  # noqa: E402
    GazeboAmclValidator, VehicleValidation, pose_within_drive_tolerance,
)


def test_validation_stop_does_not_restart_at_the_same_noisy_boundary():
    limits = dict(position_tolerance=.4, yaw_tolerance=.25)
    vehicle = VehicleValidation(state='ready', position_error=.39, yaw_error=.02)
    assert pose_within_drive_tolerance(vehicle, limits)
    vehicle.position_error = .41
    assert not pose_within_drive_tolerance(vehicle, limits)
    vehicle.state = 'validating'
    for error in (.39, .38, .40, .35):
        vehicle.position_error = error
        assert not pose_within_drive_tolerance(vehicle, limits)
    vehicle.position_error = .29
    assert pose_within_drive_tolerance(vehicle, limits)
    vehicle.yaw_error = .2
    assert not pose_within_drive_tolerance(vehicle, limits)
    vehicle.state = 'ready'
    assert pose_within_drive_tolerance(vehicle, limits)


def test_validator_recovers_once_instead_of_repeatedly_releasing_near_boundary(monkeypatch):
    from geometry_msgs.msg import TransformStamped
    from rclpy.time import Time

    node = GazeboAmclValidator.__new__(GazeboAmclValidator)
    node.settings = dict(freshness_timeout=1., maximum_time_skew=.25,
                         position_tolerance=.4, yaw_tolerance=.25,
                         recovery_position_error=.75, recovery_yaw_error=.45,
                         confirmation_samples=3)
    vehicle = VehicleValidation(truth=(0., 0., 0.), truth_received=99.9,
                                truth_stamp=10_000_000_000, scan_received=99.9,
                                scan_stamp=10_000_000_000, amcl_received=99.9,
                                amcl_stamp=10_000_000_000, state='ready')
    node.vehicles = {'a': vehicle}
    transform = TransformStamped()
    transform.transform.rotation.w = 1.
    node.tf_buffer = SimpleNamespace(lookup_transform=lambda *args: transform)
    node.get_clock = lambda: SimpleNamespace(now=lambda: Time(nanoseconds=10_000_000_000))
    node.get_logger = lambda: SimpleNamespace(info=lambda text: None, warning=lambda text: None)
    node.request_scan_update = lambda *args: None
    node.reset_amcl = lambda *args: None
    states = []
    node.publish_status = lambda name: states.append(vehicle.state)
    monkeypatch.setattr('gazebo_amcl_validator.time.monotonic', lambda: 100.)

    for index, error in enumerate((.41, .39, .38, .39, .38, .39), start=1):
        transform.header.stamp = Time(nanoseconds=10_000_000_000 + index).to_msg()
        transform.transform.translation.x = error
        node.validate()
    assert 'ready' not in states
    assert vehicle.generation == 1
    assert vehicle.reset_required


def test_only_configurable_amcl_states_get_transitions():
    assert next_transition(State.PRIMARY_STATE_UNCONFIGURED) == Transition.TRANSITION_CONFIGURE
    assert next_transition(State.PRIMARY_STATE_INACTIVE) == Transition.TRANSITION_ACTIVATE
    assert next_transition(State.PRIMARY_STATE_ACTIVE) is None


def test_inactive_amcl_is_activated_after_state_reply(monkeypatch):
    requests = []
    change_client = SimpleNamespace(
        service_is_ready=lambda: True,
        call_async=lambda request: requests.append(request) or SimpleNamespace(done=lambda: False),
    )
    state_client = SimpleNamespace()
    state_reply = SimpleNamespace(
        done=lambda: True,
        result=lambda: SimpleNamespace(current_state=SimpleNamespace(id=State.PRIMARY_STATE_INACTIVE)),
    )
    node = TrafficAmclRecovery.__new__(TrafficAmclRecovery)
    node.lifecycle_clients = {"vehicle_4": (state_client, change_client)}
    node.pending = {"vehicle_4": ("get", state_client, state_reply, 0.0)}
    node.request_timeout = 8.0
    monkeypatch.setattr("ensure_traffic_amcl.time.monotonic", lambda: 1.0)

    node.check_states()

    assert requests[0].transition.id == Transition.TRANSITION_ACTIVATE
    assert node.pending["vehicle_4"][0] == f"transition {Transition.TRANSITION_ACTIVATE}"
