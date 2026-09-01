#!/usr/bin/env python3
"""Query SQLite traffic history and publish RViz heatmap marker layers."""

import json
import math
import sqlite3
import time

import rclpy
from rclpy.duration import Duration
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_srvs.srv import Trigger
from visualization_msgs.msg import Marker, MarkerArray

from traffic_common import grid_counts, iso_time, open_database, parse_time


class TrafficHeatmap(Node):
    def __init__(self):
        super().__init__("traffic_heatmap")
        self.declare_parameter("database_path", "~/.ros/warehouse_traffic.db")
        self.declare_parameter("start_time", "")
        self.declare_parameter("end_time", "")
        self.declare_parameter("default_window_seconds", 3600.0)
        self.declare_parameter("grid_resolution", 0.5)
        self.declare_parameter("map_frame", "map")

        database_path = self.get_parameter("database_path").value
        self.connection = open_database(database_path)
        qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            reliability=ReliabilityPolicy.RELIABLE,
        )
        self.density_publisher = self.create_publisher(
            MarkerArray, "/traffic_history/density", qos
        )
        self.stuck_publisher = self.create_publisher(
            MarkerArray, "/traffic_history/stuck", qos
        )
        self.congestion_publisher = self.create_publisher(
            MarkerArray, "/traffic_history/congestion", qos
        )
        self.create_service(Trigger, "/traffic_history/query", self.on_query)
        self.get_logger().info(
            "History query ready: set start_time/end_time, then call /traffic_history/query"
        )

    def on_query(self, _request, response):
        now = time.time()
        try:
            end = parse_time(self.get_parameter("end_time").value, now)
            window = float(self.get_parameter("default_window_seconds").value)
            start = parse_time(self.get_parameter("start_time").value, end - window)
            if start >= end:
                raise ValueError("start_time must be earlier than end_time")
            resolution = float(self.get_parameter("grid_resolution").value)
            if resolution <= 0.0:
                raise ValueError("grid_resolution must be positive")

            sample_rows = self.connection.execute(
                "SELECT x, y FROM samples WHERE observed_at BETWEEN ? AND ?",
                (start, end),
            ).fetchall()
            stuck_rows = self.connection.execute(
                """SELECT vehicle_id, x, y, started_at, ended_at
                   FROM stuck_events
                   WHERE ended_at >= ? AND started_at <= ?""",
                (start, end),
            ).fetchall()
            congestion_rows = self.connection.execute(
                """SELECT group_key, vehicle_count, x, y, started_at, ended_at
                   FROM congestion_events
                   WHERE ended_at >= ? AND started_at <= ?""",
                (start, end),
            ).fetchall()

            cells = grid_counts(sample_rows, resolution)
            self.density_publisher.publish(self._density_markers(cells, resolution))
            self.stuck_publisher.publish(self._event_markers(stuck_rows, "stuck"))
            self.congestion_publisher.publish(
                self._event_markers(congestion_rows, "congestion")
            )
            response.success = True
            response.message = json.dumps(
                {
                    "start": iso_time(start),
                    "end": iso_time(end),
                    "samples": len(sample_rows),
                    "occupied_cells": len(cells),
                    "stuck_events": len(stuck_rows),
                    "congestion_events": len(congestion_rows),
                }
            )
        except (ValueError, sqlite3.Error) as error:
            response.success = False
            response.message = str(error)
        return response

    def _base_marker(self, namespace, marker_id, marker_type):
        marker = Marker()
        marker.header.frame_id = self.get_parameter("map_frame").value
        marker.header.stamp = self.get_clock().now().to_msg()
        marker.ns = namespace
        marker.id = marker_id
        marker.type = marker_type
        marker.action = Marker.ADD
        marker.pose.orientation.w = 1.0
        marker.lifetime = Duration().to_msg()
        return marker

    def _delete_all(self, namespace):
        marker = self._base_marker(namespace, 0, Marker.CUBE)
        marker.action = Marker.DELETEALL
        return marker

    def _density_markers(self, cells, resolution):
        output = MarkerArray()
        output.markers.append(self._delete_all("traffic_density"))
        maximum = max(cells.values(), default=1)
        for marker_id, ((grid_x, grid_y), count) in enumerate(cells.items(), start=1):
            marker = self._base_marker("traffic_density", marker_id, Marker.CUBE)
            marker.pose.position.x = (grid_x + 0.5) * resolution
            marker.pose.position.y = (grid_y + 0.5) * resolution
            marker.pose.position.z = 0.03
            marker.scale.x = resolution
            marker.scale.y = resolution
            marker.scale.z = 0.05
            intensity = math.log1p(count) / math.log1p(maximum)
            marker.color.r = float(intensity)
            marker.color.g = float(0.25 * (1.0 - intensity))
            marker.color.b = float(1.0 - intensity)
            marker.color.a = 0.65
            output.markers.append(marker)
        return output

    def _event_markers(self, rows, kind):
        output = MarkerArray()
        output.markers.append(self._delete_all(f"traffic_{kind}"))
        for marker_id, row in enumerate(rows, start=1):
            marker = self._base_marker(f"traffic_{kind}", marker_id, Marker.SPHERE)
            if kind == "stuck":
                _vehicle, x, y, _started, _ended = row
                scale = 0.8
                marker.color.r, marker.color.g, marker.color.b = 1.0, 0.85, 0.0
            else:
                _group, vehicle_count, x, y, _started, _ended = row
                scale = max(1.0, min(3.0, float(vehicle_count) * 0.5))
                marker.color.r, marker.color.g, marker.color.b = 1.0, 0.0, 0.0
            marker.pose.position.x = float(x)
            marker.pose.position.y = float(y)
            marker.pose.position.z = 0.2
            marker.scale.x = marker.scale.y = marker.scale.z = scale
            marker.color.a = 0.75
            output.markers.append(marker)
        return output

    def destroy_node(self):
        self.connection.close()
        return super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = TrafficHeatmap()
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
