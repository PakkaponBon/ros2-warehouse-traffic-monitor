#!/usr/bin/env python3
"""Map the realistic warehouse using one moving 2-D LiDAR vehicle."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    SetEnvironmentVariable,
    TimerAction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    """Launch Gazebo, a mapping vehicle, slam_toolbox, and optional RViz."""
    package_share = Path(get_package_share_directory("my_first_bot"))
    gazebo_share = Path(get_package_share_directory("gazebo_ros"))

    gui = LaunchConfiguration("gui")
    use_rviz = LaunchConfiguration("use_rviz")
    mapping_speed = LaunchConfiguration("mapping_speed")
    mapping_seed = LaunchConfiguration("mapping_seed")
    world = LaunchConfiguration("world")
    route_map = LaunchConfiguration("route_map")
    slam_params = LaunchConfiguration("slam_params")
    vehicle_template = (
        package_share / "models" / "traffic_vehicle" / "localized_vehicle.sdf.in"
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("use_rviz", default_value="true"),
            DeclareLaunchArgument("mapping_speed", default_value="0.65"),
            DeclareLaunchArgument("mapping_seed", default_value="42"),
            DeclareLaunchArgument(
                "world",
                default_value=str(
                    package_share / "worlds" / "real_warehouse.world"
                ),
            ),
            DeclareLaunchArgument(
                "route_map",
                default_value=str(package_share / "maps" / "real_warehouse.yaml"),
                description=(
                    "Ground-truth map used only to drive the simulated mapping route"
                ),
            ),
            DeclareLaunchArgument(
                "slam_params",
                default_value=str(
                    package_share / "config" / "real_warehouse_slam.yaml"
                ),
            ),
            SetEnvironmentVariable(
                "GAZEBO_RESOURCE_PATH",
                f"{package_share}:/usr/share/gazebo-11",
            ),
            SetEnvironmentVariable(
                "GAZEBO_MODEL_PATH",
                f"{package_share / 'models'}:/usr/share/gazebo-11/models",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    str(gazebo_share / "launch" / "gazebo.launch.py")
                ),
                launch_arguments={
                    "world": world,
                    "gui": gui,
                    "verbose": "false",
                }.items(),
            ),
            Node(
                package="tf2_ros",
                executable="static_transform_publisher",
                name="vehicle_1_laser_transform",
                arguments=[
                    "--x", "-0.12", "--y", "0", "--z", "0.84",
                    "--yaw", "0", "--pitch", "0", "--roll", "0",
                    "--frame-id", "vehicle_1/base_link",
                    "--child-frame-id", "vehicle_1/laser",
                ],
                output="screen",
            ),
            TimerAction(
                period=2.0,
                actions=[
                    Node(
                        package="my_first_bot",
                        executable="spawn_localized_vehicle.py",
                        name="spawn_mapping_vehicle",
                        parameters=[
                            {
                                "entity": "vehicle_1",
                                "robot_namespace": "/traffic/vehicle_1",
                                "template": str(vehicle_template),
                                # Starting at the world origin keeps the SLAM
                                # map frame aligned with simulation ground truth.
                                "x": 0.0,
                                "y": 0.0,
                                "z": 0.3,
                                "yaw": 0.0,
                                "random_start": False,
                            }
                        ],
                        output="screen",
                    )
                ],
            ),
            TimerAction(
                period=3.0,
                actions=[
                    Node(
                        package="slam_toolbox",
                        executable="async_slam_toolbox_node",
                        name="slam_toolbox",
                        parameters=[slam_params, {"use_sim_time": True}],
                        output="screen",
                    )
                ],
            ),
            TimerAction(
                period=5.0,
                actions=[
                    Node(
                        package="my_first_bot",
                        executable="traffic_simulator.py",
                        name="slam_mapping_driver",
                        parameters=[
                            {
                                "use_sim_time": True,
                                "vehicle_count": 1,
                                "max_speed": mapping_speed,
                                "seed": mapping_seed,
                                "profile": "newwarehouse",
                                # Gazebo is used only by the demo driver. SLAM
                                # itself receives only odometry and 2-D scans.
                                "pose_source": "gazebo",
                                "map_yaml": route_map,
                            }
                        ],
                        output="screen",
                    ),
                    Node(
                        package="rviz2",
                        executable="rviz2",
                        name="slam_rviz",
                        arguments=[
                            "-d",
                            str(package_share / "rviz" / "slam_mapping.rviz"),
                        ],
                        parameters=[{"use_sim_time": True}],
                        condition=IfCondition(use_rviz),
                        output="screen",
                    ),
                ],
            ),
        ]
    )
