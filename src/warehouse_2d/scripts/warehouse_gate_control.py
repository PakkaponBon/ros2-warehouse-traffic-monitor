#!/usr/bin/env python3
"""Slide one Warehouse demo gate open or closed through Gazebo state services."""

import argparse
from copy import deepcopy
import sys
import time

from gazebo_msgs.srv import GetEntityState, SetEntityState
from geometry_msgs.msg import Twist
import rclpy


# World coordinates match SLIDING_GATES in generate_warehouse_layout_demo.py.
GATES = {
    "north": ("warehouse_north_gate", (0.0, 27.5, 1.25), (-3.3, 27.5, 1.25)),
    "east": ("warehouse_east_gate", (47.9, 0.0, 1.25), (47.9, 4.0, 1.25)),
    "south": ("warehouse_south_gate", (-24.0, -27.5, 1.25), (-20.0, -27.5, 1.25)),
}


def call_service(node, client, request, timeout):
    future = client.call_async(request)
    rclpy.spin_until_future_complete(node, future, timeout_sec=timeout)
    if not future.done():
        raise TimeoutError(f"Gazebo service {client.srv_name} timed out")
    return future.result()


def move_gate(node, gate, action, duration, timeout):
    name, closed_pose, open_pose = GATES[gate]
    get_client = node.create_client(GetEntityState, "/gazebo/get_entity_state")
    set_client = node.create_client(SetEntityState, "/gazebo/set_entity_state")
    for client in (get_client, set_client):
        if not client.wait_for_service(timeout_sec=timeout):
            raise RuntimeError(f"Gazebo service {client.srv_name} is unavailable")

    get_request = GetEntityState.Request()
    get_request.name = name
    get_request.reference_frame = "world"
    current = call_service(node, get_client, get_request, timeout)
    if not current.success:
        raise RuntimeError(f"Gate model {name} was not found; relaunch the Warehouse demo")

    start = current.state.pose.position
    origin = (start.x, start.y, start.z)
    target = open_pose if action == "open" else closed_pose
    if all(abs(a - b) < 0.001 for a, b in zip(origin, target)):
        print(f"{gate} gate is already {action}")
        return

    steps = max(1, min(60, round(duration * 10)))
    started = time.monotonic()
    for index in range(1, steps + 1):
        fraction = index / steps
        request = SetEntityState.Request()
        request.state.name = name
        request.state.reference_frame = "world"
        request.state.pose = deepcopy(current.state.pose)
        position = request.state.pose.position
        position.x = origin[0] + (target[0] - origin[0]) * fraction
        position.y = origin[1] + (target[1] - origin[1]) * fraction
        position.z = origin[2] + (target[2] - origin[2]) * fraction
        request.state.twist = Twist()
        response = call_service(node, set_client, request, timeout)
        if not response.success:
            raise RuntimeError(f"Gazebo rejected movement of {name}")
        if index < steps:
            time.sleep(max(0.0, started + duration * fraction - time.monotonic()))
    print(f"{gate} gate {'opened' if action == 'open' else 'closed'}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gate", choices=GATES)
    parser.add_argument("action", choices=("open", "close"))
    parser.add_argument("--duration", type=float, default=2.0,
                        help="Slide time in seconds (default: 2)")
    parser.add_argument("--timeout", type=float, default=5.0,
                        help="ROS service timeout in seconds (default: 5)")
    options = parser.parse_args(argv)
    if options.duration < 0 or options.timeout <= 0:
        parser.error("duration must be nonnegative and timeout must be positive")

    rclpy.init(args=[])
    node = rclpy.create_node("warehouse_gate_control")
    try:
        move_gate(node, options.gate, options.action,
                  options.duration, options.timeout)
        return 0
    except (RuntimeError, TimeoutError) as error:
        print(f"Gate control failed: {error}", file=sys.stderr)
        return 1
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    sys.exit(main())
