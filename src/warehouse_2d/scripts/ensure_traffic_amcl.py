#!/usr/bin/env python3
"""Recover traffic AMCL nodes left inactive by a timed-out lifecycle manager."""

import time

from lifecycle_msgs.msg import State, Transition
from lifecycle_msgs.srv import ChangeState, GetState
import rclpy
from rclpy.node import Node


def next_transition(state_id):
    if state_id == State.PRIMARY_STATE_UNCONFIGURED:
        return Transition.TRANSITION_CONFIGURE
    if state_id == State.PRIMARY_STATE_INACTIVE:
        return Transition.TRANSITION_ACTIVATE
    return None


class TrafficAmclRecovery(Node):
    def __init__(self):
        super().__init__("traffic_amcl_recovery")
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("check_period", 5.0)
        self.declare_parameter("request_timeout", 8.0)
        count = int(self.get_parameter("vehicle_count").value)
        self.request_timeout = float(self.get_parameter("request_timeout").value)
        self.lifecycle_clients = {}
        self.pending = {}
        for index in range(1, count + 1):
            name = f"vehicle_{index}"
            prefix = f"/traffic/{name}/amcl"
            self.lifecycle_clients[name] = (
                self.create_client(GetState, f"{prefix}/get_state"),
                self.create_client(ChangeState, f"{prefix}/change_state"),
            )
        self.create_timer(float(self.get_parameter("check_period").value), self.check_states)

    def check_states(self):
        now = time.monotonic()
        for name, (state_client, change_client) in self.lifecycle_clients.items():
            pending = self.pending.get(name)
            if pending is not None:
                action, client, future, started_at = pending
                if not future.done():
                    if now - started_at > self.request_timeout:
                        client.remove_pending_request(future)
                        self.pending.pop(name, None)
                        self.get_logger().warning(f"{name}: lifecycle {action} timed out; retrying")
                    continue
                self.pending.pop(name, None)
                try:
                    response = future.result()
                except Exception as error:
                    self.get_logger().warning(f"{name}: lifecycle {action} failed: {error}")
                    continue
                if action == "get":
                    transition_id = next_transition(response.current_state.id)
                    if transition_id is None or not change_client.service_is_ready():
                        continue
                    request = ChangeState.Request()
                    request.transition.id = transition_id
                    self.pending[name] = (
                        f"transition {transition_id}",
                        change_client,
                        change_client.call_async(request),
                        now,
                    )
                elif not response.success:
                    self.get_logger().warning(f"{name}: lifecycle {action} was rejected; retrying")
                else:
                    self.get_logger().info(f"{name}: lifecycle {action} succeeded")
                continue
            if state_client.service_is_ready():
                self.pending[name] = (
                    "get", state_client, state_client.call_async(GetState.Request()), now
                )


def main(args=None):
    rclpy.init(args=args)
    node = TrafficAmclRecovery()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
