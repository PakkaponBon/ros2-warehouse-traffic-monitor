"""Show the enlarged delivery warehouse in Gazebo without vehicles."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    ExecuteProcess,
    GroupAction,
    IncludeLaunchDescription,
    TimerAction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    # Resolve beside this launch file so an older warehouse_2d overlay cannot
    # silently supply its compact world when this file is launched directly.
    world_file = Path(__file__).resolve().parent.parent / "worlds" / "delivery_site.world"
    gazebo_share = Path(get_package_share_directory("gazebo_ros"))
    return LaunchDescription(
        [
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("world", default_value=str(world_file)),
            GroupAction(actions=[
                IncludeLaunchDescription(
                    PythonLaunchDescriptionSource(
                        str(gazebo_share / "launch" / "gzserver.launch.py")
                    ),
                    launch_arguments={
                        "world": LaunchConfiguration("world"),
                        "verbose": "false",
                        # The fleet's profile is not a Gazebo physics preset.
                        "profile": "",
                    }.items(),
                ),
            ]),
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
