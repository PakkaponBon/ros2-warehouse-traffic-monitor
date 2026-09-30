#!/usr/bin/env python3
"""
Approximate the LDS-M300-E non-repetitive sampling pattern.

Gazebo Classic ray sensors generate a regular angular grid. This node keeps a
time-varying low-discrepancy subset of that grid so successive PointCloud2
messages trace different curved bands and gradually fill the field of view.
It is a behavioural approximation for integration testing, not a reproduction
of PaceCat's proprietary mirror trajectory.
"""

import math
import struct
import time

import rclpy
from rclpy.node import Node
from rclpy.qos import (
    DurabilityPolicy,
    HistoryPolicy,
    QoSProfile,
    ReliabilityPolicy,
    qos_profile_sensor_data,
)
from sensor_msgs.msg import PointCloud2, PointField


TAU = 2.0 * math.pi
GOLDEN_FRACTION = 0.6180339887498949

# Offer reliable delivery on the processed cloud so it works with both the
# default RViz PointCloud2 display (Reliable) and sensor consumers that request
# Best Effort. The incoming Gazebo sensor stream remains Best Effort.
OUTPUT_QOS = QoSProfile(
    history=HistoryPolicy.KEEP_LAST,
    depth=5,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.VOLATILE,
)


def pattern_accepts(azimuth, elevation, frame_index, keep_ratio):
    """Return whether one angular sample belongs to this simulated sweep."""
    azimuth_normalized = (azimuth + math.pi) / TAU
    elevation_normalized = (elevation + math.radians(10.0)) / math.radians(70.0)
    phase = (frame_index * GOLDEN_FRACTION) % 1.0
    curved_sweep = (
        5.0 * azimuth_normalized
        + 13.0 * elevation_normalized
        + phase
        + 0.18 * math.sin(TAU * (3.0 * azimuth_normalized - phase))
        + 0.07 * math.sin(TAU * (7.0 * elevation_normalized + phase))
    ) % 1.0
    return curved_sweep < keep_ratio


class M300PatternEmulator(Node):
    """Convert a dense Gazebo cloud into an M300-like changing pattern."""

    def __init__(self):
        super().__init__("m300_pattern_emulator")
        self.declare_parameter(
            "input_topic", "/traffic/vehicle_1/m300/raw_points"
        )
        self.declare_parameter(
            "output_topic", "/traffic/vehicle_1/m300/pointcloud"
        )
        self.declare_parameter("target_points_per_second", 154600.0)
        self.declare_parameter("nominal_output_rate", 8.0)
        self.declare_parameter("minimum_range", 0.20)
        self.declare_parameter("maximum_range", 50.0)

        self.target_points_per_second = max(
            0.0, float(self.get_parameter("target_points_per_second").value)
        )
        self.nominal_output_rate = max(
            0.1, float(self.get_parameter("nominal_output_rate").value)
        )
        self.minimum_range = float(self.get_parameter("minimum_range").value)
        self.maximum_range = float(self.get_parameter("maximum_range").value)
        input_topic = str(self.get_parameter("input_topic").value)
        output_topic = str(self.get_parameter("output_topic").value)

        self.publisher = self.create_publisher(
            PointCloud2, output_topic, OUTPUT_QOS
        )
        self.subscription = self.create_subscription(
            PointCloud2, input_topic, self.on_cloud, qos_profile_sensor_data
        )
        self.frame_index = 0
        self.report_started = time.monotonic()
        self.report_frames = 0
        self.report_points = 0
        self.invalid_layout_reported = False
        self.get_logger().info(
            f"M300 pattern approximation: {input_topic} -> {output_topic}, "
            f"target={self.target_points_per_second:.0f} points/s"
        )

    def _xyz_offsets(self, message):
        fields = {field.name: field for field in message.fields}
        required = [fields.get(axis) for axis in ("x", "y", "z")]
        if any(field is None for field in required):
            return None
        if any(field.datatype != PointField.FLOAT32 for field in required):
            return None
        return tuple(field.offset for field in required)

    def on_cloud(self, message):
        offsets = self._xyz_offsets(message)
        if offsets is None or message.point_step <= 0:
            if not self.invalid_layout_reported:
                self.get_logger().error(
                    "Input cloud must contain FLOAT32 x, y, and z fields"
                )
                self.invalid_layout_reported = True
            return

        byte_order = ">" if message.is_bigendian else "<"
        unpack_float = struct.Struct(byte_order + "f").unpack_from
        selected = bytearray()
        candidates = []
        source = memoryview(message.data)
        x_offset, y_offset, z_offset = offsets

        for row in range(message.height):
            row_start = row * message.row_step
            for column in range(message.width):
                point_start = row_start + column * message.point_step
                try:
                    x = unpack_float(source, point_start + x_offset)[0]
                    y = unpack_float(source, point_start + y_offset)[0]
                    z = unpack_float(source, point_start + z_offset)[0]
                except (struct.error, IndexError):
                    continue
                if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
                    continue
                horizontal_range = math.hypot(x, y)
                distance = math.hypot(horizontal_range, z)
                if distance < self.minimum_range or distance > self.maximum_range:
                    continue
                azimuth = math.atan2(y, x)
                elevation = math.atan2(z, horizontal_range)
                candidates.append((point_start, azimuth, elevation))

        target_points = self.target_points_per_second / self.nominal_output_rate
        keep_ratio = min(1.0, target_points / max(1, len(candidates)))
        for point_start, azimuth, elevation in candidates:
            if pattern_accepts(azimuth, elevation, self.frame_index, keep_ratio):
                selected.extend(
                    source[point_start:point_start + message.point_step]
                )

        output = PointCloud2()
        output.header = message.header
        output.height = 1
        output.width = len(selected) // message.point_step
        output.fields = message.fields
        output.is_bigendian = message.is_bigendian
        output.point_step = message.point_step
        output.row_step = output.width * output.point_step
        output.data = bytes(selected)
        output.is_dense = True
        self.publisher.publish(output)

        self.frame_index += 1
        self.report_frames += 1
        self.report_points += output.width
        elapsed = time.monotonic() - self.report_started
        if elapsed >= 5.0:
            rate = self.report_frames / elapsed
            points_per_second = self.report_points / elapsed
            self.get_logger().info(
                f"publishing {rate:.1f} clouds/s, "
                f"{points_per_second:.0f} valid points/s"
            )
            self.report_started = time.monotonic()
            self.report_frames = 0
            self.report_points = 0


def main(args=None):
    rclpy.init(args=args)
    node = M300PatternEmulator()
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
