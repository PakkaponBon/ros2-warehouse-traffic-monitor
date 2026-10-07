"""Run localized Warehouse forklifts with automatic pickup and delivery jobs."""

import math
from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, IncludeLaunchDescription, OpaqueFunction, TimerAction
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
import yaml


def launch_fleet(context):
    share = Path(get_package_share_directory("warehouse_2d"))

    def value(key):
        return LaunchConfiguration(key).perform(context)

    profile = value("profile")
    profile_limits = {"warehouse_delivery": 4, "warehouse_roads": 8}
    if profile not in profile_limits:
        raise ValueError(f"unknown delivery profile: {profile}")
    speed = float(value("traffic_speed"))
    source = value("pose_source")
    gazebo_validation = value("gazebo_validation").lower()
    if gazebo_validation not in {"true", "false"}:
        raise ValueError("gazebo_validation must be true or false")
    if source == "gazebo" and gazebo_validation == "false":
        raise ValueError("Gazebo pose source requires gazebo_validation:=true")
    config = yaml.safe_load(Path(value("delivery_config")).expanduser().read_text())
    maximum = min(profile_limits[profile], len(config["spawns"]))
    requested = value("vehicle_count")
    count = maximum if requested == "auto" else int(requested)
    if not 1 <= count <= maximum:
        raise ValueError(f"vehicle_count must be between 1 and {maximum} for {profile}")
    if not math.isfinite(speed) or not 0.0 < speed <= 1.0:
        raise ValueError("traffic_speed must be between 0 and 1 m/s")
    if source not in {"amcl", "gazebo"}:
        raise ValueError("pose_source must be amcl or gazebo")
    dx, dy, angle = (float(value(key)) for key in
                     ("world_to_map_x", "world_to_map_y", "world_to_map_yaw"))
    if not all(math.isfinite(v) for v in (dx, dy, angle)):
        raise ValueError("world_to_map transform must be finite")
    map_path = Path(value("map")).expanduser()
    if not map_path.is_file():
        raise ValueError(f"Saved SLAM map does not exist: {map_path}; run mapping before delivery")
    nodes = [
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(share / "launch" / "warehouse_layout_demo.launch.py")),
            launch_arguments={"gui": value("gui")}.items()),
        Node(package="nav2_map_server", executable="map_server", name="map_server",
             parameters=[{"use_sim_time": True, "yaml_filename": str(map_path)}], output="screen"),
        Node(package="nav2_lifecycle_manager", executable="lifecycle_manager", name="map_lifecycle_manager",
             parameters=[{"use_sim_time": True, "autostart": True, "node_names": ["map_server"]}], output="screen"),
    ]
    for index, spawn in enumerate(config["spawns"][:count], start=1):
        name = f"vehicle_{index}"
        x, y, yaw = (float(spawn[key]) for key in ("x", "y", "yaw"))
        map_x = math.cos(angle) * x - math.sin(angle) * y + dx
        map_y = math.sin(angle) * x + math.cos(angle) * y + dy
        nodes.extend([
            Node(package="tf2_ros", executable="static_transform_publisher", name=f"{name}_laser_transform",
                 arguments=["--x", "-0.12", "--y", "0", "--z", "0.84", "--yaw", "0", "--pitch", "0",
                            "--roll", "0", "--frame-id", f"{name}/base_link", "--child-frame-id", f"{name}/laser"],
                 output="screen"),
            TimerAction(period=3.0 + index * 0.8, actions=[
                Node(package="warehouse_2d", executable="spawn_localized_vehicle.py", name=f"spawn_{name}",
                     parameters=[{"entity": name, "robot_namespace": f"/traffic/{name}",
                                  "template": str(share / "models" / "traffic_vehicle" / "localized_vehicle.sdf.in"),
                                  "x": x, "y": y, "yaw": yaw, "z": 0.3, "random_start": False}], output="screen")]),
            Node(package="nav2_amcl", executable="amcl", namespace=f"traffic/{name}", name="amcl",
                 remappings=[("map", "/map")], parameters=[{
                     "use_sim_time": True, "base_frame_id": f"{name}/base_link", "global_frame_id": "map",
                     "odom_frame_id": f"{name}/odom", "scan_topic": "scan",
                     "alpha1": 0.05, "alpha2": 0.05, "alpha3": 0.05, "alpha4": 0.05, "alpha5": 0.05,
                     "min_particles": 400, "max_particles": 1200, "max_beams": 90,
                     "laser_model_type": "likelihood_field", "laser_min_range": 0.15, "laser_max_range": 20.0,
                     "laser_likelihood_max_dist": 2.0, "do_beamskip": True,
                     "beam_skip_distance": 0.5, "beam_skip_threshold": 0.3, "beam_skip_error_threshold": 0.9,
                     "robot_model_type": "nav2_amcl::DifferentialMotionModel", "set_initial_pose": True,
                     "initial_pose.x": map_x, "initial_pose.y": map_y, "initial_pose.z": 0.0,
                     "initial_pose.yaw": yaw + angle, "tf_broadcast": True, "transform_tolerance": 0.5,
                     "update_min_d": 0.08, "update_min_a": 0.08, "resample_interval": 1,
                 }], output="screen"),
            # Give each AMCL manager time to configure before the next starts.
            # Starting all four together can leave a configure response timed out
            # and one vehicle permanently unlocalized.
            TimerAction(period=6.0 + index * 2.0, actions=[
                Node(package="nav2_lifecycle_manager", executable="lifecycle_manager",
                     namespace=f"traffic/{name}", name="localization_lifecycle_manager",
                     parameters=[{"use_sim_time": True, "autostart": True, "node_names": ["amcl"]}], output="screen")]),
        ])
    if source == "amcl":
        # Recover AMCL nodes whose configure response timed out while the
        # node itself reached inactive; otherwise those vehicles never drive.
        nodes.append(TimerAction(period=30.0, actions=[
            Node(package="warehouse_2d", executable="ensure_traffic_amcl.py",
                 parameters=[{"vehicle_count": count}], output="screen")]))
    recover_with_gazebo = source == "amcl" and gazebo_validation == "true"
    if recover_with_gazebo:
        nodes.append(Node(
            package="warehouse_2d", executable="gazebo_amcl_validator.py",
            name="gazebo_amcl_validator", parameters=[{
                "use_sim_time": True, "vehicle_count": count,
                "world_to_map_x": dx, "world_to_map_y": dy,
                "world_to_map_yaw": angle,
            }], output="screen"))
    nodes.extend([
        TimerAction(period=8.0, actions=[
            Node(package="warehouse_2d", executable="warehouse_delivery_simulator.py", name="warehouse_delivery_simulator",
                 parameters=[{"use_sim_time": True, "vehicle_count": count, "max_speed": speed,
                              "profile": profile, "pose_source": source, "random_vehicle": "none",
                              "traffic_mode": value("traffic_mode"),
                              "require_localization_ready": recover_with_gazebo,
                              "map_yaml": str(map_path), "delivery_config": value("delivery_config"),
                              "planning_resolution": 0.30, "robot_clearance": 0.80, "update_period": 0.1,
                              "avoidance_distance": 1.0, "emergency_distance": 0.65,
                              "world_to_map_x": dx, "world_to_map_y": dy, "world_to_map_yaw": angle}], output="screen")]),
        Node(package="warehouse_2d", executable="traffic_recorder.py", name="traffic_recorder",
             parameters=[{"use_sim_time": True, "database_path": value("database"),
                          "traffic_vehicle_count": count, "traffic_pose_source": source,
                          "validate_against_gazebo": gazebo_validation == "true",
                          "congestion_min_vehicles": 2, "congestion_duration": 10.0,
                          "model_states_frame": "world", "world_to_map_x": dx, "world_to_map_y": dy,
                          "world_to_map_yaw": angle}], output="screen"),
        Node(package="warehouse_2d", executable="traffic_heatmap.py", name="traffic_heatmap",
             parameters=[{"use_sim_time": True, "database_path": value("database")}], output="screen"),
        TimerAction(period=4.0, actions=[
            Node(package="warehouse_2d", executable="web_monitor.py", name="web_monitor",
                 parameters=[{"use_sim_time": True, "database_path": value("database"),
                              "map_yaml": str(map_path), "map_image": str(map_path.with_suffix(".png")),
                              "web_root": str((share / "web" / "dist" / "index.html").resolve().parent),
                              "web_port": int(value("web_port")),
                              "traffic_vehicle_count": count, "enable_side_tasks": False,
                              "enable_simulation_faults": False}],
                 condition=IfCondition(value("use_web")), output="screen")]),
        ExecuteProcess(cmd=[str(share.parent.parent / "lib" / "warehouse_2d" / "prepare_slam_map.py"),
                            str(map_path)], condition=IfCondition(value("use_web")), output="screen"),
        TimerAction(period=7.0, actions=[
            Node(package="rviz2", executable="rviz2", arguments=["-d", str(share / "rviz" / "warehouse_delivery.rviz")],
                 # Snap terminal GTK modules can load an incompatible libpthread.
                 additional_env={"GTK_PATH": ""},
                 parameters=[{"use_sim_time": True}], condition=IfCondition(value("use_rviz")), output="screen")]),
    ])
    return nodes


