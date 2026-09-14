#!/usr/bin/env python3
"""Perform guarded, simulation-only one-shot Gazebo fault actions."""

from copy import deepcopy
import json
import time

from gazebo_msgs.msg import EntityState, ModelStates
from gazebo_msgs.srv import SetEntityState
from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from simulation_faults import validate_fault_request, vehicle_names


class SimulationFaultInjector(Node):
    """Teleport and restore simulated vehicles without exposing real controls."""

    def __init__(self):
        super().__init__("simulation_fault_injector")
        self.declare_parameter("vehicle_count", 8)
        self.declare_parameter("vehicle_prefix", "vehicle_")
        count = int(self.get_parameter("vehicle_count").value)
        prefix = str(self.get_parameter("vehicle_prefix").value)
        self.vehicle_names = vehicle_names(count, prefix)
        self.current_states = {}
        self.saved_states = {}
        self.status_publisher = self.create_publisher(
            String, "/traffic/simulation_fault_status", 10
        )
        self.set_state_client = self.create_client(
            SetEntityState, "/gazebo/set_entity_state"
        )
        self.create_subscription(
            ModelStates, "/gazebo/model_states", self.on_models, 10
        )
        self.create_subscription(
            String,
            "/traffic/simulation_fault_action",
            self.on_action,
            10,
        )
        self.get_logger().warning(
            "Simulation fault injector enabled; it only targets Gazebo vehicle models"
        )

    def on_models(self, message):
        """Cache current Gazebo state for bounded teleport and restore actions."""
        allowed = set(self.vehicle_names)
        for name, pose, twist in zip(message.name, message.pose, message.twist):
            if name not in allowed:
                continue
            state = EntityState()
            state.name = name
            state.pose = deepcopy(pose)
            state.twist = deepcopy(twist)
            state.reference_frame = "world"
            self.current_states[name] = state

    def publish_status(self, action, vehicle_id, status, detail):
        """Publish one JSON result for display on the health page."""
        payload = {
            "action": action,
            "vehicle_id": vehicle_id,
            "status": status,
            "detail": detail,
            "observed_at": time.time(),
        }
        self.status_publisher.publish(
            String(data=json.dumps(payload, separators=(",", ":")))
        )

    def on_action(self, message):
        """Validate and execute one teleport or restore request."""
        try:
            payload = validate_fault_request(
                json.loads(message.data), self.vehicle_names
            )
        except (TypeError, ValueError) as error:
            self.publish_status("invalid", "unknown", "failed", str(error))
            return
        action = payload["action"]
        name = payload["vehicle_id"]
        if action not in {"teleport", "restore"}:
            return
        current = self.current_states.get(name)
        if current is None:
            self.publish_status(action, name, "failed", "Gazebo model not observed")
            return
        if not self.set_state_client.service_is_ready():
            self.publish_status(action, name, "failed", "Gazebo service unavailable")
            return

        if action == "teleport":
            self.saved_states.setdefault(name, deepcopy(current))
            target = deepcopy(current)
            target.pose.position.x += payload["offset_x"]
            target.pose.position.y += payload["offset_y"]
            target.twist = Twist()
        else:
            target = self.saved_states.get(name)
            if target is None:
                self.publish_status(action, name, "failed", "No saved pose to restore")
                return
            target = deepcopy(target)

        request = SetEntityState.Request()
        request.state = target
        future = self.set_state_client.call_async(request)
        future.add_done_callback(
            lambda result, requested_action=action, vehicle=name: self.on_result(
                result, requested_action, vehicle
            )
        )
        self.publish_status(action, name, "requested", "Waiting for Gazebo")

    def on_result(self, future, action, vehicle_id):
        """Report the Gazebo service result and finish successful restores."""
        try:
            response = future.result()
            succeeded = bool(response.success)
            detail = (
                "Gazebo state updated" if succeeded else "Gazebo rejected the request"
            )
        except Exception as error:  # pragma: no cover - depends on ROS service failure.
            succeeded = False
            detail = str(error)
        if succeeded and action == "restore":
            self.saved_states.pop(vehicle_id, None)
        self.publish_status(
            action,
            vehicle_id,
            "succeeded" if succeeded else "failed",
            detail,
        )


def main(args=None):
    rclpy.init(args=args)
    node = SimulationFaultInjector()
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
