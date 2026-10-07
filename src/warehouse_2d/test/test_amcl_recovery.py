"""AMCL startup recovery must activate nodes left inactive by manager timeouts."""

from pathlib import Path
import sys
from types import SimpleNamespace

from lifecycle_msgs.msg import State, Transition

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from ensure_traffic_amcl import TrafficAmclRecovery, next_transition  # noqa: E402


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