def generate_launch_description():
    share = Path(get_package_share_directory("warehouse_2d"))
    return LaunchDescription([
        DeclareLaunchArgument("gui", default_value="true"),
        DeclareLaunchArgument("use_rviz", default_value="true"),
        DeclareLaunchArgument("use_web", default_value="true"),
        DeclareLaunchArgument("profile", default_value="warehouse_delivery",
                              description="warehouse_delivery or warehouse_roads"),
        DeclareLaunchArgument("vehicle_count", default_value="auto",
                              description="Forklifts to spawn; auto uses all starts in the selected profile"),
        DeclareLaunchArgument("traffic_speed", default_value="0.5", description="Maximum speed in m/s"),
        DeclareLaunchArgument("traffic_mode", default_value="auto",
                              description="auto: roads roam continuously, delivery runs jobs; roam or jobs to override"),
        DeclareLaunchArgument("pose_source", default_value="amcl", description="amcl normally; gazebo for controller diagnostics"),
        DeclareLaunchArgument("gazebo_validation", default_value="true",
                              description="Compare AMCL with Gazebo truth and recover localization after jumps"),
        DeclareLaunchArgument("map", default_value=str(share / "maps" / "delivery_site.yaml")),
        DeclareLaunchArgument("delivery_config", default_value=str(share / "config" / "warehouse_delivery.yaml")),
        # Set these from a measured alignment when using a new SLAM map.
        DeclareLaunchArgument("world_to_map_x", default_value="0.0"),
        DeclareLaunchArgument("world_to_map_y", default_value="0.0"),
        DeclareLaunchArgument("world_to_map_yaw", default_value="0.0"),
        DeclareLaunchArgument("database", default_value=str(Path.home() / ".ros" / "delivery_site_traffic.db")),
        DeclareLaunchArgument("web_port", default_value="8080"),
        OpaqueFunction(function=launch_fleet),
    ])
