#!/usr/bin/env python3
"""Launch the realistic warehouse world with localization and traffic tools."""

from pathlib import Path
import time

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    """Create a wrapper around the configurable localized-vehicle simulation."""
    package_share = Path(get_package_share_directory("my_first_bot"))
    common_launch = package_share / "launch" / "newwarehouse.launch.py"

    gui = LaunchConfiguration("gui")
    use_web = LaunchConfiguration("use_web")
    use_rviz = LaunchConfiguration("use_rviz")
    database = LaunchConfiguration("database")
    map_yaml = LaunchConfiguration("map")
    map_image = LaunchConfiguration("map_image")
    web_port = LaunchConfiguration("web_port")
    vehicle_count = LaunchConfiguration("vehicle_count")
    traffic_speed = LaunchConfiguration("traffic_speed")
    randomize_starts = LaunchConfiguration("randomize_starts")
    spawn_seed = LaunchConfiguration("spawn_seed")

    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("use_web", default_value="true"),
            DeclareLaunchArgument("use_rviz", default_value="false"),
            DeclareLaunchArgument(
                "database", default_value="~/.ros/real_warehouse_traffic.db"
            ),
            DeclareLaunchArgument(
                "map",
                default_value=str(
                    package_share / "maps" / "real_warehouse_slam.yaml"
                ),
                description="Saved SLAM map used for AMCL and route planning",
            ),
            DeclareLaunchArgument(
                "map_image",
                default_value=str(
                    package_share / "maps" / "real_warehouse_slam.png"
                ),
                description="Saved SLAM map image shown by the web monitor",
            ),
            DeclareLaunchArgument("web_port", default_value="8080"),
            DeclareLaunchArgument(
                "vehicle_count",
                default_value="8",
                description="Number of localized traffic vehicles (1-8)",
            ),
            DeclareLaunchArgument("traffic_speed", default_value="1.2"),
            DeclareLaunchArgument("randomize_starts", default_value="true"),
            DeclareLaunchArgument(
                "spawn_seed",
                default_value=str(int(time.time())),
                description="Random seed; set a fixed number for repeatable starts",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(str(common_launch)),
                launch_arguments={
                    "world": str(
                        package_share / "worlds" / "real_warehouse.world"
                    ),
                    "map": map_yaml,
                    "map_image": map_image,
                    "uwb_tag_config": str(
                        package_share / "config" / "real_warehouse_uwb_tags.yaml"
                    ),
                    "traffic_profile": "newwarehouse",
                    "gui": gui,
                    "use_web": use_web,
                    "use_rviz": use_rviz,
                    "database": database,
                    "web_port": web_port,
                    "vehicle_count": vehicle_count,
                    "traffic_speed": traffic_speed,
                    "randomize_starts": randomize_starts,
                    "spawn_seed": spawn_seed,
                }.items(),
            ),
        ]
    )
