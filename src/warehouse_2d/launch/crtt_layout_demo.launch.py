"""Show the stylized CRTT layout in Gazebo without maps or vehicles."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    ExecuteProcess,
    IncludeLaunchDescription,
    TimerAction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    package_share = Path(get_package_share_directory("warehouse_2d"))
    gazebo_share = Path(get_package_share_directory("gazebo_ros"))
    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    str(gazebo_share / "launch" / "gzserver.launch.py")
                ),
                launch_arguments={
                    "world": str(package_share / "worlds" / "crtt_layout_demo.world"),
                    "verbose": "false",
                }.items(),
            ),
            # The optional ROS EOL GUI plugin crashes on this Gazebo Classic
            # installation. The ordinary client renders this demo correctly.
            TimerAction(
                period=2.0,
                actions=[
                    ExecuteProcess(
                        cmd=["gzclient"],
                        output="screen",
                        condition=IfCondition(LaunchConfiguration("gui")),
                    )
                ],
            ),
        ]
    )
