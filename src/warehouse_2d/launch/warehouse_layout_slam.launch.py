#!/usr/bin/env python3
"""Map the Warehouse demo with one automatically driven 2-D LiDAR vehicle."""

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
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    package_share = Path(get_package_share_directory("warehouse_2d"))
    gui = LaunchConfiguration("gui")
    use_rviz = LaunchConfiguration("use_rviz")
    auto_drive = LaunchConfiguration("auto_drive")
    mapping_speed = LaunchConfiguration("mapping_speed")
    loop_route = LaunchConfiguration("loop_route")
    slam_params = LaunchConfiguration("slam_params")
    use_scan_matching = LaunchConfiguration("use_scan_matching")
    do_loop_closing = LaunchConfiguration("do_loop_closing")
    vehicle_template = (
        package_share / "models" / "traffic_vehicle" / "localized_vehicle.sdf.in"
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("use_rviz", default_value="true"),
            DeclareLaunchArgument("auto_drive", default_value="true"),
            DeclareLaunchArgument("mapping_speed", default_value="0.4"),
            DeclareLaunchArgument("loop_route", default_value="false"),
            DeclareLaunchArgument("use_scan_matching", default_value="true"),
            DeclareLaunchArgument("do_loop_closing", default_value="false"),
            DeclareLaunchArgument(
                "slam_params",
                default_value=str(
                    package_share / "config" / "warehouse_slam_diagnostic.yaml"
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
                    str(package_share / "launch" / "warehouse_layout_demo.launch.py")
                ),
                launch_arguments={"gui": gui}.items(),
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
                        package="warehouse_2d",
                        executable="spawn_localized_vehicle.py",
                        name="spawn_warehouse_mapping_vehicle",
                        parameters=[
                            {
                                "entity": "vehicle_1",
                                "robot_namespace": "/traffic/vehicle_1",
                                "template": str(vehicle_template),
                                # One northern-road lane, clear of stations.
                                "x": 0.0,
                                "y": 24.0,
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
                        parameters=[
                            slam_params,
                            {
                                "use_sim_time": True,
                                "use_scan_matching": ParameterValue(
                                    use_scan_matching, value_type=bool
                                ),
                                "do_loop_closing": ParameterValue(
                                    do_loop_closing, value_type=bool
                                ),
                            },
                        ],
                        output="screen",
                    )
                ],
            ),
            Node(
                package="warehouse_2d",
                executable="mapping_path.py",
                name="mapping_path",
                parameters=[{"use_sim_time": True, "vehicle_name": "vehicle_1"}],
                output="screen",
            ),
            TimerAction(
                period=5.0,
                actions=[
                    Node(
                        package="rviz2",
                        executable="rviz2",
                        name="warehouse_slam_rviz",
                        additional_env={"GTK_PATH": ""},
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
            TimerAction(
                period=7.0,
                actions=[
                    Node(
                        package="warehouse_2d",
                        executable="warehouse_mapping_driver.py",
                        name="warehouse_mapping_driver",
                        parameters=[
                            {
                                "use_sim_time": True,
                                "max_speed": ParameterValue(
                                    mapping_speed, value_type=float
                                ),
                                "loop": ParameterValue(
                                    loop_route, value_type=bool
                                ),
                            }
                        ],
                        condition=IfCondition(auto_drive),
                        output="screen",
                    )
                ],
            ),
        ]
    )
